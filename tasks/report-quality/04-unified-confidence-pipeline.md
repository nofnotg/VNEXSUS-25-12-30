# Task 04: Unified Confidence Pipeline

## 목표
Coverage/Temporal/Medical/Compliance/Structure/PII/Hospital KPI를 계산하고 Confidence gate로 제어합니다.

## 산출물
- `UnifiedConfidencePipeline` 점수화 로직(임계값 소수점 1자리).
- 게이트 실패 시 LLM Partial fill/재시도 경로.

## 수용 기준
- KPI 산출과 게이트가 일관되게 동작하고 로깅·메트릭 저장.

## 테스트
- 낮은 Coverage/Temporal 경계/PII 노이즈/병원 매핑 실패.

