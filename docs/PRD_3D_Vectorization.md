# PRD: 3D Vectorization for Unstructured Medical Documents

## 배경/목표
- 비정형 의료문서(진료기록, 검사결과, 자유서술)의 의미·시간·신뢰도를 축으로 하는 3D 벡터화 모델을 구축합니다.
- 룰 중심 하이브리드 파이프라인(RuleConfidence/Ambiguity/Completeness/Compliance 게이트)을 유지하면서, 문맥 의미/사건 연관성/정량 점수를 벡터화 및 시각화하여 **정확도·추론력 85%+**를 달성합니다.

## 사용자 스토리 & 수용기준(AC)
- [ ] AC1: 보고서 생성 후 `structuredOutput` 스키마 검증과 벡터 메타(semantic/time/confidence) 저장.
- [ ] AC2: 문서/케이스/에피소드 단위로 3D 포지셔닝(UMAP/PCA) 및 군집 시각화.
- [ ] AC3: `UnifiedConfidencePipeline` 점수, Temperature Score(가변), Coverage 등 KPI를 벡터 메타에 포함.
- [ ] AC4: Disclosure/질병룰/전이분류를 Compliance 게이트로 반영하고 위반/경계 케이스를 벡터 태깅.
- [ ] AC5: 샘플셋(200건) 기준 KPI(Accuracy/Temporal/Compliance 등) ≥ 목표치 달성.

## 스코프/비스코프
- 스코프: 데이터 모델·임베딩 파이프라인·3D 매핑/시각화·메트릭 수집과 저장·하이브리드 게이트 통합.
- 비스코프: 개인식별 데이터 저장(PII 원문 저장 금지), LLM 전면 재작성(Partial fill만 허용), 외부 배포 대시보드.

## 아키텍처/모듈
- 입력: OCR 텍스트 → `EnhancedMassiveDateBlockProcessor` → `preprocessor` → `EnhancedDateBinder`/`ExtractorAdapter`(Diagnosis/Hospital/Insurance + `NaNGuard`).
- 품질/게이트: `UnifiedConfidencePipeline`(RuleConfidence) → `structuredOutput`(Completeness/Structure) → `disclosureEngine`/`diseaseRuleMapper`/`primaryMetastasisClassifier`(Compliance) → 조건부 `promptOrchestrator`(Partial fill).
- 벡터화: 
  - Semantic: 도메인 임베딩(`src/rag`) + 이벤트 텍스트→임베딩 평균/가중.
  - Time: 날짜 앵커/상대시점(∆days/phase) → 정규화.
  - Confidence: RuleConfidence(0–1), Temperature Score(0–1) → 합성.
- 3D 매핑: 고차원(최대 256–1024)에서 UMAP/PCA로 3D 투영, 케이스/에피소드별 좌표·클러스터 저장.

## 데이터 계약 (입력·출력·메타)
- Input: `ocrText:string`, `options:{useAIExtraction?:boolean,...}`
- Output: `finalReport:structured`, `quality:{coverage, temporal, medical, compliance, structure, pii}`
- VectorMeta: `{semanticVec:number[], timeVec:number[], confidenceVec:number[], projection3D:[x,y,z], clusterId?:string, tags:string[]}`

## 비기능 요구(SLO, 보안, 접근성, 로깅)
- SLO: p95 처리 ≤ 3s/문서(룰 경로), 저장 지연 ≤ 500ms, 벡터 투영 ≤ 300ms.
- 보안: PII/PHI 원문 저장 금지, `mask()`로 로그 마스킹, 비밀키는 Secrets Manager.
- 로깅: `logger.info|warn|error({event, userId, traceId, redactedFields})` 사용.

## 테스트 전략(유닛/통합/계약/E2E/성능)
- 유닛: DateBinder/Diagnosis/Hospital/NaNGuard/Vector utils, 커버리지 80%+.
- 통합: PostProcessingManager 단계별 품질 게이트 및 VectorMeta 생성.
- 계약: `structuredOutput` 스키마 통과, 파괴 금지.
- E2E: 403/토큰만료/중복클릭 포함, 실패경로 우선.
- 성능: 임베딩/투영 벤치, 회귀 시 PR 차단.

## KPI/목표
- Coverage ≥ 0.88, Temporal ≥ 0.85, Medical ≥ 0.85, Compliance ≥ 0.90, Structure ≥ 0.98, PII ≥ 0.99, Hospital ≥ 0.90.

## 로드맵(4주)
1) 주차1: 데이터모델·계약, DateBinder/NaNGuard 통합, VectorMeta 스키마 정의.
2) 주차2: 임베딩/Temperature 파이프라인, UnifiedConfidencePipeline 점수화, 구조검증 연결.
3) 주차3: 3D 매핑/시각화 엔진, Compliance 게이트 연결, 메트릭 라우트 추가.
4) 주차4: 튜닝/벤치/CI 게이트, 샘플셋 200건 측정·리포팅.

## 릴리즈/롤백
- 피처플래그: `features.vector3d`, `features.partial_llm_fill`.
- 롤백: 벡터 저장·시각화 비활성화 시 룰 경로만 유지.

## 리스크/트레이드오프
- 3D 투영의 정보 손실(고차원→저차원): 시각화 용도 한정, 내부 판단은 고차원 유지.
- LLM 보조 확대의 비용/일관성 리스크: Partial fill 정책·게이트 임계치로 통제.

## 레거시 모듈 재활성화
- `EnhancedDateBinder`, `EnhancedDiagnosisExtractor`, `EnhancedHospitalExtractor`, `ExtractorAdapter`, `NaNGuard`, `UnifiedConfidencePipeline`, `structuredOutput`, `disclosureEngine` 등 파이프라인 연결.

