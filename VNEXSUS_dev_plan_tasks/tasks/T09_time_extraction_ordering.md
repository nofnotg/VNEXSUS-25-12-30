# T09. 동일일 시간 추출 + 시간순 정렬

## 목적
- 고지의무 위반에서 “같은 날 진단 vs 보장개시”처럼 시간 순서가 쟁점이 되는 케이스를 지원.
- 가능할 때만 적용(원문에 시간이 없으면 비활성).

## 수행 내용
- time regex(예: 12:55, 14:11, 1255) 추출
- event.time 필드에 저장
- 동일 date 내에서는 time 기준으로 stable sort

## 대상 파일
- MOD: `backend/postprocess/enhancedMassiveDateBlockProcessor.js` 또는 `medicalEventModel.js`
- MOD: `backend/postprocess/reportBuilder.js` (표/텍스트 출력 반영)

## 완료 기준(DoD)
- 시간 정보가 있는 케이스에서, 동일일 이벤트가 시간 순으로 출력됨
- subset validator에 “시간 비교”는 추후 확장(초기에는 날짜/코드/병원 우선)
