# T07. Episode Clustering(사건 단위 압축) 구현

## 목적
- 조사자가 하는 “통원기간 / n회 / 핵심 검사·수술만 표시” 패턴을 재현한다.
- VNEXSUS는 전체집합 + episode 요약을 함께 제공하여 “빠른 심사”를 돕는다.

## 입력/출력
- 입력: medicalEvents[]
- 출력: episodes[] + episodeId가 달린 events

## 클러스터링 기준(초기 v1)
- 같은 병원(정규화) AND 같은 질환 클러스터(organSystem 또는 diagnosis group) AND
- 날짜 간격 ≤ 30일(외래 추적) 또는 입원 기간 overlap
- episode summary:
  - startDate, endDate, visitCount, keyEvents(수술/입원/중대검사), 대표 진단코드

## 대상 파일
- NEW: `backend/postprocess/episodeClusterer.js`
- MOD: `backend/postprocess/reportBuilder.js` (episode 섹션 출력)
- MOD: `backend/postprocess/dateOrganizer.js` (기간 계산 재사용 가능)

## 완료 기준(DoD)
- report에서 자주 쓰는 “통원기간/횟수” 문구가 자동 생성 가능
- episode가 question map에 연결될 수 있도록 episode-level ruleHit 제공(옵션)
