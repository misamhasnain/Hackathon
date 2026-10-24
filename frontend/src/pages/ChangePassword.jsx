import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "../components/ui.jsx";
import { changePassword } from "../services/api.js";

export default function ChangePassword() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg({});

    if (form.next.length < 8) {
      return setMsg({ err: "New password must be at least 8 characters." });
    }
    if (form.next !== form.confirm) {
      return setMsg({ err: "New password and confirm password do not match." });
    }

    setBusy(true);
    try {
      const r = await changePassword(form.current, form.next);
      setMsg({ ok: r.message });
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setMsg({ err: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Change password</h1>
      <Alert>{msg.err}</Alert>
      <Alert type="ok">{msg.ok}</Alert>

      <Card title="Update your password">
        <form onSubmit={submit} className="max-w-md space-y-4">
          <Field label="Current password">
            <Input type="password" required value={form.current} onChange={set("current")} />
          </Field>
          <Field label="New password">
            <Input type="password" required minLength={8} value={form.next} onChange={set("next")} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" required minLength={8} value={form.confirm} onChange={set("confirm")} />
          </Field>
          <Button type="submit" disabled={busy}>
            <KeyRound size={16} /> {busy ? "Saving..." : "Change password"}
          </Button>
        </form>
      </Card>
    </>
  );
}