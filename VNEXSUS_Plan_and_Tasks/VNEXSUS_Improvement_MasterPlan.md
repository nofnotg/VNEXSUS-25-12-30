# VNEXSUS 쟁점 강화 및 자동 경과보고서 고도화 마스터 플랜

## 0. 배경 및 현재 상태

- 시스템: VNEXSUS AI 의료 문서 처리 시스템
- 현재 파이프라인: **파일 업로드 → OCR 호출 및 텍스트 추출 → 코어엔진 후처리 → 결과 보고서 출력**
- 핵심 코어엔진 컴포넌트 (일부 발췌)
  - `TextIngestor`, `AnchorDetector`, `EntityNormalizer`
  - `TimelineAssembler`, `DiseaseRuleEngine`, `DisclosureAnalyzer`
  - `ConfidenceScorer`, `EvidenceBinder`, `ReportSynthesizer`
- 현재 정성 평가
  - 조사자 체감 정합도: 약 **7.5 / 10**
  - 수작업 경과보고서 작성 시간: **20분 ~ 60분**
  - 목표: 앱 사용 시 **평균 3분, 최대 5분** 내에 “사건 후보 + 조사자 편집”까지 완료

> 중요한 제약: **파일 업로드 → OCR 처리 → 코어엔진 입력까지의 파이프라인은 그대로 유지**한다.  
> 변경/추가 작업은 `backend/services/core-engine/` 내부의 모듈 및 뷰/저장 레이어에 한정한다.

---

## 1. 최종 목표 정의

### 1-1. 기능적 목표

1. **쟁점 축 강화**
   - 각 의료 이벤트/episode 단위로
     - 계약 기준(가입일, 대기기간, 보장기간)
     - 청구 질환과의 관련성
     - 고지의무/기고지 소지 여부
   - 를 계산하여 **`DisputeTag`** 형태의 메타데이터를 부여.

2. **사건 후보 + 조사자 편집 보조**
   - VNEXSUS가 시간축 기반 “풀 히스토리 타임라인”을 생성.
   - 그 위에 쟁점 레이어(phase/role/score)를 입혀
     - 조사자가 **우선 검토해야 할 사건 후보 리스트**를 한눈에 보고
     - 우측 “경과보고서 초안”을 수정/추가/삭제하는 UX 제공.

3. **완전 자동 보고서 생성으로의 확장 가능성 확보**
   - Phase 2에서 수집된 “조사자의 편집 패턴”을 데이터로 저장.
   - 이 데이터를 기반으로
     - 사건 중요도 `importanceScore` 보정
     - “조사자의견” 섹션 자동생성 강화
   - 를 통해 단계적으로 “완전 자동 보고서”에 근접.

### 1-2. 정량적 목표 (v1 기준)

- 정합도(조사자 평가)
  - 현재: 7.5 / 10
  - 목표: **9.0 / 10 이상 (대표 케이스 10건 기준)**

- 시간 절감
  - 현재: 케이스당 20~60분
  - 목표: **평균 3~5분 내 1차 검토 + 보고서 초안 확정**

- 안정성
  - 기존 파이프라인(파일 업로드, OCR, 코어엔진 진입점)과의 호환성 100%
  - 코어엔진 주요 테스트(`backend/tests/*.test.js`) 통과율 유지 또는 상승

---

## 2. 아키텍처 레벨 설계

### 2-1. 4-레이어 구조 재정의 (기존 컴포넌트와 매핑)

1. **Perception Layer (지각층)**  
   - 책임: OCR 텍스트의 구조화, 문서/블록/표 인식, 날짜/병원/검사/진단 키워드 태깅
   - 주요 컴포넌트
     - `TextIngestor`
     - `AnchorDetector`
     - `EntityNormalizer`

2. **Event Abstraction Layer (사건 추상화층)**  
   - 책임: 엔티티 + 앵커 → 시간 이벤트/episode 생성
   - 주요 컴포넌트
     - `TimelineAssembler`  
       (`createTemporalEvents`, `constructTimeline`, `groupEventsByEpisode` 등)

3. **Causal & Contract Reasoning Layer (인과·계약 사고층)**  
   - 책임: 사건 간 인과 연결, 계약(가입일/대기기간/보장기간) 기준 분류, 고지의무/기고지 분석
   - 주요 컴포넌트
     - `DiseaseRuleEngine`
     - `DisclosureAnalyzer`
     - (신규) **DisputeTagging 로직**
       - 기존 DisclosureAnalyzer와 결합하거나, 별도 유틸/서브모듈로 추가

4. **View & Interaction Layer (뷰·상호작용층)**  
   - 책임: 타임라인 뷰, 실무형 경과보고서 뷰, 편집/저장 기능
   - 주요 컴포넌트
     - `ReportSynthesizer` (스켈레톤 JSON 생성 및 요약)
     - 프론트엔드 뷰 (타임라인 + 보고서 에디터)
     - 저장/버전관리 (보고서 텍스트 + episode 링크)

### 2-2. 쟁점 레이어(Dispute Layer) 개념

- 각 timeline event / episode에 대해 아래 필드를 추가:

```js
// DisputeTag (예시)
{
  phase: "PRE_CONTRACT" | "WAITING_PERIOD" | "COVERED_PERIOD",
  role: "CLAIM_CORE" | "ETIOLOGY" | "RISK_FACTOR" | "BACKGROUND" | "IRRELEVANT",
  dutyToDisclose: "NONE" | "POTENTIAL" | "VIOLATION_CANDIDATE",
  importanceScore: 0.0 ~ 1.0
}
```

- 이 레이어는
  - `TimelineAssembler`가 만든 이벤트 구조
  - `DiseaseRuleEngine`/`DisclosureAnalyzer` 결과
  - 계약/청구 정보(가입일, 청구 담보, index event)
- 를 결합하여 생성한다.

---

## 3. 단계별 로드맵 (스프린트 단위)

### Phase 0. 대표 케이스 선정 및 베이스라인 측정 (0.5 스프린트)

**목표:** 개선 효과를 확인할 수 있는 “쟁점 뚜렷한 케이스 세트” 확정 및 베이스라인 측정.

- 작업
  1. 대표 케이스 8~10건 선정 (이미 언급한 케이스14, 15, 18, 43 등을 우선 포함)
  2. 각 케이스에 대해
     - 현재 VNEXSUS 출력 vs 실제 report 비교
     - 누락/과잉/오판 사례 간단 태깅
  3. “정합도 7.5/10”에 대한 구체적 기준 정리
     - 예: 필수 사건 10개 중 7~8개가 적절히 포함

- 산출물
  - `/docs/evaluation/baseline_2025Q4.md`
  - 기준 점수표, 대표 케이스 리스트

---

### Phase 1. 쟁점 레이블링 + 중요도 스코어링 (1~2 스프린트)

**목표:** 타임라인 이벤트/episode 단위로 DisputeTag를 붙이고, `importanceScore`를 계산하여 “사건 후보”를 자동 도출.

- 주요 변경 지점
  - `backend/services/core-engine/DataContracts.js`
  - `backend/services/core-engine/TimelineAssembler.js`
  - `backend/services/core-engine/DisclosureAnalyzer.js`
  - `backend/services/core-engine/ReportSynthesizer.js` (타임라인 섹션 강화)

- 핵심 작업
  1. DataContracts 확장: Event/Timeline 관련 구조에 `disputeTags` 필드 추가
  2. 계약/청구 정보 구조 정의 (ClaimSpec, ContractInfo)
  3. 진단군/장기군 매핑 테이블 정의
  4. 중요도 계산 유틸 (`scoreEvent`) 구현
  5. DisclosureAnalyzer 또는 별도 유틸에서 DisputeTag 생성
  6. ReportSynthesizer에서 timeline.events에 DisputeTag 반영

- 성공 기준
  - 대표 케이스 8~10건 기준
    - 필수 사건 누락률 < 5%
    - 중요도 상위 사건만으로도 사람 report의 80~90%를 커버

**→ 세부 작업은 `tasks_phase1_dispute_layer.md` 참조**

---

### Phase 2. Investigator Report View + 편집 보조 UI (1~2 스프린트)

**목표:** “사건 후보 + 조사자 편집 보조”를 실제 화면/UX로 구현.

- 주요 변경 지점
  - 백엔드
    - `ReportSynthesizer`에서 `investigatorView` 섹션 추가
    - 결과 JSON에 episode/DisputeTag/근거 링크 포함
    - 보고서 텍스트 + episode 매핑을 위한 저장 API
  - 프론트엔드
    - 타임라인 패널 (왼쪽)
    - 경과보고서 초안 에디터 (오른쪽)
    - 양방향 하이라이트 & 선택/해제 UI

- 성공 기준
  - 대표 케이스 기준
    - “앱 기반 검토 + 편집” 평균 시간 3~5분 달성
    - 조사자 피드백: “사건 후보 리스트가 실제 업무에 유용하다” 평가

**→ 세부 작업은 `tasks_phase2_investigator_view.md` 참조**

---

### Phase 3. 경량 ML 기반 자동화 + 조사자의견 강화 (2~3 스프린트)

**목표:** Phase 2에서 쌓인 데이터를 활용해 `importanceScore`를 보정하고, “조사자의견” 섹션 자동화를 강화.

- 주요 변경 지점
  - 오프라인 학습 스크립트
    - `scripts/train_episode_importance.js` 또는 Python 스크립트
  - `DisputeTag` 계산 로직에 ML 예측값 통합
  - `ReportSynthesizer`의 “조사자의견 섹션” 자동 생성 강화

- 성공 기준
  - 조사자가 자동 보고서 초안에서 수정해야 하는 텍스트 양 30% 이상 감소
  - 쟁점 사건 누락률 유지 또는 개선

**→ 세부 작업은 `tasks_phase3_automation.md` 참조**

---

## 4. 리스크 및 대응 전략

### 4-1. 파이프라인 안정성

- 리스크
  - PipelineStateMachine 상태 정의/흐름 변경 시 전체 파이프라인에 영향
- 대응
  - **상태 머신(`PipelineStateMachine.js`)에는 새로운 state 추가 없이**,  
    - 기존 `DISCLOSURE`, `SYNTHESIZE` 단계 내부 로직/리턴 데이터 구조를 확장하는 방향으로 진행
  - 모든 변경 사항은 feature flag/옵션 기반으로 토글 가능하도록 설계

### 4-2. 법적/실무적 리스크

- 리스크
  - “고지의무 위반” 등 민감한 판단을 자동으로 라벨링하는 것에 대한 부담
- 대응
  - v1에서는 `dutyToDisclose = "POTENTIAL"` 수준으로만 표기
  - UI에서 “자동 판단이 아닌, 조사 보조용” 문구를 명시
  - 최종 보고서에는 사람이 검토/수정 후 확정하는 플로우를 전제로 설계

### 4-3. 도메인 다양성

- 리스크
  - 병원/진료과/질환이 다양해질수록 룰의 커버리지가 떨어질 수 있음
- 대응
  - Episode/DisputeTag 구조는 **질환 비특정** 일반 구조로 설계
  - 질환별 특화 룰은 `DiseaseRuleEngine`의 설정/룰셋으로 외부화

---

## 5. 스프린트 운영 가이드

- 1 스프린트 = 2주 가정
- 각 스프린트 종료 시
  - 대표 케이스 3~5건을 선정해 전/후 결과 비교
  - 정성 평가(체감 점수)와 정량 지표(처리 시간, 누락률)를 간단히 기록
- 문서화 위치 제안
  - `/docs/roadmap/vnexsus_dispute_layer_plan.md` (본 문서)
  - `/docs/tasks/tasks_phase*.md` (각 phase 별 상세 작업)

이 마스터 플랜을 기준으로, 개별 Phase에 대한 구체적인 task 문서를 아래와 같이 분리한다.

- `tasks_phase1_dispute_layer.md`
- `tasks_phase2_investigator_view.md`
- `tasks_phase3_automation.md`
