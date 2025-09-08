// src/components/EndDiagnosisModal.jsx
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function EndDiagnosisModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  // body에 모달 루트 보장
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 핵심 레이아웃은 inline style로도 한 번 더 보장(만약 CSS가 못 불리면 이게 작동)
  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };

  const cardStyle = {
    width: 400,
    maxWidth: "calc(100% - 40px)",
    background: "#fff",
    borderRadius: 20,
    padding: "28px 24px",
    textAlign: "center",
    boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
  };

  return createPortal(
    <div className="modal__backdrop" style={backdropStyle} onClick={onClose} aria-modal="true" role="dialog">
      <div className="modal__card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">진료 종료하기</h2>
        <p className="modal__desc">진료를 끝내고 진료 내용 보고서로 이동합니다</p>

        <div className="modal__actions">
          <button className="btn-outline modal__btn" onClick={onClose}>취소</button>
          <button className="btn-primary modal__btn" onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>,
    root
  );
}
