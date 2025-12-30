# Tasks: OCR 좌표 기반 이벤트 추출 & 9~10항목 가중치 보고서 (2025-12-27)

## 완료항목
- Preprocessor 섹션 신뢰도 점수 적용
- HospitalTemplateCache 테스트 환경 가드 적용
- CoreEngineService 전처리 통합(초기)
- NineItemReportGenerator 하이브리드 처리/동적 검증/통계 구현
- EnhancedDateBinder NaNGuard 적용
- OfflineCoordAnalyzer 좌표·테이블·헤더/푸터 라벨 구현
- 개발상태 리포트 스크립트/차트 구성

## 남은 항목(즉시)
- o1-mini API 준수 수정(메시지 포맷/파라미터 분기)
- NaN/유효성 전역 가드 강화(DateOrganizer/ReportTemplateEngine 등)
- 좌표→DateBinder 통합(bboxNorm/셀 컨텍스트 주입)
- 9항목 가중치 계산/메타데이터 출력(DynamicValidationEngine 연계)

## 남은 항목(단기)
- “전체” 행 파서 보강 및 진행률 집계
- Case4 리포트 생성/적재/E2E 포함
- 결과 형식 표준화 100% 달성
- zod 계약 스키마 정의/검증

## 남은 항목(중기)
- 좌표/테이블 처리 성능 튜닝(rowTol/colTol/minCols)
- 검증 시스템 폴백/비용·성능 대시보드

## 수용기준/검증
- 유닛/통합/계약/E2E/성능 테스트로 AC 충족 여부 검증

