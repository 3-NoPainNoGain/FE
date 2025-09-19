import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./login-modal.css"; // 기존 모달 스타일 재사용

export default function SignupModal({ onClose, onSuccess }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email || !pw || !pw2) {
      setErr("모든 항목을 입력해 주세요.");
      return;
    }
    if (pw !== pw2) {
      setErr("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (pw.length < 8) {
      setErr("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    try {
      setLoading(true);
      await signup({ email, password: pw });  
      onSuccess?.();                          
      onClose?.();
      alert("회원가입이 완료되었습니다. 로그인해 주세요!");
    } catch (error) {
      setErr(error?.response?.data?.message || error?.message || "회원가입에 실패했습니다.");
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
          <h3 className="login-title">Handoc – 회원가입</h3>

          <label className="login-label">
            <span className="login-label__text">이메일</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}  
              required
            />
          </label>

          <label className="login-label">
            <span className="login-label__text">비밀번호</span>
            <input
              className="login-input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}       
              required
            />
          </label>

          <label className="login-label">
            <span className="login-label__text">비밀번호 확인</span>
            <input
              className="login-input"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}      
              required
            />
          </label>

          {err && <p className="login-error">{err}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "가입 중…" : "회원가입"}
          </button>
        </form>
      </div>
    </div>
  );
}
