# T01. Report Subset Validator (자동 검증 루프)

## 목적
- “report ⊆ vnexsus”를 자동으로 검증해 **누락 0을 목표로 회귀 테스트**를 운영한다.
- 정밀도 우선이므로 “과잉 포함”은 허용하되 “누락”은 실패로 본다.

## 범위
- 케이스 입력: `case_sample.zip` (report/vnexsus 존재 케이스 우선)
- 비교 항목(초기):
  1) 날짜 매칭 (YYYY-MM-DD)
  2) 병원명 매칭(정규화 후)
  3) ICD/KCD 코드 매칭
- 2차(확장):
  - 주요 검사/수술 키워드(CT/MRI/CAG/조직검사/수술명 등)

## 대상 파일/모듈
- NEW: `backend/eval/report_subset_validator.js`
- NEW: `backend/eval/normalize_for_compare.js`
- OUTPUT: `backend/eval/output/missing_report_items.json`

## 구현 상세(코어 로직)
1) report 텍스트 파싱:
   - 날짜/코드/병원명 후보를 regex + 사전(병원 alias)로 추출
2) vnexsus 결과(또는 event table) 파싱:
   - event.date, event.hospital, event.diagnosis.code를 추출
3) 매칭:
   - 날짜는 exact match
   - 병원은 normalize 후 exact/fuzzy(초기엔 exact+alias)
   - 코드는 exact match + prefix match(예: I20.1 vs I20)
4) 실패 리포트:
   - { caseId, missingDates[], missingCodes[], missingHospitals[], samples[] }

## 완료 기준(DoD)
- 케이스 {baseline['case_counts']['cases_with_both']}건 기준:
  - 날짜 커버리지, 코드 커버리지, 병원 커버리지를 출력하는 JSON 생성
  - run 1회로 전체 리포트 생성 가능
- 이후 Phase에서 모든 PR은 이 검증을 통과해야 merge 가능(운영 규칙).
