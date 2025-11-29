# 06. Task Backlog (우선순위/의존성/완료기준)

## P0 (최우선: 이게 안 되면 다음이 의미 없음)
- T01. Report Subset Validator 구축 (report ⊆ vnexsus 자동검증)
- T02. SSOT Event Table 도입 & ReportBuilder 일원화
- T03. SourceSpan(근거 스팬) 강제 저장 + 출력 포함

## P1 (고지의무 위반 / 심사기준 우선)
- T04. Underwriting Question Map 정의(uwQuestions.json)
- T05. Disclosure Rules Engine 구현(disclosureRulesEngine.js)
- T06. majorEvents.json 확장(코드/질환군/중대검사/수술 트리거)

## P2 (조사자 방식의 압축 & 정밀도)
- T07. Episode Clustering 구현(기간/횟수/핵심 이벤트)
- T08. ICD/KCD 코드 보존 강화(추출/정규화/병합)
- T09. 동일일 시간 추출 + 시간순 정렬(가능한 케이스)

## P3 (운영성/확장)
- T10. 케이스별 커버리지/룰 적중률 대시보드(HTML 리포트 자동 생성)
- T11. UI 출력 규격 반영(Core/Episode/Full + 질문맵)
- T12. 개인정보 마스킹 & 저장정책 문서

각 task 상세는 `tasks/Txx_*.md` 참조.
