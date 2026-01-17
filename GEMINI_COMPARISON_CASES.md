# Gemini Flash 비교 분석 대상 케이스

**날짜**: 2026-01-17
**목적**: gpt-4o-mini vs gemini-1.5-flash 성능 비교

## 선별 기준

날짜 검증 통과율 기준:
- **상(High)**: 100% 통과 - 정확한 날짜 추출
- **중(Medium)**: 80-97% 통과 - 일부 OCR 오류
- **하(Low)**: <80% 통과 - 다수 OCR 오류

## 난이도별 선별 케이스 (총 6개)

### 상 (High Quality) - 2개

1. **KB손해보험_김태형_안정형_협심증_**
   - 날짜 포함률: **100.0%** ✅
   - 부분집합 날짜 수: 52개
   - 전체집합 날짜 수: 52개
   - 매칭: 52/52 (완벽)
   - 특징: OCR 오류 없음, 완벽한 날짜 추출

2. **현대해상_조윤아_태아보험__엄마_이주희_**
   - 날짜 포함률: **100.0%** ✅
   - 부분집합 날짜 수: 38개
   - 전체집합 날짜 수: 38개
   - 매칭: 38/38 (완벽)
   - 특징: OCR 오류 없음, 태아보험 특수 케이스

---

### 중 (Medium Quality) - 2개

1. **이정희**
   - 날짜 포함률: **97.3%** ⚠️
   - 부분집합 날짜 수: 74개
   - 전체집합 날짜 수: 72개
   - 매칭: 72/74
   - 누락: 2025-03-42, 2502-00-37 (OCR 오류 2건)
   - 특징: 많은 날짜 중 2건만 오류

2. **장유찬**
   - 날짜 포함률: **92.9%** ⚠️
   - 부분집합 날짜 수: 14개
   - 전체집합 날짜 수: 13개
   - 매칭: 13/14
   - 누락: 2124-01-10 (OCR 오류 1건)
   - 특징: 고대 날짜(1130년) 포함, OCR 오류 1건

---

### 하 (Low Quality) - 2개

1. **농협손해보험_김인화_후유장해_**
   - 날짜 포함률: **44.4%** ❌
   - 부분집합 날짜 수: 9개
   - 전체집합 날짜 수: 4개
   - 매칭: 4/9
   - 누락: 2025-03-45, 2025-03-49, 2049-03-24, 2059-07-30, 2069-03-24 (OCR 오류 5건)
   - 특징: 심각한 OCR 오류, 미래 날짜 다수

2. **농협손해보험_이광욱_고지의무_위반_심질환_**
   - 날짜 포함률: **83.3%** ⚠️
   - 부분집합 날짜 수: 6개
   - 전체집합 날짜 수: 5개
   - 매칭: 5/6
   - 누락: 2054-10-08 (OCR 오류 1건)
   - 특징: 미래 날짜 OCR 오류

---

## 데이터 위치

**원본 데이터**: `/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T02-18-51-219Z/`

**GPT-4o-mini 결과** (기존): `/home/user/VNEXSUS-25-12-30/outputs/validation-full/`

**Gemini Flash 결과** (신규): `/home/user/VNEXSUS-25-12-30/outputs/gemini-comparison/`

---

## 실행 계획

### 1단계: Gemini Flash 실행 (6개 케이스)

```bash
# 환경변수 설정
export USE_GEMINI=true
export GOOGLE_API_KEY="YOUR_API_KEY"

# 케이스별 실행
npm run realtime:llm -- "KB손해보험_김태형_안정형_협심증_" --output outputs/gemini-comparison
npm run realtime:llm -- "현대해상_조윤아_태아보험__엄마_이주희_" --output outputs/gemini-comparison
npm run realtime:llm -- "이정희" --output outputs/gemini-comparison
npm run realtime:llm -- "장유찬" --output outputs/gemini-comparison
npm run realtime:llm -- "농협손해보험_김인화_후유장해_" --output outputs/gemini-comparison
npm run realtime:llm -- "농협손해보험_이광욱_고지의무_위반_심질환_" --output outputs/gemini-comparison
```

### 2단계: 비교 분석

- 날짜 정확도
- 내용 품질
- LLM 토큰 사용량
- 비용 비교
- 실행 시간

---

## 비교 평가 항목

1. **날짜 검증 통과율 변화**
   - GPT-4o-mini 대비 Gemini Flash의 개선 여부

2. **내용 품질 점수**
   - 구조화 품질
   - 의료 용어 정확도
   - 보고서 완성도

3. **비용 효율성**
   - 토큰당 비용 비교
   - 케이스당 총 비용

4. **실행 성능**
   - 응답 시간
   - 안정성
