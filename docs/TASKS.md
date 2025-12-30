# VNEXSUS OCR·좌표 그라운딩·후처리·LLM 통합 작업계획

## 개요
- 목적: 50케이스 파이프라인 품질 회복(좌표 그라운딩·보고서 구조·검증 통과), Vision OCR 활성화, 오프라인 리포트 제공.
- 산출물: `validation_report.html`, `VNEXSUS_A-B-C_Execution_Plan/report.html`, 9~10항목 보고서(중복 억제·날짜 통일).

## 마일스톤
- M1. 환경/인증 정비 · OCR 안정화
- M2. 좌표 그라운딩 · 근거 스팬 첨부율 95%+
- M3. 프롬프트/템플릿 통합 · 9~10항목 안정화
- M4. 50케이스 배치 · 검증/보고서 생성
- M5. 품질 개선 루프 · 실행계획 리포트 배포

## 작업 목록

1) 환경/인증 정비
- Vision 활성화(`USE_VISION=true`), 버킷/자격 경로 점검
- 이미지 기반 fallback(`ENABLE_VISION_IMAGE_FALLBACK=true`) 확인
- 빈 파일 방지 임계치(`MIN_TEXT_LENGTH`) 적용

2) OCR 파이프라인 안정화
- PDF→텍스트 파싱 실패 시 Vision OCR로 전환 (`backend/utils/pdfProcessor.js:26`)
- 이미지 렌더링 기반 OCR fallback 구현/점검 (`backend/services/visionService.js:261`)
- 페이지·블록·bbox 정렬/합성 검증 (`visionService.js:464,643`)

3) 좌표 그라운딩(근거 스팬)
- 앵커 수집(날짜/병원/진단/ICD/블록 스니펫) 강화 (`sourceSpanManager.js:67`)
- 날짜 윈도우±500자 우선, 없으면 다른 앵커 검색 (`sourceSpanManager.js:134,271`)
- 누락 사유·첨부율 통계 수집/출력 (`sourceSpanManager.js:354`)

4) 프롬프트/템플릿 통합
- 날짜 표준화(YYYY.MM.DD), 검사결과 중복 제거 (`enhancedReportTemplateEngine.cjs:104,124,463`)
- 암 수술 후 조직검사 특례 포맷팅 보강 (`enhancedReportTemplateEngine.cjs:485`)
- 법률/경고문구 억제 규칙 적용, 9~10항목 구성 확정

5) 검증/리포트 생성
- 베이스라인 46개 `report ⊆ vnexsus` 자동 검증 (`backend/eval/report_subset_validator.js:202`)
- 배치 실행/병렬 풀 설정 점검 (`backend/tools/batchReprocessCases.js:696`)
- `validation_report.html` · `VNEXSUS_A-B-C_Execution_Plan/report.html` 오프라인 출력

6) 품질 개선 루프
- 실패 케이스 Top‑N 분석(날짜/ICD/병원 누락 원인)
- 앵커 융합/블록 정규화 튜닝, 템플릿 미세조정
- 실행계획 리포트에 KPI 추세/Top/Bottom 반영

## 완료 조건(DoD)
- 50케이스 전량 처리 성공, 빈 파일 0건
- SourceSpan 첨부율 ≥95% · 좌표 메타 확인 가능
- 베이스라인 PassRate ≥80%, 평균 매칭률 개선
- 오프라인 HTML 리포트 생성/열람 확인

