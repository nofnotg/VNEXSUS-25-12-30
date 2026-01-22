# 🚀 VNEXSUS 로컬 환경 설정 가이드

이 가이드는 VNEXSUS 프로젝트를 로컬 컴퓨터에 클로닝하고 실행하는 방법을 설명합니다.

## 📋 사전 요구사항

설치가 필요한 소프트웨어:
- **Node.js** v18 이상 (LTS 권장)
- **npm** v8 이상 (Node.js와 함께 설치됨)
- **Git** (코드 클로닝용)

### Node.js 설치 확인
```bash
node -v  # v18.0.0 이상이어야 함
npm -v   # v8.0.0 이상이어야 함
```

## 🔽 1단계: 저장소 클로닝

```bash
# GitHub에서 클로닝 (실제 GitHub URL로 변경 필요)
git clone https://github.com/nofnotg/VNEXSUS-25-12-30.git

# 프로젝트 디렉토리로 이동
cd VNEXSUS-25-12-30
```

## 📦 2단계: 의존성 설치

```bash
# 백엔드 의존성 설치
cd backend
npm install

# 루트 디렉토리로 돌아가기
cd ..
```

## ⚙️ 3단계: 환경 변수 설정

```bash
# .env.example 파일을 .env로 복사
cp .env.example .env

# .env 파일을 편집기로 열기
# Windows: notepad .env
# Mac/Linux: nano .env 또는 code .env (VS Code)
```

### 필수 환경 변수 설정

`.env` 파일에서 다음 값들을 **반드시** 설정해야 합니다:

```bash
# OpenAI API Key (필수)
OPENAI_API_KEY=your-actual-openai-api-key

# Google Cloud Vision API Key (OCR 기능 사용시)
GOOGLE_CLOUD_VISION_API_KEY=your-google-vision-api-key
GCP_PROJECT_ID=your-project-id

# Google Gemini API Key (선택사항)
GOOGLE_API_KEY=your-google-api-key

# Anthropic Claude API Key (선택사항)
ANTHROPIC_API_KEY=your-anthropic-api-key

# PDF 보고서 저장 경로 (실제 경로로 변경)
REPORTS_PDF_ROOT=/Users/yourname/VNEXSUS_reports_pdf  # Mac
# 또는
REPORTS_PDF_ROOT=C:\Users\yourname\VNEXSUS_reports_pdf  # Windows
```

### API 키 발급 방법

1. **OpenAI API Key**: https://platform.openai.com/api-keys
2. **Google Cloud Vision**: https://console.cloud.google.com/apis/credentials
3. **Google Gemini**: https://makersuite.google.com/app/apikey
4. **Anthropic Claude**: https://console.anthropic.com/settings/keys

## 🚀 4단계: 서버 실행

```bash
# backend 디렉토리로 이동
cd backend

# 서버 시작
npm start
```

성공적으로 실행되면 다음과 같은 메시지가 표시됩니다:

```
======================================
OCR 서버가 포트 3030에서 실행 중입니다.
http://localhost:3030
외부 접속 가능 (0.0.0.0:3030)
✅ 서버 시작 완료

Dev Case Manager 서버가 포트 8088에서 실행 중입니다.
http://localhost:8088
외부 접속 가능 (0.0.0.0:8088)
```

## 🌐 5단계: 브라우저에서 접속

서버가 실행 중인 상태에서 브라우저를 열고:

### Developer Studio (프롬프트 모니터링 대시보드)
```
http://localhost:3030/dev-studio.html
```

**주요 기능:**
- ✅ 파이프라인 워크플로우 모니터링
- ✅ **프롬프트 실시간 확인 및 조정**
- ✅ 데이터 전처리 설정
- ✅ AI 분석 파라미터 조정
- ✅ 성능 메트릭 대시보드

### Dev Case Manager (케이스 관리)
```
http://localhost:8088
```

**주요 기능:**
- 케이스 파일 업로드
- 케이스 번호 관리
- 사용자 보고서 작성

## 🔧 개발 모드 실행

파일 변경 시 자동으로 재시작되도록 개발 모드로 실행:

```bash
cd backend
npm run dev  # nodemon 사용
```

## 🧪 테스트 실행

```bash
cd backend

# 전체 테스트 실행
npm test

# 특정 테스트만 실행
npm run test:stream  # 스트림 처리 테스트
npm run test:vision  # Vision OCR 테스트

# 테스트 커버리지 확인
npm run test:coverage
```

## 📂 주요 디렉토리 구조

```
VNEXSUS-25-12-30/
├── backend/               # 백엔드 서버
│   ├── app.js            # 메인 서버 파일
│   ├── controllers/      # API 컨트롤러
│   ├── routes/           # API 라우트
│   ├── services/         # 비즈니스 로직
│   └── package.json      # 의존성 설정
├── frontend/             # 프론트엔드 파일
│   ├── dev-studio.html   # 개발자 스튜디오
│   └── dev-case-manager.html  # 케이스 매니저
├── .env                  # 환경 변수 (생성 필요)
└── .env.example          # 환경 변수 예제
```

## ❗ 문제 해결 (Troubleshooting)

### 포트 충돌 오류
```
Error: listen EADDRINUSE: address already in use :::3030
```

**해결방법:**
```bash
# Windows
netstat -ano | findstr :3030
taskkill /PID [프로세스ID] /F

# Mac/Linux
lsof -i :3030
kill -9 [프로세스ID]
```

### Node 버전 오류
```bash
# Node.js 버전 업그레이드
# nvm 사용 (권장)
nvm install 18
nvm use 18

# 또는 공식 웹사이트에서 다운로드
# https://nodejs.org/
```

### npm install 오류

```bash
# npm 캐시 삭제
npm cache clean --force

# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json  # Mac/Linux
# 또는
rmdir /s node_modules && del package-lock.json  # Windows

npm install
```

### API 키 오류
```
✅ Vision API 키가 설정되어 있습니다.
```

이 메시지가 보이지 않으면 `.env` 파일의 API 키를 확인하세요.

## 🔐 보안 주의사항

1. ⚠️ `.env` 파일은 **절대 Git에 커밋하지 마세요!**
2. ⚠️ API 키는 외부에 노출되지 않도록 주의하세요.
3. ⚠️ 프로덕션 환경에서는 환경 변수를 서버 설정에서 관리하세요.

## 📖 추가 리소스

- **API 문서**: `/api/dev/studio/prompts` 엔드포인트 참고
- **프롬프트 설정**: Developer Studio에서 실시간 조정 가능
- **로그 확인**: `backend/` 디렉토리에서 로그 파일 확인

## 🆘 도움이 필요하신가요?

문제가 발생하면:
1. 서버 로그 확인
2. `.env` 파일 설정 재확인
3. Node.js 버전 확인
4. GitHub Issues에 문의

---

**✅ 설정 완료!** 이제 `http://localhost:3030/dev-studio.html`에 접속하여 프롬프트 모니터링 대시보드를 사용하실 수 있습니다.
