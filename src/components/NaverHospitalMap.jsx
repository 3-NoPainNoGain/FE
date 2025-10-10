// src/components/NaverHospitalMap.jsx
import { useEffect, useRef, useState } from "react";
import { loadNaverScript } from "../lib/naverLoader";
import { MOCK_HOSPITALS } from "../lib/mockHospitals";

function isValidClientId(id) {
  if (!id) return false;
  const v = String(id).trim();
  return v && v !== "YOUR_NCP_CLIENT_ID";
}

export default function NaverHospitalMap({ clientId, hospitals }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  const envVite =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_NAVER_MAPS_CLIENT_ID
      : undefined;
  const envCRA =
    typeof process !== "undefined"
      ? process.env?.REACT_APP_NAVER_MAPS_CLIENT_ID
      : undefined;

  const resolvedClientId = clientId || envVite || envCRA;
  const data =
    Array.isArray(hospitals) && hospitals.length ? hospitals : MOCK_HOSPITALS;

  useEffect(() => {
    setErr(null);
    if (!isValidClientId(resolvedClientId)) {
      setErr(new Error("유효하지 않은 clientId (env/props 확인)"));
      return;
    }
    loadNaverScript(resolvedClientId)
      .then(() => setReady(true))
      .catch((e) => setErr(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedClientId]);

  useEffect(() => {
    if (!ready || !containerRef.current || !data?.length) return;
    const { naver } = window;

    const map = new naver.maps.Map(containerRef.current, {
      center: new naver.maps.LatLng(data[0].lat, data[0].lng),
      zoom: 14,
      minZoom: 6,
      logoControl: false,
      mapDataControl: false,
      zoomControl: true,
      zoomControlOptions: {
        style: naver.maps.ZoomControlStyle.SMALL,
        position: naver.maps.Position.RIGHT_CENTER,
      },
    });

    return () => map.destroy();
  }, [ready, data]);

  if (err && !ready)
    return (
      <div style={{ padding: 16, color: "#B91C1C" }}>
        지도 로딩 실패: {String(err.message || err)}
      </div>
    );

  if (!ready)
    return <div style={{ padding: 16 }}>지도를 불러오는 중입니다…</div>;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 640, borderRadius: 16, overflow: "hidden" }}
    />
  );
}
