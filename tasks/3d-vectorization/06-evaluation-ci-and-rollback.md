# Task 06: Evaluation, CI Gate & Rollback

## Objective
- 측정 라우트/CI 게이트/롤백 전략을 정의하여 품질을 지속적으로 유지합니다.

## Deliverables
- `POST /api/postprocess/metrics` 라우트 설계서
- CI 게이트: eslint/typecheck/vitest --coverage/playwright/secretlint/bench
- 롤백: `features.vector3d`, `features.partial_llm_fill` 플래그 정책

## Acceptance Criteria
- 측정 라우트가 KPI·VectorMeta를 반환하고, 200건 샘플 기반 리포트 생성.
- CI 실패 시 머지 차단, 회귀 방지.

## Tests
- 계약 테스트: metrics 응답 스키마 스냅샷.
- 성능 벤치: 투영/임베딩 회귀 자동 검사.

## Risks
- 벤치 환경 불안정 → 고정 시드/샘플·리소스 격리.

