# 날짜 분류 시스템 개선 방안 설계

## 🎯 Sequential Thinking 기반 개선 전략

### Phase 1: 문제 정의 및 목표 설정

#### 1.1 핵심 문제
- **현재 상태**: 0.0% 정확도, 79개 날짜 누락, 4개 오탐지
- **목표 상태**: 95% 이상 정확도, 5% 이하 누락률, 안정적 성능
- **제약 조건**: 기존 코드 호환성, 성능 유지, 개발 리소스 제한

#### 1.2 성공 지표
- **정밀도**: 95% 이상
- **재현율**: 95% 이상
- **F1 점수**: 95% 이상
- **처리 시간**: 현재 대비 50% 단축
- **안정성**: 99% 이상 성공률

### Phase 2: 해결책 우선순위 분석

#### 2.1 즉시 해결 가능 (High Impact, Low Effort)
1. **기본 정규식 패턴 수정**
   - 현재 패턴의 우선순위 재정렬
   - 의료 문서 특화 패턴 추가
   - 예상 효과: 60-70% 정확도 향상

2. **텍스트 전처리 개선**
   - 불필요한 문자 제거
   - 날짜 형식 정규화
   - 예상 효과: 15-20% 정확도 향상

#### 2.2 중기 개선 (High Impact, Medium Effort)
1. **단순화된 날짜 추출 엔진**
   - AI 의존성 제거
   - 규칙 기반 로직으로 대체
   - 예상 효과: 안정성 90% 향상

2. **의료 도메인 특화 로직**
   - 의료 문서 구조 분석
   - 컨텍스트 기반 날짜 분류
   - 예상 효과: 20-25% 정확도 향상

#### 2.3 장기 개선 (Medium Impact, High Effort)
1. **점진적 AI 통합**
   - 기본 로직 안정화 후 AI 보조 기능 추가
   - 예상 효과: 5-10% 추가 향상

## 🔧 Comtex7 MCP 기반 구체적 개선안

### 1. 아키텍처 단순화

#### 1.1 현재 구조 문제점
```
복잡한 3단계 파이프라인:
Controller → Classifier → Anchor → AI → Validation
```

#### 1.2 개선된 구조
```
단순한 2단계 파이프라인:
SimpleDateExtractor → MedicalContextValidator
```

#### 1.3 구현 방안
```javascript
class SimplifiedDateExtractor {
  constructor() {
    this.patterns = new MedicalDatePatterns();
    this.validator = new ContextValidator();
  }
  
  extractDates(text) {
    // 1. 기본 패턴 매칭
    const rawDates = this.patterns.extractAll(text);
    
    // 2. 컨텍스트 검증
    const validatedDates = this.validator.validate(rawDates, text);
    
    // 3. 결과 반환
    return this.formatResults(validatedDates);
  }
}
```

### 2. 의료 도메인 특화 패턴

#### 2.1 현재 패턴 문제점
- 일반적인 날짜 패턴만 사용
- 의료 문서 특성 미반영
- 우선순위 설정 부적절

#### 2.2 개선된 패턴 체계
```javascript
const MEDICAL_DATE_PATTERNS = {
  // 우선순위 1: 명확한 의료 날짜
  medical_explicit: [
    /(?:진료일|내원일|검사일|수술일)\s*:?\s*(\d{4}[-.년]\d{1,2}[-.월]\d{1,2}일?)/g,
    /(?:\d{4}[-.년]\d{1,2}[-.월]\d{1,2}일?)\s*(?:진료|내원|검사|수술)/g
  ],
  
  // 우선순위 2: 표준 날짜 형식
  standard: [
    /(\d{4})[-.](\d{1,2})[-.](\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ],
  
  // 우선순위 3: 상대 날짜
  relative: [
    /(?:오늘|금일|당일)/g,
    /(\d+)\s*(?:일|주|개월|년)\s*(?:전|후)/g
  ]
};
```

### 3. 성능 최적화

#### 3.1 AI 호출 최소화
- **현재**: 모든 텍스트에 대해 Claude + OpenAI 호출
- **개선**: 규칙 기반 처리 후 필요시에만 AI 보조
- **효과**: 처리 시간 70% 단축, 비용 80% 절감

#### 3.2 캐싱 전략
```javascript
class DateExtractionCache {
  constructor() {
    this.patternCache = new Map();
    this.resultCache = new Map();
  }
  
  getCachedResult(textHash) {
    return this.resultCache.get(textHash);
  }
  
  cacheResult(textHash, result) {
    this.resultCache.set(textHash, result);
  }
}
```

### 4. 오류 처리 및 복구

#### 4.1 단계별 검증
```javascript
class ValidationPipeline {
  validate(dates, originalText) {
    const results = [];
    
    for (const date of dates) {
      // 1. 형식 검증
      if (!this.isValidFormat(date)) continue;
      
      // 2. 범위 검증
      if (!this.isReasonableDate(date)) continue;
      
      // 3. 컨텍스트 검증
      if (!this.hasValidContext(date, originalText)) continue;
      
      results.push(date);
    }
    
    return results;
  }
}
```

#### 4.2 Fallback 메커니즘
```javascript
class FallbackExtractor {
  extract(text) {
    try {
      // 1차: 고급 패턴 시도
      return this.advancedExtraction(text);
    } catch (error) {
      try {
        // 2차: 기본 패턴 시도
        return this.basicExtraction(text);
      } catch (error) {
        // 3차: 최소 패턴 시도
        return this.minimumExtraction(text);
      }
    }
  }
}
```

## 🎯 구현 우선순위

### 즉시 구현 (1-2주)
1. **기본 정규식 패턴 수정**
   - 파일: `src/dna-engine/core/enhancedDateAnchor.js`
   - 작업: 패턴 우선순위 재정렬, 의료 특화 패턴 추가
   - 예상 효과: 60-70% 정확도 향상

2. **텍스트 전처리 개선**
   - 파일: `src/dna-engine/core/textArrayDateControllerComplete.js`
   - 작업: 불필요한 문자 제거, 정규화 로직 추가
   - 예상 효과: 15-20% 정확도 향상

### 단기 구현 (2-4주)
1. **SimplifiedDateExtractor 개발**
   - 새 파일: `src/dna-engine/core/simplifiedDateExtractor.js`
   - 작업: 단순화된 날짜 추출 엔진 구현
   - 예상 효과: 안정성 90% 향상

2. **MedicalContextValidator 개발**
   - 새 파일: `src/dna-engine/validators/medicalContextValidator.js`
   - 작업: 의료 컨텍스트 기반 검증 로직
   - 예상 효과: 오탐지 80% 감소

### 중기 구현 (1-2개월)
1. **기존 시스템과의 통합**
   - 파일: `backend/controllers/devStudioController.js`
   - 작업: 새로운 엔진을 기존 API에 통합
   - 예상 효과: 하위 호환성 유지

2. **성능 모니터링 시스템**
   - 새 파일: `src/monitoring/dateExtractionMonitor.js`
   - 작업: 실시간 성능 추적 및 알림
   - 예상 효과: 문제 조기 발견

## 🔍 위험 요소 및 대응 방안

### 1. 기술적 위험
- **위험**: 기존 코드와의 호환성 문제
- **대응**: 점진적 마이그레이션, A/B 테스트

### 2. 성능 위험
- **위험**: 단순화로 인한 기능 저하
- **대응**: 단계별 검증, 롤백 계획

### 3. 운영 위험
- **위험**: 배포 중 서비스 중단
- **대응**: Blue-Green 배포, 카나리 릴리스

---

*설계 일시: 2025-01-17*
*설계 방법론: Sequential Thinking + Comtex7 MCP*
*검토 대상: 현실성, 구현성, 안정성, 기존 코드 연결성*