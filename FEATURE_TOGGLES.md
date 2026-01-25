# VNEXSUS 기능 토글 현황

**최종 업데이트:** 2026-01-24  
**목적:** 개발 시 혼동 방지를 위한 기능 ON/OFF 상태 명시

---

## 🎯 현재 활성화된 기능 (ON)

### ✅ Vision LLM (GPT-4o Vision)
```env
USE_VISION_LLM=true
DEFAULT_OCR_PROVIDER=gpt-4o-vision
```
- **역할:** 메인 OCR 엔진
- **기술:** GPT-4o의 Vision 기능
- **장점:**
  - 표 구조 95% 인식 (vs Google OCR 70%)
  - 글자 공백 자동 처리 ("보 험 기 간" → "보험기간")
  - bbox 좌표 불필요 (문맥 이해 기반)
- **구현 위치:** 
  - TypeScript: `src/modules/medical-analysis/providers/ocr/GPT4oVisionProvider.ts`
  - JavaScript: `backend/services/visionLLMService.js` ✅ 통합 완료
- **상태:** ✅ JavaScript 백엔드 통합 완료 (2026-01-24)

### ✅ 코어 엔진
```env
USE_CORE_ENGINE=true
```
- **역할:** 고지의무 분석 핵심 로직
- **구현 위치:** `backend/postprocess/`

### ✅ 고지의무 분석
```env
DISCLOSURE_WINDOWS=3m,2y,5y
```
- **역할:** 3개월/2년/5년 기준 고지의무 분석
- **우선순위:** A-B-C 계획의 핵심 목표

---

## 🔴 비활성화된 기능 (OFF)

### ❌ Google Cloud Vision OCR (레거시)
```env
ENABLE_VISION_OCR=false
USE_VISION=false
ENABLE_VISION_IMAGE_FALLBACK=false
```
- **이유:** Vision LLM(GPT-4o)으로 대체됨
- **보존 이유:** 
  - 향후 Ensemble 방식 (OCR + LLM 병합) 활용 가능
  - bbox 좌표가 필요한 경우 fallback으로 사용 가능
- **구현 위치:** `backend/services/visionService.js`
- **주의:** 코드 삭제하지 말 것

### ❌ AWS Textract
```env
USE_TEXTRACT=false
```
- **이유:** 미사용
- **구현 위치:** `backend/services/textractService.js` (스텁)

### ❌ DNA 시퀀싱 엔진
```env
ENABLE_DNA_SEQUENCING=false
```
- **이유:** A-B-C 계획에 따라 보류
- **우선순위:** Phase 3+ 예정
- **구현 위치:** `src/dna-engine/`
- **상태:** 5% 미만 구현, 라우트 스텁만 존재

---

## 📊 기능 비교표

| 기능 | 상태 | 환경변수 | 이유 |
|------|------|----------|------|
| Vision LLM (GPT-4o) | ✅ ON | `USE_VISION_LLM=true` | 메인 OCR |
| Google Vision OCR | ❌ OFF | `ENABLE_VISION_OCR=false` | Vision LLM으로 대체 |
| AWS Textract | ❌ OFF | `USE_TEXTRACT=false` | 미사용 |
| DNA 시퀀싱 | ❌ OFF | `ENABLE_DNA_SEQUENCING=false` | 보류 |
| 코어 엔진 | ✅ ON | `USE_CORE_ENGINE=true` | 고지의무 분석 |

---

## 🔄 OCR 파이프라인 비교

### 이전 (Google Vision OCR)
```
PDF → 이미지 변환 → Google Vision OCR → {text, bbox} → 좌표 기반 정렬 → 날짜 추출
```
- bbox 좌표 제공
- 표 인식 70%
- 글자 공백 "보 험 기 간"

### 현재 (Vision LLM + Poppler)
```
PDF → Poppler(pdftoppm) 이미지 변환 → GPT-4o Vision → {text only} → 문맥 기반 추출 → 날짜 추출
```
- bbox 좌표 없음 (불필요)
- 표 인식 95%
- 글자 공백 자동 처리
- Poppler: 안정적인 PDF→이미지 변환 (Playwright 대체)

---

## ⚠️ 개발 시 주의사항

1. **Google Vision OCR 코드 삭제 금지**
   - 향후 Ensemble 방식으로 활용 가능
   - `backend/services/visionService.js` 보존

2. **DNA 시퀀싱 코드 수정 금지**
   - 현재 보류 상태
   - `src/dna-engine/` 보존

3. **Vision LLM 통합 작업 필요**
   - TypeScript → JavaScript 통합 필요
   - `GPT4oVisionProvider.ts` 백엔드 연결 작업 진행 중

4. **환경변수 변경 시 이 문서 업데이트**
   - 기능 토글 변경 시 반드시 이 문서 수정

---

## 📋 향후 계획

### Phase 1: Vision LLM 통합 ✅ 완료 (2026-01-24)
- [x] GPT4oVisionProvider TypeScript → JavaScript 통합
- [x] 백엔드 API 라우트 연결
- [x] visionLLMService.js 생성
- [x] pdfProcessor.js 통합
- [x] simple-server.js 업데이트
- [x] E2E 테스트 ✅ (Poppler + GPT-4o Vision 성공)

### Phase 2: A-B-C 계획 실행 ✅ 완료 (2026-01-24)
- [x] T04: 기본 점수함수 구현 ✅ (`eventScoringEngine.js`)
- [x] T05: 절대규칙 보완 ✅ (`criticalRiskRules.js`)
- [x] T08: 보고서 템플릿 ✅ (`disclosureReportBuilder.js`)
- [x] T09: 안전모드 로직 ✅ (`safeModeGuard.js`)

### Phase 3+: DNA 시퀀싱 (보류)
- 고지의무 분석 90% 달성 후 재검토

---

**작성일:** 2026-01-24  
**작성자:** 개발팀
