import { useState } from "react";
import { startOAuth } from "../utils/oauthStart";
import { useAuth } from "../auth/AuthContext";
import "./login-modal.css";

export default function LoginModal({ onClose, onOpenSignup }) {
  const { loginBasic } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await loginBasic({ email, password: pw }); // 응답 검증에서 실패하면 throw
      onClose?.();
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) setErr("인증 실패(401): 이메일 또는 비밀번호를 확인해주세요.");
      else if (status === 404) setErr("계정을 찾을 수 없습니다. 회원가입 후 다시 로그인 해주세요.");
      else setErr(error?.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-card">
        <div className="login-card__header">
          <span className="login-logo">Handoc</span>
          <button className="login-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-label">
            <span className="login-label__text">이메일</span>
            <input className="login-input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          </label>

          <label className="login-label">
            <span className="login-label__text">비밀번호</span>
            <input className="login-input" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} required />
          </label>

          {err && <p className="login-error">{err}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </button>

          <div className="login-divider"><span>간편 로그인</span></div>
          <div className="login-socials">
            <button type="button" className="social-btn" onClick={()=>startOAuth("kakao")}>Kakao</button>
            <button type="button" className="social-btn" onClick={()=>startOAuth("google")}>Google</button>
          </div>

          <div className="login-links">
            <button type="button" className="link-btn">아이디 찾기</button>
            <span className="sep">|</span>
            <button type="button" className="link-btn">비밀번호 찾기</button>
            <span className="sep">|</span>
            <button type="button" className="link-btn" onClick={() => onOpenSignup?.()}>
              회원가입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
