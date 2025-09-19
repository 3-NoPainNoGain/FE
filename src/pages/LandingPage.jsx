import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

import logoImg from "../assets/logo.png";
import image1 from "../assets/image1.png";
import image2 from "../assets/image2.png";
import image3 from "../assets/image3.png";

import { useAuth } from "../auth/AuthContext";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";
import NameModal from "../components/NameModal";

export default function LandingPage() {
  const nav = useNavigate();
  const { isLoggedIn, user, logout, setUserName } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showName, setShowName] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // 소셜 로그인 직후 name이 없는 경우만 모달 open
  useEffect(() => {
    // 로그인 상태 + user?.name 없음 + needName flag 있을 때만
    const flag = sessionStorage.getItem("needName");
    if (isLoggedIn && (!user?.name || flag)) {
      setShowName(true);
      sessionStorage.removeItem("needName");
    } else {
      setShowName(false);
    }
  }, [isLoggedIn, user?.name]);

  const goPrepare = (e) => {
    if (!isLoggedIn) {
      e.preventDefault();
      setShowLogin(true);
      return;
    }
    nav("/prepare");
  };

  const headerRight = !isLoggedIn ? (
    <button className="btn-login" onClick={() => setShowLogin(true)}>로그인</button>
  ) : (
    <div className="userbox">
      <button className="userbox__btn" onClick={()=>setMenuOpen((v)=>!v)}>
        <span className="userbox__avatar" aria-hidden>👤</span>
        <span className="userbox__name">{user?.name ? `${user.name}님` : "사용자님"}</span>
      </button>
      {menuOpen && (
        <div className="userbox__menu" role="menu">
          <button className="userbox__item" onClick={()=>{setShowName(true); setMenuOpen(false);}}>이름 수정</button>
          <button className="userbox__item -danger" onClick={()=>{ logout(); setMenuOpen(false); }}>로그아웃</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <img src={logoImg} alt="Handoc 로고" className="brand__logo" />
          <span className="brand__name">Handoc</span>
        </div>
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

      <div className="landing__cta">
        <a href="/prepare" onClick={goPrepare} className="cta__link">
          수어 통역 대면 진료 받으러 가기 <span className="cta__arrow" aria-hidden>→</span>
        </a>
      </div>

      {/* 로그인 모달 */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onOpenSignup={() => { setShowLogin(false); setShowSignup(true); }}
        />
      )}
      {/* 회원가입 모달 */}
      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          onSuccess={() => { setShowSignup(false); setShowLogin(false); }}
        />
      )}

      {/* 이름 입력 모달: 로그인 상태 + name 없음일 때만 */}
      {showName && isLoggedIn && (
        <NameModal
          onClose={() => setShowName(false)}
          onSubmit={async (name) => {
            await setUserName(name);
            setShowName(false);
          }}
        />
      )}
    </div>
  );
}
