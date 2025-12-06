# tasks_phase3_automation.md
VNEXSUS Phase 3 – 경량 ML 기반 중요도 보정 및 조사자의견 자동화 고도화

## 1. 범위 및 목표

- 범위
  - Phase 2에서 수집된 **조사자 편집 데이터**를 이용해
    - 사건 중요도 `importanceScore`를 보정하고
    - “조사자의견” 섹션 자동 생성 품질을 높인다.
- 목표
  - 대표 케이스 기준
    - 자동 생성 초안에서 조사자가 수정해야 하는 텍스트 양 **30% 이상 감소**
    - 핵심 쟁점 사건 누락률은 Phase 2 수준 유지 또는 개선.

---

## 2. 데이터 수집 및 라벨링 파이프라인

### 2-1. 수집 대상

1. `skeletonReport.investigatorView`
   - `allEpisodes` (episodeId, disputeTag, summaryText 등)
2. 최종 확정된 report
   - `reports.content`
   - `report_episode_links` (어떤 episode가 포함되었는지)

### 2-2. 라벨 정의

- episode 단위 이진 라벨
  - `label = 1`: 최종 보고서에 포함된 episode
  - `label = 0`: 최종 보고서에 포함되지 않은 episode

- feature 후보
  - phase (PRE_CONTRACT/WAITING_PERIOD/COVERED_PERIOD)
  - role (CLAIM_CORE/ETIOLOGY/RISK_FACTOR/BACKGROUND/IRRELEVANT)
  - rule 기반 importanceScore (Phase 1에서 계산한 값)
  - diagnosis/장기군 특징
  - event 내 수술/입원/항암 여부
  - index event와의 날짜 거리

---

## 3. 경량 ML 모델 설계

### 3-1. 모델 선택

- 초기 버전: **로지스틱 회귀 또는 Gradient Boosting 기반 이진 분류**
  - 이유
    - 파라미터 수가 적고, 과적합 위험 낮음
    - feature 중요도를 해석하기 쉬움
    - 파이프라인에 통합하기 용이

### 3-2. 학습 스크립트 개요

**파일 후보:** `scripts/train_episode_importance.js` 또는 `scripts/train_episode_importance.py`

1. 데이터 로딩
   - DB에서 특정 기간/케이스의 `allEpisodes` + `report_episode_links`를 조회
2. feature 추출
   - DisputeTag, episode 속성을 기반으로 feature vector 생성
3. 학습/검증
   - train/validation split
   - AUC, F1, Precision/Recall 등 계산
4. 모델 아티팩트 저장
   - `model/episode_importance_model.json` 등

간단 예시 (Node.js + TensorFlow.js 또는 Python + scikit-learn 사용 가능, 여기서는 개념만 기술):

```js
// pseudo-code
const episodes = await loadEpisodesWithLabels();
const { X, y } = buildFeatureMatrix(episodes);
const model = trainLogisticRegression(X, y);
saveModel(model, 'model/episode_importance_model.json');
```

---

## 4. DisputeScoringUtil과의 통합

### 4-1. 하이브리드 점수 구조

기존 rule 기반 `importanceScore`를 유지하면서, ML 기반 score를 혼합:

```js
export function combineScores(ruleScore, mlScore, options = {}) {
    const alpha = options.alpha ?? 0.6; // rule weight
    return alpha * ruleScore + (1 - alpha) * mlScore;
}
```

- `DisputeScoringUtil.scoreEvent` 내부를 아래와 같이 리팩터링

```js
export function scoreEvent(event, claimSpec, contractInfo, timelineContext, mlModel = null) {
    const ruleResult = computeRuleBasedScore(event, claimSpec, contractInfo, timelineContext);
    let finalScore = ruleResult.importanceScore;

    if (mlModel) {
        const features = buildFeaturesForEvent(event, ruleResult, claimSpec, contractInfo, timelineContext);
        const mlScore = mlModel.predict(features); // 0~1
        finalScore = combineScores(ruleResult.importanceScore, mlScore);
    }

    const reasons = [...ruleResult.reasons];
    if (mlModel) {
        reasons.push('ML 중요도 보정 적용');
    }

    return {
        phase: ruleResult.phase,
        importanceScore: finalScore,
        reasons
    };
}
```

### 4-2. ML 모델 로딩 방식

- 단순 JSON/파라미터 형태로 저장해두고, 코어엔진 초기화 시 로딩:

```js
// 예: backend/services/core-engine/DisputeModelLoader.js
import fs from 'fs';
import path from 'path';

export function loadEpisodeImportanceModel() {
    try {
        const modelPath = path.join(process.cwd(), 'model', 'episode_importance_model.json');
        const raw = fs.readFileSync(modelPath, 'utf-8');
        const data = JSON.parse(raw);
        return {
            predict(features) {
                // 간단한 선형 모델 구현 (w·x + b → sigmoid)
                const z = data.bias + data.weights.reduce((sum, w, i) => sum + w * features[i], 0);
                return 1 / (1 + Math.exp(-z));
            }
        };
    } catch (e) {
        return null; // 모델이 없으면 rule 기반 점수만 사용
    }
}
```

- `DisclosureAnalyzer` 또는 파이프라인 초기화 코드에서

```js
import { loadEpisodeImportanceModel } from './DisputeModelLoader.js';

class DisclosureAnalyzer {
  constructor(options = {}) {
    this.episodeImportanceModel = loadEpisodeImportanceModel();
    // ...
  }
}
```

---

## 5. “조사자의견” 섹션 자동화 강화

### 5-1. 패턴 기반 템플릿

- DisputeTag/episode 정보 기반으로 템플릿 생성:

```js
generateInvestigatorOpinion(episodes, claimSpec, contractInfo) {
    const preContractEpisodes = episodes.filter(ep => ep.disputeTag?.phase === 'PRE_CONTRACT');
    const waitingPeriodEpisodes = episodes.filter(ep => ep.disputeTag?.phase === 'WAITING_PERIOD');
    const highRiskEpisodes = episodes.filter(ep => ep.disputeTag?.dutyToDisclose === 'POTENTIAL');

    const lines = [];

    if (preContractEpisodes.length > 0) {
        lines.push(`가입 전 동일(유사) 부위에 대한 진료 이력이 확인됩니다.`);
    }
    if (waitingPeriodEpisodes.length > 0) {
        lines.push(`보험계약 대기기간 내 관련 진료 이력이 존재합니다.`);
    }
    if (highRiskEpisodes.length > 0) {
        lines.push(`고지의무 위반 가능성이 있는 진료 이력이 존재하여 추가 확인이 필요합니다.`);
    }

    if (lines.length === 0) {
        lines.push(`특이한 가입 전 치료력 또는 대기기간 내 위험 요인은 확인되지 않습니다.`);
    }

    return lines.join('\n');
}
```

- 이 함수는 `ReportSynthesizer`의 “조사자의견” 섹션 생성에 사용.

### 5-2. LLM 요약과의 결합 (옵션)

- 필요 시, 위와 같은 rule 기반 초안을 prompt로 제공하고,
  - LLM에게 자연어로 다듬게 하는 2단계 구조 사용 (비용/성능 상황에 따라).

---

## 6. 평가 및 모니터링

1. 자동 보고서 vs 실제 최종 보고서 비교
   - 문단 단위 유사도(예: BLEU/ROUGE 등)보다는
     - “핵심 쟁점이 모두 언급되었는가?”에 더 초점을 둔다.

2. 수정량 측정
   - 자동 초안 대비 최종 보고서의
     - 추가/삭제된 문장 수
     - 수정된 단어 비율
   - 목표: 수정량 30% 이상 감소

3. 피드백 루프
   - 조사자가 UI에서
     - “자동 의견이 적절했는가?”를 3단계(좋음/보통/부족)로 평가하도록 하고,
     - 이 정보를 모델 개선에 활용할 수 있도록 별도 테이블에 저장.

---

## 7. 완료 조건 (Definition of Done)

- [ ] Episode 중요도에 대한 ML 모델(간단 선형/트리)이 학습되고, 아티팩트로 저장됨
- [ ] DisputeScoringUtil이 rule 기반 + ML 기반 점수를 하이브리드로 사용하도록 확장됨
- [ ] “조사자의견” 섹션이 DisputeTag/episode 정보를 기반으로 자동 생성되며, 실무상 의미 있는 수준의 문장을 제공
- [ ] 대표 케이스 기준 자동 초안에서 조사자가 수정해야 하는 텍스트 양 30% 이상 감소
- [ ] 핵심 쟁점 사건 누락률이 Phase 2 수준 이상으로 유지
