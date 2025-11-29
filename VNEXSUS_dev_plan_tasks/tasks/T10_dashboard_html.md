# T10. 커버리지/룰 적중률 대시보드(HTML 리포트 자동 생성)

## 목적
- “정밀도/심사기준” 프로젝트는 개선을 수치로 트래킹해야 한다.
- 케이스별 커버리지, 룰 적중률, 누락 목록을 한 번에 보는 HTML 리포트를 자동 생성.

## 산출물
- NEW: `backend/eval/generate_dashboard.js`
- OUTPUT: `backend/eval/output/dashboard.html`

## 포함 지표
- report 날짜/코드/병원 커버리지
- 질문별 적중률(몇 건에서 Q가 탐지되었는지)
- 이벤트별 sourceSpan 첨부율
- 처리시간(케이스당) 및 실패 로그

## 완료 기준(DoD)
- 1회 실행으로 HTML이 생성되고 브라우저에서 바로 확인 가능
