import React, { useRef, useEffect, useState } from 'react';
import { connectWebSocket, sendCoordinates } from '../utils/websocket';

function HandPoseTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recognizedText, setRecognizedText] = useState('');
  const socket = useRef(null);

  useEffect(() => {
    // WebSocket 연결 설정
    socket.current = connectWebSocket('ws://localhost:8000/ws', (data) => {
      console.log(" 받은 응답:", data); 
      setRecognizedText(data.text);
    });

    const onResults = (results) => {
      const coordinates = [];
      // (7 pose x 4) + (21 x 3 왼손) + (21 x 3 오른손) = 154차원
      const poseIndices = [0, 11, 12, 13, 14, 15, 16];

      // 상반신 포즈 좌표 수집
      if (results.poseLandmarks) {
        poseIndices.forEach((index) => {
          const landmark = results.poseLandmarks[index];
          coordinates.push(landmark.x, landmark.y, landmark.z, landmark.visibility);
        });
      }

      // 왼손 좌표 수집
      if (results.leftHandLandmarks) {
        results.leftHandLandmarks.forEach((landmark) => {
          coordinates.push(landmark.x, landmark.y, landmark.z);
        });
      }

      // 오른손 좌표 수집
      if (results.rightHandLandmarks) {
        results.rightHandLandmarks.forEach((landmark) => {
          coordinates.push(landmark.x, landmark.y, landmark.z);
        });
      }

      // 좌표가 154개면 전송
      if (coordinates.length === 154) {
        console.log("좌표 전송:", coordinates);
        sendCoordinates(socket.current, coordinates);
      }
    };

    // Mediapipe 설정
    const holistic = new window.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.4/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      refineFaceLandmarks: false,
      upperBodyOnly: true,
      enableFaceGeometry: false,
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
