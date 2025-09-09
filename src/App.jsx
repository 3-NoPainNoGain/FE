import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import VisitPrepare from "./pages/VisitPrepare";
import InPersonSession from "./pages/InPersonSession";
import DiagnosisSummaryPage from "./pages/DiagnosisSummaryPage.jsx";
import WebRtcSession from "./pages/WebRtcSession";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 랜딩 페이지 */}
        <Route path="/" element={<LandingPage />} />

        {/* 대면 진료 준비 페이지 */}
        <Route path="/prepare" element={<VisitPrepare />} />
        <Route path="/session/:diagnosisId" element={<InPersonSession />} />

        {/* 비대면 진료(WebRTC) */}
        <Route path="/tele" element={<WebRtcSession />} />

        {/* 요약 페이지 라우트 */}
        <Route
          path="/session/:diagnosisId/summary"
          element={<DiagnosisSummaryPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
