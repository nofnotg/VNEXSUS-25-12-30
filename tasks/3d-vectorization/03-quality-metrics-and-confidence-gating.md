# Task 03: Quality Metrics & Confidence Gating

## Objective
- KPI(coverage/temporal/medical/compliance/structure/pii/hospital)를 계산하고 UnifiedConfidencePipeline 게이트로 통제합니다.

## Deliverables
- KPI 계산기 및 보고서 첨부 로직
- RuleConfidence Gate 임계치/프로파일(문서 유형별)

## Acceptance Criteria
- KPI 산출이 200건 샘플셋에서 안정적으로 수행.
- 게이트 통과/차단 정책이 비용·품질 모두 개선.

## Tests
- KPI 유닛/통합.
- 게이트 정책 A/B(Partial LLM fill 여부) 실험 스크립트.

## Risks
- 과도한 차단으로 커버리지↓ → 임계치 튜닝과 예외 규칙 필요.

