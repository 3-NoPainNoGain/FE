import { api } from "../lib/api";

/**
 * 6번 API: 번역된 수어 텍스트를 서버 DB에 저장
 * @param {string} roomId - 현재 진료실 ID
 * @param {string} text - 저장할 텍스트 메시지
 */
export async function sendSignTextToDB(roomId, text) {
  const payload = { message: text };
  const { data } = await api.post(`/v2/telemed/${roomId}/sign`, payload);
  return data;
}

/**
 * 7번 API: 녹음된 의사 음성 파일을 서버에 업로드하여 STT 변환 및 DB 저장을 요청
 * @param {string} roomId - 현재 진료실 ID
 * @param {Blob} audioBlob - 녹음된 오디오 파일 (blob)
 */
export async function sendSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();
  // 서버에서 요구하는 파일 형식이 File 객체일 수 있으므로 변환
  const audioFile = new File([audioBlob], "speech.webm", { type: "audio/webm" });
  formData.append("file", audioFile);

  const { data } = await api.post(`/v2/telemed/${roomId}/speech`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data; // 서버로부터 받은 STT 결과 텍스트 등을 반환
}