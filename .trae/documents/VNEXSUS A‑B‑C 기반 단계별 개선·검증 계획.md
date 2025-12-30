# 목적
- 기존 `VNEXSUS_A-B-C_Execution_Plan`을 기준으로 OCR→정규화→좌표 그라운딩→보고서(9~10항목)→검증→리포트까지 단계별로 개선·정리·검증을 반복해 품질을 고도화.
- 토큰 비용을 줄이기 위해 1~3개 케이스만 실제 OCR 실행하고, 그 결과를 좌표 포함 오프라인 아티팩트로 저장하여 이후 반복 검증에 재사용.

# 기준 문서/출력
- 실행계획: `c:\VNEXSUS_12-07\VNEXSUS_A-B-C_Execution_Plan\report.html`
- 검증 보고서: `c:\VNEXSUS_12-07\reports\VNEXSUS_Report\...\validation_report.html`
- 베이스라인 46개: `c:\VNEXSUS_12-07\src\rag\case_sample`
- 파이프라인 핵심 코드
  - OCR 통합: `backend/utils/pdfProcessor.js:26`
  - Vision OCR/이미지 fallback: `backend/services/visionService.js:200`, `backend/services/visionService.js:261`, `backend/services/visionService.js:518`
  - 블록 추출/정렬: `backend/services/visionService.js:643`
  - 근거 스팬: `backend/postprocess/sourceSpanManager.js:24`, `backend/postprocess/sourceSpanManager.js:134`, `backend/postprocess/sourceSpanManager.js:271`, `backend/postprocess/sourceSpanManager.js:354`
  - 보고서 템플릿(날짜/중복): `backend/postprocess/enhancedReportTemplateEngine.cjs:104`, `backend/postprocess/enhancedReportTemplateEngine.cjs:124`, `backend/postprocess/enhancedReportTemplateEngine.cjs:463`, `backend/postprocess/enhancedReportTemplateEngine.cjs:485`
  - 검증(`report ⊆ vnexsus`): `backend/eval/report_subset_validator.js:202`
  - 50케이스 병렬/실행계획 출력: `backend/tools/batchReprocessCases.js:696`

# 단계별 실행
## Step 1. 오프라인 OCR 아티팩트 설계·생성(1~3 케이스)
- 포맷: Vision JSON 파싱 결과와 호환되는 스키마(`extractBlocksFromJson` 출력과 유사)
- 산출물 경로: `c:\VNEXSUS_12-07\reports\offline_ocr_samples\Case{N}\`
- 파일:
  - `Case{N}_merged.txt` — 병합 텍스트(정규화 공백)
  - `Case{N}_offline_ocr.json` — 좌표 포함 블록/페이지 메타
- 스키마 예시:
  ```json
  {
    "text": "...merged ocr text...",
    "pageCount": 12,
    "pages": [{"page":1,"textLength":12345}],
    "blocks": [{
      "page":1,
      "blockIndex":0,
      "text":"혈액검사 ...",
      "bbox":{"xMin":120,"yMin":540,"xMax":420,"yMax":600,"width":300,"height":60},
      "confidence":0.83
    }],
    "rawFiles": ["offline_ocr/CaseN/page_001.json"],
    "rawPrefix": "offline_ocr/CaseN/"
  }
  ```
- 검증: 텍스트 유효 길이(임계치)·페이지/블록 카운트·bbox 범위 체크

## Step 2. 파이프라인 입력 어댑터(오프라인 OCR 수용)
- 목표: `pdfProcessor.processPdf`가 옵션(`ocrOverride`) 제공 시 오프라인 JSON을 Vision 출력처럼 주입
- 구현 포인트(계획):
  - `backend/utils/pdfProcessor.js:192` 분기 직전에 `options.ocrOverride` 확인→`result.text/pages/blocks/pageCount/ocrSource` 세팅
  - `backend/services/visionService.js` 의 `parse` 경로와 동일한 shape 유지(상호 운용성 보장)
- 검증: 1~3 케이스로 정규화→이벤트→좌표 그라운딩까지 통과

## Step 3. 좌표 그라운딩 정밀화
- 앵커 융합(날짜/병원/진단/ICD/블록 스니펫) 및 날짜 윈도우±500자에서 최적 스팬 선택
- 실패 시 다른 앵커로 재탐색; 누락 사유 축적·보고
- 참조: `backend/postprocess/sourceSpanManager.js:67`, `backend/postprocess/sourceSpanManager.js:134`, `backend/postprocess/sourceSpanManager.js:271`, `backend/postprocess/sourceSpanManager.js:354`
- 검증: 첨부율 ≥95%(소수 케이스), 누락 리스트에 합리적 사유가 기록됨

## Step 4. 보고서(9~10항목) 템플릿/프롬프트 통합
- 날짜 표준화(YYYY.MM.DD), 검사결과 dedupe, 암 수술 후 특례 포맷팅
- 참조: `backend/postprocess/enhancedReportTemplateEngine.cjs:104`, `backend/postprocess/enhancedReportTemplateEngine.cjs:124`, `backend/postprocess/enhancedReportTemplateEngine.cjs:463`, `backend/postprocess/enhancedReportTemplateEngine.cjs:485`
- 검증: 샘플 보고서에서 날짜 일관, 중복 경고/법률문구 억제, 9~10항목이 안정적으로 채워짐

## Step 5. 검증·리포트 생성 자동화(오프라인 입력 지원)
- 베이스라인 46개 기준으로 `report ⊆ vnexsus` 자동 검증
- 실행계획/검증 리포트 오프라인 HTML 출력
- 참조: `backend/eval/report_subset_validator.js:202`, `backend/tools/batchReprocessCases.js:696`
- 검증: PassRate·매칭률 KPI가 상승, 케이스별 상세 표에서 빈 값/중복 제거

## Step 6. 불필요 코드/파일 정리(세이프 체인지)
- 원칙:
  - 중복/구버전 엔진 파일은 `tasks/archive/`로 이동 후 링크만 유지
  - `.disabled` 파일·불사용 라우트 제거 또는 아카이브(`src/gemini-integration/caseValidator.js.disabled:124` 등)
  - `.cjs`/`.js` 이중 구현 정리(우선 유지 버전 지정: `enhancedReportTemplateEngine.cjs`)
  - 로깅 `console.*` 제거→구조화 로거(팀 규칙)
- 검증: lint/typecheck 통과, 실행/테스트 정상, 배치/검증 리포트 생성 정상

# KPI/검증 기준
- OCR 커버리지(오프라인 입력 포함): 100%
- SourceSpan 첨부율: ≥95%
- 베이스라인 46개 PassRate: ≥80% 목표
- 평균 날짜/ICD/병원 매칭률 상승, Top/Bottom 케이스 원인 집계 표시
- 후처리 성능: 평균/95p 시간, 빈 파일 방지 임계치 준수

# 리스크/대안
- Vision 인증/요금: 오프라인 OCR 아티팩트로 재사용·테스트, 이미지 기반 fallback 유지
- 스캔 PDF 난독화: 블록 정규화·다중 앵커 융합, 누락 사유 로깅으로 튜닝 지점 노출
- 프롬프트 변동성: 규칙 우선, LLM은 요약/권고문으로 제한

# 산출물
- `reports/offline_ocr_samples/Case{N}/Case{N}_offline_ocr.json`, `Case{N}_merged.txt`
- `reports/VNEXSUS_Report/.../validation_report.html`
- `VNEXSUS_A-B-C_Execution_Plan/report.html`(업데이트된 KPI/개선 제안 포함)

# 진행 방식
- 각 Step마다: 구현→소수 케이스 검증→보완→반복
- 완료 후에만 다음 Step으로 진행하여 누적 안정성 확보