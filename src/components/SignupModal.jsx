import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./login-modal.css";

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

    if (pw !== pw2) {
      setErr("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      await signup({ email, password: pw });
      onSuccess?.(); // 자동 로그인 완료 → 모달 닫기 등
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409) setErr("이미 사용 중인 이메일입니다.");
      else if (status === 400) setErr("입력값을 확인해 주세요.");
      else {
        const msg = error?.response?.data?.message || error.message || "회원가입에 실패했습니다.";
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" role="dialog" aria-modal="true">
      <div className="login-card">
        <div className="login-card__header">
          <span className="login-logo">Handoc – 회원가입</span>
          <button className="login-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

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
              autoComplete="email"
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
              autoComplete="new-password"
            />
          </label>

          <label className="login-label">
            <span className="login-label__text">비밀번호 확인</span>
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              className="login-input"
              autoComplete="new-password"
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
