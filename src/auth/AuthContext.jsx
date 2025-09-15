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
        // 필요 시 내 정보 검증 API 연결
        // const { data } = await api.get("/api/v2/auth/me");
        // setUser(data.results || user);
      } catch {
        logout();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async ({ email, password }) => {
    // (선택) 개발용 더미 로그인 - 필요 없으면 삭제
    if (process.env.NODE_ENV === "development" && email === "dev@handdoc.test" && password === "Passw0rd!") {
      const fakeUser = { name: "개발자", role: "ROLE_DOCTOR" };
      localStorage.setItem("accessToken", "dev-token");
      localStorage.setItem("user", JSON.stringify(fakeUser));
      setAccessToken("dev-token");
      setUser(fakeUser);
      return;
    }

    const { data } = await api.post("/api/v2/auth/login", { email, password });

    if (!data?.isSuccess) {
      const reason = data?.message || "로그인에 실패했습니다.";
      const err = new Error(reason);
      err.response = { status: 400, data };
      throw err;
    }

    const { name, role, accessToken: at } = data.results || {};
    if (!at) {
      const err = new Error("토큰이 응답에 없습니다.");
      err.response = { status: 500, data };
      throw err;
    }

    localStorage.setItem("accessToken", at);
    localStorage.setItem("user", JSON.stringify({ name, role }));
    setAccessToken(at);
    setUser({ name, role });
  };

  const signup = async ({ email, password }) => {
    // ✅ 스펙: POST /api/v2/auth/signup  (results는 비어있을 수 있음)
    const res = await api.post("/api/v2/auth/signup", { email, password });
    const ok = res?.data?.isSuccess ?? (res?.status >= 200 && res?.status < 300);
    if (!ok) {
      const err = new Error(res?.data?.message || "회원가입에 실패했습니다.");
      err.response = { status: res?.status || 400, data: res?.data };
      throw err;
    }
    // 가입 성공 → 자동 로그인
    await login({ email, password });
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setAccessToken("");
    setUser(null);
  };

  const value = useMemo(() => ({ isLoggedIn, user, login, signup, logout }), [isLoggedIn, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
