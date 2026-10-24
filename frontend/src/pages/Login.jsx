import { useState } from "react";
import { Mail, Lock, LogIn, Orbit } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Button, Field, Input } from "../components/ui.jsx";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter both email and password.");
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot reach the server. Is the backend running on port 3000?" : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <span className="flex items-center gap-2 font-display text-2xl font-bold"><Orbit className="text-accent" /> Orbit People</span>
        <p className="max-w-md font-display text-4xl font-bold leading-tight">Attendance, leave and payroll in one place.</p>
        <span className="text-sm text-slate-400">HCM Lite</span>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h1 className="font-display text-3xl font-bold">Sign in</h1>
          <Alert>{error}</Alert>
          <Field label="Email">
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" />
            </div>
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            <LogIn size={16} /> {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
