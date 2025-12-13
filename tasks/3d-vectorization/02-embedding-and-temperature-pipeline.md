# Task 02: Embedding & Temperature Pipeline

## Objective
- 의미 임베딩과 Temperature Score(가변 신뢰/불확실성)를 계산하는 파이프라인을 구현합니다.

## Deliverables
- Embedding 함수(문장/이벤트 단위) 및 가중 평균 로직
- Temperature Score 계산기(모호성/누락/규정 경계 기반)

## Design
- Embedding: `src/rag` 도메인 임베딩을 재사용/확장.
- Temperature: RuleConfidence/Ambiguity/Completeness 지표를 0–1로 합성.

## Acceptance Criteria
- 임베딩 호출 실패율 ≤ 1%, 평균 벡터 길이 일관성.
- Temperature Score가 KPI와 상관 유의(p<0.05) 보임.

## Tests
- 임베딩 유닛/성능 벤치.
- Temperature 계산 통합 테스트(샘플 50건).

## Risks
- 모델 교체 시 분포 변동 → 버전 태깅과 재평가 루틴 필요.

