// src/pages/TeleDoctorDetail.jsx
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./session.css";
import "./telemed-detail.css";

function StatusBadge({ status }) {
  const text = status === "open" ? "진료 중" : "진료 종료";
  const klass =
    status === "open" ? "d-badge d-badge--open" : "d-badge d-badge--closed";
  return <span className={klass}>{text}</span>;
}

export default function TeleDoctorDetail() {
  const { doctorId } = useParams();
  const nav = useNavigate();

  // 목업 데이터 (나중에 API로 교체)
  const doc = {
    id: doctorId ?? "0",
    hospital: "이화여대 내과 병원",
    name: "이하은 의사",
    status: "open",
    intro: "안녕하세요. 내과 전문의 이하은입니다.어쩌구",
    specialties: [
      "만성질환 관리: 고혈압, 당뇨, 고지혈증",
      "소화기 질환: 위염, 역류성 식도염, 과민성 장증후군 등",
      "호흡기 질환: 감기, 기관지염, 천식 등",
      "건강 상담 및 생활습관 관리",
    ],
  };

  const introLines = String(doc.intro || "").split("\n");
  const specialties = Array.isArray(doc.specialties) ? doc.specialties : [];

  return (
    <div className="telemed tele-detail">
      <Sidebar />

      <main className="tele-detail__main">
        {/* 상단 이미지 자리 */}
        <div className="tele-detail__hero" aria-hidden="true" />

        {/* 헤더 */}
        <div className="tele-detail__head">
          <div className="tele-detail__meta">
            <div className="tele-detail__hospital">
              {doc.hospital} · <StatusBadge status={doc.status} />
            </div>
            <h1 className="tele-detail__name">{doc.name}</h1>
          </div>

          <button
            className="d-btn d-btn--primary"
            onClick={() => nav(`/tele/apply/${doctorId}`)}
          >
            진료 신청하기
          </button>
        </div>

        {/* 소개 */}
        <section className="tele-detail__section">
          <div className="tele-detail__intro">
            {introLines.map((l, idx) => (
              <p key={idx}>{l}</p>
            ))}
          </div>
        </section>

        {/* 전문 진료 분야 */}
        <section className="tele-detail__section">
          <ul className="tele-detail__list">
            {specialties.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
