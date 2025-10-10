// src/pages/HospitalMapPage.jsx
import Sidebar from "../components/Sidebar";
import KakaoHospitalMap from "../components/KakaoHospitalMap";

export default function HospitalMapPage() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <h1 style={{ fontWeight: 800, fontSize: 28, color: "#2C3E7F", margin: 0, marginBottom: 12 }}>
          handDoc 제휴 병원
        </h1>

        <div style={{ height: "calc(100vh - 96px)" }}>
          <KakaoHospitalMap />
        </div>
      </main>
    </div>
  );
}
