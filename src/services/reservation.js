// src/services/reservation.js
// 예약 목록/단건/수락·거절/취소/WebRTC join - 실제 API 연동
// NOTE: api 인스턴스 경로는 프로젝트에 맞춰 조정하세요.
import { api } from "../auth/axios";

export const STATUS = {
  REQUESTED: "REQUESTED",
  CONFIRMED: "CONFIRMED",
  CANCELED: "CANCELED",
  COMPLETED: "COMPLETED",
};

function ensureOk(resp) {
  if (!resp?.data?.isSuccess) {
    throw new Error(resp?.data?.message || "요청 실패");
  }
  return resp.data.results ?? {};
}

// 목록 조회: GET /api/v2/reservation?page=&size=
export async function listReservations({ page = 0, size = 10 } = {}) {
  const resp = await api.get(`/api/v2/reservation`, { params: { page, size } });
  const results = ensureOk(resp);
  return {
    items: Array.isArray(results.items) ? results.items : [],
    page: results.page ?? page,
    size: results.size ?? size,
    totalElements: results.totalElements ?? 0,
    totalPages: results.totalPages ?? 0,
    hasNext: !!results.hasNext,
  };
}

// 단건 조회: GET /api/v2/reservation/{reservationId}
export async function getReservation(reservationId) {
  const resp = await api.get(`/api/v2/reservation/${reservationId}`);
  return ensureOk(resp);
}

// 수락/거절: POST /api/v2/reservation/{reservationId}/accept  { accept: true|false }
export async function setReservationDecision(reservationId, accept) {
  const resp = await api.post(`/api/v2/reservation/${reservationId}/accept`, {
    accept: !!accept,
  });
  ensureOk(resp);
  return true;
}

// 환자 취소: DELETE /api/v2/reservation/{reservationId}
export async function cancelReservation(reservationId) {
  const resp = await api.delete(`/api/v2/reservation/${reservationId}`);
  ensureOk(resp);
  return true;
}

// WebRTC 참가 (공용): POST /api/v2/telemed/{reservationId}/join
// src/services/reservation.js
export async function joinReservation(reservationId, roleHint) {
  const token = localStorage.getItem("accessToken");
  const { data } = await api.post(
    `/api/v2/telemed/${reservationId}/join`,
    { roleHint }, // body로 함께 전송
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!data?.isSuccess) throw new Error(data?.message || "예약 참가 실패");
  const r = data.results || {};
  return {
    roomId: r.roomId ?? `${reservationId}`,
    role:
      r.role ??
      (roleHint === "doctor" ? "ROLE_DOCTOR" : "ROLE_PATIENT"),
    status: r.status ?? "WAITING",
    wsUrl: r.wsUrl ?? "wss://handdoc.store/ws/signaling",
    iceServers:
      r.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
  };
}

