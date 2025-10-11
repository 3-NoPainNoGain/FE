import Sidebar from "../components/Sidebar";
import KakaoHospitalMap from "../components/KakaoHospitalMap";

const MOCK_HOSPITALS = [
  { id: "t1", name: "테스트병원 A", lat: 37.4979, lng: 127.0276, addr: "서울 강남구", phone: "02-000-0000" },
  { id: "t2", name: "테스트병원 B", lat: 37.4993, lng: 127.0303, addr: "서울 역삼동", phone: "02-111-1111" },
];

export default function HospitalMapPage() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <h1 style={{ fontWeight: 800, fontSize: 28, color: "#2C3E7F", margin: 0, marginBottom: 12 }}>
          handDoc 제휴 병원
        </h1>

        <div style={{ height: "calc(100vh - 96px)" }}>
          <KakaoHospitalMap hospitals={MOCK_HOSPITALS} />
        </div>
      </main>
    </div>
  );
}
