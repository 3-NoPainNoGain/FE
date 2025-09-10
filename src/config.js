// src/config.js
export const USE_MOCK = false;              // 실서버 사용
export const MOCK_ROOM_ID = "demo-1234";    // (목용) 그대로 둬도 무방

// 로그인 없이도 WebSocket 시그널링만 붙여서 화면 연결 테스트할 때 사용
export const ENABLE_GUEST_MODE = true;      // 로그인 붙이면 false로 바꾸면 됨
