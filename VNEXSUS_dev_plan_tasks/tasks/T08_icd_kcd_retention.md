# T08. ICD/KCD 코드 보존 강화(추출/정규화/병합)

## 목적
- report에 등장하는 코드는 VNEXSUS에 반드시 존재해야 한다(부분집합 보장 핵심).
- 정밀도 우선이므로 “코드가 있다면 1차 사실”로 취급한다.

## 개선 포인트
1) Extract 단계(LLM/regex)
   - aiEntityExtractor 프롬프트에 ‘코드 필수 필드’를 명시
   - 원문에서 코드 패턴(예: I20.1, D18.02)을 regex로 선추출 후 LLM에 컨텍스트로 제공(하이브리드)
2) Normalize 단계
   - 코드 prefix/점(.) 포함 표준화
   - 동일 코드 중복 제거 + 각 코드별 근거 스팬 기록
3) Merge 단계(이벤트 병합 시 코드 소실 방지)
   - mergeEvents에서 diagnosis.code가 하나라도 있으면 모두 보존(배열화 가능)

## 대상 파일
- MOD: `backend/postprocess/aiEntityExtractor.js`
- NEW/MOD: `backend/postprocess/codeExtractor.js`
- MOD: `backend/postprocess/medicalEventModel.js` (merge)

## 완료 기준(DoD)
- report 코드 커버리지 평균 95%+(validator 기준)
- 코드가 붙은 이벤트는 항상 sourceSpan 포함
