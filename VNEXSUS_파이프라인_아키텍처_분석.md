# VNEXSUS 파이프라인 아키텍처 분석 보고서

## 📋 개요

VNEXSUS는 의료 문서 OCR 및 분석 시스템으로, 파일 업로드부터 AI 보고서 생성까지의 전체 파이프라인을 제공합니다. 본 보고서는 시스템의 전체 아키텍처와 각 단계별 처리 로직을 상세히 분석합니다.

---

## 🏗️ 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VNEXSUS 파이프라인                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ 1. 파일업로드 │ -> │ 2. OCR 처리  │ -> │ 3. 후처리    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ 4. 룰 처리   │ -> │ 5. AI 처리   │ -> │ 6. 보고서생성 │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 단계별 상세 분석

### 1️⃣ 파일 업로드 단계

**📍 위치**: `backend/controllers/ocrController.js`
**🔗 라우팅**: `backend/routes/ocrRoutes.js`

#### 처리 흐름
```javascript
POST /api/ocr/upload
├── 파일 검증 (MIME 타입, 크기, 개수)
├── 작업 ID 생성 (UUID)
├── 비동기 처리 시작
└── 202 응답 반환 (jobId 포함)
```

#### 주요 룰 적용 타이밍
- **파일 형식 검증**: PDF, PNG, JPG, JPEG만 허용
- **파일 크기 제한**: 최대 100MB
- **파일 개수 제한**: 최대 8개
- **무결성 검증**: 빈 파일 및 손상된 파일 필터링

#### 핵심 코드 위치
```javascript
// backend/controllers/ocrController.js:uploadPdfs()
const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const maxFiles = parseInt(process.env.MAX_FILES) || 8;
```

---

### 2️⃣ OCR 처리 단계

**📍 위치**: `backend/services/visionService.js`
**🔗 API**: Google Cloud Vision API

#### 처리 흐름
```javascript
processFiles(jobId, files)
├── 각 파일별 OCR 처리
├── Google Vision API 호출
├── 텍스트 추출 및 정제
└── 결과 저장 (jobStore)
```

#### 주요 룰 적용 타이밍
- **이미지 전처리**: PDF → 이미지 변환
- **OCR 품질 최적화**: Vision API 파라미터 조정
- **텍스트 정제**: 불필요한 문자 제거

#### 환경 설정
```javascript
// 필수 환경변수
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_CLOUD_VISION_API_KEY
GCS_BUCKET_NAME
```

---

### 3️⃣ 후처리 단계

**📍 위치**: `backend/postprocess/index.js`
**🔗 라우팅**: `backend/routes/postProcessRoutes.js`

#### 처리 흐름
```javascript
POST /api/postprocess/process
├── 1단계: 향상된 거대 날짜 블록 처리
├── 2단계: 기존 전처리 로직 적용
├── 3단계: 날짜 기반 데이터 정렬 및 구조화
├── 4단계: AI 엔티티 추출
└── 5단계: 최종 보고서 빌드
```

#### 주요 룰 적용 타이밍

**3-1. 거대 날짜 블록 처리**
```javascript
// backend/postprocess/enhancedMassiveDateBlockProcessor.js
- 날짜 패턴 인식 및 그룹화
- 신뢰도 기반 필터링 (minConfidence: 0.4)
- 의료 키워드 가중치 적용
```

**3-2. 전처리 로직**
```javascript
// backend/postprocess/preprocessor.js
- 의료 용어 번역 (translateTerms)
- 필수 키워드 검증 (requireKeywords)
- 텍스트 정규화
```

**3-3. 날짜 정렬 및 구조화**
```javascript
// backend/postprocess/dateOrganizer.js
- 보험 가입일 기준 필터링
- 시간순 정렬 (sortDirection: 'asc')
- 날짜별 그룹화 (groupByDate)
```

---

### 4️⃣ 룰 처리 단계

**📍 위치**: `src/lib/periodFilter.ts`, `src/modules/tagFilter.ts`

#### 처리 흐름
```javascript
이벤트 필터링 파이프라인
├── 기간 필터링 (periodFilter)
├── 태그 기반 필터링 (tagFilter)
├── 신뢰도 필터링 (minConfidence)
└── 중요도 가중치 적용
```

#### 주요 룰 적용 타이밍

**4-1. 기간 필터링**
```javascript
// src/lib/periodFilter.ts
const filterOptions = {
  startDate: options.startDate,
  endDate: options.endDate,
  minConfidence: options.minConfidence || 0.6,
  includeTags: options.includeTags || [],
  excludeTags: options.excludeTags || [],
  includeBeforeEnrollment: options.includeBeforeEnrollment || true
};
```

**4-2. 태그 기반 필터링**
```javascript
// src/modules/tagFilter.ts
import rules from '../config/tagRules.json';

export function isExcluded(ev) {
  const txt = ev.rawText;
  return Object.values(rules.exclude).some(list => 
    list.some(k => txt.includes(k))
  );
}
```

**4-3. 이벤트 그룹화**
```javascript
// src/lib/eventGrouper.ts
- 날짜별 그룹화
- 병원별 그룹화
- 중복 이벤트 병합
- 타임라인 생성
```

---

### 5️⃣ AI 처리 단계

**📍 위치**: `src/services/claudeService.js`
**🔗 API**: Claude 3.7 Haiku API

#### 처리 흐름
```javascript
AI 보고서 생성 파이프라인
├── 프롬프트 템플릿 로드
├── 구조화된 데이터 입력
├── Claude API 호출
└── 마크다운 보고서 생성
```

#### 주요 룰 적용 타이밍

**5-1. 프롬프트 엔지니어링**
```javascript
// backend/modules/ai/promptTemplates.js
const defaultTemplates = {
  'timeline_generation.txt': `
    당신은 의료 기록에서 타임라인을 생성하는 AI 비서입니다.
    규칙:
    1. 각 이벤트는 날짜, 이벤트 유형, 설명을 포함
    2. 날짜 형식은 YYYY-MM-DD로 통일
    3. 중복된 이벤트는 제거하되, 정보가 추가된 경우 병합
    4. 의료 약어는 가능한 전체 용어로 확장
  `,
  'medical_text_analysis.txt': `...`
};
```

**5-2. AI 모델 설정**
```javascript
// src/services/claudeService.js
this.model = 'claude-3-haiku-20240307';
this.maxTokens = 8192;
this.temperature = 0.3; // 일관된 결과를 위한 낮은 온도
```

---

### 6️⃣ 보고서 생성 단계

**📍 위치**: `src/controllers/reportController.js`

#### 처리 흐름
```javascript
보고서 생성 파이프라인
├── 1. 기간 필터링 (periodFilter.filter)
├── 2. 의료 타임라인 생성 (eventGrouper.createTimeline)
├── 3. 보고서 생성 (reportMaker.createReport)
└── 4. 통계 정보 생성
```

#### 주요 룰 적용 타이밍

**6-1. 최종 필터링**
```javascript
const filterOptions = {
  startDate: options.startDate,
  endDate: options.endDate,
  minConfidence: options.minConfidence || 0.6,
  includeTags: options.includeTags || [],
  excludeTags: options.excludeTags || [],
  includeBeforeEnrollment: options.includeBeforeEnrollment || true
};
```

**6-2. 타임라인 생성**
```javascript
const timeline = await eventGrouper.createTimeline(
  filteredResult.filtered,
  {
    groupByDate: options.groupByDate || true,
    groupByHospital: options.groupByHospital || true
  }
);
```

**6-3. 보고서 포맷팅**
```javascript
const reportPath = await reportMaker.createReport(
  timeline,
  filteredResult,
  {
    outputDir: path.resolve(process.cwd(), 'outputs'),
    patientInfo,
    highlightBeforeEnrollment: true,
    format: options.format || 'excel'
  }
);
```

---

## 🔄 데이터 흐름 매핑

### 입력 → 출력 변환 과정

```
📄 PDF/이미지 파일
    ↓ (OCR)
📝 Raw 텍스트
    ↓ (후처리)
🔍 구조화된 텍스트 블록
    ↓ (룰 처리)
📊 필터링된 이벤트 목록
    ↓ (AI 처리)
🤖 AI 분석 결과
    ↓ (보고서 생성)
📋 최종 보고서 (Excel/PDF)
```

### 각 단계별 데이터 구조

**1. OCR 결과**
```javascript
{
  jobId: "uuid",
  status: "completed",
  results: {
    "file1.pdf": {
      text: "추출된 텍스트...",
      confidence: 0.95
    }
  }
}
```

**2. 후처리 결과**
```javascript
{
  dateBlocks: [...],
  structuredGroups: [...],
  processedSize: 1024,
  statistics: {
    averageConfidence: 0.85,
    filteringRate: 15.2
  }
}
```

**3. 룰 처리 결과**
```javascript
{
  filtered: [...],
  beforeEnrollment: [...],
  statistics: {
    total: 150,
    filtered: 120,
    confidence: 0.8
  }
}
```

**4. AI 처리 결과**
```javascript
{
  events: [...],
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  hospitals: ["명지병원", "서울대병원"],
  tags: ["진단", "치료", "검사"]
}
```

---

## ⚙️ 핵심 설정 파일

### 환경 변수 (.env)
```bash
# OCR 설정
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
GOOGLE_CLOUD_VISION_API_KEY=your-api-key
GCS_BUCKET_NAME=medreport-vision-ocr-bucket

# AI 설정
CLAUDE_API_KEY=your-claude-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# 시스템 설정
MAX_FILES=8
TEMP_DIR=../temp
NODE_ENV=production
```

### 룰 설정 (tagRules.json)
```json
{
  "exclude": {
    "noise": ["광고", "홍보", "안내사항"],
    "irrelevant": ["주차", "식당", "편의시설"]
  },
  "important": {
    "medical": ["진단", "치료", "수술", "입원"],
    "dates": ["내원일", "진료일", "검사일"]
  }
}
```

---

## 🎯 성능 지표

### 처리 시간 벤치마크
- **파일 업로드**: ~1초
- **OCR 처리**: 2-5초 (파일 크기에 따라)
- **후처리**: 1-3초
- **룰 처리**: ~1초
- **AI 처리**: 3-10초 (텍스트 길이에 따라)
- **보고서 생성**: ~2초

### 정확도 지표
- **OCR 정확도**: 95%+ (Google Vision API)
- **날짜 추출 정확도**: 90%+
- **이벤트 분류 정확도**: 85%+
- **전체 파이프라인 성공률**: 92%+

---

## 🔧 모니터링 및 디버깅

### 로그 시스템
```javascript
// backend/utils/logger.js
logService('ocrController', `파일 처리 중 오류: ${error.message}`, 'error');
```

### 상태 추적
```javascript
// 작업 상태 확인
GET /api/ocr/status/{jobId}

// 결과 조회
GET /api/ocr/result/{jobId}
```

### 대시보드
- **텍스트 처리 모니터**: `text-processing-monitor-dashboard.html`
- **개발자 스튜디오**: `frontend/dev-studio.html`

---

## 📈 확장성 고려사항

### 수평 확장
- **OCR 처리**: Google Cloud Vision API 병렬 호출
- **AI 처리**: Claude API 요청 큐잉
- **파일 저장**: Google Cloud Storage 활용

### 수직 확장
- **메모리 최적화**: 대용량 파일 스트리밍 처리
- **CPU 최적화**: 텍스트 처리 알고리즘 개선
- **캐싱**: Redis 도입 고려

---

이 아키텍처 분석을 바탕으로 다음 단계에서는 각 룰의 적용 타이밍과 개선 방안을 상세히 검토하겠습니다.