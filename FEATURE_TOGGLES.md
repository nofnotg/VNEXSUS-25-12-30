# VNEXSUS 기능 토글 현황

**최종 업데이트:** 2026-02-15
**목적:** 개발 시 혼동 방지를 위한 기능 ON/OFF 상태 명시

---

## 🎯 현재 활성화된 기능 (ON)

### ✅ Google Cloud Vision OCR (메인 OCR 엔진)
```env
ENABLE_VISION_OCR=true
USE_VISION=true
ENABLE_VISION_IMAGE_FALLBACK=true
```
- **역할:** 메인 OCR 엔진 (확정됨)
- **인증:** `GOOGLE_CLOUD_VISION_API_KEY` 사용
- **구현 위치:** `backend/services/visionService.js`
- **상태:** ✅ 활성화

### ✅ LLM 보고서 생성 (GPT-4o-mini)
```env
OPENAI_MODEL=gpt-4o-mini
```
- **역할:** 10항목 구조화 보고서 생성 (JSON 모드)
- **엔드포인트:** `POST /api/dna-report/generate`
- **옵션:** `useNineItem: true` → 9항목 보고서 생성
- **구현 위치:** `backend/routes/dnaReportRoutes.js`

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

### ❌ Vision LLM (GPT-4o Vision) OCR
```env
# USE_VISION_LLM 설정 없음 (비활성화)
```
- **이유:** Google Cloud Vision OCR 사용으로 결정됨
- **구현 위치:** `backend/services/visionLLMService.js`
- **주의:** 코드 삭제하지 말 것 (향후 활용 가능)

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
- **이유:** 사용 보류 (Phase 3+ 예정)
- **우선순위:** Phase 3+ 예정
- **구현 위치:** `src/dna-engine/`, `backend/controllers/dnaEngineController.js`
- **상태:** 5% 미만 구현, 라우트 스텁만 존재

---

## 📊 기능 비교표

| 기능 | 상태 | 환경변수 | 이유 |
|------|------|----------|------|
| Google Vision OCR | ✅ ON | `ENABLE_VISION_OCR=true` | 메인 OCR (확정) |
| Vision LLM (GPT-4o) | ❌ OFF | 미설정 | 보류 |
| AWS Textract | ❌ OFF | `USE_TEXTRACT=false` | 미사용 |
| DNA 시퀀싱 | ❌ OFF | `ENABLE_DNA_SEQUENCING=false` | 보류 |
| 코어 엔진 | ✅ ON | `USE_CORE_ENGINE=true` | 고지의무 분석 |
| LLM 보고서 (gpt-4o-mini) | ✅ ON | `OPENAI_MODEL=gpt-4o-mini` | 보고서 생성 |

---

## 🔄 OCR 파이프라인

### 현재 (Google Vision OCR)
```
PDF → pdfProcessor.js → Google Cloud Vision OCR → {text, bbox} → 날짜/의료정보 추출
이미지 → visionService.extractTextFromImage() → Google Cloud Vision OCR → text
```
- bbox 좌표 제공
- Google Cloud Vision API 인증 필요

### 보고서 생성 파이프라인
```
OCR Text → POST /api/dna-report/generate
         → GPT-4o-mini (JSON 구조화 모드)
         → StructuredReportGenerator (10항목 텍스트 변환)
         → (선택) NineItemReportGenerator (9항목 보고서)
         → 최종 보고서 반환
```

- **기본 모드** (`useStructuredJson: true`, 기본값): 10항목 구조화 보고서
- **9항목 모드** (`useNineItem: true`): 9항목 보고서가 `report` 필드에 반환됨

---

## ⚠️ 개발 시 주의사항

1. **Vision LLM 코드 삭제 금지**
   - 향후 활용 가능
   - `backend/services/visionLLMService.js` 보존

2. **DNA 시퀀싱 코드 수정 금지**
   - 현재 보류 상태
   - `src/dna-engine/` 보존

3. **환경변수 변경 시 이 문서 업데이트**
   - 기능 토글 변경 시 반드시 이 문서 수정

4. **확정 조건 (변경 금지)**
   - OCR: Google Vision OCR
   - LLM (보고서 생성): gpt-4o-mini
   - DNA 시퀀싱: OFF (보류)

---

## 🐛 수정된 버그 (2026-02-15)

1. **PostProcessingManager 싱글톤 오용** (`ocrController.js`)
   - 문제: `new PostProcessingManager()` 호출 → `TypeError: PostProcessingManager is not a constructor`
   - 원인: `postprocess/index.js`가 싱글톤 인스턴스를 export하는데 생성자로 호출
   - 수정: `postProcessingManager.processOCRResult()` 직접 호출로 변경

2. **9항목 보고서 텍스트 응답 누락** (`dnaReportRoutes.js`)
   - 문제: `useNineItem: true` 옵션 사용 시 9항목 보고서가 `report` 필드에 포함되지 않음
   - 원인: `useStructuredJson=true`(기본값)이 9항목 보고서보다 우선순위가 높았음
   - 수정: `useNineItem: true`일 때 9항목 보고서가 `finalReport`로 사용되도록 우선순위 변경

3. **FEATURE_TOGGLES.md와 .env 불일치**
   - 문제: FEATURE_TOGGLES.md에 Google Vision OFF로 표기되어 있었으나 실제로 ON이어야 함
   - 수정: FEATURE_TOGGLES.md를 실제 설정에 맞게 업데이트

---

**작성일:** 2026-02-15
**작성자:** 개발팀
