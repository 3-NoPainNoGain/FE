import { useEffect, useState, useMemo } from "react";
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

function Pagination({ page, totalPages, onChange }) {
  const pages = useMemo(() => {
    if (!totalPages || totalPages < 1) return [];
    const windowSize = 2;
    const start = Math.max(0, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);
    const arr = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="pager" aria-label="페이지네이션">
      <button
        className="pager__nav"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page <= 0}
        aria-label="이전 페이지"
      >
        ◀
      </button>

      {page > 2 && (
        <>
          <button className="pager__num" onClick={() => onChange(0)}>
            1
          </button>
          <span className="pager__dots" aria-hidden>…</span>
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={`pager__num ${p === page ? "is-active" : ""}`}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
        >
          {p + 1}
        </button>
      ))}

      {page < totalPages - 3 && (
        <>
          <span className="pager__dots" aria-hidden>…</span>
          <button className="pager__num" onClick={() => onChange(totalPages - 1)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className="pager__nav"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        aria-label="다음 페이지"
      >
        ▶
      </button>
    </nav>
  );
}

export default function TeleDoctorList() {
  const [page, setPage] = useState(0);     
  const [size] = useState(10);             
  const [totalPages, setTotalPages] = useState(1);

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function fetchDoctors() {
      setLoading(true);
      setErr("");
      try {
        const res = await api.get("/api/v2/doctor", {
          params: { page, size },
        });

        if (!alive) return;

        const results = res?.data?.results || res?.data || {};
        const items = results?.items || results?.content || [];
        const mapped = items.map((d) => ({
          id: d.id,
          hospital: d.hospitalName ?? d.hospital ?? "-",
          name: d.name ?? d.doctorName ?? "-",
          status: d.status === "진료 가능" || d.status === "OPEN" ? "open" : "closed",
        }));
        setDoctors(mapped);

        const tp =
          Number(results?.totalPages) ||
          (Number(results?.totalElements) >= 0
            ? Math.max(1, Math.ceil(Number(results.totalElements) / size))
            : 1);
        setTotalPages(tp);
      } catch (e) {
        console.error("의사 목록 불러오기 실패:", e);
        setErr("목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        setDoctors([]);
        setTotalPages(1);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchDoctors();
    return () => {
      alive = false;
    };
  }, [page, size]);

  return (
    <div className="telemed">
      <Sidebar />
      <main className="telemed__main">
        <header className="telemed__header">
          <h1 className="telemed__title">내과 비대면 진료</h1>
        </header>

        {loading ? (
          <p>불러오는 중...</p>
        ) : err ? (
          <p className="error-text">{err}</p>
        ) : (
          <>
            <section className="telemed__grid" aria-label="의사 목록">
              {doctors.length === 0 ? (
                <p>표시할 의사가 없습니다.</p>
              ) : (
                doctors.map((d) => (
                  <DoctorCard
                    key={d.id}
                    id={d.id}
                    hospital={d.hospital}
                    name={d.name}
                    status={d.status}
                  />
                ))
              )}
            </section>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </main>
    </div>
  );
}
