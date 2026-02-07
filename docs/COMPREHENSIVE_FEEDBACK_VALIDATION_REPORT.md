# VNEXSUS 종합 피드백 검증 보고서

**작성일**: 2026-01-30
**목적**: 사용자 피드백 종합 분석 및 시스템 개선 방향 재정의
**기반 문서**: OCR 파이프라인 검증 보고서, Vision-OCR 전환 계획서, Cycle 4-5 분석

---

## 📋 **Executive Summary**

본 보고서는 사용자로부터 제공받은 7가지 핵심 피드백을 기반으로 VNEXSUS OCR 파이프라인 및 의료 이벤트 보고서 생성 시스템의 개선 방향을 재정의합니다.

### **핵심 발견사항**

1. **Case18 제외 필요**: GT 문서와의 일치율이 검증되지 않아 신뢰할 수 없음
2. **BBox의 역할 재정의**: 좌표 정보는 패턴 인식의 주요 수단이 아닌 **보조 정보**일 뿐
3. **보험기간 처리 개선**: 시작일만 중요하며, 사건과의 선후관계 판단이 핵심
4. **Cycle 4 중심 분석**: Cycle 5는 실패한 가정, Cycle 4 흐름과 결과가 중요
5. **보고서 포맷 강제 필요**: 파이프라인 최종 단계에서 항목 분류 강제화
6. **데이터셋 규모**: OCR 캐시 + GT 매칭 데이터는 총 10개 (Case18 제외)
7. **토큰 비용 제약**: 47개 케이스 전체 OCR 좌표 추출은 비용 폭주로 불가능

---

## 🔍 **1. Case18 제외 및 GT 데이터 재검증**

### **문제점**

- **OCR_Pipeline_Validation_Report.html**에 Case18이 포함되어 있음 (19개 케이스)
- Case18의 GT 문서와 PDF 간 일치율이 검증되지 않아 **데이터 신뢰성 부족**

### **영향 분석**

```
기존: 19개 케이스 (Case2, 5, 9, 11, 13, 15, 17, 18, 24, 27, 28, 29, 30, 34, 38, 39, 41, 42, 44)
수정: 18개 케이스 (Case18 제외)

OCR 캐시 + GT 매칭 데이터: 10개 케이스만 신뢰 가능
```

### **조치사항**

1. **cycle4TopDownValidator.js** 수정
   ```javascript
   // 기존
   targetCases: [2, 5, 13, 15, 17, 18, 29, 30, 41, 42, 44]

   // 수정
   targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44]  // Case18 제외
   excludeCases: [18]  // 명시적 제외
   ```

2. **cycle5PostProcessing.js** 수정
   ```javascript
   // 기존
   excludeCases: [18]

   // 확인: 이미 올바르게 설정됨 ✅
   ```

3. **OCR_Pipeline_Validation_Report.html** 재생성
   - Case18 제외한 18개 케이스로 보고서 재작성
   - GT Coverage 통계 재계산

### **검증 가능한 데이터셋**

| 구분 | 개수 | 케이스 |
|------|------|--------|
| **PDF 매칭 완료** | 18 | Case18 제외 |
| **OCR 캐시 + GT 매칭** | 10 | 명시적 검증 가능 |
| **제외 케이스** | 1 | Case18 (GT 불일치) |

---

## 🧩 **2. BBox 기반 양식 인식의 한계 및 후처리 설계**

### **기존 오해**

**OCR_Pipeline_Validation_Report.html** 및 **VISION-OCR-TRANSITION-PLAN.md**에서 BBox 좌표 정보를 **양식 인식의 핵심 수단**으로 간주

```markdown
# 기존 접근 (잘못된 가정)
- X축 좌표가 동일하면 같은 패턴으로 인식
- 좌표 정보만으로 표 구조 자동 복원 가능
- "보 험 기 간" → "보험기간" 병합 로직 (좌표 기반)
```

### **사용자 피드백 (정확한 이해)**

> "X좌표가 동일하면 무조건 패턴인가? 그것을 불분명하다. 단순히 좌표정보만으로 패턴으로 인식하는건 굉장히 큰 오류가 생길 수 있다. **좌표정보는 컨텍스트 및 문서의 형태를 이해해서 보완·조정해주는 보조정보일 뿐이다.**"

### **올바른 접근법**

```
[잘못된 접근]
좌표 정보 (Primary) → 패턴 인식 → 양식 분류

[올바른 접근]
컨텍스트 이해 (Primary) + 좌표 정보 (Secondary) → 패턴 인식 → 양식 분류
```

### **후처리 시스템 설계**

#### **Phase 1: 컨텍스트 기반 양식 인식 (Primary)**

```javascript
// 컨텍스트 분석 우선
function identifyFormPattern(ocrBlocks) {
  const patterns = {
    insurancePeriod: {
      keywords: ['보험기간', '보장기간', '보장개시일', '계약기간'],
      context: ['YYYY.MM.DD', '~', '만기', '가입'],
      confidence: 0.9
    },
    medicalEvent: {
      keywords: ['일자', '사고경위', '병원', '기관', '진료'],
      context: ['표', '테이블', '열'],
      confidence: 0.85
    }
  };

  // 1차: 키워드 + 컨텍스트 매칭
  const contextMatch = matchContextPatterns(ocrBlocks, patterns);

  // 2차: 좌표 정보로 보완 (보조적 검증)
  const coordinateAdjusted = adjustWithCoordinates(contextMatch, ocrBlocks);

  return coordinateAdjusted;
}
```

#### **Phase 2: 좌표 정보 활용 (Secondary)**

```javascript
// 좌표는 컨텍스트 검증 및 미세 조정에만 사용
function adjustWithCoordinates(contextMatches, ocrBlocks) {
  return contextMatches.map(match => {
    // 컨텍스트로 찾은 패턴에 대해서만 좌표 검증
    const bbox = match.bbox;

    // 예: 표 내부 정렬 확인
    if (match.type === 'table_row') {
      const alignment = checkColumnAlignment(bbox, ocrBlocks);
      match.confidence *= alignment > 0.8 ? 1.1 : 0.9;
    }

    // 예: 병합된 텍스트 보완
    if (isSeparatedText(match.text, bbox)) {
      match.text = mergeNearbyBlocks(match, ocrBlocks);
    }

    return match;
  });
}
```

### **구현 우선순위**

1. **컨텍스트 기반 패턴 인식 엔진** (필수)
   - 키워드 사전 확장
   - 문맥 분석 로직 강화
   - 의료 문서 도메인 지식 통합

2. **좌표 정보 보조 활용** (선택)
   - 컨텍스트 검증용으로만 사용
   - 텍스트 병합 보완
   - 표 정렬 확인

### **질문: 후처리로 처리 가능한가?**

**답변**: 예, 가능합니다. 하지만 **컨텍스트 우선 접근**이 필수입니다.

```javascript
// backend/services/ocrPostProcessingService.js (신규)

class OCRPostProcessingService {
  /**
   * 컨텍스트 기반 후처리 파이프라인
   */
  async processOCRResults(ocrBlocks) {
    // Step 1: 컨텍스트 분석 (Primary)
    const contextAnalyzed = await this.analyzeContext(ocrBlocks);

    // Step 2: 좌표 보완 (Secondary)
    const coordinateAdjusted = this.adjustWithCoordinates(contextAnalyzed, ocrBlocks);

    // Step 3: 패턴 매칭
    const patterns = this.matchPatterns(coordinateAdjusted);

    return patterns;
  }

  async analyzeContext(ocrBlocks) {
    // LLM 또는 Rule-based 컨텍스트 분석
    // "보험기간: 2020.10.15 ~ 2025.10.15" → 보험 관련 날짜 기간
    // "일자 | 사고경위 | 병원" → 의료 이벤트 테이블
  }
}
```

---

## 📅 **3. 보험기간 처리 로직 개선 - 시작일 중심 분석**

### **기존 접근 (잘못됨)**

```javascript
// 시작일과 종료일을 동일하게 취급
dateRanges.forEach(item => {
  if (item.startDate) allDates.push(item.startDate);  // 시작일
  if (item.endDate) allDates.push(item.endDate);      // 종료일 (불필요!)
});
```

### **사용자 피드백**

> "보험기간(보장개시일, 보장기간 등)의 **시작일만 중요**하고 **만기일은 중요하지 않다**. 보험심사에서 중요한건 **사건과 보험가입일의 선후관계**이기 때문이다."

### **비즈니스 로직**

```
보험 심사 판단 기준:
- 사건 발생일 > 보험 가입일 (보장개시일) → 보상 가능
- 사건 발생일 < 보험 가입일 → 보상 불가 (기왕증)

∴ 만기일은 선후관계 판단에 무관
```

### **개선된 처리 로직**

```javascript
// backend/services/insurancePeriodProcessor.js (신규)

class InsurancePeriodProcessor {
  /**
   * 보험기간 추출 - 시작일만 반환
   */
  extractInsurancePeriods(ocrBlocks) {
    const periods = [];

    ocrBlocks.forEach(block => {
      // "보험기간: 2020.10.15 ~ 2025.10.15" 패턴
      const match = block.text.match(/보험기간.*?(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*~\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/);

      if (match) {
        periods.push({
          startDate: this.normalizeDate(match[1]),  // 시작일만 추출
          // endDate는 무시 (만기일은 심사에 불필요)
          type: 'insurance_start',
          context: block.text,
          importance: 'high'  // 시작일은 핵심 정보
        });
      }
    });

    return periods;
  }

  /**
   * 사건과 보험가입일 선후관계 분석
   */
  analyzeCoverageEligibility(eventDate, insuranceStartDates) {
    const eligiblePolicies = insuranceStartDates.filter(policy => {
      const start = new Date(policy.startDate);
      const event = new Date(eventDate);

      return event >= start;  // 사건이 가입일 이후 → 보상 가능
    });

    return {
      eligible: eligiblePolicies.length > 0,
      reason: eligiblePolicies.length > 0
        ? `보험 가입일(${eligiblePolicies[0].startDate}) 이후 사건 발생`
        : `보험 가입 전 사건 (기왕증 가능성)`,
      policies: eligiblePolicies
    };
  }
}
```

### **Cycle 4/5 수정 사항**

#### **cycle4TopDownValidator.js**

```javascript
// dateRanges 수집 시 종료일 제외
if (generatedJson.dateRanges) {
  generatedJson.dateRanges.forEach(item => {
    // 시작일만 추출
    if (item.startDate && item.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      allExtractedDates.push({
        date: item.startDate,
        type: item.type ? `${item.type}_시작일` : '기간_시작일',
        context: item.context,
        importance: 'high'  // 시작일은 중요
      });
    }

    // 종료일은 제외 (보험 만기일은 심사에 무관)
    // if (item.endDate) { ... }  ← 삭제
  });
}
```

#### **cycle5PostProcessing.js**

```javascript
// Phase 4: Insurance Period Parser 개선
function processInsurancePeriods(dates) {
  const adjusted = dates.map(d => {
    // 보험 종료일(만기일) 스코어 하향
    if (d.type && d.type.includes('종료일') && d.context.includes('보험')) {
      d.score *= 0.1;  // 만기일은 거의 무시
      d.importance = 'low';
    }

    // 보험 시작일(가입일) 스코어 상향
    if (d.type && d.type.includes('시작일') && d.context.includes('보험')) {
      d.score *= 1.5;  // 시작일은 중요도 높임
      d.importance = 'critical';
    }

    return d;
  });

  return { processed: adjusted };
}
```

### **시스템이 알아야 할 지식**

```javascript
// backend/config/domainKnowledge.js (신규)

export const INSURANCE_DOMAIN_KNOWLEDGE = {
  // 보험 심사 핵심 원칙
  coverageRules: {
    principle: "사건 발생일과 보험 가입일의 선후관계 판단",

    critical_dates: [
      {
        name: '보험 가입일 (보장개시일)',
        importance: 'critical',
        purpose: '보상 가능 여부 판단',
        extraction_priority: 'high'
      }
    ],

    non_critical_dates: [
      {
        name: '보험 만기일',
        importance: 'low',
        purpose: '심사 무관',
        extraction_priority: 'ignore'
      }
    ]
  },

  // 선후관계 판단 로직
  sequenceAnalysis: {
    rule: "event_date >= insurance_start_date",
    outcome: {
      true: "보상 가능",
      false: "보상 불가 (기왕증 가능성)"
    }
  }
};
```

---

## 🔄 **4. Cycle 4 중심 분석 - Cycle 5는 실패한 가정**

### **사용자 피드백**

> "**cycle5가 중요한 것이 아니고 cycle4가 중요**하고 그 결과의 흐름이 중요하다. **cycle5는 솔직히 실패한 가정**이다. 타임스탬프는 날짜가 중요한 것이기 때문에 **hh:mm:ss는 불필요**. cycle4의 흐름과 결과를 면밀하게 분석하라."

### **Cycle 4 vs Cycle 5 재평가**

| 구분 | **Cycle 4 (Top-Down)** | **Cycle 5 (Post-Processing)** |
|------|------------------------|-------------------------------|
| **목표** | GT 100% 포함율 (누락 방지) | Precision 향상 (노이즈 제거) |
| **접근** | 과추출 후 정제 | 7-Phase 필터링 |
| **GT Coverage** | 53% | 57% (+4%p) |
| **Precision** | 12% | 24% (+12%p) |
| **사용자 평가** | ✅ **핵심 접근법** | ❌ **실패한 가정** |
| **향후 방향** | **Cycle 4 개선에 집중** | Cycle 4에 통합 또는 폐기 |

### **Cycle 4가 중요한 이유**

1. **Vision LLM의 표 구조 인식 능력 측정**
   - 테이블/표의 날짜 추출 우수
   - "보험기간 YYYY.MM.DD ~ YYYY.MM.DD" 패턴 인식
   - 기간의 시작일/종료일 모두 추출 (이후 시작일만 사용)

2. **프롬프트 전략의 효과 검증**
   - "의심스러우면 무조건 추출" 전략
   - Top-Down 과추출 접근법
   - 누락 최소화 (GT Coverage 향상)

3. **실제 파이프라인의 기반**
   - Vision LLM 직접 활용 시나리오
   - OCR 전환 후에도 유사한 과추출 전략 필요
   - Cycle 4 프롬프트를 OCR 후처리에 적용 가능

### **Cycle 5가 실패한 이유**

1. **7-Phase 필터링의 한계**
   - Rule-based 접근법으로는 컨텍스트 이해 부족
   - GT Coverage 4%p 향상에 그침 (53% → 57%)
   - Precision 향상 (12% → 24%)도 목표(70-80%)에 미달

2. **타임스탬프 처리 오류**
   - hh:mm:ss 정보는 보험 심사에 불필요
   - 날짜(YYYY-MM-DD)만 중요
   - 불필요한 복잡도 추가

3. **시스템 설계 방향 오류**
   - 노이즈 제거보다 **컨텍스트 이해**가 핵심
   - Rule-based가 아닌 LLM 기반 접근 필요

### **Cycle 4 심층 분석**

#### **코드 흐름 분석**

```javascript
// backend/eval/cycle4TopDownValidator.js

// 1. PDF → 이미지 변환
const { allImages } = await pdfToImages(pdfFolder);

// 2. Vision LLM 호출 (Top-Down 프롬프트)
const result = await callVisionLLM(allImages, 'gpt-4o-mini', caseInfo);

// 3. 과추출된 날짜 수집
const generatedJson = JSON.parse(result.content);
/*
{
  allExtractedDates: [...],    // 모든 날짜
  dateRanges: [...],           // 기간 (시작일/종료일)
  insuranceDates: [...],       // 보험 관련 날짜
  tableDates: [...]            // 표 내 날짜
}
*/

// 4. GT와 비교
const gtDates = extractGroundTruthDates(groundTruth);
const aiDates = collectAIDates(generatedJson);
const matching = analyzeMatching(aiDates, gtDates);
```

#### **핵심 프롬프트 전략**

```javascript
const TOPDOWN_SYSTEM_PROMPT = `
## 절대 원칙: 의심스러우면 무조건 추출하세요!

**누락은 치명적입니다. 과추출은 괜찮습니다.**

### 반드시 추출해야 할 날짜 (예외 없음!)

1. **테이블/표의 모든 날짜**
   - "일자 | 사고경위 | 병원/기관" 형식의 첫 열

2. **기간 표현의 시작일과 종료일 모두**
   - "2020.10.15 ~ 2025.10.15" → 두 날짜 모두

3. **보험사 언급 주변 100자 내 모든 날짜**
   - NH, KB, 삼성, 현대, AXA, DB손해보험

4. **미래 날짜도 포함**
   - 2030년, 2040년, 2050년 등 보험 만기일

5. **과거 날짜도 모두 포함**
   - 2007년, 2012년 등 오래된 날짜
`;
```

#### **결과 통계**

```
Cycle 4 (Top-Down) 성과:
- GT Coverage: 53% (목표: 100%)
- 추출 날짜 수: 371 dates
- 노이즈 (Extra): 328 dates (88%)
- Precision: 12%

✅ 강점: 과추출로 누락 최소화
❌ 약점: 높은 노이즈 비율
```

### **향후 방향: Cycle 4 개선 전략**

#### **전략 1: Cycle 4 프롬프트 개선**

```javascript
// Cycle 4 프롬프트에 컨텍스트 분석 추가
const IMPROVED_TOPDOWN_PROMPT = `
## 과추출 + 컨텍스트 이해

1. **컨텍스트 기반 중요도 태깅**
   - 보험 시작일: importance = 'critical'
   - 보험 만기일: importance = 'low' (무시 가능)
   - 의료 이벤트 날짜: importance = 'high'

2. **타임스탬프 제외**
   - hh:mm:ss 정보는 추출하지 말 것
   - 날짜(YYYY-MM-DD)만 추출

3. **표 구조 인식 강화**
   - 테이블의 첫 열이 날짜인 경우 모두 추출
   - 행 전체 컨텍스트 함께 반환
`;
```

#### **전략 2: Cycle 4 + 경량 후처리**

```javascript
// Cycle 5의 7-Phase 대신 3-Phase 경량 필터링
function lightweightPostProcessing(cycle4Dates) {
  // Phase 1: 보험 만기일 제거
  const phase1 = cycle4Dates.filter(d =>
    !(d.type.includes('종료일') && d.context.includes('보험'))
  );

  // Phase 2: 타임스탬프 정규화
  const phase2 = phase1.map(d => ({
    ...d,
    date: d.date.split('T')[0]  // YYYY-MM-DD만 유지
  }));

  // Phase 3: 컨텍스트 기반 중요도 정렬
  const phase3 = phase2.sort((a, b) => {
    const importanceOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    return importanceOrder[b.importance] - importanceOrder[a.importance];
  });

  return phase3;
}
```

#### **전략 3: Cycle 4 → OCR 통합**

```javascript
// Cycle 4 프롬프트를 OCR 후처리에 적용
class OCRCycle4Processor {
  async processWithCycle4Strategy(ocrBlocks) {
    // 1. OCR 블록에서 Cycle 4 과추출 전략 적용
    const extracted = this.extractAllDates(ocrBlocks, {
      overExtract: true,  // Cycle 4 전략
      includeContext: true
    });

    // 2. Cycle 4 프롬프트의 중요도 태깅 적용
    const tagged = this.tagImportance(extracted);

    // 3. 경량 후처리
    const filtered = this.lightweightFilter(tagged);

    return filtered;
  }
}
```

### **타임스탬프 처리 개선**

```javascript
// 기존 (잘못됨)
{
  date: "2024-05-01T14:30:00",  // hh:mm:ss 포함
  type: "진료",
  context: "외래 진료"
}

// 개선 (올바름)
{
  date: "2024-05-01",  // 날짜만
  type: "진료",
  context: "외래 진료"
}
```

```javascript
// 모든 날짜 정규화
function normalizeDates(dates) {
  return dates.map(d => ({
    ...d,
    date: d.date.split('T')[0],  // 타임스탬프 제거
    // hh:mm:ss는 보험 심사에 불필요
  }));
}
```

---

## 📊 **5. 보고서 포맷 표준화 및 항목 분류 시스템**

### **사용자 피드백**

> "9~10항목 보고서 포맷은 **사용자가 제공한 것**이지 **우리 앱으로 만든 결과가 아니다**. 우리의 파이프라인 **가장 마지막 단계**인 보고서 작성에서 **항목 보고서 포맷이 일관되게 정돈돼 출력되게** 만드는 것이 중요. 여기서만큼은 **강제된 항목에 분류하여 넣어주는 작업이 필요**. 단, **항목에 포함되는 내용의 어레인지를 넓게 허용**하여 **본문의 내용과 의미가 누락되지 않도록** 해야함. **단순히 단어포함이 아닌 컨텍스트가 포함**돼야함."

### **현재 문제점**

1. **NineItemReportGenerator.js**는 DNA 분석 결과를 9항목으로 변환
2. 하지만 **항목 분류가 느슨함** → 일관성 부족
3. **사용자 제공 보고서**는 잘 정돈된 포맷이지만, 앱 출력과 다름

### **목표**

```
파이프라인 최종 단계:
DNA 분석 결과 → [강제 항목 분류기] → 9-10항목 표준 보고서

- 항목 구조: 강제 (일관성 보장)
- 항목 내용: 유연 (컨텍스트 보존)
```

### **9-10항목 보고서 표준 포맷**

```markdown
==================================================
          손해사정 보고서 (최종 확장형)
==================================================

■ 1. 내원일시: yyyy.mm.dd
[강제 항목] 모든 진료 날짜를 연대순으로 나열

■ 2. 내원경위: (외부 병원 진료의뢰, 조직검사 결과 등 요약)
[강제 항목] 환자가 의료기관을 방문한 이유 및 경위

■ 3. 진단병명: (KCD-10 코드 기준, 영문 원어 + 한글 병명)
[강제 항목] 진단명 + ICD/KCD 코드 + 영문/한글 병기

■ 4. 검사결과:
[강제 항목] 검사명, 검사일, 결과, 소견 (원어 + 번역)
※ 암의 경우 조직검사 보고일까지 기재

■ 5. 수술 후 조직검사 결과 (암의 경우만):
[선택 항목] 암 진단 시에만 포함

■ 6. 치료내용: (수술/약물/방사선/처치 등)
[강제 항목] 모든 치료 내역

■ 7. 통원기간: yyyy.mm.dd ~ yyyy.mm.dd / n회 통원
[강제 항목] 통원 시작일 ~ 종료일, 총 횟수

■ 8. 입원기간: yyyy.mm.dd ~ yyyy.mm.dd / n일 입원
[강제 항목] 입원 시작일 ~ 종료일, 총 일수

■ 9. 과거병력: (주요 질환, 합병증 등 기재)
[강제 항목] 기왕증 및 과거 질환 이력

■ 10. 의사소견: (주치의 기재 내용 요약)
[강제 항목] 의사의 소견 및 판단

---
## 고지의무 검토
[추가 섹션] 보험 심사 관련 고지의무 위반 검토

---
## 원발암/전이암 판정 (해당 시)
[선택 섹션] 암 진단 시 원발/전이 여부 판정

---
종합 결론:
[필수 섹션] 보고서 종합 의견

📑 일자별 경과표
[필수 섹션] 연대순 의료 이벤트 타임라인
==================================================
```

### **강제 항목 분류기 설계**

```javascript
// backend/services/reportItemClassifier.js (신규)

class ReportItemClassifier {
  constructor() {
    // 항목별 분류 규칙 정의
    this.classificationRules = {
      '1. 내원일시': {
        keywords: ['진료', '내원', '방문', '외래', '초진', '재진'],
        datePattern: true,
        required: true,
        contentType: 'date_list'
      },
      '2. 내원경위': {
        keywords: ['의뢰', '경위', '이유', '증상', '주소', 'chief complaint'],
        required: true,
        contentType: 'narrative'
      },
      '3. 진단병명': {
        keywords: ['진단', 'diagnosis', 'ICD', 'KCD', '병명'],
        required: true,
        contentType: 'diagnosis_list'
      },
      '4. 검사결과': {
        keywords: ['검사', 'test', 'lab', '혈액', 'CT', 'MRI', 'X-ray', '조직검사'],
        required: true,
        contentType: 'examination_list'
      },
      '5. 수술 후 조직검사 결과': {
        keywords: ['pathology', '병리', 'TNM', 'stage', 'grade'],
        required: false,  // 암인 경우만
        condition: 'cancer_diagnosis',
        contentType: 'pathology_report'
      },
      '6. 치료내용': {
        keywords: ['치료', 'treatment', '수술', '약물', '방사선', '항암', '처치'],
        required: true,
        contentType: 'treatment_list'
      },
      '7. 통원기간': {
        keywords: ['통원', 'outpatient', '외래'],
        datePattern: true,
        required: true,
        contentType: 'period_summary'
      },
      '8. 입원기간': {
        keywords: ['입원', 'admission', 'hospitalization'],
        datePattern: true,
        required: true,
        contentType: 'period_summary'
      },
      '9. 과거병력': {
        keywords: ['과거', 'past history', '기왕증', '합병증', 'previous'],
        required: true,
        contentType: 'narrative'
      },
      '10. 의사소견': {
        keywords: ['소견', 'opinion', 'impression', '판단', '의견'],
        required: true,
        contentType: 'narrative'
      }
    };
  }

  /**
   * DNA 분석 결과를 9-10항목으로 강제 분류
   */
  classifyToStandardItems(dnaAnalysis) {
    const report = {};

    // 각 항목별로 컨텍스트 기반 분류
    for (const [itemName, rule] of Object.entries(this.classificationRules)) {
      // 1. 키워드 매칭 (Primary)
      const keywordMatches = this.findByKeywords(dnaAnalysis, rule.keywords);

      // 2. 컨텍스트 분석 (Secondary)
      const contextMatches = this.analyzeContext(keywordMatches, rule.contentType);

      // 3. 항목에 분류
      report[itemName] = {
        content: this.formatContent(contextMatches, rule.contentType),
        sources: contextMatches.map(m => m.source),
        confidence: this.calculateConfidence(contextMatches)
      };

      // 4. 필수 항목 검증
      if (rule.required && report[itemName].content.length === 0) {
        report[itemName].warning = '필수 항목이지만 내용이 없습니다';
      }
    }

    return report;
  }

  /**
   * 컨텍스트 분석 - 단어 포함이 아닌 의미 이해
   */
  analyzeContext(matches, contentType) {
    return matches.map(match => {
      // 예: "검사결과" 항목
      if (contentType === 'examination_list') {
        // 단순히 "검사" 단어가 있는 것이 아니라
        // "검사명 + 검사일 + 결과" 구조를 가진 문장인지 확인
        const hasExamName = /CT|MRI|X-ray|혈액검사|조직검사/i.test(match.text);
        const hasDate = /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(match.text);
        const hasResult = /정상|이상|소견|findings/i.test(match.text);

        match.contextScore = (hasExamName ? 1 : 0) + (hasDate ? 1 : 0) + (hasResult ? 1 : 0);
      }

      return match;
    }).filter(m => m.contextScore >= 2);  // 컨텍스트 점수 2점 이상만 포함
  }

  /**
   * 내용 포맷팅 - 어레인지 넓게 허용
   */
  formatContent(matches, contentType) {
    switch (contentType) {
      case 'date_list':
        // 내원일시: 날짜만 연대순 나열
        return matches
          .map(m => m.date)
          .sort()
          .join(', ');

      case 'diagnosis_list':
        // 진단병명: 원문 + ICD 코드 + 영문/한글
        return matches.map(m => {
          const icd = this.extractICDCode(m.text);
          const korean = this.extractKoreanName(m.text);
          const english = this.extractEnglishName(m.text);

          return `${korean} (${english}) [${icd}]`;
        }).join('\n');

      case 'narrative':
        // 서술형: 원문 그대로 보존
        return matches.map(m => m.text).join('\n\n');

      case 'examination_list':
        // 검사결과: 검사명 + 날짜 + 결과 구조화
        return matches.map(m => {
          const examName = this.extractExamName(m.text);
          const examDate = this.extractDate(m.text);
          const result = this.extractResult(m.text);

          return `- ${examName} (${examDate}): ${result}`;
        }).join('\n');

      default:
        return matches.map(m => m.text).join('\n');
    }
  }
}
```

### **항목 분류 예시**

#### **입력 (DNA 분석 결과)**

```json
{
  "extracted_genes": [
    {
      "content": "2024-05-01 외래 진료 / Chronic gastritis 만성위염 진단",
      "type": "medical_event"
    },
    {
      "content": "CT 검사 시행 (2024-05-15) - 복부 이상 소견 없음",
      "type": "examination"
    },
    {
      "content": "2020년 고혈압으로 약물 치료 중",
      "type": "past_history"
    }
  ]
}
```

#### **출력 (9-10항목 보고서)**

```markdown
■ 1. 내원일시: 2024.05.01
[자동 분류] "2024-05-01 외래 진료" → 날짜 추출

■ 2. 내원경위: 만성위염 의심 증상으로 외래 방문
[자동 분류] "외래 진료" → 내원 경위

■ 3. 진단병명: Chronic gastritis (만성위염)
[자동 분류] "Chronic gastritis 만성위염" → 진단명 + 영문/한글

■ 4. 검사결과:
- CT 검사 (2024.05.15): 복부 이상 소견 없음
[자동 분류] "CT 검사" → 검사명, 날짜, 결과 구조화

■ 9. 과거병력: 2020년 고혈압으로 약물 치료 중
[자동 분류] "2020년 고혈압" → 과거 질환
```

### **구현 우선순위**

1. **ReportItemClassifier 개발** (필수)
   - 9-10항목 강제 분류 로직
   - 컨텍스트 기반 매칭
   - 내용 포맷팅 (어레인지 유연)

2. **NineItemReportGenerator 개선** (필수)
   - ReportItemClassifier 통합
   - 항목별 검증 로직
   - 누락 항목 경고

3. **품질 검증 시스템** (선택)
   - 필수 항목 누락 체크
   - 컨텍스트 점수 임계값
   - 사용자 피드백 루프

---

## 📦 **6. OCR 캐시 및 GT 데이터 매칭 현황**

### **사용자 피드백**

> "**OCR 캐시와 매칭되는 GT 데이터는 총 10개 뿐이다**(케이스18 제외 후). 47개의 케이스에 대해 OCR 좌표정보를 모두 추출하면 좋겠지만 **토큰 비용 폭주로 어려움**."

### **데이터셋 규모 정리**

| 구분 | 개수 | 설명 |
|------|------|------|
| **전체 케이스** | 47 | VNEXSUS 전체 케이스 수 |
| **PDF 매칭 완료** | 19 → 18 | Case18 제외 |
| **OCR 캐시 + GT 매칭** | **10** | 신뢰 가능한 검증 데이터 |
| **OCR 좌표 추출 불가** | 37 | 토큰 비용 문제 |

### **토큰 비용 분석**

```
단일 케이스 비용 (50페이지 기준):
- GPT-4o-mini: $0.031/document
- GPT-4o: $0.062/document

47개 케이스 전체 비용:
- GPT-4o-mini: $0.031 × 47 = $1.46
- GPT-4o: $0.062 × 47 = $2.91

→ 비용 자체는 낮지만, 토큰 사용량 폭주 (API Rate Limit 문제)
```

### **현실적인 전략**

#### **전략 1: 10개 케이스 집중 검증**

```javascript
// 10개 검증 가능 케이스로 시스템 최적화
const VERIFIED_CASES = [2, 5, 13, 15, 17, 29, 30, 41, 42, 44];  // Case18 제외

// 이 10개로 다음을 검증:
// 1. OCR vs Vision LLM 비교
// 2. GT Coverage 측정
// 3. Precision 향상
// 4. 보고서 품질
```

#### **전략 2: 샘플링 전략**

```javascript
// 47개 케이스를 카테고리별로 샘플링
const SAMPLING_STRATEGY = {
  simple_cases: [15, 17, 29, 30],      // 단순 케이스 (1-2페이지)
  medium_cases: [2, 5, 13, 41, 42],    // 중간 케이스 (3-5페이지)
  complex_cases: [44],                 // 복잡 케이스 (5페이지 이상)

  total: 10  // 전체 47개 대신 대표 10개
};
```

#### **전략 3: 점진적 확장**

```
Phase 1: 10개 케이스로 시스템 검증 ✅
Phase 2: 성능 입증 후 20개로 확장 (토큰 예산 확보)
Phase 3: 최종 47개 전체 검증 (프로덕션)
```

### **OCR 캐시 구조**

```javascript
// backend/eval/output/cycle4_topdown/ocr_cache/
case_2_topdown.json   ✅ GT 매칭
case_5_topdown.json   ✅ GT 매칭
case_13_topdown.json  ✅ GT 매칭
case_15_topdown.json  ✅ GT 매칭
case_17_topdown.json  ✅ GT 매칭
case_18_topdown.json  ❌ 제외 (GT 불일치)
case_29_topdown.json  ✅ GT 매칭
case_30_topdown.json  ✅ GT 매칭
case_41_topdown.json  ✅ GT 매칭
case_42_topdown.json  ✅ GT 매칭
case_44_topdown.json  ✅ GT 매칭

총 10개 케이스 (Case18 제외)
```

---

## 🎯 **7. 종합 피드백 검증 및 추가 논의사항**

### **핵심 수정 사항 요약**

| 번호 | 피드백 | 조치사항 | 우선순위 |
|------|--------|----------|----------|
| 1 | **Case18 제외** | cycle4/cycle5 코드 수정, 보고서 재생성 | 🔴 High |
| 2 | **BBox 역할 재정의** | 컨텍스트 우선 접근법 설계 | 🔴 High |
| 3 | **보험기간 시작일 중심** | 보험 만기일 제거, 선후관계 분석 추가 | 🔴 High |
| 4 | **Cycle 4 중심 분석** | Cycle 5 폐기/통합, Cycle 4 개선 | 🔴 High |
| 5 | **보고서 포맷 강제** | ReportItemClassifier 개발 | 🟡 Medium |
| 6 | **데이터셋 10개** | 10개 케이스 집중 검증 전략 | 🟢 Low |
| 7 | **타임스탬프 제거** | hh:mm:ss 제거, 날짜만 사용 | 🔴 High |

### **추가 논의사항**

#### **1. Cycle 5를 완전히 폐기할 것인가, 아니면 Cycle 4에 통합할 것인가?**

**옵션 A: 완전 폐기**
```javascript
// Cycle 5의 7-Phase 필터링 제거
// Cycle 4 프롬프트만 개선
```

**옵션 B: 경량 통합**
```javascript
// Cycle 4 + 3-Phase 경량 후처리
// (보험 만기일 제거, 타임스탬프 정규화, 중요도 정렬)
```

**권장**: 옵션 B (경량 통합)
- Cycle 5의 모든 로직을 버리는 것은 아님
- 핵심 필터링 (보험 만기일, 타임스탬프)만 유지
- Cycle 4 결과의 품질 향상

#### **2. BBox 좌표 정보를 OCR에서 계속 추출해야 하는가?**

**현재 상황**:
- Google Vision OCR은 BBox 제공
- 하지만 BBox는 보조 정보일 뿐

**옵션 A: BBox 계속 추출**
```javascript
// OCR에서 BBox 추출 → 컨텍스트 검증용으로만 사용
const ocrResult = await googleVision.processDocument(pdf);
// ocrResult.blocks[].bbox 활용
```

**옵션 B: BBox 추출 생략 (비용 절감)**
```javascript
// 텍스트만 추출, BBox 무시
const ocrResult = await googleVision.processDocument(pdf, {
  extractBBox: false
});
```

**권장**: 옵션 A (BBox 계속 추출)
- 비용 증가 거의 없음 (Google Vision API는 BBox 기본 제공)
- 컨텍스트 검증 시 유용할 수 있음
- 미래 개선 가능성 열어둠

#### **3. 9-10항목 보고서 포맷을 얼마나 강제할 것인가?**

**스펙트럼**:
```
[엄격] ← → [유연]
  A        B      C
```

**옵션 A: 완전 강제** (엄격)
- 항목 구조 고정
- 내용 포맷도 고정 (예: 날짜는 YYYY.MM.DD만 허용)
- 장점: 일관성 최대
- 단점: 정보 누락 가능성

**옵션 B: 항목만 강제** (권장)
- 항목 구조 고정 (9-10항목 필수)
- 내용은 유연 (어레인지 허용)
- 장점: 일관성 + 정보 보존
- 단점: 구현 복잡도

**옵션 C: 권장 포맷** (유연)
- 항목도 권장 사항
- 내용도 자유
- 장점: 정보 손실 없음
- 단점: 일관성 부족

**권장**: 옵션 B (항목만 강제)
- 사용자 피드백에 부합
- "강제된 항목 + 넓은 어레인지"

#### **4. Cycle 4 프롬프트를 어떻게 개선할 것인가?**

**개선 방향**:

1. **컨텍스트 태깅 추가**
   ```javascript
   {
     date: "2020-10-15",
     type: "insurance_start",
     importance: "critical",  // 추가
     context: "NH농협손해보험 보장개시일"
   }
   ```

2. **타임스탬프 제외 명시**
   ```
   프롬프트: "날짜만 추출하세요 (YYYY-MM-DD). hh:mm:ss는 포함하지 마세요."
   ```

3. **보험 만기일 하향 조정**
   ```
   프롬프트: "보험 만기일은 importance='low'로 태깅하세요."
   ```

#### **5. 10개 케이스로 충분한가?**

**검증 범위**:
- **10개 케이스**: 시스템 검증 (알고리즘, 프롬프트)
- **20개 케이스**: 통계적 신뢰도 확보
- **47개 케이스**: 프로덕션 배포

**권장**:
- Phase 1: 10개로 시작 ✅
- Phase 2: 성능 입증 후 20개로 확장
- Phase 3: 최종 47개 전체 검증

### **다음 단계 실행 계획**

#### **즉시 실행 (1주)**

1. **Case18 제외 처리**
   - cycle4TopDownValidator.js 수정
   - cycle5PostProcessing.js 검증
   - 보고서 재생성

2. **Cycle 4 프롬프트 개선**
   - 컨텍스트 태깅 추가
   - 타임스탬프 제외
   - 보험 만기일 하향

3. **타임스탬프 정규화**
   - 모든 날짜를 YYYY-MM-DD로 통일
   - hh:mm:ss 제거

#### **단기 실행 (2-3주)**

4. **보험기간 처리 개선**
   - 보험 시작일만 추출
   - 선후관계 분석 로직 추가
   - InsurancePeriodProcessor 개발

5. **컨텍스트 기반 패턴 인식**
   - OCRPostProcessingService 개발
   - 컨텍스트 우선 + 좌표 보조 로직

6. **Cycle 5 경량화**
   - 7-Phase → 3-Phase 축소
   - Cycle 4에 통합

#### **중기 실행 (1-2개월)**

7. **보고서 포맷 강제**
   - ReportItemClassifier 개발
   - NineItemReportGenerator 개선
   - 항목 검증 로직

8. **10개 케이스 검증**
   - Cycle 4 개선 버전 실행
   - GT Coverage, Precision 측정
   - 보고서 품질 평가

---

## 📝 **결론**

### **핵심 원칙 재정의**

1. **데이터 품질 우선**
   - Case18 제외 (GT 불일치)
   - 10개 검증 가능 케이스에 집중

2. **컨텍스트 이해 중심**
   - BBox는 보조 정보
   - 키워드 + 문맥 분석이 핵심

3. **보험 도메인 지식 통합**
   - 시작일만 중요 (선후관계 판단)
   - 만기일은 심사 무관

4. **Cycle 4 중심**
   - Cycle 5는 경량화하여 통합
   - Cycle 4 프롬프트 개선에 집중

5. **보고서 포맷 일관성**
   - 항목 구조 강제
   - 내용 어레인지 유연

6. **비용 효율성**
   - 10개 케이스로 시작
   - 점진적 확장 전략

### **기대 효과**

| 지표 | 현재 | 목표 | 개선 방향 |
|------|------|------|-----------|
| **GT Coverage** | 53% (Cycle 4) | 70%+ | Cycle 4 프롬프트 개선 |
| **Precision** | 12% (Cycle 4) | 60-70% | 경량 후처리 통합 |
| **보고서 일관성** | 낮음 | 높음 | 항목 분류 강제 |
| **비용** | $0.031/doc | $0.020/doc | OCR 전환 + 최적화 |
| **데이터 신뢰성** | 19개 케이스 | 10개 (검증됨) | Case18 제외 |

---

**다음 업데이트**: Case18 제외 처리 및 Cycle 4 프롬프트 개선 완료 후
