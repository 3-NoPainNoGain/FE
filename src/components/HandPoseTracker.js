import React, { useRef, useEffect, useState } from 'react';
import { connectWebSocket } from '../utils/websocket';

function HandPoseTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognizedText, setRecognizedText] = useState('');
  const socket = useRef(null);

  useEffect(() => {
    // WebSocket 연결
    socket.current = connectWebSocket('ws://localhost:8000/ws', (data) => {
      console.log("예측 결과 수신:", data.result);
      setRecognizedText(data.result);
    });

    // 카메라 스트림 가져오기
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        console.log("스트림 가져옴")
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
      <video ref={videoRef} autoPlay playsInline muted width="640" height="480"/>
      <canvas ref={canvasRef} width="640" height="480" style={{ border: '1px solid black', display : 'none'}} />
      <div id="result" style={{ marginTop: '20px', fontSize: '20px', color: 'blue' }}>
        {recognizedText ? `수어 인식 결과: ${recognizedText}` : '수어 인식 대기 중...'}
      </div>
    </div>
  );
}

export default HandPoseTracker;
