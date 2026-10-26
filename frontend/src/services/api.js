const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export const TOKEN_KEY = "hcm_token";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Token expired or invalid: tell the app to log out safely.
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("hcm-unauthorized"));
    }
    throw new Error(data.message || data.error || "Something went wrong.");
  }
  return data;
}

const post = (url, body) => apiRequest(url, { method: "POST", body: JSON.stringify(body) });
const qs = (obj) => {
  const p = new URLSearchParams(Object.entries(obj).filter(([, v]) => v));
  return p.toString() ? `?${p}` : "";
};

export const loginUser = (email, password) => post("/auth/login", { email, password });
export const getCurrentUser = () => apiRequest("/auth/me");

export const getEmployees = () => apiRequest("/employees");
export const createEmployee = (body) => post("/employees", body);

export const getAttendance = (filters = {}) => apiRequest(`/attendance${qs(filters)}`);
export const checkIn = (employeeId) => post("/attendance/check-in", { employeeId });
export const checkOut = (employeeId) => post("/attendance/check-out", { employeeId });

export const getLeaves = (filters = {}) => apiRequest(`/leaves${qs(filters)}`);
export const requestLeave = (body) => post("/leaves", body);
export const reviewLeave = (id, status, comment = "") =>
  apiRequest(`/leaves/${id}/review`, { method: "PATCH", body: JSON.stringify({ status, comment }) });
export const cancelLeave = (id) => apiRequest(`/leaves/${id}/cancel`, { method: "PATCH" });
export const getLeaveBalance = () => apiRequest("/leaves/balance");

export const getPayroll = (filters = {}) => apiRequest(`/payroll${qs(filters)}`);
export const generatePayroll = (body) => post("/payroll/generate", body);
export const markPayrollPaid = (id) => apiRequest(`/payroll/${id}/pay`, { method: "PATCH" });
export const sendChat = (message) => post("/ai/chat", { message });
export const smartLeave = (text) => post("/ai/smart-leave", { text });
export const finalizePayroll = (id) => apiRequest(`/payroll/${id}/finalize`, { method: "PATCH" });
export const changePassword = (currentPassword, newPassword) =>
  apiRequest("/auth/change-password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });