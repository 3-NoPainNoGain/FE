import { useEffect, useState } from "react";
import "./landing.css";

import image1 from "../assets/image1.png";
import image2 from "../assets/image2.png";
import image3 from "../assets/image3.png";

import { useAuth } from "../auth/AuthContext";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";
import NameModal from "../components/NameModal";
import Sidebar from "../components/Sidebar";

export default function LandingPage() {
  const { isLoggedIn, user, logout, setUserName } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showName, setShowName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const flag = sessionStorage.getItem("needName");
    if (isLoggedIn && (!user?.name || flag)) {
      setShowName(true);
      sessionStorage.removeItem("needName");
    } else {
      setShowName(false);
    }
  }, [isLoggedIn, user?.name]);

  const headerRight = !isLoggedIn ? (
    <button className="btn-login" onClick={() => setShowLogin(true)}>
      로그인
    </button>
  ) : (
    <div className="userbox">
      <button className="userbox__btn" onClick={() => setMenuOpen((v) => !v)}>
        <span className="userbox__avatar" aria-hidden>👤</span>
        <span className="userbox__name">{user?.name ? `${user.name}님` : "사용자님"}</span>
      </button>
      {menuOpen && (
        <div className="userbox__menu" role="menu">
          <button className="userbox__item" onClick={() => { setShowName(true); setMenuOpen(false); }}>이름 수정</button>
          <button className="userbox__item -danger" onClick={() => { logout(); setMenuOpen(false); }}>로그아웃</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="layout">
      {/* 좌측 사이드바 */}
      <Sidebar />

      {/* 메인 컨텐츠 */}
      <div className="landing">
        <header className="landing__header">
          <div className="landing__actions">{headerRight}</div>
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

        {/* ✅ CTA 버튼 제거 */}
      </div>

      {/* 모달 */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onOpenSignup={() => { setShowLogin(false); setShowSignup(true); }}
        />
      )}
      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          onSuccess={() => { setShowSignup(false); setShowLogin(false); }}
        />
      )}
      {showName && isLoggedIn && (
        <NameModal
          onClose={() => setShowName(false)}
          onSubmit={async (name) => { await setUserName(name); setShowName(false); }}
        />
      )}
    </div>
  );
}
