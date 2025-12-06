# tasks_phase2_investigator_view.md
VNEXSUS Phase 2 – Investigator Report View 및 편집 보조 UI 구현 계획서

## 1. 범위 및 목표

- 범위
  - Phase 1에서 생성된 DisputeTag/importanceScore를 활용해
  - **“사건 후보 + 조사자 편집 보조”**를 위한 백엔드 뷰 + 프론트엔드 화면을 구현한다.
- 목표
  - 한 케이스에 대해
    - 타임라인 패널에서 상위 중요도 사건을 빠르게 확인
    - 오른쪽 경과보고서 초안을 한 번에 확인 후, 일부 수정/삭제/추가
  - 평균 처리 시간 **3~5분** 목표.

---

## 2. 백엔드 변경 – Investigator View JSON 구조 설계

### 2-1. ReportSynthesizer에 investigatorView 섹션 추가

**파일:** `backend/services/core-engine/ReportSynthesizer.js`

1. `skeletonTemplate`에 `investigatorView` 섹션 추가

```js
this.skeletonTemplate = {
  // 기존 필드...
  timeline: { /* ... */ },
  riskAssessment: { /* ... */ },
  qualityMetrics: { /* ... */ },
  evidenceBase: { /* ... */ },
  // 신규
  investigatorView: {
    claimSummary: null,
    keyEpisodes: [],   // 중요도 상위 episode 요약
    allEpisodes: [],   // 전체 episode + disputeTag + 근거 링크
    generationHints: [] // 조사자 편집에 참고될 힌트
  }
};
```

2. `synthesizeReport(analysisResults)` 내부에서 `buildInvestigatorView` 호출 추가

```js
const skeletonReport = this.initializeSkeletonReport(analysisResults);

await this.generateClinicalSummary(skeletonReport, analysisResults);
await this.constructTimeline(skeletonReport, analysisResults);
await this.integrateRiskAssessment(skeletonReport, analysisResults);
await this.setQualityMetrics(skeletonReport, analysisResults);
await this.setEvidenceBase(skeletonReport, analysisResults);

// 신규
await this.buildInvestigatorView(skeletonReport, analysisResults);

if (this.options.enableContentOptimization) {
  await this.optimizeReportContent(skeletonReport, analysisResults);
}
```

3. `buildInvestigatorView` 구현 (핵심 로직 예시)

```js
async buildInvestigatorView(skeletonReport, analysisResults) {
    const timelineEvents = skeletonReport.timeline.events || [];
    const claimSpec = analysisResults.claimSpec || null;
    const contractInfo = analysisResults.contractInfo || null;

    // 1) 청구 요약
    skeletonReport.investigatorView.claimSummary = {
        claimId: claimSpec?.claimId || null,
        claimDate: claimSpec?.claimDate || null,
        claimType: claimSpec?.claimType || null,
        claimDiagnoses: claimSpec?.claimDiagnosisCodes || [],
        insurer: contractInfo?.insurer || null,
        productName: contractInfo?.productName || null,
        issueDate: contractInfo?.issueDate || null
    };

    // 2) episode 단위 변환 (TimelineAssembler grouping 전략과 맞춰야 함)
    const episodes = this.groupEventsToEpisodes(timelineEvents);

    // importanceScore 기준 정렬
    const sortedEpisodes = episodes.sort((a, b) => 
        (b.disputeTag?.importanceScore || 0) - (a.disputeTag?.importanceScore || 0)
    );

    // 3) 중요 episode 상위 N개 (예: 5개)
    const TOP_N = 5;
    skeletonReport.investigatorView.keyEpisodes = sortedEpisodes.slice(0, TOP_N).map(ep => ({
        episodeId: ep.episodeId,
        dateRange: ep.dateRange,
        mainHospital: ep.mainHospital,
        mainDiagnosis: ep.mainDiagnosis,
        disputeTag: ep.disputeTag,
        summaryText: this.buildEpisodeSummaryText(ep)
    }));

    // 4) 전체 episode 목록
    skeletonReport.investigatorView.allEpisodes = sortedEpisodes.map(ep => ({
        episodeId: ep.episodeId,
        rawEvents: ep.events,
        disputeTag: ep.disputeTag,
        summaryText: this.buildEpisodeSummaryText(ep),
        evidenceLinks: ep.evidenceLinks || [] // EvidenceBinder와 연계
    }));

    // 5) 조사자 힌트
    skeletonReport.investigatorView.generationHints = [
        '상위 episode부터 보고서에 포함 여부를 판단하세요.',
        'PRE_CONTRACT 또는 WAITING_PERIOD 사건에 우선적으로 주목하세요.',
        'POTENTIAL dutyToDisclose 사건은 고지의무 위반 가능성 검토 대상으로 표시하세요.'
    ];
}
```

4. `groupEventsToEpisodes` 및 `buildEpisodeSummaryText`는 간단 버전부터 시작 후 점진적으로 고도화

```js
groupEventsToEpisodes(events) {
    // 초기 버전: 날짜 기준으로 30일 이내, 같은 병원을 하나의 episode로 묶는 간단 로직
    const episodes = [];
    // ... 구현 (TimelineAssembler의 episode grouping 전략을 재사용하는 것이 이상적)
    return episodes;
}

buildEpisodeSummaryText(ep) {
    const mainDx = ep.mainDiagnosis || '';
    const range = ep.dateRange || '';
    const phase = ep.disputeTag?.phase || '';
    const duty = ep.disputeTag?.dutyToDisclose || '';

    return `[${range}] ${mainDx} (${phase}, ${duty})`;
}
```

---

### 2-2. Investigator View 전용 API 엔드포인트 설계

**파일 후보:**  
- `backend/routes/reportRoutes.js`  
- 혹은 API 문서에 나와 있는 기존 `/api/ocr/download/{documentId}` 확장

1. 응답 포맷 예시

```json
{
  "success": true,
  "data": {
    "timelineView": { /* 기존 vnexsus 타임라인 */ },
    "investigatorView": {
      "claimSummary": { /* 위에서 정의한 구조 */ },
      "keyEpisodes": [ /* ... */ ],
      "allEpisodes": [ /* ... */ ]
    },
    "rawSkeleton": { /* ReportSynthesizer 전체 skeletonReport */ }
  }
}
```

2. 구현 포인트
   - 기존 결과 다운로드 API가 `skeletonReport`를 반환한다면,
     - 그 안에 포함된 `investigatorView`를 그대로 프론트에서 활용하도록 한다.
   - 별도 엔드포인트로 분리할지 여부는 현재 API 설계에 맞춰 결정하되,
     - 최소 변경 원칙을 지킨다.

---

## 3. 프론트엔드 – Investigator View UI 설계

### 3-1. 레이아웃 개요

- 좌측: **타임라인 / episode 리스트 패널**
- 우측 상단: **청구 요약 및 쟁점 요약**
- 우측 하단: **경과보고서 초안 에디터**

간단한 레이아웃 예시 (React 상상 코드):

```jsx
<div className="investigator-layout">
  <aside className="timeline-panel">
    <EpisodeList episodes={keyEpisodes} allEpisodes={allEpisodes} />
  </aside>
  <main className="report-panel">
    <ClaimSummaryPanel claimSummary={claimSummary} />
    <ReportEditor
      initialDraft={autoDraft}
      episodes={allEpisodes}
      onEpisodeToggle={...}
      onChange={...}
    />
  </main>
</div>
```

### 3-2. EpisodeList 컴포넌트

- 각 episode 카드에 표시할 정보
  - 날짜 범위 (`dateRange`)
  - 주요 진단 (`mainDiagnosis`)
  - 쟁점 태그 (`phase`, `dutyToDisclose`)
  - 중요도 시각화 (막대/뱃지)

- 선택/해제 기능
  - 체크박스를 통해 “이 episode를 보고서에 포함할지” 선택
  - 선택 상태는 `ReportEditor`와 양방향으로 연동

### 3-3. ReportEditor 컴포넌트

- 입력
  - `initialDraft`: ReportSynthesizer가 생성한 경과보고서 초안 텍스트 (Ⅱ. 조사 사항 / Ⅲ. 조사자의견 등)
  - `episodes`: `allEpisodes` (episodeId, summaryText, disputeTag 등)

- 기능
  1. **자동 생성된 보고서 초안 표시**
  2. **에피소드 삽입/삭제**
     - EpisodeList에서 체크한 episode에 해당하는 문단 자동 생성/제거
  3. **하이라이트 연동**
     - EpisodeList에서 episode 클릭 → 보고서 내 해당 문단 스크롤/하이라이트
  4. **편집 내용 실시간 저장 (auto-save)**
     - debounce(예: 1~2초)로 백엔드에 초안 저장

---

## 4. 편집 내용 저장 및 episode-문단 매핑

### 4-1. 저장 구조 설계

DB 예시 스키마 (개념 수준)

- `reports`
  - `id`
  - `case_id`
  - `version`
  - `content` (text, 경과보고서 전체)
  - `created_at`
  - `updated_at`

- `report_episode_links`
  - `id`
  - `report_id`
  - `episode_id`
  - `section` (예: "II.조사사항", "III.조사자의견")
  - `weight` (선택적으로 중요도/정렬용)

편의상 초기에는

- `content`에 전체 텍스트 저장
- `report_episode_links`에는 어떤 episode가 보고서에 포함되었는지만 1:1로 저장해도 충분하다.

### 4-2. API 설계

1. **초안 저장** – `POST /api/reports/{caseId}/draft`
   - Body
     - `content`: 현재 에디터 텍스트
     - `includedEpisodeIds`: 포함된 episodeId 배열
   - Response
     - `reportId`, `updatedAt` 등

2. **최종 보고서 확정** – `POST /api/reports/{caseId}/finalize`
   - Body
     - `reportId`
   - Response
     - 성공/실패 상태 및 메타데이터

---

## 5. 테스트 계획

1. 프론트엔드
   - 주요 컴포넌트 스냅샷/동작 테스트
   - Episode 선택 → 보고서 문단 생성/삭제 플로우 테스트

2. 백엔드
   - `ReportSynthesizer`가 `investigatorView`를 포함한 skeletonReport 생성하는지 확인
   - 저장 API가 report 및 episode 링크를 정상적으로 기록하는지 검증

3. UX 검증
   - 대표 케이스 3~5건을 가지고 실제 조사 흐름을 재현
   - 수작업 vs 앱 사용 시간 비교 (20~60분 vs 3~5분 목표)

---

## 6. 완료 조건 (Definition of Done)

- [ ] ReportSynthesizer에서 `investigatorView` 섹션이 포함된 skeletonReport를 생성
- [ ] Investigator View 전용 JSON 구조가 API로 노출
- [ ] 프론트엔드에서 타임라인 패널 + 경과보고서 에디터 UI가 동작
- [ ] episode 선택/해제와 보고서 문단 생성/삭제가 연동
- [ ] 초안/최종 보고서가 DB에 저장되고, episode 링크가 기록
- [ ] 대표 케이스 기준 평균 처리 시간 3~5분 내 달성 가능
