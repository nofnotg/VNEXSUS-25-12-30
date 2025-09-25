# 날짜 분류 시스템 구현 로드맵

## 🎯 전체 로드맵 개요

### 목표
- **현재**: 0.0% 정확도, 79개 날짜 누락
- **목표**: 95% 이상 정확도, 5% 이하 누락률
- **기간**: 3개월 (12주)
- **접근법**: 점진적 개선, 위험 최소화

### 성공 지표
- **Phase 1**: 60-80% 정확도 달성
- **Phase 2**: 85-90% 정확도 달성
- **Phase 3**: 95% 이상 정확도 달성

## 📅 Phase 1: 긴급 수정 (1-2주)

### 목표: 즉시 사용 가능한 수준으로 개선
**기간**: 2025-01-17 ~ 2025-01-31 (2주)
**담당**: 백엔드 개발자 1명
**예상 효과**: 0% → 70% 정확도 향상

### 1.1 기본 정규식 패턴 수정 (3일)

#### Day 1: 패턴 분석 및 설계
**작업 내용:**
- 현재 패턴 문제점 분석
- Case1.txt 기반 패턴 검증
- 의료 특화 패턴 설계

**산출물:**
- 패턴 분석 보고서
- 새로운 패턴 명세서

**구체적 작업:**
```javascript
// 파일: src/dna-engine/core/enhancedDateAnchor.js
// 현재 문제 패턴 (line 25-45)
const datePatterns = {
  absolute: {
    patterns: [
      /(?<year>\d{4})[년\-\.\s]*(?<month>\d{1,2})[월\-\.\s]*(?<day>\d{1,2})[일]?/g,
      // 기타 패턴들...
    ]
  }
};

// 개선된 패턴 (우선순위 기반)
const OPTIMIZED_PATTERNS = {
  // 우선순위 1: 의료 문서 특화 패턴
  medical_explicit: {
    patterns: [
      /(?:진료일|내원일|검사일|수술일)\s*:?\s*(\d{4}[-.년]\d{1,2}[-.월]\d{1,2}일?)/g,
      /(\d{4}[-.년]\d{1,2}[-.월]\d{1,2}일?)\s*(?:진료|내원|검사|수술)/g
    ],
    confidence: 0.95,
    priority: 100
  },
  // 우선순위 2: 표준 날짜 형식
  standard_format: {
    patterns: [
      /(\d{4})[-.](\d{1,2})[-.](\d{1,2})/g,
      /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
      /(\d{8})/g  // YYYYMMDD
    ],
    confidence: 0.9,
    priority: 90
  }
};
```

#### Day 2: 패턴 구현 및 테스트
**작업 내용:**
- 새로운 패턴 구현
- 단위 테스트 작성
- Case1.txt 검증

**검증 기준:**
- Case1.txt에서 최소 60개 이상 날짜 추출
- 오탐지 5개 이하
- 기존 테스트 케이스 통과

#### Day 3: 배포 및 모니터링
**작업 내용:**
- 프로덕션 배포
- 성능 모니터링
- 롤백 계획 준비

### 1.2 AI 의존성 제거 (2일)

#### Day 4: AI 호출 로직 제거
**작업 내용:**
- Claude/OpenAI 호출 코드 제거
- Fallback 로직으로 대체
- 오류 처리 강화

**수정 파일:**
```javascript
// 파일: src/dna-engine/core/advancedTextArrayDateClassifier.js
// 제거 대상 (line 640-720)
async performAIClassification(arrayAnalyses, crossReferences) {
  // Claude 호출 제거
  // const claudeResult = await this.claudeService.analyze(...);
  // OpenAI 호출 제거
  // const openaiResult = await this.openaiService.analyze(...);
  
  // 규칙 기반 로직으로 대체
  return this.performRuleBasedClassification(arrayAnalyses, crossReferences);
}

// 새로운 규칙 기반 분류
async performRuleBasedClassification(arrayAnalyses, crossReferences) {
  const classification = {
    textArrays: [],
    dateRelationships: [],
    confidence: 0.9,  // 규칙 기반 고정 신뢰도
    aiAgreement: 1.0   // AI 없으므로 100% 일치
  };
  
  // 간단한 규칙 기반 분류 로직
  for (const analysis of arrayAnalyses) {
    classification.textArrays.push({
      arrayIndex: analysis.arrayIndex,
      text: analysis.text,
      dates: analysis.dateRoles,
      classification: this.classifyByRules(analysis),
      confidence: 0.9
    });
  }
  
  return classification;
}
```

#### Day 5: 통합 테스트 및 성능 검증
**작업 내용:**
- 전체 시스템 통합 테스트
- 성능 벤치마크
- 안정성 검증

**검증 기준:**
- API 응답 시간 50% 단축
- 오류율 90% 감소
- 비용 80% 절감

### 1.3 텍스트 전처리 개선 (2일)

#### Day 6: 전처리 로직 최적화
**작업 내용:**
- 불필요한 문자 제거 강화
- 날짜 형식 정규화
- 의료 용어 정리

**구현 예시:**
```javascript
// 파일: src/dna-engine/core/textArrayDateControllerComplete.js
// 개선된 전처리 (line 100-120)
preprocessText(documentText) {
  let processed = documentText;
  
  // 1. 불필요한 문자 제거
  processed = processed
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // 제로폭 문자
    .replace(/\s+/g, ' ')                    // 연속 공백 정리
    .replace(/[^\w\s가-힣\d\-\.\/:]/g, ' '); // 특수문자 정리
  
  // 2. 날짜 형식 정규화
  processed = processed
    .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, '$1-$2-$3')  // YYYY.MM.DD → YYYY-MM-DD
    .replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g, '$1-$2-$3')  // YYYY/MM/DD → YYYY-MM-DD
    .replace(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, '$1-$2-$3'); // 한글 → 표준
  
  // 3. 의료 용어 정규화
  const medicalTermMap = {
    '내원': '진료',
    '방문': '진료',
    '검진': '검사',
    '촬영': '검사'
  };
  
  for (const [old, new_] of Object.entries(medicalTermMap)) {
    processed = processed.replace(new RegExp(old, 'g'), new_);
  }
  
  return processed;
}
```

#### Day 7: 검증 및 최적화
**작업 내용:**
- 전처리 효과 검증
- 성능 최적화
- 문서화 업데이트

### Phase 1 완료 기준
- **정확도**: 70% 이상
- **처리 시간**: 현재 대비 50% 단축
- **안정성**: 99% 이상 성공률
- **비용**: 80% 절감

---

## 📅 Phase 2: 구조적 개선 (3-6주)

### 목표: 안정적이고 확장 가능한 시스템 구축
**기간**: 2025-02-01 ~ 2025-03-15 (6주)
**담당**: 백엔드 개발자 1명 + 테스터 1명
**예상 효과**: 70% → 90% 정확도 향상

### 2.1 SimplifiedDateExtractor 개발 (3주)

#### Week 1: 설계 및 기본 구현
**Day 1-2: 아키텍처 설계**
```javascript
// 새 파일: src/dna-engine/core/simplifiedDateExtractor.js
class SimplifiedDateExtractor {
  constructor() {
    this.patterns = new MedicalDatePatterns();
    this.validator = new ContextValidator();
    this.formatter = new ResultFormatter();
    this.cache = new ExtractionCache();
  }
  
  async extractDates(text, options = {}) {
    // 1. 캐시 확인
    const cacheKey = this.generateCacheKey(text, options);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 2. 전처리
    const processedText = this.preprocessText(text);
    
    // 3. 패턴 매칭
    const rawDates = this.patterns.extractAll(processedText);
    
    // 4. 컨텍스트 검증
    const validatedDates = this.validator.validate(rawDates, processedText);
    
    // 5. 결과 포맷팅
    const result = this.formatter.format(validatedDates);
    
    // 6. 캐시 저장
    this.cache.set(cacheKey, result);
    
    return result;
  }
}
```

**Day 3-5: 핵심 컴포넌트 구현**
- MedicalDatePatterns 클래스
- ContextValidator 클래스
- ResultFormatter 클래스

#### Week 2: 고급 기능 구현
**Day 8-10: 검증 로직 강화**
```javascript
// 새 파일: src/dna-engine/validators/contextValidator.js
class ContextValidator {
  validate(dates, text) {
    const validatedDates = [];
    
    for (const date of dates) {
      // 1. 형식 검증
      if (!this.isValidFormat(date)) continue;
      
      // 2. 범위 검증 (1900-2030)
      if (!this.isReasonableDate(date)) continue;
      
      // 3. 의료 컨텍스트 검증
      if (!this.hasMedicalContext(date, text)) continue;
      
      // 4. 중복 제거
      if (this.isDuplicate(date, validatedDates)) continue;
      
      validatedDates.push({
        ...date,
        confidence: this.calculateConfidence(date, text)
      });
    }
    
    return this.sortByConfidence(validatedDates);
  }
  
  hasMedicalContext(date, text) {
    const medicalKeywords = [
      '진료', '내원', '검사', '수술', '치료', '처방',
      '병원', '의원', '클리닉', '센터',
      '진단', '소견', '결과', '판정'
    ];
    
    // 날짜 주변 50자 내에서 의료 키워드 검색
    const dateIndex = text.indexOf(date.original);
    const contextStart = Math.max(0, dateIndex - 50);
    const contextEnd = Math.min(text.length, dateIndex + 50);
    const context = text.substring(contextStart, contextEnd);
    
    return medicalKeywords.some(keyword => context.includes(keyword));
  }
}
```

**Day 11-12: 성능 최적화**
- 캐싱 전략 구현
- 정규식 최적화
- 메모리 사용량 최적화

#### Week 3: 통합 및 테스트
**Day 15-17: 기존 시스템과 통합**
```javascript
// 파일: backend/controllers/devStudioController.js
// 점진적 마이그레이션 로직 추가
class DevStudioController {
  constructor() {
    // 기존 컨트롤러
    this.textArrayController = new TextArrayDateController();
    
    // 새로운 추출기
    this.simplifiedExtractor = new SimplifiedDateExtractor();
  }
  
  async preprocessText(req, res) {
    const { text, options = {} } = req.body;
    
    // A/B 테스트를 위한 플래그
    const useNewExtractor = options.useSimplifiedExtractor || 
                           process.env.USE_SIMPLIFIED_EXTRACTOR === 'true';
    
    let dateAnalysisResult;
    
    if (useNewExtractor) {
      console.log('🔄 새로운 SimplifiedDateExtractor 사용');
      dateAnalysisResult = await this.simplifiedExtractor.extractDates(text, options);
    } else {
      console.log('🔄 기존 TextArrayDateController 사용');
      dateAnalysisResult = await this.textArrayController.processDocumentDateArrays(text, options);
    }
    
    // 결과 처리 로직...
  }
}
```

**Day 18-21: 종합 테스트**
- 단위 테스트 (90% 커버리지)
- 통합 테스트
- 성능 테스트
- A/B 테스트

### 2.2 모니터링 시스템 구축 (2주)

#### Week 4: 성능 모니터링
**Day 22-26: 실시간 모니터링**
```javascript
// 새 파일: src/monitoring/dateExtractionMonitor.js
class DateExtractionMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulExtractions: 0,
      averageProcessingTime: 0,
      accuracyRate: 0,
      errorRate: 0
    };
  }
  
  recordExtraction(result, processingTime) {
    this.metrics.totalRequests++;
    
    if (result.success) {
      this.metrics.successfulExtractions++;
      this.updateAverageTime(processingTime);
      this.updateAccuracyRate(result.accuracy);
    } else {
      this.metrics.errorRate = this.calculateErrorRate();
    }
    
    // 임계값 초과 시 알림
    this.checkThresholds();
  }
  
  checkThresholds() {
    if (this.metrics.accuracyRate < 0.8) {
      this.sendAlert('정확도 임계값 미달', this.metrics.accuracyRate);
    }
    
    if (this.metrics.errorRate > 0.05) {
      this.sendAlert('오류율 임계값 초과', this.metrics.errorRate);
    }
  }
}
```

#### Week 5: 품질 관리
**Day 29-33: 자동 품질 검증**
- 자동 테스트 케이스 생성
- 회귀 테스트 자동화
- 성능 벤치마크 자동화

### 2.3 문서화 및 배포 (1주)

#### Week 6: 배포 준비
**Day 36-42: 프로덕션 배포**
- 배포 스크립트 작성
- 롤백 계획 수립
- 사용자 가이드 작성
- 프로덕션 배포

### Phase 2 완료 기준
- **정확도**: 90% 이상
- **안정성**: 99.5% 이상
- **처리 시간**: Phase 1 대비 추가 20% 단축
- **모니터링**: 실시간 성능 추적 가능

---

## 📅 Phase 3: 전문화 및 최적화 (7-12주)

### 목표: 의료 도메인 전문화 및 95% 정확도 달성
**기간**: 2025-03-16 ~ 2025-04-30 (6주)
**담당**: 백엔드 개발자 1명 + 도메인 전문가 1명
**예상 효과**: 90% → 95% 정확도 향상

### 3.1 의료 도메인 특화 (4주)

#### Week 7-8: 도메인 분석
**의료 문서 패턴 분석**
- 다양한 의료 문서 수집 및 분석
- 날짜 표현 패턴 체계화
- 의료 용어 사전 구축

**구현 예시:**
```javascript
// 새 파일: src/dna-engine/domain/medicalDomainAnalyzer.js
class MedicalDomainAnalyzer {
  constructor() {
    this.documentTypes = {
      '진료기록': {
        datePatterns: ['진료일', '내원일', '진료 날짜'],
        contextKeywords: ['진료', '진찰', '상담'],
        structure: 'header-content-signature'
      },
      '검사결과': {
        datePatterns: ['검사일', '촬영일', '검사 날짜'],
        contextKeywords: ['검사', '촬영', 'CT', 'MRI', 'X-ray'],
        structure: 'header-result-interpretation'
      },
      '수술기록': {
        datePatterns: ['수술일', '시술일', '수술 날짜'],
        contextKeywords: ['수술', '시술', '마취', '절개'],
        structure: 'header-procedure-result'
      }
    };
  }
  
  analyzeDocumentType(text) {
    const scores = {};
    
    for (const [type, config] of Object.entries(this.documentTypes)) {
      scores[type] = this.calculateTypeScore(text, config);
    }
    
    return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  }
}
```

#### Week 9-10: 고급 분류 로직
**컨텍스트 기반 날짜 분류**
- 문서 유형별 날짜 추출 전략
- 의료 이벤트 시퀀스 분석
- 날짜 간 관계 분석

### 3.2 지능형 검증 시스템 (2주)

#### Week 11-12: 자가 학습 시스템
**피드백 기반 개선**
- 사용자 피드백 수집
- 오류 패턴 분석
- 자동 패턴 업데이트

```javascript
// 새 파일: src/dna-engine/learning/feedbackLearner.js
class FeedbackLearner {
  constructor() {
    this.feedbackData = [];
    this.errorPatterns = new Map();
  }
  
  recordFeedback(originalText, extractedDates, userCorrections) {
    const feedback = {
      timestamp: new Date(),
      text: originalText,
      extracted: extractedDates,
      corrected: userCorrections,
      errors: this.identifyErrors(extractedDates, userCorrections)
    };
    
    this.feedbackData.push(feedback);
    this.analyzeErrorPatterns(feedback.errors);
  }
  
  suggestPatternUpdates() {
    const suggestions = [];
    
    for (const [pattern, frequency] of this.errorPatterns) {
      if (frequency > 5) {  // 5회 이상 반복되는 오류
        suggestions.push({
          type: 'pattern_update',
          pattern: pattern,
          frequency: frequency,
          recommendation: this.generateRecommendation(pattern)
        });
      }
    }
    
    return suggestions;
  }
}
```

### Phase 3 완료 기준
- **정확도**: 95% 이상
- **도메인 특화**: 의료 문서 유형별 최적화
- **자가 학습**: 피드백 기반 자동 개선
- **확장성**: 새로운 문서 유형 쉽게 추가 가능

---

## 🎯 리스크 관리 계획

### 기술적 리스크

#### 리스크 1: 성능 저하
**확률**: 중간 (30%)
**영향**: 높음
**대응 방안**:
- 각 Phase별 성능 벤치마크 설정
- 성능 임계값 모니터링
- 성능 저하 시 즉시 롤백

#### 리스크 2: 호환성 문제
**확률**: 낮음 (15%)
**영향**: 높음
**대응 방안**:
- 점진적 마이그레이션
- A/B 테스트
- 기존 API 인터페이스 유지

### 일정 리스크

#### 리스크 3: 개발 지연
**확률**: 중간 (40%)
**영향**: 중간
**대응 방안**:
- 각 Phase별 버퍼 시간 확보 (20%)
- 우선순위 기반 기능 조정
- 외부 리소스 활용

### 품질 리스크

#### 리스크 4: 정확도 목표 미달
**확률**: 낮음 (20%)
**영향**: 높음
**대응 방안**:
- 단계별 품질 게이트 설정
- 지속적 테스트 및 검증
- 도메인 전문가 참여

## 📊 성공 지표 및 KPI

### 기술적 KPI
- **정확도**: Phase별 목표 달성률
- **처리 시간**: 현재 대비 개선율
- **안정성**: 시스템 가용률
- **비용**: API 호출 비용 절감률

### 비즈니스 KPI
- **사용자 만족도**: 피드백 점수
- **오류 신고**: 사용자 오류 신고 건수
- **처리량**: 일일 처리 문서 수
- **ROI**: 개발 투자 대비 효과

## 🔄 지속적 개선 계획

### 모니터링 체계
- **실시간 모니터링**: 성능, 정확도, 오류율
- **주간 리포트**: 트렌드 분석, 이슈 요약
- **월간 검토**: 목표 달성도, 개선 방향

### 피드백 루프
- **사용자 피드백**: 정확도, 사용성 개선
- **시스템 로그**: 자동 오류 패턴 분석
- **성능 메트릭**: 지속적 최적화

---

*로드맵 수립일: 2025-01-17*
*총 기간: 12주 (3개월)*
*예상 투입 인력: 개발자 1-2명, 테스터 1명, 도메인 전문가 1명*
*예상 비용: 개발비 + 인프라 비용 80% 절감*