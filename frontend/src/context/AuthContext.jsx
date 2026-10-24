import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, getCurrentUser, TOKEN_KEY } from "../services/api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  useEffect(() => {
    window.addEventListener("hcm-unauthorized", logout);
    return () => window.removeEventListener("hcm-unauthorized", logout);
  }, []);

  // Restore session on page refresh
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return setReady(true);
    getCurrentUser()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
