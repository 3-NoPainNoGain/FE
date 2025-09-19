import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { exchangeCodeForToken } from "../services/auth"; // 기존 함수
import { useAuth } from "../auth/AuthContext";

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export default function OAuthCallback() {
  const { provider } = useParams();        // "google" | "kakao"
  const q = useQuery();
  const code = q.get("code");
  const state = q.get("state");
  const savedState = sessionStorage.getItem("oauth:state");

  const nav = useNavigate();
  const { loginWithResults } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!code) throw new Error("Authorization code is missing.");
        if (!state || state !== savedState) throw new Error("Invalid state.");
        sessionStorage.removeItem("oauth:state");

        const results = await exchangeCodeForToken(provider.toUpperCase(), code);
        // { name, role, accessToken }
        loginWithResults(results);

        // 이름이 없으면 이름등록 모달 유도 신호 남김
        if (results.name == null) {
          sessionStorage.setItem("needName", "1");
        }
        nav("/", { replace: true });
      } catch (e) {
        console.error(e);
        setError(e.message || "소셜 로그인에 실패했습니다.");
      }
    })();
  }, [code, state, savedState, provider, nav, loginWithResults]);

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <h2>로그인 실패</h2>
        <p>{error}</p>
        <button onClick={() => nav("/")} >돌아가기</button>
      </div>
    );
  }

  return <div style={{ padding: 32 }}>소셜 로그인 처리 중입니다…</div>;
}
