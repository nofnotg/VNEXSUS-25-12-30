# TASK-2025-01-17-PHASE1-EMERGENCY-FIX

## 📋 Task 개요

**Task ID**: TASK-2025-01-17-PHASE1-EMERGENCY-FIX  
**생성일**: 2025-01-17  
**우선순위**: 🔴 HIGH (긴급)  
**예상 기간**: 2주 (2025-01-17 ~ 2025-01-31)  
**담당자**: 백엔드 개발자 1명  

### 목표
현재 0% 정확도의 날짜 분류 시스템을 **즉시 사용 가능한 수준(70% 정확도)**으로 긴급 개선

### 성공 기준
- ✅ 정확도: 0% → 70% 이상
- ✅ 처리 시간: 현재 대비 50% 단축
- ✅ 비용: AI API 비용 80% 절감
- ✅ 안정성: 99% 이상 성공률

---

## 🎯 세부 작업 계획

### 1️⃣ 기본 정규식 패턴 수정 (3일)

#### Day 1: 패턴 분석 및 설계
**작업 내용:**
- [ ] Case1.txt 기반 현재 패턴 문제점 분석
- [ ] 의료 문서 특화 패턴 설계
- [ ] 우선순위 기반 패턴 체계 구축

**수정 대상 파일:**
- `src/dna-engine/core/enhancedDateAnchor.js` (line 25-45)
- `src/dna-engine/core/advancedTextArrayDateClassifier.js`

**새로운 패턴 설계:**
```javascript
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

**검증 기준:**
- Case1.txt에서 최소 60개 이상 날짜 추출
- 오탐지 5개 이하
- 기존 테스트 케이스 통과

#### Day 2: 패턴 구현 및 테스트
**작업 내용:**
- [ ] 새로운 패턴 구현
- [ ] 단위 테스트 작성
- [ ] Case1.txt 검증
- [ ] 성능 벤치마크

**테스트 스크립트:**
```javascript
// test-new-patterns.js
const { SimplifiedDateExtractor } = require('./src/dna-engine/core/simplifiedDateExtractor');
const fs = require('fs');

const extractor = new SimplifiedDateExtractor();
const case1Text = fs.readFileSync('./src/rag/case_sample/Case1.txt', 'utf-8');

const result = extractor.extractDates(case1Text);
console.log(`추출된 날짜 수: ${result.dates.length}`);
console.log(`정확도: ${result.accuracy}%`);
console.log(`처리 시간: ${result.processingTime}ms`);
```

#### Day 3: 배포 및 모니터링
**작업 내용:**
- [ ] 프로덕션 배포
- [ ] 실시간 성능 모니터링
- [ ] 롤백 계획 준비
- [ ] 사용자 피드백 수집

### 2️⃣ AI 의존성 제거 (2일)

#### Day 4: AI 호출 로직 제거
**작업 내용:**
- [ ] Claude/OpenAI 호출 코드 제거
- [ ] 규칙 기반 로직으로 대체
- [ ] 오류 처리 강화

**수정 대상 파일:**
- `src/dna-engine/core/advancedTextArrayDateClassifier.js` (line 640-720)
- `src/services/claudeService.js`
- `src/services/openaiService.js`

**구현 예시:**
```javascript
// 기존 AI 호출 제거
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
- [ ] 전체 시스템 통합 테스트
- [ ] 성능 벤치마크
- [ ] 안정성 검증
- [ ] 비용 절감 효과 측정

**검증 기준:**
- API 응답 시간 50% 단축
- 오류율 90% 감소
- 비용 80% 절감

### 3️⃣ 텍스트 전처리 개선 (2일)

#### Day 6: 전처리 로직 최적화
**작업 내용:**
- [ ] 불필요한 문자 제거 강화
- [ ] 날짜 형식 정규화
- [ ] 의료 용어 정리

**수정 대상 파일:**
- `src/dna-engine/core/textArrayDateControllerComplete.js` (line 100-120)

**구현 예시:**
```javascript
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
- [ ] 전처리 효과 검증
- [ ] 성능 최적화
- [ ] 문서화 업데이트
- [ ] Phase 1 완료 보고서 작성

---

## 🧪 테스트 계획

### 단위 테스트
- [ ] 새로운 정규식 패턴 테스트
- [ ] 전처리 로직 테스트
- [ ] 규칙 기반 분류 테스트

### 통합 테스트
- [ ] Case1.txt 전체 처리 테스트
- [ ] API 엔드포인트 테스트
- [ ] 성능 벤치마크 테스트

### 회귀 테스트
- [ ] 기존 기능 영향도 테스트
- [ ] 다른 문서 타입 호환성 테스트

---

## 📊 성공 지표 모니터링

### 실시간 모니터링 대상
1. **정확도**: 실시간 정확도 측정
2. **처리 시간**: API 응답 시간 추적
3. **오류율**: 시스템 오류 발생률
4. **비용**: AI API 호출 비용 추적

### 일일 리포트
- 처리된 문서 수
- 평균 정확도
- 평균 처리 시간
- 발생한 오류 수

---

## 🚨 위험 요소 및 대응 방안

### 기술적 위험
1. **정확도 목표 미달**
   - 대응: 패턴 추가 및 세밀 조정
   - 백업: 기존 시스템 롤백 준비

2. **성능 저하**
   - 대응: 코드 최적화 및 캐싱 적용
   - 모니터링: 실시간 성능 추적

3. **호환성 문제**
   - 대응: 점진적 배포 및 A/B 테스트
   - 검증: 다양한 문서 타입 테스트

### 일정 위험
1. **개발 지연**
   - 대응: 일일 진행 상황 점검
   - 백업: 핵심 기능 우선 구현

---

## 📝 체크리스트

### Day 1-3: 정규식 패턴 수정
- [ ] 현재 패턴 문제점 분석 완료
- [ ] 새로운 패턴 설계 완료
- [ ] 패턴 구현 및 테스트 완료
- [ ] Case1.txt 검증 통과
- [ ] 프로덕션 배포 완료

### Day 4-5: AI 의존성 제거
- [ ] Claude/OpenAI 호출 코드 제거
- [ ] 규칙 기반 로직 구현
- [ ] 통합 테스트 완료
- [ ] 성능 개선 확인
- [ ] 비용 절감 효과 측정

### Day 6-7: 전처리 개선
- [ ] 전처리 로직 최적화
- [ ] 의료 용어 정규화 구현
- [ ] 전체 시스템 검증
- [ ] 문서화 업데이트
- [ ] Phase 1 완료 보고서 작성

### 최종 검증
- [ ] 정확도 70% 이상 달성
- [ ] 처리 시간 50% 단축 달성
- [ ] 비용 80% 절감 달성
- [ ] 안정성 99% 이상 달성

---

## 📋 다음 단계 (Phase 2 준비)

### Phase 2 준비 사항
- [ ] SimplifiedDateExtractor 상세 설계
- [ ] 개발 팀 구성 및 역할 분담
- [ ] Phase 2 개발 환경 준비
- [ ] 모니터링 시스템 설계

---

*Task 생성일: 2025-01-17*  
*참조 문서: comprehensive-improvement-report.md, implementation-roadmap.md*  
*다음 Task: TASK-2025-02-01-PHASE2-SIMPLIFIED-EXTRACTOR*