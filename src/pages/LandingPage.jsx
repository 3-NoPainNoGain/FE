import { useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

import logoImg from "../assets/logo.png";
import image1 from "../assets/image1.png";
import image2 from "../assets/image2.png";
import image3 from "../assets/image3.png";

import { useAuth } from "../auth/AuthContext";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal"; // ⬅️ 반드시 존재/임포트

export default function LandingPage() {
  const { isLoggedIn, user, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <img src={logoImg} alt="Handoc 로고" className="brand__logo" />
          <span className="brand__name">Handoc</span>
        </div>

        <div className="landing__actions">
          {!isLoggedIn ? (
            <button className="btn-login" onClick={() => setShowLogin(true)}>로그인</button>
          ) : (
            <div className="login-state">
              <span className="login-state__name">{user?.name || "사용자"}</span>
              <button className="btn-logout" onClick={logout}>로그아웃</button>
            </div>
          )}
        </div>
      </header>

      <main className="landing__main">
        <section className="hero">
          <h1 className="hero__title">손으로 소통하는 진료, Handoc</h1>
          <p className="hero__subtitle">병원 진료에 최적화된 솔루션</p>
        </section>

        <section className="features">
          <article className="card">
            <div className="card__thumb"><img src={image1} alt="수어 → 텍스트 변환" /></div>
            <h3 className="card__title">수어 &gt; 텍스트 변환</h3>
            <p className="card__desc">수어를 인식하여 텍스트로 변환하여 전달해요.</p>
          </article>
          <article className="card">
            <div className="card__thumb"><img src={image2} alt="음성 → 텍스트 변환" /></div>
            <h3 className="card__title">음성 &gt; 텍스트 변환</h3>
            <p className="card__desc">의사의 음성을 텍스트로 변환하여 전달해요.</p>
          </article>
          <article className="card">
            <div className="card__thumb"><img src={image3} alt="진료 내용 요약" /></div>
            <h3 className="card__title">진료 내용 요약</h3>
            <p className="card__desc">진료 후, 중요한 내용을 요약하여 전달해요.</p>
          </article>
        </section>
      </main>

      <div className="landing__cta">
        <Link to="/prepare" className="cta__link">
          수어 통역 대면 진료 받으러 가기 <span className="cta__arrow" aria-hidden>→</span>
        </Link>
      </div>

      {/* 모달들 */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onOpenSignup={() => {           // ⬅️ 회원가입 열기 연결
            setShowLogin(false);          // 로그인 모달 닫고
            setShowSignup(true);          // 회원가입 모달 열기
          }}
        />
      )}

      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          onSuccess={() => {              // 가입 성공(=자동 로그인 완료)
            setShowSignup(false);
            setShowLogin(false);
          }}
        />
      )}
    </div>
  );
}
