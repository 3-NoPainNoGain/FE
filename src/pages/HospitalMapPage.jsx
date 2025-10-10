import KakaoHospitalMap from "../components/KakaoHospitalMap";

export default function HospitalMapPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>병원 지도</h1>
      <KakaoHospitalMap />
    </div>
  );
}
