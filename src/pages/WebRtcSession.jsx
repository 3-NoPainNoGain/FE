import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { connectSignalingWS } from "../webrtc/signaling";
import { joinReservation } from "../services/reservation";
import { ENABLE_GUEST_MODE } from "../config";
import { createBrowserSTT } from "../services/stt";
import { sendSignTextToDB, sendSpeechToDB } from "../services/telemedicine";
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
  const { state, search } = useLocation(); // state.roleHint 또는 ?role=doctor
  const qp = new URLSearchParams(search);
  const roleHintParam = qp.get("role");
  const roleHint =
    (state && state.roleHint) ||
    (roleHintParam && (roleHintParam.toLowerCase() === "doctor" ? "doctor" : "patient")) ||
    null;

  const selectedOptions = state?.interpretationOption || [];
  const enableSign = selectedOptions.includes("SIGN_TO_TEXT");
  const enableVoice = selectedOptions.includes("VOICE_TO_TEXT");

  // 내 세션 키 (탭당 고유)
  const myKeyRef = useRef(null);
  if (!myKeyRef.current) {
    const saved = sessionStorage.getItem("tele_key");
    myKeyRef.current =
      saved || (crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11));
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

  // 자막 상태
  const [doctorCaption, setDoctorCaption] = useState("");
  const [patientCaption, setPatientCaption] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [liveSignWord, setLiveSignWord] = useState("");

  // 입력/인식 Ref
  const sttRef = useRef(null);
  const [sttOn, setSttOn] = useState(false);
  const iceLoggedRef = useRef(false);
  const mediaRecRef = useRef({ rec: null, chunks: [] });

  // HandPose 콜백
  const handleLiveWord = (word) => setLiveSignWord(word || "");
  const handleRecognizedSentence = (text) => {
    if (text) setRecognizedText(text);
  };

  // 환자 자막 전송 (수어→텍스트)
  const handleSendPatientCaption = async () => {
    const text = recognizedText.trim();
    if (!text) return;
    sendCaption("patient", text);
    try {
      await sendSignTextToDB(roomId || reservationId, text);
      console.log(`[API] 수어 텍스트 저장 성공: "${text}"`);
    } catch (error) {
      console.error("[API] 수어 텍스트 저장 실패:", error);
    }
    setRecognizedText("");
  };

  // 로컬 미디어
  async function openCam(currentRole) {
    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      // ignore cleanup error (noop)
    }
    // 의사: 오디오+비디오, 환자: 비디오만
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
        // autoplay may be blocked; safe to ignore
      }
    }
  }

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play?.().catch(() => {
      /* noop */
    });
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
        // ignore malformed message
      }
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

  const toggleDoctorSTT = useCallback(() => {
    if (role !== "ROLE_DOCTOR" || !sttRef.current) return;
    if (sttOn) {
      try {
        sttRef.current.stop();
      } catch (e) {
        // noop
      }
      try {
        mediaRecRef.current?.rec?.stop();
      } catch (e) {
        // noop
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

        // 의사 음성 녹음 → 서버 저장
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
          const audioBlob = new Blob(mediaRecRef.current.chunks, { type: "audio/webm" });
          if (audioBlob.size > 1000) {
            try {
              await sendSpeechToDB(roomId || reservationId, audioBlob);
              console.log("[API] 음성 전송 및 저장 성공");
            } catch (error) {
              console.error("[API] 음성 전송 실패:", error);
            }
          }
        };
        rec.start(2000);
      } catch (e) {
        alert(`음성 인식을 시작할 수 없습니다.\n오류: ${e.message}`);
        setSttOn(false);
      }
    }
  }, [role, sttOn, sendCaption, roomId, reservationId]);

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
    setStatus(res.status);
    setIceServers(res.iceServers || []);

    await openCam(res.role);

    const api = connectSignalingWS({
      wsUrl: res.wsUrl || "wss://handdoc.store/ws/signaling",
      roomId: res.roomId,
      myKey,
      onReady: () => {
        // 환자 쪽은 Offer 쏘기 시작
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
          pc.addIceCandidate(null).catch(() => {
            /* noop */
          });
          return;
        }
        pc.addIceCandidate(new RTCIceCandidate(body)).catch(() => {
          /* noop */
        });
      },
      onLeave: () => endCall(),
    });
    signalingRef.current = api;

    // 입력 소스 초기화 (의사: STT 준비)
    setupRealtimeInputs(res.role);

    // 의사 자동 STT 시작은 VOICE_TO_TEXT를 선택했을 때만
    if (res.role === "ROLE_DOCTOR" && enableVoice) {
      setTimeout(() => {
        toggleDoctorSTT();
      }, 500);
    }
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
          // noop
        }
      }
      setSttOn(false);
    }
  }

  const endCall = useCallback(() => {
    if (sttOn) {
      try {
        mediaRecRef.current?.rec?.stop();
      } catch (e) {
        // noop
      }
      try {
        sttRef.current?.stop?.();
      } catch (e) {
        // noop
      }
    }

    try {
      signalingRef.current?.sendLeave?.();
    } catch (e) {
      // noop
    }
    try {
      signalingRef.current?.close?.();
    } catch (e) {
      // noop
    }
    signalingRef.current = null;

    try {
      dataChannelRef.current?.close?.();
    } catch (e) {
      // noop
    }
    dataChannelRef.current = null;

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (e) {
      // noop
    }

    const lv = localVideoRef.current,
      rv = remoteVideoRef.current;
    if (lv) {
      try {
        lv.pause();
        lv.srcObject = null;
      } catch (e) {
        // noop
      }
    }
    if (rv) {
      try {
        rv.pause();
        rv.srcObject = null;
      } catch (e) {
        // noop
      }
    }

    setSttOn(false);
    setDoctorCaption("");
    setPatientCaption("");
    iceLoggedRef.current = false;
    console.log("[RTC] call ended and resources cleaned");
  }, [sttOn]);

  // 예약번호 파라미터 주입
  useEffect(() => {
    if (ridParam) setReservationId(String(ridParam));
  }, [ridParam]);

  // ✅ 자동 참가: URL/state로 전달된 역할 힌트에 따라 자동 join
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!reservationId || autoJoinRef.current) return;
    autoJoinRef.current = true;
    const which = roleHint === "doctor" ? "doctor" : "patient";
    joinAs(which);
  }, [reservationId, roleHint]);

  // 좌/우 자막
  const leftCaption = role === "ROLE_DOCTOR" ? doctorCaption : patientCaption;
  const rightCaption = role === "ROLE_DOCTOR" ? patientCaption : doctorCaption;

  return (
    <div className="visit">
      <Sidebar />
      <main className="visit__main">
        <h2>비대면(WebRTC)</h2>

        {/* 상단 툴바 */}
        <div className="tele__toolbar">
          {/* ✅ 실서버 전환: 예약번호 입력은 표시만(편의상 비활성화) */}
          <div className="tele__room">
            <label className="tele__label">예약번호</label>
            <input className="tele__input" value={reservationId} disabled readOnly />
          </div>

          <div className="tele__actions">
            {/* 자동 참가가 되므로 수동 참가 버튼은 숨김/제거 */}
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

        {/* 비디오 영역 */}
        <div className="tele__videos">
          <section className="tele__panel">
            <header className="tele__panel__title">내 화면</header>
            <div className="tele__video__frame">
              {/* 환자는 비디오를 가리고 수어 인식 UI를 표시(옵션이 켜졌을 때만) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "12px",
                  display: role === "ROLE_PATIENT" && enableSign ? "none" : "block",
                }}
              />
              {role === "ROLE_PATIENT" && enableSign && (
                <>
                  <HandPoseTracker
                    onSentence={handleRecognizedSentence}
                    onLive={handleLiveWord}
                    live={true}
                  />
                  <div className="tele__live_status">
                    {liveSignWord ? `인식중: ${liveSignWord}` : "수어 인식 대기 중..."}
                  </div>
                </>
              )}
            </div>
            <div className="tele__caption">{leftCaption || "\u00A0"}</div>
          </section>

          <section className="tele__panel">
            <header className="tele__panel__title">상대 화면</header>
            <div className="tele__video__frame">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "12px",
                }}
              />
            </div>
            <div className="tele__caption">{rightCaption || "\u00A0"}</div>
          </section>
        </div>

        {/* 환자 입력(수어→텍스트 전송) : SIGN_TO_TEXT일 때만 */}
        {role === "ROLE_PATIENT" && enableSign && (
          <div className="tele__patient__input_area">
            <input
              type="text"
              className="tele__input"
              placeholder="이곳에 번역된 수어 문장이 표시됩니다."
              value={recognizedText}
              onChange={(e) => setRecognizedText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendPatientCaption()}
            />
            <button className="btn btn--primary" onClick={handleSendPatientCaption}>
              자막 전송
            </button>
          </div>
        )}

        {/* 의사 STT: VOICE_TO_TEXT일 때만 */}
        <div className="tele__text__toolbar">
          {role === "ROLE_DOCTOR" && enableVoice && (
            <button
              className={`btn ${sttOn ? "btn--primary" : "btn--ghost"}`}
              onClick={toggleDoctorSTT}
            >
              {sttOn ? "음성인식 중지" : "음성인식 시작"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
