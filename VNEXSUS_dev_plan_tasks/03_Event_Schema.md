# 03. Event Schema (단일 이벤트 테이블 / SSOT)

## 목표
- 모든 후처리 결과를 “단일 이벤트 배열”로 귀결시키고,
- Excel/txt/json/요약/고지맵/결론 생성은 모두 이를 기반으로 한다.
- 보고서(report) subset 보장은 “event table에 report 정보를 포함하는지” 테스트로 강제한다.

## 제안 스키마(JSON)
```json
{
  "id": "evt_2024-04-09_0001",
  "date": "2024-04-09",
  "time": "12:55",
  "endDate": "2024-04-09",
  "hospital": "삼성서울병원",
  "department": "소화기내과",
  "diagnosis": {
    "name": "간 혈관종",
    "code": "D18.02",
    "raw": "Hepatic hemangioma"
  },
  "eventType": "검사",
  "procedures": [
    {"name": "복부 CT", "code": null, "result": "혈관종 의심"}
  ],
  "treatments": [
    {"name": "경과관찰", "detail": "6개월 간격 추적"}
  ],
  "doctorOpinion": "간 혈관종으로 추정되어 경과관찰",
  "shortFact": "복부 CT 시행, 간 혈관종 진단",
  "flags": {
    "preEnroll3M": true,
    "preEnroll5Y": true,
    "postEnroll": false,
    "disclosureRelevant": true,
    "claimRelated": true
  },
  "uw": {
    "questionIds": ["Q_UW_5Y_MAJOR_EXAM", "Q_UW_TUMOR"],
    "materialityScore": 0.92,
    "severityScore": 0.80,
    "overallScore": 0.88,
    "ruleHits": [
      {"ruleId": "R_TUMOR_CODE", "evidence": "D18.02"},
      {"ruleId": "R_MAJOR_EXAM_CT", "evidence": "CT"}
    ]
  },
  "sourceSpan": {
    "start": 10234,
    "end": 10510,
    "textPreview": "2024.04.09 ... CT ... Hepatic hemangioma ..."
  }
}
```

## 필수 필드(정밀도 우선)
- `date`, `hospital`, `shortFact`, `sourceSpan`
- 진단/검사/치료는 “원문 근거가 있을 때만” 채운다.

## 구현 포인트(코드 단위)
- `backend/postprocess` 하위에 `eventModel.js`(또는 `medicalEvent.js`)를 추가
  - `createEventFromBlock(...)`
  - `mergeEvents(...)`
  - `normalizeDiagnosisCode(...)`
  - `attachSourceSpan(...)`
