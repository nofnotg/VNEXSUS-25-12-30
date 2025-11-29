# 04. Disclosure & Underwriting Engine (고지의무/심사기준 우선 엔진)

## 핵심 설계
- 목표는 “잘 요약”이 아니라, **심사 질문(고지의무)을 정확히 충족하는 증거 이벤트를 빠짐없이 제시**하는 것.
- 학습/파인튜닝 없이도 동작하도록:
  - (1) 사전/룰 기반(majorEvents 확장) + (2) 스코어링 + (3) 근거 스팬 강제
  로 구성한다.

## A. 심사 질문(Question) 정의
`backend/postprocess/uwQuestions.json` (신규)
- 예시(실무에서 가장 빈도가 높은 축):
  - Q_UW_3M_TREATMENT: 가입 전 3개월 내 치료/검사/진단
  - Q_UW_5Y_ADMISSION_SURGERY: 최근 5년 내 입원/수술
  - Q_UW_TUMOR: 암/종양 진단/검사/치료
  - Q_UW_CARDIO: 협심증/심근경색/관상동맥 관련 진단/검사(CAG 등)
  - Q_UW_CHRONIC: 당뇨/고혈압/이상지질 등 만성질환 지속치료

각 질문은:
- 대상 기간(3M/5Y/전체)
- 트리거(코드/키워드/행위: 입원, 수술, CT/MRI/CAG 등)
- 요청 출력 형식(표/요약/근거)

## B. 룰 엔진(Rule Engine)
`backend/postprocess/disclosureRulesEngine.js` (신규)
- 룰은 “사전 정의 + 조건 조합”으로 단순하게 시작한다.

### Rule 구조 예시
```json
{
  "ruleId": "R_CARDIO_CAG",
  "questionId": "Q_UW_CARDIO",
  "when": {
    "procedureKeywordsAny": ["CAG", "관상동맥조영술", "Ergonovine", "스텐트"],
    "diagnosisCodesPrefixAny": ["I20", "I21", "I25"]
  },
  "then": {
    "materialityBoost": 0.25,
    "severityBase": 0.9
  }
}
```

### 처리 흐름
1) 이벤트 생성(SSOT)
2) 이벤트별 `ruleHits` 산출
3) 질문별 `matchedEvents` 구성
4) VNEXSUS 상단에 “질문 맵” 출력

## C. 스코어링(Underwriting First)
- `materialityScore`는 기본적으로 “심사 질문과의 일치”를 최우선으로 한다.

추천 가중치(초기값):
- 심사 질문 적중: 0.40
- 기간(3M/5Y): 0.25
- 중대 이벤트 타입(수술/입원/중대검사): 0.20
- 코드 신뢰도(코드 보존 여부/정규화 성공): 0.10
- 반복/지속치료(episode 기반): 0.05

## D. 정밀도(Precision) 가드레일
- 룰 적중이 없으면 “추정”으로 라벨하지 않는다.
- LLM을 호출하더라도, 결과는 event table에 기록된 사실만을 재조합하게 한다.
- 모든 질문 맵 출력에는 `ruleId` 및 `sourceSpan`을 포함한다(설명가능성).

