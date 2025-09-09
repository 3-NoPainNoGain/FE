import { api } from "../lib/api";
import { USE_MOCK, MOCK_ROOM_ID } from "../config";

/**
 * 예약 참가 (환자/의사 공용)
 * - USE_MOCK=true: BroadcastChannel 기반 목 시그널링 사용
 * - USE_MOCK=false: 실서버 API/WS 사용
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
            wsUrl: "mock://signaling", // ← 목 시그널링
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          }),
        120
      )
    );
  }

  // 실서버
  const { data } = await api.post(`/v2/reservation/${reservationId}/join`);
  if (!data?.isSuccess) throw new Error(data?.message || "예약 참가 실패");
  return data.results; // { roomId, role, status, wsUrl, iceServers }
}
