import "./visit.css";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getTelemedHistory } from "../services/telemedicine";


export default function TelemedHistoryPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getTelemedHistory({ page: p, size });
      setItems(res.items || []);
      setHasNext(!!res.hasNext);
      setPage(res.page ?? p);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [size]);

  useEffect(() => { load(0); }, [load]);

  const goSummary = (roomId) => {
    if (!roomId) return;
    navigate(`/telemed/summary/${roomId}`);
  };

  const rows = useMemo(() => {
    return (items || []).map((it) => ({
      id: it.roomId,
      slot: `${it.slotDate} | ${it.startTime}~${it.endTime}`,
      hospital: it.hospitalName || "-",
      doctor: it.doctorName || "-",
      symptom: it.symptom || "-",
    }));
  }, [items]);

  return (
    <div className="visit" style={{ "--sidebar-w": "220px" }}>
      <Sidebar />
      <main className="visit__main">
        <div className="vm__container">
          <div style={styles.card}>
            <div style={styles.table}>
              {/* 헤더 */}
              <div style={{ ...styles.tr, ...styles.trHead }}>
                <div style={{ ...styles.td, flex: 2.4 }}>예약일시</div>
                <div style={{ ...styles.td, flex: 1.6 }}>병원</div>
                <div style={{ ...styles.td, flex: 1.2 }}>담당 의사</div>
                <div style={{ ...styles.td, flex: 2.2 }}>증상</div>
                <div style={{ ...styles.td, flex: 1, textAlign: "right" }} />
              </div>

              {/* 바디 */}
              {loading && (
                <div style={styles.empty}>불러오는 중…</div>
              )}
              {!loading && err && (
                <div style={{ ...styles.empty, color: "#B42318" }}>
                  진료 내역을 불러오지 못했어요
                </div>
              )}
              {!loading && !err && rows.length === 0 && (
                <div style={styles.empty}>진료 내역이 없어요</div>
              )}
              {!loading && !err && rows.map((r) => (
                <div key={r.id} style={styles.tr}>
                  <div style={{ ...styles.td, flex: 2.4 }}>{r.slot}</div>
                  <div style={{ ...styles.td, flex: 1.6 }}>{r.hospital}</div>
                  <div style={{ ...styles.td, flex: 1.2 }}>{r.doctor}</div>
                  <div style={{ ...styles.td, flex: 2.2, color: "#374151" }}>{r.symptom}</div>
                  <div style={{ ...styles.td, flex: 1, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => goSummary(r.id)}
                      style={styles.linkBtn}
                      title="진료 신청서 보기"
                    >
                      진료 신청서
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 (필요 시) */}
            <div style={styles.pager}>
              <button
                type="button"
                style={{ ...styles.pagerBtn, opacity: page === 0 ? 0.5 : 1 }}
                onClick={() => page > 0 && load(page - 1)}
                disabled={page === 0}
              >
                ‹ 이전
              </button>
              <div style={styles.pageInfo}>{page + 1}</div>
              <button
                type="button"
                style={{ ...styles.pagerBtn, opacity: hasNext ? 1 : 0.5 }}
                onClick={() => hasNext && load(page + 1)}
                disabled={!hasNext}
              >
                다음 ›
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* 스타일 (첫 번째 스샷 분위기 맞춤) */
const styles = {
  card: {
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,.06)",
    padding: 16,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  tr: {
    display: "flex",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#fff",
  },
  trHead: {
    fontWeight: 700,
    color: "#6B7280",
    background: "#F8FAFC",
    border: "1px solid #EEF2F7",
  },
  td: {
    fontSize: 14,
    color: "#111827",
  },
  empty: {
    padding: "40px 0",
    textAlign: "center",
    color: "#9CA3AF",
  },
  linkBtn: {
    border: "1px solid #D7DBFF",
    background: "#fff",
    color: "#3D46FF",
    padding: "6px 12px",
    fontSize: 13,
    borderRadius: 999,
    cursor: "pointer",
  },
  pager: {
    marginTop: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  pagerBtn: {
    border: "1px solid #E5E7EB",
    background: "#fff",
    padding: "6px 10px",
    fontSize: 13,
    borderRadius: 8,
    cursor: "pointer",
  },
  pageInfo: {
    minWidth: 28,
    textAlign: "center",
    fontWeight: 700,
    color: "#4B5563",
  },
};
