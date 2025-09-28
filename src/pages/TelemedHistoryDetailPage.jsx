import "./visit.css";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getTelemedHistoryDetail } from "../services/telemedicine";

// 좌/우 말풍선
function ChatBubble({ role, text }) {
  const isPatient = role === "patient";
  const style = isPatient ? styles.bubblePatient : styles.bubbleDoctor;
  return <div style={style}>{text}</div>;
}

export default function TelemedHistoryDetailPage() {
  const { roomId } = useParams();

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getTelemedHistoryDetail(roomId);
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setErr(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId]);

  // 채팅 정규화: API 예시(results.chat.messages[].{sender,message,timestamp})
  const chatItems = useMemo(() => {
    const raw =
      data?.chat?.messages ??
      data?.chatMessages ??
      data?.messages ??
      data?.dialog ??
      [];

    const norm = [];
    for (const it of Array.isArray(raw) ? raw : []) {
      if (!it) continue;
      const role =
        String(it.sender || it.role || "").toUpperCase() === "PATIENT"
          ? "patient"
          : "doctor";
      const text = String(it.message ?? it.text ?? "").trim();
      if (!text) continue;
      const ts = it.timestamp ? Date.parse(it.timestamp) : Date.now();
      norm.push({
        id: it.id || `${role}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        text,
        ts: Number.isFinite(ts) ? ts : Date.now(),
      });
    }
    // 시간순 정렬
    norm.sort((a, b) => a.ts - b.ts);
    return norm;
  }, [data]);

  const fmtAny = (v) => {
    if (v == null) return <span style={styles.muted}>정보 없음</span>;
    if (Array.isArray(v)) {
      if (!v.length) return <span style={styles.muted}>정보 없음</span>;
      return (
        <ul style={styles.ul}>
          {v.map((x, i) => (
            <li key={i}>{String(x)}</li>
          ))}
        </ul>
      );
    }
    const s = String(v).trim();
    return s ? s : <span style={styles.muted}>정보 없음</span>;
  };

  const summary = data?.summary ?? data?.report ?? {};

  return (
    <div className="visit" style={{ "--sidebar-w": "220px" }}>
      <Sidebar />
      <main className="visit__main">
        <div className="vm__container">
          <div style={styles.grid}>
            {/* 좌측: 채팅 */}
            <div style={styles.chatCard}>
              <div style={styles.chatScroll}>
                {loading && <div style={styles.empty}>불러오는 중…</div>}
                {!loading && !!err && (
                  <div style={{ ...styles.empty, color: "#B42318" }}>
                    대화 내역을 불러오지 못했어요
                  </div>
                )}
                {!loading && !err && chatItems.length === 0 && (
                  <div style={styles.empty}>대화 내역이 없어요</div>
                )}
                {!loading &&
                  !err &&
                  chatItems.map((m) => (
                    <ChatBubble key={m.id} role={m.role} text={m.text} />
                  ))}
              </div>
            </div>

            {/* 우측: 요약 보고서 */}
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
                      <div style={styles.value}>
                        {fmtAny(summary?.consultationTime)}
                      </div>
                    </div>
                    <div style={styles.row}>
                      <div style={styles.label}>증상</div>
                      <div style={styles.value}>{fmtAny(summary?.symptom)}</div>
                    </div>
                    <div style={styles.row}>
                      <div style={styles.label}>의사 소견</div>
                      <div style={styles.value}>
                        {fmtAny(summary?.impression)}
                      </div>
                    </div>
                    <div style={styles.row}>
                      <div style={styles.label}>처방 / 안내</div>
                      <div style={styles.value}>
                        {fmtAny(summary?.prescription)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* 스타일(진료요약 페이지와 동일 톤) */
const styles = {
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
  muted: { color: "#9CA3AF" },
  ul: { margin: 0, paddingLeft: 18, lineHeight: 1.6 },
};