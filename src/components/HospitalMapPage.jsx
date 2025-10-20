import { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import KakaoHospitalMap from "./KakaoHospitalMap";
import "../styles/hospital-map.css";

export default function HospitalMapPage() {
  const [hospitals, setHospitals] = useState([]);
  const [center, setCenter] = useState({ lat: 37.4979, lng: 127.0276 }); // 기본값

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter({ lat: latitude, lng: longitude });
        console.log("📍 현재 위치:", latitude, longitude);

        try {
          const res = await axios.get("/api/v3/map/nearby", {
            // 반경 3km에서 결과가 없을 수 있음 → 일단 7km로 테스트
            params: { latitude, longitude, radiusKm: 7 },
          });

          const raw = res?.data?.results?.hospitals ?? [];
          console.log("✅ 받은 병원 데이터 (raw):", raw);

          // 🔁 백엔드 → 프론트 엔티티 매핑 (latitude/longitude → lat/lng)
          const mapped = raw.map((h) => ({
            id: h.id,
            name: h.name,
            address: h.address,
            lat: h.latitude,
            lng: h.longitude,
            operatingHours: h.operatingHours || [],
          }));

          console.log("✅ 받은 병원 데이터 (mapped):", mapped);
          setHospitals(mapped);
        } catch (err) {
          console.error("❌ 병원 API 호출 실패:", err);
          setHospitals([]);
        }
      },
      (err) => {
        console.error("❌ 위치 접근 실패:", err);
        alert("위치 정보를 가져올 수 없습니다. 브라우저 권한을 확인해주세요.");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h1 className="page-title">handDoc 제휴 병원</h1>

        {/* 좌측 리스트가 필요하면 이전 답변의 리스트패널 버전으로 확장 가능 */}
        <div className="map-wrap">
          <KakaoHospitalMap center={center} hospitals={hospitals} />
        </div>

        {/* 결과 없음 안내 */}
        {hospitals.length === 0 && (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
            반경 내 결과가 없습니다. 반경을 넓혀보세요.
          </div>
        )}
      </main>
    </div>
  );
}
