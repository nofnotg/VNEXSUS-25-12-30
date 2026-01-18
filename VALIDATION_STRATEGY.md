# 의료 문서 날짜 검증 전략

**작성일**: 2026-01-17
**목적**: 전체집합 날짜 100% 포함 달성을 위한 실용적 개선 전략

---

## 📊 절대적 품질 기준

### 품질 등급 정의

| 등급 | 정확도 | 프로덕션 상태 | 조치 |
|------|--------|--------------|------|
| **상** | 80-100% | ✅ 배포 가능 | 현상 유지, 모니터링 |
| **중** | 60-79% | ⚠️ 개선 권장 | 프롬프트/로직 개선 |
| **하** | <60% | ❌ 배포 불가 | 집중 분석 및 개선 필수 |

### 목표 설정

**단계별 목표**:
1. **Phase 1 (1주)**: 하 등급 제거 → 전체 60% 이상
2. **Phase 2 (1개월)**: 중 등급 70% → 상 등급으로 전환
3. **Phase 3 (3개월)**: 전체 80% 이상 (상향평준화 완료)

---

## 🔍 Step 1: 현황 측정

### 실행 계획

```bash
# 주력 모델(gpt-4o-mini)로 28개 전체 실행
npm run realtime:llm:batch -- --model gpt-4o-mini --cases 28

# 날짜 검증
python3 scripts/validate-dates-all.py

# 결과: 각 케이스별 정확도 측정
```

### 예상 결과 (기존 7개 케이스 기준 추정)

```
상 (80-100%): ~8개 (28.6% → 예상)
중 (60-79%): ~8개 (28.6% → 예상)
하 (<60%): ~12개 (42.8% → 예상)
```

**비용**: $0.016, **시간**: 3분

---

## 🔬 Step 2: 근본 원인 분석 (RCA)

### 실패 원인 분류

**하 등급 케이스들의 공통점 분석**:

#### 원인 A: OCR 오류 (우리가 못 고침)
```
예시:
- 2025-03-45 (3월은 31일까지)
- 2049-03-24 (미래 날짜)
- 2502-00-37 (완전히 망가진 날짜)

원인: Google Vision API의 문자 인식 오류
해결: Vision API로는 불가, 후처리 검증 로직 필요
```

#### 원인 B: 날짜 형식 다양성 (쉽게 고칠 수 있음)
```
예시:
- YYYY-MM-DD
- YYYY.MM.DD
- YYYY/MM/DD
- YYYY년 MM월 DD일

원인: 정규화 로직 부족
해결: 날짜 파싱 로직 강화 (코드 수정, 비용 $0)
```

#### 원인 C: LLM 추출 실패 (프롬프트 개선으로 해결)
```
예시:
- 날짜가 문서에 있지만 LLM이 누락
- 맥락 이해 실패 (예: "3일 후" → 구체적 날짜 미산출)

원인: 프롬프트 불명확, 컨텍스트 윈도우 부족
해결: 프롬프트 개선, LLM 모델 교체 고려
```

#### 원인 D: Baseline 품질 문제 (데이터 이슈)
```
예시:
- Baseline에 날짜가 없는데 생성 보고서에 있음
- Baseline 자체가 불완전

원인: 데이터 품질
해결: Baseline 재생성 또는 제외
```

### RCA 실행 계획

```python
# 하 등급 케이스만 집중 분석
for case in low_quality_cases:
    # 1. Baseline 날짜 추출
    baseline_dates = extract_dates(baseline_report)

    # 2. 생성 보고서 날짜 추출
    generated_dates = extract_dates(generated_report)

    # 3. 누락된 날짜 분석
    missing_dates = baseline_dates - generated_dates

    # 4. 누락 날짜의 원인 분류
    for date in missing_dates:
        if is_impossible_date(date):  # 2025-03-45
            → 원인 A: OCR 오류
        elif date in ocr_text but not in generated:
            → 원인 C: LLM 추출 실패
        elif date format varies:
            → 원인 B: 형식 다양성
        else:
            → 원인 D: Baseline 품질
```

**비용**: $0 (분석만), **시간**: 30분 (수동 분석)

---

## 🛠️ Step 3: 개선 우선순위

### Quick Win (1일 이내, 비용 $0)

**1. 날짜 정규화 로직 강화**
```typescript
// Before
const datePattern = /\d{4}-\d{2}-\d{2}/;

// After
const datePattern = /\d{4}[-./년]\d{1,2}[-./월]\d{1,2}/;
function normalizeDate(text: string): string {
  // YYYY.MM.DD → YYYY-MM-DD
  // YYYY년 MM월 DD일 → YYYY-MM-DD
  // ...
}
```

**예상 효과**: 하 등급 20% → 중 등급으로 상승

**2. 날짜 유효성 검증**
```typescript
function validateDate(dateStr: string): boolean {
  const date = new Date(dateStr);

  // 불가능한 날짜 필터링
  if (date.getFullYear() < 1900 || date.getFullYear() > 2030) return false;
  if (date.getMonth() > 11) return false;
  if (date.getDate() > 31) return false;

  return true;
}
```

**예상 효과**: OCR 오류 날짜 자동 제거, 노이즈 감소

### Medium Win (1주 이내, 비용 ~$0.02)

**3. LLM 프롬프트 개선**
```typescript
// Before
"의료 문서에서 날짜를 추출하세요"

// After
"의료 문서에서 모든 진료/검사/입원 날짜를 YYYY-MM-DD 형식으로 추출하세요.
주의사항:
- 상대적 표현(3일 후, 지난주)은 구체적 날짜로 변환
- 모든 날짜 형식(YYYY.MM.DD, YYYY/MM/DD)을 표준화
- 중복 제거
- 시간순 정렬"
```

**예상 효과**: LLM 추출 성공률 10-20% 향상

### Hard Win (1개월 이내, 비용 ~$0.05)

**4. LLM 날짜 교정 파이프라인**
```typescript
// OCR 오류 날짜를 LLM이 보정하도록 시도
function correctOCRDateErrors(ocrText: string, llmDates: Set<string>): Set<string> {
  const impossibleDates = llmDates.filter(d => !validateDate(d));

  // LLM에게 교정 요청
  const correctionPrompt = `
    다음 날짜들은 OCR 오류로 보입니다:
    ${impossibleDates.join(', ')}

    원본 텍스트: ${ocrText}

    각 날짜의 올바른 값을 추정하세요.
  `;

  // LLM 호출하여 교정
  const correctedDates = await llm.correct(correctionPrompt);

  return correctedDates;
}
```

**예상 효과**: OCR 오류 케이스 30-50% 개선

---

## 🔄 Step 4: 모델 비교 (선택적)

### 언제 모델 비교가 필요한가?

**조건**:
- Step 3의 Quick/Medium Win을 적용했는데도
- 하 등급이 여전히 30% 이상 남아있을 때

**목적**:
- "다른 모델이 OCR 오류를 더 잘 보정하는가?"
- "프롬프트 개선만으로 부족한가?"

### 모델 비교 전략

**전체 비교 필요 없음!**

```bash
# 하 등급 대표 케이스만 선별 (5개)
# 선별 기준:
# - OCR 오류 많은 케이스: 2개
# - LLM 추출 실패 케이스: 2개
# - 복합 원인 케이스: 1개

# 3개 모델로 실행
cases = [case1, case2, case3, case4, case5]
models = ['gpt-4o-mini', 'gemini-2.0-flash-exp', 'claude-3-5-haiku']

for case in cases:
    for model in models:
        run_pipeline(case, model)
```

**비용**: $0.01, **시간**: 1분

**결과 해석**:
- 모델 간 차이 <5% → 문제는 데이터 품질, 모델 교체 불필요
- 모델 간 차이 >15% → 특정 모델이 우수, 교체 고려
- 모델 간 차이 5-15% → 케이스별로 최적 모델 다름, 앙상블 고려

---

## 🎯 Step 5: 재검증 및 효과 측정

### 개선 효과 측정

```bash
# Before
python3 scripts/validate-dates-all.py --baseline

# 개선안 적용
# ...

# After
python3 scripts/validate-dates-all.py --improved

# 비교
python3 scripts/compare-validation-results.py
```

### 성공 기준

**Phase 1 목표 (1주)**:
- ❌ Before: 상 8개, 중 8개, 하 12개
- ✅ After: 상 15개, 중 10개, 하 3개

**개선률**: 하 등급 75% 감소 (12→3)

**Phase 2 목표 (1개월)**:
- ✅ After: 상 22개, 중 6개, 하 0개

**개선률**: 하 등급 100% 제거

---

## 💡 왜 이 전략이 실용적인가?

### 1. 비용 효율

| 단계 | 비용 | 효과 |
|------|------|------|
| Step 1 (현황) | $0.016 | 전체 파악 |
| Step 2 (RCA) | $0 | 원인 파악 |
| Step 3 (개선) | $0.02 | **70-80% 개선** |
| Step 4 (모델 비교) | $0.01 | 추가 10-20% |
| **총합** | **$0.046** | **90% 개선** |

vs. 전체 모델 비교: $0.084, 효과 불확실

### 2. 실행 가능성

- Quick Win은 코드 수정만으로 즉시 적용 가능
- Medium Win은 1주 내 완료 가능
- Hard Win은 선택적으로 진행

### 3. 확장 가능성

- 케이스가 100개, 1000개로 늘어나도 동일한 전략 적용
- RCA 기반이므로 재발 방지 가능
- 개선 효과 측정 가능

### 4. 프로덕션 적용성

- 프로덕션에서는 한 모델만 사용
- 따라서 그 모델의 성능을 극대화하는 게 우선
- 모델 교체는 마지막 수단

---

## 🚀 실행 계획

### 즉시 실행 (오늘)

1. **Step 1: 현황 측정**
   ```bash
   bash scripts/run-validation-full.sh
   python3 scripts/validate-dates-all.py
   ```
   - 28개 케이스 gpt-4o-mini 실행
   - 절대적 기준으로 분류
   - 비용: $0.016, 시간: 3분

2. **Step 2: RCA**
   - 하 등급 케이스 실패 원인 분류
   - OCR 오류 vs LLM 실패 구분
   - 시간: 30분

### 1일 내 (내일)

3. **Step 3-1: Quick Win 적용**
   - 날짜 정규화 로직 구현
   - 날짜 유효성 검증 추가
   - 재검증
   - 시간: 2시간

### 1주 내 (필요시)

4. **Step 3-2: Medium Win 적용**
   - LLM 프롬프트 개선
   - 재검증
   - 시간: 4시간

5. **Step 4: 모델 비교 (선택)**
   - 하 등급 여전히 많으면 실행
   - 5개 케이스 × 3모델
   - 시간: 1시간

---

## 📊 예상 결과

### Before (현재, 추정)
```
상 (80-100%):  8개 (28.6%)
중 (60-79%):   8개 (28.6%)
하 (<60%):    12개 (42.8%)
평균 정확도: 65%
```

### After Step 3-1 (Quick Win)
```
상 (80-100%): 15개 (53.6%)
중 (60-79%):  10개 (35.7%)
하 (<60%):     3개 (10.7%)
평균 정확도: 78% ↑ +13%
```

### After Step 3-2 (Medium Win)
```
상 (80-100%): 22개 (78.6%)
중 (60-79%):   6개 (21.4%)
하 (<60%):     0개 (0%)
평균 정확도: 86% ↑ +21%
```

### After Step 4 (모델 교체, 선택)
```
상 (80-100%): 25개 (89.3%)
중 (60-79%):   3개 (10.7%)
하 (<60%):     0개 (0%)
평균 정확도: 91% ↑ +26%
```

---

**결론**: 절대적 기준 + RCA 중심 + 단계적 개선이 가장 실용적
