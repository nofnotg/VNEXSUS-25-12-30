# TASK-2025-02-01-PHASE2-SIMPLIFIED-EXTRACTOR

## 📋 Task 개요

**Task ID**: TASK-2025-02-01-PHASE2-SIMPLIFIED-EXTRACTOR  
**생성일**: 2025-01-17  
**시작 예정일**: 2025-02-01  
**우선순위**: 🟡 MEDIUM  
**예상 기간**: 6주 (2025-02-01 ~ 2025-03-15)  
**담당자**: 백엔드 개발자 1명 + 테스터 1명  

### 목표
Phase 1의 긴급 수정을 기반으로 **안정적이고 확장 가능한 SimplifiedDateExtractor 시스템** 구축

### 성공 기준
- ✅ 정확도: 70% → 90% 이상
- ✅ 안정성: 99.5% 이상 가용률
- ✅ 처리 시간: Phase 1 대비 추가 20% 단축
- ✅ 모니터링: 실시간 성능 추적 가능
- ✅ 확장성: 새로운 패턴 쉽게 추가 가능

---

## 🏗️ 아키텍처 설계

### 새로운 시스템 구조
```
┌─────────────────────────────────────────────────────────────┐
│                SimplifiedDateExtractor                     │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │  TextProcessor  │ PatternMatcher  │ ResultFormatter │   │
│  │  • Preprocessing│ • Medical       │ • Validation    │   │
│  │  • Normalization│   Patterns      │ • Confidence    │   │
│  │  │  • Segmentation │ • Context Check │ • Deduplication │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │  CacheManager   │ PerformanceMonitor│ ErrorHandler  │   │
│  │  • Redis Cache  │ • Metrics       │ • Fallback     │   │
│  │  • TTL Management│ • Alerts        │ • Recovery     │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 세부 작업 계획

### Week 1: 설계 및 기본 구현 (2025-02-01 ~ 2025-02-07)

#### Day 1-2: 아키텍처 설계
**작업 내용:**
- [ ] SimplifiedDateExtractor 상세 설계
- [ ] 컴포넌트 인터페이스 정의
- [ ] 데이터 플로우 설계
- [ ] 성능 요구사항 정의

**설계 문서:**
```javascript
// 새 파일: src/dna-engine/core/simplifiedDateExtractor.js
class SimplifiedDateExtractor {
  constructor(options = {}) {
    this.textProcessor = new MedicalTextProcessor(options.textProcessor);
    this.patternMatcher = new MedicalDatePatternMatcher(options.patterns);
    this.resultFormatter = new DateResultFormatter(options.formatter);
    this.cacheManager = new ExtractionCacheManager(options.cache);
    this.monitor = new PerformanceMonitor(options.monitoring);
    this.errorHandler = new ErrorHandler(options.errorHandling);
  }
  
  async extractDates(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1. 캐시 확인
      const cacheKey = this.cacheManager.generateKey(text, options);
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.monitor.recordCacheHit();
        return cached;
      }
      
      // 2. 텍스트 전처리
      const processedText = await this.textProcessor.process(text);
      
      // 3. 패턴 매칭
      const rawDates = await this.patternMatcher.findDates(processedText);
      
      // 4. 결과 포맷팅 및 검증
      const result = await this.resultFormatter.format(rawDates, processedText);
      
      // 5. 캐시 저장
      await this.cacheManager.set(cacheKey, result);
      
      // 6. 성능 모니터링
      this.monitor.recordExtraction(result, Date.now() - startTime);
      
      return result;
    } catch (error) {
      return this.errorHandler.handle(error, text, options);
    }
  }
}
```

#### Day 3-5: 핵심 컴포넌트 구현
**작업 내용:**
- [ ] MedicalTextProcessor 클래스 구현
- [ ] MedicalDatePatternMatcher 클래스 구현
- [ ] DateResultFormatter 클래스 구현

**MedicalTextProcessor 구현:**
```javascript
// 새 파일: src/dna-engine/processors/medicalTextProcessor.js
class MedicalTextProcessor {
  constructor(options = {}) {
    this.enableNormalization = options.enableNormalization ?? true;
    this.enableMedicalTerms = options.enableMedicalTerms ?? true;
    this.enableDateNormalization = options.enableDateNormalization ?? true;
  }
  
  async process(text) {
    let processed = text;
    
    // 1. 기본 정리
    processed = this.cleanBasicCharacters(processed);
    
    // 2. 날짜 형식 정규화
    if (this.enableDateNormalization) {
      processed = this.normalizeDateFormats(processed);
    }
    
    // 3. 의료 용어 정규화
    if (this.enableMedicalTerms) {
      processed = this.normalizeMedicalTerms(processed);
    }
    
    // 4. 최종 정리
    processed = this.finalCleanup(processed);
    
    return {
      original: text,
      processed: processed,
      metadata: this.generateMetadata(text, processed)
    };
  }
  
  cleanBasicCharacters(text) {
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')  // 제로폭 문자
      .replace(/\s+/g, ' ')                    // 연속 공백
      .replace(/[^\w\s가-힣\d\-\.\/:()\[\]]/g, ' ') // 불필요한 특수문자
      .trim();
  }
  
  normalizeDateFormats(text) {
    return text
      .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g, '$1-$2-$3')
      .replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g, '$1-$2-$3')
      .replace(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, '$1-$2-$3')
      .replace(/(\d{2})\.(\d{1,2})\.(\d{1,2})/g, '20$1-$2-$3'); // 2자리 연도
  }
  
  normalizeMedicalTerms(text) {
    const termMap = {
      '내원': '진료',
      '방문': '진료',
      '검진': '검사',
      '촬영': '검사',
      '시술': '수술',
      '처치': '치료'
    };
    
    let normalized = text;
    for (const [old, new_] of Object.entries(termMap)) {
      normalized = normalized.replace(new RegExp(old, 'g'), new_);
    }
    
    return normalized;
  }
}
```

### Week 2: 고급 기능 구현 (2025-02-08 ~ 2025-02-14)

#### Day 8-10: 검증 로직 강화
**작업 내용:**
- [ ] ContextValidator 클래스 구현
- [ ] 의료 컨텍스트 검증 로직
- [ ] 날짜 범위 및 형식 검증
- [ ] 중복 제거 알고리즘

**ContextValidator 구현:**
```javascript
// 새 파일: src/dna-engine/validators/contextValidator.js
class ContextValidator {
  constructor(options = {}) {
    this.medicalKeywords = options.medicalKeywords || [
      '진료', '내원', '검사', '수술', '치료', '처방',
      '병원', '의원', '클리닉', '센터',
      '진단', '소견', '결과', '판정', '처방전'
    ];
    this.contextWindow = options.contextWindow || 50;
    this.minConfidence = options.minConfidence || 0.7;
  }
  
  validate(dates, text) {
    const validatedDates = [];
    
    for (const date of dates) {
      const validation = this.validateSingleDate(date, text);
      
      if (validation.isValid && validation.confidence >= this.minConfidence) {
        validatedDates.push({
          ...date,
          confidence: validation.confidence,
          validationReasons: validation.reasons
        });
      }
    }
    
    return this.removeDuplicates(this.sortByConfidence(validatedDates));
  }
  
  validateSingleDate(date, text) {
    const validation = {
      isValid: true,
      confidence: 0.5,
      reasons: []
    };
    
    // 1. 형식 검증
    if (this.isValidFormat(date)) {
      validation.confidence += 0.2;
      validation.reasons.push('valid_format');
    } else {
      validation.isValid = false;
      validation.reasons.push('invalid_format');
      return validation;
    }
    
    // 2. 날짜 범위 검증 (1900-2030)
    if (this.isReasonableDate(date)) {
      validation.confidence += 0.1;
      validation.reasons.push('reasonable_date');
    } else {
      validation.confidence -= 0.3;
      validation.reasons.push('unreasonable_date');
    }
    
    // 3. 의료 컨텍스트 검증
    const contextScore = this.calculateContextScore(date, text);
    validation.confidence += contextScore * 0.3;
    validation.reasons.push(`context_score_${contextScore.toFixed(2)}`);
    
    // 4. 패턴 신뢰도 적용
    if (date.patternConfidence) {
      validation.confidence = (validation.confidence + date.patternConfidence) / 2;
    }
    
    return validation;
  }
  
  calculateContextScore(date, text) {
    const dateIndex = text.indexOf(date.original);
    if (dateIndex === -1) return 0;
    
    const contextStart = Math.max(0, dateIndex - this.contextWindow);
    const contextEnd = Math.min(text.length, dateIndex + this.contextWindow);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    let score = 0;
    let keywordCount = 0;
    
    for (const keyword of this.medicalKeywords) {
      if (context.includes(keyword)) {
        score += 1;
        keywordCount++;
      }
    }
    
    // 정규화 (0-1 범위)
    return Math.min(score / 3, 1.0); // 최대 3개 키워드까지 고려
  }
}
```

#### Day 11-12: 성능 최적화
**작업 내용:**
- [ ] 캐싱 전략 구현
- [ ] 정규식 최적화
- [ ] 메모리 사용량 최적화
- [ ] 비동기 처리 최적화

**CacheManager 구현:**
```javascript
// 새 파일: src/dna-engine/cache/extractionCacheManager.js
class ExtractionCacheManager {
  constructor(options = {}) {
    this.ttl = options.ttl || 3600; // 1시간
    this.maxSize = options.maxSize || 1000;
    this.enableRedis = options.enableRedis || false;
    
    if (this.enableRedis) {
      this.redisClient = new Redis(options.redis);
    } else {
      this.memoryCache = new Map();
    }
  }
  
  generateKey(text, options) {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify({ text: text.substring(0, 1000), options }))
      .digest('hex');
    return `date_extraction:${hash}`;
  }
  
  async get(key) {
    if (this.enableRedis) {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } else {
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      } else {
        this.memoryCache.delete(key);
        return null;
      }
    }
  }
  
  async set(key, data) {
    if (this.enableRedis) {
      await this.redisClient.setex(key, this.ttl, JSON.stringify(data));
    } else {
      // 메모리 캐시 크기 제한
      if (this.memoryCache.size >= this.maxSize) {
        const firstKey = this.memoryCache.keys().next().value;
        this.memoryCache.delete(firstKey);
      }
      
      this.memoryCache.set(key, {
        data: data,
        expiry: Date.now() + (this.ttl * 1000)
      });
    }
  }
}
```

### Week 3: 통합 및 테스트 (2025-02-15 ~ 2025-02-21)

#### Day 15-17: 기존 시스템과 통합
**작업 내용:**
- [ ] 기존 API와의 호환성 확보
- [ ] 점진적 마이그레이션 로직 구현
- [ ] A/B 테스트 환경 구축

**통합 로직 구현:**
```javascript
// 파일: backend/controllers/devStudioController.js 수정
class DevStudioController {
  constructor() {
    // 기존 컨트롤러
    this.textArrayController = new TextArrayDateController();
    
    // 새로운 추출기
    this.simplifiedExtractor = new SimplifiedDateExtractor({
      cache: { enableRedis: process.env.REDIS_ENABLED === 'true' },
      monitoring: { enabled: true },
      errorHandling: { enableFallback: true }
    });
  }
  
  async preprocessText(req, res) {
    const { text, options = {} } = req.body;
    
    // A/B 테스트를 위한 플래그
    const useNewExtractor = this.shouldUseNewExtractor(req, options);
    
    let dateAnalysisResult;
    const startTime = Date.now();
    
    try {
      if (useNewExtractor) {
        console.log('🔄 SimplifiedDateExtractor 사용');
        dateAnalysisResult = await this.simplifiedExtractor.extractDates(text, options);
      } else {
        console.log('🔄 기존 TextArrayDateController 사용');
        dateAnalysisResult = await this.textArrayController.processDocumentDateArrays(text, options);
      }
      
      // 성능 메트릭 수집
      this.recordPerformanceMetrics({
        extractor: useNewExtractor ? 'simplified' : 'legacy',
        processingTime: Date.now() - startTime,
        accuracy: dateAnalysisResult.accuracy,
        dateCount: dateAnalysisResult.dates?.length || 0
      });
      
      res.json({
        success: true,
        data: dateAnalysisResult,
        metadata: {
          extractor: useNewExtractor ? 'simplified' : 'legacy',
          processingTime: Date.now() - startTime
        }
      });
    } catch (error) {
      console.error('날짜 추출 오류:', error);
      
      // 폴백 로직
      if (useNewExtractor) {
        console.log('🔄 폴백: 기존 시스템으로 재시도');
        try {
          dateAnalysisResult = await this.textArrayController.processDocumentDateArrays(text, options);
          res.json({
            success: true,
            data: dateAnalysisResult,
            metadata: {
              extractor: 'legacy_fallback',
              processingTime: Date.now() - startTime,
              fallbackReason: error.message
            }
          });
        } catch (fallbackError) {
          res.status(500).json({
            success: false,
            error: 'Both extractors failed',
            details: {
              primary: error.message,
              fallback: fallbackError.message
            }
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }
  
  shouldUseNewExtractor(req, options) {
    // 환경 변수 기반
    if (process.env.FORCE_NEW_EXTRACTOR === 'true') return true;
    if (process.env.FORCE_LEGACY_EXTRACTOR === 'true') return false;
    
    // 사용자 옵션 기반
    if (options.useSimplifiedExtractor !== undefined) {
      return options.useSimplifiedExtractor;
    }
    
    // A/B 테스트: 사용자 ID 기반 (50/50 분할)
    const userId = req.headers['user-id'] || req.ip;
    const hash = require('crypto').createHash('md5').update(userId).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % 2 === 0;
  }
}
```

#### Day 18-21: 종합 테스트
**작업 내용:**
- [ ] 단위 테스트 (90% 커버리지)
- [ ] 통합 테스트
- [ ] 성능 테스트
- [ ] A/B 테스트 결과 분석

### Week 4-5: 모니터링 시스템 구축 (2025-02-22 ~ 2025-03-07)

#### Week 4: 실시간 모니터링
**작업 내용:**
- [ ] PerformanceMonitor 클래스 구현
- [ ] 실시간 대시보드 구축
- [ ] 알림 시스템 구현

**PerformanceMonitor 구현:**
```javascript
// 새 파일: src/monitoring/performanceMonitor.js
class PerformanceMonitor {
  constructor(options = {}) {
    this.metrics = {
      totalRequests: 0,
      successfulExtractions: 0,
      averageProcessingTime: 0,
      accuracyRate: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
    
    this.thresholds = {
      maxProcessingTime: options.maxProcessingTime || 5000, // 5초
      minAccuracy: options.minAccuracy || 0.8, // 80%
      maxErrorRate: options.maxErrorRate || 0.05 // 5%
    };
    
    this.alertCallbacks = [];
  }
  
  recordExtraction(result, processingTime) {
    this.metrics.totalRequests++;
    
    if (result.success) {
      this.metrics.successfulExtractions++;
      this.updateAverageTime(processingTime);
      this.updateAccuracyRate(result.accuracy);
    }
    
    this.metrics.errorRate = this.calculateErrorRate();
    
    // 임계값 확인
    this.checkThresholds(result, processingTime);
    
    // 메트릭 저장 (시계열 데이터)
    this.saveTimeSeriesData({
      timestamp: new Date(),
      processingTime,
      accuracy: result.accuracy,
      dateCount: result.dates?.length || 0,
      success: result.success
    });
  }
  
  checkThresholds(result, processingTime) {
    const alerts = [];
    
    if (processingTime > this.thresholds.maxProcessingTime) {
      alerts.push({
        type: 'performance',
        message: `처리 시간 임계값 초과: ${processingTime}ms`,
        severity: 'warning'
      });
    }
    
    if (result.accuracy < this.thresholds.minAccuracy) {
      alerts.push({
        type: 'accuracy',
        message: `정확도 임계값 미달: ${result.accuracy}`,
        severity: 'critical'
      });
    }
    
    if (this.metrics.errorRate > this.thresholds.maxErrorRate) {
      alerts.push({
        type: 'error_rate',
        message: `오류율 임계값 초과: ${this.metrics.errorRate}`,
        severity: 'critical'
      });
    }
    
    // 알림 발송
    for (const alert of alerts) {
      this.sendAlert(alert);
    }
  }
  
  generateDashboardData() {
    return {
      realtime: this.metrics,
      trends: this.getRecentTrends(),
      alerts: this.getRecentAlerts(),
      performance: this.getPerformanceBreakdown()
    };
  }
}
```

#### Week 5: 품질 관리
**작업 내용:**
- [ ] 자동 테스트 케이스 생성
- [ ] 회귀 테스트 자동화
- [ ] 성능 벤치마크 자동화
- [ ] 품질 게이트 설정

### Week 6: 배포 준비 (2025-03-08 ~ 2025-03-15)

#### Day 36-42: 프로덕션 배포
**작업 내용:**
- [ ] 배포 스크립트 작성
- [ ] 롤백 계획 수립
- [ ] 사용자 가이드 작성
- [ ] 프로덕션 배포
- [ ] Phase 2 완료 보고서 작성

---

## 🧪 테스트 전략

### 단위 테스트 (90% 커버리지)
- [ ] TextProcessor 테스트
- [ ] PatternMatcher 테스트
- [ ] ContextValidator 테스트
- [ ] CacheManager 테스트
- [ ] PerformanceMonitor 테스트

### 통합 테스트
- [ ] SimplifiedDateExtractor 전체 플로우 테스트
- [ ] API 엔드포인트 테스트
- [ ] 캐시 동작 테스트
- [ ] 오류 처리 테스트

### 성능 테스트
- [ ] 부하 테스트 (동시 요청 100개)
- [ ] 메모리 사용량 테스트
- [ ] 캐시 효율성 테스트
- [ ] 응답 시간 벤치마크

### A/B 테스트
- [ ] 새 시스템 vs 기존 시스템 비교
- [ ] 정확도 비교
- [ ] 성능 비교
- [ ] 사용자 만족도 비교

---

## 📊 성공 지표 모니터링

### 실시간 KPI
1. **정확도**: 90% 이상 유지
2. **처리 시간**: 평균 2초 이하
3. **가용률**: 99.5% 이상
4. **캐시 적중률**: 70% 이상

### 주간 리포트
- 처리된 문서 수
- 평균 정확도 트렌드
- 성능 개선 효과
- 오류 패턴 분석

---

## 🚨 위험 요소 및 대응 방안

### 기술적 위험
1. **메모리 사용량 증가**
   - 대응: 캐시 크기 제한 및 TTL 설정
   - 모니터링: 실시간 메모리 사용량 추적

2. **캐시 일관성 문제**
   - 대응: 적절한 TTL 설정 및 무효화 전략
   - 검증: 캐시 정합성 테스트

3. **성능 저하**
   - 대응: 프로파일링 및 최적화
   - 백업: 기존 시스템 폴백

### 운영 위험
1. **배포 실패**
   - 대응: 단계적 배포 및 롤백 계획
   - 검증: 스테이징 환경 충분한 테스트

---

## 📝 체크리스트

### Week 1: 설계 및 기본 구현
- [ ] SimplifiedDateExtractor 아키텍처 설계 완료
- [ ] 핵심 컴포넌트 인터페이스 정의
- [ ] MedicalTextProcessor 구현 완료
- [ ] MedicalDatePatternMatcher 구현 완료
- [ ] DateResultFormatter 구현 완료

### Week 2: 고급 기능 구현
- [ ] ContextValidator 구현 완료
- [ ] CacheManager 구현 완료
- [ ] PerformanceMonitor 기본 구현
- [ ] ErrorHandler 구현 완료

### Week 3: 통합 및 테스트
- [ ] 기존 시스템과 통합 완료
- [ ] A/B 테스트 환경 구축
- [ ] 단위 테스트 90% 커버리지 달성
- [ ] 통합 테스트 완료

### Week 4-5: 모니터링 시스템
- [ ] 실시간 모니터링 대시보드 구축
- [ ] 알림 시스템 구현
- [ ] 자동 테스트 환경 구축
- [ ] 품질 게이트 설정

### Week 6: 배포 준비
- [ ] 프로덕션 배포 완료
- [ ] 성능 목표 달성 확인
- [ ] 사용자 가이드 작성
- [ ] Phase 2 완료 보고서 작성

### 최종 검증
- [ ] 정확도 90% 이상 달성
- [ ] 안정성 99.5% 이상 달성
- [ ] 처리 시간 목표 달성
- [ ] 모니터링 시스템 정상 동작

---

## 📋 다음 단계 (Phase 3 준비)

### Phase 3 준비 사항
- [ ] 의료 도메인 전문가 섭외
- [ ] 다양한 의료 문서 수집 및 분석
- [ ] 도메인 특화 로직 설계
- [ ] 자가 학습 시스템 설계

---

*Task 생성일: 2025-01-17*  
*선행 Task: TASK-2025-01-17-PHASE1-EMERGENCY-FIX*  
*다음 Task: TASK-2025-03-16-PHASE3-MEDICAL-SPECIALIZATION*