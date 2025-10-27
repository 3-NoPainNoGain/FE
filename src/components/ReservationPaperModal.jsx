// 🔹 Code Title: ReservationPaperModal.jsx (신청서 전용 모달)
// 🔹 Path: src/components/ReservationPaperModal.jsx
// 🔹 목적: DoctorReservationList에서 '진료 신청서' 클릭 시 동일 디자인으로 카드만 모달에 표시
// 🔹 비고: ESC 닫기, 바깥 클릭 닫기 지원. 뒷배경 blur + dim 적용.

import { useEffect, useMemo, useState } from "react";
import { api } from "../auth/axios";
import "./reservation-paper-modal.css"; // ⬅️ 모달 전용 스타일

// 단독 옵션 처리가 필요 없으므로 OPTION_MAP은 제거합니다.

// ✅ props
// - reservationId: number | string (필수)
// - onClose: () => void (필수)
export default function ReservationPaperModal({ reservationId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 상세 조회
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        // NOTE: API로부터 받아오는 옵션 키는 대문자 VOICE_TO_TEXT, SIGN_TO_TEXT 등을 가정합니다.
        const { data } = await api.get(`/api/v2/reservation/${reservationId}`);
        if (!alive) return;
        setData(data?.results || null);
      } catch (e) {
        if (!alive) return;
        const status = e?.response?.status;
        setErr(
          status === 404
            ? "예약을 찾을 수 없어요. (404)"
            : `예약 정보를 불러오는 중 오류가 발생했어요. (${status ?? "network"})`
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reservationId]);

  // ReservationConfirm의 우측 카드와 동일한 데이터 보호/표기 방식
  // ReservationConfirm의 우측 카드와 동일한 데이터 보호/표기 방식
const safe = useMemo(() => {
  // --- 1) 원시 옵션값을 어떤 형태로 와도 배열로 정규화 ---
  const raw = data?.selectedOptions;
  let opts = [];
  if (Array.isArray(raw)) {
    opts = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    // "VOICE_TO_TEXT" 또는 "VOICE_TO_TEXT,SIGN_TO_TEXT" 같은 형태 방지
    opts = raw.split(","); 
  }
  // 대문자 + 공백제거로 정규화
  const norm = opts
    .map((v) => String(v).trim().toUpperCase())
    .filter(Boolean);

  // --- 2) 의미 매핑 (단일/복합 모두 처리) ---
  // 규칙: SIGN_TO_TEXT만 선택 or SIGN_TO_TEXT 포함 → "수어로 진료받기"
  //       VOICE_TO_TEXT만 → "음성으로 진료받기"
  //       그 외 → 원문 나열
  let displayOption = "선택 없음";
  if (norm.length > 0) {
    const hasVoice = norm.includes("VOICE_TO_TEXT");
    const hasSign  = norm.includes("SIGN_TO_TEXT");
    if (hasVoice && hasSign) {
      displayOption = "수어로 진료받기";
    } else if (hasVoice) {
      displayOption = "음성으로 진료받기";
    } else if (hasSign) {
      displayOption = "수어로 진료받기";
    } else {
      displayOption = norm.join(", "); // 미정의 키는 그대로 노출
    }
  }

  return {
    date: data?.slotDate || "",
    time: data ? `${data.startTime} ~ ${data.endTime}` : "",
    name: data?.name || "",
    rrn: data?.residentId || "******-*******",
    symptom: data?.symptom || "-",
    symptomDuration: data?.symptomDuration ?? null,
    description: (data?.description ?? "").trim() || "-",
    displayOption,
  };
}, [data]);


  return (
    <div className="rpmodal__backdrop" onClick={onClose}>
      <div
        className="rpmodal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="진료 신청서"
        onClick={(e) => e.stopPropagation()}
      >
    

        {/* 원래 ReservationConfirm 우측 카드 스타일 그대로 */}
          <section className="resv__card">
    {/* 우상단 고정 닫기 버튼 */}
    <button
      className="rpmodal__close rpmodal__close--corner"
      onClick={onClose}
      aria-label="닫기"
      title="닫기"
    >
      ✕
    </button>
    <header className="resv__cardhead">
      <h2 className="resv__title">진료 신청서</h2>
      <span className="resv__date">{safe.date}</span>
    </header>

          <div className="resv__form">
            {loading && <p>불러오는 중…</p>}
            {!!err && <p style={{ color: "crimson" }}>{err}</p>}
            {!loading && !err && (
              <>
                <div className="form__row">
                  <label className="form__label">이름</label>
                  <div className="form__value">{safe.name}</div>
                </div>

                <div className="form__row">
                  <label className="form__label">주민등록 번호</label>
                  <div className="form__value">{safe.rrn}</div>
                </div>

                <div className="form__row">
                  <label className="form__label">증상</label>
                  <div className="form__value">
                    {safe.symptom}
                    {safe.symptomDuration !== null
                      ? ` · ${safe.symptomDuration}일`
                      : " · 기간 미응답"}
                  </div>
                </div>

                <div className="form__row">
                  <label className="form__label">기타 증상(메모)</label>
                  <div className="form__value">{safe.description}</div>
                </div>

                {/* 선택한 기능: 이제 safe.displayOption에 최종 문자열이 들어 있습니다. */}
                <div className="form__row">
                  <label className="form__label">선택한 기능</label>
                  {/* 기존 safe.selectedOptions.join(...) 대신 safe.displayOption을 사용합니다. */}
                  <div className="form__value">
                    {safe.displayOption}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}