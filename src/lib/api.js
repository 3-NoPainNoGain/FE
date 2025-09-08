import axios from "axios";

/**
 * 배포 서버로 직접 호출 (프록시 미사용)
 * 최종 요청: https://handdoc.store/api/v1/...
 */
export const api = axios.create({
  baseURL: "https://handdoc.store/api",
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // 디버그용 에러 로그
    if (error?.response) {
      const { status, config, data } = error.response;
      console.warn("[API ERROR]", {
        url: config?.url,
        method: config?.method,
        status,
        data,
      });
      const msg = data?.message || data?.error || `요청 실패(${status}) - ${config?.url}`;
      return Promise.reject(new Error(msg));
    } else {
      console.warn("[API ERROR - NO RESPONSE]", error?.message || error);
      return Promise.reject(new Error(`네트워크 오류 - ${error?.message || error}`));
    }
  }
);
