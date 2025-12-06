# tasks_phase1_dispute_layer.md
VNEXSUS Phase 1 – 쟁점 레이블링 및 중요도 스코어링 구현 계획서

## 1. 범위 및 목표

- 범위
  - 코어엔진 레벨에서 **각 타임라인 이벤트/episode에 DisputeTag(쟁점 관련 메타데이터)를 부여**하고,
  - 사건 중요도 `importanceScore`를 계산해 “사건 후보 리스트”를 만들 수 있도록 한다.
- 목표
  - 대표 케이스(쟁점 뚜렷한 케이스 8~10건)를 기준으로
    - 필수 사건 누락률 < 5%
    - 사람 report에 등장하는 사건의 80~90%가 상위 중요도 episode로 커버되도록.

---

## 2. 설계 개요

Phase 1에서는 다음과 같은 단계를 거친다.

1. **데이터 계약(DataContracts) 확장**
   - 타임라인 이벤트/episode에 `disputeTags` 또는 `disputeMeta`를 추가.

2. **계약/청구 정보 구조 정의**
   - `ClaimSpec`, `ContractInfo` 구조를 정의하여 코어엔진에 공급.

3. **진단군/장기군 매핑 테이블 정의**
   - KCD/ICD 코드 → Body System/질환군으로 변환하는 유틸.

4. **DisputeTag 생성 및 중요도 점수 계산**
   - phase(가입 전/대기기간/보장기간), role, dutyToDisclose, importanceScore 계산.

5. **ReportSynthesizer 타임라인 섹션 강화**
   - `skeletonReport.timeline.events`에 DisputeTag 반영.

---

## 3. Task 상세 정의

### Task 1. DataContracts 확장 – 이벤트/타임라인 구조에 DisputeTag 추가

**파일:** `backend/services/core-engine/DataContracts.js`

1. 새로운 타입 정의 (주석/설명 포함)

```js
// DisputeTag - 쟁점 분석 메타데이터
export class DisputeTag {
    constructor(data = {}) {
        this.phase = data.phase || 'COVERED_PERIOD'; // PRE_CONTRACT, WAITING_PERIOD, COVERED_PERIOD
        this.role = data.role || 'BACKGROUND';       // CLAIM_CORE, ETIOLOGY, RISK_FACTOR, BACKGROUND, IRRELEVANT
        this.dutyToDisclose = data.dutyToDisclose || 'NONE'; // NONE, POTENTIAL, VIOLATION_CANDIDATE
        this.importanceScore = data.importanceScore || 0.0;  // 0.0 ~ 1.0
        this.reasons = data.reasons || [];                  // ["가입 후 90일 이내", "암 확진 검사 포함" 등]
    }

    toJSON() {
        return {
            phase: this.phase,
            role: this.role,
            dutyToDisclose: this.dutyToDisclose,
            importanceScore: this.importanceScore,
            reasons: this.reasons
        };
    }
}
```

2. 타임라인 이벤트/그룹에 disputeTags 필드 추가

- `TimelineAssembler`에서 생성하는 이벤트 객체에 `disputeTag` 또는 `disputeMeta` 속성을 추가할 수 있도록 인터페이스 설계:

```js
// TimelineAssembler.createTemporalEvents 결과 예시
const event = {
    id: `event_${anchor.id}`,
    date: anchor.normalizedDate,
    type: anchor.type,
    anchor,
    entities: relatedEntities,
    confidence: this.calculateEventConfidence(relatedEntities),
    disputeTag: null // Phase 1에서 채워질 필드
};
```

- 그룹/episode 레벨에서도 필요 시 요약용 필드를 둘 수 있다:

```js
const groupedEvent = {
    date: dateKey,
    events: [],
    summary: {
        totalEvents: 0,
        eventTypes: new Set(),
        avgConfidence: 0,
        // 쟁점 요약
        maxImportanceScore: 0,
        disputeHighlights: [] // 상위 에피소드를 한 줄 요약하는 데 사용 가능
    }
};
```

> **주의:** DataContracts.js는 가능한 한 **새로운 필드 추가 수준**에서 확장하고, 기존 필드/동작에는 영향을 주지 않는다.

---

### Task 2. 계약/청구 정보 구조 정의 (ClaimSpec, ContractInfo)

**파일 후보:**  
- `backend/services/core-engine/DataContracts.js` 내부 또는  
- 별도 `backend/services/core-engine/ClaimContracts.js`

1. 최소 구조 정의

```js
export class ContractInfo {
    constructor(data = {}) {
        this.insurer = data.insurer || null;     // 보험사명
        this.productName = data.productName || null;
        this.policyNumber = data.policyNumber || null;
        this.issueDate = data.issueDate || null; // 가입일
        this.waitingPeriodDays = data.waitingPeriodDays || 0;
        this.coverageStartDate = data.coverageStartDate || data.issueDate;
    }
}

export class ClaimSpec {
    constructor(data = {}) {
        this.claimId = data.claimId || null;
        this.claimDiagnosisCodes = data.claimDiagnosisCodes || []; // KCD/ICD 코드 배열
        this.claimBodySystems = data.claimBodySystems || [];       // "breast", "cardio" 등
        this.claimType = data.claimType || 'diagnosis';            // diagnosis, surgery, admission 등
        this.claimDate = data.claimDate || null;
    }
}
```

2. 코어엔진 엔트리 포인트에서 `ContractInfo`, `ClaimSpec`를 받아 `analysisResults`에 포함시키는 레이어는 **기존 파이프라인의 입력/출력 형식을 유지하는 범위**에서 추가한다.
   - 예: `PipelineStateMachine.runPipeline` 입력 `input` 객체에 contract/claim 정보를 확장해서 전달.

---

### Task 3. 진단군/장기군 매핑 유틸 구현

**파일:** `backend/services/core-engine/utils/DiseaseBodySystemMapper.js` (신규)

1. 간단한 매핑 테이블 정의 (초기 버전)

```js
const BODY_SYSTEM_MAP = [
  { system: 'breast', patterns: [/유방암/, /유방 종양/, /breast/i] },
  { system: 'cardio', patterns: [/협심증/, /심근경색/, /관상동맥/, /angina/i, /myocardial/i] },
  { system: 'cns', patterns: [/뇌경색/, /뇌출혈/, /중풍/, /stroke/i] },
  // 필요 시 확장
];

export function mapDiagnosisToBodySystem(diagnosisText, codes = {}) {
    const text = (diagnosisText || '').toLowerCase();
    for (const item of BODY_SYSTEM_MAP) {
        if (item.patterns.some(p => p.test(text))) {
            return item.system;
        }
    }
    // ICD 코드 기반 추가 매핑 가능
    return 'other';
}
```

2. 사용 위치
   - `DisclosureAnalyzer` 또는 DisputeTag 로직에서
     - 사건/episode의 주 진단군을 계산할 때 사용.

---

### Task 4. DisputeTag 생성 및 중요도 스코어링 유틸 구현

**파일:** `backend/services/core-engine/utils/DisputeScoringUtil.js` (신규)

1. phase 계산 함수

```js
export function calculatePhase(eventDate, contractInfo) {
    if (!eventDate || !contractInfo?.issueDate) return 'COVERED_PERIOD';

    const e = new Date(eventDate);
    const issue = new Date(contractInfo.issueDate);
    const waitingEnd = new Date(issue);
    waitingEnd.setDate(waitingEnd.getDate() + (contractInfo.waitingPeriodDays || 0));

    if (e < issue) return 'PRE_CONTRACT';
    if (e >= issue && e <= waitingEnd) return 'WAITING_PERIOD';
    return 'COVERED_PERIOD';
}
```

2. 진단/청구 매칭 점수

```js
export function calcDiagnosisMatch(eventBodySystems, claimSpec) {
    if (!claimSpec?.claimBodySystems?.length) return 0.0;

    const setA = new Set(eventBodySystems);
    const setB = new Set(claimSpec.claimBodySystems);
    const intersection = [...setA].filter(x => setB.has(x));

    if (intersection.length === 0) return 0.0;
    return intersection.length / setB.size; // 간단한 Jaccard 유사도 형태
}
```

3. 중증도 점수

```js
export function calcSeverityScore(event) {
    // 예시: 수술/입원/항암 여부로 가중치 부여
    const entities = event.entities || [];
    let score = 0;

    const hasSurgery = entities.some(e => e.type === 'procedure' && e.procedureType === 'surgery');
    const hasAdmission = entities.some(e => e.type === 'event' && e.subtype === 'admission');
    const hasChemo = entities.some(e => e.type === 'medication' && /항암|chemo/i.test(e.text || ''));

    if (hasSurgery) score += 0.5;
    if (hasAdmission) score += 0.3;
    if (hasChemo) score += 0.2;

    return Math.min(score, 1.0);
}
```

4. 체인 위치 점수 (검진→이상소견→확진→치료)

```js
export function calcChainPositionScore(event, timelineContext) {
    // 초기 버전: index event와의 날짜 거리만 고려
    if (!timelineContext?.indexEventDate) return 0.0;

    const e = new Date(event.date);
    const idx = new Date(timelineContext.indexEventDate);
    const diffDays = Math.abs((e - idx) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return 1.0;
    if (diffDays <= 30) return 0.7;
    if (diffDays <= 180) return 0.4;
    return 0.1;
}
```

5. 최종 중요도 점수

```js
export function scoreEvent(event, claimSpec, contractInfo, timelineContext) {
    const phase = calculatePhase(event.date, contractInfo);

    const eventBodySystems = (event.entities || [])
        .filter(e => e.type === 'diagnosis')
        .map(e => mapDiagnosisToBodySystem(e.normalizedText || e.text || '', e.codes || {}));

    const matchScore = calcDiagnosisMatch(eventBodySystems, claimSpec);
    const severityScore = calcSeverityScore(event);
    const chainScore = calcChainPositionScore(event, timelineContext);

    const phaseWeight = {
        PRE_CONTRACT: 0.7,
        WAITING_PERIOD: 1.0,
        COVERED_PERIOD: 0.5
    }[phase] || 0.5;

    const importanceScore =
        0.35 * phaseWeight +
        0.35 * matchScore +
        0.20 * severityScore +
        0.10 * chainScore;

    const reasons = [];
    if (phase === 'PRE_CONTRACT') reasons.push('가입 전 치료력');
    if (phase === 'WAITING_PERIOD') reasons.push('대기기간 내 사건');
    if (matchScore >= 0.7) reasons.push('청구 질환과 높은 관련성');
    if (severityScore >= 0.5) reasons.push('중증 사건(수술/입원/항암 등)');

    return {
        phase,
        importanceScore: Math.min(1.0, importanceScore),
        reasons
    };
}
```

> 이후 Phase 3에서 `importanceScore` 계산 내부에 경량 ML 결과를 혼합하는 구조로 확장할 수 있도록, 유틸을 별도 파일로 분리한다.

---

### Task 5. DisclosureAnalyzer 또는 별도 모듈에서 DisputeTag 생성

**파일:** `backend/services/core-engine/DisclosureAnalyzer.js` 또는 신규 `DisputeTaggingService.js`

초기 버전은 **새로운 파일을 만드는 것보다, DisclosureAnalyzer 내부에 “이벤트별 쟁점 태깅” 로직을 추가**하는 쪽이 파이프라인 영향이 적다.

1. `analyzeDisclosure(ruleResults, entities, timeline)` 내부에 아래 로직 추가:

```js
import { scoreEvent } from './utils/DisputeScoringUtil.js';
import { DisputeTag } from './DataContracts.js'; // 실제 export 방식에 맞춰 조정

async analyzeDisclosure(ruleResults, entities, timeline, claimSpec, contractInfo) {
    // 기존 로직 ...
    
    // 0. index event(청구 사건) 추출 (간단 버전: claimDate와 가장 가까운 event)
    const timelineEvents = timeline?.events || timeline || []; // 구조에 맞게 조정
    const indexEvent = this.findIndexEvent(timelineEvents, claimSpec);

    const timelineContext = {
        indexEventDate: indexEvent ? indexEvent.date : null
    };

    for (const event of timelineEvents) {
        const { phase, importanceScore, reasons } =
            scoreEvent(event, claimSpec, contractInfo, timelineContext);

        // 고지의무 후보 여부 (임시 규칙)
        let dutyToDisclose = 'NONE';
        if (phase === 'PRE_CONTRACT' && importanceScore >= 0.5) {
            dutyToDisclose = 'POTENTIAL';
        }

        event.disputeTag = new DisputeTag({
            phase,
            importanceScore,
            dutyToDisclose,
            reasons
        });
    }

    // 이후 disclosureItems/riskAssessment 생성 시 event.disputeTag를 참고
}
```

2. `findIndexEvent`는 간단한 유틸로 구현

```js
findIndexEvent(events, claimSpec) {
    if (!claimSpec?.claimDate || !events?.length) return null;
    const claimDate = new Date(claimSpec.claimDate);

    return events.reduce((best, e) => {
        const d = new Date(e.date);
        const diff = Math.abs(d - claimDate);
        if (!best) return { event: e, diff };
        return diff < best.diff ? { event: e, diff } : best;
    }, null)?.event || null;
}
```

---

### Task 6. ReportSynthesizer 타임라인 섹션에 DisputeTag 반영

**파일:** `backend/services/core-engine/ReportSynthesizer.js`

1. `skeletonTemplate.timeline` 구조는 그대로 두되, 각 event에 `disputeTag`를 포함하도록 `constructTimeline` 로직을 조정.

2. 예시 로직 (실제 코드에는 기존 구조를 참고하여 merge)

```js
async constructTimeline(skeletonReport, analysisResults) {
    const timeline = analysisResults.timeline; // TimelineAssembler 결과

    skeletonReport.timeline.events = (timeline.events || timeline || []).map(e => ({
        date: e.date,
        type: e.type,
        summary: this.summarizeEvent(e),
        disputeTag: e.disputeTag ? e.disputeTag.toJSON ? e.disputeTag.toJSON() : e.disputeTag : null,
        confidence: e.confidence || null
    }));

    // keyDates, episodeOfCare 등은 기존 로직 유지
}
```

3. `summarizeEvent`는 기존 요약 로직 또는 간단 버전으로 시작

```js
summarizeEvent(event) {
    const diagnoses = (event.entities || []).filter(e => e.type === 'diagnosis');
    const primaryDx = diagnoses[0]?.normalizedText || diagnoses[0]?.text || null;

    return {
        primaryDiagnosis: primaryDx,
        diagnosisCount: diagnoses.length,
        hasSurgery: (event.entities || []).some(e => e.type === 'procedure' && e.procedureType === 'surgery')
    };
}
```

---

### Task 7. 테스트 및 검증

1. **단위 테스트 추가**
   - `tests/unit/DisputeScoringUtil.test.js`
   - `tests/unit/DisclosureAnalyzer.disputeTagging.test.js`
   - 대표 케이스의 날짜/진단/계약정보를 사용하여
     - PRE_CONTRACT/WAITING_PERIOD/COVERED_PERIOD 분류 검증
     - 중요도 점수 범위 및 직관적 순서 검증

2. **엔드투엔드 테스트 (대표 케이스 3~5개)**
   - `backend/tests/core-engine-simple.test.js` 또는 별도 테스트 파일에서
     - 전체 파이프라인 실행 후, `analysisResults.timeline.events` 내 `disputeTag`가 채워져 있는지 확인
     - 중요도 상위 N(예: 5개) 이벤트가 실제 report의 주요 사건과 어느 정도 일치하는지 수동 확인

3. **회귀 확인**
   - 기존 기능(특히 `ReportSynthesizer`) 출력 포맷이 외부 API/프론트엔드에서 기대하는 스키마와 호환되는지 확인
   - 새로운 필드는 **추가**만 하고, 기존 필드 이름이나 구조는 변경하지 않는다.

---

## 4. 완료 조건 (Definition of Done)

- [ ] DataContracts에 DisputeTag 타입 및 관련 필드가 추가됨
- [ ] DisputeScoringUtil이 구현되고 단위 테스트가 통과함
- [ ] DisclosureAnalyzer(또는 별도 태깅 모듈)가 타임라인 이벤트에 disputeTag를 세팅함
- [ ] ReportSynthesizer.timeline 섹션이 disputeTag를 포함한 이벤트 리스트를 반환함
- [ ] 대표 케이스 3~5건에서 상위 중요도 episode가 실제 report의 주요 사건과 80% 이상 일치
- [ ] 기존 파이프라인(E2E 테스트)이 모두 통과하며, API 응답 스키마가 깨지지 않음
