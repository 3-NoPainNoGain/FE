import { useEffect, useRef, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { connectSignalingWS } from "../webrtc/signaling";
import { joinReservation } from "../services/reservation";
import { ENABLE_GUEST_MODE } from "../config";
import { createBrowserSTT } from "../services/stt";
import "./tele.css";
import HandPoseTracker from "../components/HandPoseTracker";

/* ------------ Peer helpers ------------ */
function createPeer(localStream, iceServers, { onTrack, onIce, onDataChannel }) {
  const pc = new RTCPeerConnection({
    iceServers: iceServers?.length
      ? iceServers
      : [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
  });
  localStream?.getTracks?.().forEach((t) => pc.addTrack(t, localStream));
  pc.ontrack = (ev) => onTrack?.(ev.streams[0]);
  pc.onicecandidate = (ev) => {
    if (ev.candidate) onIce?.(ev.candidate);
  };
  pc.ondatachannel = (ev) => onDataChannel?.(ev.channel);
  return pc;
}
async function makeOffer(pc) { const o = await pc.createOffer(); await pc.setLocalDescription(o); return o; }
async function makeAnswer(pc) { const a = await pc.createAnswer(); await pc.setLocalDescription(a); return a; }

/* ===================================== */
export default function WebRtcSession() {
  const myKeyRef = useRef(null);
  if (!myKeyRef.current) {
    const saved = sessionStorage.getItem("tele_key");
    myKeyRef.current = saved || (crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11));
    if (!saved) sessionStorage.setItem("tele_key", myKeyRef.current);
  }
  const myKey = myKeyRef.current;

  const [reservationId, setReservationId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [iceServers, setIceServers] = useState([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const signalingRef = useRef(null);

  const dataChannelRef = useRef(null);

  const [doctorCaption, setDoctorCaption] = useState("");
  const [patientCaption, setPatientCaption] = useState("");

  const [recognizedText, setRecognizedText] = useState("");
  const [liveSignWord, setLiveSignWord] = useState("");

  const signWSRef = useRef(null);
  const sttRef = useRef(null);
  const [sttOn, setSttOn] = useState(false);

  const iceLoggedRef = useRef(false);
  
  const handleLiveWord = (word) => {
    setLiveSignWord(word || "");
  };

  const handleRecognizedSentence = (text) => {
    if (text) {
      setRecognizedText(text);
    }
  };

  const handleSendPatientCaption = () => {
    if (!recognizedText.trim()) return;
    sendCaption("patient", recognizedText);
    setRecognizedText("");
  };

  async function openCam(currentRole) {
    try { localStreamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch { /* noop */ }
    const constraints = { video: true, audio: currentRole === "ROLE_DOCTOR" };
    console.log(`[Media] 미디어 요청:`, constraints);
    const s = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = s;
    const v = localVideoRef.current;
    if (v) {
      v.srcObject = s; v.muted = true;
      try { await v.play(); } catch { /* 자동재생은 사용자 인터랙션이 필요할 수 있음 */ }
    }
  }

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play?.().catch(() => { /* noop */ });
  }

  function bindDataChannel(ch) {
    if (!ch) return;
    dataChannelRef.current = ch;
    ch.onopen = () => console.log("[DC] open");
    ch.onclose = () => console.log("[DC] close");
    ch.onerror = (e) => console.warn("[DC] error", e);
    ch.onmessage = (ev) => {
      let payload = ev.data;
      try { payload = JSON.parse(ev.data); } catch { /* noop */ }
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "caption" && payload.text) {
        if (payload.source === "doctor") setDoctorCaption(payload.text);
        else if (payload.source === "patient") setPatientCaption(payload.text);
      }
    };
  }
  
  const sendCaption = useCallback((source, text) => {
    const t = (text || "").trim();
    if (!t) return;
    if (source === "doctor") setDoctorCaption(t);
    if (source === "patient") setPatientCaption(t);
    const ch = dataChannelRef.current;
    const payload = { type: "caption", source, text: t, t: Date.now() };
    try {
      if (ch && ch.readyState === "open") ch.send(JSON.stringify(payload));
    } catch (e) {
      console.debug("[DC] send error:", e);
    }
  }, []);

  async function startCall() {
    const api = signalingRef.current;
    if (!api) return alert("먼저 참가하세요!");
    const fixedKey = "peer";
    if (!peersRef.current.has(fixedKey)) {
      const pc = createPeer( localStreamRef.current, iceServers, {
        onTrack: (s) => attachRemoteStream(s),
        onIce: (ice) => {
          if (!iceLoggedRef.current) {
            console.log("[RTC] local ICE candidate (first)");
            iceLoggedRef.current = true;
          }
          api.sendIce(null, ice);
        },
        onDataChannel: bindDataChannel,
      });
      const dc = pc.createDataChannel("chat");
      bindDataChannel(dc);
      peersRef.current.set(fixedKey, pc);
      const offer = await makeOffer(pc);
      api.sendOffer(null, offer);
    }
  }

  const toggleDoctorSTT = useCallback(() => {
    if (role !== "ROLE_DOCTOR") return;
    if (!sttRef.current) { alert("이 브라우저는 STT를 지원하지 않습니다."); return; }
    if (!sttOn) {
      try {
        let last = 0;
        sttRef.current.start({
          onText: (text) => {
            const now = Date.now();
            if (now - last > 300) {
              last = now;
              sendCaption("doctor", text);
            }
          },
          onError: (err) => { console.warn("STT 비동기 에러:", err); setSttOn(false); },
        });
        setSttOn(true);
      } catch (e) {
        console.error("STT 시작 실패:", e);
        alert(`음성 인식을 시작할 수 없습니다.\n마이크 권한을 확인해주세요.\n\n오류: ${e.message}`);
        setSttOn(false);
      }
    } else {
      try { sttRef.current.stop(); } catch { /* noop */ }
      setSttOn(false);
    }
  }, [role, sttOn, sendCaption]);

  async function joinAs(roleHint) {
    if (!reservationId) return alert("예약번호를 입력해주세요!");
    let res;
    try {
      res = await joinReservation(reservationId, roleHint);
    } catch (err) {
      if (!ENABLE_GUEST_MODE || (err.status && err.status !== 401)) {
        return alert(err.message || "예약 참가 실패");
      }
      res = {
        roomId: reservationId,
        role: roleHint === "doctor" ? "ROLE_DOCTOR" : "ROLE_PATIENT",
        status: "GUEST",
        wsUrl: "wss://handdoc.store/ws/signaling",
        iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" } ],
      };
    }
    setRoomId(res.roomId);
    setRole(res.role);
    setStatus(res.status);
    setIceServers(res.iceServers || []);
    await openCam(res.role);
    const api = connectSignalingWS({
      wsUrl: res.wsUrl || "wss://handdoc.store/ws/signaling",
      roomId: res.roomId, myKey,
      onReady: () => { if (res.role === "ROLE_PATIENT") setTimeout(() => startCall(), 150); },
      onOffer: async ({ body }) => {
        const fixedKey = "peer";
        let pc = peersRef.current.get(fixedKey);
        if (!pc) {
          pc = createPeer( localStreamRef.current, res.iceServers || iceServers, {
            onTrack: (s) => attachRemoteStream(s),
            onIce: (ice) => {
              if (!iceLoggedRef.current) {
                console.log("[RTC] local ICE candidate (first)");
                iceLoggedRef.current = true;
              }
              api.sendIce(null, ice);
            },
            onDataChannel: bindDataChannel,
          });
          peersRef.current.set(fixedKey, pc);
        }
        await pc.setRemoteDescription(body);
        const answer = await makeAnswer(pc);
        api.sendAnswer(null, answer);
      },
      onAnswer: async ({ body }) => {
        const pc = peersRef.current.get("peer");
        if (pc) await pc.setRemoteDescription(body);
      },
      onIce: ({ body }) => {
        const pc = peersRef.current.get("peer");
        if (!pc) return;
        if (body == null) { pc.addIceCandidate(null).catch(() => { /* ignore */ }); return; }
        pc.addIceCandidate(new RTCIceCandidate(body)).catch(() => { /* ignore */ });
      },
      onLeave: () => endCall(),
    });
    signalingRef.current = api;
    setupRealtimeInputs(res.role);
    if (res.role === 'ROLE_DOCTOR') {
      setTimeout(() => {
        console.log("[STT] 의사 역할 확인, 음성인식 자동 시작");
        toggleDoctorSTT();
      }, 500);
    }
  }

  function setupRealtimeInputs(_role) {
    if (_role === "ROLE_PATIENT") {
      try { signWSRef.current?.close?.(); } catch { /* noop */ }
      signWSRef.current = null;
    } else {
      try { signWSRef.current?.close?.(); } catch { /* noop */ }
      signWSRef.current = null;
    }
    if (_role === "ROLE_DOCTOR") {
      if (!sttRef.current) {
        try {
          sttRef.current = createBrowserSTT({ lang: "ko-KR", interimResults: true });
        } catch (e) {
          console.warn("이 브라우저는 Web Speech API를 지원하지 않습니다.", e);
        }
      }
    } else {
      if (sttRef.current) {
        try { sttRef.current.stop(); } catch { /* noop */ }
      }
      setSttOn(false);
    }
  }

  const endCall = useCallback(() => {
    try { signalingRef.current?.sendLeave?.(); } catch { /* noop */ }
    try { signalingRef.current?.close?.(); } catch { /* noop */ }
    signalingRef.current = null;
    try { dataChannelRef.current?.close?.(); } catch { /* noop */ }
    dataChannelRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    try { localStreamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch { /* noop */ }
    const lv = localVideoRef.current, rv = remoteVideoRef.current;
    if (lv) { try { lv.pause(); lv.srcObject = null; } catch { /* noop */ } }
    if (rv) { try { rv.pause(); rv.srcObject = null; } catch { /* noop */ } }
    try { signWSRef.current?.close?.(); } catch { /* noop */ }
    signWSRef.current = null;
    if (sttOn) { try { sttRef.current?.stop?.(); } catch { /* noop */ } setSttOn(false); }
    setDoctorCaption("");
    setPatientCaption("");
    iceLoggedRef.current = false;
    console.log("[RTC] call ended and resources cleaned");
  }, [sttOn]);

  useEffect(() => {
    const handler = () => {
      try { signalingRef.current?.sendLeave?.(); } catch { /* noop */ }
      endCall();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [endCall]);

  useEffect(() => () => endCall(), []);

  const leftCaption = role === "ROLE_DOCTOR" ? doctorCaption : patientCaption;
  const rightCaption = role === "ROLE_DOCTOR" ? patientCaption : doctorCaption;

  return (
    <div className="visit">
      <Sidebar />
      <main className="visit__main">
        <h2>비대면(WebRTC) /tele</h2>
        <div className="tele__toolbar">
          <div className="tele__room">
            <label className="tele__label">예약번호</label>
            <input className="tele__input" placeholder="예: 123" value={reservationId} onChange={(e) => setReservationId(e.target.value)} />
          </div>
          <div className="tele__actions">
            <button className="btn btn--ghost" onClick={() => joinAs("patient")}>환자로 참가</button>
            <button className="btn btn--ghost" onClick={() => joinAs("doctor")}>의사로 참가</button>
            <button className="btn btn--primary" onClick={startCall}>진료 시작</button>
            <button className="btn" onClick={endCall}>종료</button>
          </div>
          <div className="tele__status"> room: <b>{roomId || "-"}</b> / role: <b>{role || "-"}</b> / status: <b>{status || "-"}</b> </div>
        </div>
        <div className="tele__videos">
          <section className="tele__panel">
            <header className="tele__panel__title">내 화면</header>
            <div className="tele__video__frame">
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px", display: role === "ROLE_PATIENT" ? "none" : "block" }} />
              {role === "ROLE_PATIENT" && (
                <HandPoseTracker
                  onSentence={handleRecognizedSentence}
                  onLive={handleLiveWord}
                  live={true}
                />
              )}
              {role === "ROLE_PATIENT" && (
                <div className="tele__live_status">
                  {liveSignWord ? `인식중: ${liveSignWord}` : '수어 인식 대기 중...'}
                </div>
              )}
            </div>
            <div className="tele__caption">{leftCaption || "\u00A0"}</div>
          </section>
          <section className="tele__panel">
            <header className="tele__panel__title">상대 화면</header>
            <div className="tele__video__frame">
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }} />
            </div>
            <div className="tele__caption">{rightCaption || "\u00A0"}</div>
          </section>
        </div>
        {role === "ROLE_PATIENT" && (
          <div className="tele__patient__input_area">
            <input
              type="text"
              className="tele__input"
              placeholder="이곳에 번역된 수어 문장이 표시됩니다."
              value={recognizedText}
              onChange={(e) => setRecognizedText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendPatientCaption()}
            />
            <button className="btn btn--primary" onClick={handleSendPatientCaption}> 자막 전송 </button>
          </div>
        )}
        <div className="tele__text__toolbar">
          {role === "ROLE_DOCTOR" && (
            <button className={`btn ${sttOn ? "btn--primary" : "btn--ghost"}`} onClick={toggleDoctorSTT}>
              {sttOn ? "음성인식 중지" : "음성인식 시작"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}