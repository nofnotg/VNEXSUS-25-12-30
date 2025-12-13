# Task 01: Data Schema & Contracts

## Objective
- VectorMeta와 관련 데이터 스키마/계약을 정의하여 파이프라인 간 일관성을 확보합니다.

## Deliverables
- VectorMeta Type/Schema
- Event/Episode 데이터 모델(시간 앵커/유형 포함)
- 저장 포맷(JSON/DB 계약)

## API/Contracts
- VectorMeta:
```ts
type VectorMeta = {
  semanticVec: number[];
  timeVec: number[]; // [deltaDays, phaseIdx, density]
  confidenceVec: number[]; // [ruleConfidence, temperature, coverage]
  projection3D?: [number, number, number];
  clusterId?: string;
  tags: string[];
};
```
- Report Output에 `vectorMeta?: VectorMeta[]` 필드 추가 제안.

## Acceptance Criteria
- 스키마가 `structuredOutput` 확장에 충돌 없이 검증 통과.
- 샘플 10건에 대해 VectorMeta 생성 시 실패 0건.

## Tests
- Zod-like 스키마 검증 유닛 테스트.
- 샘플 데이터 로딩→스키마 검증 통합 테스트.

## Risks
- 고차원 벡터 차원/축 의미가 모호해질 수 있음 → 문서화로 의미 정의.

