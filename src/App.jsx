// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import VisitPrepare from "./pages/VisitPrepare";
import InPersonSession from "./pages/InPersonSession";
import DiagnosisSummaryPage from "./pages/DiagnosisSummaryPage.jsx";

import TeleDoctorList from "./pages/TeleDoctorList";
import TeleDoctorDetail from "./pages/TeleDoctorDetail";
import TeleApplyWizard from "./pages/TeleApplyWizard";
import ReservationConfirm from "./pages/ReservationConfirm";

// ✅ 둘 다 실제로 라우트에서 씁니다
import OAuthCallback from "./pages/OAuthCallback";
import SessionPage from "./pages/SessionPage";

import { AuthProvider } from "./auth/AuthContext";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 랜딩 */}
          <Route path="/" element={<LandingPage />} />

          {/* 대면 진료 */}
          <Route path="/prepare" element={<VisitPrepare />} />
          <Route path="/session/:diagnosisId" element={<InPersonSession />} />
          <Route path="/session/:diagnosisId/summary" element={<DiagnosisSummaryPage />} />

          {/* 비대면 진료 */}
          <Route path="/tele/doctor-list" element={<TeleDoctorList />} />
          <Route path="/tele/doctor/:doctorId" element={<TeleDoctorDetail />} />
          <Route path="/tele/apply/:doctorId" element={<TeleApplyWizard />} />

          {/* ✅ 예약 확인(파라미터 필수) */}
          <Route path="/reservation/confirm/:reservationId" element={<ReservationConfirm />} />

          {/* ✅ 텔레 진료실 (Apply/Confirm에서 이동) */}
          <Route path="/tele/session/:reservationId" element={<SessionPage />} />

          {/* ✅ OAuth 콜백 실제 사용 시 */}
          <Route path="/oauth/:provider/callback" element={<OAuthCallback />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
