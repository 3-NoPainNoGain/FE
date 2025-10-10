let _promise = null;

export function loadKakao(appKey, { withServices = true, timeoutMs = 15000 } = {}) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));

  if (window.kakao && window.kakao.maps) return Promise.resolve();
  if (_promise) return _promise;

  _promise = new Promise((resolve, reject) => {
    const existing = document.getElementById("kakao-maps-sdk");
    if (existing) {
      const done = () => (window.kakao && window.kakao.maps) ? resolve() : reject(new Error("Kakao SDK loaded but kakao.maps undefined"));
      existing.addEventListener("load", () => {
        if (window.kakao?.maps?.load) window.kakao.maps.load(done);
        else done();
      });
      existing.addEventListener("error", () => reject(new Error("Kakao SDK load error")));
      return;
    }

    const s = document.createElement("script");
    s.id = "kakao-maps-sdk";
    const libs = withServices ? "&libraries=services" : "";
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}${libs}&autoload=false`;
    s.async = true;
    s.defer = true;

    const timer = setTimeout(() => reject(new Error("Kakao SDK timeout")), timeoutMs);

    s.onload = () => {
      try {
        window.kakao.maps.load(() => {
          clearTimeout(timer);
          resolve();
        });
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Kakao SDK load error"));
    };

    document.head.appendChild(s);
  });

  return _promise;
}
