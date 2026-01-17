# GPT-4o-mini vs Gemini Flash 비교 분석 보고서

**날짜**: [실행 날짜]
**분석 대상**: 난이도별 6개 케이스
**목적**: LLM 모델 간 성능 및 비용 효율성 비교

---

## 📋 요약

### 주요 지표

| 항목 | GPT-4o-mini | Gemini Flash | 차이 |
|------|-------------|--------------|------|
| 평균 날짜 포함률 | [XX.X%] | [XX.X%] | [±X.X%] |
| 평균 단어 수 | [XXX] | [XXX] | [±XX] |
| 총 토큰 사용량 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 총 비용 | [$X.XX] | [$X.XX] | [±$X.XX] |
| 평균 응답 시간 | [X.Xs] | [X.Xs] | [±X.Xs] |

### 결론

- **성능**: [어느 모델이 더 우수한지]
- **비용**: [어느 모델이 더 경제적인지]
- **권장 사항**: [실무 적용 시 권장 모델]

---

## 📊 난이도별 상세 비교

### 상 (High Quality) - 100% 날짜 정확도

#### 1. KB손해보험_김태형_안정형_협심증_

| 항목 | Baseline | GPT-4o-mini | Gemini Flash |
|------|----------|-------------|--------------|
| 날짜 수 | 52 | [XX] | [XX] |
| 포함률 | - | [XX.X%] | [XX.X%] |
| 누락 날짜 | - | [X개] | [X개] |
| 단어 수 | - | [XXX] | [XXX] |
| 섹션 수 | - | [XX] | [XX] |

**날짜 정확도**:
- GPT-4o-mini: ✅/❌ (누락: [날짜 목록])
- Gemini Flash: ✅/❌ (누락: [날짜 목록])

**내용 품질**:
- 구조화 수준: [평가]
- 의료 용어 정확도: [평가]
- 보고서 완성도: [평가]

**비고**: [특이사항]

---

#### 2. 현대해상_조윤아_태아보험__엄마_이주희_

[동일 형식 반복]

---

### 중 (Medium Quality) - 80-97% 날짜 정확도

#### 1. 이정희

[동일 형식]

#### 2. 장유찬

[동일 형식]

---

### 하 (Low Quality) - <80% 날짜 정확도

#### 1. 농협손해보험_김인화_후유장해_

[동일 형식]

#### 2. 농협손해보험_이광욱_고지의무_위반_심질환_

[동일 형식]

---

## 💰 비용 분석

### 토큰 사용량

| 케이스 | GPT-4o-mini (토큰) | Gemini Flash (토큰) | 차이 |
|--------|-------------------|---------------------|------|
| KB손해보험_김태형 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 현대해상_조윤아 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 이정희 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 장유찬 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 농협손해보험_김인화 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| 농협손해보험_이광욱 | [XXX,XXX] | [XXX,XXX] | [±XX,XXX] |
| **합계** | **[XXX,XXX]** | **[XXX,XXX]** | **[±XX,XXX]** |

### 비용 계산

**GPT-4o-mini** ($0.150 / 1M input tokens, $0.600 / 1M output tokens)
- Input: [XXX,XXX] tokens × $0.150 / 1M = $[X.XX]
- Output: [XXX,XXX] tokens × $0.600 / 1M = $[X.XX]
- **총액**: $[X.XX]

**Gemini Flash** ($0.075 / 1M input tokens, $0.300 / 1M output tokens)
- Input: [XXX,XXX] tokens × $0.075 / 1M = $[X.XX]
- Output: [XXX,XXX] tokens × $0.300 / 1M = $[X.XX]
- **총액**: $[X.XX]

**비용 절감**: $[X.XX] ([XX%] 절감)

---

## ⚡ 성능 분석

### 응답 시간

| 케이스 | GPT-4o-mini | Gemini Flash | 차이 |
|--------|-------------|--------------|------|
| KB손해보험_김태형 | [X.Xs] | [X.Xs] | [±X.Xs] |
| 현대해상_조윤아 | [X.Xs] | [X.Xs] | [±X.Xs] |
| 이정희 | [X.Xs] | [X.Xs] | [±X.Xs] |
| 장유찬 | [X.Xs] | [X.Xs] | [±X.Xs] |
| 농협손해보험_김인화 | [X.Xs] | [X.Xs] | [±X.Xs] |
| 농협손해보험_이광욱 | [X.Xs] | [X.Xs] | [±X.Xs] |
| **평균** | **[X.Xs]** | **[X.Xs]** | **[±X.Xs]** |

---

## 🎯 품질 비교

### 날짜 추출 정확도

| 난이도 | GPT-4o-mini | Gemini Flash | 우수 모델 |
|--------|-------------|--------------|-----------|
| 상 (High) | [XX.X%] | [XX.X%] | [모델명] |
| 중 (Medium) | [XX.X%] | [XX.X%] | [모델명] |
| 하 (Low) | [XX.X%] | [XX.X%] | [모델명] |
| **전체 평균** | **[XX.X%]** | **[XX.X%]** | **[모델명]** |

### 내용 품질 평가

**구조화 수준** (5점 만점)
- GPT-4o-mini: [X.X] / 5.0
- Gemini Flash: [X.X] / 5.0

**의료 용어 정확도** (5점 만점)
- GPT-4o-mini: [X.X] / 5.0
- Gemini Flash: [X.X] / 5.0

**보고서 완성도** (5점 만점)
- GPT-4o-mini: [X.X] / 5.0
- Gemini Flash: [X.X] / 5.0

---

## 📈 난이도별 성능 차이

### 상 (High Quality) 케이스

- **날짜 정확도**: [분석]
- **내용 품질**: [분석]
- **비용 효율**: [분석]

### 중 (Medium Quality) 케이스

- **날짜 정확도**: [분석]
- **내용 품질**: [분석]
- **비용 효율**: [분석]

### 하 (Low Quality) 케이스

- **날짜 정확도**: [분석]
- **내용 품질**: [분석]
- **비용 효율**: [분석]

---

## 🔍 세부 분석

### 1. 날짜 추출 오류 패턴

**GPT-4o-mini**:
- 오류 유형: [목록]
- 빈도: [통계]
- 원인 분석: [분석]

**Gemini Flash**:
- 오류 유형: [목록]
- 빈도: [통계]
- 원인 분석: [분석]

### 2. 내용 생성 차이

**GPT-4o-mini 특징**:
- [특징 1]
- [특징 2]
- [특징 3]

**Gemini Flash 특징**:
- [특징 1]
- [특징 2]
- [특징 3]

### 3. 보고서 구조 비교

**GPT-4o-mini**:
- 평균 섹션 수: [XX]
- 평균 단어 수: [XXX]
- 구조화 수준: [평가]

**Gemini Flash**:
- 평균 섹션 수: [XX]
- 평균 단어 수: [XXX]
- 구조화 수준: [평가]

---

## 💡 결론 및 권장 사항

### 종합 평가

1. **성능**:
   - [평가]

2. **비용**:
   - [평가]

3. **안정성**:
   - [평가]

### 사용 시나리오별 권장 모델

1. **고정밀 분석이 필요한 경우**:
   - 권장: [모델명]
   - 이유: [설명]

2. **비용 절감이 우선인 경우**:
   - 권장: [모델명]
   - 이유: [설명]

3. **대량 처리가 필요한 경우**:
   - 권장: [모델명]
   - 이유: [설명]

### 개선 제안

1. [제안 1]
2. [제안 2]
3. [제안 3]

---

## 📎 부록

### A. 실행 환경

- OS: Linux
- Node.js: [버전]
- TypeScript: [버전]
- OpenAI SDK: [버전]
- Google Generative AI SDK: [버전]

### B. 데이터 경로

- 원본 데이터: `/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T02-18-51-219Z/`
- GPT-4o-mini 결과: `/home/user/VNEXSUS-25-12-30/outputs/validation-full/`
- Gemini Flash 결과: `/home/user/VNEXSUS-25-12-30/outputs/gemini-comparison/`

### C. 검증 스크립트

- 날짜 검증: `scripts/validate-gemini-comparison.py`
- 실행 스크립트: `scripts/run-gemini-comparison.sh`

---

**보고서 작성일**: [날짜]
**작성자**: Claude Code Automation
