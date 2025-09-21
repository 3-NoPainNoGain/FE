// src/pages/ReservationConfirm.jsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./tele-reservation.css";

export default function ReservationConfirm() {
  const { reservationId } = useParams();
  const nav = useNavigate();
  const { state } = useLocation(); // Apply에서 전달한 interpretationOption, memo
  const selectedOptions = state?.interpretationOption || []; // ["SIGN_TO_TEXT","VOICE_TO_TEXT"]

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // 서버 응답 results

  async function fetchDetail() {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get(`/api/v2/reservation/${reservationId}`);
      console.log("[DEBUG] 예약 상세 응답:", data);
      setData(data?.results || null);
    } catch (e) {
      console.error(e);
      setErr("예약 정보를 불러오는 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function onCancel() {
    if (!window.confirm("예약을 취소하시겠습니까?")) return;
    try {
      console.log("[DEBUG] 예약 취소 요청:", reservationId);
      const { data } = await api.delete(`/api/v2/reservation/${reservationId}`);
      console.log("[DEBUG] 예약 취소 응답:", data);

   // 취소 후 의사 목록으로
   try {
     sessionStorage.removeItem(`lastMemo:${reservationId}`); // 메모 캐시 정리(옵션)
   } catch (e) {
     console.debug("[Storage] removeItem failed", e);
   }
   nav("/tele/doctor-list", {
     replace: true,                      // 뒤로가기 눌러도 취소 전 화면 안 돌아오게
     state: { flash: "예약을 취소했어요." } // (옵션) 목록에서 안내 띄우고 싶을 때
   });
    } catch (e) {
      console.error(e);
      alert("예약 취소에 실패했어요.");
    }
  }

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  // 화면 표기용 가공 (메모 폴백: 서버 → state → sessionStorage)
  const memoFromState = (state?.memo || "").trim();
  let memoFromSession = "";
try {
  memoFromSession = (sessionStorage.getItem(`lastMemo:${reservationId}`) || "").trim();
} catch (e) {
  // 세션 읽기 실패는 무시
  console.debug?.("[Storage] getItem failed", e);
}

  const descriptionFromServer =
    (typeof data?.description === "string" && data.description.trim()) ? data.description.trim() : "";

  const mockSafe = {
    dept: data?.speciality || "내과",
    hospital: data?.hospitalName || "이화여대 내과 병원",
    doctor: data?.doctorName || "의사",
    date: data?.slotDate || "",
    time: data ? `${data.startTime} ~ ${data.endTime}` : "",
    rrn: data?.residentId || "******-*******", // 서버에서 내려줌
    name: data?.name || "",
    status: data?.status || "REQUESTED",
    symptom: data?.symptom || "-", // 서버는 한글(예: "두통")로 내려옴
    symptomDuration: data?.symptomDuration ?? null,
    description: descriptionFromServer || memoFromState || memoFromSession || "-",
  };

  const statusLabel = {
    REQUESTED: "예약 확인 중",
    CONFIRMED: "예약 완료",
    CANCELED: "예약 취소",
    COMPLETED: "진료 완료",
  }[mockSafe.status] || mockSafe.status;

  return (
    <div className="telemed resv">
      <Sidebar />

      <main className="resv__wrap">
        {/* 좌측 */}
        <section className="resv__left">
          <h1 className="resv__headline">예약을 확인하고 있어요</h1>

          {loading && <p>불러오는 중…</p>}
          {err && <p style={{ color: "crimson" }}>{err}</p>}

          {!loading && !err && (
            <>
              <div className="resv__dept">{mockSafe.dept}</div>
              <div className="resv__hname">{mockSafe.hospital}</div>
              <div className="resv__dname">
                {mockSafe.doctor} <span style={{ color: "#888" }}>· {statusLabel}</span>
              </div>
              <div className="resv__when">
                {mockSafe.date} | {mockSafe.time}
              </div>

              <button
                className="resv__go"
                onClick={() =>
                  nav(`/tele/session/${reservationId}`, {
                    state: { interpretationOption: selectedOptions },
                  })
                }
                disabled={mockSafe.status !== "CONFIRMED" && mockSafe.status !== "REQUESTED"}
                title={
                  mockSafe.status === "CANCELED"
                    ? "취소된 예약입니다."
                    : mockSafe.status === "COMPLETED"
                    ? "이미 진료가 완료되었습니다."
                    : ""
                }
              >
                진료 받으러 가기
              </button>

              <div className="resv__cancelwrap">
                <button
                  className="resv__cancel"
                  onClick={onCancel}
                  disabled={mockSafe.status !== "REQUESTED"}
                  title={
                    mockSafe.status !== "REQUESTED"
                      ? "REQUESTED 상태에서만 취소할 수 있어요."
                      : ""
                  }
                >
                  예약 취소하기
                </button>
                <div className="tooltip">
                  <span className="tooltip__icon">?</span>
                  <span className="tooltip__text">
                    예약 취소는 진료 시작 1시간 전까지만 가능합니다.
                  </span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 우측 카드 */}
        <section className="resv__card">
          <header className="resv__cardhead">
            <h2 className="resv__title">진료 신청서</h2>
            <span className="resv__date">{mockSafe.date}</span>
          </header>

          <div className="resv__form">
            {loading && <p>불러오는 중…</p>}
            {!loading && !err && (
              <>
                <div className="form__row">
                  <label className="form__label">이름</label>
                  <div className="form__value">{mockSafe.name}</div>
                </div>

                <div className="form__row">
                  <label className="form__label">주민등록 번호</label>
                  <div className="form__value">{mockSafe.rrn}</div>
                </div>

                <div className="form__row">
                  <label className="form__label">증상</label>
                  <div className="form__value">
                    {mockSafe.symptom}
                    {mockSafe.symptomDuration !== null
                      ? ` · ${mockSafe.symptomDuration}일`
                      : " · 기간 미응답"}
                  </div>
                </div>

                <div className="form__row">
                  <label className="form__label">기타 증상(메모)</label>
                  <div className="form__value">{mockSafe.description}</div>
                </div>

                <div className="form__row">
                  <label className="form__label">선택한 기능</label>
                  <div className="form__value">
                    {selectedOptions.length
                      ? selectedOptions.join(", ")
                      : "선택 없음"}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
