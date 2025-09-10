// src/webrtc/signaling.js
import { USE_MOCK } from "../config";

/* ---------- MOCK: 같은 도메인의 두 탭 연결(BroadcastChannel) ---------- */
function createMockSignaling({
  roomId,
  myKey,
  onReady,
  onOffer,
  onAnswer,
  onIce,
  onKeyRequest,
  onKeyReceive,
  onLeave,
}) {
  const ch = new BroadcastChannel(`sig-${roomId}`);
  const send = (msg) => ch.postMessage(msg);

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

  ch.onmessage = (ev) => {
    const msg = ev.data || {};
    const { type, key, to } = msg;
    if (to && to !== myKey) return;
    if (key === myKey && type !== "key-request") return;

    if (type === "bothReady") onReady?.(msg.shouldOffer === true);
    else if (type === "offer") onOffer?.({ key, body: msg.body });
    else if (type === "answer") onAnswer?.({ key, body: msg.body });
    else if (type === "candidate" || type === "ice") onIce?.({ key, body: msg.body });
    else if (type === "key-request") onKeyRequest?.();
    else if (type === "key") onKeyReceive?.(key);
    else if (type === "leave") onLeave?.({ key });
  };

  const api = {
    sendOffer: (toKey, offer) =>
      send({ type: "offer", to: toKey, key: myKey, body: offer }),
    sendAnswer: (toKey, answer) =>
      send({ type: "answer", to: toKey, key: myKey, body: answer }),
    sendIce: (toKey, ice) => {
      const body = iceToJSON(ice);
      send({ type: "candidate", to: toKey, key: myKey, body });
      send({ type: "ice", to: toKey, key: myKey, body });
    },
    askKeys: () => send({ type: "key-request", key: myKey }),
    sendMyKey: () => send({ type: "key", key: myKey }),
    sendLeave: () => send({ type: "leave", key: myKey }),
    close: () => {
      try {
        ch.close();
      } catch (e) {
        console.debug("[mock] close skipped", e);
      }
    },
    socket: null,
  };

  setTimeout(api.sendMyKey, 0);
  return api;
}

/* ---------- REAL: 실제 WebSocket 시그널링 ---------- */
function createRealSignaling({
  wsUrl,
  roomId,
  myKey,
  onReady,
  onOffer,
  onAnswer,
  onIce,
  onKeyRequest,
  onKeyReceive,
  onLeave,
}) {
  // 서버 호환: room & roomId 둘 다 쿼리로 전달
  const qp = `room=${encodeURIComponent(roomId)}&roomId=${encodeURIComponent(
    roomId
  )}&key=${encodeURIComponent(myKey)}`;

  const url =
    wsUrl?.startsWith("ws") || wsUrl?.startsWith("wss")
      ? `${wsUrl}?${qp}`
      : `/ws/signaling?${qp}`;

  const ws = new WebSocket(url);
  const send = (obj) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

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
    sendIce: (toKey, ice) => {
      const body = iceToJSON(ice);
      // 서버가 어떤 이름을 기대하든 호환되도록 둘 다 전송
      send({ type: "candidate", to: toKey, key: myKey, body });
      send({ type: "ice", to: toKey, key: myKey, body });
    },
    sendMyKey: () => send({ type: "key", key: myKey }),
    askKeys: () => send({ type: "key-request", key: myKey }),
    sendLeave: () => send({ type: "leave", key: myKey }),
    close: () => {
      try {
        ws.close();
      } catch (e) {
        console.debug("[ws] close skipped:", e);
      }
    },
    socket: ws,
  };

  ws.onopen = () => {
    console.log("[SIG] ws open", { url });
    api.sendMyKey();
  };
  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      console.debug("[SIG] non-JSON message", ev.data);
      return;
    }
    const { type, key, body } = msg || {};
    if (type === "bothReady") {
      console.log("[SIG] bothReady", msg);
      onReady?.(msg.shouldOffer === true);
      return;
    }
    if (type === "offer") {
      console.log("[SIG] offer", body);
      onOffer?.({ key, body });
    } else if (type === "answer") {
      console.log("[SIG] answer", body);
      onAnswer?.({ key, body });
    } else if (type === "candidate" || type === "ice") {
      console.log("[SIG] ice/candidate", body);
      onIce?.({ key, body });
    } else if (type === "key-request") {
      console.log("[SIG] key-request");
      onKeyRequest?.();
    } else if (type === "key") {
      console.log("[SIG] key", key);
      onKeyReceive?.(key);
    } else if (type === "leave") {
      console.log("[SIG] leave");
      onLeave?.({ key });
    } else {
      console.log("[SIG] unknown type", type);
    }
  };
  ws.onerror = (e) => console.warn("[SIG] error:", e?.message || e);
  ws.onclose = (e) => console.log("[SIG] closed:", e?.code, e?.reason || "");

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
