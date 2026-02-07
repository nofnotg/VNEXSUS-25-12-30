# OCR 기반 의료 문서 처리 파이프라인 종합 개선 계획

## 📋 개요

**작성일**: 2026-01-31
**목적**: 사용자 피드백 기반 OCR 파이프라인 개선 및 Cycle 5 긍정적 요소 흡수
**목표**: 날짜 정확도 99.9%, 객관적 정보 제공, 효율적 사용자 경험

---

## 🎯 피드백 요약 및 개선 방향

### 1. 컨텍스트 기반 양식 인식 키워드 확장

**피드백**:
- 문서마다 표현 방식이 다를 수 있으며 날짜 양식도 다양함
- Keywords를 관용적으로 확장하여 이해 필요

**현재 문제**:
- 고정된 키워드 매칭으로 인한 낮은 커버리지
- 날짜 형식의 다양성 미처리

**개선 방향**:
- 키워드 시소러스(Thesaurus) 시스템 구축
- 날짜 형식 정규화 강화
- 동의어/유사어 자동 확장

**예시**:
```
기존: "진료일" 매칭만 수행
개선: "진료일", "내원일", "방문일", "진찰일", "검사일", "수진일" 등 모두 매칭

기존: "YYYY-MM-DD" 형식만 인식
개선: "YYYY.MM.DD", "YYYY/MM/DD", "YYYY년 MM월 DD일", "YY.M.D" 등 모두 정규화
```

---

### 2. 보험 심사 역할 배제 - 객관적 정보 제공

**피드백**:
- 시스템은 보험 심사 판단을 하지 않음
- 보험회사가 판단할 수 있도록 객관적 정보를 정확히 정리해서 제시
- 의견 전달 역할이지 판단 역할이 아님

**제거 사항**:
- "보험 청구 승인/거부 추천" 로직
- "고위험/저위험" 판정 시스템
- "사전질병 확정" 문구

**유지 사항**:
- 객관적 사실 나열 (날짜, 진단명, 검사 결과)
- 시간순 정보 정리
- 의료 기록 요약

**보고서 톤 변경**:
```
기존: "이 환자는 사전질병에 해당하므로 보험 청구가 거부될 가능성이 높습니다."
개선: "보험 가입일(YYYY-MM-DD) 3개월 이내인 YYYY-MM-DD에 해당 질환으로 진료 기록이 확인됩니다."
```

---

### 3. Cycle 5 개선 로직 흡수 발전

**피드백**:
- Cycle 5의 긍정적 접근법과 로직을 폐기하지 말고 흡수 발전
- LLM → OCR 전환에 맞춰 데이터 처리 과정 재설계
- 혁신성, 발전성, 현실성, 재현성, 안정성 고려

**Cycle 5의 긍정적 요소**:
1. **7-Phase 파이프라인**: 단계별 명확한 책임 분리
2. **Type-Based Scoring**: 도메인 특화 가중치 시스템
3. **Recency Scoring**: 시간 기반 우선순위
4. **Insurance Period Parser**: 보험 기간 파싱
5. **Document Metadata Filter**: 메타데이터 필터링
6. **Context Analysis**: 주변 컨텍스트 분석
7. **Noise Reduction**: 59% 노이즈 감소 성공

**OCR 전환 시 흡수 방안**:

#### 3.1 Phase 1: Date Range Validation (OCR 적응)
```javascript
// Cycle 5 로직 유지
function validateDateRange(date, referenceDate) {
  const age = calculateAge(date, referenceDate);
  if (age > 100) return { valid: false, reason: 'TOO_OLD' };
  if (age < -30) return { valid: false, reason: 'FUTURE_DATE' };
  return { valid: true };
}

// OCR 추가: BBox 기반 신뢰도
function validateWithOCR(date, ocrBlock) {
  const baseValidation = validateDateRange(date, new Date());
  if (!baseValidation.valid) return baseValidation;

  // OCR 신뢰도 추가 검증
  if (ocrBlock.confidence < 0.7) {
    return { valid: false, reason: 'LOW_OCR_CONFIDENCE' };
  }

  return { valid: true, confidence: ocrBlock.confidence };
}
```

#### 3.2 Phase 2-7: Type-Based Scoring + OCR Context
```javascript
// Cycle 5의 스코어링 시스템 유지 + OCR BBox 컨텍스트 추가
function calculateScore(date, ocrBlock, surroundingBlocks) {
  let score = 0;

  // Cycle 5 로직 흡수
  score += getTypeScore(date.type);           // 60-100점
  score += getRecencyScore(date.value);       // 20-50점
  score += getFrequencyBonus(date.value);     // 10-20점

  // OCR 신뢰도 반영
  score += ocrBlock.confidence * 10;          // 0-10점

  // BBox 기반 컨텍스트 분석 (등고선 개념 적용)
  score += analyzeProximityContext(ocrBlock, surroundingBlocks); // -25 ~ +25점

  return score;
}
```

**재현성 보장**:
- 동일 입력 → 동일 출력 보장
- OCR 엔진 버전 고정
- 난수 제거, 결정론적 알고리즘 사용

**안정성 강화**:
- OCR 실패 시 폴백 메커니즘
- 단계별 에러 핸들링
- 부분 실패 허용 (일부 날짜 추출 실패해도 전체 프로세스 계속)

---

### 4. GT Coverage 재평가 - 의료 데이터 중심

**피드백**:
- 보험 정보는 검증 파일에 없었으나 완료보고서에 포함됨
- 의료 데이터에 한정하여 Coverage 재평가
- 보험 가입 내용은 사용자 입력으로 처리
- 입력 일자 기준 3개월/5년 이내 필터링
- 날짜 데이터 정확도 목표: 99.9%

**구현 계획**:

#### 4.1 GT Coverage 재계산 로직
```javascript
class MedicalGTCoverageEvaluator {
  constructor() {
    this.excludeCategories = ['보험정보', '보험기간', '보험가입일'];
  }

  evaluateCoverage(extractedDates, groundTruth, userInputDate) {
    // 1. 보험 정보 제외
    const medicalGT = groundTruth.filter(
      item => !this.excludeCategories.includes(item.category)
    );

    // 2. 날짜 범위 필터링 (3개월/5년)
    const filteredDates = this.filterByDateRange(
      extractedDates,
      userInputDate
    );

    // 3. Coverage 계산
    const matched = this.findMatches(filteredDates, medicalGT);
    const coverage = (matched.length / medicalGT.length) * 100;

    // 4. 99.9% 목표 검증
    return {
      coverage: coverage,
      target: 99.9,
      achieved: coverage >= 99.9,
      medicalGTCount: medicalGT.length,
      matchedCount: matched.length,
      missedDates: this.findMissed(filteredDates, medicalGT)
    };
  }

  filterByDateRange(dates, referenceDate) {
    const threeMonthsAgo = new Date(referenceDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const fiveYearsAgo = new Date(referenceDate);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    return dates.map(date => ({
      ...date,
      within3Months: date.value >= threeMonthsAgo,
      within5Years: date.value >= fiveYearsAgo
    }));
  }
}
```

#### 4.2 사용자 입력 보험 정보 통합
```javascript
class InsuranceInputHandler {
  processUserInput(insuranceData) {
    return {
      policyNumber: insuranceData.policyNumber,
      startDate: insuranceData.startDate,
      endDate: insuranceData.endDate,
      coverageType: insuranceData.coverageType,
      // 3개월/5년 기준 계산
      threeMonthsThreshold: this.addMonths(insuranceData.startDate, 3),
      fiveYearsThreshold: this.addYears(insuranceData.startDate, 5)
    };
  }

  highlightRelevantDates(medicalDates, insuranceInput) {
    return medicalDates.map(date => ({
      ...date,
      relevance: {
        within3Months: date.value < insuranceInput.threeMonthsThreshold,
        within5Years: date.value < insuranceInput.fiveYearsThreshold,
        priority: this.calculatePriority(date, insuranceInput)
      }
    }));
  }
}
```

**효율성 제공**:
- 수십~백 장 의료 문서를 5분 내 처리
- 날짜 중심 정렬로 빠른 검토 가능
- 관련 날짜 하이라이트 제공

---

### 5. DNA 분석 결과 보류

**피드백**:
- DNA 시퀀싱은 보류된 로직
- 항목보고서에서 DNA 분석 제외

**구현**:
```javascript
class ItemCategoryClassifier {
  constructor() {
    this.excludedCategories = [
      'DNA_SEQUENCING',
      'GENETIC_ANALYSIS'
    ];

    this.activeCategories = [
      'VISIT_DATE',           // 내원일
      'DIAGNOSIS',            // 진단명
      'PRESCRIPTION',         // 처방
      'LAB_TEST',            // 검사
      'IMAGING',             // 영상
      'PROCEDURE',           // 시술/수술
      'ADMISSION',           // 입원
      'DISCHARGE',           // 퇴원
      'EMERGENCY',           // 응급
      // 'DNA_ANALYSIS' - 제외
    ];
  }

  classifyItem(item) {
    // DNA 관련 키워드 발견 시 무시
    if (this.isDNARelated(item.text)) {
      return null;
    }

    return this.findCategory(item);
  }

  isDNARelated(text) {
    const dnaKeywords = [
      'DNA', 'DNA시퀀싱', '유전자분석', 'Genetic sequencing',
      '염기서열분석', 'NGS', 'Next Generation Sequencing'
    ];

    return dnaKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }
}
```

---

### 6. 날짜 데이터 정렬 및 표기 형식 개선

**피드백**:
- 날짜 데이터 오름차순 정리
- 내원일시 중복 표기 제거
- 새로운 표기 형식: "1. yyyy.mm.dd: 내원일"
- 항목보고서는 내원경위부터 정돈

**구현**:

#### 6.1 날짜 정렬 및 넘버링
```javascript
class DateReportFormatter {
  formatDateTimeline(medicalEvents) {
    // 1. 날짜 기준 오름차순 정렬
    const sorted = medicalEvents.sort((a, b) =>
      new Date(a.visitDate) - new Date(b.visitDate)
    );

    // 2. 중복 날짜 그룹핑
    const grouped = this.groupByDate(sorted);

    // 3. 포맷팅
    return grouped.map((group, index) =>
      this.formatDateGroup(group, index + 1)
    );
  }

  formatDateGroup(group, index) {
    const date = this.formatDate(group.date); // "yyyy.mm.dd"

    return {
      number: index,
      dateLabel: `${index}. ${date}: 내원일`,
      events: group.events.map(event =>
        this.formatEvent(event) // 내원일시 제외, 내원경위부터 시작
      )
    };
  }

  formatEvent(event) {
    // 내원일시는 날짜 레이블에 포함되었으므로 제외
    return {
      // visitDateTime: event.visitDateTime,  // 제거
      visitReason: event.visitReason,         // 내원경위 (시작)
      chiefComplaint: event.chiefComplaint,   // 주소
      diagnosis: event.diagnosis,             // 진단
      treatment: event.treatment,             // 처치
      prescription: event.prescription        // 처방
    };
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
  }

  groupByDate(events) {
    const groups = {};

    events.forEach(event => {
      const dateKey = event.visitDate.split('T')[0]; // ISO date만 추출

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          events: []
        };
      }

      groups[dateKey].events.push(event);
    });

    return Object.values(groups);
  }
}
```

#### 6.2 보고서 예시
```markdown
## 날짜별 의료 이력

1. 2023.01.15: 내원일
   - 내원경위: 두통 및 어지러움 증상으로 내원
   - 주소: 두통, 어지러움
   - 진단: R51 두통, R42 어지러움
   - 처치: 혈압 측정, 신경학적 검사
   - 처방: 진통제 (아세트아미노펜 500mg)

2. 2023.02.20: 내원일
   - 내원경위: 증상 지속으로 재내원
   - 주소: 두통 지속
   - 진단: G43.9 편두통
   - 처치: MRI 검사
   - 처방: 편두통 치료제 (수마트립탄 50mg)

3. 2023.02.20: 내원일
   - 내원경위: MRI 검사 결과 확인
   - 주소: 검사 결과 상담
   - 진단: 이상 소견 없음
   - 처치: 결과 설명
   - 처방: 기존 처방 유지
```

---

### 7. 진단병명 표기 형식 통일

**피드백**:
- "ICD/KCD코드 한글 영문" 순서로 병기
- 한글을 먼저 배치

**구현**:
```javascript
class DiagnosisFormatter {
  formatDiagnosis(diagnosisData) {
    // 1. ICD/KCD 코드 추출
    const code = diagnosisData.code; // 예: "M54.5"

    // 2. 한글명 추출
    const korean = diagnosisData.nameKorean; // 예: "요통"

    // 3. 영문명 추출
    const english = diagnosisData.nameEnglish; // 예: "Low back pain"

    // 4. 형식 통일: "코드 한글 영문"
    return `${code} ${korean} ${english}`;
  }

  formatMultipleDiagnoses(diagnoses) {
    return diagnoses.map((dx, index) => ({
      order: index + 1,
      formatted: this.formatDiagnosis(dx),
      // 예시: "M54.5 요통 Low back pain"
    }));
  }

  // 예외 처리: 한글 또는 영문 누락 시
  formatWithFallback(diagnosisData) {
    const code = diagnosisData.code;
    const korean = diagnosisData.nameKorean || '-';
    const english = diagnosisData.nameEnglish || '-';

    return `${code} ${korean} ${english}`;
  }
}
```

**예시**:
```
기존: "Low back pain (M54.5, 요통)"
개선: "M54.5 요통 Low back pain"

기존: "J06.9, Acute upper respiratory infection, 급성 상기도 감염"
개선: "J06.9 급성 상기도 감염 Acute upper respiratory infection"
```

---

### 8. 종합 결론 - 의견 제시, 판단 금지

**피드백**:
- 종합 결론은 의견 제시
- 판단은 절대 금지

**개선 사항**:

#### 8.1 금지 표현
```javascript
const PROHIBITED_JUDGMENTS = [
  '승인/거부 추천',
  '고위험/저위험 판정',
  '사전질병 확정',
  '보험금 지급 가능/불가',
  '청구 타당성 평가',
  '보상 범위 결정'
];
```

#### 8.2 허용 표현
```javascript
const ALLOWED_OPINIONS = [
  '시간순 정리',
  '날짜 관계 명시',
  '의료 기록 요약',
  '객관적 사실 나열',
  '정보 제시',
  '참고 사항 안내'
];
```

#### 8.3 결론 생성 템플릿
```javascript
class ConclusionGenerator {
  generateObjectiveConclusion(medicalData, insuranceInput) {
    return {
      summary: this.summarizeFacts(medicalData),
      timeline: this.createTimeline(medicalData),
      dateRelationship: this.analyzeDateRelationship(
        medicalData,
        insuranceInput
      ),
      // 판단 제외
      // recommendation: this.makeJudgment()  // 삭제
    };
  }

  summarizeFacts(data) {
    return {
      totalVisits: data.visits.length,
      dateRange: {
        earliest: data.visits[0].date,
        latest: data.visits[data.visits.length - 1].date
      },
      diagnoses: data.diagnoses.map(d => this.formatDiagnosis(d)),
      procedures: data.procedures.map(p => p.name)
    };
  }

  analyzeDateRelationship(medicalData, insuranceInput) {
    const startDate = new Date(insuranceInput.startDate);

    return medicalData.visits.map(visit => {
      const visitDate = new Date(visit.date);
      const daysDiff = Math.floor(
        (visitDate - startDate) / (1000 * 60 * 60 * 24)
      );

      return {
        visitDate: visit.date,
        relationToInsurance: {
          daysFromStart: daysDiff,
          within3Months: daysDiff <= 90,
          within5Years: daysDiff <= 1825
        },
        // 판단 없이 사실만 제시
        note: daysDiff <= 90
          ? '보험 가입 후 3개월 이내 내원 기록'
          : '보험 가입 후 3개월 이후 내원 기록'
        // 제거: recommendation: "청구 불가" 같은 판단
      };
    });
  }
}
```

#### 8.4 결론 예시
```markdown
# 종합 정보

## 의료 이력 요약
- 총 내원 횟수: 15회
- 최초 내원일: 2022.03.15
- 최근 내원일: 2023.11.20
- 주요 진단명: M54.5 요통 Low back pain, J06.9 급성 상기도 감염 Acute upper respiratory infection

## 보험 가입일 기준 날짜 관계
- 보험 가입일: 2023.01.01

### 3개월 이내 (2023.01.01 ~ 2023.04.01)
- 2023.01.15: 내원 (가입 후 14일)
- 2023.02.20: 내원 (가입 후 50일)
- 2023.03.10: 내원 (가입 후 68일)

### 5년 이내 (2018.01.01 ~ 2023.01.01)
- 2022.03.15: 내원 (가입 전 291일)
- 2022.07.20: 내원 (가입 전 165일)
- 2022.11.05: 내원 (가입 전 57일)

## 참고사항
- 보험 가입 전후 진단명 변화 없음
- 지속적 치료 기록 확인됨
- 모든 날짜 정보는 의료 문서에서 추출된 객관적 기록임

(판단이나 추천 내용 없음)
```

---

### 9. 항목 분류기 등고선 개념 도입

**피드백**:
- 3D 지도의 봉우리 찾기 비유
- 키워드 포인트를 찾으면 주변 컨텍스트를 이해하여 flow 확인
- 등고선 개념: 가중치/연관성 기준으로 주변 확장

**개념 설명**:
```
산 정상 (키워드 정확 매칭)          ← 가중치 1.0
  ↓
중턱 (유사 키워드, 근접 컨텍스트)   ← 가중치 0.7
  ↓
산기슭 (관련 영역, 동일 섹션)       ← 가중치 0.4
  ↓
평지 (무관한 영역)                  ← 가중치 0.0
```

**구현**:

#### 9.1 등고선 가중치 시스템
```javascript
class ContourWeightClassifier {
  constructor() {
    // 등고선 레벨 정의
    this.contourLevels = {
      PEAK: { weight: 1.0, color: '#FF0000', name: '정상' },      // 정확 매칭
      HIGH: { weight: 0.8, color: '#FF8800', name: '고지' },      // 강한 연관
      MID: { weight: 0.6, color: '#FFFF00', name: '중턱' },       // 중간 연관
      LOW: { weight: 0.4, color: '#88FF88', name: '기슭' },       // 약한 연관
      PLAIN: { weight: 0.2, color: '#0088FF', name: '평지' }      // 무관
    };

    // 키워드 계층 구조
    this.keywordHierarchy = {
      '내원일': {
        peak: ['내원일', '내원일시'],
        high: ['방문일', '진료일', '진찰일'],
        mid: ['검사일', '수진일', '접수일'],
        low: ['예약일', '등록일']
      },
      '진단명': {
        peak: ['진단명', '진단'],
        high: ['질병명', '병명', '상병명'],
        mid: ['소견', '판정'],
        low: ['증상', '주소']
      }
    };
  }

  findKeywordPeak(ocrBlocks, category) {
    const hierarchy = this.keywordHierarchy[category];

    // 1. 정상(Peak) 찾기
    const peaks = this.findBlocks(ocrBlocks, hierarchy.peak);

    if (peaks.length > 0) {
      // 2. 정상 주변 등고선 따라 내려가기
      return peaks.map(peak =>
        this.expandFromPeak(peak, ocrBlocks, hierarchy)
      );
    }

    // 3. 정상 없으면 고지대부터 탐색
    return this.searchFromHighlands(ocrBlocks, hierarchy);
  }

  expandFromPeak(peakBlock, allBlocks, hierarchy) {
    const contours = {
      peak: [peakBlock],
      high: [],
      mid: [],
      low: [],
      plain: []
    };

    // BBox 기반 근접도 계산
    const nearbyBlocks = this.findNearbyBlocks(
      peakBlock,
      allBlocks,
      maxDistance: 100  // 픽셀
    );

    // 각 블록을 등고선 레벨로 분류
    nearbyBlocks.forEach(block => {
      const level = this.classifyContourLevel(
        block,
        peakBlock,
        hierarchy
      );
      contours[level].push(block);
    });

    return contours;
  }

  classifyContourLevel(block, peakBlock, hierarchy) {
    // 1. 키워드 매칭 레벨
    const keywordLevel = this.getKeywordLevel(block.text, hierarchy);

    // 2. 거리 기반 레벨
    const distanceLevel = this.getDistanceLevel(block, peakBlock);

    // 3. 컨텍스트 일치도
    const contextLevel = this.getContextLevel(block, peakBlock);

    // 4. 종합 점수로 레벨 결정
    const avgWeight = (
      keywordLevel.weight +
      distanceLevel.weight +
      contextLevel.weight
    ) / 3;

    return this.weightToLevel(avgWeight);
  }

  getKeywordLevel(text, hierarchy) {
    if (hierarchy.peak.some(kw => text.includes(kw))) {
      return this.contourLevels.PEAK;
    }
    if (hierarchy.high.some(kw => text.includes(kw))) {
      return this.contourLevels.HIGH;
    }
    if (hierarchy.mid.some(kw => text.includes(kw))) {
      return this.contourLevels.MID;
    }
    if (hierarchy.low.some(kw => text.includes(kw))) {
      return this.contourLevels.LOW;
    }
    return this.contourLevels.PLAIN;
  }

  getDistanceLevel(block, peakBlock) {
    const distance = this.calculateBBoxDistance(block.bbox, peakBlock.bbox);

    // 거리에 따른 가중치 감소 (등고선처럼)
    if (distance < 20) return this.contourLevels.PEAK;
    if (distance < 50) return this.contourLevels.HIGH;
    if (distance < 100) return this.contourLevels.MID;
    if (distance < 200) return this.contourLevels.LOW;
    return this.contourLevels.PLAIN;
  }

  getContextLevel(block, peakBlock) {
    // 같은 라인/단락에 있으면 높은 가중치
    if (this.isSameLine(block, peakBlock)) {
      return this.contourLevels.HIGH;
    }
    if (this.isSameParagraph(block, peakBlock)) {
      return this.contourLevels.MID;
    }
    if (this.isSameSection(block, peakBlock)) {
      return this.contourLevels.LOW;
    }
    return this.contourLevels.PLAIN;
  }

  calculateBBoxDistance(bbox1, bbox2) {
    // 두 BBox 중심점 간 유클리드 거리
    const center1 = {
      x: bbox1.Left + bbox1.Width / 2,
      y: bbox1.Top + bbox1.Height / 2
    };
    const center2 = {
      x: bbox2.Left + bbox2.Width / 2,
      y: bbox2.Top + bbox2.Height / 2
    };

    return Math.sqrt(
      Math.pow(center1.x - center2.x, 2) +
      Math.pow(center1.y - center2.y, 2)
    );
  }

  findNearbyBlocks(centerBlock, allBlocks, maxDistance) {
    return allBlocks.filter(block => {
      if (block === centerBlock) return false;

      const distance = this.calculateBBoxDistance(
        centerBlock.bbox,
        block.bbox
      );

      return distance <= maxDistance;
    });
  }
}
```

#### 9.2 Flow 확인 시스템
```javascript
class ContextFlowAnalyzer {
  analyzeFlow(contours, category) {
    // 등고선 레벨별로 정보 추출
    const flow = {
      anchor: this.extractFromContour(contours.peak, category),
      supporting: this.extractFromContour(contours.high, category),
      related: this.extractFromContour(contours.mid, category),
      peripheral: this.extractFromContour(contours.low, category)
    };

    // Flow 검증: 정상 → 기슭으로 갈수록 일관성 확인
    const isConsistent = this.validateFlowConsistency(flow);

    return {
      flow,
      consistent: isConsistent,
      confidence: this.calculateFlowConfidence(flow)
    };
  }

  extractFromContour(blocks, category) {
    // 카테고리별 추출 로직
    switch(category) {
      case '내원일':
        return this.extractVisitInfo(blocks);
      case '진단명':
        return this.extractDiagnosis(blocks);
      case '처방':
        return this.extractPrescription(blocks);
      default:
        return this.extractGeneric(blocks);
    }
  }

  validateFlowConsistency(flow) {
    // 예: 내원일 flow에서 날짜 일관성 확인
    // peak에서 "2023-01-15" 발견
    // → high/mid에서도 같은 날짜 또는 관련 시간 정보 있어야 함

    const anchorDate = flow.anchor.date;
    if (!anchorDate) return false;

    const supportingMentions = flow.supporting.filter(item =>
      this.mentionsDate(item, anchorDate)
    );

    return supportingMentions.length > 0;
  }
}
```

#### 9.3 시각화 (선택사항)
```javascript
class ContourVisualizer {
  visualizeContours(contours) {
    return {
      type: 'heatmap',
      data: contours.map(c => ({
        x: c.block.bbox.Left,
        y: c.block.bbox.Top,
        weight: c.level.weight,
        color: c.level.color,
        label: c.level.name
      })),
      // 등고선 시각화: 빨강(정상) → 파랑(평지)
    };
  }
}
```

**효과**:
1. **정확도 향상**: 키워드 정확 매칭 실패해도 주변 컨텍스트로 복구
2. **유연성**: 문서 형식 변화에 강건함
3. **신뢰도 정량화**: 가중치로 신뢰도 명확히 표현
4. **디버깅 용이**: 등고선 시각화로 분류 과정 이해 쉬움

---

### 10. 원문 보존 - 접기/펴기 옵션

**피드백**:
- 보고서 제공 + 원문 보기 옵션 추가
- 접기/펴기 또는 옵션 버튼
- 원문 페이지 띄우기 등의 주석/링크 옵션

**구현**:

#### 10.1 데이터 구조
```javascript
class ReportWithSourceReference {
  constructor() {
    this.report = {
      summary: {},
      events: [],
      conclusions: []
    };

    this.sourceReferences = {
      // 각 항목에 원문 참조 정보 추가
    };
  }

  addEventWithSource(event, sourceInfo) {
    const eventId = this.generateEventId();

    // 보고서 이벤트 추가
    this.report.events.push({
      id: eventId,
      ...event
    });

    // 원문 참조 정보 추가
    this.sourceReferences[eventId] = {
      pdfPage: sourceInfo.page,
      pdfFile: sourceInfo.filename,
      ocrBlocks: sourceInfo.blocks,
      boundingBoxes: sourceInfo.bboxes,
      confidence: sourceInfo.confidence,
      rawText: sourceInfo.rawText
    };
  }

  getSourceReference(eventId) {
    return this.sourceReferences[eventId];
  }
}
```

#### 10.2 UI 컴포넌트 (Markdown 형식)
```markdown
## 1. 2023.01.15: 내원일

**내원경위**: 두통 및 어지러움 증상으로 내원

<details>
<summary>📄 원문 보기</summary>

### 원문 정보
- **문서**: 진료기록부_20230115.pdf
- **페이지**: 3
- **신뢰도**: 95.2%

### 추출된 원문
```
2023년 01월 15일

【 내원 경위 】
환자는 3일 전부터 지속되는 두통과 어지러움을 주소로 내원하였음.
특히 아침에 증상이 심하며, 구토는 동반하지 않음.
```

[📎 PDF 페이지 보기](link://page=3)
[🔍 OCR 상세 보기](link://ocr-detail&event=evt_001)

</details>

---

**주소**: 두통, 어지러움

<details>
<summary>📄 원문 보기</summary>

### 원문 정보
- **문서**: 진료기록부_20230115.pdf
- **페이지**: 3
- **신뢰도**: 92.8%

### 추출된 원문
```
【 주소 (Chief Complaint) 】
- 두통 (Headache)
- 어지러움 (Dizziness)
```

[📎 PDF 페이지 보기](link://page=3)

</details>

---

**진단**: M54.5 요통 Low back pain

<details>
<summary>📄 원문 보기</summary>

### 원문 정보
- **문서**: 진료기록부_20230115.pdf
- **페이지**: 4
- **신뢰도**: 98.1%

### 추출된 원문
```
【 진단명 】
상병코드: M54.5
상병명: 요통 (Low back pain)
```

[📎 PDF 페이지 보기](link://page=4)

</details>
```

#### 10.3 HTML 구현 예시
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .event-item {
      margin: 20px 0;
      padding: 15px;
      border-left: 3px solid #4CAF50;
      background: #f9f9f9;
    }

    .source-toggle {
      margin-top: 10px;
      cursor: pointer;
      color: #2196F3;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .source-toggle:hover {
      text-decoration: underline;
    }

    .source-content {
      display: none;
      margin-top: 10px;
      padding: 10px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .source-content.expanded {
      display: block;
    }

    .confidence-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.9em;
      font-weight: bold;
    }

    .confidence-high {
      background: #4CAF50;
      color: white;
    }

    .confidence-medium {
      background: #FF9800;
      color: white;
    }

    .source-actions {
      margin-top: 10px;
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 5px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-primary {
      background: #2196F3;
      color: white;
    }

    .btn-secondary {
      background: #9E9E9E;
      color: white;
    }
  </style>
</head>
<body>
  <div class="event-item">
    <h3>1. 2023.01.15: 내원일</h3>

    <div>
      <strong>내원경위:</strong> 두통 및 어지러움 증상으로 내원

      <div class="source-toggle" onclick="toggleSource('source-1')">
        <span class="icon">📄</span>
        <span class="text">원문 보기</span>
        <span class="confidence-badge confidence-high">신뢰도 95.2%</span>
      </div>

      <div id="source-1" class="source-content">
        <h4>원문 정보</h4>
        <ul>
          <li><strong>문서:</strong> 진료기록부_20230115.pdf</li>
          <li><strong>페이지:</strong> 3</li>
          <li><strong>좌표:</strong> x: 120, y: 450</li>
        </ul>

        <h4>추출된 원문</h4>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
2023년 01월 15일

【 내원 경위 】
환자는 3일 전부터 지속되는 두통과 어지러움을 주소로 내원하였음.
특히 아침에 증상이 심하며, 구토는 동반하지 않음.
        </pre>

        <div class="source-actions">
          <button class="btn btn-primary" onclick="openPdfPage(3)">
            📎 PDF 페이지 열기
          </button>
          <button class="btn btn-secondary" onclick="showOcrDetail('evt_001')">
            🔍 OCR 상세 보기
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    function toggleSource(id) {
      const element = document.getElementById(id);
      element.classList.toggle('expanded');
    }

    function openPdfPage(pageNumber) {
      // PDF 뷰어로 해당 페이지 열기
      window.open(`/pdf-viewer?page=${pageNumber}`, '_blank');
    }

    function showOcrDetail(eventId) {
      // OCR 상세 정보 모달 표시
      window.open(`/ocr-detail?event=${eventId}`, '_blank');
    }
  </script>
</body>
</html>
```

#### 10.4 API 엔드포인트
```javascript
// Express.js 라우터
router.get('/api/report/:reportId/source/:eventId', async (req, res) => {
  const { reportId, eventId } = req.params;

  try {
    const sourceRef = await reportService.getSourceReference(
      reportId,
      eventId
    );

    res.json({
      success: true,
      data: {
        pdfFile: sourceRef.pdfFile,
        page: sourceRef.pdfPage,
        boundingBoxes: sourceRef.boundingBoxes,
        rawText: sourceRef.rawText,
        confidence: sourceRef.confidence,
        ocrBlocks: sourceRef.ocrBlocks
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/api/pdf/:filename/page/:pageNum', async (req, res) => {
  const { filename, pageNum } = req.params;

  // PDF 페이지 이미지 생성 및 반환
  const pageImage = await pdfService.renderPage(filename, pageNum);

  res.setHeader('Content-Type', 'image/png');
  res.send(pageImage);
});
```

**효과**:
1. **신뢰성**: 사용자가 원문 직접 확인 가능
2. **투명성**: 추출 과정 공개
3. **검증 용이**: 오류 발견 시 빠른 수정
4. **사용자 경험**: 필요할 때만 원문 확인 (접기 상태가 기본)

---

## 📊 개선 효과 예측

### 정량적 목표

| 항목 | 현재 (Cycle 5) | 목표 (개선 후) | 개선율 |
|------|---------------|---------------|--------|
| GT Coverage (의료 데이터) | 57% | **99.9%** | +75% |
| Precision | 24% | **95%** | +296% |
| Date Accuracy | - | **99.9%** | - |
| 처리 시간 (100페이지) | - | **5분 이내** | - |
| 사용자 만족도 | - | **4.5/5.0** | - |

### 정성적 효과

1. **신뢰성 향상**: 99.9% 날짜 정확도로 의료 기록 신뢰 가능
2. **효율성 증대**: 수십~백 장 문서를 5분 내 검토
3. **객관성 확보**: 판단 제거로 공정한 정보 제공
4. **유연성 확보**: 다양한 문서 형식 대응
5. **투명성 강화**: 원문 참조로 검증 가능

---

## 🗓️ 구현 로드맵

### Phase 1: 핵심 개선 (2주)

**목표**: 날짜 정확도 및 보고서 형식 개선

1. **컨텍스트 기반 양식 인식 키워드 확장** (3일)
   - 키워드 시소러스 구축
   - 날짜 형식 정규화 강화

2. **보고서 형식 개선** (4일)
   - 날짜 정렬 및 넘버링
   - 진단병명 표기 통일
   - 내원일시 중복 제거

3. **보험 심사 역할 배제** (2일)
   - 판단 로직 제거
   - 객관적 결론 템플릿 적용

4. **DNA 분석 제외** (1일)
   - DNA 관련 카테고리 비활성화

**완료 기준**:
- 날짜 정확도 90% 이상
- 보고서 형식 100% 적용
- 판단 문구 0건

---

### Phase 2: 고급 기능 (4주)

**목표**: 등고선 개념 및 OCR 최적화

1. **항목 분류기 등고선 시스템** (2주)
   - ContourWeightClassifier 구현
   - ContextFlowAnalyzer 구현
   - 가중치 튜닝

2. **GT Coverage 재평가 시스템** (1주)
   - 보험 정보 제외 로직
   - 3개월/5년 필터링
   - 재평가 메트릭

3. **Cycle 5 로직 흡수** (1주)
   - 7-Phase 파이프라인 OCR 적응
   - Type-Based Scoring + OCR 신뢰도
   - Noise Reduction 통합

**완료 기준**:
- GT Coverage 95% 이상 (의료 데이터)
- 등고선 시스템 정상 작동
- Cycle 5 긍정 요소 100% 흡수

---

### Phase 3: 사용자 경험 (2주)

**목표**: 원문 참조 및 최종 마무리

1. **원문 보기 기능** (1주)
   - 접기/펴기 UI 구현
   - PDF 페이지 링크
   - OCR 상세 보기

2. **종합 테스트 및 튜닝** (1주)
   - 전체 시스템 통합 테스트
   - 성능 최적화
   - 사용자 피드백 반영

**완료 기준**:
- 원문 참조 기능 100% 작동
- 전체 목표 달성 (99.9% 날짜 정확도)
- 사용자 만족도 4.5/5.0 이상

---

## 📁 산출물

### 문서
1. `feedback-driven-improvement-plan.md` (본 문서)
2. `contour-weight-system-design.md` - 등고선 시스템 상세 설계
3. `date-accuracy-evaluation-report.md` - 날짜 정확도 평가 보고서
4. `api-documentation.md` - API 문서 업데이트

### 코드
1. `KeywordThesaurus.js` - 키워드 시소러스
2. `DateReportFormatter.js` - 날짜 보고서 포맷터
3. `DiagnosisFormatter.js` - 진단병명 포맷터
4. `ConclusionGenerator.js` - 객관적 결론 생성기
5. `ContourWeightClassifier.js` - 등고선 가중치 분류기
6. `ContextFlowAnalyzer.js` - 컨텍스트 흐름 분석기
7. `MedicalGTCoverageEvaluator.js` - GT Coverage 재평가기
8. `ReportWithSourceReference.js` - 원문 참조 보고서
9. `InsuranceInputHandler.js` - 보험 입력 처리기

### 테스트
1. `keyword-expansion.test.js` - 키워드 확장 테스트
2. `date-formatting.test.js` - 날짜 포맷 테스트
3. `contour-classifier.test.js` - 등고선 분류기 테스트
4. `gt-coverage.test.js` - GT Coverage 테스트
5. `source-reference.test.js` - 원문 참조 테스트

---

## ✅ 검증 기준

### 자동 검증
```javascript
class FeedbackImprovementValidator {
  validate(system) {
    const results = {
      feedback1: this.validateKeywordExpansion(system),
      feedback2: this.validateNoJudgment(system),
      feedback3: this.validateCycle5Absorption(system),
      feedback4: this.validateGTCoverage(system),
      feedback5: this.validateNoDNA(system),
      feedback6: this.validateDateFormat(system),
      feedback7: this.validateDiagnosisFormat(system),
      feedback8: this.validateObjectiveConclusion(system),
      feedback9: this.validateContourSystem(system),
      feedback10: this.validateSourceReference(system)
    };

    const passCount = Object.values(results).filter(r => r.passed).length;
    const totalCount = Object.keys(results).length;

    return {
      passed: passCount === totalCount,
      score: (passCount / totalCount) * 100,
      details: results
    };
  }

  validateKeywordExpansion(system) {
    const testCases = [
      { input: '진료일', expected: ['진료일', '내원일', '방문일'] },
      { input: '2023-01-15', expected: ['2023.01.15', '2023/01/15'] }
    ];

    const results = testCases.map(tc =>
      system.expandKeyword(tc.input).length >= tc.expected.length
    );

    return {
      passed: results.every(r => r),
      details: 'Keyword expansion working correctly'
    };
  }

  validateNoJudgment(system) {
    const prohibitedTerms = [
      '승인', '거부', '추천', '판정', '확정', '불가', '타당'
    ];

    const conclusion = system.generateConclusion();
    const hasProhibited = prohibitedTerms.some(term =>
      conclusion.includes(term)
    );

    return {
      passed: !hasProhibited,
      details: hasProhibited
        ? `Found prohibited judgment terms`
        : 'No judgment terms found'
    };
  }

  validateGTCoverage(system) {
    const coverage = system.evaluateGTCoverage();

    return {
      passed: coverage.medicalOnly && coverage.value >= 99.0,
      details: `GT Coverage: ${coverage.value}% (Medical data only: ${coverage.medicalOnly})`
    };
  }

  validateContourSystem(system) {
    const testBlock = { text: '진료일', bbox: { Left: 0, Top: 0 } };
    const contours = system.findContours(testBlock);

    return {
      passed: contours.peak.length > 0 && contours.high.length >= 0,
      details: `Contour levels: ${Object.keys(contours).length}`
    };
  }

  validateSourceReference(system) {
    const report = system.generateReport();
    const hasSourceRefs = report.events.every(event =>
      event.sourceReference !== undefined
    );

    return {
      passed: hasSourceRefs,
      details: `All events have source references: ${hasSourceRefs}`
    };
  }
}
```

---

## 🎯 성공 지표

### 필수 달성 (Must Have)
- ✅ 날짜 정확도 99.9% 이상
- ✅ 보험 심사 판단 문구 0건
- ✅ GT Coverage 99% 이상 (의료 데이터만)
- ✅ DNA 분석 항목 제외
- ✅ 날짜 오름차순 정렬
- ✅ 진단병명 표기 형식 통일
- ✅ 원문 참조 기능 제공

### 권장 달성 (Should Have)
- ✅ 등고선 가중치 시스템 정상 작동
- ✅ Cycle 5 긍정 요소 80% 이상 흡수
- ✅ 처리 시간 5분 이내
- ✅ 사용자 만족도 4.0/5.0 이상

### 선택 달성 (Nice to Have)
- ✅ 등고선 시각화
- ✅ 실시간 신뢰도 표시
- ✅ 다국어 지원 (영문 보고서)

---

## 🔄 지속적 개선

### 피드백 수집
1. **사용자 인터뷰**: 월 1회
2. **사용 로그 분석**: 주 1회
3. **오류 리포트**: 실시간 수집

### 개선 사이클
1. **피드백 수집** → **분석** → **우선순위** → **구현** → **배포** → **검증**
2. 주기: 2주 스프린트

### 메트릭 모니터링
- 날짜 정확도: 일일 측정
- GT Coverage: 주간 측정
- 사용자 만족도: 월간 측정
- 처리 시간: 실시간 측정

---

## 📞 연락처 및 참고자료

### 관련 문서
- [Cycle 5 Summary](../backend/eval/output/cycle5_postprocessing/CYCLE5_SUMMARY.md)
- [OCR 포맷 매핑 계획](../.trae/documents/offline_ocr%20포맷%20정밀%20매핑·재검증%20v1.5%20계획.md)
- [Date Classification Analysis](../date-classification-analysis-report.md)

### 참고 코드
- Cycle 5 파이프라인: `backend/eval/cycle5PostProcessing.js`
- OCR 로더: `backend/services/offline_ocr/loader.js`
- 보고서 생성기: `backend/services/report/generator.js`

---

**다음 단계**: Phase 1 구현 착수

*작성: 2026-01-31*
*버전: 1.0*
*상태: 준비 완료*
