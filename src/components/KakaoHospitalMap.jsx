import "../styles/kakao-overlay.css";
import "../styles/map-overlay.css";
import "../styles/hospital-map.css";
import { useEffect, useRef, useState } from "react";
import pin from "../assets/handdoc-pin.svg";
import locateIcon from "../assets/locate.svg"; 

const API_BASE = process.env.REACT_APP_API_BASE || "";
const ENDPOINT = `${API_BASE}/api/v3/map/nearby`;

export default function KakaoHospitalMap({
  defaultCenter = { lat: 37.5665, lng: 126.978 },
  defaultLevel = 5,
  radiusKm = 20,
  style = { width: "100%", height: "600px" },
}) {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowsRef = useRef([]);
  const inFlightCtrlRef = useRef(null);

  const [hospitals, setHospitals] = useState([]);

  const suppressIdleRef = useRef(false);
  const idleTimerRef = useRef(null);
  const hasFitBounds = useRef(false);

  useEffect(() => {
    if (!mapRef.current) return;
    const { kakao } = window;
    if (!kakao?.maps) {
      console.error("[Kakao] kakao.maps 가 로드되지 않음");
      return;
    }

    const center = new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng);
    const map = new kakao.maps.Map(mapRef.current, { center, level: defaultLevel });
    mapObjRef.current = map;

    fetchAndRender(map);

    kakao.maps.event.addListener(map, "idle", () => {
      if (suppressIdleRef.current) {
        suppressIdleRef.current = false;
        return;
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => fetchAndRender(map), 400);
    });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      abortInFlight();
      clearMarkers();
      clearInfoWindows();
      mapObjRef.current = null;
    };
  }, []);

  function abortInFlight() {
    try {
      inFlightCtrlRef.current?.abort();
    } catch (err) {
      console.warn("[AbortInFlightError]", err);
    } finally {
      inFlightCtrlRef.current = null;
    }
  }

  async function fetchAndRender(map) {
    try {
      const c = map.getCenter();
      const lat = c.getLat();
      const lng = c.getLng();

      const params = new URLSearchParams({
        latitude: lat,
        longitude: lng,
        lat: lat,
        lng: lng,
        radiusKm: String(radiusKm),
        page: "0",
        size: "300",
        sort: "distance",
      });

      const url = `${ENDPOINT}?${params.toString()}`;

      abortInFlight();
      const ctrl = new AbortController();
      inFlightCtrlRef.current = ctrl;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const list = data?.results?.hospitals ?? [];
      setHospitals(list);
      renderMarkers(list, map);
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("[HospitalFetchError]", e);
        setHospitals([]);
        renderMarkers([], mapObjRef.current);
      }
    } finally {
      inFlightCtrlRef.current = null;
    }
  }

  function renderMarkers(list, map) {
    const { kakao } = window;
    if (!kakao?.maps || !map) return;

    clearMarkers();
    clearInfoWindows();

    if (!list?.length) return;

    const bounds = new kakao.maps.LatLngBounds();

    const markerImage = new kakao.maps.MarkerImage(
      pin,
      new kakao.maps.Size(40, 52),
      { offset: new kakao.maps.Point(20, 52) }
    );

    list.forEach((h) => {
      const lat = h.latitude ?? h.lat;
      const lng = h.longitude ?? h.lng;
      if (lat == null || lng == null) return;

      const pos = new kakao.maps.LatLng(lat, lng);

      const marker = new kakao.maps.Marker({
        position: pos,
        image: markerImage,
      });
      marker.setMap(map);
      markersRef.current.push(marker);
      bounds.extend(pos);

      const hours = getTodayHours(h.operatingHours);
      const dotColor = hours ? (hours.isOpen ? "#10B981" : "#EF4444") : "#9CA3AF";
      const hoursText = hours
        ? `오늘 ${escapeHtml(hours.label)} ${hours.isOpen ? "(영업중)" : "(영업종료)"}`
        : "영업 시간 정보 없음";

      const iw = new kakao.maps.InfoWindow({
        content: `
          <div style="
            border-radius:14px;
            overflow:hidden;
            border:1px solid #e5e7eb;
            background:#fff;
            box-shadow:0 8px 24px rgba(0,0,0,0.18);
          ">
            <div class="kakao-card" style="border:none; box-shadow:none; margin:0;">
              <h4 class="title">${escapeHtml(h.name ?? "병원")}</h4>
              <p class="addr">${escapeHtml(h.address ?? "")}</p>
              <div class="meta">
                <div class="hours">
                  <span class="dot" style="background:${dotColor}"></span>${hoursText}
                </div>
              </div>
            </div>
          </div>
        `,
      });
      infoWindowsRef.current.push(iw);

      kakao.maps.event.addListener(marker, "click", () => {
        infoWindowsRef.current.forEach((win) => {
          if (typeof win.close === "function") win.close();
          else if (typeof win.setMap === "function") win.setMap(null);
        });
        iw.open(map, marker);
      });
    });

    if (!bounds.isEmpty() && !hasFitBounds.current) {
      suppressIdleRef.current = true;
      map.setBounds(bounds);
      hasFitBounds.current = true;
    }
  }

  function moveToMyLocation() {
    const { kakao } = window;
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const loc = new kakao.maps.LatLng(lat, lng);
        mapObjRef.current.setCenter(loc);

        new kakao.maps.Marker({
  position: loc,
  map: mapObjRef.current,
});
      },
      (err) => {
        console.error(err);
        alert("위치 정보를 가져올 수 없습니다.");
      }
    );
  }

  function clearMarkers() {
    markersRef.current.forEach((m) => m?.setMap?.(null));
    markersRef.current = [];
  }
  function clearInfoWindows() {
    infoWindowsRef.current.forEach((iw) => iw?.close?.());
    infoWindowsRef.current = [];
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mapRef} style={style} />
      <div style={{ padding: "6px 0", fontSize: 12, color: "#666" }}>
        표시 중 병원 수: {hospitals.length}
      </div>

      <button
        className="kakao-locate-btn"
        onClick={moveToMyLocation}
        title="내 위치로 이동"
      >
        <img src={locateIcon} alt="내 위치" />
      </button>
    </div>
  );
}

function getTodayHours(operatingHours) {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return null;
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  const todayKey = days[new Date().getDay()];
  const row = operatingHours.find((d) => d.day === todayKey);
  if (!row || !row.openTime || !row.closeTime) return null;

  const toMin = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const openMin = toMin(row.openTime);
  const closeMin = toMin(row.closeTime);

  return {
    label: `${row.openTime} - ${row.closeTime}`,
    isOpen: nowMin >= openMin && nowMin <= closeMin,
  };
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
