# handDoc - Frontend

handDoc 서비스의 프론트엔드 애플리케이션으로,  
청각 장애인 환자와 의료진 간의 원활한 비대면 진료를 지원하는 웹 기반 사용자 인터페이스입니다.

프론트엔드는 WebRTC 기반 화상 진료, WebSocket 기반 실시간 수어 인식 결과 수신,  
음성 인식 결과 및 자막을 실시간으로 시각화하는 역할을 담당합니다.

배포 링크:  
https://handdocfe.vercel.app/

---

## 🛠 기술 스택

- Framework: React (Create React App)
- Language: JavaScript
- Networking: Axios
- Routing: React Router
- Real-time Communication:
  - WebRTC (화상 진료)
  - WebSocket (AI 서버 연동)
- Media Processing:
  - MediaPipe Hands
- Deployment: Vercel

---

## 📐 시스템 내 프론트엔드 역할

handDoc 시스템은 다음과 같은 구조로 구성됩니다.

- **Frontend (React)**  
  WebRTC 기반 화상 진료 UI 제공,  
  WebSocket을 통해 FastAPI AI 서버로 영상 프레임을 전송하고  
  수어 인식 결과 및 음성 인식 결과를 실시간으로 화면에 출력합니다.

- **Backend (Spring Boot)**  
  사용자 인증(OAuth 로그인),  
  WebRTC 연결을 위한 시그널링(SDP, ICE Candidate 교환) 역할을 담당합니다.

- **FastAPI (AI Server)**  
  WebSocket을 통해 전달받은 영상 프레임 및 음성 데이터를 처리하여  
  수어 인식 결과 및 음성 인식 결과를 반환합니다.

프론트엔드는 백엔드 서버를 통해 시그널링을 수행한 뒤,  
의사와 환자 간 WebRTC P2P 연결을 직접 수립합니다.

---

## 🚀 실행 방법

### 1. 실행 환경

- Node.js 18 이상
- npm
- 백엔드 서버 실행 필요 (API 및 WebSocket 연동)

---

### 2. 환경 변수 설정

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 내용을 입력합니다.

```env
# Kakao Login
REACT_APP_KAKAO_CLIENT_ID=발급받은_카카오_CLIENT_ID
REACT_APP_KAKAO_REDIRECT_URI=http://localhost:3000/oauth/kakao/callback

# Google Login
REACT_APP_GOOGLE_CLIENT_ID=발급받은_구글_CLIENT_ID
REACT_APP_GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback

# Kakao Maps
REACT_APP_KAKAO_MAPS_APP_KEY=발급받은_카카오_지도_API_KEY

```
Create React App(CRA) 환경에서는
환경 변수명이 반드시 REACT_APP_ prefix로 시작해야 합니다.

---

### 3. 설정 파일

`src/config.js`에서 실행 모드를 제어합니다.

- `USE_MOCK`: 목(mock) 모드 사용 여부
- `MOCK_ROOM_ID`: 테스트용 WebRTC 방 ID
- `ENABLE_GUEST_MODE`: 로그인 없이 연결 테스트 모드

### 4. 의존성 설치
```bash
npm install
```

### 5. 로컬 실행
```bash
npm start
```

### 6. 빌드

```bash
npm run build
```

### 🧪 테스트 방법

자동화된 테스트 코드는 포함되어 있지 않으며, 다음 시나리오 기반으로 기능을 검증합니다.
- WebRTC 화상 연결 정상 여부
- 수어 영상 입력 및 실시간 인식 결과 출력
- 음성 입력 및 텍스트 변환 결과 출력
- 게스트 모드에서의 시그널링 연결 테스트

### 📁 샘플 / 프로토 데이터

- 별도의 정적 샘플 데이터 파일은 포함하지 않습니다.
- 실시간 카메라 입력을 사용하여 수어 인식 테스트를 수행합니다.
- 본 서비스는 역할 기반(의사 / 환자) 계정으로 동작하며,
  테스트를 위해서는 회원가입 후 로그인이 필요합니다.
- 의사 계정과 환자 계정은 각각 로그인하여
  WebRTC 화상 진료 및 실시간 수어·음성 인식 기능을 테스트할 수 있습니다.

### 🔗 백엔드 연동

- 프론트엔드는 배포된 프로덕션 백엔드 서버와 연동됩니다.
- REST API 통신: Axios
- WebRTC 시그널링: WebSocket
- AI 서버 연동: WebSocket
- 백엔드 실행 방법 및 API 명세는 백엔드 저장소의 README를 참고하십시오.

### 📚 사용한 오픈소스

- React
- MediaPipe holistic
- Axios
- React Router
- WebRTC API

