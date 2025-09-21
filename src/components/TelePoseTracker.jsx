import React, { useEffect, useRef } from "react";
import { connectWebSocket } from "../utils/websocket"; // 기존 유틸

// 전송 파라미터 (필요 시 여기만 조절)
const TX_FPS = 5;
const TX_JPEG_QUALITY = 0.5;
const TX_MIN_BYTES = 5000;
const TX_WIDTH = 320;

function toPaddedBase64FromCanvas(canvas, q = 0.7) {
  const dataUrl = canvas.toDataURL("image/jpeg", q);
  let b64 = (dataUrl.split(",")[1] || "").trim();
  while (b64.length % 4 !== 0) b64 += "=";
  return b64;
}

export default function TelePoseTracker({
  wsPath = "/fastapi/ws",
  externalStream,         // 있으면 카메라 안 열고 이것만 사용
  onOpen,
  onClose,
  onError,
}) {
  const videoRef = useRef(null);
  const viewCanvasRef = useRef(null); // 화면 표시용
  const txCanvasRef = useRef(null);   // 다운샘플 전송용

  const socketRef = useRef(null);
  const sendTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const videoReadyRef = useRef(false);
  const socketOpenRef = useRef(false);
  const loopStartedRef = useRef(false);

  const tryStartLoop = () => {
    if (loopStartedRef.current) return;
    if (!videoReadyRef.current || !socketOpenRef.current) return;

    loopStartedRef.current = true;
    const interval = Math.round(1000 / TX_FPS);

    sendTimerRef.current = window.setInterval(() => {
      const s = socketRef.current;
      const v = videoRef.current;
      const vcan = viewCanvasRef.current;
      const tcan = txCanvasRef.current;

      if (!s || s.readyState !== WebSocket.OPEN) return;
      if (!v || v.readyState < 2 || !vcan || !tcan) return;

      // 화면 렌더
      const vctx = vcan.getContext("2d");
      vctx.drawImage(v, 0, 0, vcan.width, vcan.height);

      // 전송용 다운샘플 렌더
      const txctx = tcan.getContext("2d");
      txctx.drawImage(v, 0, 0, tcan.width, tcan.height);

      const b64 = toPaddedBase64FromCanvas(tcan, TX_JPEG_QUALITY);
      if (b64.length * 0.75 < TX_MIN_BYTES) return;

      try { s.send(b64); } catch (e) { console.debug("[TelePose] send skipped:", e); }
    }, interval);

    pingTimerRef.current = window.setInterval(() => {
      try {
        const s = socketRef.current;
        if (s && s.readyState === WebSocket.OPEN) s.send("PING");
      } catch (e) {
        console.debug("[TelePose] ping skipped:", e);
      }
    }, 20000);
  };

  // 비디오 바인딩 (externalStream이 있으면 그걸 사용)
  useEffect(() => {
    const v = videoRef.current;
    const vcan = viewCanvasRef.current;
    const tcan = document.createElement("canvas");
    txCanvasRef.current = tcan;

    let localStream = null;

    (async () => {
      try {
        const stream =
          externalStream ||
          (await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }));

        localStream = stream;
        v.srcObject = stream;
        v.muted = true;
        await v.play();

        const w = v.videoWidth || 640;
        const h = v.videoHeight || 480;

        // 표시용 캔버스 크기
        vcan.width = w;
        vcan.height = h;

        // 전송용 캔버스(다운샘플)
        const aspect = h / w;
        tcan.width = TX_WIDTH;
        tcan.height = Math.round(TX_WIDTH * aspect);

        videoReadyRef.current = true;
        tryStartLoop();
      } catch (err) {
        console.error("[TelePose] video init error:", err?.name, err?.message || err);
      }
    })();

    return () => {
      // 외부 스트림이면 stop하지 않음
      if (!externalStream) {
        try {
          localStream?.getTracks?.().forEach((t) => t.stop());
        } catch (e) {
          console.debug("[TelePose] stop tracks skipped:", e);
        }
      }
      try {
        v.pause?.();
        // @ts-ignore
        v.srcObject = null;
      } catch (e) {
        console.debug("[TelePose] detach video skipped:", e);
      }
    };
  }, [externalStream]);

  // WebSocket 연결 (메시지 핸들링 없음 — 전송만)
  useEffect(() => {
    let backoff = 1000; // 재연결 간격(ms), 최대 10초

    const openSocket = () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

      socketRef.current = connectWebSocket(
        wsPath,
        // onMessage
        () => {},
        // onOpen
        () => {
          socketOpenRef.current = true;
          backoff = 1000;
          tryStartLoop();
          onOpen?.();
        },
        // onClose
        (ev) => {
          console.warn("[TelePose] ws close:", ev?.code, ev?.reason || "");
          socketOpenRef.current = false;
          loopStartedRef.current = false;
          if (sendTimerRef.current) { window.clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
          if (pingTimerRef.current) { window.clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
          onClose?.(ev);
          reconnectTimerRef.current = window.setTimeout(() => {
            openSocket();
            backoff = Math.min(backoff * 2, 10000);
          }, backoff);
        },
        // onError
        (err) => {
          console.debug("[TelePose] ws error:", err?.message || err);
          onError?.(err);
        }
      );
    };

    openSocket();

    return () => {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (sendTimerRef.current) { window.clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
      if (pingTimerRef.current) { window.clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
      try {
        const s = socketRef.current;
        if (s && s.readyState === WebSocket.OPEN) s.close();
      } catch (e) {
        console.debug("[TelePose] close ws skipped:", e);
      }
      socketRef.current = null;
      socketOpenRef.current = false;
      loopStartedRef.current = false;
    };
  }, [wsPath, onOpen, onClose, onError]);

  // 렌더
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 비디오는 숨기고 캔버스로만 표시 */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />
      <canvas
        ref={viewCanvasRef}
        style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
      />
    </div>
  );
}
