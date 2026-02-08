# VNEXSUS - 의료 문서 OCR 및 고지의무 분석 시스템

---

## 🪟 Windows 사용자 빠른 시작

**비전문 개발자를 위한 초간단 가이드** 👉 [WINDOWS_사용자_가이드.md](./WINDOWS_사용자_가이드.md)

### 🚀 가장 빠른 방법 (Docker 사용)

1. **Docker Desktop 설치**: https://www.docker.com/products/docker-desktop/
2. **`.env` 파일 설정**: `.env.secure`를 `.env`로 복사하고 API 키 입력
3. **`start-docker.bat` 더블클릭**
4. **브라우저에서 접속**: http://localhost:3030

### 💻 Node.js로 직접 실행 (권장 - 가장 간편)

**단 3단계로 시작!**

1. **Node.js 설치**: https://nodejs.org/ (LTS 버전 18.x 이상)
2. **`.env` 파일 설정**: `.env.secure`를 `.env`로 복사하고 API 키 입력
3. **`start.bat` 더블클릭** ✨
   - 자동으로 환경 설정 확인
   - 필요한 패키지 자동 설치
   - 5초 후 브라우저 자동 실행
   - 포트 충돌 시 자동 해결 옵션 제공

> **Tip**: 처음 실행 시 `start.bat`이 자동으로 초기 설정을 도와줍니다!

자세한 내용은 **[WINDOWS_사용자_가이드.md](./WINDOWS_사용자_가이드.md)** 파일을 참조하세요.

### 🌐 Linux/WSL에서 실행하고 Windows에서 접속하기

**Claude Code를 Linux에서 실행**하고 **Windows에서 브라우저로 접속**하려면:
👉 **[WINDOWS_접속_가이드.md](./WINDOWS_접속_가이드.md)** - WSL 및 원격 Linux 서버 접속 가이드

**3가지 시나리오 지원:**
- ✅ **WSL에서 실행**: 원클릭 스크립트로 즉시 시작
- ✅ **원격 Linux 서버**: SSH 터널링 자동화
- ✅ **Docker 환경**: 모든 환경에서 동일하게 동작

---

## 📋 프로젝트 개요

VNEXSUS는 보험 손해사정 업무를 위한 AI 기반 의료 문서 분석 시스템입니다. Google Cloud Vision OCR을 활용하여 피보험자의 의무기록을 추출하고, 고지의무 위반 여부를 분석합니다.

**현재 상태**: 개발 진행 중 (약 70-75% 완성)

### 🎯 핵심 기능

- **의료 문서 OCR**: Google Cloud Vision API 기반 텍스트 추출
- **날짜별 이벤트 파싱**: 의료 기록을 날짜 중심으로 구조화
- **고지의무 분석**: 보험가입일 기준 3개월/2년/5년 이내 진료기록 분류
- **타임라인 시각화**: Investigator View를 통한 에피소드 타임라인 표시
- **웹 인터페이스**: 파일 업로드 및 실시간 결과 조회

### 🚧 개발 중인 기능

- DNA 시퀀싱 시스템 (의료 이벤트 인과관계 분석)
- 자동 보고서 생성 엔진 고도화
- A-B-C 실행 계획 기반 시스템 개선

---

## 🏗️ 시스템 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   프론트엔드   │────→│   백엔드 서버   │────→│  Google Cloud │
│ (웹 인터페이스)│     │  (Node.js)   │     │  Vision API  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ↓
                    ┌──────────────┐
                    │  분석 엔진     │
                    │ - OCR 파싱    │
                    │ - 고지의무     │
                    │ - DNA 시퀀싱   │
                    └──────────────┘
```

---

## 📁 프로젝트 구조

```
VNEXSUS-25-12-30/
├── backend/                          # Node.js 백엔드
│   ├── app.js                       # 메인 애플리케이션
│   ├── routes/                      # API 라우트 (28개)
│   ├── services/                    # 비즈니스 로직 (28개)
│   ├── postprocess/                 # 후처리 엔진
│   │   ├── disclosureAnalysisEngine.cjs
│   │   ├── enhancedReportTemplateEngine.cjs
│   │   └── dateBlockProcessor.js
│   └── uploads/                     # 임시 파일 저장
│
├── frontend/                         # 웹 프론트엔드
│   ├── index.html                   # 메인 페이지
│   ├── hybrid-interface.html        # 파일 업로드 인터페이스
│   ├── investigator-view.html       # 에피소드 타임라인 뷰
│   ├── dev-case-manager.html        # 개발용 케이스 관리자
│   └── ... (20개 HTML 페이지)
│
├── src/                              # 추가 소스 코드
│   ├── routes/
│   └── services/
│
├── test/                             # 테스트 파일
│   └── data/                        # 테스트 데이터
│
├── .trae/                            # 개발 문서
│   ├── documents/                   # 기술 문서
│   └── rules/
│
├── VNEXSUS_A-B-C_Execution_Plan/    # A-B-C 실행 계획
├── VNEXSUS_dev_plan_tasks/          # 개발 태스크
│
├── .env                              # 환경변수
├── .env.example                      # 환경변수 템플릿
├── windows-setup.bat                 # Windows 설정 스크립트
├── start-server.bat                  # 서버 시작 스크립트
└── PROJECT_STATUS.md                 # 📌 프로젝트 현황 문서
```

---

## 🚀 빠른 시작 가이드

### 1. 필수 요구사항

- **Node.js**: 18.0 이상
- **Google Cloud Vision API 키** 또는 서비스 계정 JSON
- **OpenAI API 키** (선택사항)

### 2. 설치 (Windows)

```powershell
# 1. 저장소 클론
git clone https://github.com/nofnotg/VNEXSUS-25-12-30.git
cd VNEXSUS-25-12-30

# 2. 작업 브랜치 체크아웃
git checkout claude/medical-ocr-event-pipeline-dnReg

# 3. 자동 환경 설정 (관리자 권한 필요)
windows-setup.bat
```

**자동 설정 내용**:
- Node.js 버전 확인
- .env 파일 생성
- 필수 폴더 생성
- npm 패키지 설치
- 방화벽 규칙 추가

### 3. 환경 변수 설정

`.env` 파일을 열어 다음 항목을 설정:

```bash
# Google Cloud Vision OCR (필수)
GOOGLE_CLOUD_VISION_API_KEY=your-api-key
# 또는
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json

GCS_BUCKET_NAME=medreport-vision-ocr-bucket
GCP_PROJECT_ID=medreport-vision-ocr

# OpenAI API (선택)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# 서버 설정
PORT=3030
NODE_ENV=development
```

### 4. 서버 실행

```bash
# 방법 1: 배치 파일 사용 (권장)
start-server.bat

# 방법 2: 직접 실행
cd backend
npm start
```

### 5. 브라우저 접속

- **메인 애플리케이션**: http://localhost:3030
- **파일 업로드**: http://localhost:3030/hybrid-interface.html
- **Dev Case Manager**: http://localhost:3030/dev-case-manager (또는 http://localhost:8088)

---

## 🔧 주요 API 엔드포인트

### OCR 처리
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/ocr/upload` | POST | 파일 업로드 및 OCR 처리 시작 |
| `/api/ocr/status/:jobId` | GET | 작업 진행 상태 확인 |
| `/api/ocr/result/:jobId` | GET | OCR 결과 조회 |

### Investigator View
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/ocr/investigator-view/:jobId` | GET | 타임라인 데이터 조회 |
| `/api/ocr/investigator-view/:jobId` | POST | 편집된 데이터 저장 |

### 분석 엔진
| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/core-engine/*` | POST | 고지의무 분석 |
| `/api/enhanced-core/*` | POST | 향상된 분석 |
| `/api/dna-report/*` | POST | DNA 시퀀싱 보고서 |

---

## 📊 고지의무 분석 알고리즘

### 기간별 분류 기준

| 기간 | 대상 키워드 | 분석 목적 |
|------|-------------|-----------|
| **3개월 이내** | 의심, 진단, 확정, 새로운, 질병, 입원, 필요, 소견, 수술 | 최근 진단 및 검사 이력 |
| **2년 이내** | 입원, 수술, 상해, 질병, 치료, 시술, 처치 | 중요 치료 이력 |
| **5년 이내** | 암, 협심증, 급성심근경색, 간경화, 뇌경색, 뇌출혈, 중대질병 | 중대질병 이력 |

### 위험도 평가

- **High**: 중대질병(암, 심혈관질환 등) 진단 이력
- **Medium**: 만성질환 또는 수술 이력
- **Low**: 경미한 질환 또는 가입 후 발생

---

## 🧪 테스트

### 테스트 실행

```bash
# 환경변수 검증
npm run check:env

# Vision OCR 테스트
npm run test:vision

# 스트림 테스트
npm run test:stream
```

---

## 🛠️ 기술 스택

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express 5.1.0
- **OCR**: Google Cloud Vision API 5.3.2
- **AI**: OpenAI GPT-4o-mini

### Frontend
- **UI**: 순수 HTML/CSS/JavaScript (프레임워크 없음)
- **스타일**: Inline CSS + External Stylesheets

### 데이터 저장
- **파일 기반**: JSON 파일로 결과 저장
- **캐싱**: node-cache (메모리 캐시)

---

## 📖 주요 문서

| 문서 | 설명 |
|------|------|
| **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** | 📌 프로젝트 현황 및 완성도 |
| [SESSION_CONTEXT_2026-01-24.md](./SESSION_CONTEXT_2026-01-24.md) | 개발 세션 컨텍스트 |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | API 상세 문서 |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 배포 가이드 |
| [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) | 빠른 시작 가이드 |

---

## 🔒 보안 고려사항

### API 키 관리
- ❌ 절대 하드코딩 금지
- ✅ 환경변수 사용
- ✅ .env 파일은 .gitignore에 포함

### 파일 업로드 보안
- ✅ 파일 크기 제한: 200MB
- ✅ 파일 타입 검증: PDF, PNG, JPG만 허용
- ✅ 파일명 새니타이징

---

## 🐛 문제 해결 (Troubleshooting)

### 문제 1: 서버가 시작되지 않음
```
❌ 필수 환경변수가 누락되었습니다: GCS_BUCKET_NAME

해결: .env 파일에 GCS_BUCKET_NAME 추가
```

### 문제 2: OCR 처리 실패
```
❌ Vision OCR API 인증 실패

해결:
1. GOOGLE_CLOUD_VISION_API_KEY 확인
2. 또는 GOOGLE_APPLICATION_CREDENTIALS 경로 확인
```

### 문제 3: 포트 충돌
```
❌ Error: listen EADDRINUSE :::3030

해결 (Windows):
netstat -ano | findstr :3030
taskkill /PID <PID> /F
```

---

## 📝 개발 로드맵

### ✅ 완료된 기능
- Google Cloud Vision OCR 통합
- 날짜별 이벤트 파싱
- 고지의무 분석 엔진 (기본)
- 웹 인터페이스 구축
- Investigator View (기본)

### 🚧 진행 중
- DNA 시퀀싱 시스템 고도화
- 보고서 생성 엔진 완성
- A-B-C 실행 계획 구현

### 📅 계획 중
- 데이터베이스 통합 (PostgreSQL)
- 인증/권한 시스템
- 성능 최적화
- 프로덕션 배포

---

## 📞 지원 및 문의

- **버그 리포트**: GitHub Issues
- **문서**: 프로젝트 루트의 마크다운 파일 참조

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**VNEXSUS** - 의료 문서 분석의 새로운 기준 🚀

> **참고**: 이 프로젝트는 현재 활발히 개발 중입니다. 프로덕션 환경에서 사용하기 전에 충분한 테스트를 수행하세요.
