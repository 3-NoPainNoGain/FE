// src/pages/VisitPrepare.jsx
import { useNavigate } from 'react-router-dom';
import './visit.css';
import Sidebar from '../components/Sidebar';
import { startDiagnosisSession } from '../services/diagnosis.js';

export default function VisitPrepare() {
  const navigate = useNavigate();

  const startSession = async () => {
    const ids = await startDiagnosisSession({});
    const id = ids?.[0];
    if (!id) { alert('세션 ID를 받지 못했습니다.'); return; }
    navigate(`/session/${id}`);
  };

  return (
    <div className="visit">
      <Sidebar />

      <main className="visit__main">
        <div className="vm__container">

          {/* 가이드 카드 */}
          <section className="vm__guideCard" aria-label="서비스 사용 가이드">
            <header className="vm__cardHeader">
              <div className="vm__badge">사용 가이드</div>
              <h1 className="vm__title">진료 전, 이렇게 이용해요</h1>
              <p className="vm__subtitle">
                카메라/마이크를 사용하여, 수어와 음성을 텍스트로 변환해 드려요.
              </p>
            </header>

            <div className="vm__sections">
              {/* 수어 인식 */}
              <article className="vm__section">
                <div className="vm__icon" aria-hidden="true">✋</div>
                <div className="vm__content">
                  <h2 className="vm__sectionTitle">수어 인식</h2>
                  <ul className="vm__list">
                    <li>카메라 앞에서 수어를 하면 자동으로 텍스트로 변환됩니다.</li>
                    <li>문장이 맞으면 <strong>전송하기</strong>를 누르고, 틀리면 <strong>❌</strong>을 눌러 다시 시도하세요.</li>
                  </ul>
                </div>
              </article>

              {/* 음성 입력 */}
              <article className="vm__section">
                <div className="vm__icon" aria-hidden="true">🎤</div>
                <div className="vm__content">
                  <h2 className="vm__sectionTitle">음성 입력</h2>
                  <ul className="vm__list">
                    <li><strong>음성 아이콘</strong>을 클릭한 뒤 말하세요.</li>
                    <li>다시 아이콘을 누르면 음성이 텍스트로 변환되어 채팅창에 표시됩니다.</li>
                  </ul>
                </div>
              </article>
            </div>
          </section>

          {/* 시작 버튼 */}
          <div className="vm__actions">
            <button className="vm__start" onClick={startSession}>
              진료 시작하기 <span className="arrow">▶</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
