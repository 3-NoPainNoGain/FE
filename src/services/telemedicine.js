// 파일: src/services/telemedicine.js

import { api } from "../lib/api";

/* -----------------------------------------------------------
 * [공통] Blob → File 안전 변환 (mime/type/확장자 보정)
 * --------------------------------------------------------- */
function toAudioFile(blobOrFile, fallbackType = "audio/webm") {
  if (!blobOrFile) throw new Error("빈 오디오 데이터입니다.");
  if (blobOrFile instanceof File) return blobOrFile;

  const type = blobOrFile.type || fallbackType; // recorder가 정한 타입 우선
  const name = type.includes("ogg") ? "speech.ogg" : "speech.webm";
  try {
    return new File([blobOrFile], name, { type });
  } catch (err) {
    console.error("[toAudioFile] File 생성 실패, Blob 그대로 사용:", err);
    // 일부 환경(File 생성자 미지원)에서는 Blob 그대로 반환 → 서버에서 처리
    return blobOrFile;
  }
}

/**
 * [환자 → 텍스트 전송]
 */
export async function sendSignTextToDB(roomId, text) {
  const payload = { message: (text || "").trim() };
  if (!payload.message) return { skipped: true };

  try {
    const { data } = await api.post(`/v2/telemed/${encodeURIComponent(roomId)}/sign`, payload);
    console.log(`[API OK] 수어 텍스트 저장 성공: "${payload.message}"`);
    return data;
  } catch (err) {
    console.error("[API FAIL] 수어 텍스트 저장 실패:", err);
    throw err;
  }
}

/**
 * [의사 → 음성 업로드]
 * 백엔드 스펙: POST /api/v2/telemed/{roomId}/speech-doctor  (필드명: file)
 */
export async function sendSpeechToDB(roomId, audioBlob) {
  try {
    const formData = new FormData();
    const audioFile = toAudioFile(audioBlob);
    formData.append("file", audioFile);

    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/speech-doctor`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    console.log("[API OK] 의사 음성 업로드 & STT 변환 성공:", data);
    return data; // { text: "..." }
  } catch (err) {
    console.error("[API FAIL] 의사 음성 업로드 실패:", err);
    throw err;
  }
}

/**
 * [환자 → 음성 업로드]
 * 백엔드 스펙: POST /api/v2/telemed/{roomId}/speech-patient  (필드명: file)
 */
export async function sendPatientSpeechToDB(roomId, audioBlob) {
  try {
    const formData = new FormData();
    const audioFile = toAudioFile(audioBlob, "audio/webm");

    let namedFile = audioFile;
    try {
      // 파일명 프리픽스만 바꿔서 업로드 (환경에 따라 File 재생성 실패 가능)
      if (!(audioFile instanceof File) || !audioFile.name?.startsWith?.("patient_")) {
        namedFile = new File([audioFile], `patient_${audioFile.name || "speech.webm"}`, {
          type: audioFile.type || "audio/webm",
        });
      }
    } catch (err) {
      console.warn("[sendPatientSpeechToDB] 파일명 재설정 실패, 원본 그대로 사용:", err);
      namedFile = audioFile;
    }

    formData.append("file", namedFile);

    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/speech-patient`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    console.log("[API OK] 환자 음성 업로드 성공:", data);
    return data;
  } catch (err) {
    console.error("[API FAIL] 환자 음성 업로드 실패:", err);
    throw err;
  }
}

/**
 * [세션 종료]
 * ✅ 추가: 다른 쪽이 먼저 끝내서 404/409가 오면 성공으로 간주하고 계속 진행
 */
export async function endSession(roomId) {
  try {
    const { data } = await api.post(`/v2/telemed/${encodeURIComponent(roomId)}/end`);
    console.log("[API OK] 세션 종료 성공:", data);
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
 * ✅ 변경: 짧은 재시도(지수 백오프) 추가
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
      // 서버가 { isSuccess, results } 형태면 results 우선 반환
      return data?.results ?? data;
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const isLast = attempt === retries;
      if (!RETRY.has(status) || isLast) {
        console.error("[API FAIL] 요약 조회 실패:", err);
        throw err;
      }
      const delay = baseDelayMs * (attempt + 1); // 0.7s → 1.4s → 2.1s …
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/* ✅ 신규 추가: 비대면 진료 내역 목록 조회 (GET /api/v2/telemed/history?page&size) */
export async function getTelemedHistory({ page = 0, size = 10 } = {}) {
  try {
    const { data } = await api.get("/v2/telemed/history", { params: { page, size } });
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

/* ✅ 신규 추가: 비대면 진료 히스토리 상세 조회 (GET /api/v2/telemed/history/{roomId}) */
export async function getTelemedHistoryDetail(roomId) {
  if (!roomId) throw new Error("roomId is required");
  try {
    const { data } = await api.get(
      `/v2/telemed/history/${encodeURIComponent(roomId)}`
    );
    return data?.results ?? data;
  } catch (err) {
    console.error("[API FAIL] 히스토리 상세 조회 실패:", err);
    throw err;
  }
}
