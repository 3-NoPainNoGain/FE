import axios from "axios";

/**
 * 소셜 인가코드를 백엔드에 넘겨 액세스 토큰을 교환한다.
 * @param {'KAKAO'|'GOOGLE'} loginType - 반드시 대문자
 * @param {string} code                - OAuth 인가코드
 * @returns {Promise<{name:string|null, role:string, accessToken:string}>}
 */
export async function exchangeCodeForToken(loginType, code) {
  if (!code) throw new Error("인가코드(code)가 없습니다.");
  if (!loginType) throw new Error("loginType이 없습니다.");

  const url = `https://handdoc.store/api/v2/auth/login/${loginType}?code=${encodeURIComponent(
    code
  )}`;

  try {
    const { data } = await axios.post(url, null, {
      // 서버가 CORS에 Access-Control-Allow-Credentials: true 를 내려주므로 유지
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });
    // 기대 응답 형태: { isSuccess, code, message, results: { name, role, accessToken } }
    if (data?.results?.accessToken) return data.results;
    throw new Error(data?.message || "토큰 교환 실패");
  } catch (err) {
    // 백엔드 오류 메시지 싹 끌어올려서 화면에 보여주기
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "소셜 서버에서 액세스 토큰을 받아오는 데 실패했습니다.";
    throw new Error(msg);
  }
}
