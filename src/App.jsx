import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import VisitPrepare from "./pages/VisitPrepare";
import InPersonSession from "./pages/InPersonSession";
import DiagnosisSummaryPage from "./pages/DiagnosisSummaryPage.jsx";
import WebRtcSession from "./pages/WebRtcSession";

import TeleDoctorList from "./pages/TeleDoctorList";
import TeleDoctorDetail from "./pages/TeleDoctorDetail";
import TeleApplyWizard from "./pages/TeleApplyWizard";
import ReservationConfirm from "./pages/ReservationConfirm";

import OAuthCallback from "./pages/OAuthCallback";
import { AuthProvider } from "./auth/AuthContext";

//  의사 뷰: 진료 예약 리스트 페이지
import DoctorReservationList from "./pages/DoctorReservationList";
import TelemedSummaryPage from "./pages/TelemedSummaryPage";

// 환자 뷰 - 비대면 진료 내역 목록 & 상세
import TelemedHistoryPage from "./pages/TelemedHistoryPage";              
import TelemedHistoryDetailPage from "./pages/TelemedHistoryDetailPage"; 
import HospitalMapPage from "./pages/HospitalMapPage";


export default function App() {
  return (
    <BrowserRouter>
      {/*  Router 안쪽에 AuthProvider를 둡니다 */}
      <AuthProvider>
        <Routes>
          {/* 랜딩 */}
          <Route path="/" element={<LandingPage />} />

          {/* 대면 진료 */}
          <Route path="/prepare" element={<VisitPrepare />} />
          <Route path="/session/:diagnosisId" element={<InPersonSession />} />
          <Route path="/session/:diagnosisId/summary" element={<DiagnosisSummaryPage />} />

          {/* 비대면 진료 (환자 뷰) */}
          <Route path="/tele/doctor-list" element={<TeleDoctorList />} />
          <Route path="/tele/doctor/:doctorId" element={<TeleDoctorDetail />} />
          <Route path="/tele/apply/:doctorId" element={<TeleApplyWizard />} />

           <Route path="/hospital-map" element={<HospitalMapPage />} />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

          {/* 예약 확인 */}
          <Route path="/reservation/confirm/:reservationId" element={<ReservationConfirm />} />

          {/* WebRTC 진료실 */}
          <Route path="/tele/session/:reservationId" element={<WebRtcSession />} />

          {/* 의사용 단축 URL: /doctor → 부모 세션 URL로 리다이렉트, roleHint 전달 */}
          <Route
            path="/tele/session/:reservationId/doctor"
            element={<Navigate to=".." replace state={{ roleHint: "doctor" }} />}
          />
          <Route path="/telemed/summary/:roomId" element={<TelemedSummaryPage />} />
          {/* 의사 뷰 */}
          <Route path="/doctor/reservations" element={<DoctorReservationList />} />
          {/* 비대면 진료 내역 */}
          <Route path="/telemed/history" element={<TelemedHistoryPage />} />
          <Route path="/telemed/history/:roomId" element={<TelemedHistoryDetailPage />} />

          {/* OAuth 콜백 */}
          <Route path="/oauth/:provider/callback" element={<OAuthCallback />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
