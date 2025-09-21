// [코드 제목] AuthContext (BASIC/소셜 로그인, 회원가입, 이름 저장, 선택적 me 조회, 로그아웃)
// 파일: src/auth/AuthContext.jsx

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api } from "./axios";
import { useNavigate } from "react-router-dom";

/**
 * NOTE
 * - 이 파일은 모든 API 경로에 /api 접두사를 포함합니다.
 * - axios 인스턴스(api)의 baseURL이 https://handdoc.store 라면 아래 경로 그대로 사용하세요.
 *   (만약 baseURL이 https://handdoc.store/api 라면 아래 경로에서 /api 를 제거하세요.)
 */

// ---- 로컬 스토리지 헬퍼 ------------------------------------------------------
const ACCESS_KEY = "accessToken";
const USER_KEY = "user";

function loadToken() {
  try {
    return localStorage.getItem(ACCESS_KEY) || "";
  } catch (e) {
    return "";
  }
}
function saveToken(t) {
  try {
    if (t) localStorage.setItem(ACCESS_KEY, t);
    else localStorage.removeItem(ACCESS_KEY);
  } catch (e) {
    return;
  }
}
function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function saveUser(u) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch (e) {
    return;
  }
}
// -----------------------------------------------------------------------------

const AuthCtx = createContext(null);
export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }) {
  const nav = useNavigate();

  const [token, setToken] = useState(() => loadToken());
  const [user, setUser] = useState(() => loadUser());
  const isLoggedIn = !!token;

  // ---------------------------------------------------------------------------
  // (선택) 로그인 후 me 조회
  // 백엔드에 /api/v2/auth/me가 없는 경우가 있어 404면 조용히 무시합니다.
  // 필요 없다면 ENABLE_ME를 false로 두세요.
  // ---------------------------------------------------------------------------
  const ENABLE_ME = true;

  useEffect(() => {
    if (!isLoggedIn || !ENABLE_ME) return;
    let alive = true;

    api
      .get("/api/v2/auth/me")
      .then((res) => {
        if (!alive) return;
        const me = res?.data?.results ?? res?.data ?? {};
        const merged = { ...(user || {}), ...me };
        setUser(merged);
        saveUser(merged);
      })
      .catch(() => {
        // 404/401 등은 무시(로그인 UX를 막지 않기 위함)
        return;
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // ---------------------------------------------------------------------------
  // BASIC 로그인
  // ---------------------------------------------------------------------------
  const loginBasic = useCallback(async ({ email, password }) => {
    const json = { email, password };
    const form = new URLSearchParams({ email, password });

    const candidates = [
      // 1) /login/BASIC + JSON
      {
        url: "/api/v2/auth/login/BASIC",
        data: json,
        config: { headers: { "Content-Type": "application/json" } },
      },
      // 2) /login/BASIC + form
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

          saveToken(accessToken);
          setToken(accessToken);

          const nextUser = { name: name ?? null, role: role ?? "ROLE_PATIENT" };
          setUser(nextUser);
          saveUser(nextUser);

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
  }, []);

  // ---------------------------------------------------------------------------
  // 회원가입
  // ---------------------------------------------------------------------------
  const signup = useCallback(async ({ email, password }) => {
    const bodyCandidates = [
      { email, password },
      { userEmail: email, userPassword: password },
      { username: email, password },
      { email, password, role: "ROLE_PATIENT" },
      { userEmail: email, userPassword: password, role: "ROLE_PATIENT" },
    ];

    const makePayloads = (b) => [
      { data: b, headers: { "Content-Type": "application/json" } },
      {
        data: new URLSearchParams(Object.entries(b)),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    ];

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

  // ---------------------------------------------------------------------------
  // 소셜 콜백 결과 기반 로그인 (카카오/구글 공통)
  // ---------------------------------------------------------------------------
  const loginWithResults = useCallback((results) => {
    if (!results?.accessToken) throw new Error("엑세스 토큰 없음");

    saveToken(results.accessToken);
    setToken(results.accessToken);

    const nextUser = { name: results.name ?? null, role: results.role ?? "ROLE_PATIENT" };
    setUser(nextUser);
    saveUser(nextUser);
  }, []);

  // ---------------------------------------------------------------------------
  // 이름 저장 (/api/v2/user/name) : 인터셉터가 토큰 자동 첨부
  // ---------------------------------------------------------------------------
  const setUserName = useCallback(
    async (name) => {
      const trimmed = String(name || "").trim();
      if (!trimmed) return;

      try {
        const res = await api.post("/api/v2/user/name", { name: trimmed });
        const ok = res?.data?.isSuccess || String(res?.data?.code || "").includes("OK");
        if (!ok) throw new Error(res?.data?.message || "이름 저장 실패");
      } catch (e) {
        // 서버 저장 실패 시 무시하고 프론트 상태만 업데이트
        return;
      }

      const updated = { ...(user || {}), name: trimmed };
      setUser(updated);
      saveUser(updated);
    },
    [user]
  );

  // ---------------------------------------------------------------------------
  // 로그아웃
  // ---------------------------------------------------------------------------
  const logout = useCallback(() => {
    saveToken("");
    saveUser(null);
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
