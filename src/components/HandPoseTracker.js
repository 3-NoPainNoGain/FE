import React, { useRef, useEffect, useState } from 'react';
import { connectWebSocket } from '../utils/websocket';

const drawHandKeypoints = (ctx, rawCoordinates, isLeft = true) => {
  if (!rawCoordinates || rawCoordinates.length !== 258 || !ctx) return;

  const poseLength = 33 * 4;  //  visibility 포함
  const handLength = 21 * 3;
  const leftHandOffset = poseLength;
  const rightHandOffset = poseLength + handLength;
  const handOffset = isLeft ? leftHandOffset : rightHandOffset;

  const handPoints = [];

  for (let i = 0; i < 21; i++) {
    const x = rawCoordinates[handOffset + i * 3] * ctx.canvas.width;
    const y = rawCoordinates[handOffset + i * 3 + 1] * ctx.canvas.height;
    handPoints.push([x, y]);
  }

  ctx.fillStyle = isLeft ? 'lime' : 'deepskyblue';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2;

  for (const [x, y] of handPoints) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  const fingers = [
    [0, 1, 2, 3, 4],       // 엄지
    [0, 5, 6, 7, 8],       // 검지
    [0, 9, 10, 11, 12],    // 중지
    [0, 13, 14, 15, 16],   // 약지
    [0, 17, 18, 19, 20],   // 새끼손가락
  ];

  for (const finger of fingers) {
    ctx.beginPath();
    for (let i = 0; i < finger.length - 1; i++) {
      const [x1, y1] = handPoints[finger[i]];
      const [x2, y2] = handPoints[finger[i + 1]];
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
};

const drawPoseKeypoints = (ctx, rawCoordinates) => {
  if (!rawCoordinates || rawCoordinates.length !== 258 || !ctx) return;

  const poseIndices = [0, 11, 12, 13, 14, 15, 16]; // 총 7개
  const points = [];

  for (let i = 0; i < poseIndices.length; i++) {
    const idx = poseIndices[i];
    const x = rawCoordinates[idx * 4] * ctx.canvas.width;
    const y = rawCoordinates[idx * 4 + 1] * ctx.canvas.height;
    const v = rawCoordinates[idx * 4 + 3];  // visibility

    if (v > 0.2) {
      points.push([x, y]);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    } else {
      points.push(null);
    }
  }

  const connections = [
    [1, 3], [3, 5],   // 왼쪽 어깨 → 팔꿈치 → 손목
    [2, 4], [4, 6],   // 오른쪽 어깨 → 팔꿈치 → 손목
    [1, 2],           // 양 어깨 연결
  ];

  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;

  for (const [a, b] of connections) {
    if (points[a] && points[b]) {
      const [x1, y1] = points[a];
      const [x2, y2] = points[b];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
};

function HandPoseTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognizedText, setRecognizedText] = useState('');
  const socket = useRef(null);

  useEffect(() => {
    socket.current = connectWebSocket('ws://localhost:8000/ws', (data) => {
      console.log("예측 결과 수신:", data.result);
      setRecognizedText(data.result);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      drawPoseKeypoints(ctx, data.coordinates);
      drawHandKeypoints(ctx, data.coordinates, true);
      drawHandKeypoints(ctx, data.coordinates, false);
    });

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        console.log("스트림 가져옴");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            console.log("비디오 시작됨");
          };
        }
      })
      .catch((err) => {
        console.error("카메라 접근 실패:", err.name, err.message);
      });

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && socket.current.readyState === WebSocket.OPEN) {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        socket.current.send(base64Image);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width="640"
        height="480"
        style={{ display: 'none' }}
      />

      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ border: '1px solid black' }}
      />

      <div id="result" style={{ marginTop: '20px', fontSize: '20px', color: 'blue' }}>
        {recognizedText ? `수어 인식 결과: ${recognizedText}` : '수어 인식 대기 중...'}
      </div>
    </div>
  );
}

export default HandPoseTracker;
