// 코드 제목: axios.js (CRA 대응: process.env.REACT_APP_* 사용)
//
// - Vite 전용 import.meta.env 제거
// - baseURL은 "도메인"까지만 두고, 요청 시 절대경로(/api/v2/...)를 사용
// - Authorization 헤더 자동 첨부

import axios from "axios";

// .env 에서 REACT_APP_API_ORIGIN을 읽음. 없으면 handdoc.store 기본값
const BASE_URL = process.env.REACT_APP_API_ORIGIN || "https://handdoc.store";

export const api = axios.create({
  baseURL: BASE_URL, // 예: https://handdoc.store
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
