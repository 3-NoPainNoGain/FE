// 코드 제목: SocialLoginButtons (아이콘 내장/브랜드 컬러)
import { startOAuth } from "../utils/oauthStart";
import "./login-modal.css"; // 버튼 스타일 재사용

export default function SocialLoginButtons() {
  return (
    <div className="social-row">
      <button type="button" className="btn-social kakao" onClick={()=>startOAuth("kakao")}>
        <span className="btn-social__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 3C6.48 3 2 6.39 2 10.5c0 2.37 1.61 4.46 4.03 5.72L5 21l4.05-2.4c.94.17 1.94.26 2.95.26 5.52 0 10-3.39 10-7.5S17.52 3 12 3z" fill="currentColor"/>
          </svg>
        </span>
        <span className="btn-social__text">카카오로 시작하기</span>
      </button>

      <button type="button" className="btn-social google" onClick={()=>startOAuth("google")}>
        <span className="btn-social__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="18" height="18">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.23 3.6l6.9-6.9C36.9 2.3 30.9 0 24 0 14.62 0 6.44 5.38 2.54 13.2l8.06 6.26C12.35 13.3 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.12-.44-4.5H24v9h12.7c-.55 2.96-2.24 5.46-4.78 7.15l7.32 5.67C44.2 37.7 46.5 31.6 46.5 24.5z"/>
            <path fill="#FBBC05" d="M10.6 19.46 2.54 13.2C.92 16.36 0 20.05 0 24c0 3.94.92 7.63 2.54 10.8l8.06-6.26C9.9 26.56 9.5 25.33 9.5 24s.4-2.56 1.1-4.54z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.14 15.76-5.84l-7.32-5.67c-2.03 1.37-4.64 2.16-8.44 2.16-6.26 0-11.65-3.8-13.4-9.5l-8.06 6.26C6.44 42.62 14.62 48 24 48z"/>
          </svg>
        </span>
        <span className="btn-social__text">Google로 로그인</span>
      </button>
    </div>
  );
}
