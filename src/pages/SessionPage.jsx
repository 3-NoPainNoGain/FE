// src/pages/SummaryPage.jsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getDiagnosisSummary } from "../services/diagnosis.js";

const MAX_BACKOFF_MS = 30000;

/** 서버 응답을 "그대로" 화면에 뿌리되, 형태에 따라 보기 좋게 가공 */
function toDisplayString(payload) {
  // 1) 문자열이면 그대로
  if (typeof payload === "string") return payload;

  // 2) 배열이면 줄바꿈으로 연결 (문자/객체 혼재 대응)
  if (Array.isArray(payload)) {
    return payload
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2)))
      .join("\n\n");
  }

  // 3) 객체일 때 흔한 키에 요약 텍스트가 담겨 있으면 그걸 우선 사용
  const candidates = [
    "summary",
    "content",
    "text",
    "result",
    "results",
    "message",
  ];
  for (const key of candidates) {
    const v = payload?.[key];
    if (!v) continue;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
      return v
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x, null, 2)))
        .join("\n\n");
    }
  }

  // 4) 그 외에는 원본 JSON을 pretty print
  return JSON.stringify(payload, null, 2);
}

export default function SummaryPage() {
  const { diagnosisId } = useParams();
  const [state, setState] = useState({
    loading: true,
    data: null, // 서버 원본
    empty: false,
    error: null,
    retrying: false,
  });

  const backoffRef = useRef(1500);
  const retryTimer = useRef(null);

  const clearRetry = () => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };

  const fetchOnce = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await getDiagnosisSummary(diagnosisId); // 서버 원본 그대로
      if (!res) {
        setState({
          loading: false,
          data: null,
          empty: true,
          error: null,
          retrying: false,
        });
        clearRetry();
        backoffRef.current = 1500;
        return;
      }
      setState({
        loading: false,
        data: res,
        empty: false,
        error: null,
        retrying: false,
      });
      clearRetry();
      backoffRef.current = 1500;
    } catch (e) {
      const status = e?.status;
      const message = e?.message || "요약 조회 중 오류가 발생했어요.";
      setState((s) => ({
        ...s,
        loading: false,
        error: { status, message },
        retrying: true,
      }));

      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
      retryTimer.current = setTimeout(() => {
        backoffRef.current = Math.min(
          Math.floor(backoffRef.current * 1.5),
          MAX_BACKOFF_MS
        );
        fetchOnce();
      }, delay);
    }
  };

  useEffect(() => {
    fetchOnce();
    return () => clearRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosisId]);

  const handleCopy = async () => {
    try {
      const text = toDisplayString(state.data);
      await navigator.clipboard.writeText(text);
      alert("요약본을 클립보드에 복사했어요.");
    } catch {
      alert("복사에 실패했어요.");
    }
  };

  const handleDownload = () => {
    const text = toDisplayString(state.data);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnosis-summary-${diagnosisId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state.loading) {
    return (
      <PageWrap>
        <h3>요약을 불러오는 중…</h3>
      </PageWrap>
    );
  }

  if (state.error && !state.retrying) {
    return (
      <PageWrap>
        <h3>요약을 불러오지 못했어요</h3>
        <p style={{ color: "#d33", whiteSpace: "pre-wrap" }}>
          {state.error.message}
        </p>
        <button style={btn} onClick={() => { backoffRef.current = 1500; fetchOnce(); }}>
          다시 시도
        </button>
      </PageWrap>
    );
  }

  if (state.empty) {
    return (
      <PageWrap>
        <h3>요약이 아직 없어요</h3>
        <p>진료 대화가 저장되지 않았거나 요약 생성이 아직 진행 중일 수 있어요.</p>
        <button style={btn} onClick={() => { backoffRef.current = 1500; fetchOnce(); }}>
          다시 확인
        </button>
      </PageWrap>
    );
  }

  const display = toDisplayString(state.data);

  return (
    <PageWrap>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0 }}>진료 요약 (원문)</h2>
        <button style={{ ...btn, padding: "6px 10px" }} onClick={handleCopy}>
          복사
        </button>
        <button style={{ ...btn, padding: "6px 10px" }} onClick={handleDownload}>
          다운로드
        </button>
      </div>

      {/* 원문 표시: 텍스트면 그대로, JSON이면 pretty print 그대로 */}
      <pre
        style={{
          marginTop: 12,
          background: "#fafafa",
          borderRadius: 10,
          padding: 16,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.6,
          maxHeight: 600,
          overflow: "auto",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {display}
      </pre>

      {state.retrying && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          서버 상태에 따라 자동으로 다시 시도합니다…
        </p>
      )}
    </PageWrap>
  );
}

/* ------------------ UI helpers ------------------ */

function PageWrap({ children }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20 }}>
      {children}
    </div>
  );
}

const btn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #ddd",
  cursor: "pointer",
  background: "#fff",
};
