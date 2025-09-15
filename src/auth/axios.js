// 코드 제목: 공통 Axios 인스턴스 (토큰 자동첨부, 401 대비 준비)
//
// - baseURL만 프로젝트에 맞게 바꿔줘요.
// - accessToken이 있으면 Authorization 헤더에 자동 첨부됩니다.
// - 401 대응(리프레시)은 나중 단계에서 추가해도 됨.

import axios from "axios";

export const api = axios.create({
  baseURL: "https://handdoc.store/api", // ← 필요시 .env로 분리
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
