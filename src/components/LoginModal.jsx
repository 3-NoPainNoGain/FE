import { useState } from "react";
import { startOAuth } from "../utils/oauthStart";
import { useAuth } from "../auth/AuthContext";
import "./login-modal.css";

import handocLogo from "../assets/logo.png";

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
      await loginBasic({ email, password: pw });
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
      <div className="login-card login-card--v3">
        <button className="login-close" onClick={onClose} aria-label="닫기">×</button>

        <div className="brand brand--row">
          {handocLogo ? (
            <>
              <img className="brand__img" src={handocLogo} alt="Handoc" />
              <span className="brand__name">handDoc</span>
            </>
          ) : (
            <span className="brand__name">handDoc</span>
          )}
        </div>

        <form className="login-form login-form--grid" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="loginEmail">이메일</label>
          <div className="input-wrap grid-email">
            <span className="ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
              </svg>
            </span>
            <input
              id="loginEmail"
              className="login-input"
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
          </div>

          <label className="sr-only" htmlFor="loginPw">비밀번호</label>
          <div className="input-wrap grid-pw">
            <span className="ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z" fill="currentColor"/>
              </svg>
            </span>
            <input
              id="loginPw"
              className="login-input"
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e)=>setPw(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit grid-submit" disabled={loading}>
            {loading ? "…" : "로그인"}
          </button>

          {err && <p className="login-error grid-error">{err}</p>}
        </form>

        <div className="login-links">
          <button type="button" className="link-btn">아이디 찾기</button>
          <span className="sep">|</span>
          <button type="button" className="link-btn">비밀번호 찾기</button>
          <span className="sep">|</span>
          <button type="button" className="link-btn" onClick={() => onOpenSignup?.()}>회원가입</button>
        </div>

        <div className="login-divider"><span>간편 로그인</span></div>

        <div className="social-icons">
          <button type="button" className="social-circle kakao" onClick={()=>startOAuth("kakao")} aria-label="카카오로 시작하기">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M12 3C6.48 3 2 6.39 2 10.5c0 2.37 1.61 4.46 4.03 5.72L5 21l4.05-2.4c.94.17 1.94.26 2.95.26 5.52 0 10-3.39 10-7.5S17.52 3 12 3z" fill="currentColor"/>
            </svg>
          </button>
          <button type="button" className="social-circle google" onClick={()=>startOAuth("google")} aria-label="Google로 로그인">
            <svg viewBox="0 0 48 48" width="22" height="22">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.23 3.6l6.9-6.9C36.9 2.3 30.9 0 24 0 14.62 0 6.44 5.38 2.54 13.2l8.06 6.26C12.35 13.3 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.12-.44-4.5H24v9h12.7c-.55 2.96-2.24 5.46-4.78 7.15l7.32 5.67C44.2 37.7 46.5 31.6 46.5 24.5z"/>
              <path fill="#FBBC05" d="M10.6 19.46 2.54 13.2C.92 16.36 0 20.05 0 24c0 3.94.92 7.63 2.54 10.8l8.06-6.26C9.9 26.56 9.5 25.33 9.5 24s.4-2.56 1.1-4.54z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.14 15.76-5.84l-7.32-5.67c-2.03 1.37-4.64 2.16-8.44 2.16-6.26 0-11.65-3.8-13.4-9.5l-8.06 6.26C6.44 42.62 14.62 48 24 48z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
