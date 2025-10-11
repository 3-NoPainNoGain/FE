import { useEffect, useRef, useState } from "react";
import "../styles/kakao-overlay.css";
import pin from "../assets/handdoc-pin.svg";


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

  useEffect(() => {
    if (!window.kakao || !window.kakao.maps) {
      console.warn("Kakao SDK not ready. Check provider & domain.");
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

      markersRef.current = hospitals.map((h) => {
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
      mapInstanceRef.current = null;
    };
  }, [center.lat, center.lng, level, hospitals]);

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
  }, [selectedId, hoverId]);

  function cleanupMarkers() {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }

  function clearOverlay() {
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
  }

  function showOverlay(item, position, map) {
    const kakao = kakaoRef.current;
    if (!kakao) return;

    clearOverlay();

    const el = document.createElement("div");
    el.className = "kakao-card";
  const hours =
    item.hours ?? item.openingHours ?? item.openHours ?? ""; 
  el.innerHTML = `
    <div class="title">${escapeHtml(item.name)}</div>
    <div class="addr">${escapeHtml(item.addr ?? "")}</div>
    <div class="meta">
      <div class="hours">
        <span class="dot"></span>
        ${escapeHtml(hours || "영업시간 정보 없음")}
      </div>
    </div>
  `;

    el.addEventListener("click", (e) => {
      const act = e.target?.getAttribute?.("data-act");
      if (act === "detail") console.log("[detail]", item);
      if (act === "reserve") console.log("[reserve]", item);
    });

    overlayRef.current = new kakao.maps.CustomOverlay({
      position,
      content: el,
      xAnchor: 0.5,   
 yAnchor: 1.8,
      zIndex: 5,
      clickable: true,
    });
    overlayRef.current.setMap(map);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}
