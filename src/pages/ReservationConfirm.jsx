import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./tele-reservation.css";

const EMPTY_OPTIONS = Object.freeze([]);

export default function ReservationConfirm() {
  const { reservationId } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const selectedOptions = useMemo(
    () => state?.interpretationOption ?? EMPTY_OPTIONS,
    [state?.interpretationOption]
  );

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const prevStatusRef = useRef(null);

  const memoFromState = (state?.memo || "").trim();
  let memoFromSession = "";
  try {
    memoFromSession = (sessionStorage.getItem(`lastMemo:${reservationId}`) || "").trim();
  } catch (e) {
    console.debug("[Storage] getItem failed", e);
  }

  const statusLabelMap = {
    REQUESTED: "예약 확인 중",
    CONFIRMED: "예약 완료",
    CANCELED:  "예약 취소",
    COMPLETED: "진료 완료",
  };

  const safe = useMemo(() => ({
    dept: data?.speciality || "내과",
    hospital: data?.hospitalName || "이화여대 내과 병원",
    doctor: data?.doctorName || "의사",
    date: data?.slotDate || "",
    time: data ? `${data.startTime} ~ ${data.endTime}` : "",
    rrn: data?.residentId || "******-*******",
    name: data?.name || "",
    status: data?.status || "REQUESTED",
    symptom: data?.symptom || "-",
    symptomDuration: data?.symptomDuration ?? null,
    description:
      (data?.description ?? "").trim() ||
      memoFromState ||
      memoFromSession ||
      "-",
  }), [data, memoFromState, memoFromSession]);

  async function fetchDetail() {
    try {
      setLoading(true);
      setErr("");
      const { data } = await api.get(`/api/v2/reservation/${reservationId}`);
      setData(data?.results || null);
    } catch (e) {
      console.error("[API ERROR] get reservation", e?.response?.status, e?.response?.data);
      const status = e?.response?.status;
      if (status === 404) setErr("예약을 찾을 수 없어요. (404)");
      else setErr(`예약 정보를 불러오는 중 오류가 발생했어요. (${status ?? "network"})`);
    } finally {
      setLoading(false);
    }
  }

  async function onCancel() {
    if (!window.confirm("예약을 취소하시겠습니까?")) return;
    try {
      await api.delete(`/api/v2/reservation/${reservationId}`);
      try {
        sessionStorage.removeItem(`lastMemo:${reservationId}`);
      } catch (e) {
        console.debug("[Storage] removeItem failed", e);
      }
      nav("/tele/doctor-list", { replace: true, state: { flash: "예약을 취소했어요." } });
    } catch (e) {
      console.error("[API ERROR] cancel reservation", e?.response?.status, e?.response?.data);
      alert("예약 취소에 실패했어요.");
    }
  }

  useEffect(() => {
    let timer;
    const load = async () => {
      await fetchDetail();
      // 요청 상태가 바뀌는 동안 폴링 유지
      timer = setInterval(async () => {
        if (document.hidden) return;
        await fetchDetail();
      }, 5000);
    };
    load();
    return () => timer && clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  // ✅ 상태 전환 감지: REQUESTED → CONFIRMED 되면 자동 이동(원하면 주석 해제)
  useEffect(() => {
    const prev = prevStatusRef.current;
    const cur = safe.status;
    if (prev !== cur && cur === "CONFIRMED") {
      // 자동 이동을 원하면 아래 주석 해제
      // nav(`/tele/session/${reservationId}`, { state: { interpretationOption: selectedOptions } });
    }
    prevStatusRef.current = cur;
  }, [safe.status, nav, reservationId, selectedOptions]);

  const statusLabel = statusLabelMap[safe.status] || safe.status;
  // ✅ “진료 입장” 버튼은 CONFIRMED일 때만 활성화
  const canEnter = safe.status === "CONFIRMED";

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
              <div className="resv__dept">{safe.dept}</div>
              <div className="resv__hname">{safe.hospital}</div>
              <div className="resv__dname">
                {safe.doctor} <span style={{ color: "#888" }}>· {statusLabel}</span>
              </div>
              <div className="resv__when">
                {safe.date} | {safe.time}
              </div>

              <button
                className="resv__go"
                onClick={() =>
                  nav(`/tele/session/${reservationId}`, {
                    state: { interpretationOption: selectedOptions },
                  })
                }
                disabled={!canEnter}
                title={
                  canEnter
                    ? ""
                    : "의사가 예약을 수락하면 ‘진료 입장’이 활성화됩니다."
                }
              >
                {canEnter ? "진료 입장" : "예약 확인 중…"}
              </button>

              <div className="resv__cancelwrap">
                <button
                  className="resv__cancel"
                  onClick={onCancel}
                  disabled={safe.status !== "REQUESTED"}
                  title={
                    safe.status !== "REQUESTED"
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
            <span className="resv__date">{safe.date}</span>
          </header>

          <div className="resv__form">
            {loading && <p>불러오는 중…</p>}
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
