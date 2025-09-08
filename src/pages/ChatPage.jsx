import React, { useState, useEffect } from "react";
import ChatMessage from "../components/ChatMessage";

export default function ChatPage() {
  // 채팅 메시지 목록 (서버에서 받을 수도 있고, 테스트용 하드코딩 가능)
  const [messages, setMessages] = useState([]);

  // 예시: 액션 순서대로 메시지 추가
  useEffect(() => {
    // 실제로는 WebSocket, API 응답에서 받아서 setMessages에 추가
    const sampleMessages = [
      { id: 1, type: "voice", text: "안녕하세요", timestamp: 1 },
      { id: 2, type: "sign", text: "반갑습니다", timestamp: 2 },
      { id: 3, type: "voice", text: "진료 시작하겠습니다", timestamp: 3 },
    ];
    setMessages(sampleMessages);
  }, []);

  // timestamp 순서대로 정렬
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">실시간 채팅</h2>
      <div className="space-y-2">
        {sortedMessages.map((msg) => (
          <ChatMessage key={msg.id} type={msg.type} text={msg.text} />
        ))}
      </div>
    </div>
  );
}
