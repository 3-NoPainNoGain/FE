// [코드 제목] Auth 서비스 모듈 (소셜 코드 교환 / 사용자 이름 업데이트 / me 조회 / 로그아웃)
// 파일: src/services/auth.js

import axios from "axios";
import { api } from "../auth/axios";

/** 내부 공통 에러 메시지 추출 */
function extractMsg(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    fallback ||
    "요청 처리 중 오류가 발생했습니다."
  );
}

/**
 * 소셜 인가코드를 백엔드에 넘겨 액세스 토큰을 교환한다.
 * 백엔드 스펙: POST /api/v2/auth/login/{loginType}?code=...
 * 응답 예시: { isSuccess, code, message, results: { name, role, accessToken } }
 *
 * @param {'KAKAO'|'GOOGLE'} loginType - 반드시 대문자
 * @param {string} code - OAuth 인가코드
 * @returns {Promise<{name:string|null, role:string, accessToken:string}>}
 */
export async function exchangeCodeForToken(loginType, code) {
  if (!code) throw new Error("인가코드(code)가 없습니다.");
  if (!loginType) throw new Error("loginType이 없습니다.");

  // NOTE: 이 엔드포인트는 베이스 경로 포함한 절대 URL로 호출 (리디렉트/쿠키 정책 이슈 방지)
  const url = `https://handdoc.store/api/v2/auth/login/${loginType}?code=${encodeURIComponent(
    code
  )}`;

  try {
    const { data } = await axios.post(url, null, {
      withCredentials: true, // 서버가 허용해주면 유지
      headers: { "Content-Type": "application/json" },
    });

    const res = data?.results;
    if (res?.accessToken) return res;

    throw new Error(data?.message || "토큰 교환 실패");
  } catch (err) {
    throw new Error(extractMsg(err, "소셜 로그인 처리에 실패했습니다."));
  }
}

/**
 * 사용자 이름 업데이트
 * 백엔드 스펙: POST /api/v2/user/name  Body: { "name": "홍길동" }
 * 성공 예시: { isSuccess: true, code: "REQUEST_OK", message, results: {} }
 *
 * @param {string} name
 * @returns {Promise<{isSuccess:boolean, code:string, message:string, results:any}>}
 */
export async function updateUserName(name) {
  if (!name || !name.trim()) throw new Error("이름을 입력해 주세요.");
  try {
    const { data } = await api.post("/v2/user/name", { name: name.trim() });
    // 성공 판단은 isSuccess 또는 code에 OK 포함 여부로 유연 처리
    if (data?.isSuccess || String(data?.code || "").includes("OK")) return data;
    throw new Error(data?.message || "이름 저장 실패");
  } catch (err) {
    throw new Error(extractMsg(err, "이름을 저장하지 못했습니다."));
  }
}

/**
 * 로그인한 사용자 정보 조회
 * 예: GET /api/v2/auth/me  -> { isSuccess, results: { id, name, role, ... } }
 */
export async function fetchMe() {
  try {
    const { data } = await api.get("/v2/auth/me");
    return data?.results ?? data;
  } catch (err) {
    throw new Error(extractMsg(err, "사용자 정보를 불러오지 못했습니다."));
  }
}

/**
 * 로그아웃 요청(선택)
 * 백엔드에 엔드포인트가 있을 때만 사용: POST /api/v2/auth/logout
 * 실패하더라도 클라이언트 측 토큰 정리는 별도로 처리 권장.
 */
export async function requestLogout() {
  try {
    const { data } = await api.post("/v2/auth/logout");
    return data;
  } catch (err) {
    // 로그아웃은 실패해도 조용히 무시하거나 메시지 반환
    return { isSuccess: false, message: extractMsg(err) };
  }
}
