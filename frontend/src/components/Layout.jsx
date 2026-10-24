import { useState } from "react";
import { LayoutDashboard, Users, Clock, CalendarOff, Wallet, LogOut, Menu, X, Orbit, Bot, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const ALL = ["admin", "hr", "employee"];
export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { id: "employees", label: "Employees", icon: Users, roles: ["admin", "hr"] },
  { id: "attendance", label: "Attendance", icon: Clock, roles: ALL },
  { id: "leaves", label: "Leaves", icon: CalendarOff, roles: ALL },
  { id: "payroll", label: "Payroll", icon: Wallet, roles: ALL },
    { id: "password", label: "Change password", icon: KeyRound, roles: ALL },
      { id: "password", label: "Change password", icon: KeyRound, roles: ALL },
];

export default function Layout({ page, setPage, items, children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink p-4 text-white">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent shadow-lg shadow-accent/40">
          <Orbit size={22} />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-lg font-bold">Orbit People</span>
          <span className="block text-xs text-slate-400">HCM Lite</span>
        </span>
      </div>

      <nav className="flex-1 space-y-1">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setPage(id); setOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              page === id
                ? "bg-white text-ink shadow-md"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} className={page === id ? "text-accent" : ""} /> {label}
          </button>
        ))}
      </nav>

      <div className="rounded-2xl bg-white/5 p-3">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent font-display font-bold">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block text-xs capitalize text-slate-400">{user.role}</span>
          </span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/20"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">{sidebar}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3 text-white md:hidden">
        <span className="flex items-center gap-2 font-display font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent"><Orbit size={18} /></span>
          Orbit People
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">
            {sidebar}
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 text-white">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">{children}</div>
      </main>
    </div>
  );
}