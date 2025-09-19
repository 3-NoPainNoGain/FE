const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const KAKAO_AUTH_URL  = "https://kauth.kakao.com/oauth/authorize";

const GOOGLE_SCOPE = encodeURIComponent("openid email profile");
const KAKAO_SCOPE  = encodeURIComponent("profile_nickname");

export function makeAuthUrl(provider) {
  const p = provider.toLowerCase();
  if (p === "google") {
    const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirect = encodeURIComponent(import.meta.env.VITE_GOOGLE_REDIRECT_URI);
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth:state", state);
    return `${GOOGLE_AUTH_URL}?client_id=${cid}&redirect_uri=${redirect}&response_type=code&scope=${GOOGLE_SCOPE}&state=${state}&access_type=online&prompt=consent`;
  }
  if (p === "kakao") {
    const cid = import.meta.env.VITE_KAKAO_CLIENT_ID;
    const redirect = encodeURIComponent(import.meta.env.VITE_KAKAO_REDIRECT_URI);
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth:state", state);
    return `${KAKAO_AUTH_URL}?client_id=${cid}&redirect_uri=${redirect}&response_type=code&state=${state}`;
  }
  throw new Error("Unsupported provider");
}
