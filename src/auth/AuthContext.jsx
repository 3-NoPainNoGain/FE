// src/auth/AuthContext.jsx
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { api } from "./axios";
import { useNavigate } from "react-router-dom";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const nav = useNavigate();

  const [token, setToken] = useState(() => localStorage.getItem("accessToken") || "");
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const isLoggedIn = !!token;

  

const loginBasic = useCallback(
  async ({ email, password }) => {
    // 공통 바디
    const json = { email, password };
    const form = new URLSearchParams({ email, password });

    // 가장 가능성 높은 순으로 후보 나열
    const candidates = [
      // 1) /login/BASIC + JSON
      { url: "/api/v2/auth/login/BASIC", data: json, config: { headers: { "Content-Type": "application/json" } } },
      // 2) /login/BASIC + x-www-form-urlencoded
      { url: "/api/v2/auth/login/BASIC", data: form, config: { headers: { "Content-Type": "application/x-www-form-urlencoded" } } },

      // 3) /login?loginType=BASIC + JSON
      { url: "/api/v2/auth/login", data: json, config: { params: { loginType: "BASIC" }, headers: { "Content-Type": "application/json" } } },
      // 4) /login?loginType=BASIC + form
      { url: "/api/v2/auth/login", data: form, config: { params: { loginType: "BASIC" }, headers: { "Content-Type": "application/x-www-form-urlencoded" } } },

      // 5) /login + JSON (loginType 포함)
      { url: "/api/v2/auth/login", data: { loginType: "BASIC", email, password }, config: { headers: { "Content-Type": "application/json" } } },
    ];

    let lastErr;
    for (const c of candidates) {
      try {
        const res = await api.post(c.url, c.data, {
          withCredentials: true,
          ...(c.config || {}),
        });

        const body = res?.data;
        if (!body?.isSuccess || body?.code !== "REQUEST_OK" || !body?.results?.accessToken) {
          throw new Error(body?.message || "로그인 실패");
        }

        const { accessToken, name, role } = body.results;
        localStorage.setItem("accessToken", accessToken);
        setToken(accessToken);

        const nextUser = { name: name ?? null, role: role ?? "ROLE_PATIENT" };
        setUser(nextUser);
        localStorage.setItem("user", JSON.stringify(nextUser));
        return body.results; 
      } catch (e) {
        lastErr = e; 
      }
    }

   
    const msg =
      lastErr?.response?.data?.message ||
      lastErr?.message ||
      "로그인 요청이 거부되었습니다. (BASIC)";
    throw new Error(msg);
  },
  [setToken, setUser]
);

 
  const signup = useCallback(async ({ email, password }) => {
    const jsonBody = { email, password };
    const formBody = new URLSearchParams({ email, password });

    const candidates = [
      { url: "/api/v2/auth/signup",   data: jsonBody, headers: { "Content-Type": "application/json" } },
      { url: "/api/v2/auth/register", data: jsonBody, headers: { "Content-Type": "application/json" } },
      { url: "/api/v2/auth/join",     data: jsonBody, headers: { "Content-Type": "application/json" } },
      { url: "/api/v2/auth/sign-up",  data: jsonBody, headers: { "Content-Type": "application/json" } },
      { url: "/api/v2/auth/signup",   data: formBody, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      { url: "/api/v2/auth/register", data: formBody, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      { url: "/api/v2/auth/join",     data: formBody, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    ];

    let lastErr;
    for (const c of candidates) {
      try {
        const res = await api.post(c.url, c.data, { withCredentials: true, headers: c.headers });
        const body = res?.data;
        if (body?.isSuccess || res.status === 200 || res.status === 201) return true;
        throw new Error(body?.message || "회원가입 실패");
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    const msg =
      lastErr?.response?.data?.message ||
      lastErr?.message ||
      "회원가입 엔드포인트를 찾을 수 없습니다.";
    throw new Error(msg);
  }, []);

  const loginWithResults = useCallback((results) => {
    if (!results?.accessToken) throw new Error("엑세스 토큰 없음");
    localStorage.setItem("accessToken", results.accessToken);
    setToken(results.accessToken);

    const nextUser = { name: results.name ?? null, role: results.role ?? "ROLE_PATIENT" };
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }, []);

  const setUserName = useCallback(
    async (name) => {
      try {
        await api.post(
          "/api/v2/auth/name",
          null,
          { params: { name }, headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // 서버 저장 실패해도 프론트는 업데이트
      }
      const updated = { ...(user || {}), name };
      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));
    },
    [token, user]
  );

  /** 로그아웃 */
  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    nav("/", { replace: true });
  }, [nav]);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoggedIn,
      loginBasic,      
      signup,
      loginWithResults,
      setUserName,
      logout,
    }),
    [token, user, isLoggedIn, loginBasic, signup, loginWithResults, setUserName, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
