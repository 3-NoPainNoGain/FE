// src/services/reservation.js
import { api } from "../lib/api";
import { USE_MOCK, MOCK_ROOM_ID } from "../config";

/**
 * 예약 참가 (환자/의사 공용) — Swagger 기준
 * POST /api/v2/telemed/{reservationId}/join
 */
export async function joinReservation(reservationId, roleHint) {
  if (USE_MOCK) {
    const role = roleHint === "doctor" ? "ROLE_DOCTOR" : "ROLE_PATIENT";
    const status = role === "ROLE_DOCTOR" ? "ACTIVE" : "WAITING";
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            roomId: reservationId || MOCK_ROOM_ID,
            role,
            status,
            wsUrl: "mock://signaling",
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          }),
        120
      )
    );
  }

  const { data } = await api.post(`/v2/telemed/${reservationId}/join`);
  if (!data?.isSuccess) throw new Error(data?.message || "예약 참가 실패");

  const r = data.results || {};
  return {
    roomId: r.roomId ?? r.room_id ?? `${reservationId}`,
    role: r.role ?? r.userRole ?? r.user_role ?? "ROLE_PATIENT",
    status: r.status ?? r.sessionStatus ?? r.session_status ?? "WAITING",
    wsUrl: r.wsUrl ?? r.ws_url ?? "wss://handdoc.store/ws/signaling",
    iceServers:
      r.iceServers ??
      r.ice_servers ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
  };
}
