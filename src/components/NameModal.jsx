import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import "./name-modal.css";

export default function NameModal({ onClose }) {
  const { setUserName } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    // 배경 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await setUserName(trimmed);
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose?.();
  };

  return (
    <div className="nm-overlay" role="dialog" aria-modal="true" onKeyDown={onKeyDown}>
      <div className="nm-card">
        <button className="nm-close" onClick={() => onClose?.()} aria-label="닫기">
          ×
        </button>

        <h2 className="nm-title">이름을 입력해 주세요</h2>

        <form className="nm-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="nm-input"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
          <button type="submit" className="nm-btn" disabled={loading || !name.trim()}>
            {loading ? "저장 중…" : "확인"}
          </button>
        </form>

        <p className="nm-help">서비스의 모든 기능을 이용하기 위해 본명을 입력해 주세요.</p>
      </div>
    </div>
  );
}
