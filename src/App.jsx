import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import VisitPrepare from "./pages/VisitPrepare";
import InPersonSession from "./pages/InPersonSession";
import DiagnosisSummaryPage from "./pages/DiagnosisSummaryPage.jsx";
import TeleDoctorList from "./pages/TeleDoctorList"; 
import ReservationConfirm from "./pages/ReservationConfirm.jsx";
import TeleApplyWizard from "./pages/TeleApplyWizard.jsx";

export default function App() {
  return (
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

        {/* ✅ 비대면 진료 의사 목록 */}
        <Route path="/tele/doctor-list" element={<TeleDoctorList />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/tele/apply/:doctorId" element={<TeleApplyWizard />} />
<Route path="/reservation/confirm" element={<ReservationConfirm />} />

      </Routes>
    </BrowserRouter>
  );
}
