import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./doctor-reservation-list.css";

import {
  listReservations,
  getReservation,
  setReservationDecision,
} from "../services/reservation";

import ReservationPaperModal from "../components/ReservationPaperModal"; 

const STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED",
};

function normalizeStatus(raw) {
  const s = String(raw || "").toUpperCase();

  if (["REQUESTED"].includes(s)) return STATUS.PENDING;

  if (["CONFIRMED", "ACCEPTED", "ACTIVE"].includes(s)) return STATUS.ACCEPTED;

  if (["REJECTED", "CANCELED", "CANCELLED"].includes(s)) return STATUS.REJECTED;

  if (["COMPLETED", "DONE", "FINISHED"].includes(s)) return STATUS.COMPLETED;

  return STATUS.PENDING;
}

async function hydrateWithNames(items) {
  const details = await Promise.all(
    items.map((it) =>
      getReservation(it.reservationId)
        .then((d) => ({ id: it.reservationId, name: d?.name || `환자 #${it.patientId}` }))
        .catch(() => ({ id: it.reservationId, name: `환자 #${it.patientId}` }))
    )
  );
  const nameMap = new Map(details.map((d) => [d.id, d.name]));
  return items.map((it) => ({
    id: it.reservationId,
    name: nameMap.get(it.reservationId) || `환자 #${it.patientId}`,
    symptoms: it.symptom,
    status: normalizeStatus(it.status),
    dateLabel: `${String(it.slotDate || "").replaceAll("-", ".")} | ${String(
      it.startTime || ""
    ).slice(0, 5)}~${String(it.endTime || "").slice(0, 5)}`,
    applyPath: `/doctor/applications/${it.reservationId}`, 
  }));
}

export default function DoctorReservationList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: null, action: null });

  const [activePaperId, setActivePaperId] = useState(null);

  useEffect(() => {
    let alive = true;

    const fetchList = async () => {
      try {
        setLoading(true);
        setErr("");
        const resp = await listReservations({ page: 0, size: 10 });
        const items = resp?.items || resp?.results?.items || [];
        const merged = await hydrateWithNames(items);
        if (alive) setRows(merged);
      } catch (e) {
        if (alive) setErr("예약 목록을 불러오는 중 오류가 발생했어요.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchList();
    const timer = setInterval(fetchList, 5000);
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
    const nextStatus = isAccept ? STATUS.ACCEPTED : STATUS.REJECTED;

    try {
      await setReservationDecision(confirm.id, isAccept);
      setRows((prev) =>
        isAccept
          ? prev.map((r) => (r.id === confirm.id ? { ...r, status: nextStatus } : r))
          : prev.filter((r) => r.id !== confirm.id) // 거절 시 행 삭제
      );
    } catch {
      alert("요청 처리에 실패했어요. 다시 시도해 주세요.");
    } finally {
      close();
    }
  };

  const titleText =
    confirm.action === "ACCEPT" ? "진료 수락하시겠습니까?" : "진료 거절하시겠습니까?";
  const confirmText = confirm.action === "ACCEPT" ? "수락" : "거절";

  const openPaper = (id) => setActivePaperId(id);
  const closePaper = () => setActivePaperId(null);

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

            {loading && <div className="doclist__banner">불러오는 중…</div>}
            {!!err && <div className="doclist__banner doclist__banner--error">{err}</div>}

            <div className="doclist__table" role="table">
              <div className="doclist__thead">
                <div className="doclist__row doclist__row--head">
                  <div className="col col--time">예약일시</div>
                  <div className="col col--name">이름</div>
                  <div className="col col--symptom">증상</div>
                  <div className="col col--paper">진료 신청서</div>
                  <div className="col col--actions">수락여부</div>
                </div>
              </div>

              <div className="doclist__tbody">
                {rows
                  .filter((r) => r.status !== STATUS.REJECTED)
                  .map((r) => (
                    <div className="doclist__row" key={r.id}>
                      <div className="col col--time">{r.dateLabel}</div>
                      <div className="col col--name">{r.name}</div>
                      <div className="col col--symptom">{r.symptoms}</div>
                      <div className="col col--paper">
                        <button
                          type="button"
                          className="doclist__link as-button doclist__link--muted"
                          onClick={() => openPaper(r.id)}
                          aria-label={`예약 ${r.id}의 진료 신청서 보기`}
                        >
                          진료 신청서
                        </button>
                      </div>
                      <div className="col col--actions">
                        {r.status === STATUS.PENDING && (
                          <div className="actions">
                            <button
                              className="btn btn--ghost"
                              onClick={() => ask(r.id, "REJECT")}
                            >
                              거절
                            </button>
                            <button
                              className="btn btn--primary"
                              onClick={() => ask(r.id, "ACCEPT")}
                            >
                              수락
                            </button>
                          </div>
                        )}

                        {r.status === STATUS.ACCEPTED && (
                          <div className="actions">
                            <Link
                              to={`/tele/session/${r.id}`}
                              state={{ roleHint: "doctor" }}
                              className="btn btn--primary no-underline"
                            >
                              진료 입장
                            </Link>
                          </div>
                        )}

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

        {confirm.open && (
          <div className="dl-modal__backdrop" onClick={close}>
            <div className="dl-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="dl-modal__title">{titleText}</h3>
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

        {activePaperId != null && (
          <ReservationPaperModal reservationId={activePaperId} onClose={closePaper} />
        )}
      </main>
    </div>
  );
}
