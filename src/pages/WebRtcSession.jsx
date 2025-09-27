// [코드 제목] WebRtcSession.jsx (의사 채팅 마이크 + 환자 단어/문장 UI + 종료 모달)
// 파일: src/pages/WebRtcSession.jsx

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { connectSignalingWS } from "../webrtc/signaling";
import { joinReservation } from "../services/reservation";
import { ENABLE_GUEST_MODE } from "../config";
import { createBrowserSTT } from "../services/stt";
import {
  sendSignTextToDB,
  sendSpeechToDB,
  endSession,
} from "../services/telemedicine";
import "./tele.css";
import HandPoseTracker from "../components/HandPoseTracker";

/* ------------ Chat Bubble ------------ */
function ChatBubble({ role, text, currentRole }) {
  if (role === "typing") {
    return (
      <div className="bubble bubble--typing">
        <span className="typing__dot"></span>
        <span className="typing__dot typing__dot--blue"></span>
        <span className="typing__dot"></span>
      </div>
    );
  }
  // 내 화면에서는 내가 보낸 메시지를 오른쪽 파란색(doctor 스타일)로,
  // 상대가 보낸 건 왼쪽 분홍색(patient 스타일)로 보이게.
  const me = currentRole === "ROLE_DOCTOR" ? "doctor" : "patient";
  const isMine = role === me;
  const klass = isMine ? "bubble bubble--doctor" : "bubble bubble--patient";
  return <div className={klass}>{text}</div>;
}

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
async function makeOffer(pc) {
  const o = await pc.createOffer();
  await pc.setLocalDescription(o);
  return o;
}
async function makeAnswer(pc) {
  const a = await pc.createAnswer();
  await pc.setLocalDescription(a);
  return a;
}

/* ===================================== */
export default function WebRtcSession() {
  // URL 파라미터/상태
  const { reservationId: ridParam } = useParams();
  const { state, search } = useLocation();
  const navigate = useNavigate();

  const qp = new URLSearchParams(search);
  const roleHintParam = qp.get("role");
  const roleHint =
    (state && state.roleHint) ||
    (roleHintParam &&
      (roleHintParam.toLowerCase() === "doctor" ? "doctor" : "patient")) ||
    null;

  const selectedOptions = state?.interpretationOption || [];

  // 환자: 수어 인식 표시
  const enableSign =
    roleHint === "patient" ? true : selectedOptions.includes("SIGN_TO_TEXT");

  // 의사: 음성 인식 표시
  const enableVoice =
    roleHint === "doctor" ? true : selectedOptions.includes("VOICE_TO_TEXT");

  // 세션 키
  const myKeyRef = useRef(null);
  if (!myKeyRef.current) {
    const saved = sessionStorage.getItem("tele_key");
    myKeyRef.current =
      saved ||
      (crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11));
    if (!saved) sessionStorage.setItem("tele_key", myKeyRef.current);
  }
  const myKey = myKeyRef.current;

  // 상태
  const [reservationId, setReservationId] = useState("");
  const [role, setRole] = useState("");
  const [roomId, setRoomId] = useState("");
  const [iceServers, setIceServers] = useState([]);

  // 종료 모달
  const [showEndModal, setShowEndModal] = useState(false);

  // 미디어/WebRTC
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const signalingRef = useRef(null);
  const dataChannelRef = useRef(null);

  // 채팅
  const [messages, setMessages] = useState([]);
  const chatRef = useRef(null);

  // 환자 입력 문장 + 실시간 단어
  const [recognizedText, setRecognizedText] = useState("");
  const [wsLive, setWsLive] = useState("");

  // STT
  const sttRef = useRef(null);
  const [sttOn, setSttOn] = useState(false);
  const iceLoggedRef = useRef(false);
  const mediaRecRef = useRef({ rec: null, chunks: [] });

  /* 채팅 스크롤 유지 */
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* 환자 자막 전송 */
  const handleSendPatientCaption = async () => {
    const text = recognizedText.trim();
    if (!text) return;
    sendCaption("patient", text);
    try {
      await sendSignTextToDB(roomId || reservationId, text);
    } catch (e) {
      void e;
    }
    setRecognizedText("");
  };

  /* 로컬 미디어 열기 */
  async function openCam(currentRole) {
    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      void e;
    }
    const constraints = { video: true, audio: currentRole === "ROLE_DOCTOR" };
    const s = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = s;

    const lv = localVideoRef.current;
    if (lv) {
      lv.srcObject = s;
      lv.muted = true;
      try {
        await lv.play();
      } catch (e) {
        void e;
      }
    }
  }

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play?.().catch((e) => {
      void e;
    });
  }

  function bindDataChannel(ch) {
    if (!ch) return;
    dataChannelRef.current = ch;
    ch.onopen = () => console.log("[DC] open]");
    ch.onclose = () => console.log("[DC] close]");
    ch.onerror = (err) => console.warn("[DC] error", err);
    ch.onmessage = (ev) => {
      let payload = ev.data;
      try {
        payload = JSON.parse(ev.data);
      } catch (e) {
        void e;
      }
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "caption" && payload.text) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: payload.source, text: payload.text },
        ]);
      }
    };
  }

  const sendCaption = useCallback((source, text) => {
    const t = (text || "").trim();
    if (!t) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: source, text: t },
    ]);
    const ch = dataChannelRef.current;
    const payload = { type: "caption", source, text: t, t: Date.now() };
    try {
      if (ch && ch.readyState === "open") ch.send(JSON.stringify(payload));
    } catch (e) {
      void e;
    }
  }, []);

  async function startCall() {
    const api = signalingRef.current;
    if (!api) return alert("먼저 참가하세요!");
    const fixedKey = "peer";
    if (!peersRef.current.has(fixedKey)) {
      const pc = createPeer(localStreamRef.current, iceServers, {
        onTrack: (s) => attachRemoteStream(s),
        onIce: (ice) => {
          if (!iceLoggedRef.current) {
            console.log("[RTC] 첫 번째 ICE candidate:", ice);
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

  /* 의사 STT 토글(지연생성) */
  const toggleDoctorSTT = useCallback(() => {
    if (role !== "ROLE_DOCTOR") return;

    if (!sttRef.current) {
      try {
        sttRef.current = createBrowserSTT({
          lang: "ko-KR",
          interimResults: true,
        });
      } catch (err) {
        console.warn("이 브라우저는 Web Speech API를 지원하지 않습니다.", err);
        return;
      }
    }

    if (sttOn) {
      try {
        sttRef.current.stop();
      } catch (e) {
        void e;
      }
      try {
        mediaRecRef.current?.rec?.stop();
      } catch (e) {
        void e;
      }
      setSttOn(false);
    } else {
      try {
        sttRef.current.start({
          onText: (text) => sendCaption("doctor", text),
          onError: (err) => {
            console.warn("STT 비동기 에러:", err);
            setSttOn(false);
          },
        });
        setSttOn(true);

        const stream = localStreamRef.current;
        if (!stream || stream.getAudioTracks().length === 0) {
          console.warn("녹음을 위한 오디오 트랙이 없습니다.");
          return;
        }
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecRef.current = { rec, chunks: [] };
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) mediaRecRef.current.chunks.push(e.data);
        };
        rec.onstop = async () => {
          const audioBlob = new Blob(mediaRecRef.current.chunks, {
            type: "audio/webm",
          });
          if (audioBlob.size > 1000) {
            try {
              await sendSpeechToDB(roomId || reservationId, audioBlob);
              console.log("[API OK] 의사 음성 업로드 성공");
            } catch (error) {
              console.error("[API FAIL] 의사 음성 업로드 실패:", error);
            }
          }
        };
        rec.start(2000);
      } catch (err) {
        alert(`음성 인식을 시작할 수 없습니다.\n오류: ${err.message}`);
        setSttOn(false);
      }
    }
  }, [role, sttOn, sendCaption, roomId, reservationId]);

  /* 참가 */
  async function joinAs(roleHint) {
    if (!reservationId) return alert("예약번호가 없습니다.");
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
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      };
    }

    setRoomId(res.roomId);
    setRole(res.role);
    setIceServers(res.iceServers || []);

    await openCam(res.role);

    const api = connectSignalingWS({
      wsUrl: res.wsUrl || "wss://handdoc.store/ws/signaling",
      roomId: res.roomId,
      myKey,
      onReady: () => {
        if (res.role === "ROLE_PATIENT") setTimeout(() => startCall(), 150);
      },
      onOffer: async ({ body }) => {
        const fixedKey = "peer";
        let pc = peersRef.current.get(fixedKey);
        if (!pc) {
          pc = createPeer(localStreamRef.current, res.iceServers || iceServers, {
            onTrack: (s) => attachRemoteStream(s),
            onIce: (ice) => {
              if (!iceLoggedRef.current) {
                console.log("[RTC] 첫 번째 ICE candidate:", ice);
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
        if (body == null) {
          pc.addIceCandidate(null).catch((e) => {
            void e;
          });
          return;
        }
        pc.addIceCandidate(new RTCIceCandidate(body)).catch((e) => {
          void e;
        });
      },
      onLeave: () => endCall(),
    });
    signalingRef.current = api;

    if (res.role === "ROLE_DOCTOR" && enableVoice) {
      setTimeout(() => {
        toggleDoctorSTT();
      }, 500);
    }
  }

  /* 종료 */
  const endCall = useCallback(async () => {
    if (sttOn) {
      try {
        mediaRecRef.current?.rec?.stop();
      } catch (e) {
        void e;
      }
      try {
        sttRef.current?.stop?.();
      } catch (e) {
        void e;
      }
    }

    try {
      signalingRef.current?.sendLeave?.();
    } catch (e) {
      void e;
    }
    try {
      signalingRef.current?.close?.();
    } catch (e) {
      void e;
    }
    signalingRef.current = null;

    try {
      dataChannelRef.current?.close?.();
    } catch (e) {
      void e;
    }
    dataChannelRef.current = null;

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      void e;
    }

    const lv = localVideoRef.current,
      rv = remoteVideoRef.current;
    if (lv) {
      try {
        lv.pause();
        lv.srcObject = null;
      } catch (e) {
        void e;
      }
    }
    if (rv) {
      try {
        rv.pause();
        rv.srcObject = null;
      } catch (e) {
        void e;
      }
    }

    try {
      if (roomId) await endSession(roomId);
    } catch (err) {
      console.error("[API FAIL] 세션 종료 실패:", err);
    }

    setSttOn(false);
    iceLoggedRef.current = false;
    console.log("[RTC] call ended and resources cleaned");
  }, [sttOn, roomId]);

  /* 예약번호 설정 */
  useEffect(() => {
    if (ridParam) setReservationId(String(ridParam));
  }, [ridParam]);

  /* 자동 참가 */
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!reservationId || autoJoinRef.current) return;
    autoJoinRef.current = true;
    const which = roleHint === "doctor" ? "doctor" : "patient";
    joinAs(which);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, roleHint]);

  /* ----- 종료 버튼/모달 핸들러 ----- */
  const onClickEnd = useCallback(() => {
    setShowEndModal(true);
  }, []);
  const onCancelEnd = useCallback(() => {
    setShowEndModal(false);
  }, []);

  // 모달 확인(종료) — 채팅 백업 + endCall + 비대면 요약 페이지 이동
  const onConfirmEnd = useCallback(async () => {
    // 채팅 백업(옵션)
    try {
      const id = roomId || reservationId;
      if (id) sessionStorage.setItem(`chat:${id}`, JSON.stringify(messages));
    } catch (e) {
      void e; // storage 불가시 무시
    }

    await endCall();
    const id = roomId || reservationId;
    navigate(`/telemed/summary/${id}`, { state: { messages } });
  }, [endCall, navigate, roomId, reservationId, messages]);

  return (
    <div className="visit">
      <Sidebar />
      <main className="visit__main">
        {/* 상단 종료 버튼 */}
        <div className="tele__topbar">
          <button
            className="tele__end_btn"
            type="button"
            onClick={onClickEnd}
            aria-label="진료 종료하기"
          >
            진료 종료하기
          </button>
        </div>

        <div className="tele__grid">
          {/* 좌측 채팅 */}
          <section className="tele__chat">
            <div className="tele__chat__scroll" ref={chatRef}>
              {messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  role={m.role}
                  text={m.text}
                  currentRole={role}
                />
              ))}
            </div>
            {role === "ROLE_DOCTOR" && (
              <div className="chat__mic">
                <button
                  className={`mic-btn ${sttOn ? "is-on" : ""}`}
                  onClick={toggleDoctorSTT}
                  title={sttOn ? "음성 인식 중지" : "마이크로 말하기"}
                >
                  {sttOn ? "⏹️" : "🎤"}
                </button>
              </div>
            )}
          </section>

          {/* 우측 영상 */}
          <section className="tele__pane">
            <div className="tele__myvideo">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="tele__video tele__video--mine"
              />

              <div className="tele__pip tele__pip--overlay">
                <div className="tele__pip__label">상대 화면</div>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="tele__video tele__video--pip"
                />
              </div>

              {role === "ROLE_PATIENT" && enableSign && (
                <div className="tele__pose_overlay">
                  <HandPoseTracker
                    live={true}
                    onLive={(w) => setWsLive(String(w || "").trim())}
                    onSentence={(s) => {
                      const t = String(s || "").trim();
                      if (t) setRecognizedText(t);
                    }}
                  />
                </div>
              )}

              {role === "ROLE_PATIENT" && enableSign && (
                <div className="tele__live_badge">
                  {wsLive ? `인식된 단어: ${wsLive}` : "수어 인식 대기 중..."}
                </div>
              )}

              {role === "ROLE_PATIENT" && enableSign && (
                <div className="tele__input_overlay">
                  <input
                    type="text"
                    className="tele__input tele__input--overlay"
                    placeholder="카메라를 보고 수화를 해 주세요"
                    value={recognizedText}
                    onChange={(e) => setRecognizedText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendPatientCaption()}
                  />
                  <button
                    className="tele__input_clear"
                    onClick={() => setRecognizedText("")}
                    aria-label="입력 지우기"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {role === "ROLE_PATIENT" && enableSign && (
              <button className="tele__send_big" onClick={handleSendPatientCaption}>
                전송하기
              </button>
            )}
          </section>
        </div>

        {/* 종료 모달 */}
        {showEndModal && (
          <div className="tele__end_modal__backdrop" role="presentation">
            <div
              className="tele__end_modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="endModalTitle"
              aria-describedby="endModalDesc"
            >
              <h3 id="endModalTitle" className="tele__end_modal__title">
                진료를 종료하시겠어요?
              </h3>
              <p id="endModalDesc" className="tele__end_modal__desc">
                종료 후에는 요약 페이지로 이동합니다.
              </p>

              <div className="tele__end_modal__actions">
                <button
                  type="button"
                  className="tele__end_modal__btn tele__end_modal__btn--outline"
                  onClick={onCancelEnd}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="tele__end_modal__btn tele__end_modal__btn--primary"
                  onClick={onConfirmEnd}
                >
                  종료
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
