// src/pages/DoctorReservationList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./doctor-reservation-list.css";

import {
  STATUS,
  listReservations,
  getReservation,
  setReservationDecision,
} from "../services/reservation";

// 목록에 name 붙이기: 각 예약에 대해 단건 조회 호출(N+1) – UI 변경 없이 실명 노출
async function hydrateWithNames(items) {
  const details = await Promise.all(
    items.map((it) =>
      getReservation(it.reservationId)
        .then((d) => ({
          id: it.reservationId,
          name: d.name || `환자 #${it.patientId}`,
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
    status: it.status,
    dateLabel: `${(it.slotDate || "").replaceAll("-", ".")} | ${(it.startTime || "").slice(0, 5)}~${(it.endTime || "").slice(0, 5)}`,
    applyPath: `/doctor/applications/${it.reservationId}`,
  }));
}

export default function DoctorReservationList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
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
        const { items } = await listReservations({ page: 0, size: 10 });
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
    () => rows.filter((r) => r.status === STATUS.REQUESTED).length,
    [rows]
  );

  const ask = (id, action) => setConfirm({ open: true, id, action });
  const close = () => setConfirm({ open: false, id: null, action: null });

  const confirmAction = async () => {
    if (!confirm.open || !confirm.id) return close();
    const isAccept = confirm.action === "ACCEPT";
    const nextStatus = isAccept ? STATUS.CONFIRMED : STATUS.CANCELED;

    try {
      await setReservationDecision(confirm.id, isAccept);
      // 수락/거절 즉시 UI 상태 갱신
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
              <div className="doclist__meta">
                {loading ? "불러오는 중…" : `대기 ${pendingCount}건`}
              </div>
            </header>

            {err && (
              <div style={{ color: "crimson", padding: "8px 12px" }}>{err}</div>
            )}

            <div className="doclist__table" role="table" aria-label="진료 예약 목록">
              <div className="doclist__thead" role="rowgroup">
                <div className="doclist__row doclist__row--head" role="row">
                  <div className="col col--time" role="columnheader">예약일시</div>
                  <div className="col col--name" role="columnheader">이름</div>
                  <div className="col col--symptom" role="columnheader">증상</div>
                  <div className="col col--paper" role="columnheader">진료 신청서</div>
                  <div className="col col--actions" role="columnheader">수락/입장</div>
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
                      {r.status === STATUS.REQUESTED && (
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

                      {r.status === STATUS.CANCELED && (
                        <span className="state state--rejected">거절</span>
                      )}

                      {r.status === STATUS.CONFIRMED && (
                        // 수락 이후엔 “진료 입장” 버튼 노출(의사 역할로 입장)
                        <Link
                          to={`/tele/session/${r.id}`}
                          state={{ roleHint: "doctor" }}
                          className="btn btn--primary"
                          aria-label="진료 입장"
                        >
                          진료 입장
                        </Link>
                      )}

                      {r.status === STATUS.COMPLETED && (
                        <span className="state">진료 완료</span>
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
