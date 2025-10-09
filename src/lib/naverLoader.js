// src/lib/naverLoader.js
export function loadNaverScript(clientId) {
  return new Promise((resolve, reject) => {
    // 이미 로드됨
    if (window.naver && window.naver.maps) {
      console.debug("[NaverLoader] already loaded");
      resolve();
      return;
    }

    const SCRIPT_ID = "naver-maps-sdk";
    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      console.debug("[NaverLoader] script tag exists, waiting for events");

      let timeoutId;

      const cleanup = () => {
        existing.removeEventListener("load", onloadOnce);
        existing.removeEventListener("error", onerrorOnce);
      };

      const onloadOnce = () => {
        clearTimeout(timeoutId);
        cleanup();
        resolve();
      };

      const onerrorOnce = (e) => {
        clearTimeout(timeoutId);
        cleanup();
        reject(e || new Error("Naver SDK failed"));
      };

      existing.addEventListener("load", onloadOnce);
      existing.addEventListener("error", onerrorOnce);

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Naver SDK load timeout (existing tag)"));
      }, 15000);

      return;
    }

    if (!clientId || typeof clientId !== "string") {
      reject(new Error("Naver SDK: invalid clientId"));
      return;
    }

    // 🔍 디버그용: 실제 사용되는 ID 노출
    console.debug("[NaverLoader] clientId =", clientId);
    window.__NCP_MAPS_CLIENT_ID__ = clientId;

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;

    const base = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId)}`;
    s.src = base; // 지오코더 제거(지도만 로드)

    console.debug("[NaverLoader] append script:", s.src);
    document.head.appendChild(s);

    const timeoutId = setTimeout(() => {
      s.onload = null;
      s.onerror = null;
      reject(new Error("Naver SDK load timeout (new tag)"));
    }, 15000);

    s.onload = () => {
      clearTimeout(timeoutId);
      console.debug("[NaverLoader] onload fired");
      resolve();
    };

    s.onerror = (e) => {
      clearTimeout(timeoutId);
      console.error("[NaverLoader] onerror", e);
      reject(new Error("Naver SDK failed"));
    };
  });
}
