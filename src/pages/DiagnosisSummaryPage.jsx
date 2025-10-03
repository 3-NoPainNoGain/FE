import './visit.css';
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getDiagnosisSummary } from "../services/diagnosis.js";
import Sidebar from "../components/Sidebar";

export default function DiagnosisSummaryPage() {
  const { diagnosisId } = useParams();
  const location = useLocation();

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getDiagnosisSummary(diagnosisId);
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [diagnosisId]);

  const chatItems = useMemo(() => {
    const fromState = location?.state?.messages;

    let fromStorage = null;
    try {
      const raw = sessionStorage.getItem(`chat:${diagnosisId}`);
      if (raw) fromStorage = JSON.parse(raw);
    } catch (e) {
      console.debug("sessionStorage restore skipped:", e);
    }

    const fromBackend =
      (data?.dialog ?? data?.chat ?? data?.messages ?? data?.conversation ?? null);

    const raw = fromState ?? fromStorage ?? fromBackend ?? [];
    const norm = [];
    for (const item of Array.isArray(raw) ? raw : []) {
      if (!item) continue;
      if (typeof item === "string") {
        norm.push({ id: crypto.randomUUID(), role: "doctor", text: item });
      } else if (typeof item === "object") {
        const role = item.role === "patient" ? "patient" : "doctor";
        const text = String(item.text ?? item.message ?? "");
        if (text) norm.push({ id: item.id || crypto.randomUUID(), role, text });
      }
    }
    return norm;
  }, [location?.state?.messages, diagnosisId, data]);

  const fmtTime = (t) => {
    const s = String(t ?? "").trim();
    return s || "정보 없음";
  };
  const fmtText = (v) => {
    if (v == null) return "정보 없음";
    if (Array.isArray(v)) {
      return v.length ? v.join(", ") : "정보 없음";
    }
    const s = String(v).trim();
    return s || "정보 없음";
  };
  const renderAny = (v) => {
    if (v == null) return <span style={styles.muted}>정보 없음</span>;
    if (Array.isArray(v)) {
      if (!v.length) return <span style={styles.muted}>정보 없음</span>;
      return (
        <ul style={styles.ul}>
          {v.map((it, idx) => <li key={idx}>{fmtText(it)}</li>)}
        </ul>
      );
    }
    if (typeof v === "object") {
      const entries = Object.entries(v || {});
      if (!entries.length) return <span style={styles.muted}>정보 없음</span>;
      return (
        <div style={styles.kvWrap}>
          {entries.map(([k, val]) => (
            <div key={k} style={styles.kvRow}>
              <div style={styles.kvKey}>{k}</div>
              <div style={styles.kvVal}>{fmtText(val)}</div>
            </div>
          ))}
        </div>
      );
    }
    const s = String(v).trim();
    return s ? <span>{s}</span> : <span style={styles.muted}>정보 없음</span>;
  };

  return (
    <div className="visit" style={{ '--sidebar-w': '220px' }}>
      <Sidebar />

      <main className="visit__main">
        <div className="vm__container">
          <div style={styles.page}>

            <section style={styles.grid}>
              <div style={styles.chatCard}>
                <div style={styles.chatScroll}>
                  {loading && <div style={styles.empty}>불러오는 중…</div>}
                  {!loading && !!err && (
                    <div style={{ ...styles.empty, color: "#B42318" }}>
                      요약을 불러오지 못했어요
                    </div>
                  )}
                  {!loading && !err && chatItems.length === 0 && (
                    <div style={styles.empty}>대화 내역이 없어요</div>
                  )}
                  {chatItems.map((m) => (
                    <ChatBubble key={m.id} role={m.role} text={m.text} />
                  ))}
                </div>
              </div>

              <div style={styles.reportCard}>
                <div style={styles.reportTitle}>진료 내용 보고서</div>
                <div style={styles.reportLine} />

                <div style={styles.reportScroll}>
                  {loading && <div style={styles.muted}>불러오는 중…</div>}
                  {!loading && !!err && (
                    <div style={{ color: "#B42318", fontWeight: 600 }}>
                      보고서를 불러오지 못했어요
                    </div>
                  )}

                  {!loading && !err && (
                    <>
                      <div style={styles.row}>
                        <div style={styles.label}>진료 시간</div>
                        <div style={styles.value}>{fmtTime(data?.consultationTime)}</div>
                      </div>

                      <div style={styles.row}>
                        <div style={styles.label}>증상</div>
                        <div style={styles.value}>{renderAny(data?.symptom)}</div>
                      </div>

                      <div style={styles.row}>
                        <div style={styles.label}>의사 소견</div>
                        <div style={styles.value}>{renderAny(data?.impression)}</div>
                      </div>

                      <div style={styles.row}>
                        <div style={styles.label}>처방 / 안내</div>
                        <div style={styles.value}>{renderAny(data?.prescription)}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function ChatBubble({ role, text }) {
  const isPatient = role === "patient";
  const bubbleStyle = isPatient ? styles.bubblePatient : styles.bubbleDoctor;
  return <div style={bubbleStyle}>{text}</div>;
}

const styles = {
  page: {
    maxWidth: "100%",
    margin: "0 0 60px",
    padding: "0",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  chatCard: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,.08)",
    padding: 14,
    height: 560,
    display: "flex",
    flexDirection: "column",
  },
  chatScroll: {
    flex: 1,
    overflow: "auto",
    padding: "6px 8px 6px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  empty: {
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 20,
  },
  bubblePatient: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    background: "#E7F0FF",
    color: "#24355b",
    padding: "10px 14px",
    borderRadius: 18,
    borderBottomRightRadius: 8,
    lineHeight: 1.45,
    fontSize: 15,
  },
  bubbleDoctor: {
    alignSelf: "flex-start",
    maxWidth: "78%",
    background: "#FDE7E9",
    color: "#512b2c",
    padding: "10px 14px",
    borderRadius: 18,
    borderBottomLeftRadius: 8,
    lineHeight: 1.45,
    fontSize: 15,
  },
  reportCard: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,.08)",
    padding: 16,
    height: 560,
    display: "flex",
    flexDirection: "column",
  },
  reportTitle: {
    textAlign: "center",
    fontWeight: 800,
    color: "#3D46FF",
    marginBottom: 8,
  },
  reportLine: {
    height: 2,
    background: "#D7DBFF",
    margin: "0 8px 12px",
  },
  reportScroll: {
    flex: 1,
    overflow: "auto",
    padding: "0 6px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid #EEF0FF",
    borderRadius: 12,
    background: "#FAFBFF",
  },
  label: {
    fontWeight: 800,
    color: "#1F2937",
    alignSelf: "start",
  },
  value: {
    color: "#111827",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  muted: {
    color: "#9CA3AF",
  },
  ul: {
    margin: 0,
    paddingLeft: 18,
    lineHeight: 1.6,
  },
  kvWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  kvRow: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: 10,
  },
  kvKey: {
    color: "#6B7280",
    fontWeight: 700,
  },
  kvVal: {
    color: "#111827",
  },
  btnGhost: {
    height: 38,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    background: "#fff",
    cursor: "pointer",
  },
};
