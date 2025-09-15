// 코드 제목: 로그인 모달 (이메일/비번 입력 → 로그인 API 호출)
//
// - 오버레이 + 카드 형태의 모달
// - 로그인 성공 시 onClose()를 호출하고 상위에서 상태가 갱신되어 버튼이 사라짐
// - 에러 메시지는 버튼 아래 인라인으로 표기

import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./login-modal.css"; // 스타일은 자유, 주석은 아래 참고

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login({ email, password: pw });
      onClose?.(); // 로그인 성공 → 모달 닫기
    } catch (error) {
      // 400/401 등 메시지 매핑은 여기서
      setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-card">
        {/* 상단 로고/제목 */}
        <div className="login-card__header">
          <span className="login-logo">Handoc</span>
          <button className="login-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        {/* 폼 */}
        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-label">
            <span className="login-label__text">이메일</span>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input"
            />
          </label>

          <label className="login-label">
            <span className="login-label__text">비밀번호</span>
            <input
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              className="login-input"
            />
          </label>

          {err && <p className="login-error">{err}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </button>

          {/* 하단 소셜은 후속 단계에서 연결 */}
          <div className="login-divider"><span>간편 로그인</span></div>
          <div className="login-socials">
            <button type="button" className="social-btn">Kakao</button>
            <button type="button" className="social-btn">Naver</button>
            <button type="button" className="social-btn">Google</button>
          </div>

          <div className="login-links">
            <button type="button" className="link-btn">아이디 찾기</button>
            <span className="sep">|</span>
            <button type="button" className="link-btn">비밀번호 찾기</button>
            <span className="sep">|</span>
            <button type="button" className="link-btn">회원가입</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* login-modal.css에 들어갈 기본 가이드(선택)
.login-overlay { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,.35); z-index: 1000; }
.login-card { width: 520px; max-width: calc(100% - 32px); background:#fff; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.15); padding: 28px; }
.login-card__header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; }
.login-logo { font-weight: 800; font-size: 24px; color:#2F57EB; }
.login-close { background: transparent; border:0; font-size:24px; line-height:1; cursor:pointer; }
.login-form { display:flex; flex-direction: column; gap: 12px; }
.login-label__text { display:block; font-size:12px; color:#666; margin-bottom: 6px; }
.login-input { width:100%; height:44px; border-radius: 10px; border: 1px solid #E6E6E6; padding: 0 12px; }
.login-error { color:#E34850; font-size: 13px; margin-top: 2px; }
.login-submit { height:44px; border-radius: 10px; border:0; background:#2F57EB; color:#fff; font-weight: 700; cursor:pointer; }
.login-divider { display:flex; align-items:center; gap:8px; color:#A0A0A0; font-size:12px; margin: 6px 0; }
.login-divider::before, .login-divider::after { content:""; flex:1; height:1px; background:#eee; }
.login-socials { display:flex; gap:10px; justify-content:center; }
.social-btn { height:40px; padding: 0 14px; border: 1px solid #eee; border-radius: 999px; background:#fff; cursor:pointer; }
.login-links { display:flex; justify-content:center; gap:8px; color:#8F8F8F; margin-top:6px; }
.link-btn { background:none; border:0; color:inherit; cursor:pointer; text-decoration: underline; }
*/
