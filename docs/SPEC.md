# SPEC.md — OCR 평가 배치 파이프라인

## 배경/목표
- `src/rag/case_sample_raw` 내 케이스별 문서 묶음을 대상으로 현재 앱 로직(pdf-parse + Vision OCR) 기반의 텍스트 추출·타임라인 생성을 수행한다.
- 실제 보고서(종결/중간/손해사정보고서)와 OCR 결과로 생성된 산출물 간 비교·평가를 통해 정확도/구조 유지/핵심정보 추출/표·이미지 인식률을 측정한다.
- 결과를 정량(문자·필드 단위)과 정성(오류 패턴) 관점으로 종합 리포트로 제공한다.

## 사용자 스토리 & 수용기준(AC)
- [ ] AC1: 케이스 폴더별로 실제 보고서와 의료문서를 자동 식별한다.
- [ ] AC2: 모든 파일에 대해 현재 앱 로직으로 텍스트 추출을 시도하며, 스캔 PDF는 OCR로 처리한다(환경 설정 가능).
- [ ] AC3: 다음 항목별 비교 지표를 산출한다:
  - 텍스트 정확도(문자 단위 유사도, Levenshtein 기반)
  - 문서 구조 유지 정도(섹션/목차 헤더 유사도, 간접지표)
  - 핵심 정보(금액/날짜/병원/의료용어) 추출 정확도(정밀도/재현율)
  - 표/이미지 내 콘텐츠 인식률(텍스트 검출 여부 비율)
- [ ] AC4: 케이스별 JSON 결과와 프로젝트 루트 `reports/evaluation`에 Markdown 요약을 생성한다.
- [ ] AC5: PII/PHI 마스킹 및 로깅 표준 준수한다(`shared/logging/logger`, `shared/security/mask`).
- [ ] AC6: 최소 2개의 유닛/통합 테스트가 포함되어 CI에서 실행 가능하다.

## 스코프/비스코프
- 스코프: 폴더 트래버스, 파일 분류, 텍스트 추출(pdf-parse/Vision), 메트릭 계산, 리포트 생성.
- 비스코프: 모델 학습/튜닝, 대규모 UI 변경, 외부 비밀키 제공(로컬 `.env` 또는 Secrets Manager 의존).

## API/데이터 계약 (입력·출력·에러·상태코드)
- 입력: 루트 디렉토리 경로(`src/rag/case_sample_raw`) 및 옵션 `{ useVision?: boolean }`.
- 출력(JSON): `CaseEvaluation` 스키마
  - `caseId: string`
  - `files: CaseFileInfo[]` (type: `actual_report | medical_doc | other`)
  - `ocrResults: Record<filePath, OcrResult>` (textLength, textSource, isScannedPdf, ocrSource, steps[])
  - `metrics: Record<filePath, Metrics>` (charAccuracy, structureScore, keyInfoAccuracy, tableImageRecognition)
  - `summary: { totals, averages, commonErrors[] }`
- 에러: 파일 무결성/암호화/XFA/환경 미설정 시 상세 메시지 포함. 사용자 메시지와 개발자 로그 분리.
- 상태: 처리 단계별 `steps[]`에 타임스탬프/소요시간 기록.

## 비기능 요구(SLO, 보안, 접근성, 로깅)
- SLO: 평균 처리 시간/페이지당 시간 로깅. 실패율 < 5% 목표(환경 미설정 케이스 제외).
- 보안: 케이스명/파일명 내 PII 가능성 마스킹 후 로깅. 비밀키는 코드에 포함하지 않음.
- 접근성: 결과 Markdown에 표/코드블록을 사용해 가독성 확보.
- 로깅: `logger.info|warn|error({event, traceId, redactedFields})`만 사용. `console` 금지.

## 테스트 전략(유닛/통합/계약/E2E/성능)
- 유닛: 분류 로직(키워드 매칭), Levenshtein 정확도 계산, 키정보 추출 정규식.
- 통합: 샘플 파일(소형 PDF/텍스트)로 `processPdf` 호출 플로우(비활성 Vision 환경) 검증.
- 계약: `CaseEvaluation` 결과 스키마 스냅샷.
- E2E: 대용량 케이스는 수동 실행 대상(리포트 생성 확인). CI에서는 소형 데이터만.
- 성능: 페이지당 평균 문자수/처리시간 측정 및 로그로 노출.

## 릴리즈/롤백 계획(피처플래그/마이그레이션)
- 피처플래그: `USE_VISION`, `ENABLE_VISION_OCR`로 OCR 활성화 제어.
- 롤백: 모듈 제거 시 `reports/evaluation` 산출물 삭제 안전. 코드 영향 범위 분리(신규 모듈만).

