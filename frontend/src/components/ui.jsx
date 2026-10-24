import { useCallback, useEffect, useState } from "react";

export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await fn()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, deps); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-");
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
export const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
// Today's date in Pakistan time (matches the backend)
export const todayStr = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const Card = ({ title, action, children }) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
    {(title || action) && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

const btn = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  ghost: "bg-slate-100 text-ink hover:bg-slate-200",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
export const Button = ({ variant = "primary", className = "", ...p }) => (
  <button
    {...p}
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${btn[variant]} ${className}`}
  />
);

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export const Field = ({ label, children }) => (
  <label className="block text-sm font-medium">
    <span className="mb-1 block text-slate-600">{label}</span>
    {children}
  </label>
);
export const Input = (p) => <input {...p} className={input} />;
export const Select = (p) => <select {...p} className={input} />;

export const Alert = ({ type = "error", children }) =>
  children ? (
    <p role="alert" className={`rounded-lg px-3 py-2 text-sm ${type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
      {children}
    </p>
  ) : null;

const tone = {
  present: "emerald",
  paid: "emerald",
  approved: "emerald",
  late: "amber",
  half_day: "amber",
  pending: "amber",
    generated: "sky",
  draft: "amber",
  finalized: "sky",
  cancelled: "rose",
  absent: "rose",
  missing_checkout: "rose",
  rejected: "rose",
};
const toneCls = {
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-800",
  rose: "bg-rose-100 text-rose-800",
};
export const Badge = ({ value }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${toneCls[tone[value] || "sky"]}`}>
    {String(value).replaceAll("_", " ")}
  </span>
);

export const Table = ({ head, rows, empty = "Nothing here yet." }) =>
  rows.length === 0 ? (
    <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-3">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );

export const Status = ({ loading, error }) =>
  loading ? <p className="py-6 text-center text-sm text-slate-500">Loading...</p> : <Alert>{error}</Alert>;