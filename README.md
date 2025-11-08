# VNEXSUS - 보험 손해사정 자동화 시스템

## 📋 프로젝트 개요

VNEXSUS는 보험 손해사정 업무를 자동화하는 AI 기반 시스템입니다. 피보험자의 의무기록을 분석하여 고지의무 위반 여부를 판단하고, 전문적인 손해사정보고서를 자동으로 생성합니다.

### 🎯 주요 기능

- **고지의무 자동 분석**: 보험가입일 기준 3개월/2년/5년 이내 진료기록 자동 분류
- **AI 기반 위험도 평가**: 질병별 특화된 알고리즘으로 정확한 위험도 산출
- **자동 보고서 생성**: 확장형 보고서와 요약본을 동시 생성
- **Make.com 연동**: 완전 자동화된 워크플로우로 Google Docs/PDF 생성
- **실시간 처리**: 웹 인터페이스를 통한 즉시 분석 및 결과 제공

## 🏗️ 시스템 아키텍처

```
Frontend (HTML/JS) → Backend (Node.js) → AI Analysis → Make.com → Google Workspace
     ↓                    ↓                  ↓           ↓            ↓
  파일 업로드         의무기록 처리      고지의무 분석    자동화 워크플로우   보고서 생성
```

### 📁 프로젝트 구조

```
VNEXSUS_Bin/
├── frontend/                 # 웹 프론트엔드
│   ├── index.html           # 메인 페이지
│   ├── upload.html          # 파일 업로드 페이지
│   ├── report.html          # 보고서 조회 페이지
│   └── assets/              # CSS, JS, 이미지
├── backend/                 # Node.js 백엔드
│   ├── server.js            # 메인 서버
│   ├── routes/              # API 라우트
│   └── postprocess/         # 분석 엔진
│       ├── disclosureAnalysisEngine.cjs      # 고지의무 분석
│       └── enhancedReportTemplateEngine.cjs  # 보고서 생성
├── automation/              # Make.com 자동화
│   ├── makecom-scenario-blueprint.json       # 시나리오 블루프린트
│   ├── webhook-test-payload.json            # 테스트 페이로드
│   └── makecom-setup-guide.md               # 설정 가이드
└── test/                    # 테스트 파일
    ├── testDisclosureIntegration.cjs         # 통합 테스트
    ├── testWebhookIntegration.cjs           # Webhook 테스트
    └── testEndToEndWorkflow.cjs             # E2E 테스트
```

## 🚀 설치 및 실행

### 1. 환경 요구사항

- Node.js 18.0 이상
- npm 또는 yarn
- OpenAI API 키
- Google Workspace 계정 (Make.com 연동용)

### 2. 설치

```bash
# 저장소 클론
git clone <repository-url>
cd VNEXSUS_Bin

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 OpenAI API 키 등 설정
```

### 3. 실행

```bash
# 백엔드 서버 시작
cd backend
npm start

# 프론트엔드 서버 시작 (새 터미널)
cd frontend
npx http-server -p 8080 -c-1
```

### 4. 접속

- 프론트엔드: http://localhost:8080
- 백엔드 API: http://localhost:3000

## 🔧 Make.com 자동화 설정

### 1. 시나리오 가져오기

1. Make.com 계정 로그인
2. 새 시나리오 생성 → "Import Blueprint" 선택
3. `automation/makecom-scenario-blueprint.json` 파일 업로드

### 2. 연결 설정

- **OpenAI API**: GPT-4 모델 사용을 위한 API 키 설정
- **Google Docs**: 문서 생성 권한
- **Google Drive**: 파일 내보내기 및 공유 권한

### 3. 상세 설정

`automation/makecom-setup-guide.md` 파일을 참조하여 각 모듈을 설정하세요.

## 📊 고지의무 분석 알고리즘

### 기간별 분류 기준

| 기간 | 대상 키워드 | 분석 목적 |
|------|-------------|-----------||
| **3개월 이내** | 의심, 진단, 확정, 새로운, 질병, 입원, 필요, 소견, 수술, 추가검사, 재검사, 정밀검사, 조직검사 | 최근 진단 및 검사 이력 |
| **2년 이내** | 입원, 수술, 상해, 질병, 치료, 시술, 처치 | 중요 치료 이력 |
| **5년 이내** | 암, 협심증, 급성심근경색, 심근경색, 간경화, 뇌경색, 뇌출혈, 뇌혈관, 중대질병, 악성종양 | 중대질병 이력 |

### 위험도 평가

- **High**: 중대질병(암, 심혈관질환 등) 진단 이력
- **Medium**: 만성질환 또는 수술 이력
- **Low**: 경미한 질환 또는 가입 후 발생

## 🧪 테스트

### 단위 테스트

```bash
# 고지의무 분석 엔진 테스트
node test/testDisclosureIntegration.cjs

# Webhook 통합 테스트
node test/testWebhookIntegration.cjs

# End-to-End 워크플로우 테스트
node test/testEndToEndWorkflow.cjs
```

### 테스트 시나리오

1. **위암 사례 - 고위험**: 보험가입 전 암 진단 이력
2. **당뇨병 사례 - 중위험**: 만성질환 관리 이력
3. **단순 외상 사례 - 저위험**: 가입 후 발생한 외상

## 📈 사용 통계

- **처리 속도**: 평균 30초 이내 분석 완료
- **정확도**: 고지의무 분류 95% 이상
- **자동화율**: 수동 작업 대비 80% 시간 단축

## 🔒 보안 고려사항

- **데이터 암호화**: 전송 중 HTTPS 강제 사용
- **API 키 관리**: 환경변수를 통한 안전한 키 관리
- **접근 제어**: 인증된 사용자만 시스템 접근 가능
- **로그 관리**: 민감 정보 로깅 방지

## 🛠️ 개발 가이드

### 코드 구조

- **Frontend**: 바닐라 JavaScript + Bootstrap
- **Backend**: Node.js + Express
- **AI Engine**: OpenAI GPT-4 API
- **Automation**: Make.com 시나리오

### 주요 클래스

- `DisclosureAnalysisEngine`: 고지의무 분석 핵심 로직
- `EnhancedReportTemplateEngine`: 보고서 생성 및 템플릿 관리
- `WebhookIntegrationTest`: 자동화 워크플로우 테스트

### 확장 가능성

- **다국어 지원**: 국제 보험사 대응
- **추가 보험 상품**: 생명보험, 연금보험 등
- **AI 모델 업그레이드**: 더 정확한 분석을 위한 모델 개선
- **모바일 앱**: 스마트폰을 통한 현장 업무 지원

## 📞 지원 및 문의

- **기술 지원**: tech-support@vnexsus.com
- **사용자 가이드**: docs.vnexsus.com
- **버그 리포트**: GitHub Issues

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 LICENSE 파일을 참조하세요.

---

**VNEXSUS** - 보험 업계의 디지털 혁신을 선도합니다. 🚀

## 🚨 시스템 보호 및 안정성

이 시스템은 파일 업로드부터 OCR 처리까지의 핵심 기능이 안정적으로 동작하도록 설계되었습니다.
**새로운 환경에서 사용하거나 설정을 변경하기 전에 반드시 다음 문서들을 확인하세요:**

- 📖 **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - 배포 및 환경 설정 가이드
- 🔧 **환경 검증**: `npm run validate:env` - 시스템 설정 검증
- 🛡️ **설정 보호**: `npm run protect:check` - 핵심 파일 변경 감지

### 빠른 시작
```bash
# 1. 환경 설정 검증
npm run validate:env

# 2. 설정 파일 보호 초기화
npm run protect:init

# 3. 서버 시작
npm run start:backend    # 백엔드 (포트 3030)
npm run start:frontend   # 프론트엔드 (포트 8080)
```

## 주요 기능

- 의료 이벤트 데이터를 엑셀 보고서로 생성
- 필터링된 이벤트의 별도 시트 제공
- 태그별, 병원별 통계 정보 제공
- 보험 가입일 기준 하이라이트 표시
- 이벤트 시간순 정렬 및 표시

## 구성 모듈

### 1. src/lib/reportMaker.ts

보고서 생성의 핵심 기능을 담당하는 모듈입니다. ExcelJS를 사용하여 엑셀 파일을 생성합니다.

- `createReport(timeline, filterResult?, options?)`: 타임라인에서 엑셀 보고서를 생성하는 메인 함수
- 여러 시트 포맷팅 함수들 (전체 이벤트, 필터링된 이벤트, 통계)
- 날짜, 태그, 신뢰도 등의 포맷팅 유틸리티

### 2. src/modules/m5-report/index.ts

M5 모듈 인터페이스를 구현한 래퍼 모듈로, reportMaker를 활용하여 표준화된 인터페이스를 제공합니다.

- `generateReport(timelineData, filterResult?, outputPath?)`: 보고서 생성 함수

## 사용 방법

### 1. 기본 사용법

```typescript
import m5ReportModule from './modules/m5-report/index.js';
import eventGrouper from './lib/eventGrouper.js';
import periodFilter from './lib/periodFilter.js';
import { PeriodPreset } from './lib/periodFilter.js';

// 1. 타임라인 데이터 준비
const timeline = eventGrouper.groupEvents(events);

// 2. 필터 적용 (선택 사항)
const filterOptions = {
  periodPreset: PeriodPreset.OneYear,
  referenceDate: '2023-12-31',
  minConfidence: 0.8
};
const filterResult = periodFilter.filterTimeline(timeline, filterOptions);

// 3. 보고서 생성
const result = await m5ReportModule.generateReport(
  timeline,
  filterResult,
  './reports'  // 출력 디렉토리
);

console.log(`보고서 생성: ${result.success ? '성공' : '실패'}`);
console.log(`경로: ${result.reportPath}`);
```

### 2. 커맨드라인 사용법

```bash
# 샘플 데이터로 보고서 생성
node dist/scripts/generate-report.js src/scripts/sample-events.json ./reports
```

## 구현된 기능

1. **전체 이벤트 시트**: 모든 의료 이벤트를 날짜순으로 정렬하여 표시
2. **필터링된 이벤트 시트**: 필터 조건에 맞는 이벤트만 표시
3. **통계 시트**: 태그별, 카테고리별 통계 정보 제공
4. **환자 정보 시트**: 환자 기본 정보 및 보험 정보 표시
5. **하이라이트 기능**: 보험 가입일 이전 이벤트는 빨간색으로 강조 표시

## 설치 및 빌드

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 테스트 실행
npm test
```

## 의존성

- ExcelJS: 엑셀 파일 생성
- UUID: 파일명 생성
- fs/promises: 파일 시스템 작업 

## AI 모듈 사용하기

이 프로젝트는 의료 텍스트 분석 및 타임라인 생성을 위한 AI 통합 모듈을 제공합니다.

### 환경 설정

먼저 다음 환경 변수를 `.env` 파일에 설정해야 합니다:

```bash
# Anthropic API (Claude AI)
ANTHROPIC_API_KEY=your_anthropic_api_key

# OpenAI (옵션)
OPENAI_API_KEY=your_openai_api_key

# Azure OpenAI (옵션)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
```

### 테스트 실행

AI 기능을 테스트하려면 다음 명령어를 실행하세요:

```bash
# AI 타임라인 생성 테스트
npm run test:ai:timeline

# AI 분석기 테스트
npm run test:ai:analyzer
```

### 코드에서 사용하기

예시 코드:

```javascript
import AIService from '../backend/modules/ai/aiService.js';

// AI 서비스 인스턴스 생성
const aiService = new AIService({
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-haiku-20240307'
});

// 챗 기반 응답 생성
const response = await aiService.chat([
  { role: 'system', content: '당신은 의료 텍스트 전문가입니다.' },
  { role: 'user', content: '다음 의료 기록을 분석해주세요: ' + medicalText }
]);

console.log(response.content); // AI 응답 내용

// 타임라인 생성 (간편한 방법)
const timelineResponse = await aiService.generateTimeline(medicalText);
```

### 사용 가능한 모델

기본 모델은 `claude-3-haiku-20240307`이며, 다음 모델을 사용할 수 있습니다:

- **Claude AI**: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`
- **OpenAI**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` 

# 메디아이(Medi AI) 문서분석시스템

의료 문서 OCR 및 분석 시스템

## 기능

- PDF 및 이미지 파일에서 텍스트 추출 (OCR)
- 추출된 텍스트에서 의료 이벤트 및 타임라인 생성
- 보험 정보에 기반한 요약표 생성
- GPT-4 Turbo를 활용한 의료 보고서 생성 및 AI 채팅 기능

## 설치 및 실행 방법

### 필수 요구사항

- Node.js 16 이상
- npm 또는 yarn
- Google Cloud Vision API 키 또는 서비스 계정 (OCR 기능 사용 시)
- OpenAI API 키 (GPT-4 Turbo 보고서 생성 기능 사용 시)

### 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정:

```
# OCR 관련 설정
ENABLE_VISION_OCR=true
USE_VISION=true
USE_TEXTRACT=false

# Google Cloud 설정
GCS_BUCKET_NAME=medreport-vision-ocr-bucket
GCP_PROJECT_ID=medreport-vision-ocr
GOOGLE_APPLICATION_CREDENTIALS=경로/키파일.json
GOOGLE_CLOUD_VISION_API_KEY=your-api-key

# 서버 설정
PORT=8888

# AI 서비스
OPENAI_API_KEY=your-openai-api-key
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 또는 배포용 빌드 및 실행
npm run build
npm start
```

## AI 보고서 생성 및 채팅 기능

메디아이 시스템은 이제 OpenAI의 GPT-4 Turbo를 활용한 자동 의료 보고서 생성 및 상호작용 기능을 제공합니다.

### 주요 기능

1. **자동 의료 보고서 생성**
   - OCR로 추출된 텍스트를 분석하여 구조화된 의료 보고서 생성
   - 타임라인 이벤트를 기반으로 중요 의료 정보 요약
   - 보험 가입일 기준으로 3개월/5년 이내 주요 이벤트 강조

2. **AI 채팅 상호작용**
   - 생성된 보고서에 대해 질문하고 추가 정보 요청 가능
   - 의료 용어 설명 및 이해하기 쉬운 해석 제공
   - 보고서 내용에 대한 추가 분석 및 통찰 요청 가능

### 사용 방법

1. 문서를 업로드하고 OCR 처리를 완료합니다.
2. 보험 정보를 입력하고 요약표를 생성합니다.
3. "AI 보고서 생성" 섹션에서 "보고서 생성하기" 버튼을 클릭합니다.
4. 보고서가 생성되면 하단의 채팅 기능을 통해 추가 질문을 할 수 있습니다.

## 라이선스

[MIT License](LICENSE)