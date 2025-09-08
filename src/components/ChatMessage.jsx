import React from "react";

export default function ChatMessage({ type, text }) {
  // 타입별 색상
  const bgColor =
    type === "voice"
      ? "bg-pink-200" // 음성 → 핑크
      : type === "sign"
      ? "bg-blue-200" // 수어 → 파랑
      : "bg-gray-200";

  return (
    <div
      className={`p-2 rounded-md ${bgColor} max-w-xs`}
    >
      {text}
    </div>
  );
}
