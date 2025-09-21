import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";   
import "./telemed.css";
import "./session.css";

/** 상태 배지 */
function StatusBadge({ status }) {
  const text = status === "open" ? "진료 가능" : "진료 종료";
  const klass = status === "open" ? "badge badge--open" : "badge badge--closed";
  return <span className={klass}>{text}</span>;
}

/** 의사 카드 */
function DoctorCard({ id, hospital, name, status }) {
  return (
    <NavLink to={`/tele/doctor/${id}`} className="doc-card-link">
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
    </NavLink>
  );
}

export default function TeleDoctorList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function fetchDoctors() {
      try {
        const res = await api.get("/api/v2/doctor", {
          params: { page: 0, size: 10 },
        });
        if (!alive) return;

        const items = res?.data?.results?.items || [];
        // API status 값을 open/closed 로 매핑
        const mapped = items.map((d) => ({
          id: d.id,
          hospital: d.hospitalName,
          name: d.name,
          status: d.status === "진료 가능" ? "open" : "closed",
        }));
        setDoctors(mapped);
      } catch (e) {
        console.error("의사 목록 불러오기 실패:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDoctors();
    return () => { alive = false; };
  }, []);

  return (
    <div className="telemed">
      <Sidebar />
      <main className="telemed__main">
        <header className="telemed__header">
          <h1 className="telemed__title">내과 비대면 진료</h1>
        </header>

        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <section className="telemed__grid" aria-label="의사 목록">
            {doctors.map((d) => (
              <DoctorCard
                key={d.id}
                id={d.id}
                hospital={d.hospital}
                name={d.name}
                status={d.status}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
