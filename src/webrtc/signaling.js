import { USE_MOCK } from "../config";

/* ---------- MOCK: 같은 도메인의 두 탭 연결(BroadcastChannel) ---------- */
function createMockSignaling({
  roomId, myKey, onOffer, onAnswer, onIce, onKeyRequest, onKeyReceive
}) {
  const ch = new BroadcastChannel(`sig-${roomId}`);
  const send = (msg) => ch.postMessage(msg);

  // RTCIceCandidate -> JSON (structured clone 가능 형태)
  const iceToJSON = (ice) => {
    if (!ice) return null; // end-of-candidates
    if (typeof ice.toJSON === "function") return ice.toJSON();
    return {
      candidate: ice.candidate,
      sdpMid: ice.sdpMid ?? null,
      sdpMLineIndex: ice.sdpMLineIndex ?? null,
      usernameFragment: ice.usernameFragment ?? null,
    };
  };

  ch.onmessage = (ev) => {
    const msg = ev.data || {};
    const { type, key, to } = msg;
    if (to && to !== myKey) return;                       // 지정 수신 시 대상만 처리
    if (key === myKey && type !== "key-request") return;  // 내가 보낸 건 무시

    if (type === "offer") onOffer?.({ key, body: msg.body });
    else if (type === "answer") onAnswer?.({ key, body: msg.body });
    else if (type === "ice") onIce?.({ key, body: msg.body }); // body는 JSON
    else if (type === "key-request") onKeyRequest?.();
    else if (type === "key") onKeyReceive?.(key);
  };

  const api = {
    sendOffer: (toKey, offer) =>
      send({ type: "offer", to: toKey, key: myKey, body: offer }),
    sendAnswer: (toKey, answer) =>
      send({ type: "answer", to: toKey, key: myKey, body: answer }),
    sendIce: (toKey, ice) =>
      send({ type: "ice", to: toKey, key: myKey, body: iceToJSON(ice) }),
    askKeys: () => send({ type: "key-request", key: myKey }),
    sendMyKey: () => send({ type: "key", key: myKey }),
    close: () => { try { ch.close(); } catch (e) { console.debug("[mock] close skipped", e); } },
    socket: null,
  };

  setTimeout(api.sendMyKey, 0); // 입장 즉시 키 브로드캐스트
  return api;
}

/* ---------- REAL: 실제 WebSocket 시그널링 ---------- */
function createRealSignaling({
  wsUrl, roomId, myKey, onOffer, onAnswer, onIce, onKeyRequest, onKeyReceive
}) {
  const url = `${wsUrl}?room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(myKey)}`;
  const ws = new WebSocket(url);
  const send = (obj) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  // RTCIceCandidate -> JSON
  const iceToJSON = (ice) => {
    if (!ice) return null;
    if (typeof ice.toJSON === "function") return ice.toJSON();
    return {
      candidate: ice.candidate,
      sdpMid: ice.sdpMid ?? null,
      sdpMLineIndex: ice.sdpMLineIndex ?? null,
      usernameFragment: ice.usernameFragment ?? null,
    };
  };

  const api = {
    sendOffer: (toKey, offer) =>
      send({ type: "offer", to: toKey, key: myKey, body: offer }),
    sendAnswer: (toKey, answer) =>
      send({ type: "answer", to: toKey, key: myKey, body: answer }),
    sendIce: (toKey, ice) =>
      send({ type: "ice", to: toKey, key: myKey, body: iceToJSON(ice) }),
    sendMyKey: () => send({ type: "key", key: myKey }),
    askKeys: () => send({ type: "key-request", key: myKey }),
    close: () => { try { ws.close(); } catch (e) { console.debug("[ws] close skipped", e); } },
    socket: ws,
  };

  ws.onopen = () => api.sendMyKey();
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    const { type, key, body } = msg || {};
    if (type === "offer") onOffer?.({ key, body });
    else if (type === "answer") onAnswer?.({ key, body });
    else if (type === "ice") onIce?.({ key, body });
    else if (type === "key-request") onKeyRequest?.();
    else if (type === "key") onKeyReceive?.(key);
  };
  ws.onerror = (e) => console.warn("[signaling] error:", e?.message || e);
  ws.onclose =  (e) => console.log("[signaling] closed:", e?.code, e?.reason || "");

  return api;
}

/* ---------- Public Factory ---------- */
export function connectSignalingWS(opts) {
  const { wsUrl } = opts || {};
  if (USE_MOCK || (wsUrl && wsUrl.startsWith("mock://"))) {
    return createMockSignaling(opts);
  }
  return createRealSignaling(opts);
}
