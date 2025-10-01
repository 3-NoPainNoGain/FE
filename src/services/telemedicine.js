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
    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/sign`,
      payload
    );
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
    return data;
  } catch (err) {
    console.error("[API FAIL] 의사 음성 업로드 실패:", err);
    throw err;
  }
}

/**
 * [환자 → 음성 업로드(즉시 저장)]
 */
export async function sendPatientSpeechToDB(roomId, audioBlob) {
  try {
    const audioFile = toAudioFile(audioBlob, "audio/webm");

    let namedFile = audioFile;
    try {
      if (
        !(audioFile instanceof File) ||
        !audioFile.name?.startsWith?.("patient_")
      ) {
        namedFile = new File(
          [audioFile],
          `patient_${audioFile.name || "speech.webm"}`,
          { type: audioFile.type || "audio/webm" }
        );
      }
    } catch (err) {
      console.warn("[sendPatientSpeechToDB] 파일명 재설정 실패:", err);
      namedFile = audioFile;
    }

    const formData = new FormData();
    formData.append("file", namedFile);

    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/speech-patient-normal`,
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

/* ============================================================
 * ✅ 새로 추가: 2단계 분리 플로우 지원 (STT → 후보)
 * ========================================================== */

/**
 * [1단계] 환자 음성을 STT만 수행
 */
export async function transcribePatientSpeech(roomId, audioBlob) {
  const form = new FormData();
  form.append("file", toAudioFile(audioBlob, "audio/webm"));

  const { data } = await api.post(
    `/v2/telemed/${encodeURIComponent(roomId)}/speech-patient`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  const res = data?.results ?? data ?? {};
  const text = typeof res === "string" ? res : (res?.text ?? "");
  console.log("[API OK] STT only:", { text });

  return { text };
}

/**
 * [2단계] 텍스트로 GPT 후보 생성
 * ✅ BE 스펙에 맞게 /speech-text 로 수정
 */
export async function generatePatientSpeechCandidates(roomId, payload) {
  const body = {
    recordedText: String(payload?.text || "").trim(),
    max: payload?.max ?? 3,
  };
  if (!body.recordedText) return { candidates: [] };

  const { data } = await api.post(
    `/v2/telemed/${encodeURIComponent(roomId)}/speech-text`,
    body,
    { headers: { "Content-Type": "application/json" } }
  );

  const res = data?.results ?? data ?? {};
  const candidates = res?.candidates ?? [];
  console.log("[API OK] GPT candidates:", candidates);

  return { candidates: Array.isArray(candidates) ? candidates : [] };
}

/**
 * [환자 → 후보 중 선택 확정 전송]
 */
export async function sendPatientSelectedSpeechToDB(roomId, selectedText) {
  const payload = { selectedText: String(selectedText || "").trim() };
  if (!payload.selectedText) throw new Error("선택된 문장이 없습니다.");
  try {
    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/speech-patient/send`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("[API OK] 환자 선택 문장 전송 성공:", data);
    return data;
  } catch (err) {
    console.error("[API FAIL] 환자 선택 문장 전송 실패:", err);
    throw err;
  }
}

/**
 * [세션 종료]
 */
export async function endSession(roomId) {
  try {
    const { data } = await api.post(
      `/v2/telemed/${encodeURIComponent(roomId)}/end`
    );
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

/* 요약/히스토리 */
export async function getTelemedSummary(
  roomId,
  { retries = 4, baseDelayMs = 700 } = {}
) {
  if (!roomId) throw new Error("roomId is required");

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
      const delay = baseDelayMs * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

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
