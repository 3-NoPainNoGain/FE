// src/pages/HospitalMapPage.jsx
import NaverHospitalMap from "../components/NaverHospitalMap";

export default function HospitalMapPage() {
  // CRA
  const NAVER_CLIENT_ID = process.env.REACT_APP_NAVER_MAPS_CLIENT_ID;
  // Vite 사용이라면 윗줄 대신:
  // const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;

  console.log("[HospitalMapPage] NAVER_CLIENT_ID =", NAVER_CLIENT_ID);
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 20, color: "#2C3E7F", marginBottom: 12 }}>
        병원 지도
      </h1>
      <NaverHospitalMap clientId={NAVER_CLIENT_ID} />
    </div>
  );
}
