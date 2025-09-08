import { useEffect } from "react";
import "./confirm-modal.css";

export default function ConfirmModal({
  open,
  title = "진료 종료하기",
  description = "진료를 종료하고 진료 내용 보고서로 이동합니다",
  confirmText = "확인",
  cancelText = "취소",
  onConfirm,
  onCancel,
  loading = false,
}) {
  useEffect(() => {
    // 모달 열릴 때 뒷스크롤 방지
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="cm__backdrop" role="dialog" aria-modal="true">
      <div className="cm__card">
        <h3 className="cm__title">{title}</h3>
        <p className="cm__desc">{description}</p>

        <div className="cm__actions">
          <button className="cm__btn cm__btn--ghost" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button className="cm__btn cm__btn--primary" onClick={onConfirm} disabled={loading}>
            {loading ? "종료 중..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
