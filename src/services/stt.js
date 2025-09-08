// src/services/stt.js
import { api } from "../lib/api.js";

/**
 * 브라우저 내장 Web Speech API 래퍼
 * - 실시간/최종 텍스트를 UI에 바로 보여줄 때 사용
 * - DB 저장은 별도로 /speech 업로드(서버 STT)로 처리
 */
export function createBrowserSTT({ lang = "ko-KR", interimResults = false } = {}) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error("이 브라우저는 Web Speech API를 지원하지 않습니다.");
  }

  const rec = new SpeechRecognition();
  rec.lang = lang;
  rec.interimResults = interimResults;
  rec.continuous = false;

  let onText = () => {};
  let onError = () => {};

  rec.onresult = (e) => {
    const text = Array.from(e.results)
      .map((r) => (r && r[0] ? r[0].transcript : "") || "")
      .join(" ")
      .trim();
    if (text) onText(text);
  };

  rec.onerror = (e) => {
    onError(e);
  };

  return {
    start({ onText: _onText, onError: _onError } = {}) {
      onText = _onText || onText;
      onError = _onError || onError;
      rec.start();
    },
    stop() {
      try {
        rec.stop();
      } catch (e) {
        // 일부 브라우저에서 stop 중복 호출 시 예외 발생 가능 → 무시
        // console.debug("STT stop error:", e);
      }
    },
  };
}

/**
 * 서버 업로드 STT
 * - POST /v1/diagnosis/{id}/speech (multipart/form-data, 필드명 "file")
 * - 프록시(baseURL: "/api")가 붙으므로 여기서는 경로를 "/v1/..."로만 작성
 * - 서버가 STT 변환 + DB 저장까지 처리함
 */
export async function uploadSpeech(diagnosisId, audioBlob) {
  const id = encodeURIComponent(String(diagnosisId));
  const form = new FormData();
  form.append(
    "file",
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "speech.webm", { type: "audio/webm" })
  );

  const { data } = await api.post(`/v1/diagnosis/${id}/speech`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { text: "..." }
}
