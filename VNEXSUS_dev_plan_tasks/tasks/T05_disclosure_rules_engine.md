# T05. Disclosure Rules Engine 구현(disclosureRulesEngine.js)

## 목적
- 질문(Q)과 이벤트(Event)를 연결하는 규칙(Rule)을 코드로 구현한다.
- “왜 이 이벤트가 고지 대상인지”를 ruleId로 설명 가능하게 한다.

## 대상 파일
- NEW: `backend/postprocess/disclosureRulesEngine.js`
- NEW: `backend/postprocess/disclosureRules.json` (룰 정의 데이터)
- MOD: `backend/postprocess/reportBuilder.js` (질문맵 섹션 추가)

## 구현 흐름
```js
import rules from './disclosureRules.json';
import questions from './uwQuestions.json';

export function applyDisclosureRules(events) {
  for (const evt of events) {
    evt.uw = evt.uw ?? { questionIds: [], ruleHits: [], materialityScore: 0, severityScore: 0, overallScore: 0 };
    for (const rule of rules) {
      if (match(rule.when, evt)) {
        evt.uw.questionIds.push(rule.questionId);
        evt.uw.ruleHits.push({ ruleId: rule.ruleId, evidence: buildEvidence(rule, evt) });
        boostScores(evt, rule.then);
      }
    }
  }
  return buildQuestionMap(events, questions);
}
```

## 룰 매칭 우선순위(정밀도)
- 1순위: 코드 기반(code prefix/regex)
- 2순위: 중대검사/수술 키워드(표준 키워드 세트)
- 3순위: 진단명/영문명 매핑(사전 기반)
- “추정” 금지: 애매하면 적중시키지 않고, 대신 이벤트를 core 미만으로 남김.

## 완료 기준(DoD)
- 질문맵에 출력되는 모든 이벤트는 sourceSpan을 포함
- ruleId가 함께 출력되어 “근거 설명” 가능
