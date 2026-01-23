# 🖥️ VNEXSUS Windows 로컬 환경 완벽 설정 가이드

> **목표**: C:\VNEXSUS_26-01-23 폴더에 완전한 작동 환경 구축
> **소요 시간**: 30-45분
> **필수 조건**: Node.js 18+, Git

---

## 📥 1단계: 레포지토리 클로닝 (5분)

### 1.1 작업 폴더 생성
```cmd
:: Windows 명령 프롬프트 (CMD) 또는 PowerShell에서 실행
cd C:\
mkdir VNEXSUS_26-01-23
cd VNEXSUS_26-01-23
```

### 1.2 운영 레포지토리 클론
```cmd
git clone https://github.com/nofnotg/VNEXSUS-25-12-30.git
cd VNEXSUS-25-12-30
```

**참고**: "자료데이터" 레포지토리 URL이 있다면 같은 방식으로 클론하세요:
```cmd
cd C:\VNEXSUS_26-01-23
git clone https://github.com/[your-username]/[data-repo-name].git
```

---

## ⚙️ 2단계: 환경 설정 (10분)

### 2.1 Node.js 버전 확인
```cmd
node --version
:: v18.0.0 이상이어야 합니다
npm --version
```

**Node.js가 없다면**:
1. https://nodejs.org 방문
2. LTS 버전 다운로드 및 설치
3. 컴퓨터 재부팅

### 2.2 환경변수 파일 생성
```cmd
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30
copy .env.example .env
```

### 2.3 .env 파일 편집
메모장이나 VSCode로 `.env` 파일을 열고 다음 항목을 설정:

```env
# ========================================
# 기본 서버 설정
# ========================================
NODE_ENV=development
PORT=3030

# ========================================
# Google Cloud Vision OCR (선택사항)
# OCR 기능을 사용하려면 설정 필요
# ========================================
ENABLE_VISION_OCR=true
USE_VISION=true
USE_TEXTRACT=false

# Google Cloud 설정
GCS_BUCKET_NAME=your-bucket-name-here
GCP_PROJECT_ID=your-project-id-here

# 다음 중 하나를 선택:
# 옵션 1: API 키 사용 (간단)
GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here

# 옵션 2: 서비스 계정 키 파일 사용 (권장)
# GOOGLE_APPLICATION_CREDENTIALS=C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\credentials\service-account-key.json

# ========================================
# AI 모델 API 키 (선택사항)
# ========================================

# OpenAI (GPT 모델 사용시)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2

# Google Gemini (Gemini 모델 사용시)
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key-here

# Anthropic Claude (Claude 모델 사용시)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# ========================================
# 코어 엔진 설정
# ========================================
USE_CORE_ENGINE=true
DISCLOSURE_WINDOWS=3m,2y,5y
DEFAULT_CLAIM_DIAGNOSIS=""

# ========================================
# 보안 및 성능 설정
# ========================================
CORS_ORIGIN=http://localhost:3030
MAX_FILE_SIZE=209715200
MAX_FILES_PER_REQUEST=5
RATE_LIMIT_REQUESTS_PER_MINUTE=60
PARALLEL_LIMIT=6

# ========================================
# 로깅 및 디버깅
# ========================================
LOG_LEVEL=info
DEBUG_MODE=false
SKIP_PDF_TESTS=true

# ========================================
# 로컬 데이터 경로
# ========================================
# PDF 리포트 저장 경로 (Windows 경로)
REPORTS_PDF_ROOT=C:\VNEXSUS_26-01-23\reports_pdf
TEST_DATA_PATH=C:\VNEXSUS_26-01-23\test_data
```

---

## 📦 3단계: 의존성 설치 (10분)

### 3.1 백엔드 패키지 설치
```cmd
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\backend
npm install
```

**설치 시간**: 약 5-10분 (인터넷 속도에 따라 다름)

### 3.2 설치 확인
```cmd
npm list --depth=0
```

다음 주요 패키지들이 설치되어야 합니다:
- express
- @google-cloud/vision
- @google-cloud/storage
- openai
- axios
- multer
- pdf-parse

---

## 🗂️ 4단계: 필수 폴더 생성 (2분)

```cmd
cd C:\VNEXSUS_26-01-23

:: 리포트 저장 폴더
mkdir reports_pdf

:: 테스트 데이터 폴더
mkdir test_data

:: 임시 업로드 폴더
mkdir VNEXSUS-25-12-30\backend\uploads

:: 크레덴셜 폴더 (서비스 계정 키 저장용)
mkdir VNEXSUS-25-12-30\credentials
```

---

## 🔑 5단계: API 키 및 인증 설정 (선택사항)

### 5.1 Google Cloud Vision API 설정

**옵션 A: API 키 사용 (간단)**
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. API 및 서비스 > 사용자 인증 정보
3. "사용자 인증 정보 만들기" > "API 키"
4. 생성된 키를 `.env` 파일의 `GOOGLE_CLOUD_VISION_API_KEY`에 입력

**옵션 B: 서비스 계정 키 사용 (권장)**
1. Google Cloud Console > IAM 및 관리자 > 서비스 계정
2. 서비스 계정 생성 (역할: Cloud Vision API 사용자)
3. 키 생성 (JSON 형식)
4. 다운로드한 JSON 파일을 `C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\credentials\service-account-key.json`에 저장
5. `.env` 파일의 `GOOGLE_APPLICATION_CREDENTIALS` 주석 해제 및 경로 설정

### 5.2 OpenAI API 키 설정 (선택사항)
1. [OpenAI Platform](https://platform.openai.com) 접속
2. API Keys 메뉴에서 새 키 생성
3. 생성된 키를 `.env` 파일의 `OPENAI_API_KEY`에 입력

---

## 🚀 6단계: 서버 실행 및 테스트

### 6.1 백엔드 서버 시작
```cmd
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\backend
npm start
```

**성공 메시지 확인**:
```
[시간] ✅ 환경 변수 검증 완료. 필수 환경변수가 모두 설정되었습니다.
[시간] ======================================
[시간] OCR 서버가 포트 3030에서 실행 중입니다.
[시간] http://localhost:3030
[시간] 외부 접속 가능 (0.0.0.0:3030)
[시간] ======================================
[시간] Dev Case Manager 서버가 포트 8088에서 실행 중입니다.
[시간] http://localhost:8088
```

### 6.2 브라우저에서 접속 테스트
웹 브라우저(Chrome, Edge 등)를 열고:
- 메인 애플리케이션: http://localhost:3030
- Dev Case Manager: http://localhost:8088

### 6.3 API 상태 확인
새 명령 프롬프트 창에서:
```cmd
curl http://localhost:3030/api/health
```

또는 브라우저에서 직접 접속:
```
http://localhost:3030/api/health
```

---

## 🧪 7단계: 기능 테스트

### 7.1 Vision OCR 테스트 (API 키가 있는 경우)
```cmd
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\backend
npm run test:vision
```

### 7.2 전체 테스트 실행
```cmd
npm test
```

---

## 🔧 문제 해결

### 문제 1: 포트 3030이 이미 사용 중
```cmd
:: 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3030

:: 프로세스 종료 (PID를 위 명령어 결과에서 확인)
taskkill /PID [PID번호] /F

:: 또는 .env 파일에서 다른 포트 사용
PORT=3031
```

### 문제 2: 모듈을 찾을 수 없음
```cmd
:: node_modules 폴더 삭제 후 재설치
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\backend
rmdir /s /q node_modules
npm install
```

### 문제 3: 환경변수 로딩 실패
- `.env` 파일이 `C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\` 경로에 있는지 확인
- 파일명이 정확히 `.env`인지 확인 (`.env.txt`가 아님)
- Windows 탐색기 설정에서 "파일 확장명 표시" 활성화

### 문제 4: Google Cloud 인증 오류
```cmd
:: 환경변수 확인
node backend\app.js
```
출력에서 다음 확인:
- `GOOGLE_APPLICATION_CREDENTIALS`: ✅ 설정됨
- `GOOGLE_CLOUD_VISION_API_KEY`: ✅ 설정됨

둘 중 하나만 설정되어 있어도 작동합니다.

---

## 📊 개발 모드로 실행 (자동 재시작)

코드 수정 시 자동으로 서버가 재시작되도록:

```cmd
cd C:\VNEXSUS_26-01-23\VNEXSUS-25-12-30\backend
npm run dev
```

---

## 🌐 네트워크 내 다른 기기에서 접속

같은 Wi-Fi 네트워크의 다른 기기(스마트폰, 태블릿 등)에서 접속하려면:

### 1. Windows 방화벽 설정
1. Windows 보안 > 방화벽 및 네트워크 보호
2. 고급 설정 > 인바운드 규칙 > 새 규칙
3. 포트 > TCP > 특정 로컬 포트: 3030, 8088
4. 연결 허용 > 이름: "VNEXSUS Server"

### 2. 내 컴퓨터 IP 주소 확인
```cmd
ipconfig
```
"IPv4 주소"를 확인 (예: 192.168.0.100)

### 3. 다른 기기에서 접속
```
http://192.168.0.100:3030
```

---

## 🎯 전체 시스템 아키텍처

```
C:\VNEXSUS_26-01-23\
├── VNEXSUS-25-12-30\          # 메인 애플리케이션 레포
│   ├── backend\               # Node.js 백엔드
│   │   ├── app.js            # 메인 서버
│   │   ├── routes\           # API 라우트
│   │   ├── services\         # 비즈니스 로직
│   │   └── uploads\          # 업로드 임시 파일
│   ├── frontend\             # 웹 프론트엔드
│   ├── src\                  # 소스 코드
│   ├── credentials\          # API 키 및 인증 파일
│   └── .env                  # 환경변수 설정
├── reports_pdf\              # 생성된 보고서 저장
└── test_data\                # 테스트 데이터
```

---

## ✅ 설정 완료 체크리스트

- [ ] Git 레포지토리 클론 완료
- [ ] Node.js 18+ 설치 확인
- [ ] `.env` 파일 생성 및 설정 완료
- [ ] `npm install` 성공
- [ ] 필수 폴더 생성 완료
- [ ] API 키 설정 (선택사항)
- [ ] 서버 실행 성공 (포트 3030, 8088)
- [ ] 브라우저 접속 확인
- [ ] 방화벽 설정 (네트워크 접속 필요시)

---

## 🚀 다음 단계

서버가 성공적으로 실행되면:

1. **프론트엔드 페이지 탐색**
   - http://localhost:3030 - 메인 대시보드
   - http://localhost:3030/upload.html - 파일 업로드
   - http://localhost:8088 - Dev Case Manager

2. **API 문서 확인**
   - README.md
   - API_DOCUMENTATION.md

3. **테스트 데이터 준비**
   - 의료 문서 샘플을 `test_data` 폴더에 저장
   - PDF, 이미지(JPG, PNG) 파일 지원

4. **개발 시작**
   - `npm run dev`로 개발 모드 실행
   - 코드 수정 시 자동 재시작

---

## 📞 지원

문제가 발생하면:
1. 에러 메시지 전체를 복사
2. `backend\app.js` 실행 로그 확인
3. `.env` 파일 설정 재확인
4. GitHub Issues에 문의

---

**🎉 축하합니다! VNEXSUS가 로컬 Windows 환경에서 실행 중입니다!**
