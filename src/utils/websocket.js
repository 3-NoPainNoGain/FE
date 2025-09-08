// src/utils/websocket.js
// 안정적인 WebSocket 유틸: auto-reconnect + heartbeat + 단일 연결 보장 + ESLint no-empty 처리

const PROD_BASE = "wss://handdoc.store";

function buildWssUrl(path = "/fastapi/ws") {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${PROD_BASE}${path}`;
}

/**
 * 안정화된 WebSocket 생성기
 * - 자동 재연결 (지수 백오프)
 * - 하트비트(keep-alive) 기본 포함
 * - 안전 전송(sendJSON)
 */
export function createStableWS(
  pathOrUrl,
  {
    onOpen,
    onMessage,
    onClose,
    onError,
    heartbeatIntervalMs = 20000,
    reconnectMinMs = 1000,
    reconnectMaxMs = 8000,
    maxRetries = Infinity,
  } = {}
) {
  const url = pathOrUrl.startsWith?.("ws") ? pathOrUrl : buildWssUrl(pathOrUrl);

  let ws = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let closedByUser = false;
  let retries = 0;

  const log = (...a) => console.log("[WS]", ...a);

  function clearTimers() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
        }
      } catch (e) {
        console.debug("heartbeat send skipped:", e);
      }
    }, heartbeatIntervalMs);
  }

  function scheduleReconnect() {
    if (closedByUser) return;
    if (retries >= maxRetries) return;
    const delay =
      Math.min(reconnectMinMs * Math.pow(1.6, retries), reconnectMaxMs) +
      Math.floor(Math.random() * 250);
    reconnectTimer = setTimeout(connect, delay);
    retries += 1;
    log(`reconnect in ${delay}ms (#${retries})`);
  }

  function connect() {
    clearTimers();
    ws = new WebSocket(url);
    log("connecting:", url);

    ws.onopen = (ev) => {
      retries = 0;
      startHeartbeat();
      try { onOpen && onOpen(ev); } catch (e) { console.debug("onOpen handler error:", e); }
      log("open");
    };

    ws.onmessage = (ev) => {
  let data = ev.data;
  try {
    data = JSON.parse(ev.data);
  } catch {
    // JSON 파싱 실패하면 그냥 문자열 그대로 둔다
  }

  // ping/pong 무시
  if (data && (data.type === "ping" || data.type === "pong")) return;

  // 필요 없는 warn 로그 제거 → 바로 콜백만 실행
  try {
    onMessage && onMessage(data, ev);
  } catch (e) {
    console.debug("onMessage handler error:", e);
  }
};


    ws.onerror = (ev) => {
      try { onError && onError(ev); } catch (e) { console.debug("onError handler error:", e); }
      log("error", ev?.message || ev);
    };

    ws.onclose = (ev) => {
      clearTimers();
      try { onClose && onClose(ev); } catch (e) { console.debug("onClose handler error:", e); }
      log(`closed code=${ev.code} reason="${ev.reason}" wasClean=${ev.wasClean}`);
      if (!closedByUser) scheduleReconnect();
    };
  }

  function sendJSON(obj) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
        return true;
      }
      return false;
    } catch (e) {
      console.debug("sendJSON error:", e);
      return false;
    }
  }

  function close() {
    closedByUser = true;
    clearTimers();
    try {
      if (ws) ws.close(1000, "client closed");
    } catch (e) {
      console.debug("socket close skipped:", e);
    }
  }

  connect();

  return {
    get instance() { return ws; },
    sendJSON,
    close,
  };
}

/**
 * (호환) 과거 코드 유지용 래퍼
 * 기존: connectWebSocket(path, onMessage, onOpen, onClose?, onError?)
 * 내부적으로 createStableWS를 사용.
 */
export function connectWebSocket(pathOrUrl, onMessage, onOpen, onClose, onError) {
  const stable = createStableWS(pathOrUrl, {

    onMessage,
    onOpen,
    onClose,
    onError,
     heartbeatIntervalMs: 0,
  });
  return {
    get readyState() {
      return stable.instance?.readyState;
    },
    send: (x) => {
      try {
        if (stable.instance?.readyState === WebSocket.OPEN) {
          stable.instance.send(x);
        }
      } catch (e) {
        console.debug("legacy send skipped:", e);
      }
    },
    close: () => {
      try { stable.close(); } catch (e) { console.debug("legacy close skipped:", e); }
    },
  };
}
