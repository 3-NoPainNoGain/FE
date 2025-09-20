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

  /**
   * BASIC 로그인
   */
  const loginBasic = useCallback(
    async ({ email, password }) => {
      const json = { email, password };
      const form = new URLSearchParams({ email, password });

      const candidates = [
        // 1) /login/BASIC + JSON
        {
          url: "/api/v2/auth/login/BASIC",
          data: json,
          config: { headers: { "Content-Type": "application/json" } },
        },
        // 2) /login/BASIC + x-www-form-urlencoded
        {
          url: "/api/v2/auth/login/BASIC",
          data: form,
          config: { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        },
        // 3) /login?loginType=BASIC + JSON
        {
          url: "/api/v2/auth/login",
          data: json,
          config: {
            params: { loginType: "BASIC" },
            headers: { "Content-Type": "application/json" },
          },
        },
        // 4) /login?loginType=BASIC + form
        {
          url: "/api/v2/auth/login",
          data: form,
          config: {
            params: { loginType: "BASIC" },
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        },
        // 5) /login + JSON (loginType 포함)
        {
          url: "/api/v2/auth/login",
          data: { loginType: "BASIC", email, password },
          config: { headers: { "Content-Type": "application/json" } },
        },
      ];

      let lastErr;
      for (const c of candidates) {
        try {
          const res = await api.post(c.url, c.data, {
            withCredentials: true,
            ...(c.config || {}),
          });

          const body = res?.data;
          if (body?.isSuccess && body?.code === "REQUEST_OK" && body?.results?.accessToken) {
            const { accessToken, name, role } = body.results;

            localStorage.setItem("accessToken", accessToken);
            setToken(accessToken);

            const nextUser = { name: name ?? null, role: role ?? "ROLE_PATIENT" };
            setUser(nextUser);
            localStorage.setItem("user", JSON.stringify(nextUser));

            return body.results;
          }

          throw new Error(body?.message || "로그인 실패");
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

  /**
   * 회원가입
   */
const signup = useCallback(async ({ email, password }) => {
  const bodyCandidates = [
    { email, password },                                     // {email,password}
    { userEmail: email, userPassword: password },            // {userEmail,userPassword}
    { username: email, password },                           // {username,password}
    { email, password, role: "ROLE_PATIENT" },               // role 포함
    { userEmail: email, userPassword: password, role: "ROLE_PATIENT" },
  ];

  const makePayloads = (b) => ([
    { data: b, headers: { "Content-Type": "application/json" } },
    { data: new URLSearchParams(Object.entries(b)), headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  ]);

  let lastErr;

  for (const b of bodyCandidates) {
    for (const p of makePayloads(b)) {
      try {
        const res = await api.post("/api/v2/auth/signup", p.data, {
          withCredentials: true,
          headers: p.headers,
        });

        const body = res?.data;
        if (body?.isSuccess || res.status === 200 || res.status === 201) {
          return true;
        }
        throw new Error(body?.message || "회원가입 실패");
      } catch (e) {
        lastErr = e;
      }
    }
  }

  const msg =
    lastErr?.response?.data?.message ||
    lastErr?.message ||
    "회원가입 요청이 거부되었습니다. (바디 형식 불일치 가능)";
  throw new Error(msg);
}, []);


  /** 소셜 콜백 결과로 로그인(카카오/구글 공통) */
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
