// src/utils/websocket.js

// 웹소켓 연결 설정
export function connectWebSocket(url, onMessage) {
  const socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('WebSocket 연결 성공');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (onMessage) onMessage(data);
  };

  socket.onerror = (error) => {
    console.error('WebSocket 오류:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket 연결 종료');
  };

  return socket;
}

