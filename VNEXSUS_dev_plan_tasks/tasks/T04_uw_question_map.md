# T04. Underwriting Question Map 정의(uwQuestions.json)

## 목적
- 고지의무 위반은 “질문 대비 증거” 구조로 판단된다.
- VNEXSUS가 심사 기준 우선으로 동작하려면 질문(Question)을 먼저 정의해야 한다.

## 산출물
- `backend/postprocess/uwQuestions.json` (신규)
- 각 질문은:
  - id, title, period(3M/5Y/ALL), triggers(키워드/코드/이벤트 타입), outputTemplateHint

## 예시 질문 세트(초기 v1)
- Q_UW_3M_DIAG_TREAT: 가입 전 3개월 내 진단/치료/검사
- Q_UW_5Y_ADMISSION_SURGERY: 최근 5년 내 입원/수술
- Q_UW_TUMOR: 종양/암 진단/검사/치료
- Q_UW_CARDIO: 협심증/관상동맥/심근경색(진단/검사)
- Q_UW_MAJOR_EXAM: 중대검사(CT/MRI/CAG/조직검사)
- Q_UW_CHRONIC_MED: 만성질환 지속투약/추적

## 완료 기준(DoD)
- v1 질문 10개 내외 정의 완료
- 각 질문마다 “최소 트리거”가 명시되어 룰 엔진에서 사용 가능
