import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Alert, Button, Card, Field, Input, Status, Table, money, useFetch } from "../components/ui.jsx";
import { createEmployee, getEmployees } from "../services/api.js";

const empty = { name: "", email: "", password: "", department: "", designation: "", salary: "" };

export default function Employees() {
  const { data, loading, error, reload } = useFetch(getEmployees);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    try {
      await createEmployee({ ...form, salary: form.salary === "" ? undefined : Number(form.salary) });
      setMsg({ ok: "Employee created." });
      setForm(empty);
      reload();
    } catch (err) {
      setMsg({ err: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Employees</h1>
      <Card title="Add employee">
        <form onSubmit={submit} className="space-y-4">
          <Alert>{msg.err}</Alert>
          <Alert type="ok">{msg.ok}</Alert>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name"><Input required value={form.name} onChange={set("name")} /></Field>
            <Field label="Email"><Input required type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Password (8+ characters)"><Input required minLength={8} type="password" value={form.password} onChange={set("password")} /></Field>
            <Field label="Department"><Input value={form.department} onChange={set("department")} /></Field>
            <Field label="Designation"><Input value={form.designation} onChange={set("designation")} /></Field>
            <Field label="Monthly salary"><Input type="number" min="0" value={form.salary} onChange={set("salary")} /></Field>
          </div>
          <Button type="submit" disabled={busy}><UserPlus size={16} /> {busy ? "Saving..." : "Add employee"}</Button>
        </form>
      </Card>
      <Card title="All employees">
        <Status loading={loading} error={error} />
        {data && (
          <Table
            head={["Name", "Email", "Department", "Designation", "Salary"]}
            rows={data.employees.map((e) => [e.name, e.email, e.department || "-", e.designation || "-", money(e.salary)])}
            empty="No employees yet. Add the first one above."
          />
        )}
      </Card>
    </>
  );
}
