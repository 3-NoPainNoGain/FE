import { useEffect, useRef, useState } from "react";

const SDK_ID = "kakao-maps-sdk";

function loadKakaoSDK(appKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) {
      resolve(window.kakao);
      return;
    }
    const exist = document.getElementById(SDK_ID);
    if (exist) {
      exist.addEventListener("load", () => resolve(window.kakao));
      exist.addEventListener("error", () => reject(new Error("SDK load error")));
      return;
    }
    const s = document.createElement("script");
    s.id = SDK_ID;
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false`;
    s.onload = () => resolve(window.kakao);
    s.onerror = () => reject(new Error("SDK load error"));
    document.head.appendChild(s);
  });
}

export default function KakaoHospitalMap({
  center = { lat: 37.4979, lng: 127.0276 },
  level = 4,
}) {
  const mapRef = useRef(null);
  const [error, setError] = useState(null);

  // CRA .env (있으면 사용, 없어도 됨)
  const APP_KEY = process.env.REACT_APP_KAKAO_MAPS_APP_KEY;

  useEffect(() => {
    (async () => {
      try {
        let kakao = window.kakao;

        // 1) SDK가 이미 로드되어 있으면 그대로 사용 (index.html 방식)
        if (!(kakao && kakao.maps)) {
          // 2) 없으면 .env에서 키를 읽어 로드 (컴포넌트 방식)
          if (!APP_KEY) throw new Error("카카오 앱키가 없습니다(.env 확인)");
          kakao = await loadKakaoSDK(APP_KEY);
        }

        kakao.maps.load(() => {
          const map = new kakao.maps.Map(mapRef.current, {
            center: new kakao.maps.LatLng(center.lat, center.lng),
            level,
          });

          // 현재 위치 버튼
          const btn = document.createElement("button");
          btn.textContent = "📍 현재 위치";
          Object.assign(btn.style, {
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 5,
            padding: "8px 12px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,.08)",
          });
          mapRef.current.appendChild(btn);

          btn.onclick = () => {
            if (!navigator.geolocation)
              return alert("이 브라우저는 위치 기능을 지원하지 않습니다.");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const here = new kakao.maps.LatLng(
                  pos.coords.latitude,
                  pos.coords.longitude
                );
                map.panTo(here);
                new kakao.maps.Marker({ position: here, map });
              },
              () => alert("현재 위치를 가져올 수 없어요."),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          };
        });
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
  }, [APP_KEY, center.lat, center.lng, level]);

  if (error) {
    return (
      <div style={{ padding: 16, color: "#B91C1C", background: "#FEF2F2" }}>
        지도 로딩 실패: {error}
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "70vh",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
