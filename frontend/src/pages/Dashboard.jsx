import { Users, UserCheck, UserX, CalendarOff, Wallet, UserPlus, Clock, FilePlus, CalendarCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Badge, Button, Card, MONTHS, Status, fmtDate, fmtTime, money, todayStr, useFetch } from "../components/ui.jsx";
import { getAttendance, getEmployees, getLeaves, getPayroll } from "../services/api.js";
import { AttendanceActions } from "./Attendance.jsx";

const TONES = {
  indigo: ["bg-indigo-100 text-indigo-700", "border-indigo-500"],
  emerald: ["bg-emerald-100 text-emerald-700", "border-emerald-500"],
  amber: ["bg-amber-100 text-amber-700", "border-amber-500"],
  rose: ["bg-rose-100 text-rose-700", "border-rose-500"],
  sky: ["bg-sky-100 text-sky-700", "border-sky-500"],
};

const Stat = ({ icon: Icon, label, value, hint, tone = "indigo", onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-start gap-4 rounded-2xl border-l-4 bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${TONES[tone][1]}`}
  >
    <span className={`rounded-xl p-3 ${TONES[tone][0]}`}><Icon size={22} /></span>
    <span className="min-w-0">
      <span className="block font-display text-2xl font-bold sm:text-3xl">{value}</span>
      <span className="block text-sm text-slate-600">{label}</span>
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </span>
  </button>
);

const Bar = ({ percent, color = "bg-accent" }) => (
  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
  </div>
);

const Row = ({ left, right }) => (
  <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
    <span className="min-w-0 truncate">{left}</span>
    <span className="shrink-0 text-slate-500">{right}</span>
  </li>
);

const Empty = ({ text }) => <p className="py-6 text-center text-sm text-slate-500">{text}</p>;

function Staff({ go }) {
  const now = new Date();
  const { data, loading, error } = useFetch(async () => {
    const [e, a, l, p] = await Promise.all([
      getEmployees(),
      getAttendance({ date: todayStr() }),
      getLeaves({ status: "pending" }),
      getPayroll({ month: now.getMonth() + 1, year: now.getFullYear() }),
    ]);
    return { employees: e.employees, attendance: a.records, leaves: l.leaves, payrolls: p.payrolls };
  });

  if (loading || error) return <Status loading={loading} error={error} />;

  const total = data.employees.length;
  const present = data.attendance.length;
  const late = data.attendance.filter((r) => r.status === "late").length;
  const notIn = Math.max(total - present, 0);
  const pct = total ? Math.round((present / total) * 100) : 0;

  const depts = Object.entries(
    data.employees.reduce((acc, e) => {
      const k = e.department || "Unassigned";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const payTotal = data.payrolls.reduce((s, p) => s + p.netSalary, 0);
  const paid = data.payrolls.filter((p) => p.status === "paid").length;
  const recent = [...data.attendance].sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn)).slice(0, 5);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => go("employees")}><UserPlus size={16} /> Add employee</Button>
        <Button variant="ghost" onClick={() => go("attendance")}><Clock size={16} /> Mark attendance</Button>
        <Button variant="ghost" onClick={() => go("payroll")}><FilePlus size={16} /> Generate payroll</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Employees" value={total} tone="indigo" onClick={() => go("employees")} />
        <Stat icon={UserCheck} label="Present today" value={present} hint={late ? `${late} late` : "On time"} tone="emerald" onClick={() => go("attendance")} />
        <Stat icon={UserX} label="Not checked in" value={notIn} tone="rose" onClick={() => go("attendance")} />
        <Stat icon={CalendarOff} label="Pending leaves" value={data.leaves.length} tone="amber" onClick={() => go("leaves")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Today's attendance" action={<span className="text-sm font-semibold">{pct}%</span>}>
            <Bar percent={pct} color="bg-emerald-500" />
            <p className="mb-3 mt-2 text-xs text-slate-500">{present} of {total} employees have checked in</p>
            {recent.length === 0 ? (
              <Empty text="Nobody has checked in yet today." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((r) => (
                  <Row key={r._id} left={r.employee?.name || "-"} right={<span className="flex items-center gap-2">{fmtTime(r.checkIn)} <Badge value={r.status} /></span>} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Payroll, ${MONTHS[now.getMonth()]}`}>
          {data.payrolls.length === 0 ? (
            <Empty text="No payroll generated this month." />
          ) : (
            <>
              <p className="font-display text-2xl font-bold">{money(payTotal)}</p>
              <p className="mb-3 text-xs text-slate-500">Total net salary</p>
              <Bar percent={(paid / data.payrolls.length) * 100} />
              <p className="mt-2 text-sm text-slate-600">{paid} paid, {data.payrolls.length - paid} waiting</p>
            </>
          )}
          <Button variant="ghost" className="mt-4 w-full" onClick={() => go("payroll")}><Wallet size={16} /> Open payroll</Button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Leave requests waiting" action={<Button variant="ghost" onClick={() => go("leaves")}>Review</Button>}>
          {data.leaves.length === 0 ? (
            <Empty text="No pending requests." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.leaves.slice(0, 5).map((l) => (
                <Row key={l._id} left={<><b>{l.employee?.name}</b> <span className="text-slate-500">{l.reason}</span></>} right={`${fmtDate(l.startDate)} to ${fmtDate(l.endDate)}`} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Employees by department">
          {depts.length === 0 ? (
            <Empty text="Add employees to see departments." />
          ) : (
            <ul className="space-y-3">
              {depts.map(([name, count]) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{name}</span><span className="text-slate-500">{count}</span></div>
                  <Bar percent={(count / total) * 100} color="bg-sky-500" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Mine({ go }) {
  const month = todayStr().slice(0, 7);
  const today = useFetch(() => getAttendance({ date: todayStr() }));
  const all = useFetch(async () => {
    const [a, l, p] = await Promise.all([getAttendance(), getLeaves(), getPayroll()]);
    return { attendance: a.records, leaves: l.leaves, payrolls: p.payrolls };
  });
  const reload = () => { today.reload(); all.reload(); };
  const rec = today.data?.records?.[0];
  const d = all.data;
  const leaveCount = (s) => d.leaves.filter((l) => l.status === s).length;
  const slip = d?.payrolls?.[0];

  return (
    <>
      <Card title="Today">
        <Status loading={today.loading} error={today.error} />
        {today.data && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {rec ? (
                <>Checked in at <b>{fmtTime(rec.checkIn)}</b>{rec.checkOut && <>, out at <b>{fmtTime(rec.checkOut)}</b></>} <Badge value={rec.status} /></>
              ) : "You have not checked in yet."}
            </p>
            <AttendanceActions onDone={reload} />
          </div>
        )}
      </Card>

      <Status loading={all.loading} error={all.error} />
      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={CalendarCheck} label="Days present this month" value={d.attendance.filter((r) => r.date.startsWith(month)).length} tone="emerald" onClick={() => go("attendance")} />
            <Stat icon={CalendarOff} label="Leaves pending" value={leaveCount("pending")} hint={`${leaveCount("approved")} approved`} tone="amber" onClick={() => go("leaves")} />
            <Stat icon={Wallet} label="Latest net salary" value={slip ? money(slip.netSalary) : "-"} hint={slip ? `${MONTHS[slip.month - 1]} ${slip.year}` : "No payslip yet"} tone="sky" onClick={() => go("payroll")} />
          </div>

          <Card title="Recent attendance">
            {d.attendance.length === 0 ? (
              <Empty text="No attendance records yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.attendance.slice(0, 5).map((r) => (
                  <Row key={r._id} left={fmtDate(r.date)} right={<span className="flex items-center gap-2">{fmtTime(r.checkIn)} to {fmtTime(r.checkOut)} <Badge value={r.status} /></span>} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}

export default function Dashboard({ go }) {
  const { user } = useAuth();
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const staff = user.role !== "employee";

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <svg
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 text-white/15 motion-safe:animate-[spin_90s_linear_infinite]"
        >
          <circle cx="100" cy="100" r="28" />
          <circle cx="100" cy="100" r="54" />
          <circle cx="100" cy="100" r="80" />
          <circle cx="100" cy="100" r="98" />
          <circle cx="154" cy="100" r="6" fill="#7c8cff" stroke="none" />
          <circle cx="42" cy="152" r="5" fill="#5eead4" stroke="none" />
          <circle cx="100" cy="2" r="4" fill="#fcd34d" stroke="none" />
        </svg>
        <div className="relative">
          <p className="text-sm text-indigo-200">{date}</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-2 max-w-md text-sm text-slate-300">
            {staff ? "Here is how your team is doing today." : "Check in for the day and keep track of your leaves and salary."}
          </p>
        </div>
      </div>

      {staff ? <Staff go={go} /> : <Mine go={go} />}
    </>
  );
}