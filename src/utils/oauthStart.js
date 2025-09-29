function randomState(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function startOAuth(provider) {
  const state = randomState();
  sessionStorage.setItem("oauth:state", state);

  if (provider === "kakao") {
    const clientId = process.env.REACT_APP_KAKAO_CLIENT_ID || "";
    const redirectUri = process.env.REACT_APP_KAKAO_REDIRECT_URI || `${window.location.origin}/oauth/kakao/callback`;
    if (!clientId) {
      alert("KAKAO CLIENT_ID가 비어 있습니다. .env를 확인하세요.");
      return;
    }
    const url =
      "https://kauth.kakao.com/oauth/authorize" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}`;
    window.location.href = url;
    return;
  }

  if (provider === "google") {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
    const redirectUri = process.env.REACT_APP_GOOGLE_REDIRECT_URI || `${window.location.origin}/oauth/google/callback`;
    if (!clientId) {
      alert("GOOGLE CLIENT_ID가 비어 있습니다. .env를 확인하세요.");
      return;
    }
    const scope = "email profile";
    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=select_account` +
      `&state=${encodeURIComponent(state)}`;
    window.location.href = url;
    return;
  }

  alert("지원하지 않는 provider 입니다.");
}
