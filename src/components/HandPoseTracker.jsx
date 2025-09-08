// src/components/HandPoseTracker.jsx
import React, { useRef, useEffect } from "react";
import { connectWebSocket } from "../utils/websocket";

// ---- 전송 파라미터 ----
const TX_FPS = 5;            // 서버 부하/대역폭 고려
const TX_JPEG_QUALITY = 0.5; // 0.4~0.6 권장
const TX_MIN_BYTES = 5000;   // 빈/검은 프레임 필터 (~5KB)
const TX_WIDTH = 320;        // 서버 전송용 가로 해상도(다운샘플)

// ---- 유틸 ----
function toPaddedBase64FromCanvas(canvas, quality = 0.7) {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  let base64 = (dataUrl.split(",")[1] || "").trim();
  while (base64.length % 4 !== 0) base64 += "=";
  return base64;
}
function safeJsonOrString(s) {
  try { return JSON.parse(s); } catch (e) { return s; }
}

// ---- 드로잉 ----
function drawHandKeypoints(ctx, raw, isLeft = true) {
  if (!raw || raw.length !== 258 || !ctx) return;

  const poseLen = 33 * 4; // 132
  const handLen = 21 * 3; // 63
  const base = isLeft ? poseLen : poseLen + handLen;
  const w = ctx.canvas.width, h = ctx.canvas.height;

  ctx.save();
  ctx.fillStyle = isLeft ? "lime" : "deepskyblue";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2;

  const pts = [];
  for (let i = 0; i < 21; i++) {
    const x = Number(raw[base + i * 3]) * w;
    const y = Number(raw[base + i * 3 + 1]) * h;
    pts.push([x, y]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const fingers = [
    [0,1,2,3,4],
    [0,5,6,7,8],
    [0,9,10,11,12],
    [0,13,14,15,16],
    [0,17,18,19,20],
  ];
  for (const f of fingers) {
    ctx.beginPath();
    for (let i = 0; i < f.length - 1; i++) {
      const a = pts[f[i]];
      const b = pts[f[i + 1]];
      if (!a || !b) continue;
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawPoseKeypoints(ctx, raw) {
  if (!raw || raw.length !== 258 || !ctx) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const idxs = [0, 11, 12, 13, 14, 15, 16]; // 코, 어깨, 팔꿈치, 손목
  const pts = [];

  ctx.save();
  for (const idx of idxs) {
    const x = Number(raw[idx * 4]) * w;
    const y = Number(raw[idx * 4 + 1]) * h;
    const v = Number(raw[idx * 4 + 3]);
    if (v > 0.2 && Number.isFinite(x) && Number.isFinite(y)) {
      pts.push([x, y]);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "red";
      ctx.fill();
    } else {
      pts.push(null);
    }
  }

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  const lines = [[1,3],[3,5],[2,4],[4,6],[1,2]];
  for (const [a,b] of lines) {
    if (pts[a] && pts[b]) {
      ctx.beginPath();
      ctx.moveTo(pts[a][0], pts[a][1]);
      ctx.lineTo(pts[b][0], pts[b][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- 컴포넌트 ----
// onLive:     서버에서 오는 실시간 단어(live) → 부모가 표시
// onSentence: 서버에서 오는 최종 문장(sentence) → 부모 입력창에 자동 채움
// live:       true면 프레임 전송, false면 전송 일시정지 (WS 연결 유지)
export default function HandPoseTracker({ onLive, onSentence, live = true }) {
  const videoRef = useRef(null);
  const videoCanvasRef = useRef(null);   // 표시용 비디오 캔버스
  const overlayCanvasRef = useRef(null); // 좌표 오버레이 캔버스
  const txCanvasRef = useRef(null);      // 전송용 offscreen 캔버스

  const socketRef = useRef(null);
  const sendTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const videoReadyRef = useRef(false);
  const socketOpenRef = useRef(false);
  const loopStartedRef = useRef(false);
  const liveRef = useRef(!!live);

  // 최신 콜백/라이브 상태를 ref에 보관 (WS는 mount 1회만 열기 위함)
  const onLiveRef = useRef(onLive);
  const onSentenceRef = useRef(onSentence);
  useEffect(() => { liveRef.current = !!live; }, [live]);
  useEffect(() => { onLiveRef.current = onLive; }, [onLive]);
  useEffect(() => { onSentenceRef.current = onSentence; }, [onSentence]);

  // 루프 시작
  const tryStartLoop = () => {
    if (loopStartedRef.current) return;
    if (!videoReadyRef.current || !socketOpenRef.current) return;

    loopStartedRef.current = true;
    const interval = Math.round(1000 / TX_FPS);

    sendTimerRef.current = window.setInterval(() => {
      // 전송만 ON/OFF (WS는 건드리지 않음)
      if (!liveRef.current) return;

      const s = socketRef.current;
      const videoEl = videoRef.current;
      const vidCanvas = videoCanvasRef.current;
      const tcan = txCanvasRef.current;

      if (!s || s.readyState !== WebSocket.OPEN) return;
      if (!videoEl || videoEl.readyState < 2 || !vidCanvas || !tcan) return;

      // 표시용 비디오 캔버스 업데이트
      const vctx = vidCanvas.getContext("2d");
      vctx.drawImage(videoEl, 0, 0, vidCanvas.width, vidCanvas.height);

      // 전송용 캔버스에 다운샘플 렌더
      const txctx = tcan.getContext("2d");
      txctx.drawImage(videoEl, 0, 0, tcan.width, tcan.height);

      const b64 = toPaddedBase64FromCanvas(tcan, TX_JPEG_QUALITY);
      if (b64.length * 0.75 < TX_MIN_BYTES) return;

      try { s.send(b64); } catch (e) { console.warn("[WS] send error:", e); }
    }, interval);

    console.log("[loop] started");
  };

  // 카메라 준비
  useEffect(() => {
    const localVideoEl = videoRef.current;
    const localVidCanvas = videoCanvasRef.current;
    const localOvCanvas  = overlayCanvasRef.current;
    const localTxCanvas = document.createElement("canvas");
    txCanvasRef.current = localTxCanvas;

    let localStream = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        localStream = stream;
        if (!localVideoEl || !localVidCanvas || !localOvCanvas) return;

        localVideoEl.srcObject = stream;
        localVideoEl.muted = true;
        await localVideoEl.play();

        const w = localVideoEl.videoWidth || 640;
        const h = localVideoEl.videoHeight || 480;

        // 표시용 캔버스 크기
        localVidCanvas.width = localOvCanvas.width = w;
        localVidCanvas.height = localOvCanvas.height = h;

        // 전송용 캔버스(다운샘플)
        const aspect = h / w;
        localTxCanvas.width  = TX_WIDTH;
        localTxCanvas.height = Math.round(TX_WIDTH * aspect);

        videoReadyRef.current = true;
        console.log("[video] ready:", { w, h, tx: { w: TX_WIDTH, h: Math.round(TX_WIDTH * aspect) } });
        tryStartLoop();
      } catch (err) {
        console.error("카메라 접근 실패:", err?.name, err?.message || err);
      }
    })();

    return () => {
      try { localStream?.getTracks?.().forEach((t) => t.stop()); } catch (e) { console.debug("[video] stop tracks skipped:", e); }
      try {
        if (localVideoEl) {
          localVideoEl.pause?.();
          // @ts-ignore
          localVideoEl.srcObject = null;
        }
      } catch (e) { console.debug("[video] detach stream skipped:", e); }
    };
  }, []); // mount 1회

  // WebSocket 준비 (mount 시 1회만 열고, unmount 시 닫음)
  useEffect(() => {
    let backoff = 1000; // 재연결 간격(ms), 최대 10초

    const openSocket = () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

      socketRef.current = connectWebSocket(
        "/fastapi/ws",
        // onMessage
        (data) => {
          const msg = typeof data === "string" ? safeJsonOrString(data) : data;

          // live(실시간 단어)
          if (msg && typeof msg === "object" && msg.live !== undefined) {
            onLiveRef.current?.(String(msg.live));
          }

          // sentence(최종 문장)
          if (msg && typeof msg === "object") {
            const sentence =
              msg.sentence ??
              (msg.result === "sentence" ? msg.text : null);
            if (sentence) {
              console.log("[WS] sentence:", String(sentence));
              onSentenceRef.current?.(String(sentence));
            }
          }

          // 좌표 오버레이
          // 좌표 오버레이 (좌표가 "있을 때만" 지우고 다시 그림)
          const coords = Array.isArray(msg?.coordinates)
            ? msg.coordinates.map((v) => Number(v))
            : null;
          const ov = overlayCanvasRef.current;
          if (ov && coords && coords.length === 258) {
            const octx = ov.getContext("2d");
            octx.clearRect(0, 0, ov.width, ov.height);
            drawPoseKeypoints(octx, coords);
            drawHandKeypoints(octx, coords, true);
            drawHandKeypoints(octx, coords, false);
          }
        },
        // onOpen
        () => {
          console.log("[WS] open");
          socketOpenRef.current = true;
          backoff = 1000;
          tryStartLoop();
        },
        // onClose
        (ev) => {
          console.warn("[WS] close:", ev?.code, ev?.reason || "");
          socketOpenRef.current = false;
          loopStartedRef.current = false;
          if (sendTimerRef.current) { window.clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
          reconnectTimerRef.current = window.setTimeout(() => {
            openSocket();
            backoff = Math.min(backoff * 2, 10000);
          }, backoff);
        },
        // onError
        (err) => {
          console.warn("[WS] error:", err?.message || err);
        }
      );
    };

    openSocket();

    return () => {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (sendTimerRef.current) { window.clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
      try {
        const s = socketRef.current;
        if (s && s.readyState === WebSocket.OPEN) s.close();
      } catch (e) { console.debug("[WS] close skipped:", e); }
      socketRef.current = null;
      socketOpenRef.current = false;
      loopStartedRef.current = false;
    };
  }, []); // ✅ mount/unmount에만 열고 닫기 (콜백은 ref로 최신 유지)

  // 렌더: 부모 컨테이너(.cam)가 사이즈를 책임지므로 100%로 채움
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 비디오는 숨기고, 두 캔버스를 레이어로 겹쳐 표시 */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />

      {/* 바닥: 비디오 캔버스 */}
      <canvas
        ref={videoCanvasRef}
        style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
      />

      {/* 위: 좌표 오버레이 캔버스 (투명) */}
      <canvas
        ref={overlayCanvasRef}
        style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}
      />
    </div>
  );
}
