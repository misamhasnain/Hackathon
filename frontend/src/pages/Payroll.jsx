import { useState } from "react";
import { BadgeCheck, Download, Eye, FilePlus, Lock, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Badge, Button, Card, Field, Input, MONTHS, Select, Status, Table, money, useFetch } from "../components/ui.jsx";
import { finalizePayroll, generatePayroll, getEmployees, getPayroll, markPayrollPaid } from "../services/api.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const earnedGross = (p) => (p.workingDays ? Math.round((p.grossSalary * p.payableDays) / p.workingDays) : p.grossSalary || 0);

// Opens a printable payslip. In the print window choose "Save as PDF".
function downloadPayslip(p) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Please allow pop-ups to download the payslip.");
  const row = (a, b, bold) => `<tr${bold ? ' class="b"' : ""}><td>${a}</td><td class="r">${b}</td></tr>`;
  const period = `${MONTHS[p.month - 1]} ${p.year}`;
  w.document.write(`<!doctype html><html><head><title>Payslip ${esc(period)}</title><style>
    body{font-family:Arial,sans-serif;color:#1b2236;max-width:640px;margin:32px auto;padding:0 16px}
    h1{margin:0;font-size:24px}h2{font-size:14px;margin:24px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:14px}td{padding:6px 0}.r{text-align:right}.b td{font-weight:bold;border-top:1px solid #ccc}
    .net{font-size:18px;background:#eef1ff}.muted{color:#667}
  </style></head><body>
    <h1>Orbit People</h1><p class="muted">Payslip for ${esc(period)}</p>
    <p><b>${esc(p.employee?.name)}</b><br>${esc(p.employee?.designation || "")} ${esc(p.employee?.department || "")}<br>${esc(p.employee?.email || "")}</p>
    <h2>Earnings</h2><table>
      ${row("Basic salary", money(p.basicSalary))}${row("House rent allowance (40%)", money(p.hra))}${row("Medical allowance (10%)", money(p.medical))}
      ${row("Gross salary", money(p.grossSalary), true)}${row(`Earned gross (${p.payableDays} of ${p.workingDays} working days)`, money(earnedGross(p)))}
      ${p.bonus ? row("Bonus", money(p.bonus)) : ""}</table>
    <h2>Attendance</h2><table>
      ${row("Absent days", p.absentDays)}${row("Unpaid leave days", p.unpaidDays)}${row("Half days", p.halfDays)}</table>
    <h2>Deductions</h2><table>
      ${row("Absent, unpaid and half days", money(p.attendanceDeduction))}${row("Income tax (monthly)", money(p.tax))}
      ${p.otherDeductions ? row("Other deductions", money(p.otherDeductions)) : ""}${row("Total deductions", money(p.deductions), true)}</table>
    <table><tr class="b net"><td>Net salary</td><td class="r">${money(p.netSalary)}</td></tr></table>
    <p class="muted">Status: ${esc(p.status)}</p>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function Line({ label, value, bold }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${bold ? "border-t border-slate-200 font-semibold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PayslipModal({ p, onClose, onDownload }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-slate-500"><X size={18} /></button>
        <h2 className="font-display text-xl font-semibold">{p.employee?.name}</h2>
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-500">{MONTHS[p.month - 1]} {p.year} <Badge value={p.status} /></p>
        <Line label="Basic salary" value={money(p.basicSalary)} />
        <Line label="House rent (40%)" value={money(p.hra)} />
        <Line label="Medical (10%)" value={money(p.medical)} />
        <Line label="Gross salary" value={money(p.grossSalary)} bold />
        <Line label={`Earned (${p.payableDays} of ${p.workingDays} days)`} value={money(earnedGross(p))} />
        <Line label="Absent / unpaid / half days" value={`${p.absentDays} / ${p.unpaidDays} / ${p.halfDays}`} />
        <Line label="Attendance deduction" value={`- ${money(p.attendanceDeduction)}`} />
        <Line label="Income tax" value={`- ${money(p.tax)}`} />
        {p.otherDeductions > 0 && <Line label="Other deductions" value={`- ${money(p.otherDeductions)}`} />}
        {p.bonus > 0 && <Line label="Bonus" value={`+ ${money(p.bonus)}`} />}
        <Line label="Net salary" value={money(p.netSalary)} bold />
        <Button className="mt-4 w-full" onClick={() => onDownload(p)}><Download size={16} /> Download PDF</Button>
      </div>
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const staff = user.role !== "employee";
  const isAdmin = user.role === "admin";
  const now = new Date();
  const { data, loading, error, reload } = useFetch(getPayroll);
  const emps = useFetch(() => (staff ? getEmployees() : Promise.resolve(null)));
  const [form, setForm] = useState({ employeeId: "", month: now.getMonth() + 1, year: now.getFullYear(), bonus: 0, otherDeductions: 0 });
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const act = async (fn, okText) => {
    setBusy(true);
    setMsg({});
    try {
      const r = await fn();
      setMsg({ ok: okText || r?.message });
      reload();
    } catch (e) {
      setMsg({ err: e.message });
    } finally {
      setBusy(false);
    }
  };

  const download = (p) => {
    try { downloadPayslip(p); } catch (e) { setMsg({ err: e.message }); }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Payroll</h1>
      <Alert>{msg.err}</Alert>
      <Alert type="ok">{msg.ok}</Alert>

      {staff && (
        <Card title="Create payroll draft">
          <form onSubmit={(e) => { e.preventDefault(); act(() => generatePayroll(form)); }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <Field label="Employee">
                  <Select required value={form.employeeId} onChange={set("employeeId")}>
                    <option value="">Select employee</option>
                    {emps.data?.employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Month">
                <Select value={form.month} onChange={set("month")}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
              </Field>
              <Field label="Year"><Input type="number" min="2020" value={form.year} onChange={set("year")} /></Field>
              <Field label="Bonus"><Input type="number" min="0" value={form.bonus} onChange={set("bonus")} /></Field>
              <Field label="Other deductions"><Input type="number" min="0" value={form.otherDeductions} onChange={set("otherDeductions")} /></Field>
            </div>
            <p className="text-xs text-slate-500">
              Gross is 1.5 x basic. Absent, unpaid and half days are deducted, and tax is calculated automatically. Submitting again updates the draft until the admin finalizes it.
            </p>
            <Button type="submit" disabled={busy}><FilePlus size={16} /> Save draft</Button>
          </form>
        </Card>
      )}

      <Card title={staff ? "Payroll records" : "My payslips"}>
        <Status loading={loading} error={error} />
        {data && (
          <Table
            head={[...(staff ? ["Employee"] : []), "Period", "Gross", "Deductions", "Bonus", "Net", "Status", ""]}
            rows={data.payrolls.map((p) => [
              ...(staff ? [p.employee?.name || "-"] : []),
              `${MONTHS[p.month - 1]} ${p.year}`,
              money(p.grossSalary),
              money(p.deductions),
              money(p.bonus),
              <b>{money(p.netSalary)}</b>,
              <Badge value={p.status} />,
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setView(p)} aria-label="View"><Eye size={14} /></Button>
                <Button variant="ghost" onClick={() => download(p)} aria-label="Download"><Download size={14} /></Button>
                {isAdmin && p.status !== "finalized" && p.status !== "paid" && (
                  <Button disabled={busy} onClick={() => act(() => finalizePayroll(p._id))}><Lock size={14} /> Finalize</Button>
                )}
                {staff && p.status === "finalized" && (
                  <Button variant="ghost" disabled={busy} onClick={() => act(() => markPayrollPaid(p._id))}><BadgeCheck size={14} /> Mark paid</Button>
                )}
              </div>,
            ])}
            empty={staff ? "No payroll yet. Create a draft above." : "No payslips yet. They appear after the admin finalizes your payroll."}
          />
        )}
      </Card>

      {view && <PayslipModal p={view} onClose={() => setView(null)} onDownload={download} />}
    </>
  );
}