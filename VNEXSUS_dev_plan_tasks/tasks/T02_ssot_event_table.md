# T02. SSOT Event Table 도입 & ReportBuilder 일원화

## 목적
- 모든 출력(Excel/txt/json/고지맵/요약)이 **단일 이벤트 테이블(SSOT)**만 보게 한다.
- 원문 재요약 경로를 차단하여 정밀도를 확보하고, subset 보장을 기술적으로 가능하게 한다.

## 범위
- MedicalEvent 스키마 도입
- ReportBuilder 입력을 `organizedData`가 아니라 `medicalEvents[]`로 표준화(내부 변환 허용)

## 대상 파일/모듈
- NEW: `backend/postprocess/medicalEventModel.js`
- MOD: `backend/postprocess/reportBuilder.js`
- MOD: `backend/postprocess/aiEntityExtractor.js` (필요 필드 충족)

## 구현 상세(코드 스케치)
```js
// medicalEventModel.js
export function buildEvents({ dateBlocks, entities, rawText }) { /* ... */ }
export function attachSourceSpan(evt, rawText, anchorTerms) { /* ... */ }
export function mergeEvents(e1, e2) { /* 코드 소실 방지 */ }

// reportBuilder.js
async buildReport(organizedData, patientInfo, options={}) {
  const events = options.events ?? buildEvents({ /* ... */ });
  const reportData = prepareReportDataFromEvents(events, patientInfo, options);
  return this._generateExcelReport(reportData, ...);
}
```

## 완료 기준(DoD)
- 기존 포맷(Excel/txt/json) 출력이 동일하게 동작
- 출력 생성이 원문(rawText)을 직접 참조하지 않고 event table만 사용(정밀도 가드)
- 이벤트별 sourceSpan 누락률 측정 가능
