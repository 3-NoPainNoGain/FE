import axios from "axios";

export const api = axios.create({
  baseURL: "https://handdoc.store",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// 요청마다 토큰 자동 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
