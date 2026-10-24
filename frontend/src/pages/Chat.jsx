import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Button, Card } from "../components/ui.jsx";
import { sendChat } from "../services/api.js";

const EXAMPLES = {
  staff: [
    "How many employees do we have?",
    "Who is on leave today?",
    "Who came late most often this month?",
    "What is this month's attendance rate?",
  ],
  employee: [
    "How many sick leaves do I have left this year?",
    "What time is the late cutoff?",
    "How is my payroll calculated?",
  ],
};

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (msg) => {
    msg = msg.trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { from: "me", text: msg }]);
    setText("");
    setError("");
    setBusy(true);
    try {
      const data = await sendChat(msg);
      setMessages((m) => [...m, { from: "ai", text: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    ask(text);
  };

  const examples = user.role === "employee" ? EXAMPLES.employee : EXAMPLES.staff;

  return (
    <>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">AI assistant</h1>
      <Card>
        <div className="flex h-[65vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <Sparkles className="mx-auto mb-2 text-accent" />
                <p className="mb-4 text-sm text-slate-500">
                  Ask about your data or company policy. English, Urdu and Roman Urdu work.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {examples.map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <p
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                      m.from === "me" ? "bg-accent text-white" : "bg-slate-100"
                    }`}
                  >
                    {m.text}
                  </p>
                  {m.from === "ai" && (
                    <p className="mt-1 px-2 text-xs text-slate-400">AI-generated</p>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-slate-500">Thinking...</p>}
            <div ref={endRef} />
          </div>
          <Alert>{error}</Alert>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your question"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={busy || !text.trim()}>
              <Send size={16} /> Send
            </Button>
          </form>
        </div>
      </Card>
    </>
  );
}