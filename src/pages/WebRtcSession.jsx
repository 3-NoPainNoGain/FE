import { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import { connectSignalingWS } from "../webrtc/signaling";
import { joinReservation } from "../services/reservation";

function createPeer(localStream, iceServers, onTrack, onIce) {
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
  pc.onicecandidate = (ev) => { if (ev.candidate) onIce?.(ev.candidate); };
  return pc;
}
async function makeOffer(pc){ const o=await pc.createOffer();  await pc.setLocalDescription(o); return o; }
async function makeAnswer(pc){ const a=await pc.createAnswer(); await pc.setLocalDescription(a); return a; }

export default function WebRtcSession() {
  // 탭(세션)마다 고유 키: sessionStorage 사용! (탭 새로 열면 새 키)
  const myKeyRef = useRef(null);
  if (!myKeyRef.current) {
    const saved = sessionStorage.getItem("tele_key");
    myKeyRef.current =
      saved ||
      (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11));
    if (!saved) sessionStorage.setItem("tele_key", myKeyRef.current);
  }
  const myKey = myKeyRef.current;

  // 예약/연결 상태
  const [reservationId, setReservationId] = useState("");
  const [role, setRole] = useState("");     // ROLE_PATIENT | ROLE_DOCTOR
  const [status, setStatus] = useState(""); // WAITING | ACTIVE
  const [roomId, setRoomId] = useState("");
  const [iceServers, setIceServers] = useState([]);

  // 미디어/피어
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());   // key -> RTCPeerConnection
  const othersRef = useRef(new Set());  // 발견한 상대 키
  const signalingRef = useRef(null);

  async function openCam() {
    // 중복 실행 시 기존 트랙 정리
    try { localStreamRef.current?.getTracks?.().forEach(t=>t.stop()); } catch (e) { console.debug("stop skip", e); }
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = s;
    const v = localVideoRef.current;
    if (v) {
      v.srcObject = s;
      v.muted = true;
      await v.play();
    }
  }

  function attachRemoteStream(stream) {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (v.srcObject === stream) return;
    v.srcObject = stream;
    v.muted = true;
    v.play().catch((e)=>console.debug("remote play skipped", e));
  }

  // 예약 참가 (목/실 공용)
  async function joinAs(roleHint) {
    if (!reservationId) return alert("reservationId 입력!");
    const res = await joinReservation(reservationId, roleHint);
    setRoomId(res.roomId); setRole(res.role); setStatus(res.status);
    setIceServers(res.iceServers || []);
    await openCam();

    const api = connectSignalingWS({
      wsUrl: res.wsUrl || "wss://handdoc.store/ws/signaling",
      roomId: res.roomId,
      myKey,
      onOffer: async ({ key, body }) => {
        let pc = peersRef.current.get(key);
        if (!pc) {
          pc = createPeer(localStreamRef.current, res.iceServers, (s)=>attachRemoteStream(s), (ice)=>api.sendIce(key, ice));
          peersRef.current.set(key, pc);
        }
        await pc.setRemoteDescription(body);
        const answer = await makeAnswer(pc);
        api.sendAnswer(key, answer);
      },
      onAnswer: async ({ key, body }) => {
        const pc = peersRef.current.get(key);
        if (pc) await pc.setRemoteDescription(body);
      },
      onIce: ({ key, body }) => {
        const pc = peersRef.current.get(key);
        if (!pc) return;
        if (body == null) { pc.addIceCandidate(null).catch(()=>{}); return; }
        pc.addIceCandidate(new RTCIceCandidate(body)).catch(()=>{});
      },
      onKeyRequest: () => api.sendMyKey(),
      onKeyReceive: (key) => { if (key !== myKey) othersRef.current.add(key); },
    });

    signalingRef.current = api;
  }

  // 통화 시작(offer 발사) — 한쪽만 눌러도 됨
  async function startCall() {
    const api = signalingRef.current;
    if (!api) return alert("먼저 참가하세요!");
    api.askKeys();
    setTimeout(async () => {
      for (const key of Array.from(othersRef.current)) {
        if (peersRef.current.has(key)) continue;
        const pc = createPeer(localStreamRef.current, iceServers, (s)=>attachRemoteStream(s), (ice)=>api.sendIce(key, ice));
        peersRef.current.set(key, pc);
        const offer = await makeOffer(pc);
        api.sendOffer(key, offer);
      }
    }, 500);
  }

  // 통화 종료
  function endCall() {
    try { signalingRef.current?.close?.(); } catch (e) { console.debug("sig close skip", e); }
    signalingRef.current = null;
    peersRef.current.forEach((pc)=>pc.close());
    peersRef.current.clear();
    othersRef.current.clear();
    try { localStreamRef.current?.getTracks?.().forEach(t=>t.stop()); } catch (e) { console.debug("stop skip", e); }
    const lv = localVideoRef.current; const rv = remoteVideoRef.current;
    if (lv) { try { lv.pause(); lv.srcObject = null; } catch (e) { console.debug(e); } }
    if (rv) { try { rv.pause(); rv.srcObject = null; } catch (e) { console.debug(e); } }
  }

  useEffect(()=>()=>endCall(),[]);

  return (
    <div className="visit">
      <Sidebar />
      <main className="visit__main" style={{ padding: 16 }}>
        <h2>비대면(WebRTC) /tele</h2>

        {/* 컨트롤 바 */}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
          <input
            placeholder="reservationId"
            value={reservationId}
            onChange={(e)=>setReservationId(e.target.value)}
            style={{ width:220 }}
          />
          <button onClick={()=>joinAs("patient")}>환자로 참가</button>
          <button onClick={()=>joinAs("doctor")}>의사로 참가</button>
          <button onClick={startCall}>통화 시작</button>
          <button onClick={endCall}>통화 종료</button>
          <span style={{ marginLeft:8, opacity:.8 }}>
            room: <b>{roomId || "-"}</b> / role: <b>{role || "-"}</b> / status: <b>{status || "-"}</b>
          </span>
        </div>

        {/* 카메라 두 개: 왼쪽=내 화면, 오른쪽=상대 화면 */}
        <div
          style={{
            display:"grid",
            gridTemplateColumns:"1fr 1fr",
            gap:16,
            alignItems:"stretch",
          }}
        >
          <div style={{ background:"#d9d9d9", borderRadius:12, padding:8 }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              controls
              style={{ width:"100%", height:420, background:"#000", borderRadius:8, objectFit:"cover" }}
            />
          </div>
          <div style={{ background:"#d9d9d9", borderRadius:12, padding:8 }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls
              style={{ width:"100%", height:420, background:"#000", borderRadius:8, objectFit:"cover" }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
