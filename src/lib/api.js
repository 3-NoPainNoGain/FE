// src/lib/api.js
import axios from "axios";

/**
 * 배포 서버로 직접 호출 (프록시 미사용)
 * 최종 요청: https://handdoc.store/api/...
 */
export const api = axios.create({
  baseURL: "https://handdoc.store/api",
  withCredentials: true, // ← 로그인 세션(쿠키) 전달
  timeout: 15000,
});

// (선택) JWT도 함께 쓰면 여기서 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response) {
      const { status, config, data } = error.response;
      console.warn("[API ERROR]", {
        url: config?.url,
        method: config?.method,
        status,
        data,
      });
      const msg =
        data?.message ||
        data?.error ||
        `요청 실패(${status}) - ${config?.url}`;
      const err = new Error(msg);
      // 게스트 전환을 위해 status를 보존
      err.status = status;
      return Promise.reject(err);    } else {
      console.warn("[API ERROR - NO RESPONSE]", error?.message || error);
      return Promise.reject(
        new Error(`네트워크 오류 - ${error?.message || error}`)
      );
    }
  }
);
