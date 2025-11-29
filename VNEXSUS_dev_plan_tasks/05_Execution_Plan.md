# 05. Execution Plan (의존성 기반 단계별 실행계획)

## Phase 0 — 측정/회귀 프레임(반드시 먼저)
- 목표: “report ⊆ vnexsus”를 자동으로 검증할 테스트 하네스 구축
- 결과물:
  - `report_subset_validator` 실행 스크립트
  - `baseline_metrics.json` 생성/갱신
  - 누락 이벤트 리포트(케이스별 missing list)

## Phase 1 — SSOT(단일 이벤트 테이블) 정착
- 목표: 출력 생성(Excel/txt/json/요약)이 원문이 아니라 event table만 보게 만들기
- 핵심:
  - MedicalEvent 스키마 도입
  - sourceSpan 강제
  - ReportBuilder를 event table 기반으로 리팩터링(인터페이스 유지)

## Phase 2 — 고지의무/심사기준 엔진
- 목표: 질문맵(Question Map) + 룰 적중 + materiality score
- 핵심:
  - uwQuestions.json, disclosureRulesEngine.js
  - majorEvents.json 확장(코드/질환군/중대검사)
  - 가입 전 3개월/5년 플래그 정교화

## Phase 3 — Episode Clustering(사건 단위 압축)
- 목표: 조사자 보고서의 “기간/횟수/핵심검사/수술” 패턴을 코드로 구현
- 핵심:
  - 동일 병원/질환 클러스터를 시간창으로 묶기
  - episode가 core 이벤트를 대표하도록 설계
  - VNEXSUS 텍스트 출력에 episode 섹션 추가

## Phase 4 — 정밀도 강화(코드·시간·근거)
- 목표: ICD/KCD 보존률, 동일일 시간순, 검사결과 보존 강화
- 핵심:
  - aiEntityExtractor 프롬프트 계약 강화(코드/검사/결과/시간)
  - enhancedMassiveDateBlockProcessor에 time extraction 옵션 추가
  - 이벤트 병합 시 코드 소실 방지(merge rules)

## Phase 5 — Hardening(운영성/감사성)
- 목표: 실제 실무 투입 가능한 수준의 감사/추적/안정성
- 결과물:
  - 이벤트별 근거 스팬 누락 감지
  - 로그/메트릭(케이스별 처리시간, 커버리지, 룰 적중률)
  - 개인정보 마스킹(선택) 및 안전한 저장정책 문서화
