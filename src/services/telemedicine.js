// src/services/telemedicine.js
import { api } from "../lib/api";

/**
 * [환자 → 텍스트 전송]
 * 번역된 수어 텍스트를 서버 DB에 저장
 *
 * @param {string} roomId - 현재 WebRTC 방(roomId 또는 reservationId)
 * @param {string} text - 변환된 텍스트 메시지
 * @returns {Promise<object>} 서버 응답 데이터
 */
export async function sendSignTextToDB(roomId, text) {
  const payload = { message: (text || "").trim() };
  if (!payload.message) return { skipped: true };

  const { data } = await api.post(`/v2/telemed/${roomId}/sign`, payload);
  return data;
}

/**
 * [의사 → 음성 업로드]
 * 녹음된 의사 음성 파일을 서버에 업로드하여
 * 1) STT 변환 (CLOVA)
 * 2) 변환된 텍스트 DB 저장
 * 을 요청
 *
 * @param {string} roomId - 현재 WebRTC 방(roomId 또는 reservationId)
 * @param {Blob} audioBlob - 녹음된 오디오(blob)
 * @returns {Promise<object>} 서버 응답 데이터 (예: { text: "인식된 문장" })
 */
export async function sendSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();

  // 서버가 File 객체를 기대할 수 있으므로 Blob → File 변환
  const audioFile =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "speech.webm", { type: "audio/webm" });

  formData.append("file", audioFile);

  const { data } = await api.post(`/v2/telemed/${roomId}/speech`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}
