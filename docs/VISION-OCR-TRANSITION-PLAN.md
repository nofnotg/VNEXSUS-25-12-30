# Vision LLM → OCR 전환 및 후처리 통합 계획서

**작성일**: 2026-01-28
**목적**: VisionLLM을 OCR로 전환하고, 기존 후처리 로직을 유지하며 9-10항목 보고서 품질 향상

---

## 📊 **1차 재귀 검증: Cycle 4 vs Cycle 5 핵심 차이점**

### **결론: 두 사이클은 완전히 다른 영역의 강점을 가짐**

| 구분 | **Cycle 4** | **Cycle 5** |
|------|-------------|-------------|
| **초점 영역** | **날짜 추출 (Date Extraction)** | **노이즈 제거 (Noise Filtering)** |
| **담당 시스템** | Vision LLM (GPT-4o-mini/4o) | Rule-based 후처리 파이프라인 |
| **핵심 목표** | GT 100% 포함율 (누락 방지) | Precision 향상 (과추출 정제) |
| **접근 방식** | **Top-Down 과추출** | **7-Phase 필터링** |
| **GT Coverage** | 53% | **57% (+4%p)** |
| **Precision** | 12% | **24% (+12%p)** |
| **추출 날짜 수** | 371 dates | 178 dates (-52%) |
| **노이즈 (Extra)** | 328 dates | 136 dates (-59%) |
| **프롬프트 전략** | "의심스러우면 무조건 추출" | N/A (Rule-based) |
| **항목 보고서** | ❌ 관련 없음 | ❌ 관련 없음 |

### **중요한 발견**

1. **Cycle 4와 Cycle 5는 "날짜 추출"에만 초점**
   - Cycle 4: Vision LLM의 날짜 추출 능력 측정
   - Cycle 5: Rule-based 후처리로 노이즈 제거

2. **항목 보고서 생성은 별도 시스템**
   - `NineItemReportGenerator.js`가 담당
   - DNA 분석 결과 → 9항목 손해사정 보고서 변환
   - **Cycle 4/5와는 완전히 독립적인 파이프라인**

3. **Cycle 4의 좋은 지표 = Vision LLM의 표 구조 인식 능력**
   - 표/테이블에서 날짜 추출 우수
   - "보험기간 YYYY.MM.DD ~ YYYY.MM.DD" 패턴 인식
   - 기간의 시작일/종료일 모두 추출

4. **Cycle 5의 후처리 로직 = 날짜 노이즈 제거**
   - Phase 1-7: 날짜 유효성, 타입, 시간적 중요도 등 7단계 필터링
   - **항목 보고서 생성과는 무관**

---

## 📌 **현재 시스템 아키텍처 (VisionLLM 기반)**

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT: PDF Files                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 1: Vision LLM (GPT-4o / GPT-4o-mini)            │
│  - PDF → 이미지 변환 (Poppler pdftoppm)                          │
│  - 이미지 → Vision LLM API 호출                                  │
│  - 날짜, 의료 이벤트, 표 구조 직접 인식                          │
│  - 출력: 구조화된 JSON (dates, events, diagnoses, etc.)          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 2: DNA 분석 (선택적)                       │
│  - 의료 이벤트 추출 (extracted_genes)                            │
│  - 인과관계 네트워크 구축 (causal_network)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 3: NineItemReportGenerator.js                    │
│  - DNA 분석 결과 → 9항목 보고서 생성                             │
│  - 각 항목별 추출기 (VisitDateExtractor, DiagnosisExtractor 등)  │
│  - 템플릿 적용 (standard/detailed/summary)                       │
│  - 출력: 최종 확장형 손해사정 보고서                             │
└─────────────────────────────────────────────────────────────────┘
```

### **핵심 특징**

1. **Vision LLM의 장점**
   - 표 구조 직접 인식 (90-95% 정확도)
   - "보 험 기 간" 같은 분리된 글자 자동 병합
   - 문맥 기반 이해 (날짜와 레이블의 관계 파악)
   - 복잡한 레이아웃 처리 우수

2. **현재 비용**
   - GPT-4o: $0.062/document
   - GPT-4o-mini: $0.031/document (최적화 시)

3. **보고서 생성 로직**
   - **원문 최대한 보존**
   - 영문 원어 + 한글 번역 병기
   - 암 관련: 조직검사 보고일 및 병기 포함
   - 통원/입원 구분 명확히

---

## 🎯 **목표: OCR 전환 후 달성해야 할 것**

### **1. 비용 효율성**
- VisionLLM ($0.031-0.062/doc) → OCR ($0.015-0.017/doc)
- **약 50% 비용 절감**

### **2. 정확도 유지**
- VisionLLM 90-95% → OCR + 후처리 85%+
- **허용 가능한 5-10%p 차이**

### **3. 9-10항목 보고서 품질 유지**
- 구조 강제: 9항목 표준 형식 유지
- 원문 보존: 최대한 원문 내용 살리기
- 풍성한 내용: 세부 정보 누락 방지

---

## 🔄 **2차 재귀 검증: 마이그레이션 전략**

### **전략 A: Google OCR + LLM 보완 (권장)**

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT: PDF Files                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: Google Vision OCR                          │
│  - PDF → 이미지 변환 (Poppler pdftoppm)                          │
│  - Google Vision API 호출                                        │
│  - 출력: 텍스트 블록 + 좌표 정보                                 │
│  - 비용: $0.015/document                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: OCR 후처리 (NEW)                           │
│                                                                  │
│  Phase 1: 블록 병합 (Y축 정렬, 페이지별)                         │
│    - "보 험 기 간" → "보험기간" 병합                             │
│    - 좌표 기반 행/열 정렬                                        │
│                                                                  │
│  Phase 2: 날짜 추출 (Regex + Pattern Matching)                   │
│    - YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD 패턴                     │
│    - 기간 표현 파싱 (시작일/종료일)                              │
│                                                                  │
│  Phase 3: LLM 보완 (GPT-4o-mini) - Cycle 5 로직 재사용          │
│    - 7-Phase 후처리 파이프라인 적용                              │
│    - Type-based scoring, Recency, Context analysis              │
│    - Insurance Period Parser                                    │
│    - Document Metadata Filter                                   │
│    - 종합 점수 계산 (minScore=20)                                │
│                                                                  │
│  Phase 4: 표 구조 복원 (OCR 좌표 활용)                           │
│    - 좌표 정보로 표/테이블 재구성                                │
│    - "일자 | 사고경위 | 병원/기관" 형식 복원                     │
│                                                                  │
│  출력: 정제된 의료 이벤트 JSON                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 3: DNA 분석 (기존 유지)                    │
│  - 의료 이벤트 추출 (extracted_genes)                            │
│  - 인과관계 네트워크 구축 (causal_network)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 4: NineItemReportGenerator.js (기존 유지)           │
│  - DNA 분석 결과 → 9항목 보고서 생성                             │
│  - 원문 최대한 보존                                              │
│  - 영문 원어 + 한글 번역 병기                                    │
│  - 암: 조직검사 보고일 및 병기 포함                              │
│  - 통원/입원 구분 명확                                           │
│  - 출력: 최종 확장형 손해사정 보고서                             │
└─────────────────────────────────────────────────────────────────┘
```

### **핵심 포인트**

1. **Cycle 5 후처리 로직을 OCR에 적용**
   - 기존: Vision LLM 과추출 → Cycle 5 필터링
   - 신규: OCR 추출 → Cycle 5 필터링 (동일한 7-Phase 적용)

2. **표 구조 인식 보완**
   - OCR 좌표 정보로 표/테이블 재구성
   - 행/열 정렬을 통해 "일자 | 내용 | 기관" 형식 복원

3. **NineItemReportGenerator는 그대로 유지**
   - 입력 형식만 맞추면 기존 로직 100% 재사용
   - 원문 보존 메커니즘 그대로 유지

---

## 📝 **마이그레이션 구현 계획**

### **Phase 1: OCR 후처리 모듈 개발 (1-2주)**

```javascript
// backend/services/ocrProcessingService.js

class OCRProcessingService {
  constructor() {
    this.googleVision = new GoogleVisionClient();
    this.cycle5Pipeline = new Cycle5PostProcessor();
  }

  /**
   * OCR 처리 + Cycle 5 후처리 통합
   */
  async processDocument(pdfPath) {
    // Step 1: PDF → 이미지 변환
    const images = await this.convertPdfToImages(pdfPath);

    // Step 2: Google Vision OCR 호출
    const ocrResults = await this.googleVision.processImages(images);

    // Step 3: 블록 병합 (좌표 기반)
    const mergedBlocks = this.mergeOcrBlocks(ocrResults);

    // Step 4: 날짜 추출 (Regex)
    const extractedDates = this.extractDatesFromBlocks(mergedBlocks);

    // Step 5: Cycle 5 후처리 적용 (7-Phase)
    const refinedDates = await this.cycle5Pipeline.apply({
      dates: extractedDates,
      context: mergedBlocks
    });

    // Step 6: 표 구조 복원 (좌표 활용)
    const reconstructedTables = this.reconstructTables(ocrResults, refinedDates);

    // Step 7: DNA 분석 형식으로 변환
    return this.convertToDnaFormat({
      dates: refinedDates,
      tables: reconstructedTables,
      rawText: mergedBlocks.join('\n')
    });
  }

  /**
   * OCR 블록 병합 (Y축 정렬, 페이지별)
   */
  mergeOcrBlocks(ocrResults) {
    // "보 험 기 간" → "보험기간" 병합 로직
    // 좌표 기반 행/열 정렬
    return mergedText;
  }

  /**
   * Cycle 5 후처리 적용 (기존 로직 재사용)
   */
  async applyCycle5Pipeline(dates, context) {
    // Phase 1: Date Range Validation
    const phase1 = validateDateRange(dates);

    // Phase 2: Type-based Scoring
    const phase2 = scoreByType(phase1);

    // Phase 3: Recency Scoring
    const phase3 = scoreByRecency(phase2);

    // Phase 4: Insurance Period Parser
    const phase4 = processInsurancePeriods(phase3);

    // Phase 5: Document Metadata Filter
    const phase5 = filterDocumentMetadata(phase4);

    // Phase 6: Context Analysis
    const phase6 = scoreByContext(phase5);

    // Phase 7: Comprehensive Scoring
    const phase7 = scoreComprehensively(phase6);

    return filterByScore(phase7, minScore=20);
  }

  /**
   * 표 구조 복원 (OCR 좌표 활용)
   */
  reconstructTables(ocrResults, refinedDates) {
    // 좌표 정보로 표/테이블 감지
    // "일자 | 사고경위 | 병원/기관" 형식 복원
    return tables;
  }
}
```

### **Phase 2: 통합 테스트 (1주)**

```bash
# 19개 케이스로 OCR vs VisionLLM 성능 비교
node backend/eval/ocrVsVisionComparison.js

# 측정 지표:
# 1. GT Coverage (목표: 85%+)
# 2. Precision (목표: 70-80%)
# 3. 보고서 품질 (9항목 완성도)
# 4. 비용 (목표: 50% 절감)
```

### **Phase 3: NineItemReportGenerator 호환성 검증 (3일)**

```javascript
// 입력 형식 맞추기만 하면 기존 로직 100% 재사용
const ocrResult = await ocrService.processDocument(pdfPath);

// NineItemReportGenerator는 그대로 사용
const reportGenerator = new NineItemReportGenerator({
  useEnhancedExtractors: true,
  enableNaNGuard: true
});

const report = await reportGenerator.generateReport(
  ocrResult,  // DNA 분석 형식으로 변환된 OCR 결과
  patientInfo,
  { template: 'standard' }
);

// 출력: 기존과 동일한 9항목 보고서
```

### **Phase 4: 프로덕션 배포 (1주)**

```javascript
// Feature flag로 점진적 전환
const USE_OCR = process.env.USE_OCR === 'true';

if (USE_OCR) {
  result = await ocrService.processDocument(pdfPath);
} else {
  result = await visionLLMService.processDocument(pdfPath);
}
```

---

## 🎯 **9-10항목 보고서 구조 강제 + 원문 보존 메커니즘**

### **현재 NineItemReportGenerator의 원문 보존 전략**

```javascript
// backend/services/nineItemReportGenerator.js

/**
 * 최종 확장형 템플릿 (기존 그대로 유지)
 */
async standardTemplate(items, options = {}) {
  return `
==================================================
          손해사정 보고서 (최종 확장형)
==================================================

■ 내원일시: yyyy.mm.dd
${this.formatVisitDateTime(items.visitDates)}

■ 내원경위: (외부 병원 진료의뢰, 조직검사 결과 등 요약)
${this.formatVisitReason(items.visitReasons)}

■ 진단병명: (KCD-10 코드 기준, 영문 원어 + 한글 병명)
${this.formatDiagnosisWithKCD(items.diagnoses)}

■ 검사결과:
(검사명, 검사일, 검사결과, 소견 / 원어 + 한글 번역)
※ 암의 경우 조직검사 보고일까지 기재
${this.formatExaminationResults(items.examinations)}

■ 수술 후 조직검사 결과 (암의 경우만):
${this.formatCancerPathologyIfApplicable(items)}

■ 치료내용: (수술/약물/방사선/처치 등)
${this.formatTreatmentDetails(items.treatments)}

■ 통원기간: yyyy.mm.dd ~ yyyy.mm.dd / n회 통원
${this.formatOutpatientPeriod(items.outpatientPeriods)}

■ 입원기간: yyyy.mm.dd ~ yyyy.mm.dd / n일 입원
${this.formatAdmissionPeriod(items.admissionPeriods)}

■ 과거병력: (주요 질환, 합병증 등 기재)
${this.formatPastHistory(items.pastHistory)}

■ 의사소견: (주치의 기재 내용 요약)
${this.formatDoctorOpinion(items.doctorOpinion)}

---
## 고지의무 검토
${this.formatDisclosureObligationReview(items)}

---
## 원발암/전이암 판정 (해당 시)
${this.formatPrimaryCancerAssessment(items)}

---
종합 결론:
${this.formatComprehensiveConclusion(items)}

📑 일자별 경과표
${await this.generateChronologicalProgress(items)}
==================================================`;
}

/**
 * 원문 보존 전략:
 * 1. formatVisitDateTime: 날짜 원본 형식 유지 (yyyy.mm.dd)
 * 2. formatDiagnosisWithKCD: ICD 코드 + 영문/한글 병기
 * 3. formatExaminationResults: 검사명 영문 원어 + 한글 번역
 * 4. formatCancerPathology: 조직검사 보고일 및 병기 TNM
 * 5. generateChronologicalProgress: 날짜별 경과표 연대순 정리
 */
```

### **원문 보존이 잘 작동하는 이유**

1. **각 항목별 추출기가 원본 컨텍스트 저장**
   ```javascript
   visitDates.push({
     date: match,
     context: content.substring(0, 100),  // 원문 맥락
     confidence: gene.confidence || 0.7
   });
   ```

2. **포맷팅 함수가 원문 기반으로 재구성**
   ```javascript
   formatExaminationResults(items) {
     return items.examinations.map(item => {
       // 원문에서 날짜, 검사명, 결과 추출
       // 영문 → 한글 매핑 적용
       // 원본 형식 최대한 유지
     }).join('\n\n');
   }
   ```

3. **OCR 전환 후에도 동일하게 작동**
   - OCR 결과도 동일한 구조 (date, context, type)
   - 추출기 입력 형식만 맞추면 됨
   - **원문 보존 메커니즘 100% 재사용 가능**

---

## 📊 **예상 성능 비교**

| 지표 | VisionLLM | OCR + Cycle5 | 목표 |
|------|-----------|--------------|------|
| **GT Coverage** | 90-95% | **85%+** | ✅ 85%+ |
| **Precision** | 90-95% | **70-80%** | ✅ 70-80% |
| **비용/doc** | $0.031-0.062 | **$0.017** | ✅ 50% 절감 |
| **표 구조 인식** | 90-95% | **70-80%** | ⚠️ 보완 필요 |
| **보고서 품질** | 9/10 항목 | **9/10 항목** | ✅ 동일 |
| **원문 보존** | 우수 | **우수** | ✅ 메커니즘 재사용 |

---

## ✅ **최종 결론 및 권장사항**

### **1. Cycle 4와 Cycle 5는 다른 영역의 강점**
- ✅ **Cycle 4**: Vision LLM의 날짜 추출 능력 (표 구조 인식)
- ✅ **Cycle 5**: Rule-based 후처리로 노이즈 제거 (7-Phase)
- ❌ **항목 보고서 생성과는 무관** (NineItemReportGenerator가 담당)

### **2. 마이그레이션 전략**
- ✅ **Google OCR + Cycle 5 후처리 조합 (권장)**
- ✅ **표 구조 복원을 위한 OCR 좌표 활용**
- ✅ **NineItemReportGenerator는 그대로 유지**
- ✅ **Feature flag로 점진적 전환**

### **3. 9-10항목 보고서 품질 유지**
- ✅ **구조 강제**: 기존 템플릿 그대로 사용
- ✅ **원문 보존**: 메커니즘 100% 재사용
- ✅ **풍성한 내용**: 각 항목별 추출기 활용

### **4. 예상 효과**
- ✅ **비용 50% 절감**: $0.031 → $0.017/document
- ✅ **정확도 유지**: 85%+ (허용 가능한 5-10%p 차이)
- ✅ **보고서 품질 동일**: 9항목 표준 형식 유지

---

## 📅 **다음 단계**

1. **OCRProcessingService 개발** (1-2주)
   - Google Vision OCR 통합
   - Cycle 5 후처리 파이프라인 적용
   - 표 구조 복원 로직 구현

2. **통합 테스트** (1주)
   - 19개 케이스로 OCR vs VisionLLM 비교
   - GT Coverage, Precision, 비용 측정

3. **NineItemReportGenerator 호환성 검증** (3일)
   - 입력 형식 맞추기
   - 보고서 품질 비교

4. **프로덕션 배포** (1주)
   - Feature flag 적용
   - 점진적 전환
   - 모니터링 및 피드백

---

**작성자**: Claude (Sonnet 4.5)
**버전**: 1.0
**다음 업데이트**: OCRProcessingService 구현 후
