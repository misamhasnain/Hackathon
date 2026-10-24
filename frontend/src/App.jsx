import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import Layout, { NAV } from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Employees from "./pages/Employees.jsx";
import Attendance from "./pages/Attendance.jsx";
import Leaves from "./pages/Leaves.jsx";
import Payroll from "./pages/Payroll.jsx";
import Chat from "./pages/Chat.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";

const PAGES = { dashboard: Dashboard, employees: Employees, attendance: Attendance, leaves: Leaves, payroll: Payroll, chat: Chat, password: ChangePassword };

export default function App() {
  const { user, ready } = useAuth();
  const [page, setPage] = useState("dashboard");

  if (!ready) return <p className="p-10 text-center text-slate-500">Loading...</p>;
  if (!user) return <Login />;

  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  const current = allowed.some((n) => n.id === page) ? page : "dashboard";
  const Page = PAGES[current];

  return (
    <Layout page={current} setPage={setPage} items={allowed}>
      <Page go={setPage} />
    </Layout>
  );
}