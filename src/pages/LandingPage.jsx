// src/pages/LandingPage.jsx
import { Link } from 'react-router-dom'
import './landing.css'

import logoImg from '../assets/logo.png'
import image1 from '../assets/image1.png'
import image2 from '../assets/image2.png'
import image3 from '../assets/image3.png'

export default function LandingPage() {
  return (
    <div className="landing">
      {/* 헤더 */}
      <header className="landing__header">
        <div className="landing__brand">
          <img src={logoImg} alt="Handoc 로고" className="brand__logo" />
          <span className="brand__name">Handoc</span>
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
    </div>
  )
}
