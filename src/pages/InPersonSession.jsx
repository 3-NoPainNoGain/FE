import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sendSignText, endDiagnosisSession, uploadDiagnosisSpeech } from "../services/diagnosis.js";
import { createBrowserSTT } from "../services/stt.js";
import HandPoseTracker from "../components/HandPoseTracker";
import Sidebar from "../components/Sidebar";

import "./session.css";

function ChatBubble({ role, text }) {
  if (role === "typing") {
    return (
      <div className="bubble bubble--typing">
        <span className="typing__dot"></span>
        <span className="typing__dot typing__dot--blue"></span>
        <span className="typing__dot"></span>
      </div>
    );
  }
  const klass = role === "patient" ? "bubble bubble--patient" : "bubble bubble--doctor";
  return <div className={klass}>{text}</div>;
}

export default function InPersonSession() {
  const navigate = useNavigate();
  const { diagnosisId } = useParams();

  const [messages, setMessages] = useState([]);
  const chatRef = useRef(null);
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 채팅 백업
  useEffect(() => {
    if (!diagnosisId) return;
    const compact = messages.map((m) => ({ id: m.id, role: m.role, text: m.text }));
    try {
      sessionStorage.setItem(`chat:${diagnosisId}`, JSON.stringify(compact));
    } catch (e) {
      console.debug("sessionStorage backup skipped:", e);
    }
  }, [messages, diagnosisId]);

  const sttRef = useRef(null);
  const mediaRef = useRef({ stream: null, rec: null, chunks: [] });
  const [isRec, setIsRec] = useState(false);
  const sttFinalRef = useRef("");

  useEffect(() => {
    try {
      sttRef.current = createBrowserSTT({ lang: "ko-KR", interimResults: true });
    } catch (e) {
      console.warn("브라우저 STT 미지원:", e?.message || e);
    }
  }, []);

  const stopAll = () => {
    try { mediaRef.current.rec?.stop(); } catch (e) { console.debug("rec.stop() ignored:", e); }
    try { sttRef.current?.stop?.(); } catch (e) { console.debug("stt.stop() ignored:", e); }
    try { mediaRef.current.stream?.getTracks()?.forEach((t) => t.stop()); } catch (e) { console.debug("track.stop() ignored:", e); }
  };

  const onMicClick = async () => {
    if (isRec) { stopAll(); return; }

    const bubbleId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: bubbleId, role: "typing", text: "듣는 중..." }]);
    sttFinalRef.current = "";

    try {
      sttRef.current?.start({
        onText: (text) => { sttFinalRef.current = String(text || "").trim(); },
        onError: (e) => console.warn("STT error:", e),
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = { stream, rec, chunks: [] };

      rec.ondataavailable = (ev) => {
        if (ev?.data && ev.data.size > 0) mediaRef.current.chunks.push(ev.data);
      };

      rec.onstop = async () => {
        try { mediaRef.current.stream?.getTracks()?.forEach((t) => t.stop()); } catch (e) { console.debug("stream tracks stop ignored:", e); }

        const clientText = sttFinalRef.current;
        setMessages((prev) =>
          prev.map((m) => (m.id === bubbleId ? { id: bubbleId, role: "doctor", text: clientText || "(인식 결과 없음)" } : m))
        );

        try {
          const blob = new Blob(mediaRef.current.chunks, { type: "audio/webm" });
          mediaRef.current = { stream: null, rec: null, chunks: [] };
          const res = await uploadDiagnosisSpeech(diagnosisId, blob);
          const serverText = String(res?.text || "").trim();
          if (serverText && serverText !== clientText) {
            setMessages((prev) =>
              prev.map((m) => (m.id === bubbleId ? { id: bubbleId, role: "doctor", text: serverText } : m))
            );
          }
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "doctor", text: `음성 업로드 오류: ${e?.response?.status || ""} ${e?.message || e}` },
          ]);
        } finally {
          setIsRec(false);
        }
      };

      rec.start(100);
      setIsRec(true);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== bubbleId));
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "doctor", text: `마이크 오류: ${e?.message || e}` }]);
      setIsRec(false);
      stopAll();
    }
  };

  const [input, setInput] = useState("");
  const [wsLive, setWsLive] = useState("");

  const handleLiveWord = (w) => {
    const liveWord = String(w || "").trim();
    setWsLive(liveWord);
    if (liveWord) console.log("[live]", liveWord);
  };

  const onChangeInput = (e) => {
  setInput(e.target.value);
  // 사용자가 입력 중이어도 sentence는 덮어쓰길 원하면 아래 줄 유지 X
  // setAllowAutoFill(false);
};

const handleRecognizedSentence = (s) => {
  const sentence = String(s || "").trim();
  if (sentence) console.log("[sentence]", sentence);
  if (sentence) setInput(sentence);   // 요구사항: 입력창엔 sentence만 자동 입력
};

  const onSendClick = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "patient", text }]);
    setInput(""); 
    try { await sendSignText(diagnosisId, text); }
    catch (e) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "doctor", text: `전송 오류: ${e?.message || e}` }]);
    }
  };

  // ========= 종료 =========
  const [openEnd, setOpenEnd] = useState(false);
  const onEndConfirm = async () => {
    try {
      const res = await endDiagnosisSession(diagnosisId);
      if (res?.isSuccess === false) throw new Error(res?.message || "진료 종료 실패");
      navigate(`/session/${diagnosisId}/summary`, { replace: true, state: { messages } });
    } catch (e) {
      alert(`진료 종료에 실패했어요.\n요청: /api/v1/diagnosis/${diagnosisId}/end\n사유: ${e?.message || e}`);
    }
  };

  return (
    <div className="session">
      <Sidebar />

      <main className="sess__main">
        <div className="sess__toolbar">
          <button className="btn-outline" onClick={() => setOpenEnd(true)}>진료 종료하기</button>
        </div>

        <div className="sess__grid">
          {/* 좌측: 채팅 */}
          <section className="chat">
            <div className="chat__scroll" ref={chatRef}>
              {messages.map((m) => <ChatBubble key={m.id} role={m.role} text={m.text} />)}
            </div>
            <div className="chat__mic">
              <button
                className={`mic-btn ${isRec ? "is-on" : ""}`}
                onClick={onMicClick}
                title={isRec ? "녹음 중지" : "마이크로 말하기"}
              >
                {isRec ? "⏹️" : "🎤"}
              </button>
            </div>
          </section>

          {/* 우측: 카메라 + 입력 + 전송 */}
          <section className="pane">
            <div className="cam">
              {/* ✅ live 전달: false면 전송 루프만 멈춤(WS 유지) */}
              <HandPoseTracker
   onSentence={handleRecognizedSentence}
   onLive={handleLiveWord}
 />
              <div className="cam-status">
                {wsLive ? `인식된 단어: ${wsLive}` : "수어 인식 대기 중..."}
              </div>
            </div>

            <div className="sendbox">
              <input
                className="sendbox__input"
                value={input}
                onChange={onChangeInput}
                placeholder="카메라를 보고 수화를 해 주세요"
                onKeyDown={(e) => e.key === "Enter" && onSendClick()}
              />
              <button
                className="sendbox__clear"
                onClick={() => { setInput(""); }}
                aria-label="입력 지우기"
              >×</button>
            </div>

            <button className="btn-primary" onClick={onSendClick}>전송하기</button>

          </section>
        </div>
      </main>

      {openEnd && (
        <div className="modal__backdrop" onClick={() => setOpenEnd(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">진료를 종료하시겠어요?</div>
            <div className="modal__desc">종료 후에는 요약 페이지로 이동합니다.</div>
            <div className="modal__actions">
              <button className="modal__btn btn-outline" onClick={() => setOpenEnd(false)}>취소</button>
              <button className="modal__btn btn-primary" onClick={onEndConfirm}>종료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
