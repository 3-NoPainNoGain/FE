import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../auth/axios";
import "./session.css";
import "./telemed-detail.css";

// 이미지 import
import stringDoctor from "../assets/stringDoctor.png";
import hyejunDoctor from "../assets/hyejunDoctor.png";
import haeunDoctor from "../assets/haeunDoctor.png";

/** 상태 배지 (open/closed) */
function StatusBadge({ status }) {
  const isOpen = status === "open";
  const text = isOpen ? "진료 중" : "진료 종료";
  const klass = isOpen ? "d-badge d-badge--open" : "d-badge d-badge--closed";
  return <span className={klass}>{text}</span>;
}

/** API 응답 → 화면 모델 정규화 */
function normalizeDoctor(results = {}) {
  const status =
    results.status === "진료 가능"
      ? "open"
      : results.status === "진료 종료"
      ? "closed"
      : "closed";

  const intro =
    results.introduction ?? results.introduce ?? results.description ?? "";

  const tagList = Array.isArray(results.doctorTagList)
    ? results.doctorTagList.map((t) => t?.name).filter(Boolean)
    : [];

  const speciality = results.speciality ?? results.specialty ?? null;

  return {
    id: String(results.id ?? ""),
    name: results.name ?? "의사",
    hospital: results.hospitalName ?? "병원",
    status,
    intro,
    specialties: tagList.length > 0 ? tagList : speciality ? [speciality] : [],
  };
}

export default function TeleDoctorDetail() {
  const { doctorId } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // doctorId 매핑 (18,19,20)
  const doctorImages = {
    18: stringDoctor,
    19: hyejunDoctor,
    20: haeunDoctor,
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const res = await api.get(`/api/v2/doctor/${doctorId}`);
        const body = res?.data ?? {};
        const results = body?.results ?? body?.data ?? {};
        const normalized = normalizeDoctor(results);
        if (!alive) return;
        setDoc(normalized);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.message || e?.message || "상세 조회 실패");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [doctorId]);

  const introLines = useMemo(
    () => String(doc?.intro || "").split("\n"),
    [doc]
  );
  const specialties = useMemo(
    () => (Array.isArray(doc?.specialties) ? doc.specialties : []),
    [doc]
  );

  // 이미지 선택
  const doctorImage = doctorImages[doctorId] ?? stringDoctor;

  return (
    <div className="telemed tele-detail">
      <Sidebar />

      <main className="tele-detail__main">
        {/* 상단 이미지 자리 */}
        <div
          className="tele-detail__hero"
          style={{
            backgroundImage: `url(${doctorImage})`,
          }}
        />

        {/* 헤더 */}
        <div className="tele-detail__head">
          <div className="tele-detail__meta">
            <div className="tele-detail__hospital">
              {doc?.hospital || ""}{" "}
              {doc && (
                <>
                  · <StatusBadge status={doc.status} />
                </>
              )}
            </div>
            <h1 className="tele-detail__name">
              {doc?.name || (loading ? "불러오는 중…" : "의사")}
            </h1>
          </div>

          <button
            className="d-btn d-btn--primary"
            onClick={() => nav(`/tele/apply/${doctorId}`)}
            disabled={!doc || doc.status !== "open"}
            title={!doc || doc.status !== "open" ? "진료 종료" : "진료 신청하기"}
          >
            진료 신청하기
          </button>
        </div>

        {loading && (
          <div style={{ padding: 20, color: "#6b7280" }}>불러오는 중…</div>
        )}
        {!loading && err && (
          <div style={{ padding: 20, color: "#ef4444" }}>{err}</div>
        )}

        {!loading && !err && (
          <>
            <section className="tele-detail__section">
              <div className="tele-detail__intro">
                {introLines.filter(Boolean).length > 0 ? (
                  introLines.map((l, idx) => <p key={idx}>{l}</p>)
                ) : (
                  <p style={{ color: "#6b7280" }}>소개가 등록되지 않았습니다.</p>
                )}
              </div>
            </section>

            <section className="tele-detail__section">
              {specialties.length > 0 ? (
                <ul className="tele-detail__list">
                  {specialties.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#6b7280" }}>
                  전문 진료 분야 정보가 없습니다.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
