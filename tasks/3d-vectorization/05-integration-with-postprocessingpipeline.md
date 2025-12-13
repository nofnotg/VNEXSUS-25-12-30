# Task 05: Integration with PostProcessing Pipeline

## Objective
- `backend/postprocess/index.js` 파이프라인에 벡터화/메트릭/게이트를 단계적으로 통합합니다.

## Deliverables
- Step3: `EnhancedDateBinder` + `NaNGuard` 활성화
- Step4: `ExtractorAdapter`(Diagnosis/Hospital/Insurance) 연결
- Step5: `UnifiedConfidencePipeline` 점수화 + `structuredOutput` 검증
- Step6: 조건부 `promptOrchestrator` Partial fill
- VectorMeta 생성/저장 훅 추가

## Acceptance Criteria
- 파이프라인 실패율 증가 없음, KPI 개선 확인.
- VectorMeta가 보고서와 동기화되어 일관성 확보.

## Tests
- 통합 테스트: 각 스텝 품질/구조 검증.
- 회귀: 임계치 변경 시 성능/비용 영향 측정.

## Risks
- 다수 모듈 연계로 복잡성↑ → 단계별 플래그 롤아웃.

