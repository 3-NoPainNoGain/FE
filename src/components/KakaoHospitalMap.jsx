import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/kakao-overlay.css";

import pin from "../assets/handdoc-pin.svg";     

import locateIcon from "../assets/locate.svg";   

export default function KakaoHospitalMap({
  center = { lat: 37.4979, lng: 127.0276 },
  level = 4,
  hospitals = [],
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const kakaoRef = useRef(null);

  const markersRef = useRef([]);
  const overlayRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  const userPosRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const initialCenterRef = useRef(center);

  useEffect(() => {
    initialCenterRef.current = center;
  }, [center]);

  // 카드 제거
  const clearOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
  }, []);

  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const showOverlay = useCallback(
    (item, position, map) => {
      const kakao = kakaoRef.current;
      if (!kakao) return;

      clearOverlay();

      const el = document.createElement("div");
      el.className = "kakao-card";
      const hours = item.hours ?? item.openingHours ?? item.openHours ?? "";
      el.innerHTML = `
        <div class="title">${escapeHtml(item.name)}</div>
        <div class="addr">${escapeHtml(item.addr ?? "")}</div>
        <div class="meta">
          <div class="hours"><span class="dot"></span>${escapeHtml(hours || "09:00 - 17:00")}</div>
        </div>
      `;

      overlayRef.current = new kakao.maps.CustomOverlay({
        position,
        content: el,
        xAnchor: 0.5,
        yAnchor: 1.9,  
        zIndex: 5,
        clickable: true,
      });
      overlayRef.current.setMap(map);
    },
    [clearOverlay]
  );

  const cleanupMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      console.warn("Kakao SDK not ready.");
      return;
    }
    const { kakao } = window;
    kakaoRef.current = kakao;

    const init = () => {
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level,
      });
      mapInstanceRef.current = map;

      cleanupMarkers();
      clearOverlay();

      const normalMarkerImage = new kakao.maps.MarkerImage(
        pin,
        new kakao.maps.Size(48, 64),
        { offset: new kakao.maps.Point(24, 64) }
      );
      const selectedMarkerImage = new kakao.maps.MarkerImage(
        pin,
        new kakao.maps.Size(72, 96),
        { offset: new kakao.maps.Point(36, 96) }
      );

      const items = hospitals.length
        ? hospitals
        : [{ id: "smoke", name: "테스트 마커", lat: center.lat, lng: center.lng, addr: "", hours: "" }];

      markersRef.current = items.map((h) => {
        const pos = new kakao.maps.LatLng(h.lat, h.lng);
        const marker = new kakao.maps.Marker({
          position: pos,
          map,
          image: normalMarkerImage,
          clickable: true,
          zIndex: 3,
        });

        kakao.maps.event.addListener(marker, "mouseover", () => {
          if (!selectedId) {
            setHoverId(h.id);
            showOverlay(h, pos, map);
          }
        });
        kakao.maps.event.addListener(marker, "mouseout", () => {
          setHoverId((prev) => (prev === h.id ? null : prev));
          if (!selectedId) clearOverlay();
        });
        kakao.maps.event.addListener(marker, "click", () => {
          setSelectedId((prev) => (prev === h.id ? null : h.id));
          showOverlay(h, pos, map);
        });

        marker._id = h.id;
        marker._data = h;
        marker._pos = pos;
        marker._normal = normalMarkerImage;
        marker._selected = selectedMarkerImage;
        return marker;
      });

      if (markersRef.current.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();
        markersRef.current.forEach((m) => bounds.extend(m._pos));
        map.setBounds(bounds);
      }

      kakao.maps.event.addListener(map, "click", () => {
        setSelectedId(null);
        setHoverId(null);
        clearOverlay();
      });
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(init);
    else init();

    return () => {
      cleanupMarkers();
      clearOverlay();
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);
      if (userCircleRef.current) userCircleRef.current.setMap(null);
      mapInstanceRef.current = null;
    };
  }, [center.lat, center.lng, level, hospitals, cleanupMarkers, clearOverlay, showOverlay, selectedId]);

  useEffect(() => {
    const kakao = kakaoRef.current;
    const map = mapInstanceRef.current;
    if (!kakao || !map) return;

    const visibleId = selectedId ?? hoverId;

    markersRef.current.forEach((m) => {
      if (m._id === selectedId) m.setImage(m._selected);
      else m.setImage(m._normal);
    });

    if (visibleId) {
      const m = markersRef.current.find((mm) => mm._id === visibleId);
      if (m) showOverlay(m._data, m._pos, map);
    } else {
      clearOverlay();
    }
  }, [selectedId, hoverId, showOverlay, clearOverlay]);

  function locateNow() {
    const kakao = kakaoRef.current;
    const map = mapInstanceRef.current;
    if (!kakao || !map) return;

    if (!("geolocation" in navigator)) {
      alert("이 브라우저는 위치 인식을 지원하지 않아요.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latlng = new kakao.maps.LatLng(latitude, longitude);
        userPosRef.current = latlng;

        if (userMarkerRef.current) userMarkerRef.current.setMap(null);
        if (userCircleRef.current) userCircleRef.current.setMap(null);

        userMarkerRef.current = new kakao.maps.Marker({
          position: latlng,
          map,
          zIndex: 6,
          image: new kakao.maps.MarkerImage(
            'data:image/svg+xml;utf8,' +
              encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                <circle cx="9" cy="9" r="6" fill="#2563EB" fill-opacity="0.95"/>
                <circle cx="9" cy="9" r="9" fill="#2563EB" fill-opacity="0.18"/>
              </svg>`),
            new kakao.maps.Size(18, 18),
            { offset: new kakao.maps.Point(9, 9) }
          ),
        });

        userCircleRef.current = new kakao.maps.Circle({
          center: latlng,
          radius: Math.max(accuracy || 60, 30), 
          strokeWeight: 1,
          strokeColor: "#2563EB",
          strokeOpacity: 0.4,
          strokeStyle: "solid",
          fillColor: "#60A5FA",
          fillOpacity: 0.12,
        });
        userCircleRef.current.setMap(map);

        try { map.panTo(latlng); } catch { map.setCenter(latlng); }
      },
      (err) => {
        console.warn("Geolocation failed:", err?.code, err?.message);
        const fallback = new kakao.maps.LatLng(
          initialCenterRef.current.lat,
          initialCenterRef.current.lng
        );
        try { map.panTo(fallback); } catch { map.setCenter(fallback); }
        alert("현재 위치를 가져올 수 없어요. 브라우저 권한을 확인해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
  <div className="kakao-map-wrap" style={{ position: "relative", width: "100%", height: "100%" }}>
    <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

    <button
  type="button"
  className="kakao-locate-btn"
  onClick={locateNow}
  title="현재 위치로 이동"
  style={{
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    padding: 0,
    borderRadius: 10,
    zIndex: 2147483647,
    display: "grid",
    placeItems: "center",
    lineHeight: 0,
  }}
>
  <img
    src={locateIcon}
    alt="현재 위치로 이동"
    style={{
      width: 16,
      height: 16,
      display: "block",
      margin: "auto",    
      objectFit: "contain",
     
    }}
  />
</button>

  </div>
);



}
