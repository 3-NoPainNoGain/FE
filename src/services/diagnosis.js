import { api } from "../lib/api.js";

/** 세션 시작 */
export async function startDiagnosisSession(payload = {}) {
  const { data } = await api.post("/v1/diagnosis/start", payload);
  return Array.isArray(data?.diagnosisId)
    ? data.diagnosisId
    : data?.diagnosisId
    ? [String(data.diagnosisId)]
    : [];
}

/** 수어/텍스트 전달 (서버 스펙: { message }) */
export async function sendSignText(diagnosisId, text) {
  const id = encodeURIComponent(String(diagnosisId));
  const body = { message: (text ?? "").trim() };
  if (!body.message) return { skipped: true };
  const { data } = await api.post(`/v1/diagnosis/${id}/sign`, body);
  return data;
}

/** 음성 업로드 → STT (필드명 "file") */
export async function uploadDiagnosisSpeech(diagnosisId, file) {
  const id = encodeURIComponent(String(diagnosisId));
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/v1/diagnosis/${id}/speech`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { text: "..." }
}

/** 진료 종료 */
export async function endDiagnosisSession(diagnosisId, payload = {}) {
  const id = encodeURIComponent(String(diagnosisId));
  const { data } = await api.patch(`/v1/diagnosis/${id}/end`, payload);
  return data;
}

/** 요약 조회 */
export async function getDiagnosisSummary(diagnosisId) {
  const id = encodeURIComponent(String(diagnosisId));
  const { data } = await api.get(`/v1/diagnosis/${id}/summary`);
  return data;
}

/* 하위 호환 export */
export { uploadDiagnosisSpeech as uploadSpeech };
