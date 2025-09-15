// 코드 제목: AuthContext.jsx (refreshToken 상태 제거 버전)

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("accessToken") || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });

  const isLoggedIn = !!accessToken;

  useEffect(() => {
    const init = async () => {
      if (!accessToken) return;
      try {
        // 필요 시 내 정보 확인
        // const { data } = await api.get("/auth/me");
        // setUser(data);
      } catch {
        logout();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async ({ email, password }) => {
    const { data } = await api.post("/auth/login", { email, password });
    const { accessToken: at, refreshToken: rt, user: u } = data;

    localStorage.setItem("accessToken", at);
    if (rt) localStorage.setItem("refreshToken", rt);
    localStorage.setItem("user", JSON.stringify(u || null));

    setAccessToken(at);
    setUser(u || null);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setAccessToken("");
    setUser(null);
  };

  const value = useMemo(() => ({
    isLoggedIn, user, login, logout,
  }), [isLoggedIn, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
