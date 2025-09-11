// src/pages/TeleDoctorList.jsx
import { useMemo } from "react";
import Sidebar from "../components/Sidebar";
import "./telemed.css"; // ▼ 아래 CSS 함께 추가
import "./session.css";

/**
 * [UI 전용 목업 데이터]
 * - 나중에 API 연동 시 이 부분만 대체하면 됩니다.
 * - status: "open" | "closed"
 */
const useMockDoctors = () =>
  useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: String(i + 1),
        hospital: "이화여대 내과 병원",
        name: "이하은 의사",
        status: i % 5 === 4 ? "closed" : "open", // 몇 개는 진료 종료로 표시
        // image: 나중에 실제 URL 연결 예정
      })),
    []
  );

/** 상태 뱃지 */
function StatusBadge({ status }) {
  const text = status === "open" ? "진료 가능" : "진료 종료";
  const klass = status === "open" ? "badge badge--open" : "badge badge--closed";
  return <span className={klass}>{text}</span>;
}

/** 의사 카드 */
function DoctorCard({ hospital, name, status }) {
  return (
    <article className="doc-card" aria-label={`${name} 카드`}>
      <div className="doc-card__thumb" aria-hidden="true" />
      <div className="doc-card__meta">
        <div className="doc-card__hospital">{hospital}</div>
        <div className="doc-card__name">{name}</div>
        <div className="doc-card__status">
          <StatusBadge status={status} />
        </div>
      </div>
    </article>
  );
}

export default function TeleDoctorList() {
  const doctors = useMockDoctors();

  return (
    <div className="telemed">
      {/* 사이드바는 InPersonSession과 동일하게 사용 */}
      <Sidebar />

      <main className="telemed__main">
        <header className="telemed__header">
          <h1 className="telemed__title">내과 비대면 진료</h1>
        </header>

        {/* 카드 그리드 */}
        <section className="telemed__grid" aria-label="의사 목록">
          {doctors.map((d) => (
            <DoctorCard
              key={d.id}
              hospital={d.hospital}
              name={d.name}
              status={d.status}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
