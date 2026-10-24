import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Badge, Button, Card, Field, Input, Select, Status, Table, fmtDate, fmtTime, todayStr, useFetch } from "../components/ui.jsx";
import { checkIn, checkOut, getAttendance, getEmployees } from "../services/api.js";

// Check in / out buttons. Admin and HR pick an employee first.
export function AttendanceActions({ onDone }) {
  const { user } = useAuth();
  const staff = user.role !== "employee";
  const emps = useFetch(() => (staff ? getEmployees() : Promise.resolve(null)));
  const [empId, setEmpId] = useState("");
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setMsg({});
    try {
      const r = await fn(empId);
      setMsg({ ok: r.message });
      onDone?.();
    } catch (e) {
      setMsg({ err: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Alert>{msg.err}</Alert>
      <Alert type="ok">{msg.ok}</Alert>
      <div className="flex flex-wrap items-end gap-3">
        {staff && (
          <div className="min-w-48 flex-1">
            <Field label="Employee">
              <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">Select employee</option>
                {emps.data?.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
              </Select>
            </Field>
          </div>
        )}
        <Button disabled={busy || (staff && !empId)} onClick={() => run(checkIn)}><LogIn size={16} /> Check in</Button>
        <Button variant="ghost" disabled={busy || (staff && !empId)} onClick={() => run(checkOut)}><LogOut size={16} /> Check out</Button>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const staff = user.role !== "employee";
  const [date, setDate] = useState(todayStr());
  const { data, loading, error, reload } = useFetch(() => getAttendance(staff ? { date } : {}), [date]);

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Attendance</h1>
      <Card title={staff ? "Mark attendance" : "Mark today"}><AttendanceActions onDone={reload} /></Card>
      <Card title="Records" action={staff && <div className="w-44"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>}>
        <Status loading={loading} error={error} />
        {data && (
          <Table
            head={staff ? ["Employee", "Date", "In", "Out", "Status"] : ["Date", "In", "Out", "Status"]}
            rows={data.records.map((r) => [
              ...(staff ? [r.employee?.name || "-"] : []),
              fmtDate(r.date), fmtTime(r.checkIn), fmtTime(r.checkOut), <Badge value={r.status} />,
            ])}
            empty="No attendance records found."
          />
        )}
      </Card>
    </>
  );
}
