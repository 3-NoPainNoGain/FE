// KakaoHospitalMap.jsx — nearby API 연동 + 루프 방지(Idle suppress + Debounce + Abort)
// 스타일: kakao-bubble, kakao-card, kakao-locate-btn 등
import "../styles/kakao-overlay.css";
import "../styles/map-overlay.css";
import "../styles/hospital-map.css";
import { useEffect, useRef, useState } from "react";
import pin from "../assets/handdoc-pin.svg";

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

  // 🔒 setBounds → idle 루프 방지 + 디바운스
  const suppressIdleRef = useRef(false);
  const idleTimerRef = useRef(null);

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

    // 초기 1회
    fetchAndRender(map);

    // idle (디바운스 + suppress)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 진행 중 요청 취소
  function abortInFlight() {
    try {
      inFlightCtrlRef.current?.abort();
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[AbortInFlightError]", err);
      }
    } finally {
      inFlightCtrlRef.current = null;
    }
  }

  // ---- API 호출 + 렌더
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

      console.log("[REQ]", url);
      console.log("[RES]", res.status, res.headers.get("content-type"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const list = data?.results?.hospitals ?? [];
      console.log("[LEN]", list.length, list.slice(0, 3));
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

  // ---- 마커 렌더링
  function renderMarkers(list, map) {
    const { kakao } = window;
    if (!kakao?.maps || !map) return;

    clearMarkers();
    clearInfoWindows();
    if (!list?.length) return;

    const bounds = new kakao.maps.LatLngBounds();

    // ✅ 로고 핀 이미지(표시 크기/기준점은 로고에 맞게 조정)
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

      // 👉 오늘 영업시간/상태
      const hours = getTodayHours(h.operatingHours);
      const dotColor = hours ? (hours.isOpen ? "#10B981" : "#EF4444") : "#9CA3AF";
      const hoursText = hours
        ? `오늘 ${escapeHtml(hours.label)} ${hours.isOpen ? "(영업중)" : "(영업종료)"}`
        : "영업 시간 정보 없음";

      const iw = new kakao.maps.InfoWindow({
        content: `
          <div class="kakao-card">
            <h4 class="title">${escapeHtml(h.name ?? "병원")}</h4>
            <p class="addr">${escapeHtml(h.address ?? "")}</p>
            <div class="meta">
              <div class="hours">
                <span class="dot" style="background:${dotColor}"></span>${hoursText}
              </div>
            </div>
          </div>
        `,
      });
      infoWindowsRef.current.push(iw);

      kakao.maps.event.addListener(marker, "click", () => {
        // 기존 창 닫고 이 마커만
        infoWindowsRef.current.forEach((win) => {
          if (typeof win.close === "function") win.close();
          else if (typeof win.setMap === "function") win.setMap(null);
        });
        iw.open(map, marker);
      });
    });

    // 🔑 setBounds 이후 idle 1회 무시 → 루프 차단
    if (!bounds.isEmpty()) {
      suppressIdleRef.current = true;
      map.setBounds(bounds);
    }
  }

  // ---- 정리 유틸
  function clearMarkers() {
    markersRef.current.forEach((m) => {
      if (m && typeof m.setMap === "function") m.setMap(null);
    });
    markersRef.current = [];
  }
  function clearInfoWindows() {
    infoWindowsRef.current.forEach((iw) => {
      if (!iw) return;
      if (typeof iw.close === "function") iw.close();
      else if (typeof iw.setMap === "function") iw.setMap(null);
    });
    infoWindowsRef.current = [];
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div ref={mapRef} style={style} />
      <div style={{ padding: "6px 0", fontSize: 12, color: "#666" }}>
        표시 중 병원 수: {hospitals.length}
      </div>
    </div>
  );
}

// ---------- 유틸: 오늘 영업시간/상태 ----------
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
