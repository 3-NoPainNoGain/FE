// src/pages/DoctorReservationList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./doctor-reservation-list.css";

import {
  STATUS,                // 내부 표준: { PENDING, ACCEPTED, REJECTED, COMPLETED }
  listReservations,
  getReservation,
  setReservationDecision, // (id, isAccept:boolean) → POST /reservation/{id}/accept
} from "../services/reservation";

/* BE 상태 → UI 표준 상태 매핑 */
function normalizeStatus(raw) {
  const s = String(raw || "").toUpperCase();
  // 대기
  if (s === "REQUESTED" || s === "PENDING" || s === "WAITING") return STATUS.PENDING;
  // 수락됨
  if (s === "CONFIRMED" || s === "ACCEPTED" || s === "ACTIVE") return STATUS.ACCEPTED;
  // 거절/취소
  if (s === "REJECTED" || s === "CANCELED" || s === "CANCELLED") return STATUS.REJECTED;
  // 완료
  if (s === "COMPLETED" || s === "DONE" || s === "FINISHED") return STATUS.COMPLETED;
  console.warn("[DoctorReservationList] unknown status:", raw);
  return STATUS.PENDING;
}

/* 목록에 실명 붙이기 (N+1) */
async function hydrateWithNames(items) {
  const details = await Promise.all(
    items.map((it) =>
      getReservation(it.reservationId)
        .then((d) => ({
          id: it.reservationId,
          name: d?.name || `환자 #${it.patientId}`,
        }))
        .catch(() => ({
          id: it.reservationId,
          name: `환자 #${it.patientId}`,
        }))
    )
  );
  const nameMap = new Map(details.map((d) => [d.id, d.name]));
  return items.map((it) => ({
    id: it.reservationId,
    name: nameMap.get(it.reservationId) || `환자 #${it.patientId}`,
    symptoms: it.symptom,
    status: normalizeStatus(it.status), // ← 정규화 적용
    dateLabel: `${String(it.slotDate || "").replaceAll("-", ".")} | ${String(
      it.startTime || ""
    ).slice(0, 5)}~${String(it.endTime || "").slice(0, 5)}`,
    applyPath: `/doctor/applications/${it.reservationId}`,
  }));
}

export default function DoctorReservationList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);  // ESLint 경고 제거용으로 UI에 노출
  const [err, setErr] = useState("");

  const [confirm, setConfirm] = useState({
    open: false,
    id: null,
    action: null, // "ACCEPT" | "REJECT"
  });

  useEffect(() => {
    let alive = true;

    const fetchList = async () => {
      try {
        setLoading(true);
        setErr("");
        // BE가 results.items로 줄 수 있어 안전 처리
        const resp = await listReservations({ page: 0, size: 10 });
        const items = resp?.items || resp?.results?.items || [];
        const merged = await hydrateWithNames(items);
        if (alive) setRows(merged);
      } catch (e) {
        console.error("[DoctorReservationList] list error:", e);
        if (alive) setErr("예약 목록을 불러오는 중 오류가 발생했어요.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchList();
    const timer = setInterval(fetchList, 5000); // 5초마다 갱신
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === STATUS.PENDING).length,
    [rows]
  );

  const ask = (id, action) => setConfirm({ open: true, id, action });
  const close = () => setConfirm({ open: false, id: null, action: null });

  const confirmAction = async () => {
    if (!confirm.open || !confirm.id) return close();
    const isAccept = confirm.action === "ACCEPT";
    // BE: /reservation/{id}/accept {accept: true|false}
    // true → CONFIRMED, false → CANCELED(또는 REJECTED)
    const nextStatus = isAccept ? STATUS.ACCEPTED : STATUS.REJECTED;

    try {
      await setReservationDecision(confirm.id, isAccept);
      // 즉시 UI 반영
      setRows((prev) =>
        prev.map((r) => (r.id === confirm.id ? { ...r, status: nextStatus } : r))
      );
    } catch (e) {
      console.error("[DoctorReservationList] decision error:", e);
      alert("요청 처리에 실패했어요. 다시 시도해 주세요.");
    } finally {
      close();
    }
  };

  const titleText =
    confirm.action === "ACCEPT" ? "진료 수락하시겠습니까?" : "진료 거절하시겠습니까?";
  const confirmText = confirm.action === "ACCEPT" ? "수락" : "거절";

  return (
    <div className="telemed apply">
      <Sidebar />

      <main className="doclist__main">
        <div className="doclist__container">
          <section className="doclist__card">
            <header className="doclist__header">
              <h2>진료 예약 관리</h2>
              <div className="doclist__meta">대기 {pendingCount}건</div>
            </header>

            {/* 로딩/에러 배너: 경고 제거 및 상태 가시화 */}
            {loading && <div className="doclist__banner">불러오는 중…</div>}
            {!!err && <div className="doclist__banner doclist__banner--error">{err}</div>}

            <div className="doclist__table" role="table" aria-label="진료 예약 목록">
              <div className="doclist__thead" role="rowgroup">
                <div className="doclist__row doclist__row--head" role="row">
                  <div className="col col--time" role="columnheader">예약일시</div>
                  <div className="col col--name" role="columnheader">이름</div>
                  <div className="col col--symptom" role="columnheader">증상</div>
                  <div className="col col--paper" role="columnheader">진료 신청서</div>
                  <div className="col col--actions" role="columnheader">수락여부</div>
                </div>
              </div>

              <div className="doclist__tbody" role="rowgroup">
                {rows.map((r) => (
                  <div className="doclist__row" role="row" key={r.id}>
                    <div className="col col--time" role="cell">{r.dateLabel}</div>
                    <div className="col col--name" role="cell">{r.name}</div>
                    <div className="col col--symptom" role="cell">{r.symptoms}</div>

                    <div className="col col--paper" role="cell">
                      <Link className="doclist__link" to={r.applyPath}>
                        진료 신청서
                      </Link>
                    </div>

                    <div className="col col--actions" role="cell">
                      {/* 대기중: 수락/거절 버튼 */}
                      {r.status === STATUS.PENDING && (
                        <div className="actions">
                          <button
                            className="btn btn--ghost"
                            onClick={() => ask(r.id, "REJECT")}
                            aria-label="거절"
                          >
                            거절
                          </button>
                          <button
                            className="btn btn--primary"
                            onClick={() => ask(r.id, "ACCEPT")}
                            aria-label="수락"
                          >
                            수락
                          </button>
                        </div>
                      )}

                      {/* 거절됨 */}
                      {r.status === STATUS.REJECTED && (
                        <span className="state state--rejected">거절</span>
                      )}

                      {/* 수락됨 → 진료 입장 버튼 */}
                      {r.status === STATUS.ACCEPTED && (
                        <Link
                          to={`/tele/session/${r.id}`}
                          state={{ roleHint: "doctor" }}
                          className="btn btn--primary"
                          aria-label="진료 입장"
                        >
                          진료 입장
                        </Link>
                      )}

                      {/* 완료됨 */}
                      {r.status === STATUS.COMPLETED && (
                        <span className="state state--accepted">수락 완료</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 확인 모달 */}
        {confirm.open && (
          <div className="dl-modal__backdrop" role="presentation" onClick={close}>
            <div
              className="dl-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dl-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="dl-modal-title" className="dl-modal__title">
                {titleText}
              </h3>
              <div className="dl-modal__actions">
                <button className="dl-btn dl-btn--ghost" onClick={close}>
                  취소
                </button>
                <button className="dl-btn dl-btn--primary" onClick={confirmAction}>
                  {confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
