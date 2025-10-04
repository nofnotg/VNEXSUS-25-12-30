# 시나리오 4: 전처리 AI + 룰 기반 하이브리드 접근법 설계

*작성일: 2025년 1월 25일*

## 📋 개요

시나리오 3의 순수 AI 모델 대체 방안이 성능 부족으로 폐기됨에 따라, **전처리 AI + 룰 기반 시스템**의 하이브리드 접근법을 검토합니다. 이 방식은 AI의 문맥 이해 능력과 룰 기반 시스템의 정확성을 결합하여 최적의 성능을 달성하는 것을 목표로 합니다.

---

## 🎯 시나리오 4 핵심 전략

### 1. 전처리 AI의 역할
- **문맥 분석**: 의료 문서의 전체적인 구조와 맥락 파악
- **불필요 단어 제거**: 노이즈 데이터 식별 및 정제
- **패턴 구조화**: 반복되는 패턴을 큰 패턴 → 작은 패턴 순으로 구조화
- **날짜 블록화**: 날짜 정보를 의미 단위로 그룹화

### 2. 룰 기반 시스템의 역할
- **정확한 데이터 추출**: 구조화된 데이터에서 핵심 정보 추출
- **검증 및 검수**: AI 전처리 결과의 정확성 검증
- **표준화**: 일관된 형식으로 데이터 변환

---

## 🏗️ 하이브리드 아키텍처 설계

```
┌─────────────────────────────────────────────────────────────────────┐
│                    시나리오 4: 하이브리드 파이프라인                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ 1. OCR 입력  │ -> │ 2. 전처리 AI │ -> │ 3. 구조화    │              │
│  │   (원본)     │    │  (GPT-4o)   │    │   데이터     │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ 4. 룰 기반   │ -> │ 5. 검증 AI  │ -> │ 6. 최종     │              │
│  │   처리       │    │  (선택적)   │    │   보고서    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 전처리 AI 모듈 상세 설계

### Phase 1: 문맥 분석 및 구조 파악

```javascript
// 전처리 AI 프롬프트 템플릿
const preprocessingPrompt = `
당신은 의료 문서 전처리 전문 AI입니다.

주요 임무:
1. 문서 전체의 구조와 맥락을 파악
2. 의료 정보의 논리적 흐름 분석
3. 불필요한 노이즈 데이터 식별
4. 핵심 정보 블록 구분

입력: 원본 OCR 텍스트
출력: 구조화된 JSON 형태의 전처리 결과

처리 규칙:
- 날짜 정보는 [DATE] 태그로 마킹
- 병원 정보는 [HOSPITAL] 태그로 마킹
- 진단 정보는 [DIAGNOSIS] 태그로 마킹
- 치료 정보는 [TREATMENT] 태그로 마킹
- 불필요한 반복 텍스트는 [NOISE] 태그로 마킹
`;
```

### Phase 2: 패턴 구조화 로직

```javascript
class PreprocessingAI {
  constructor() {
    this.patternHierarchy = {
      // 큰 패턴 (문서 레벨)
      documentLevel: [
        'header_pattern',      // 문서 헤더
        'patient_info',        // 환자 정보
        'medical_history',     // 진료 이력
        'footer_pattern'       // 문서 푸터
      ],
      
      // 중간 패턴 (섹션 레벨)
      sectionLevel: [
        'date_section',        // 날짜 섹션
        'hospital_section',    // 병원 섹션
        'diagnosis_section',   // 진단 섹션
        'treatment_section'    // 치료 섹션
      ],
      
      // 작은 패턴 (항목 레벨)
      itemLevel: [
        'date_item',          // 개별 날짜
        'medication_item',    // 개별 약물
        'procedure_item'      // 개별 시술
      ]
    };
  }
  
  async structurizePatterns(text) {
    const result = {
      documentStructure: {},
      identifiedPatterns: [],
      noiseElements: [],
      structuredBlocks: []
    };
    
    // 1. 큰 패턴부터 식별
    for (const pattern of this.patternHierarchy.documentLevel) {
      const matches = await this.identifyPattern(text, pattern);
      result.documentStructure[pattern] = matches;
    }
    
    // 2. 중간 패턴 식별
    for (const pattern of this.patternHierarchy.sectionLevel) {
      const matches = await this.identifyPattern(text, pattern);
      result.identifiedPatterns.push({pattern, matches});
    }
    
    // 3. 작은 패턴 식별
    for (const pattern of this.patternHierarchy.itemLevel) {
      const matches = await this.identifyPattern(text, pattern);
      result.structuredBlocks.push({pattern, matches});
    }
    
    return result;
  }
}
```

### Phase 3: 날짜 블록화 처리

```javascript
class DateBlockProcessor {
  constructor() {
    this.datePatterns = [
      /\d{4}-\d{1,2}-\d{1,2}/g,           // YYYY-MM-DD
      /\d{4}\.\d{1,2}\.\d{1,2}/g,         // YYYY.MM.DD
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g, // 한글 날짜
      /\d{1,2}\/\d{1,2}\/\d{4}/g,         // MM/DD/YYYY
    ];
  }
  
  async blockifyDates(text) {
    const dateBlocks = [];
    let processedText = text;
    
    // 1. 모든 날짜 패턴 추출
    const allDates = this.extractAllDates(text);
    
    // 2. 날짜 주변 컨텍스트 분석
    for (const date of allDates) {
      const context = this.analyzeContext(text, date);
      const block = {
        date: date.normalized,
        originalFormat: date.original,
        context: context,
        relatedInfo: this.extractRelatedInfo(text, date, context)
      };
      dateBlocks.push(block);
    }
    
    // 3. 날짜 블록으로 텍스트 재구성
    processedText = this.reconstructWithBlocks(text, dateBlocks);
    
    return {
      processedText,
      dateBlocks,
      statistics: {
        totalDates: allDates.length,
        blocksCreated: dateBlocks.length,
        contextCoverage: this.calculateCoverage(dateBlocks)
      }
    };
  }
}
```

---

## 🔧 룰 기반 시스템 통합 설계

### 기존 룰 시스템 활용

```javascript
class HybridProcessor {
  constructor() {
    this.preprocessingAI = new PreprocessingAI();
    this.ruleBasedEngine = new RuleBasedEngine();
    this.validator = new ResultValidator();
  }
  
  async processDocument(ocrText) {
    // 1. 전처리 AI 단계
    const preprocessed = await this.preprocessingAI.process(ocrText);
    
    // 2. 룰 기반 처리 단계
    const ruleResults = await this.ruleBasedEngine.process(preprocessed.structuredText);
    
    // 3. 결과 검증 및 병합
    const validated = await this.validator.validate(ruleResults, preprocessed.metadata);
    
    // 4. 최종 보고서 생성
    return await this.generateReport(validated);
  }
}
```

### 성능 최적화 전략

```javascript
class PerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.batchProcessor = new BatchProcessor();
  }
  
  async optimizeProcessing(documents) {
    // 1. 캐시 활용
    const cachedResults = this.getCachedResults(documents);
    const uncachedDocs = documents.filter(doc => !cachedResults.has(doc.id));
    
    // 2. 배치 처리
    const batchResults = await this.batchProcessor.process(uncachedDocs);
    
    // 3. 결과 병합
    return this.mergeResults(cachedResults, batchResults);
  }
}
```

---

## 📊 예상 성능 지표

### 처리 성능 예측

| 지표 | 기존 룰 기반 | 시나리오 4 하이브리드 | 개선 효과 |
|------|-------------|---------------------|-----------|
| **정확도** | 85% | 92-95% | +7-10% |
| **처리 속도** | 2-3초 | 4-6초 | -2-3초 |
| **노이즈 제거율** | 70% | 90% | +20% |
| **구조화 품질** | 80% | 95% | +15% |
| **유지보수성** | 중간 | 높음 | 개선 |

### 비용 분석

```javascript
const costAnalysis = {
  preprocessing: {
    model: "GPT-4o-mini",
    costPerToken: 0.00015,
    avgTokensPerDoc: 8000,
    costPerDoc: 1.2
  },
  
  validation: {
    model: "GPT-4o (선택적)",
    costPerToken: 0.03,
    avgTokensPerDoc: 2000,
    costPerDoc: 60
  },
  
  totalCostPerDoc: 1.2, // 검증 AI 미사용 시
  monthlyVolume: 1000,
  monthlyCost: 1200
};
```

---

## 🧪 검증 계획

### Phase 1: 전처리 AI 단독 테스트
1. **문맥 분석 정확도 측정**
2. **패턴 구조화 품질 평가**
3. **날짜 블록화 성능 검증**

### Phase 2: 하이브리드 통합 테스트
1. **전처리 AI + 룰 기반 연동 테스트**
2. **14개 케이스 배치 검증**
3. **성능 지표 측정 및 비교**

### Phase 3: 실제 운영 환경 테스트
1. **대용량 문서 처리 테스트**
2. **동시 처리 성능 테스트**
3. **장기간 안정성 테스트**

---

## 🎯 구현 우선순위

### 높은 우선순위 (High Priority)
1. ✅ **전처리 AI 모듈 설계 및 프롬프트 개발**
2. ✅ **날짜 블록화 로직 구현**
3. ✅ **기존 룰 시스템과의 연동 인터페이스 개발**

### 중간 우선순위 (Medium Priority)
4. **성능 최적화 및 캐싱 시스템**
5. **배치 처리 시스템 구현**
6. **검증 및 모니터링 시스템**

### 낮은 우선순위 (Low Priority)
7. **고급 패턴 인식 기능**
8. **다국어 지원**
9. **시각화 대시보드**

---

## 📈 기대 효과

### 1. 정확도 향상
- **AI 문맥 이해**: 복잡한 의료 문서의 맥락 파악
- **룰 기반 정확성**: 검증된 추출 로직 활용
- **하이브리드 시너지**: 두 방식의 장점 결합

### 2. 처리 품질 개선
- **노이즈 제거**: AI 기반 불필요 데이터 식별
- **구조화**: 체계적인 정보 정리
- **일관성**: 표준화된 출력 형식

### 3. 유지보수성 향상
- **모듈화**: 각 단계별 독립적 개선 가능
- **확장성**: 새로운 패턴 추가 용이
- **디버깅**: 단계별 결과 추적 가능

---

## 🚀 다음 단계

1. **전처리 AI 프롬프트 개발 및 테스트**
2. **날짜 블록화 모듈 구현**
3. **하이브리드 파이프라인 통합**
4. **14개 케이스 검증 실행**
5. **성능 지표 측정 및 분석**

이 하이브리드 접근법을 통해 AI의 유연성과 룰 기반 시스템의 안정성을 모두 확보할 수 있을 것으로 예상됩니다.