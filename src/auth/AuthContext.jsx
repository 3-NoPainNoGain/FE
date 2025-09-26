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
    // 사파리 프라이빗 모드 등에서 스토리지 불가 시 조용히 무시
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
    // 직렬화/스토리지 실패는 무시
    return;
  }
}
// -----------------------------------------------------------------------------

const AuthCtx = createContext(null);
export function useAuth() {
  return useContext(AuthCtx);
}

// ---- 응답 파서: 다양한 포맷에서 토큰/프로필 추출 -----------------------------
function extractTokenAndProfile(body) {
  // 흔한 래핑: { isSuccess, code, results: {...} }
  const top = body?.results ?? body ?? {};
  const token =
    top?.accessToken ??
    body?.accessToken ??
    body?.data?.accessToken ??
    null;

  const name =
    top?.name ?? top?.userName ?? top?.username ?? null;

  const role =
    top?.role ??
    (Array.isArray(top?.roles) ? top.roles[0] : undefined) ??
    null;

  const ok =
    !!token ||
    body?.isSuccess === true ||
    String(body?.code || "").includes("OK");

  return { ok, token, name, role };
}
// -----------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const nav = useNavigate();

  const [token, setToken] = useState(() => loadToken());
  const [user, setUser] = useState(() => loadUser());
  const isLoggedIn = !!token;

  // ---------------------------------------------------------------------------
  // (선택) 로그인 후 사용자 정보 조회
  // 현재 서버에는 GET /api/v2/user/name 이 405(조회 비지원)로 보였으므로 기본 비활성.
  // 필요 시 true로 바꾸고 fetch 후보를 채우세요.
  // ---------------------------------------------------------------------------
  const ENABLE_ME = false;

  useEffect(() => {
    if (!isLoggedIn || !ENABLE_ME) return;
    let alive = true;

    async function fetchUserLightweight() {
      const candidates = [
        { method: "get", url: "/api/v2/auth/me" },
        { method: "get", url: "/api/v2/user/me" },
        { method: "get", url: "/api/v2/users/me" },
        // { method: "get", url: "/api/v2/user/name" }, // 조회 미지원(405) 가능성이 큼
      ];
      for (const c of candidates) {
        try {
          const res =
            c.method === "get" ? await api.get(c.url) : await api.post(c.url);
          const { name, role } = extractTokenAndProfile(res?.data);

          if (!alive) return;
          const merged = {
            ...(user || {}),
            ...(name != null ? { name } : {}),
            ...(role ? { role } : {}),
          };
          if (Object.keys(merged).length > 0) {
            setUser(merged);
            saveUser(merged);
            return;
          }
        } catch (e) {
          const status = e?.response?.status;
          if ([401, 403].includes(status)) break; // 토큰 문제면 중단
          // 404/405 등은 다음 후보 시도
        }
      }
    }

    fetchUserLightweight();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // ---------------------------------------------------------------------------
  // BASIC 로그인 (확정 스펙)
  // POST /api/v2/auth/login  Body: { email, password } (JSON)
  // ---------------------------------------------------------------------------
  const loginBasic = useCallback(async ({ email, password }) => {
    try {
      const res = await api.post(
        "/api/v2/auth/login",
        { email, password },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const parsed = extractTokenAndProfile(res?.data);
      if (!parsed.ok || !parsed.token) {
        // 서버가 성공/실패 메시지 포맷을 다르게 줄 수 있어 보완 메시지 생성
        const msg =
          res?.data?.message ||
          res?.data?.results?.message ||
          "로그인 실패";
        throw new Error(msg);
      }

      // 토큰/사용자 저장
      saveToken(parsed.token);
      setToken(parsed.token);

      const nextUser = {
        name: parsed.name ?? null,
        role: parsed.role ?? "ROLE_PATIENT",
      };
      setUser(nextUser);
      saveUser(nextUser);

      return { accessToken: parsed.token, ...nextUser };
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "로그인 요청이 거부되었습니다.";
      throw new Error(msg);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 회원가입
  // ---------------------------------------------------------------------------
  const signup = useCallback(async ({ email, password }) => {
    // 바디 키가 불명확할 때 호환 시도(팀 상황 따라 하나만 남겨도 됨)
    const bodyCandidates = [
      { email, password },
      { userEmail: email, userPassword: password },
      { username: email, password },
      { email, password, role: "ROLE_PATIENT" },
      { userEmail: email, userPassword: password, role: "ROLE_PATIENT" },
    ];

    let lastErr;
    for (const b of bodyCandidates) {
      try {
        const res = await api.post("/api/v2/auth/signup", b, {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        });
        const ok =
          res?.data?.isSuccess ||
          String(res?.data?.code || "").includes("OK") ||
          [200, 201].includes(res?.status);
        if (ok) return true;
        throw new Error(res?.data?.message || "회원가입 실패");
      } catch (e) {
        lastErr = e;
      }
    }

    const msg =
      lastErr?.response?.data?.message ||
      lastErr?.message ||
      "회원가입 요청이 거부되었습니다.";
    throw new Error(msg);
  }, []);

  // ---------------------------------------------------------------------------
  // 소셜 콜백 결과 기반 로그인 (카카오/구글 공통)
  // ---------------------------------------------------------------------------
  const loginWithResults = useCallback((results) => {
    if (!results?.accessToken) throw new Error("엑세스 토큰 없음");

    saveToken(results.accessToken);
    setToken(results.accessToken);

    const nextUser = {
      name: results.name ?? null,
      role: results.role ?? "ROLE_PATIENT",
    };
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
        const ok =
          res?.data?.isSuccess ||
          String(res?.data?.code || "").includes("OK") ||
          res?.status === 200;
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
