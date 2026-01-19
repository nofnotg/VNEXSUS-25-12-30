# Vision LLM 파이프라인 사용 가이드

**작성일:** 2025-01-19
**버전:** 1.0.0

---

## 🎯 개요

이 가이드는 새로 구현된 Vision LLM 기반 의료 문서 분석 파이프라인의 사용법을 설명합니다.

### 주요 기능

1. **GPT-4o Vision OCR** - 이미지에서 직접 텍스트 추출
2. **Ensemble 날짜 추출** - 좌표 + 비좌표 병합으로 정확도 향상
3. **Medical Timeline 생성** - 추출된 날짜를 의료 이벤트로 변환
4. **HTML 보고서** - 시각화된 타임라인 보고서 자동 생성

### 기대 성능

| 지표 | 기존 (Google OCR) | 새로운 (GPT-4o Vision) |
|------|-------------------|----------------------|
| 정확도 | 78.6% | **90-95%** |
| 표 인식 | 70% | **95%** |
| 비용/케이스 | $0.024 | $0.033 |
| 처리 시간 | 8-12초 | 6-10초 |

---

## 🚀 빠른 시작

### 1. 환경 설정

#### 환경 변수 설정

`.env` 파일 생성:

```bash
# OpenAI API Key (필수)
OPENAI_API_KEY=sk-...

# 기본 OCR Provider 설정 (선택, 기본값: gpt-4o-vision)
DEFAULT_OCR_PROVIDER=gpt-4o-vision

# Ensemble 사용 여부 (선택, 기본값: true)
USE_ENSEMBLE=true
```

#### 의존성 설치

```bash
npm install
```

### 2. 단일 PDF 분석

```bash
# TypeScript 실행
npx ts-node scripts/test-vision-llm-pipeline.ts

# 또는 환경 변수로 경로 지정
TEST_CASES_DIR=/path/to/pdf/files npx ts-node scripts/test-vision-llm-pipeline.ts
```

### 3. 결과 확인

분석 결과는 `./outputs/vision-llm-test/` 디렉토리에 저장됩니다:

```
outputs/vision-llm-test/
├── Case1-2025-01-19T10-30-00-result.json    # JSON 결과
├── Case1-2025-01-19T10-30-00-timeline.html  # HTML 타임라인
├── Case2-2025-01-19T10-31-00-result.json
└── Case2-2025-01-19T10-31-00-timeline.html
```

---

## 📖 상세 사용법

### 프로그래매틱 사용

```typescript
import { getIntegratedMedicalAnalysisService } from './src/modules/medical-analysis/service/integratedMedicalAnalysisService';

const service = getIntegratedMedicalAnalysisService();

// 단일 PDF 분석
const result = await service.analyzePDF('/path/to/document.pdf', {
  ocrProvider: 'gpt-4o-vision',
  useEnsemble: true,
  generateHTML: true,
  outputDir: './outputs',
  patientName: '홍길동',
  insuranceCompany: 'KB손해보험',
});

// 결과 확인
if (result.success) {
  console.log(`추출된 날짜: ${result.metadata.dateCount}개`);
  console.log(`의료 이벤트: ${result.metadata.eventCount}개`);
  console.log(`비용: $${result.metadata.ocrCost}`);
  console.log(`HTML 보고서: ${result.outputFiles?.html}`);
}

// 배치 분석
const results = await service.analyzeBatch([
  '/path/to/doc1.pdf',
  '/path/to/doc2.pdf',
  '/path/to/doc3.pdf',
], {
  ocrProvider: 'gpt-4o-vision',
  outputDir: './outputs/batch',
});

// 통계 생성
const stats = service.generateStatistics(results);
console.log(`성공률: ${(stats.successCount / stats.totalFiles) * 100}%`);
console.log(`총 비용: $${stats.totalCost}`);
```

### 옵션 설명

#### `AnalysisOptions`

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `ocrProvider` | `'gpt-4o-vision' \| 'claude-vision' \| 'gemini-vision'` | `'gpt-4o-vision'` | 사용할 Vision LLM |
| `useEnsemble` | `boolean` | `true` | Ensemble 날짜 추출 사용 |
| `generateHTML` | `boolean` | `true` | HTML 보고서 생성 |
| `outputDir` | `string` | `'./outputs'` | 출력 디렉토리 |
| `patientName` | `string` | `undefined` | 환자 이름 (선택) |
| `insuranceCompany` | `string` | `undefined` | 보험사 이름 (선택) |

---

## 🔧 고급 사용법

### Ensemble 전략 변경

```typescript
import { getEnsembleDateExtractor } from './src/modules/medical-analysis/extractors/EnsembleDateExtractor';

const extractor = getEnsembleDateExtractor();

const dates = await extractor.extractDates(textBlocks, {
  useCoordinateBased: true,
  useNonCoordinateBased: true,
  mergingStrategy: 'weighted', // 'union' | 'intersection' | 'weighted'
  confidenceThreshold: 0.8,
});
```

#### 병합 전략

| 전략 | 설명 | 사용 시기 |
|------|------|----------|
| `union` | 모든 날짜 포함 (중복 제거) | **권장** - 누락 최소화 |
| `intersection` | 양쪽에서 모두 발견된 날짜만 | 정확도 최우선 |
| `weighted` | 가중치 기반 병합 | 소스별 신뢰도 차이 있을 때 |

### OCR Provider 전환

```typescript
import { OCRProviderFactory } from './src/modules/medical-analysis/providers/ocr/OCRProviderFactory';

// Provider 초기화
await OCRProviderFactory.initialize();

// Provider 전환
OCRProviderFactory.setDefault('gpt-4o-vision'); // 또는 'claude-vision', 'gemini-vision'

// Provider 가져오기
const provider = OCRProviderFactory.getDefault();

// OCR 실행
const ocrResult = await provider.extractText({
  type: 'pdf',
  path: '/path/to/document.pdf',
});
```

### Timeline 커스터마이징

```typescript
import { getMedicalTimelineBuilder } from './src/modules/medical-analysis/builders/MedicalTimelineBuilder';

const builder = getMedicalTimelineBuilder();

// Timeline 생성
const timeline = await builder.buildTimeline(extractedDates, {
  patientInfo: {
    name: '홍길동',
    insuranceCompany: 'KB손해보험',
    policyNumber: '12345678',
  },
});

// HTML 생성
const html = builder.generateHTMLTimeline(timeline);

// 파일 저장
writeFileSync('./timeline.html', html);
```

---

## 📊 결과 해석

### JSON 결과 구조

```json
{
  "metadata": {
    "inputFile": "/path/to/Case1.pdf",
    "processingTime": 8532,
    "ocrProvider": "GPT-4o Vision",
    "ocrCost": 0.0331,
    "dateCount": 12,
    "eventCount": 10
  },
  "timeline": {
    "events": [
      {
        "date": "2024-05-01",
        "type": "insurance_start",
        "description": "보험 시작",
        "source": "llm",
        "confidence": 0.95,
        "context": "보 험 기 간 ① 2024.05.01 ~ 2054.11.10"
      }
    ],
    "summary": "📋 보험 기간: 2024-05-01 ~ 2054-11-10\n📊 주요 이벤트: 사고 1건, 입원 2건\n📅 총 12개의 날짜 추출됨",
    "isValid": true,
    "warnings": []
  },
  "outputFiles": {
    "html": "./outputs/Case1-2025-01-19-timeline.html",
    "json": "./outputs/Case1-2025-01-19-result.json"
  }
}
```

### HTML 보고서

HTML 보고서는 다음을 포함합니다:

- **요약 정보** - 보험 기간, 주요 이벤트 수
- **타임라인** - 날짜별 이벤트 시각화
- **경고 사항** - 날짜 순서 오류, 보험 기간 외 사고 등
- **신뢰도 정보** - 각 이벤트의 추출 신뢰도

---

## 🐛 문제 해결

### 1. API 키 오류

```
Error: OpenAI API key not found
```

**해결:**
```bash
# .env 파일에 API 키 추가
echo "OPENAI_API_KEY=sk-..." >> .env
```

### 2. PDF 변환 오류

```
Error: Cannot convert PDF to images
```

**해결:**
```bash
# Playwright 설치
npx playwright install chromium
```

### 3. 메모리 부족

```
Error: JavaScript heap out of memory
```

**해결:**
```bash
# Node.js 메모리 증가
NODE_OPTIONS="--max-old-space-size=4096" npx ts-node scripts/test-vision-llm-pipeline.ts
```

### 4. 비용이 예상보다 높음

**원인:** 고해상도 이미지 (2048×2048 이상)

**해결:**
```typescript
// GPT4oVisionProvider 수정
// detail: 'low'로 변경하여 비용 85% 절감 (정확도 약간 감소)
{
  type: 'image_url',
  image_url: {
    url: img,
    detail: 'low', // 'high' → 'low'
  }
}
```

---

## 📈 성능 최적화

### 1. 배치 처리 최적화

```typescript
// 동시 처리 수 제한
async function analyzeBatchOptimized(pdfPaths: string[], concurrency: number = 3) {
  const service = getIntegratedMedicalAnalysisService();
  const results = [];

  for (let i = 0; i < pdfPaths.length; i += concurrency) {
    const batch = pdfPaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((path) => service.analyzePDF(path))
    );
    results.push(...batchResults);
  }

  return results;
}
```

### 2. 캐싱

```typescript
// OCR 결과 캐싱 (Redis 예시)
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

// OCR 결과 캐시 키
const cacheKey = `ocr:${pdfPath}:${fileHash}`;

// 캐시 확인
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

// OCR 실행 및 캐싱
const result = await provider.extractText(input);
await redis.set(cacheKey, JSON.stringify(result), { EX: 3600 * 24 }); // 24시간
```

### 3. 비용 절감

| 방법 | 비용 절감 | 정확도 영향 |
|------|----------|-------------|
| `detail: 'low'` | 85% | -5%p |
| 이미지 압축 (1024×1024) | 40% | -2%p |
| Ensemble 비활성화 | 0% | -8%p (비권장) |
| 캐싱 (중복 문서) | 100% | 없음 |

---

## 🧪 테스트

### 단위 테스트

```bash
npm test
```

### 통합 테스트

```bash
# 5개 케이스 테스트
npx ts-node scripts/test-vision-llm-pipeline.ts

# 특정 디렉토리 테스트
TEST_CASES_DIR=/path/to/test/cases npx ts-node scripts/test-vision-llm-pipeline.ts
```

### 성능 벤치마크

```bash
# 28개 케이스 검증
npm run validate:28-cases -- --provider=gpt-4o-vision
```

---

## 📚 참고 자료

- [GPT-4o Vision API 문서](https://platform.openai.com/docs/guides/vision)
- [Ensemble 날짜 추출 분석](./COORDINATE-VS-NON-COORDINATE-ANALYSIS.md)
- [Vision LLM 스펙 비교](./VISION-LLM-SPECS-COMPARISON.md)
- [비용 및 가격 분석](./COST-AND-PRICING-ANALYSIS.md)

---

## 🔄 업데이트 로그

### v1.0.0 (2025-01-19)

- ✅ GPT-4o Vision Provider 구현
- ✅ Ensemble Date Extractor 구현
- ✅ Medical Timeline Builder 구현
- ✅ HTML 보고서 생성 기능
- ✅ 통합 파이프라인 서비스
- ✅ 테스트 스크립트

---

**문의:** 추가 기능 요청이나 버그 리포트는 GitHub Issues에 등록해주세요.
