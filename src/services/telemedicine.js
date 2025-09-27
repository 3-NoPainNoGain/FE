// 파일: src/services/telemedicine.js
import { api } from "../lib/api";

/**
 * [환자 → 텍스트 전송]
 */
export async function sendSignTextToDB(roomId, text) {
  const payload = { message: (text || "").trim() };
  if (!payload.message) return { skipped: true };
  const { data } = await api.post(`/v2/telemed/${roomId}/sign`, payload);
  return data;
}

/**
 * [의사 → 음성 업로드]
 */
export async function sendSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();
  const audioFile =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "speech.webm", { type: audioBlob?.type || "audio/webm" });
  formData.append("file", audioFile);

  const { data } = await api.post(`/v2/telemed/${roomId}/speech`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * [환자 → 음성 업로드]
 */
export async function sendPatientSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();
  const audioFile =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "patient_speech.webm", { type: audioBlob?.type || "audio/webm" });
  formData.append("file", audioFile);

  const { data } = await api.post(`/v2/telemed/${roomId}/speech-patient`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * [세션 종료]
 * - 다른 쪽이 먼저 끝내서 404/409가 오면 성공으로 간주하고 계속 진행
 */
export async function endSession(roomId) {
  try {
    const { data } = await api.post(`/v2/telemed/${roomId}/end`);
    return data;
  } catch (err) {
    const status = err?.response?.status || err?.status;
    if (status === 404 || status === 409) {
      console.warn("[endSession] 이미 종료된 방(무시):", status);
      return { alreadyEnded: true };
    }
    console.error("[API FAIL] 세션 종료 실패:", err);
    throw err;
  }
}

/**
 * [비대면 진료 요약 조회]
 * - 서버가 요약 생성 중일 때를 대비해 짧게 재시도
 */
export async function getTelemedSummary(
  roomId,
  { retries = 4, baseDelayMs = 700 } = {}
) {
  if (!roomId) throw new Error("roomId is required");

  // 재시도 대상 상태코드 (요약 생성/반영 지연, 과부하 등)
  const RETRY = new Set([401, 404, 409, 425, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await api.get(
        `/v2/telemed/${encodeURIComponent(roomId)}/summary`,
        { headers: { Accept: "application/json" } }
      );
      return data?.results ?? data;
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const isLast = attempt === retries;
      if (!RETRY.has(status) || isLast) {
        console.error("[API FAIL] 요약 조회 실패:", err);
        throw err;
      }
      // 지수 백오프: 0.7s → 1.4s → 2.1s …
      const delay = baseDelayMs * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
