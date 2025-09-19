import { makeAuthUrl } from "../utils/oauth";

export default function SocialLoginButtons() {
  const go = (provider) => {
    const url = makeAuthUrl(provider);
    window.location.assign(url); // OAuth 페이지로 이동
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="btn-social google" onClick={() => go("google")}>
        Sign in with Google
      </button>
      <button className="btn-social kakao" onClick={() => go("kakao")}>
        카카오로 시작하기
      </button>
    </div>
  );
}
