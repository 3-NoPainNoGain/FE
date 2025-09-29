// [코드 제목] WebRtcSession.jsx (환자 마이크: SIGN_TO_TEXT 없을 때만 표시/활성)
// 파일: src/pages/WebRtcSession.jsx
//
// ✅ 이번 수정 요약
// - 환자 마이크 버튼/오디오 트랙: SIGN_TO_TEXT가 없을 때만 표시/활성(!enableSign)
// - enableVoice 제거(no-unused-vars 방지)
// - react-hooks/exhaustive-deps: openCam deps → [enableSign]
//
// ⚠️ import 경로/서비스 함수는 프로젝트 구조에 맞춰 두었습니다.

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
  sendPatientSpeechToDB, // ✅ 환자 음성 업로드 추가
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
  const navigate = useNavigate();

  const qp = new URLSearchParams(search);
  const roleHintParam = qp.get("role");
  const roleHint =
    (state && state.roleHint) ||
    (roleHintParam &&
      (roleHintParam.toLowerCase() === "doctor" ? "doctor" : "patient")) ||
    null;

  const selectedOptions = state?.interpretationOption || [];

  // ✅ 옵션 플래그 (역할과 무관하게 선택값만 반영)
  const enableSign = selectedOptions.includes("SIGN_TO_TEXT");

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

  // STT/REC
  const sttRef = useRef(null);
  const [sttOn, setSttOn] = useState(false);
  const iceLoggedRef = useRef(false);
  const mediaRecRef = useRef({ rec: null, chunks: [] });

  /* ----- 유틸: 문자열 정규화 ----- */
  const normalize = useCallback((s = "") => {
    return s.replace(/\s+/g, " ").replace(/[.?!]+$/, "").trim();
  }, []);

  /* ----- 채팅 push/replace (안정화) ----- */
  const pushOrReplace = useCallback(
    (source, text) => {
      const t = normalize(text);
      if (!t) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === source) {
          if (normalize(last.text) === t) return prev;
          return [...prev.slice(0, -1), { ...last, text }];
        }
        return [...prev, { id: crypto.randomUUID(), role: source, text }];
      });
    },
    [normalize]
  );

  // 채팅 스크롤 유지
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---------- 캡션 전송: 데이터채널 브로드캐스트 + UI 반영 ---------- */
  const sendCaption = useCallback(
    (source, text) => {
      const t = (text || "").trim();
      if (!t) return;

      // 로컬 UI 반영
      pushOrReplace(source, t);

      // 데이터채널 브로드캐스트
      const ch = dataChannelRef.current;
      const payload = { type: "caption", source, text: t, t: Date.now() };
      try {
        if (ch && ch.readyState === "open") ch.send(JSON.stringify(payload));
      } catch {
        // no-op
      }
    },
    [pushOrReplace]
  );

  /* 환자 자막 전송(버튼/엔터) */
  const handleSendPatientCaption = useCallback(async () => {
    const text = recognizedText.trim();
    if (!text) return;
    // 1) P2P로 전파 + UI
    sendCaption("patient", text);
    // 2) 서버 저장
    try {
const id = roomId;
if (!id) return; // 아직 roomId 준비 전이면 전송 안 함 (또는 alert)
await sendSignTextToDB(id, text);
    } catch {
      // 저장 실패는 무시 (네트워크 일시 오류 등)
    }
    setRecognizedText("");
  }, [recognizedText, roomId, reservationId, sendCaption]);

  /* 로컬 미디어 열기(오디오 조건 포함) — hook deps를 위해 useCallback으로 안정화 */
  const openCam = useCallback(
    async (currentRole) => {
      try {
        localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {
        // no-op
      }
      // ✅ 오디오 활성 조건:
      // 의사는 항상 오디오, 환자는 SIGN_TO_TEXT가 없을 때만 오디오
      const wantAudio =
        currentRole === "ROLE_DOCTOR" ||
        (currentRole === "ROLE_PATIENT" && !enableSign);
      const constraints = { video: true, audio: wantAudio };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = s;

      const lv = localVideoRef.current;
      if (lv) {
        lv.srcObject = s;
        lv.muted = true;
        try {
          await lv.play();
        } catch {
          // no-op
        }
      }
    },
    [enableSign]
  );

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play?.().catch(() => {
      // no-op
    });
  }

  function bindDataChannel(ch) {
    if (!ch) return;
    dataChannelRef.current = ch;
    ch.onopen = () => console.log("[DC] open");
    ch.onclose = () => console.log("[DC] close");
    ch.onerror = (err) => console.warn("[DC] error", err);
    ch.onmessage = (ev) => {
      let payload = ev.data;
      try {
        payload = JSON.parse(ev.data);
      } catch {
        // no-op
      }
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "caption" && payload.text) {
        pushOrReplace(payload.source, payload.text);
      }
    };
  }

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

  /* 마이크 토글: 의사/환자 분기 */
  const toggleMic = useCallback(async () => {
    const ensureAudioTrack = async () => {
      let stream = localStreamRef.current;
      if (!stream || stream.getAudioTracks().length === 0) {
        await openCam(role);
        stream = localStreamRef.current;
      }
      const track = stream?.getAudioTracks?.()[0];
      if (!track)
        throw new Error("오디오 트랙이 없습니다. 마이크 권한을 확인해 주세요.");
      if (track.readyState !== "live" || track.enabled === false) {
        throw new Error("마이크가 비활성화되어 있습니다.");
      }
      return track;
    };

    if (sttOn) {
      try {
        sttRef.current?.stop?.();
      } catch {
        // no-op
      }
      try {
        mediaRecRef.current?.rec?.stop();
      } catch {
        // no-op
      }
      setSttOn(false);
      return;
    }

    try {
      await ensureAudioTrack();
      const recordStream = new MediaStream([
        localStreamRef.current.getAudioTracks()[0],
      ]);
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

      rec.ondataavailable = (ev) => {
        try {
          if (ev.data && ev.data.size > 0) mediaRecRef.current.chunks.push(ev.data);
        } catch (err) {
          console.warn("[REC] ondataavailable 에러:", err);
        }
      };

      rec.onstop = async () => {
        try {
          const usedType = rec.mimeType || mimeType || "audio/webm";
          const audioBlob = new Blob(mediaRecRef.current.chunks, {
            type: usedType,
          });
          console.log(
            "[REC] stopped. size=",
            audioBlob.size,
            "type=",
            audioBlob.type
          );
          if (audioBlob.size > 200) {
            try {
              // ✅ 역할별 업로드 엔드포인트 분기
const id = roomId;
if (!id) {
  console.warn("[upload] roomId가 아직 없습니다. 업로드 생략");
  return;
}
const res =
  role === "ROLE_DOCTOR"
    ? await sendSpeechToDB(id, audioBlob)
    : await sendPatientSpeechToDB(id, audioBlob);


              console.log("[API OK] 음성 업로드 성공");
              const finalText = res?.text ?? res?.results ?? "";
              if (finalText) {
                pushOrReplace(
                  role === "ROLE_DOCTOR" ? "doctor" : "patient",
                  finalText
                );
              }
            } catch (error) {
              console.error("[API FAIL] 음성 업로드 실패:", error);
            }
          }
        } catch (err) {
          console.warn("[REC] onstop 처리 중 오류:", err);
        } finally {
          mediaRecRef.current = { rec: null, chunks: [] };
          setSttOn(false);
        }
      };

      // 의사만 실시간 브라우저 STT 자막
      if (role === "ROLE_DOCTOR") {
        if (!sttRef.current) {
          try {
            sttRef.current = createBrowserSTT({
              lang: "ko-KR",
              interimResults: true,
            });
          } catch (err) {
            console.warn("이 브라우저는 Web Speech API를 지원하지 않습니다.", err);
          }
        }
        try {
          sttRef.current?.start?.({
            onText: (text) => sendCaption("doctor", text),
            onError: (err) => {
              console.warn("STT 비동기 에러:", err);
              try {
                mediaRecRef.current?.rec?.stop();
              } catch {
                // no-op
              }
              setSttOn(false);
            },
            onEnd: () => {
              try {
                mediaRecRef.current?.rec?.stop();
              } catch {
                // no-op
              }
              setSttOn(false);
            },
          });
        } catch {
          console.debug("[STT] start 실패(무시)");
        }
      }

      try {
        rec.start();
      } catch (err) {
        alert(`녹음을 시작할 수 없습니다.\n오류: ${err.message}`);
        setSttOn(false);
        return;
      }
      setSttOn(true);
    } catch (e) {
      alert(e.message || "마이크를 사용할 수 없습니다.");
      setSttOn(false);
    }
  }, [role, sttOn, roomId, reservationId, openCam, sendCaption, pushOrReplace]); // deps OK

  /* 참가 */
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
        const pc = peersRef.current.get("peer");
        if (!pc) return;
        if (body == null) {
          pc.addIceCandidate(null).catch(() => {
            // no-op
          });
          return;
        }
        pc.addIceCandidate(new RTCIceCandidate(body)).catch(() => {
          // no-op
        });
      },
      onLeave: () => endCall(),
    });
    signalingRef.current = api;
  }

  /* 종료 */
  const endCall = useCallback(async () => {
    if (sttOn) {
      try {
        mediaRecRef.current?.rec?.stop();
      } catch {
        // no-op
      }
      try {
        sttRef.current?.stop?.();
      } catch {
        // no-op
      }
    }

    try {
      signalingRef.current?.sendLeave?.();
    } catch {
      // no-op
    }
    try {
      signalingRef.current?.close?.();
    } catch {
      // no-op
    }
    signalingRef.current = null;

    try {
      dataChannelRef.current?.close?.();
    } catch {
      // no-op
    }
    dataChannelRef.current = null;

    try {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    } catch (err) {
      console.debug("[RTC] peer close 무시:", err);
    }

    try {
      localStreamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      // no-op
    }

    const lv = localVideoRef.current,
      rv = remoteVideoRef.current;
    if (lv) {
      try {
        lv.pause();
        lv.srcObject = null;
      } catch {
        // no-op
      }
    }
    if (rv) {
      try {
        rv.pause();
        rv.srcObject = null;
      } catch {
        // no-op
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
  }, [roomId, sttOn]);

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
  const onClickEnd = useCallback(() => setShowEndModal(true), []);
  const onCancelEnd = useCallback(() => setShowEndModal(false), []);
  const onConfirmEnd = useCallback(async () => {
    try {
      const id = roomId || reservationId;
      if (id) sessionStorage.setItem(`chat:${id}`, JSON.stringify(messages));
    } catch {
      // storage error ignore
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

            {/* ✅ 마이크 버튼: 의사는 항상 / 환자는 SIGN_TO_TEXT 없을 때만 */}
            {(role === "ROLE_DOCTOR" ||
              (role === "ROLE_PATIENT" && !enableSign)) && (
              <div className="chat__mic">
                <button
                  className={`mic-btn ${sttOn ? "is-on" : ""}`}
                  onClick={toggleMic}
                  title={sttOn ? "음성 인식 중지" : "마이크로 말하기"}
                >
                  {sttOn ? "⏹️" : "🎤"}
                </button>
              </div>
            )}
          </section>

          {/* 우측 영상 + 수어 UI */}
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
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSendPatientCaption()
                    }
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
              <button
                className="tele__send_big"
                onClick={handleSendPatientCaption}
              >
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
