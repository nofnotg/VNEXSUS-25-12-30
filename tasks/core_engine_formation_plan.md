# VNEXSUS 핵심 코어 엔진 형성 계획 (Tasks)

목표: 기존 파이프라인(파일업로드→OCR→전처리LLM→룰엔진→보고서LLM)을 유지하면서, 심장(엔진) 역할의 최소 코어 로직을 형성하고 이후 Claude4 Sonnet으로 모듈 연결·마무리를 진행한다.

## 0. 산출물 (완료)
- 생성된 코어 파일 경로:
  - `src/services/core/disclosureEngine.js`
  - `src/services/core/diseaseRuleMapper.js`
  - `src/services/core/primaryMetastasisClassifier.js`
  - `src/services/core/promptOrchestrator.js`
  - `src/services/core/structuredOutput.js`

## 1. Phase I — 코어 엔진 검증 (개발팀)
- [ ] 단위 테스트(경량) 작성: 각 엔진 입출력 케이스 3~5개
- [ ] 샘플 레코드(JSON)로 Disclosure 엔진 윈도우 태깅/판정 검증
- [ ] DiseaseRule 매핑 정확도 점검(협심증/AMI/부정맥/뇌혈관/암)
- [ ] Primary/Metastasis 고정라인 출력 확인(원발/전이 없음 케이스 포함)
- [ ] Prompt Orchestrator에서 Full→Summary 생성 흐름 확인(온도 0.2/0.1)
- [ ] Structured Output 스키마 검사 통과/실패 폴백 로직 논의

## 2. Phase II — 서비스 레이어 통합 (Claude 주도)
- [ ] 기존 후처리 서비스에 코어 엔진 호출 지점 삽입(컨트롤러는 유지)
- [ ] 전처리LLM 출력(JSON)에 DiseaseRuleMapper 적용 → 보고서LLM 입력 필드화
- [ ] 날짜 엔진(기 보유) 후 Disclosure 태깅/판정 병합 → Evidence 연결
- [ ] 보고서LLM 결과 저장 직전 Summary 자동 생성(Prompt Orchestrator)
- [ ] 저장 단계에서 Structured Output 검사 → 실패 시 폴백 템플릿 저장

## 3. Phase III — 연결 안정화 / 품질 게이트
- [ ] 재시도 정책(LLM 응답 스키마 불일치 시 1~2회 재호출)
- [ ] 로그/메트릭: 정확도·결측률·응답시간·재시도율 수집(간단 콘솔→파일)
- [ ] Evidence Trace: 판정에 사용된 레코드의 출처/라인 보존
- [ ] 보안 점검: `.env`/키 하드코딩 제거, Secret Manager 전환 계획 수립

## 4. Phase IV — 스펙 확장 (선택)
- [ ] 질환군 규칙 확장(폐암/위암/대장암/췌장암 등 추가)
- [ ] 병원별 템플릿/RAG 도입으로 문구·소견 정확도 개선
- [ ] PDF 템플릿/내보내기 자동화(요약본 포함)

## 통합 원칙
- 파이프라인 흐름 유지(컨트롤러/라우트 변경 최소화)
- 엔진은 서비스 레이어에서만 호출(의존성 역전)
- LLM은 서술/요약에 집중, 판정은 룰엔진+스키마로 견고화

## 연결 예시(개발팀 참고)
```js
// 예시 서비스 흐름
import { mapDiseaseRules } from "src/services/core/diseaseRuleMapper.js";
import { computeDisclosure } from "src/services/core/disclosureEngine.js";
import { classifyPrimaryMetastasis } from "src/services/core/primaryMetastasisClassifier.js";
import { orchestrateReport } from "src/services/core/promptOrchestrator.js";
import { validateStructure, SummarySchema } from "src/services/core/structuredOutput.js";

async function composePipeline({ contractDate, windows, claimDx, records, systemPrompt, userPrompt }) {
  const diseaseMapped = mapDiseaseRules(records);
  const disclosure = computeDisclosure({ contractDate, disclosureWindows: windows, records, claimDiagnosis: claimDx });
  const classification = classifyPrimaryMetastasis({ records });
  const { fullReportText, summaryText } = await orchestrateReport({ systemPrompt, userPrompt });
  const ok = validateStructure({ /* parse summaryText to fields */ }, SummarySchema);
  return { diseaseMapped, disclosure, classification, fullReportText, summaryText, schemaOk: ok.ok };
}
```

## 책임/역할
- GPT-5(high): 코어 엔진 설계·형성, 아웃라인 정의
- Claude4 Sonnet: 모듈 연결·호환성 마무리, 라우팅/서비스 통합, 테스트 안정화

## 일정(권고)
- Phase I: 3~5일
- Phase II: 1~2주
- Phase III: 1주
- Phase IV: 선택(상황에 따라)