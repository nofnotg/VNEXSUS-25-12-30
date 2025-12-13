# PRD: Report Quality Improvement Roadmap (with 3D Vectorization)

## 목표
- 룰 중심 하이브리드 파이프라인을 고도화하여 보고서 품질(정확도·추론력·규정 준수)을 **85%+**로 끌어올립니다.
- 3D 벡터화(semantic/time/confidence)를 병행하여 시각적 분석·프로파일링·회귀 감지를 강화합니다.

## 핵심 전략
- 하이브리드 게이트: RuleConfidence/Ambiguity/Completeness/Compliance로 LLM 보조를 최소/정밀 제어.
- 레거시 모듈 재활성화: EnhancedDateBinder/Diagnosis/Hospital, ExtractorAdapter, NaNGuard, UnifiedConfidencePipeline, structuredOutput, disclosureEngine 등.
- 벡터화 병행: 보고서/에피소드에 VectorMeta(소수점 1자리 가중치) 저장, 3D 투영·시각화.

## KPI
- Coverage ≥ 0.88, Temporal ≥ 0.85, Medical ≥ 0.85, Compliance ≥ 0.90, Structure ≥ 0.98, PII ≥ 0.99, Hospital ≥ 0.90.

## 로드맵(4주)
1) 파이프라인 고도화(룰 경로): DateBinder/Diagnosis/Hospital/Insurance + NaNGuard 통합, structuredOutput 검증.
2) 게이트 도입: UnifiedConfidencePipeline 점수화, Ambiguity/Completeness/Compliance 정책 수립, Partial LLM fill.
3) 측정/시각화: metrics 라우트, VectorMeta 저장, 3D 투영 등각/정사영 시각화.
4) 튜닝/운영: 임계값 최적화, 문서 유형별 프로파일, CI 게이트/벤치/롤백.

## 데이터 계약
- Output 확장: `finalReport` + `qualityMetrics` + `vectorMeta[]`(가중치 소수점 1자리, 3D 좌표 포함).

## 리스크/대응
- 저차원 투영 정보 손실 → 내부 판단은 고차원 유지, 3D는 분석 보조.
- LLM 비용/일관성 → 게이트·Partial fill 정책.

