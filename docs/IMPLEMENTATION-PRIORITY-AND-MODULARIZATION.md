# 구현 우선순위 및 모듈화 전략

**작성일:** 2025-01-19
**목적:** 안정적인 의료 이벤트 진행 보고서 생성 후 Vision LLM 전환 준비
**핵심 전략:** Phase 1 안정화 → Phase 2 모듈화 → Phase 3 Vision LLM 전환

---

## 🎯 핵심 원칙

### 1단계: 안정화 (Stabilization) ⭐ 최우선
```
현재 시스템 (OCR + LLM 보완)을 안정화하여
의료 이벤트 진행 보고서를 정확하게 생성
```

**목표:**
- 날짜 추출 정확도 85%+ 달성
- 의료 이벤트 timeline 정확도 90%+
- 에러율 <1%
- 응답 시간 <10초

### 2단계: 모듈화 (Modularization)
```
OCR 엔진을 추상화하여
Vision OCR ↔ Vision LLM 전환이 쉽도록 설계
```

**원칙:**
- Interface 기반 설계
- Provider 패턴
- 전략 패턴 (Strategy Pattern)
- 의존성 주입 (Dependency Injection)

### 3단계: Vision LLM 전환 (Migration)
```
안정화된 시스템 위에
Vision LLM을 점진적으로 도입
```

**전략:**
- A/B 테스팅
- 카나리 배포 (Canary Deployment)
- 하이브리드 실행 (OCR + Vision LLM 병행)

---

## 📅 Phase 1: 안정화 (1-2주)

### Week 1: 현재 시스템 검증 및 개선

#### Day 1-2: 23개 중복 케이스 Ensemble 테스트
```bash
# 목표: 좌표 + 비좌표 Ensemble로 85%+ 달성

cd /home/user/VNEXSUS-25-12-30
npm run test:ensemble-23-cases

# 예상 결과:
# - 좌표만: 78.6%
# - 비좌표만: 72-75%
# - Ensemble: 85-90%
```

**산출물:**
- `outputs/ensemble-23-cases-results.json`
- `docs/reports/ensemble-validation-report.html`

#### Day 3-4: 의료 이벤트 Timeline 생성 검증
```typescript
// 목표: 날짜 추출 → 이벤트 타임라인 변환

interface MedicalEvent {
  date: string; // YYYY-MM-DD
  type: 'contract' | 'accident' | 'hospital_visit' | 'diagnosis' | 'surgery' | 'claim';
  description: string;
  source: 'ocr' | 'llm';
  confidence: number;
}

interface MedicalTimeline {
  patientInfo: {
    name?: string;
    insuranceCompany?: string;
    policyNumber?: string;
  };
  events: MedicalEvent[];
  insurancePeriod?: {
    start: string;
    end: string;
  };
  summary: string;
}

// 테스트: 28개 케이스로 timeline 생성
for (const case of validationCases) {
  const dates = await extractDatesEnhanced(case.ocr);
  const timeline = await buildMedicalTimeline(dates, case.ocr);
  const accuracy = validateTimeline(timeline, case.groundTruth);

  console.log(`${case.name}: ${accuracy}%`);
}
```

**검증 항목:**
- [ ] 날짜가 올바른 이벤트 타입으로 분류되는가?
- [ ] 시간 순서가 논리적인가? (계약일 < 사고일 < 내원일)
- [ ] 보험 기간 내 사고 발생 여부 검증 가능한가?
- [ ] 진단일 vs 수술일 vs 퇴원일 순서가 맞는가?

#### Day 5-7: 에러 처리 및 모니터링
```typescript
// 에러 처리 강화
class DateExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
  }
}

// 재시도 로직
async function extractDatesWithRetry(
  blocks: TextBlock[],
  maxRetries = 3
): Promise<ExtractedDate[]> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await extractDates(blocks);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

// 모니터링 지표
interface MetricsCollector {
  recordAPICall(provider: string, duration: number, success: boolean): void;
  recordAccuracy(caseId: string, accuracy: number): void;
  recordCost(provider: string, cost: number): void;
  getMetrics(): DailyMetrics;
}
```

**산출물:**
- Error handling 강화 코드
- Monitoring dashboard 구축
- Alert 시스템 설정

### Week 2: 프로덕션 배포 준비

#### Day 8-10: 전체 28케이스 재검증
```bash
# Ensemble 방식으로 전체 검증
npm run validate:28-cases -- --method=ensemble --output=production-validation.json

# Success Criteria:
# - 평균 정확도 85%+
# - Named 케이스: 100%
# - Case 케이스: 82%+
# - 에러율 <1%
```

#### Day 11-12: 성능 최적화
```typescript
// 병렬 처리
async function processCasesBatch(cases: Case[]): Promise<Result[]> {
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < cases.length; i += batchSize) {
    const batch = cases.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(c => processCase(c))
    );
    results.push(...batchResults);
  }

  return results;
}

// 캐싱
import { createClient } from 'redis';

class DateExtractionCache {
  private redis: ReturnType<typeof createClient>;

  async get(cacheKey: string): Promise<ExtractedDate[] | null> {
    const cached = await this.redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  async set(cacheKey: string, dates: ExtractedDate[]): Promise<void> {
    await this.redis.set(cacheKey, JSON.stringify(dates), {
      EX: 3600 * 24 // 24시간
    });
  }
}
```

#### Day 13-14: 문서화 및 배포
```bash
# API 문서 생성
npm run docs:generate

# 프로덕션 배포
npm run deploy:production

# 스모크 테스트
npm run test:smoke
```

**Phase 1 완료 기준:**
- ✅ 날짜 추출 정확도 85%+ (28케이스 평균)
- ✅ 의료 이벤트 timeline 정확도 90%+
- ✅ API 응답 시간 <10초
- ✅ 에러율 <1%
- ✅ 모니터링 대시보드 구축
- ✅ 프로덕션 배포 완료

---

## 🏗️ Phase 2: 모듈화 (1-2주)

### 목표: OCR 엔진 추상화

#### 아키텍처 설계

```typescript
// ============================================
// 1. OCR Provider Interface (추상화)
// ============================================

interface OCRBlock {
  text: string;
  bbox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

interface OCRResult {
  blocks: OCRBlock[];
  metadata: {
    provider: string;
    processingTime: number;
    pageCount: number;
    totalCost?: number;
  };
}

/**
 * OCR Provider 인터페이스
 * 모든 OCR 엔진은 이 인터페이스를 구현
 */
interface IOCRProvider {
  // Provider 정보
  readonly name: string;
  readonly version: string;
  readonly capabilities: {
    supportsVision: boolean;
    supportsMultipage: boolean;
    maxPageSize: number;
  };

  // OCR 실행
  extractText(input: OCRInput): Promise<OCRResult>;

  // 비용 계산
  estimateCost(input: OCRInput): number;

  // Health check
  healthCheck(): Promise<boolean>;
}

type OCRInput =
  | { type: 'pdf'; path: string }
  | { type: 'image'; path: string }
  | { type: 'images'; paths: string[] }
  | { type: 'base64'; data: string; mimeType: string };

// ============================================
// 2. 구체적인 Provider 구현
// ============================================

class GoogleVisionOCRProvider implements IOCRProvider {
  name = 'Google Vision OCR';
  version = '1.0.0';
  capabilities = {
    supportsVision: false,
    supportsMultipage: true,
    maxPageSize: 20 * 1024 * 1024 // 20MB
  };

  constructor(private apiKey: string) {}

  async extractText(input: OCRInput): Promise<OCRResult> {
    // Google Vision API 호출
    const startTime = Date.now();

    // PDF를 이미지로 변환
    const images = await this.convertToImages(input);

    // Google Vision API 호출
    const blocks: OCRBlock[] = [];
    for (const [index, image] of images.entries()) {
      const response = await this.callGoogleVisionAPI(image);
      blocks.push(...this.parseResponse(response, index));
    }

    return {
      blocks,
      metadata: {
        provider: this.name,
        processingTime: Date.now() - startTime,
        pageCount: images.length,
        totalCost: this.estimateCost(input)
      }
    };
  }

  estimateCost(input: OCRInput): number {
    // $1.50 / 1000 pages
    const pageCount = this.getPageCount(input);
    return pageCount * 0.0015;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 간단한 API 호출로 확인
      await this.callGoogleVisionAPI(testImage);
      return true;
    } catch {
      return false;
    }
  }

  private async convertToImages(input: OCRInput): Promise<Buffer[]> {
    // PDF → Images
  }

  private async callGoogleVisionAPI(image: Buffer): Promise<any> {
    // Google Vision API 호출
  }

  private parseResponse(response: any, pageIndex: number): OCRBlock[] {
    // 응답 파싱
  }

  private getPageCount(input: OCRInput): number {
    // 페이지 수 계산
  }
}

class GPT4oVisionProvider implements IOCRProvider {
  name = 'GPT-4o Vision';
  version = '1.0.0';
  capabilities = {
    supportsVision: true,
    supportsMultipage: true,
    maxPageSize: 20 * 1024 * 1024
  };

  constructor(private apiKey: string) {}

  async extractText(input: OCRInput): Promise<OCRResult> {
    const startTime = Date.now();

    // PDF를 이미지로 변환
    const images = await this.convertToImages(input);

    // GPT-4o Vision은 텍스트만 반환 (좌표 없음)
    const blocks: OCRBlock[] = [];

    // 모든 이미지를 한 번에 전송 (최대 50개)
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildPrompt()
            },
            ...images.map(img => ({
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${img.toString('base64')}`,
                detail: 'high'
              }
            }))
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    // 응답 파싱
    const parsed = JSON.parse(response.choices[0].message.content);

    // OCRBlock 형식으로 변환 (좌표 없음)
    for (const [index, pageText] of parsed.pages.entries()) {
      blocks.push({
        text: pageText,
        bbox: undefined, // Vision LLM은 좌표 없음
        confidence: 0.95
      });
    }

    return {
      blocks,
      metadata: {
        provider: this.name,
        processingTime: Date.now() - startTime,
        pageCount: images.length,
        totalCost: this.estimateCost(input)
      }
    };
  }

  estimateCost(input: OCRInput): number {
    const pageCount = this.getPageCount(input);
    const tokensPerPage = 765; // 1024×1024 image
    const inputTokens = pageCount * tokensPerPage + 500; // + prompt
    const outputTokens = 300;

    return (
      inputTokens * 0.0000025 + // $2.50 / 1M input
      outputTokens * 0.00001    // $10.00 / 1M output
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildPrompt(): string {
    return `의료보험 손해사정 보고서입니다.
    각 페이지의 모든 텍스트를 추출하고,
    페이지별로 구분하여 JSON으로 출력하세요.

    출력 형식:
    {
      "pages": ["페이지1 전체 텍스트", "페이지2 전체 텍스트", ...]
    }`;
  }

  private async convertToImages(input: OCRInput): Promise<Buffer[]> {
    // PDF → Images
  }

  private getPageCount(input: OCRInput): number {
    // 페이지 수 계산
  }
}

class ClaudeVisionProvider implements IOCRProvider {
  name = 'Claude 3.5 Sonnet Vision';
  version = '1.0.0';
  capabilities = {
    supportsVision: true,
    supportsMultipage: true,
    maxPageSize: 10 * 1024 * 1024 // 10MB
  };

  // 구현은 GPT4oVisionProvider와 유사
  // ...
}

// ============================================
// 3. Provider Factory
// ============================================

type ProviderType = 'google-vision' | 'gpt-4o-vision' | 'claude-vision' | 'gemini-vision';

class OCRProviderFactory {
  private static providers: Map<ProviderType, IOCRProvider> = new Map();

  static register(type: ProviderType, provider: IOCRProvider): void {
    this.providers.set(type, provider);
  }

  static create(type: ProviderType): IOCRProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider not registered: ${type}`);
    }
    return provider;
  }

  static getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
}

// 초기화
OCRProviderFactory.register('google-vision', new GoogleVisionOCRProvider(process.env.GOOGLE_API_KEY!));
OCRProviderFactory.register('gpt-4o-vision', new GPT4oVisionProvider(process.env.OPENAI_API_KEY!));
OCRProviderFactory.register('claude-vision', new ClaudeVisionProvider(process.env.ANTHROPIC_API_KEY!));

// ============================================
// 4. Date Extractor 리팩토링
// ============================================

class UnifiedDateExtractor {
  constructor(
    private ocrProvider: IOCRProvider,
    private llmProvider?: ILLMProvider
  ) {}

  async extract(input: OCRInput): Promise<ExtractedDate[]> {
    // 1. OCR 실행
    const ocrResult = await this.ocrProvider.extractText(input);

    // 2. Vision LLM인 경우 바로 날짜 추출
    if (this.ocrProvider.capabilities.supportsVision) {
      return this.extractDatesFromVisionLLM(ocrResult);
    }

    // 3. 전통적 OCR인 경우 Regex + LLM 보완
    const regexDates = this.extractDatesWithRegex(ocrResult.blocks);
    const llmDates = await this.extractDatesWithLLM(ocrResult.blocks, regexDates);

    return this.mergeDates(regexDates, llmDates);
  }

  private extractDatesFromVisionLLM(ocrResult: OCRResult): ExtractedDate[] {
    // Vision LLM은 이미 날짜를 추출했음
    // ocrResult.blocks에서 날짜 파싱
  }

  private extractDatesWithRegex(blocks: OCRBlock[]): ExtractedDate[] {
    // 기존 Regex 로직
  }

  private async extractDatesWithLLM(
    blocks: OCRBlock[],
    existingDates: ExtractedDate[]
  ): Promise<ExtractedDate[]> {
    // 기존 LLM 보완 로직
  }

  private mergeDates(
    regexDates: ExtractedDate[],
    llmDates: ExtractedDate[]
  ): ExtractedDate[] {
    // Ensemble 로직
  }
}

// ============================================
// 5. 사용 예시
// ============================================

// Case 1: Google Vision OCR + LLM 보완 (현재 방식)
const googleProvider = OCRProviderFactory.create('google-vision');
const extractor1 = new UnifiedDateExtractor(googleProvider);

const dates1 = await extractor1.extract({
  type: 'pdf',
  path: '/path/to/case1.pdf'
});

// Case 2: GPT-4o Vision (직접 날짜 추출)
const gptProvider = OCRProviderFactory.create('gpt-4o-vision');
const extractor2 = new UnifiedDateExtractor(gptProvider);

const dates2 = await extractor2.extract({
  type: 'pdf',
  path: '/path/to/case1.pdf'
});

// Case 3: A/B 테스트
const providers: ProviderType[] = ['google-vision', 'gpt-4o-vision', 'claude-vision'];

for (const providerType of providers) {
  const provider = OCRProviderFactory.create(providerType);
  const extractor = new UnifiedDateExtractor(provider);

  const dates = await extractor.extract(input);
  const accuracy = calculateAccuracy(dates, groundTruth);

  console.log(`${providerType}: ${accuracy}%, cost: ${provider.estimateCost(input)}`);
}

// Case 4: 동적 Provider 선택 (복잡도 기반)
async function extractDatesSmartly(input: OCRInput): Promise<ExtractedDate[]> {
  const complexity = await analyzeComplexity(input);

  let providerType: ProviderType;
  if (complexity === 'simple') {
    providerType = 'google-vision'; // 저렴
  } else if (complexity === 'medium') {
    providerType = 'gpt-4o-vision'; // 균형
  } else {
    providerType = 'claude-vision'; // 정확도 최우선
  }

  const provider = OCRProviderFactory.create(providerType);
  const extractor = new UnifiedDateExtractor(provider);

  return extractor.extract(input);
}
```

### 디렉토리 구조

```
src/modules/medical-analysis/
├── providers/
│   ├── ocr/
│   │   ├── IOCRProvider.ts            # OCR 인터페이스
│   │   ├── GoogleVisionProvider.ts     # Google Vision 구현
│   │   ├── GPT4oVisionProvider.ts      # GPT-4o Vision 구현
│   │   ├── ClaudeVisionProvider.ts     # Claude Vision 구현
│   │   ├── GeminiVisionProvider.ts     # Gemini Vision 구현
│   │   └── OCRProviderFactory.ts       # Factory 패턴
│   │
│   └── llm/
│       ├── ILLMProvider.ts             # LLM 인터페이스
│       ├── OpenAIProvider.ts           # OpenAI 구현
│       ├── AnthropicProvider.ts        # Anthropic 구현
│       └── LLMProviderFactory.ts       # Factory 패턴
│
├── extractors/
│   ├── UnifiedDateExtractor.ts         # 통합 날짜 추출기
│   ├── RegexDateExtractor.ts           # Regex 추출기
│   └── EnsembleDateExtractor.ts        # Ensemble 추출기
│
├── builders/
│   └── MedicalTimelineBuilder.ts       # 의료 이벤트 timeline 생성
│
├── utils/
│   ├── pdf2image.ts                    # PDF → 이미지 변환
│   ├── complexity-analyzer.ts          # 문서 복잡도 분석
│   └── cost-estimator.ts               # 비용 추정
│
└── service/
    └── advancedDateService.ts          # 기존 서비스 (리팩토링)
```

### 구현 일정

#### Week 3: Provider 인터페이스 설계
- Day 1-2: IOCRProvider 인터페이스 정의
- Day 3-4: GoogleVisionProvider 구현 (기존 코드 이관)
- Day 5-7: UnifiedDateExtractor 구현

#### Week 4: Vision LLM Providers 구현
- Day 1-3: GPT4oVisionProvider 구현
- Day 4-5: ClaudeVisionProvider 구현
- Day 6-7: 통합 테스트 및 문서화

**Phase 2 완료 기준:**
- ✅ OCR Provider 인터페이스 구현
- ✅ 3개 Vision LLM Provider 구현
- ✅ UnifiedDateExtractor 통합
- ✅ A/B 테스트 스크립트 작성
- ✅ 기존 기능 유지 (Breaking Change 없음)

---

## 🚀 Phase 3: Vision LLM 전환 (2-3주)

### Week 5-6: 파일럿 테스트

#### 10케이스 비교 테스트
```bash
# 3개 Provider로 동일 10케이스 테스트
npm run test:vision-pilot -- \
  --cases=10 \
  --providers=google-vision,gpt-4o-vision,claude-vision \
  --output=vision-pilot-results.json

# 예상 결과:
# Google Vision + LLM: 82% (baseline)
# GPT-4o Vision:       90-95%
# Claude Vision:       92-97%
```

#### A/B 테스트 프레임워크
```typescript
class ABTestFramework {
  async runTest(config: ABTestConfig): Promise<ABTestResult> {
    const results: CaseResult[] = [];

    for (const testCase of config.cases) {
      const controlResult = await this.runControl(testCase);  // Google OCR
      const treatmentResult = await this.runTreatment(testCase); // Vision LLM

      results.push({
        caseId: testCase.id,
        control: controlResult,
        treatment: treatmentResult,
        winner: this.determineWinner(controlResult, treatmentResult)
      });
    }

    return this.analyzeResults(results);
  }

  private determineWinner(control: Result, treatment: Result): 'control' | 'treatment' {
    // 정확도, 비용, 속도 종합 평가
    const controlScore = control.accuracy * 0.7 + (1 - control.cost / 0.1) * 0.2 + (1 - control.time / 10) * 0.1;
    const treatmentScore = treatment.accuracy * 0.7 + (1 - treatment.cost / 0.1) * 0.2 + (1 - treatment.time / 10) * 0.1;

    return treatmentScore > controlScore ? 'treatment' : 'control';
  }
}
```

### Week 7: 카나리 배포

#### 단계적 트래픽 전환
```typescript
class CanaryDeployment {
  private canaryPercentage = 0; // 0-100

  async processCase(input: OCRInput): Promise<ExtractedDate[]> {
    // 카나리 비율에 따라 Provider 선택
    const useVisionLLM = Math.random() * 100 < this.canaryPercentage;

    const provider = useVisionLLM
      ? OCRProviderFactory.create('gpt-4o-vision')
      : OCRProviderFactory.create('google-vision');

    const extractor = new UnifiedDateExtractor(provider);
    return extractor.extract(input);
  }

  increaseCanary(step: number = 10): void {
    this.canaryPercentage = Math.min(100, this.canaryPercentage + step);
    logger.info(`Canary percentage increased to ${this.canaryPercentage}%`);
  }

  rollback(): void {
    this.canaryPercentage = 0;
    logger.warn('Canary deployment rolled back');
  }
}

// 배포 스케줄
// Day 1-2: 10% 트래픽
// Day 3-4: 25% 트래픽
// Day 5-6: 50% 트래픽
// Day 7: 100% 전환 또는 Rollback
```

#### 모니터링 지표
```typescript
interface CanaryMetrics {
  control: {
    requestCount: number;
    avgAccuracy: number;
    avgLatency: number;
    errorRate: number;
    totalCost: number;
  };
  treatment: {
    requestCount: number;
    avgAccuracy: number;
    avgLatency: number;
    errorRate: number;
    totalCost: number;
  };
  decision: 'continue' | 'rollback';
}

function evaluateCanary(metrics: CanaryMetrics): 'continue' | 'rollback' {
  // Rollback 조건
  if (metrics.treatment.errorRate > metrics.control.errorRate * 1.5) {
    return 'rollback'; // 에러율 50% 증가 시
  }

  if (metrics.treatment.avgAccuracy < metrics.control.avgAccuracy - 0.05) {
    return 'rollback'; // 정확도 5%p 하락 시
  }

  if (metrics.treatment.avgLatency > metrics.control.avgLatency * 2) {
    return 'rollback'; // 지연시간 2배 증가 시
  }

  return 'continue';
}
```

### Week 8: 프로덕션 전환 완료

**최종 결정:**
- ✅ Vision LLM 전환 성공 → 100% 트래픽 전환
- ❌ Vision LLM 실패 → Google OCR 유지, 3개월 후 재시도

---

## 🔧 구현 체크리스트

### Phase 1: 안정화 ✅
- [ ] Ensemble 방식 구현 (좌표 + 비좌표)
- [ ] 23개 중복 케이스 85%+ 달성
- [ ] 의료 이벤트 timeline 생성 구현
- [ ] 28개 전체 케이스 85%+ 달성
- [ ] 에러 처리 강화
- [ ] 모니터링 시스템 구축
- [ ] 프로덕션 배포

### Phase 2: 모듈화
- [ ] IOCRProvider 인터페이스 정의
- [ ] GoogleVisionProvider 구현
- [ ] GPT4oVisionProvider 구현
- [ ] ClaudeVisionProvider 구현
- [ ] OCRProviderFactory 구현
- [ ] UnifiedDateExtractor 통합
- [ ] 기존 기능 유지 검증
- [ ] A/B 테스트 프레임워크 구현

### Phase 3: Vision LLM 전환
- [ ] 10케이스 파일럿 테스트
- [ ] 비교 분석 보고서 작성
- [ ] 카나리 배포 설정
- [ ] 10% → 25% → 50% → 100% 단계적 전환
- [ ] 모니터링 지표 추적
- [ ] 최종 의사결정

---

## 📚 API 키 설정 가이드

### 현재 API 키 상태 확인

```bash
# 환경 변수 확인
echo "OpenAI: ${OPENAI_API_KEY:0:10}..."
echo "Anthropic: ${ANTHROPIC_API_KEY:0:10}..."
echo "Google: ${GOOGLE_API_KEY:0:10}..."

# API 접근 테스트
npm run test:api-access
```

### Vision 모델 접근 권한

| API | Vision 접근 | 추가 키 필요 | 비고 |
|-----|------------|-------------|------|
| OpenAI | ✅ | ❌ | 기존 키로 gpt-4o 사용 가능 |
| Anthropic | ✅ | ❌ | 기존 키로 claude-3-5-sonnet 사용 가능 |
| Google | ✅ | ❌ | 기존 키로 gemini-2.0-flash 사용 가능 |

**결론:** 추가 API 키 불필요. 기존 키로 모든 Vision 모델 사용 가능.

### 환경 변수 설정

```bash
# .env 파일
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Vision 모델 활성화 플래그
ENABLE_VISION_LLM=false  # Phase 1-2: false, Phase 3: true
DEFAULT_OCR_PROVIDER=google-vision  # or gpt-4o-vision
CANARY_PERCENTAGE=0  # 0-100
```

---

## 📊 예상 일정 및 마일스톤

```
Week 1-2: Phase 1 (안정화)
├── Week 1: Ensemble 구현 및 검증
└── Week 2: 프로덕션 배포

Week 3-4: Phase 2 (모듈화)
├── Week 3: Provider 인터페이스
└── Week 4: Vision LLM Providers

Week 5-8: Phase 3 (Vision LLM 전환)
├── Week 5-6: 파일럿 테스트
├── Week 7: 카나리 배포
└── Week 8: 전환 완료 또는 Rollback

총 기간: 8주 (2개월)
```

### 마일스톤

**M1 (Week 2):** 안정화 완료
- ✅ 날짜 추출 정확도 85%+
- ✅ 프로덕션 배포
- ✅ 모니터링 시스템

**M2 (Week 4):** 모듈화 완료
- ✅ Provider 인터페이스
- ✅ 3개 Vision LLM Provider
- ✅ A/B 테스트 준비

**M3 (Week 8):** Vision LLM 전환 완료
- ✅ 파일럿 성공
- ✅ 카나리 배포 완료
- ✅ 정확도 90%+ 달성

---

## 🎯 성공 기준

### Phase 1 (안정화)
- 날짜 추출 정확도: **85%+** (28케이스 평균)
- Named 케이스: **100%**
- Case 케이스: **82%+**
- API 응답 시간: **<10초**
- 에러율: **<1%**

### Phase 2 (모듈화)
- Breaking Change: **0건**
- 코드 커버리지: **80%+**
- 인터페이스 테스트: **100% 통과**
- 문서화: **완료**

### Phase 3 (Vision LLM)
- 파일럿 정확도: **90%+**
- 카나리 에러율: **<1%**
- 비용 증가: **<2배**
- 롤백 횟수: **0회** (목표)

---

## 📝 결론

### 핵심 전략

1. **안정화 우선**: 현재 시스템으로 85%+ 달성 후 다음 단계 진행
2. **점진적 전환**: Provider 패턴으로 OCR 엔진 교체 가능하도록 모듈화
3. **위험 최소화**: 카나리 배포로 안전한 전환

### 우선순위

```
1순위: Phase 1 (안정화) ⭐ 최우선
       → 의료 이벤트 보고서 정확도 확보

2순위: Phase 2 (모듈화)
       → Vision LLM 전환 준비

3순위: Phase 3 (Vision LLM)
       → 정확도 90%+ 달성
```

### 의사결정 기준

**Phase 1 → Phase 2 전환:**
- 조건: 85%+ 정확도 달성
- 예상: 2주 후

**Phase 2 → Phase 3 전환:**
- 조건: 모듈화 완료, API 키 확인
- 예상: 4주 후

**Phase 3 완료:**
- 조건: 파일럿 90%+ 달성
- 예상: 8주 후

---

**작성일:** 2025-01-19
**작성자:** Claude (Sonnet 4.5)
**상태:** 구현 계획 완료
**다음 단계:** Phase 1 (안정화) 시작
