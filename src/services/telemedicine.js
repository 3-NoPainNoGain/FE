// 파일: src/services/telemedicine.js
import { api } from "../lib/api";

/**
 * [환자 → 텍스트 전송]
 */
export async function sendSignTextToDB(roomId, text) {
  const payload = { message: (text || "").trim() };
  if (!payload.message) return { skipped: true };

  try {
    const { data } = await api.post(`/v2/telemed/${roomId}/sign`, payload);
    console.log(`[API OK] 수어 텍스트 저장 성공: "${payload.message}"`);
    return data;
  } catch (err) {
    console.error("[API FAIL] 수어 텍스트 저장 실패:", err);
    throw err;
  }
}

/**
 * [의사 → 음성 업로드]
 */
export async function sendSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();
  const audioFile =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "speech.webm", { type: "audio/webm" });
  formData.append("file", audioFile);

  try {
    const { data } = await api.post(`/v2/telemed/${roomId}/speech`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("[API OK] 의사 음성 업로드 & STT 변환 성공:", data);
    return data;
  } catch (err) {
    console.error("[API FAIL] 의사 음성 업로드 실패:", err);
    throw err;
  }
}

/**
 * [환자 → 음성 업로드]
 */
export async function sendPatientSpeechToDB(roomId, audioBlob) {
  const formData = new FormData();
  const audioFile =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], "patient_speech.webm", { type: "audio/webm" });
  formData.append("file", audioFile);

  try {
    const { data } = await api.post(`/v2/telemed/${roomId}/speech-patient`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("[API OK] 환자 음성 업로드 성공:", data);
    return data;
  } catch (err) {
    console.error("[API FAIL] 환자 음성 업로드 실패:", err);
    throw err;
  }
}

/**
 * [세션 종료]
 */
export async function endSession(roomId) {
  try {
    const { data } = await api.post(`/v2/telemed/${roomId}/end`);
    console.log("[API OK] 세션 종료 성공:", data);
    return data;
  } catch (err) {
    console.error("[API FAIL] 세션 종료 실패:", err);
    throw err;
  }
}

/**
 * [비대면 진료 요약 조회]
 */
export async function getTelemedSummary(roomId) {
  if (!roomId) throw new Error("roomId is required");
  try {
    const { data } = await api.get(`/v2/telemed/${encodeURIComponent(roomId)}/summary`);
    // 서버가 { isSuccess, results } 형태면 results 우선 반환
    return data?.results ?? data;
  } catch (err) {
    console.error("[API FAIL] 요약 조회 실패:", err);
    throw err;
  }
}

/**
 * [비대면 진료 내역 조회]
 */
export async function getTelemedHistory({ page = 0, size = 10 } = {}) {
  try {
    const { data } = await api.get("/v2/telemed/history", {
      params: { page, size },
    });
    const results = data?.results ?? data ?? {};
    return {
      items: results.items ?? [],
      page: results.page ?? page,
      size: results.size ?? size,
      totalPages: results.totalPages ?? 1,
      totalElements: results.totalElements ?? (results.items?.length ?? 0),
      hasNext: !!results.hasNext,
    };
  } catch (err) {
    console.error("[API FAIL] 비대면 진료 내역 조회 실패:", err);
    throw err;
  }
}

// 비대면 진료 내역 상세 조회 (GET /api/v2/telemed/history/{roomId})
export async function getTelemedHistoryDetail(roomId) {
  if (!roomId) throw new Error("roomId is required");
  try {
    const { data } = await api.get(`/v2/telemed/history/${encodeURIComponent(roomId)}`);
    // 문서 예시 구조: { isSuccess, results: { chat: {messages: [...]}, summary: {...} } }
    return data?.results ?? data;
  } catch (err) {
    console.error("[API FAIL] 비대면 진료 내역 상세 조회 실패:", err);
    throw err;
  }
}

