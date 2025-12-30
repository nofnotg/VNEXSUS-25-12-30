# VNEXSUS OCR·좌표 그라운딩·후처리·LLM 통합 PRD

## 배경/목표
- 50개 케이스 일괄 처리(OCR→정규화→보고서 생성) 결과가 기대 품질에 미달. 원인 진단과 개선 계획 수립이 필요.
- 좌표 그라운딩(bbox/page)을 활용한 근거 스팬(sourceSpan) 첨부로 감사/분쟁 대응 가능한 “원문 근거”를 확보.
- 후처리 로직과 LLM 활용의 역할·밸런스를 재조정하여 중복/과도 경고/날짜 포맷 불일치를 제거하고 9~10항목 구조를 안정화.
- 결과 보고서의 품질·검증 흐름을 수치화(Accuracy/PassRate 등)하고, 실행계획(A‑B‑C) 리포트를 오프라인 HTML로 제공.

## 핵심 문제 진단
- OCR 블록의 좌표(bbox)·페이지 메타가 보고서 이벤트에 충분히 연결되지 않아 Anchor 매칭 실패가 발생.
- 9~10항목 보고서 템플릿에서 중복 경고/법적 문구 과다, 날짜 포맷 불일치로 가독성과 검증율 저하.
- 베이스라인 46개 비교에서 `report ⊆ vnexsus` 실패(빈 파일, 부분 매칭 부족, 중복 매칭) 케이스가 다수.
- Vision OCR 비활성/인증 문제로 커버리지 불안정. 로컬 렌더러/대체 OCR 경로 필요.

## 파이프라인 개요
- 입력 → PDF 파싱/스캔판단 → Vision OCR(+이미지 기반 fallback) → 페이지/블록 추출 → 정규화 → 이벤트·타임라인 구성 → 좌표 그라운딩(근거 스팬) → 보고서 템플릿(9~10항목) → 검증·리포트 생성
- 주요 컴포넌트
  - `backend/utils/pdfProcessor.js:26` `processPdf` — PDF→텍스트·OCR·블록 통합 처리
  - `backend/services/visionService.js:200` `processPdfFile` / `visionService.js:261` `processPdfFileViaImages` / `visionService.js:518` `extractTextFromImage`
  - `backend/postprocess/sourceSpanManager.js:24` `attachSourceSpan` — Anchor 기반 근거 스팬 추출
  - `backend/eval/report_subset_validator.js:202` `validateCase` — `report ⊆ vnexsus` 검증
  - `backend/tools/batchReprocessCases.js:696` `runPool` — 병렬 배치 실행 및 실행계획 HTML
  - `backend/postprocess/enhancedReportTemplateEngine.cjs:104` `normalizeDateKR` — 날짜 표준화 및 중복 제거

## 사용자 스토리 & 수용 기준(AC)
- AC1. 좌표 그라운딩: 의료 이벤트 95%+가 `sourceSpan`을 가진다(텍스트 프리뷰/앵커/신뢰도). 실패 케이스는 누락 사유가 추적된다.
- AC2. Vision OCR 활성: 50케이스 전량 OCR 처리 성공. 실패 시 이미지 렌더링 기반 fallback으로 텍스트 확보.
- AC3. 보고서 구조: 9~10항목 템플릿이 날짜 포맷(YYYY.MM.DD) 일관, 중복 경고 제거, 법적 문구 최소화로 가독성 향상.
- AC4. 검증 통과: 베이스라인 46개 대비 `report ⊆ vnexsus` PassRate≥80%, 평균 날짜/ICD/병원 매칭률 개선.
- AC5. 오프라인 리포트: `validation_report.html`과 `VNEXSUS_A-B-C_Execution_Plan/report.html`이 생성·열람 가능.

## 범위/비스코프
- In Scope: Vision OCR 연동·fallback, 좌표 블록→이벤트 그라운딩, 템플릿/프롬프트 통합, 검증·리포트 자동화, 오프라인 HTML 출력
- Out of Scope: 클라우드 배포·비용 모니터링 대시보드, 다국어 보고서, 외부 보험 API 연계

## 데이터 계약(요약)
- Block: `{ page:number, text:string, bbox:{xMin,yMin,xMax,yMax,width,height}, confidence?:number }`
- SourceSpan: `{ start:number, end:number, textPreview:string, anchorTerms:string[], confidence:number, missingReason?:string }`
- MedicalEvent: `{ id,date,hospital,diagnosis:{name,code}, procedures:[], sourceSpan?:SourceSpan }`
- 검증 엔트리: `{ dates:string[], icds:string[], hospitals:string[] }` 매칭률·누락·통과여부 산출

## 좌표 그라운딩 설계
- 블록 추출: Vision JSON→`extractBlocksFromJson`로 페이지·블록·bbox 정렬(`visionService.js:643`).
- 앵커 집합: 날짜(다중 포맷), 병원명(축약 포함), 진단명, ICD코드, 블록 스니펫(`sourceSpanManager.js:67`).
- 위치 탐색: 날짜 기준 윈도우±500자에서 앵커 매칭 점수로 최적 스팬 선정(`sourceSpanManager.js:134`), 없으면 다른 앵커(`sourceSpanManager.js:271`).
- 누락 추적: 실패 사유/이벤트 메타 수집, 첨부율 계산(`sourceSpanManager.js:354`).

## 후처리 vs LLM 밸런스
- Rule‑first: 날짜 포맷/중복 제거/검사 결과 통합은 규칙 우선(`enhancedReportTemplateEngine.cjs:104,124,463`).
- LLM‑assist: 요약·권고문 생성은 LLM 보조, 입력은 정규화·근거 스팬 링크로 제한.
- 억제 규칙: 중복 경고·과도한 법률문구 금지, 병원/검사 결과는 정규화 후 중복 키로 dedupe.

## 프롬프트 통합(9~10항목)
- 항목 표준: 환자/보험, 병원 방문 타임라인, 핵심 검사·시술, 진단/코드, Disclosure 분석(3/2/5년), 종합 의견·권장사항.
- 출력 가이드: 날짜 `YYYY.MM.DD`, 중복 제거, 근거 스팬 요약 1~2줄 포함.
- 질환별 규칙: 심장/신경/종양 등 검사 결과 적용교칙 통합, 암 수술 후 조직검사 특례 포맷팅 지원.

## 품질 KPI
- SourceSpan 첨부율 ≥95%, 좌표 매칭률(페이지/블록) 보고
- 베이스라인 46개 PassRate ≥80%, 평균 날짜/ICD/병원 매칭률 상승 추세
- OCR 커버리지 100%(Vision 활성+이미지 fallback), 빈 파일 방지 임계치 준수
- A‑B‑C 실행계획 지표: 처리 성공률, 후처리 시간(P95), 품질 Top/Bottom 리스트

## 예외·로깅
- 모든 async 경로 try/catch, 사용자 메시지/개발자 로그 분리
- 구조화 로깅: 이벤트/케이스/단계/에러코드, PII 마스킹 정책 준수
- Vision/GCS 실패 시 단계별 스텝 로그와 fallback 시도 기록

## 보안·비밀
- 자격정보는 환경변수/Secrets Manager로 주입, 저장/노출 금지
- 보고서/로그 내 민감정보 마스킹

## 테스트 전략
- Unit: 앵커 매칭·날짜 정규화·중복 제거(커버리지 80%+)
- Integration: Vision OCR→블록→sourceSpan→템플릿→검증 흐름
- E2E: 50케이스 병렬 처리·오프라인 HTML 확인, 실패 경로(403/토큰만료/타임아웃) 포함
- 성능: 후처리 핫경로 벤치(윈도우 매칭/정규화/템플릿)

## 릴리즈/롤백
- 플래그: `USE_VISION`, `ENABLE_VISION_IMAGE_FALLBACK`, `MIN_TEXT_LENGTH`
- 실패 시 로컬 OCR로 강제 전환, 템플릿 구버전 유지 가능

## 위험·대안
- Vision 제한/인증 오류 → 이미지 렌더링+로컬 OCR 대체 경로 확보
- 스캔 PDF 난독화 → 블록 정규화 및 다중 앵커 융합
- 프롬프트 변동성 → 규칙 우선, LLM은 요약만 보조

## 산출물
- `reports/VNEXSUS_Report/.../validation_report.html` — 정확도/포함도/케이스별 상세
- `reports/VNEXSUS_A-B-C_Execution_Plan/report.html` — 실행계획·품질·파이프라인 상태

