import React, { useRef, useEffect, useState } from 'react';
import { connectWebSocket, sendCoordinates } from '../utils/websocket';

function HandPoseTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognizedText, setRecognizedText] = useState('');
  const socket = useRef(null);
  const frameBuffer = useRef([]);

  useEffect(() => {
  socket.current = connectWebSocket('ws://localhost:8000/ws', (data) => {
    console.log("받은 응답:", data); 
    setRecognizedText(data.text);
  });

  const onResults = (results) => {
    const coordinates = [];
    const poseIndices = [0, 11, 12, 13, 14, 15, 16];

    if (results.poseLandmarks) {
      poseIndices.forEach((index) => {
        const lm = results.poseLandmarks[index];
        coordinates.push(lm.x, lm.y, lm.z, lm.visibility);
      });
    }

    if (results.leftHandLandmarks) {
      results.leftHandLandmarks.forEach((lm) => {
        coordinates.push(lm.x, lm.y, lm.z);
      });
    }

    if (results.rightHandLandmarks) {
      results.rightHandLandmarks.forEach((lm) => {
        coordinates.push(lm.x, lm.y, lm.z);
      });
    }

    // 부족한 좌표는 0으로 패딩
    while (coordinates.length < 154) coordinates.push(0);

   // 유효 좌표 수 확인 (디버깅용)
    const validCount = coordinates.filter((v) => v !== 0).length;
    if (validCount < 30) {
      console.warn(`유효 좌표 부족: ${validCount}/154`);
    }

    //  무조건 프레임 누적
    frameBuffer.current.push(coordinates);
    console.log(`프레임 누적 (${frameBuffer.current.length}/30)`);

    // 30개 쌓이면 전송
    if (frameBuffer.current.length >= 30) {
      const last30 = frameBuffer.current.slice(-30);
      const allValidLength = last30.every((f) => f.length === 154);

      if (allValidLength) {
        console.log("30프레임 전송!");
        sendCoordinates(socket.current, last30);
      }

      // 최근 20프레임 유지 (슬라이딩 윈도우)
      frameBuffer.current = frameBuffer.current.slice(-20);
    }
  };

  const holistic = new window.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.4/${file}`,
  });

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    refineFaceLandmarks: true,
    upperBodyOnly: false,
  });

  holistic.onResults(onResults);

  const camera = new window.Camera(videoRef.current, {
    onFrame: async () => {
      await holistic.send({ image: videoRef.current });
    },
    width: 640,
    height: 480,
  });

  camera.start();
}, []);


  return (
    <div>
      <h2>Handoc</h2>
      <video ref={videoRef} autoPlay style={{ width: 640, height: 480 }}></video>
      <canvas ref={canvasRef} width="640" height="480" style={{ border: '1px solid black' }}></canvas>
      <div id="result" style={{ marginTop: '20px', fontSize: '20px', color: 'blue' }}>
        {recognizedText ? `수어 인식 결과: ${recognizedText}` : '수어 인식 대기 중...'}
      </div>
    </div>
  );
}

export default HandPoseTracker;
