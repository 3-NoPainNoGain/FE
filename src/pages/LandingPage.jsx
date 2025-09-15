// 코드 제목: 랜딩 페이지(상단 로그인 버튼: 비로그인 시 노출, 로그인 시 숨김 + 모달)
//
// - useAuth로 로그인 상태를 확인해 버튼 표시를 제어
// - 로그인 버튼 클릭 시 LoginModal 표시
// - 나머지 섹션/CTA는 기존과 동일

import { useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

import logoImg from "../assets/logo.png";
import image1 from "../assets/image1.png";
import image2 from "../assets/image2.png";
import image3 from "../assets/image3.png";

import { useAuth } from "../auth/AuthContext";
import LoginModal from "../components/LoginModal";

export default function LandingPage() {
  const { isLoggedIn, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="landing">
      {/* 헤더 */}
      <header className="landing__header">
        <div className="landing__brand">
          <img src={logoImg} alt="Handoc 로고" className="brand__logo" />
          <span className="brand__name">Handoc</span>
        </div>

        {/* 오른쪽 영역: 로그인/로그아웃 */}
        <div className="landing__actions">
          {!isLoggedIn ? (
            <button
              className="btn-login"
              onClick={() => setShowLogin(true)}
              aria-haspopup="dialog"
            >
              로그인
            </button>
          ) : (
            <div className="login-state">
              <span className="login-state__name">{user?.name || "사용자"}</span>
              <button className="btn-logout" onClick={logout}>로그아웃</button>
            </div>
          )}
        </div>
      </header>

      {/* 본문 컨테이너 */}
      <main className="landing__main">
        {/* 히어로 영역 */}
        <section className="hero">
          <h1 className="hero__title">손으로 소통하는 진료, Handoc</h1>
          <p className="hero__subtitle">병원 진료에 최적화된 솔루션</p>
        </section>

        {/* 기능 카드 영역 */}
        <section className="features">
          <article className="card">
            <div className="card__thumb">
              <img src={image1} alt="수어 → 텍스트 변환" />
            </div>
            <h3 className="card__title">수어 &gt; 텍스트 변환</h3>
            <p className="card__desc">수어를 인식하여 텍스트로 변환하여 전달해요.</p>
          </article>

          <article className="card">
            <div className="card__thumb">
              <img src={image2} alt="음성 → 텍스트 변환" />
            </div>
            <h3 className="card__title">음성 &gt; 텍스트 변환</h3>
            <p className="card__desc">의사의 음성을 텍스트로 변환하여 전달해요.</p>
          </article>

          <article className="card">
            <div className="card__thumb">
              <img src={image3} alt="진료 내용 요약" />
            </div>
            <h3 className="card__title">진료 내용 요약</h3>
            <p className="card__desc">진료 후, 중요한 내용을 요약하여 전달해요.</p>
          </article>
        </section>
      </main>

      {/* 우하단 CTA */}
      <div className="landing__cta">
        <Link to="/prepare" className="cta__link">
          수어 통역 대면 진료 받으러 가기
          <span className="cta__arrow" aria-hidden>→</span>
        </Link>
      </div>

      {/* 로그인 모달 */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

/* landing.css에 추가할 수 있는 최소 가이드(선택)
.landing__header { display:flex; align-items:center; justify-content:space-between; height:64px; padding:0 20px; }
.landing__actions { display:flex; align-items:center; gap:12px; }
.btn-login { height:36px; padding: 0 14px; border:0; border-radius: 10px; background:#2F57EB; color:#fff; font-weight:700; cursor:pointer; }
.btn-logout { height:32px; padding: 0 12px; border:1px solid #e6e6e6; border-radius:10px; background:#fff; cursor:pointer; }
.login-state { display:flex; align-items:center; gap:10px; color:#333; }
*/
