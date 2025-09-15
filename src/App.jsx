// 코드 제목: App.jsx (라우팅 + AuthProvider 적용)
// - BrowserRouter 안에서 Routes 구성
// - 상단 로그인 버튼/모달에서 사용하는 인증 컨텍스트를 전역에 공급하기 위해 AuthProvider로 전체 감싸기
// - 중복된 라우트(/tele/doctor/:doctorId, /tele/apply/:doctorId) 제거

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import VisitPrepare from "./pages/VisitPrepare";
import InPersonSession from "./pages/InPersonSession";
import DiagnosisSummaryPage from "./pages/DiagnosisSummaryPage.jsx";

import TeleDoctorList from "./pages/TeleDoctorList";
import TeleDoctorDetail from "./pages/TeleDoctorDetail";
import TeleApplyWizard from "./pages/TeleApplyWizard";

import ReservationConfirm from "./pages/ReservationConfirm";

import { AuthProvider } from "./auth/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 랜딩 페이지 */}
          <Route path="/" element={<LandingPage />} />

          {/* 대면 진료 준비 / 세션 / 요약 */}
          <Route path="/prepare" element={<VisitPrepare />} />
          <Route path="/session/:diagnosisId" element={<InPersonSession />} />
          <Route
            path="/session/:diagnosisId/summary"
            element={<DiagnosisSummaryPage />}
          />

          {/* 비대면 진료 */}
          <Route path="/tele/doctor-list" element={<TeleDoctorList />} />
          <Route path="/tele/doctor/:doctorId" element={<TeleDoctorDetail />} />
          <Route path="/tele/apply/:doctorId" element={<TeleApplyWizard />} />

          {/* 예약 확인 */}
          <Route path="/reservation/confirm" element={<ReservationConfirm />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
