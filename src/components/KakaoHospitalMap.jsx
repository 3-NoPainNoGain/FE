import { useEffect, useRef } from "react";

export default function KakaoHospitalMap({
  center = { lat: 37.4979, lng: 127.0276 },
  level = 4,
  hospitals = [],
}) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      console.warn("Kakao SDK not ready. Check index.html script & domain.");
      return;
    }

    const { kakao } = window;

    const init = () => {
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level,
      });

      hospitals.forEach((h) => {
        const pos = new kakao.maps.LatLng(h.lat, h.lng);
        const marker = new kakao.maps.Marker({ position: pos, map, title: h.name });

        const iw = new kakao.maps.InfoWindow({
          content: `
            <div style="padding:12px 14px;min-width:220px;font-size:14px;">
              <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${h.name}</div>
              <div style="color:#4b5563;margin-bottom:4px;">${h.addr ?? ""}</div>
              <div style="color:#111827;">${h.hours ?? ""}</div>
            </div>`,
          removable: true,
        });

        kakao.maps.event.addListener(marker, "mouseover", () => iw.open(map, marker));
        kakao.maps.event.addListener(marker, "mouseout", () => iw.close());
      });
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(init);
    else init();
  }, [center.lat, center.lng, level, hospitals]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
