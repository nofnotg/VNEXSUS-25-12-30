# PRD: OCR 좌표 기반 의료 이벤트 추출 & 9~10항목 가중치 추적 보고서 (2025-12-27)

## 배경/목표
- OCR 블록 좌표·테이블 구조를 활용해 정확한 날짜-의료 이벤트를 추출하고, 손해사정 표준 9~10항목 연관성 가중치를 산출·추적
- 가입일 기준 3개월/5년 구간 근거 강화, 보고서 품질 메트릭 재현성 확보

## 사용자 스토리 & 수용기준(AC)
- [ ] 좌표·테이블 컨텍스트 기반 날짜-이벤트 바인딩 정확도 ≥ 90%
- [ ] 가입일 기준 3개월/5년 필터 적용, Invalid date/NaN 0건
- [ ] 9항목별 가중치(0–1)와 근거 신호를 메타데이터에 포함
- [ ] 보고서(JSON+HTML) 포맷 표준화·스키마 버전 고정
- [ ] 모델별 검증(o1-mini) API 준수, 샘플 성공률 ≥ 90%
- [ ] 성능: 50p 좌표/테이블 분석 ≤ 3s, 전체 ≤ 10s

## 스코프/비스코프
- 스코프: 좌표 정규화, 테이블 추출, 날짜-이벤트 바인딩, 9항목 가중치, 템플릿/검증
- 비스코프: OCR 엔진 자체 개선, 보험 심사 자동화 정책 결정

## 데이터 계약(요약)
- 입력: CaseN_blocks_normalized.json, CaseN_tables.json
- 출력: items.*, weights.{item: number}, metadata.{generatedAt, templateType, version, signals}

## 알고리즘/로직(요약)
- 좌표 정규화·헤더/푸터 라벨링, 표 그리드 복원
- 날짜 바인딩에 좌표 컨텍스트 주입(머릿행/본문/푸터/셀)
- 가입일 근접도, 도메인 키워드, OCR confidence 기반 가중치 계산

## 시스템 통합(주요 경로)
- offlineCoordAnalyzer → EnhancedDateBinder → DateOrganizer → NineItemReportGenerator

## 완료항목
- Preprocessor 섹션 신뢰도 점수 도입/출력
- HospitalTemplateCache 테스트 환경 가드(비동기 로깅 문제 방지)
- CoreEngineService 전처리 통합(필터 토대)
- NineItemReportGenerator: 하이브리드 처리·동적 검증·통계 생성
- EnhancedDateBinder: 날짜 탐지/컨텍스트 바인딩/NaNGuard 적용
- OfflineCoordAnalyzer: 좌표 정규화·테이블 구조·헤더/푸터 라벨링
- 개발상태 리포트 스크립트 기본 구성 및 차트 삽입

## 남은 항목
- o1-mini API 준수: system role 제거, max_completion_tokens 사용
- NaN/유효성 전역 가드 강화(DateOrganizer/ReportTemplateEngine 등)
- 좌표 컨텍스트→EnhancedDateBinder 통합
- 9항목 가중치 계산 모듈 및 메타데이터 출력
- “전체” 행 파서 보강 및 진행률 요약 정확화
- Case4 리포트 파일 생성/적재 및 테스트
- 결과 형식 표준화 100%
- zod 스키마 정의 및 계약 테스트

## 공정율(대략)
- 완료 7 / 남은 8 → 약 46.7% (문서/테스트 업데이트에 따라 변동 가능)

