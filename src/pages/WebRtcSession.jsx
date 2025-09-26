// src/pages/WebRtcSession.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
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
function ChatBubble({ role, me, text }) {
  if (role === "typing") {
    return (
      <div className="bubble bubble--typing">
        <span className="typing__dot"></span>
        <span className="typing__dot typing__dot--blue"></span>
        <span className="typing__dot"></span>
      </div>
    );
  }
  // 내 화면 기준 정렬: 내가 말한 건 왼쪽, 상대는 오른쪽
  const iAmDoctor = me === "ROLE_DOCTOR";
  const isMine =
    (iAmDoctor && role === "doctor") || (!iAmDoctor && role === "patient");
  const klass = isMine ? "bubble bubble--patient" : "bubble bubble--doctor";
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
  try {
    localStream?.getTracks?.().forEach((t) => pc.addTrack(t, localStream));
  } catch (err) {
    console.warn("[RTC] addTrack 실패:", err);
  }
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

/* ------------ MediaRecorder mime 탐색 ------------ */
function pickSupportedMime() {
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const t of cands) {
    try {
      if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    } catch (err) {
      console.debug("[pickSupportedMime] isTypeSupported 에러:", err);
    }
  }
  return "";
}

/* ===================================== */
export default function WebRtcSession() {
  // URL 파라미터/상태
  const { reservationId: ridParam } = useParams();
  const { state, search } = useLocation();
  const qp = new URLSearchParams(search);
  const roleHintParam = qp.get("role");
  const roleHint =
    (state && state.roleHint) ||
    (roleHintParam &&
      (roleHintParam.toLowerCase() === "doctor" ? "doctor" : "patient")) ||
    null;

  const selectedOptions = state?.interpretationOption || [];

  // 환자는 무조건 수어 인식 UI 보이게
  const enableSign =
    roleHint === "patient" ? true : selectedOptions.includes("SIGN_TO_TEXT");

  // 의사는 무조건 음성 인식 UI 보이게
  const enableVoice =
    roleHint === "doctor" ? true : selectedOptions.includes("VOICE_TO_TEXT");

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
  const [status, setStatus] = useState("");
  const [roomId, setRoomId] = useState("");
  const [iceServers, setIceServers] = useState([]);

  // 미디어/WebRTC Ref
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const signalingRef = useRef(null);
  const dataChannelRef = useRef(null);

  // 채팅 리스트
  const [messages, setMessages] = useState([]);
  const chatRef = useRef(null);

  // 환자 입력/인식
  const [recognizedText, setRecognizedText] = useState("");
  const [liveSignWord, setLiveSignWord] = useState("");

  // 입력/인식 Ref
  const sttRef = useRef(null);
  const [sttOn, setSttOn] = useState(false);
  const iceLoggedRef = useRef(false);
  const mediaRecRef = useRef({ rec: null, chunks: [] });

  // ===== 메시지 중복 방지 & 마지막 버블 교체 =====
  const normalize = (s = "") =>
    s.replace(/\s+/g, " ").replace(/[.?!]+$/, "").trim();

  const pushOrReplace = (source, text) => {
    const t = normalize(text);
    if (!t) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === source) {
        if (normalize(last.text) === t) return prev; // 동일 문장: 무시
        return [...prev.slice(0, -1), { ...last, text }]; // 교체
      }
      return [...prev, { id: crypto.randomUUID(), role: source, text }]; // 다른 화자: 추가
    });
  };

  // 채팅 스크롤 유지
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // HandPose 콜백
  const handleLiveWord = (word) => setLiveSignWord(word || "");
  const handleRecognizedSentence = (text) => {
    if (text) setRecognizedText(text);
  };

  // 환자 자막 전송
  const handleSendPatientCaption = async () => {
    const text = recognizedText.trim();
    if (!text) return;
    sendCaption("patient", text);
    try {
      await sendSignTextToDB(roomId || reservationId, text);
      console.log(`[API OK] 수어 텍스트 저장 성공: "${text}"`);
    } catch (error) {
      console.error("[API FAIL] 수어 텍스트 저장 실패:", error);
    }
    setRecognizedText("");
  };

  // 로컬 미디어
  async function openCam(currentRole) {
    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      console.debug("[openCam] stop old tracks ignored:", e);
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
        console.debug("[openCam] video.play blocked:", e);
      }
    }
  }

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play?.().catch((e) =>
      console.debug("[attachRemoteStream] play() error:", e)
    );
  }

  function bindDataChannel(ch) {
    if (!ch) return;
    dataChannelRef.current = ch;
    ch.onopen = () => console.log("[DC] open");
    ch.onclose = () => console.log("[DC] close");
    ch.onerror = (e) => console.warn("[DC] error", e);
    ch.onmessage = (ev) => {
      let payload = ev.data;
      try {
        payload = JSON.parse(ev.data);
      } catch (e) {
        console.debug("[DC] non-JSON payload:", e);
      }
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "caption" && payload.text) {
        // 상대가 보낸 자막도 동일 규칙 적용
        pushOrReplace(payload.source, payload.text);
      }
    };
  }

  const sendCaption = useCallback((source, text) => {
    const t = (text || "").trim();
    if (!t) return;

    // 중복/교체 규칙
    pushOrReplace(source, t);

    // 데이터채널 브로드캐스트
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
    if (!api) {
      alert("먼저 참가하세요!");
      return;
    }
    const fixedKey = "peer";
    if (!peersRef.current.has(fixedKey)) {
      const pc = createPeer(localStreamRef.current, iceServers, {
        onTrack: (s) => attachRemoteStream(s),
        onIce: (ice) => {
          if (!iceLoggedRef.current) {
            console.log("[RTC] 첫 번째 ICE candidate:", ice);
            iceLoggedRef.current = true;
          }
          try {
            api.sendIce(null, ice);
          } catch (err) {
            console.warn("[SIG] sendIce 실패:", err);
          }
        },
        onDataChannel: bindDataChannel,
      });
      const dc = pc.createDataChannel("chat");
      bindDataChannel(dc);
      peersRef.current.set(fixedKey, pc);
      const offer = await makeOffer(pc);
      try {
        api.sendOffer(null, offer);
      } catch (err) {
        console.warn("[SIG] sendOffer 실패:", err);
      }
    }
  }

  const toggleDoctorSTT = useCallback(() => {
    if (role !== "ROLE_DOCTOR" || !sttRef.current) return;

    if (sttOn) {
      try {
        sttRef.current.stop();
      } catch (e) {
        console.debug("[STT] stop ignored:", e);
      }
      try {
        mediaRecRef.current?.rec?.stop();
      } catch (e) {
        console.debug("[REC] stop ignored:", e);
      }
      setSttOn(false);
      return;
    }

    try {
      sttRef.current.start({
        onText: (text) => sendCaption("doctor", text),
        onError: (err) => {    console.warn("STT 비동기 에러:", err);
          setSttOn(false);
          try { mediaRecRef.current?.rec?.stop(); }
         catch (e) { console.debug("[REC] stop on STT error ignored:", e); }
        },
       onEnd: () => {
          setSttOn(false);
          try { mediaRecRef.current?.rec?.stop(); }
          catch (e) { console.debug("[REC] stop on STT end ignored:", e); }
        },
      });
      setSttOn(true);

      const localStream = localStreamRef.current;
      if (!localStream || localStream.getAudioTracks().length === 0) {
        console.warn("녹음을 위한 오디오 트랙이 없습니다.");
        return;
      }

      const aTrack = localStream.getAudioTracks()[0];
      if (aTrack.readyState !== "live" || aTrack.enabled === false) {
        alert("마이크가 비활성화되어 있습니다. 권한/입력 장치를 확인해 주세요.");
        return;
      }

      // 오디오 트랙만 분리해서 별도 MediaStream 생성
      const recordStream = new MediaStream([aTrack]);

      const mimeType = pickSupportedMime();
      let rec;
      try {
        rec = mimeType
          ? new MediaRecorder(recordStream, { mimeType })
          : new MediaRecorder(recordStream);
      } catch (err) {
        alert(`녹음 장치를 초기화할 수 없습니다.\n(${err.message})`);
        return;
      }

      mediaRecRef.current = { rec, chunks: [] };

      rec.ondataavailable = (e) => {
        try {
          if (e.data && e.data.size > 0) mediaRecRef.current.chunks.push(e.data);
        } catch (err) {
          console.warn("[REC] ondataavailable 에러:", err);
        }
      };

      rec.onstop = async () => {
        try {
          const usedType = rec.mimeType || mimeType || "audio/webm";
          const audioBlob = new Blob(mediaRecRef.current.chunks, { type: usedType });
          console.log("[REC] stopped. size=", audioBlob.size, "type=", audioBlob.type);
          if (audioBlob.size > 200) {
            try {
              const res = await sendSpeechToDB(roomId || reservationId, audioBlob);
              console.log("[API OK] 의사 음성 업로드 성공");
             // 서버 STT(=DB 저장 완료) 결과로 마지막 의사 버블을 '최종 1개'로 정리
              const finalText = res?.text ?? res?.results ?? "";
              if (finalText) {
                pushOrReplace("doctor", finalText);
              }
            } catch (error) {
              console.error("[API FAIL] 의사 음성 업로드 실패:", error);
            }
          }
        } catch (err) {
          console.warn("[REC] onstop 처리 중 오류:", err);
        } finally {
          mediaRecRef.current = { rec: null, chunks: [] };
        }
      };

      try {
        rec.start(); // timeslice 인자 없이 시작 (호환성↑)
      } catch (err) {
        alert(`음성 인식을 시작할 수 없습니다.\n오류: ${err.message}`);
        setSttOn(false);
        return;
      }
    } catch (e) {
      alert(`음성 인식을 시작할 수 없습니다.\n오류: ${e.message}`);
      setSttOn(false);
    }
  }, [role, sttOn, sendCaption, roomId, reservationId]);

  async function joinAs(hint) {
    if (!reservationId) {
      alert("예약번호가 없습니다.");
      return;
    }
    let res;
    try {
      res = await joinReservation(reservationId, hint);
    } catch (err) {
      if (!ENABLE_GUEST_MODE || (err?.status && err.status !== 401)) {
        alert(err?.message || "예약 참가 실패");
        return;
      }
      // 게스트 모드
      res = {
        roomId: reservationId,
        role: hint === "doctor" ? "ROLE_DOCTOR" : "ROLE_PATIENT",
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
    setStatus(res.status);
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
              try {
                api.sendIce(null, ice);
              } catch (err) {
                console.warn("[SIG] sendIce 실패:", err);
              }
            },
            onDataChannel: bindDataChannel,
          });
          peersRef.current.set(fixedKey, pc);
        }
        try {
          await pc.setRemoteDescription(body);
          const answer = await makeAnswer(pc);
          api.sendAnswer(null, answer);
        } catch (err) {
          console.warn("[RTC] offer 처리 실패:", err);
        }
      },
      onAnswer: async ({ body }) => {
        try {
          const pc = peersRef.current.get("peer");
          if (pc) await pc.setRemoteDescription(body);
        } catch (err) {
          console.warn("[RTC] answer 처리 실패:", err);
        }
      },
      onIce: ({ body }) => {
        try {
          const pc = peersRef.current.get("peer");
          if (!pc) return;
          if (body == null) {
            pc.addIceCandidate(null).catch((e) =>
              console.debug("[ICE] add null candidate fail:", e)
            );
            return;
          }
          pc.addIceCandidate(new RTCIceCandidate(body)).catch((e) =>
            console.debug("[ICE] add candidate fail:", e)
          );
        } catch (err) {
          console.warn("[RTC] onIce 처리 실패:", err);
        }
      },
      onLeave: () => endCall(),
    });
    signalingRef.current = api;

    setupRealtimeInputs(res.role);

    // 자동 시작은 에러 원인이라 비활성 권장. 필요하면 주석 해제.
    // if (res.role === "ROLE_DOCTOR" && enableVoice) {
    //   setTimeout(() => { toggleDoctorSTT(); }, 500);
    // }
  }

  function setupRealtimeInputs(_role) {
    if (_role === "ROLE_DOCTOR") {
      if (!sttRef.current) {
        try {
          sttRef.current = createBrowserSTT({
            lang: "ko-KR",
            interimResults: true,
          });
        } catch (e) {
          console.warn("이 브라우저는 Web Speech API를 지원하지 않습니다.", e);
        }
      }
    } else {
      if (sttRef.current) {
        try {
          sttRef.current.stop();
        } catch (e) {
          console.debug("[STT] stop on role switch ignored:", e);
        }
      }
      setSttOn(false);
    }
  }

  const endCall = useCallback(async () => {
  try { mediaRecRef.current?.rec?.stop(); }
  catch (e) { console.debug("[REC] stop in endCall ignored:", e); }
  try { sttRef.current?.stop?.(); }
  catch (e) { console.debug("[STT] stop in endCall ignored:", e); }

    try {
      signalingRef.current?.sendLeave?.();
    } catch (e) {
      console.debug("[WS] sendLeave ignored:", e);
    }
    try {
      signalingRef.current?.close?.();
    } catch (e) {
      console.debug("[WS] close ignored:", e);
    }
    signalingRef.current = null;

    try {
      dataChannelRef.current?.close?.();
    } catch (e) {
      console.debug("[DC] close ignored:", e);
    }
    dataChannelRef.current = null;

    try {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    } catch (e) {
      console.debug("[RTC] peer close ignored:", e);
    }

    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      console.debug("[Media] tracks stop ignored:", e);
    }

    const lv = localVideoRef.current, rv = remoteVideoRef.current;
    if (lv) {
      try {
        lv.pause();
        lv.srcObject = null;
      } catch (e) {
        console.debug("[Video] local pause ignored:", e);
      }
    }
    if (rv) {
      try {
        rv.pause();
        rv.srcObject = null;
      } catch (e) {
        console.debug("[Video] remote pause ignored:", e);
      }
    }

    try {
      if (roomId) {
        await endSession(roomId);
      }
    } catch (e) {
      console.error("[API FAIL] 세션 종료 실패:", e);
    }

    setSttOn(false);
    iceLoggedRef.current = false;
    console.log("[RTC] call ended and resources cleaned");
  }, [roomId]);

  // 예약번호 파라미터
  useEffect(() => {
    if (ridParam) setReservationId(String(ridParam));
  }, [ridParam]);

  // 자동 참가
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!reservationId || autoJoinRef.current) return;
    autoJoinRef.current = true;
    const which = roleHint === "doctor" ? "doctor" : "patient";
    joinAs(which);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, roleHint]);

  return (
    <div className="visit">
      <Sidebar />
      <main className="visit__main">
        <h2>비대면(WebRTC)</h2>

        <div className="tele__toolbar">
          <div className="tele__room">
            <label className="tele__label">예약번호</label>
            <input
              className="tele__input"
              value={reservationId}
              disabled
              readOnly
            />
          </div>

          <div className="tele__actions">
            <button className="btn btn--primary" onClick={startCall}>
              진료 시작
            </button>
            <button className="btn" onClick={endCall}>
              종료
            </button>
          </div>

          <div className="tele__status">
            room: <b>{roomId || "-"}</b> / role: <b>{role || "-"}</b> / status:{" "}
            <b>{status || "-"}</b>
          </div>
        </div>

        <div className="tele__grid">
          {/* 좌측: 채팅 */}
          <section className="tele__chat">
            <div className="tele__chat__scroll" ref={chatRef}>
              {messages.map((m) => (
                <ChatBubble key={m.id} role={m.role} me={role} text={m.text} />
              ))}
            </div>

            {role === "ROLE_PATIENT" && (
              <div className="tele__sendbox">
                {enableSign && (
                  <div className="tele__cam_mini">
                    <HandPoseTracker
                      onSentence={handleRecognizedSentence}
                      onLive={handleLiveWord}
                      live={true}
                    />
                    <div className="tele__live_status">
                      {liveSignWord
                        ? `인식중: ${liveSignWord}`
                        : "수어 인식 대기 중..."}
                    </div>
                  </div>
                )}

                <div className="tele__sendrow">
                  <input
                    type="text"
                    className="tele__input"
                    placeholder="번역된 문장이 표시됩니다."
                    value={recognizedText}
                    onChange={(e) => setRecognizedText(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSendPatientCaption()
                    }
                  />
                  <button
                    className="btn btn--primary"
                    onClick={handleSendPatientCaption}
                  >
                    자막 전송
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 우측: 내 화면 + 상대 화면 */}
          <section className="tele__pane">
            <div className="tele__myvideo">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="tele__video tele__video--mine"
              />
            </div>

            <div className="tele__pip">
              <div className="tele__pip__label">상대 화면</div>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="tele__video tele__video--pip"
              />
            </div>

            {role === "ROLE_DOCTOR" && enableVoice && (
              <div className="tele__text__toolbar">
                <button
                  className={`btn ${sttOn ? "btn--primary" : "btn--ghost"}`}
                  onClick={toggleDoctorSTT}
                >
                  {sttOn ? "음성인식 중지" : "음성인식 시작"}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
