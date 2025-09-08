import React from 'react';
import FeatureCard from './FeatureCard';

export default function LandingSection() {
  return (
    <section className="landing">
      <header className="landing-header">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <span className="brand-name">Handoc</span>
        </div>
      </header>

      <div className="hero">
        <h1 className="hero-title">손으로 소통하는 진료, Handoc</h1>
        <p className="hero-sub">병원 진료에 최적화된 솔루션</p>
      </div>

      <div className="cards">
        <FeatureCard
          title="수어 > 텍스트 변환"
          desc="수어를 인식하여 텍스트로 변환해 의사에게 전달합니다."
          imgAlt="수어 인식"
        />
        <FeatureCard
          title="음성 > 텍스트 변환"
          desc="의사의 음성을 텍스트로 변환해 환자에게 보여줍니다."
          imgAlt="음성 인식"
        />
        <FeatureCard
          title="진료 내용 요약"
          desc="진료 후 핵심 내용을 요약해 전달합니다."
          imgAlt="진료 요약"
        />
      </div>

      <div className="cta">
        <a className="cta-link" href="/clinic">
          수어 통역 대면 진료 받으러 가기 →
        </a>
      </div>
    </section>
  );
}
