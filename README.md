# MediAI MVP - Medical Report Analysis System

의료 문서 OCR 분석 및 AI 기반 보고서 생성 시스템입니다.

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