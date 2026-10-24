import { useState } from "react";
import { Check, X, Send, Ban, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Badge, Button, Card, Field, Input, Select, Status, Table, fmtDate, todayStr, useFetch } from "../components/ui.jsx";
import { cancelLeave, getLeaveBalance, getLeaves, requestLeave, reviewLeave, smartLeave } from "../services/api.js";

const TYPES = ["casual", "sick", "annual", "unpaid"];
const emptyForm = { type: "casual", startDate: "", endDate: "", reason: "" };

export default function Leaves() {
  const { user } = useAuth();
  const staff = user.role !== "employee";
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useFetch(() => getLeaves(staff ? { status } : {}), [status]);
  const bal = useFetch(() => (staff ? Promise.resolve(null) : getLeaveBalance()));
  const [form, setForm] = useState(emptyForm);
  const [comments, setComments] = useState({});
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const act = async (fn, okText) => {
    setBusy(true);
    setMsg({});
    try {
      await fn();
      setMsg({ ok: okText });
      reload();
      bal.reload();
    } catch (e) {
      setMsg({ err: e.message });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    act(async () => {
      await requestLeave(form);
      setForm(emptyForm);
      setAiNote("");
    }, "Leave request submitted.");
  };

  // Smart leave: AI only fills the form. The employee checks it and sends it.
  const fillWithAi = async (e) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiBusy(true);
    setMsg({});
    setAiNote("");
    try {
      const { suggestion } = await smartLeave(aiText);
      setForm({
        type: suggestion.type,
        startDate: suggestion.start,
        endDate: suggestion.end,
        reason: suggestion.reason,
      });
      setAiNote("AI-generated. Please check the form below, then press Send request.");
    } catch (err) {
      setMsg({ err: err.message });
    } finally {
      setAiBusy(false);
    }
  };

  const review = (l, s) =>
    act(() => reviewLeave(l._id, s, comments[l._id] || ""), s === "approved" ? "Leave approved." : "Leave rejected.");

  const canCancel = (l) =>
    ["pending", "approved"].includes(l.status) && l.endDate.slice(0, 10) >= todayStr();

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Leaves</h1>
      <Alert>{msg.err}</Alert>
      <Alert type="ok">{msg.ok}</Alert>

      {!staff && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TYPES.map((t) => {
              const b = bal.data?.balance?.[t];
              return (
                <div key={t} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-sm capitalize text-slate-500">{t} leave</p>
                  <p className="font-display text-2xl font-bold">
                    {b ? (b.quota === null ? b.used : b.remaining) : "-"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {b ? (b.quota === null ? "days taken, no limit" : `left of ${b.quota} this year`) : ""}
                  </p>
                </div>
              );
            })}
          </div>

          <Card title="Smart leave">
            <form onSubmit={fillWithAi} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                maxLength={500}
                placeholder="e.g. I need next Monday and Tuesday off for my sister's wedding"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={aiBusy || !aiText.trim()}>
                <Sparkles size={16} /> {aiBusy ? "Thinking..." : "Fill the form"}
              </Button>
            </form>
          </Card>

          <Card title="Request leave">
            <form onSubmit={submit} className="space-y-4">
              <Alert type="ok">{aiNote}</Alert>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Type">
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="From">
                  <Input required type="date" min={todayStr()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </Field>
                <Field label="To">
                  <Input required type="date" min={form.startDate || todayStr()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </Field>
              </div>
              <Field label="Reason">
                <Input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </Field>
              <p className="text-xs text-slate-500">Saturdays and Sundays are not counted.</p>
              <Button type="submit" disabled={busy}><Send size={16} /> Send request</Button>
            </form>
          </Card>
        </>
      )}

      <Card
        title={staff ? "Leave requests" : "My requests"}
        action={staff && (
          <div className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        )}
      >
        <Status loading={loading} error={error} />
        {data && (
          <Table
            head={staff
              ? ["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Decision"]
              : ["Type", "From", "To", "Days", "Reason", "Status", "Note"]}
            rows={data.leaves.map((l) => {
              const common = [
                <span className="capitalize">{l.type || "casual"}</span>,
                fmtDate(l.startDate),
                fmtDate(l.endDate),
                l.days ?? 1,
                l.reason,
                <Badge value={l.status} />,
              ];
              if (staff) {
                return [
                  l.employee?.name || "-",
                  ...common,
                  l.status === "pending" ? (
                    <div className="flex min-w-48 items-center gap-2">
                      <Input
                        placeholder="Comment (optional)"
                        value={comments[l._id] || ""}
                        onChange={(e) => setComments({ ...comments, [l._id]: e.target.value })}
                      />
                      <Button disabled={busy} onClick={() => review(l, "approved")} aria-label="Approve"><Check size={14} /></Button>
                      <Button variant="danger" disabled={busy} onClick={() => review(l, "rejected")} aria-label="Reject"><X size={14} /></Button>
                    </div>
                  ) : (
                    l.reviewComment || ""
                  ),
                ];
              }
              return [
                ...common,
                canCancel(l) ? (
                  <Button variant="ghost" disabled={busy} onClick={() => act(() => cancelLeave(l._id), "Leave cancelled.")}>
                    <Ban size={14} /> Cancel
                  </Button>
                ) : (
                  l.reviewComment || ""
                ),
              ];
            })}
            empty="No leave requests found."
          />
        )}
      </Card>
    </>
  );
}