# 배포 및 환경 설정 가이드

## 🚨 중요 사항
이 문서는 파일 업로드부터 OCR 처리까지의 핵심 기능이 정상 동작하도록 하는 필수 설정들을 포함합니다.
**개발자는 이 설정들을 변경하기 전에 반드시 팀과 상의해야 합니다.**

## 필수 환경 변수 (.env 파일)

### 🔒 절대 변경 금지 항목
다음 설정들은 현재 정상 동작하는 시스템의 핵심 구성요소입니다:

```env
# 서버 포트 설정 (변경 시 CORS 오류 발생 가능)
PORT=3030
MAIN_PORT=8888
NODE_ENV=production

# OCR 서비스 설정 (변경 시 OCR 기능 중단)
ENABLE_VISION_OCR=true
USE_VISION=true
USE_TEXTRACT=false
```

### 🔑 인증 정보 (환경별 설정 필요)
새로운 환경에서는 다음 값들을 해당 환경에 맞게 설정해야 합니다:

```env
# Google Cloud 설정
GCP_PROJECT_ID=medreport-assistant
GOOGLE_APPLICATION_CREDENTIALS=C:/VisionKeys/medreport-assistant-e4e428ceaad0.json
GOOGLE_CLOUD_VISION_API_KEY=AIzaSyBIw0kynZ2q5NNB8qmNmT2PXWKyEpr0-70
GCS_BUCKET_NAME=medreport-vision-ocr-bucket
GCS_BUCKET=medreport-vision-ocr-bucket

# AI 서비스 API 키
CLAUDE_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

## 서버 구동 방법

### 1. 백엔드 서버 (포트 3030)
```bash
cd backend
node app.js
```

### 2. 프론트엔드 서버 (포트 8080)
```bash
cd frontend
npx http-server . -p 8080 -c-1
```

## CORS 설정

### 🚨 중요: 허용된 Origin 목록
다음 파일들의 CORS 설정을 변경할 때는 반드시 개발팀과 상의하세요:

- `backend/app.js`
- `backend/routes/ocrRoutes.js`

현재 허용된 Origins:
- http://localhost:5173
- http://localhost:5174
- http://localhost:5175
- http://localhost:8080
- http://localhost:3030

## 파일 구조 보호

### 절대 삭제/이동 금지 파일들
```
backend/
├── app.js                 # 메인 서버 파일
├── routes/ocrRoutes.js    # OCR API 라우트
├── controllers/           # API 컨트롤러
├── services/             # OCR 서비스 로직
└── utils/                # 유틸리티 함수

frontend/
├── script.js             # 메인 프론트엔드 로직
├── index.html            # 메인 페이지
└── config/insurers.json  # 보험사 설정
```

## 의존성 관리

### 백엔드 필수 패키지
```json
{
  "@google-cloud/vision": "^4.0.0",
  "@google-cloud/storage": "^7.0.0",
  "express": "^4.18.0",
  "cors": "^2.8.5",
  "multer": "^1.4.5",
  "uuid": "^9.0.0"
}
```

### 프론트엔드 서버
```bash
npm install -g http-server
```

## 트러블슈팅

### 1. CORS 오류
- 백엔드와 프론트엔드 포트가 올바른지 확인
- allowedOrigins 목록에 사용 중인 포트가 포함되어 있는지 확인

### 2. OCR 서비스 오류
- Google Cloud 인증 파일 경로 확인
- API 키 유효성 확인
- 프로젝트 ID 정확성 확인

### 3. 파일 업로드 오류
- temp 디렉토리 권한 확인
- 파일 크기 제한 확인

## 새로운 환경 설정 체크리스트

- [ ] .env 파일 생성 및 환경별 값 설정
- [ ] Google Cloud 인증 파일 배치
- [ ] 필요한 디렉토리 생성 (temp, uploads 등)
- [ ] 의존성 패키지 설치
- [ ] 포트 충돌 확인
- [ ] 방화벽 설정 확인
- [ ] 백엔드 서버 구동 테스트
- [ ] 프론트엔드 서버 구동 테스트
- [ ] 파일 업로드 기능 테스트
- [ ] OCR 처리 기능 테스트

---

**⚠️ 경고: 이 가이드의 설정을 변경하기 전에 반드시 개발팀과 상의하세요.**
**시스템의 안정성을 위해 테스트 환경에서 먼저 검증 후 적용하세요.**