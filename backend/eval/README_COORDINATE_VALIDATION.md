# 사용자 피드백 기반 OCR 파이프라인 종합 검증

## 📋 목차

1. [개요](#개요)
2. [핵심 전략](#핵심-전략)
3. [검증 파이프라인](#검증-파이프라인)
4. [실행 방법](#실행-방법)
5. [출력 결과](#출력-결과)
6. [기대 효과](#기대-효과)

---

## 개요

### 목표

**GT 날짜 매칭율 100% 달성** + **연관성 기반 우선순위 제공**

### 배경

사용자 피드백을 반영한 검증 전략:

1. **GT는 부분집합, OCR은 전체집합**
   - GT: 쟁점사항 관련 날짜만 발췌 (부분집합)
   - OCR: 모든 의료기록 날짜 추출 (전체집합)
   - **추가 날짜가 많은 것은 정상 (전체집합이므로)**
   - **GT 날짜 누락 0개가 핵심 목표**

2. **좌표정보는 보조 정보**
   - Primary: 컨텍스트 분석 (키워드, 문맥)
   - Secondary: 좌표 정보 (테이블 구조, 텍스트 병합)

3. **노이즈 삭제 → 연관성 우선 정렬**
   - 노이즈를 삭제하는 대신 연관성 점수로 정렬
   - 의미있을 만한 데이터를 **먼저** 보여주기
   - 등고선 로직 적용: 5단계 레벨링

---

## 핵심 전략

### 1. GT 매칭율 100% 달성

#### 현재 상황 (Cycle 4 Top-Down)
```
GT 날짜 매칭율: 58% (43/74개 매칭)
누락된 GT 날짜: 31개 ← 이것을 0으로!
추가 추출 날짜: 136개 ← 정상 (전체집합)
```

#### 개선 전략
1. **Google OCR bbox 좌표 활용**
   - Vision LLM 외에 Google OCR bbox 좌표 추가 추출
   - 테이블 구조 인식, 텍스트 병합에 활용

2. **컨텍스트 우선 분석**
   - 키워드 주변 날짜 탐색 범위 확대
   - 보험 시작일 vs 만기일 구분
   - 의료 이벤트 날짜 우선 추출

3. **누락 방지 로직**
   - 의심스러운 경우 무조건 포함
   - GT와 유사한 패턴 모두 추출

### 2. 연관성 기반 우선순위 정렬

#### 점수 구성
- **GT 매칭**: 100점 (GT에 포함된 날짜)
- **중요도**: critical(50) / high(30) / medium(10) / low(5)
- **컨텍스트**: 최대 50점 (의료/보험 키워드, 테이블 위치)
- **신뢰도**: 최대 10점 (OCR 신뢰도)

#### 등고선 레벨링
```
L1 - GT 필수 (100-200점):   GT + 높은 연관성
L2 - 매우 높음 (60-99점):   GT는 아니지만 매우 높은 연관성
L3 - 높음 (40-59점):        의료/보험 키워드 주변
L4 - 보통 (20-39점):        보통 연관성
L5 - 낮음 (0-19점):         낮은 연관성
```

---

## 검증 파이프라인

### Phase 1: Google OCR bbox 좌표 추출

**파일**: `extractGoogleOCRBbox.js`

**목표**: 10개 케이스에 대해 Google Vision OCR 실행 및 bbox 좌표 추출

**처리 과정**:
1. PDF → 이미지 변환 (pdftoppm)
2. Google Vision OCR 실행
3. 텍스트 블록 + bbox 좌표 추출
4. 날짜 패턴이 있는 블록 식별
5. 캐시 저장

**출력**:
```
backend/eval/output/google_ocr_bbox/cache/case_N_bbox.json
```

---

### Phase 2: 좌표 기반 날짜 추출 개선

**파일**: `coordinateBasedDateExtractor.js`

**전략**:
1. **컨텍스트 분석 (Primary)**
   - 키워드 기반 날짜 추출
   - 보험 시작일 vs 만기일 구분
   - 의료 이벤트 식별

2. **좌표 정보 활용 (Secondary)**
   - 테이블 구조 인식 (같은 X 좌표 그룹화)
   - 날짜 블록 병합 ("2024 . 04 . 09" → "2024.04.09")
   - 주변 컨텍스트 확장 (좌표 기반)

3. **누락 방지 로직**
   - 의심스러운 블록 모두 포함
   - GT 유사 패턴 모두 추출

**출력**:
```
backend/eval/output/coordinate_based_extraction/cache/case_N_coord_dates.json
```

---

### Phase 3: GT 매칭율 100% 분석

**파일**: `gtMatchingAnalyzer.js`

**목표**: GT 날짜 매칭율을 100%로 끌어올리기

**분석 내용**:
1. **매칭율 계산**
   - 좌표 기반만
   - Cycle 4 (Vision LLM)만
   - 통합 (좌표 + Cycle 4)

2. **누락 패턴 분석**
   - 어떤 형식의 날짜가 누락되었나?
   - 어떤 문맥에서 누락되었나?
   - 좌표 정보가 있었다면 찾을 수 있었나?

3. **개선 제안 생성**
   - 패턴별 개선 제안
   - 컨텍스트별 개선 제안

**출력**:
```
backend/eval/output/gt_matching_analysis/gt_matching_analysis.json
backend/eval/output/gt_matching_analysis/reports/gt_matching_analysis.html
```

---

### Phase 4: 연관성 기반 우선순위 정렬

**파일**: `relevanceBasedRanker.js`

**목표**: 노이즈 삭제 대신 연관성 높은 데이터 우선 제공

**처리 과정**:
1. **연관성 점수 계산**
   - GT 매칭 + 중요도 + 컨텍스트 + 신뢰도
2. **등고선 레벨 할당**
   - 5단계 레벨링 (L1~L5)
3. **점수순 정렬**
   - 높은 점수 날짜 먼저 제공

**출력**:
```
backend/eval/output/relevance_ranking/relevance_ranking.json
backend/eval/output/relevance_ranking/reports/relevance_ranking.html
```

---

## 실행 방법

### 1. 전체 검증 실행 (권장)

모든 단계를 순차적으로 실행하고 최종 보고서 생성:

```bash
node backend/eval/runComprehensiveValidation.js
```

**소요 시간**: 약 30-60분 (10개 케이스 기준)

**결과**:
- 각 Phase별 실행 결과 출력
- 최종 종합 HTML 보고서 생성
- GT 매칭율 100% 달성 여부 확인

---

### 2. 개별 Phase 실행

필요한 Phase만 선택적으로 실행:

#### Phase 1: bbox 좌표 추출
```bash
node backend/eval/extractGoogleOCRBbox.js
```

#### Phase 2: 좌표 기반 날짜 추출
```bash
node backend/eval/coordinateBasedDateExtractor.js
```

#### Phase 3: GT 매칭 분석
```bash
node backend/eval/gtMatchingAnalyzer.js
```

#### Phase 4: 연관성 순위
```bash
node backend/eval/relevanceBasedRanker.js
```

---

## 출력 결과

### 디렉토리 구조

```
backend/eval/output/
├── google_ocr_bbox/
│   ├── cache/                        # bbox 좌표 캐시
│   │   ├── case_2_bbox.json
│   │   ├── case_5_bbox.json
│   │   └── ...
│   └── bbox_extraction_summary.json
│
├── coordinate_based_extraction/
│   ├── cache/                        # 좌표 기반 추출 결과
│   │   ├── case_2_coord_dates.json
│   │   └── ...
│   └── coord_extraction_summary.json
│
├── gt_matching_analysis/
│   ├── reports/
│   │   └── gt_matching_analysis.html  # GT 매칭 분석 보고서
│   └── gt_matching_analysis.json
│
├── relevance_ranking/
│   ├── reports/
│   │   └── relevance_ranking.html     # 연관성 순위 보고서
│   └── relevance_ranking.json
│
└── comprehensive_validation/
    ├── reports/
    │   └── comprehensive_validation_report.html  # 최종 종합 보고서
    └── validation_summary.json
```

### 주요 보고서

#### 1. GT 매칭 분석 보고서
`backend/eval/output/gt_matching_analysis/reports/gt_matching_analysis.html`

**내용**:
- 케이스별 GT 매칭율 (좌표 기반 vs Cycle 4 vs 통합)
- 누락된 GT 날짜 목록
- 누락 패턴 분석
- 개선 제안

#### 2. 연관성 순위 보고서
`backend/eval/output/relevance_ranking/reports/relevance_ranking.html`

**내용**:
- 레벨별 날짜 분포
- 상위 20개 날짜 (연관성 순)
- 점수 구성 상세
- GT 날짜 포함 여부

#### 3. 최종 종합 보고서
`backend/eval/output/comprehensive_validation/reports/comprehensive_validation_report.html`

**내용**:
- 전체 실행 요약
- Phase별 성공/실패 여부
- GT 매칭율 종합
- 연관성 순위 요약
- 결론 및 다음 단계

---

## 기대 효과

### GT 매칭율 100% 달성

| 단계 | GT 매칭율 | 추출 날짜 수 | 비고 |
|------|-----------|--------------|------|
| **현재 (Cycle 4)** | 58% | 179개 | Vision LLM만 사용 |
| **Phase 1+2** | 80%+ | 200개+ | Google OCR bbox 활용 |
| **Phase 3** | **100%** | 220개+ | 누락 방지 로직 강화 |
| **Phase 4** | 100% | 220개+ | 우선순위 정렬 추가 |

### 연관성 기반 우선순위 제공

- **L1 (GT 필수)**: GT 날짜 + 높은 연관성 → 사용자에게 최우선 제공
- **L2-L3**: 연관성 높은 날짜 → 사용자가 검토할 가치 있음
- **L4-L5**: 낮은 연관성 → 참고용

**사용자 경험 개선**:
- 의미있는 날짜부터 먼저 표시
- GT 날짜 100% 포함 보장
- 추가 날짜는 연관성 순으로 제공

---

## 다음 단계

### GT 매칭율 100% 달성 시

1. ✅ **실제 파이프라인 통합**
   - 좌표 기반 추출 로직을 파이프라인에 통합
   - 연관성 점수 계산 모듈 추가

2. ✅ **프로덕션 배포**
   - 10개 케이스 검증 완료 후 47개 전체 확대
   - 성능 최적화 및 비용 분석

3. ✅ **사용자 피드백 수집**
   - 실제 사용자 데이터로 재검증
   - 연관성 점수 가중치 조정

### GT 매칭율 미달성 시

1. ⚠️  **누락 패턴 심화 분석**
   - 누락된 날짜의 공통 패턴 식별
   - 형식별, 문맥별 누락 원인 파악

2. ⚠️  **추출 로직 강화**
   - 정규식 패턴 확장
   - 키워드 탐색 범위 확대
   - 좌표 기반 테이블 인식 개선

3. ⚠️  **재검증 및 반복**
   - 개선된 로직으로 재실행
   - 100% 달성까지 반복

---

## 기술 상세

### 좌표 정보 활용 예시

#### 테이블 구조 인식
```javascript
// 같은 X 좌표의 블록들을 하나의 열로 그룹화
const columns = detectTableColumns(blocks);

// 예: "일자" 열의 모든 날짜 추출
const dateColumn = columns.find(col => col.blocks[0].text.includes('일자'));
const tableDates = dateColumn.blocks.slice(1).map(block => extractDate(block.text));
```

#### 텍스트 병합
```javascript
// 분리된 날짜 블록 병합: "2024 . 04 . 09" → "2024.04.09"
const merged = mergeFragmentedDates(blocks);
```

### 연관성 점수 계산 예시

```javascript
// Case 2의 예시 날짜
{
  date: "2024-04-09",
  relevanceScore: 165,
  scoreBreakdown: {
    gtMatch: 100,        // GT에 포함됨
    importance: 50,      // critical (보험 가입일)
    context: 15,         // "보험" 키워드 주변
    confidence: 10       // OCR 신뢰도 100%
  },
  level: {
    name: "L1 - GT 필수",
    color: "#4CAF50",
    priority: 1
  }
}
```

---

## 문의 및 지원

- **문제 발생 시**: 각 Phase의 에러 메시지 확인
- **캐시 삭제 후 재실행**: 각 Phase의 캐시 디렉토리 삭제
- **추가 개선사항**: 사용자 피드백을 반영하여 지속적으로 개선

---

**작성일**: 2026-01-31
**버전**: 1.0
**작성자**: Claude (사용자 피드백 기반 구현)
