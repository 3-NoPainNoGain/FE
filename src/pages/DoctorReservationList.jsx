import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./doctor-reservation-list.css";

const STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
};

const seed = [
  {
    id: 1,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래",
    status: STATUS.PENDING,
    applyPath: "/doctor/applications/1",
  },
  {
    id: 2,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래, 코막힘, 두통",
    status: STATUS.PENDING,
    applyPath: "/doctor/applications/2",
  },
  {
    id: 3,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래",
    status: STATUS.PENDING,
    applyPath: "/doctor/applications/3",
  },
  {
    id: 4,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래",
    status: STATUS.REJECTED,
    applyPath: "/doctor/applications/4",
  },
  {
    id: 5,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래",
    status: STATUS.ACCEPTED,
    applyPath: "/doctor/applications/5",
  },
  {
    id: 6,
    dateLabel: "2025.09.08 | 11:00~11:20",
    name: "이하은",
    symptoms: "기침, 가래",
    status: STATUS.ACCEPTED,
    applyPath: "/doctor/applications/6",
  },
];

async function fetchReservations() {
  return new Promise((r) => setTimeout(() => r(seed), 200));
}

export default function DoctorReservationList() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchReservations().then((list) => {
      if (!alive) return;
      setRows(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === STATUS.PENDING).length,
    [rows]
  );

  const setStatus = (id, next) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));

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
                      {r.status === STATUS.PENDING && (
                        <div className="actions">
                          <button
                            className="btn btn--ghost"
                            onClick={() => setStatus(r.id, STATUS.REJECTED)}
                            aria-label="거절"
                          >
                            거절
                          </button>
                          <button
                            className="btn btn--primary"
                            onClick={() => setStatus(r.id, STATUS.ACCEPTED)}
                            aria-label="수락"
                          >
                            수락
                          </button>
                        </div>
                      )}

                      {r.status === STATUS.REJECTED && (
                        <span className="state state--rejected">거절</span>
                      )}

                      {r.status === STATUS.ACCEPTED && (
                        <span className="state state--accepted">수락 완료</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
