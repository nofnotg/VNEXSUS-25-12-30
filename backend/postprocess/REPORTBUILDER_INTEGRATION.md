# ReportBuilder Event Table Integration Guide

## 목적

ReportBuilder를 MedicalEvent Table 기반으로 리팩터링하여 SSOT (Single Source of Truth) 원칙 적용

## 변경 사항

### 1. buildReport() 메서드 수정

```javascript
async buildReport(organizedData, patientInfo, options = {}) {
  // options.events 파라미터 추가
  // Event Table 우선 사용, 없으면 레거시 organizedData 사용
  
  if (opts.events && Array.isArray(opts.events)) {
    reportData = this._prepareReportDataFromEvents(opts.events, patientInfo);
  } else {
    reportData = this._prepareReportData(organizedData, patientInfo);
  }
}
```

### 2. _prepareReportDataFromEvents() 신규 메서드

Event Table에서 reportData 구조로 변환

```javascript
_prepareReportDataFromEvents(events, patientInfo) {
  return {
    patientInfo,
    stats: {
      total: events.length,
      within3Months: events.filter(e => e.flags.preEnroll3M).length,
      within5Years: events.filter(e => e.flags.preEnroll5Y).length
    },
    items: events.map(event => ({
      date: event.date,
      hospital: event.hospital,
      content: event.shortFact,
      keywordMatches: event.procedures.map(p => p.name),
      mappedTerms: [],
      isWithin3Months: event.flags.preEnroll3M,
      isWithin5Years: event.flags.preEnroll5Y,
      rawText: event.rawText
    }))
  };
}
```

### 3. _createSummaryDataFromEvents() 신규 메서드

Event Table에서 요약 데이터 생성

## 호출 방법

```javascript
import reportBuilder from './reportBuilder.js';
import medicalEventModel from './medicalEventModel.js';

// Event Table 생성
const events = medicalEventModel.buildEvents({
  dateBlocks,
  entities,
  rawText,
  patientInfo
});

// 보고서 생성 (Event Table 사용)
const report = await reportBuilder.buildReport(null, patientInfo, {
  format: 'excel',
  events: events  // Event Table 전달
});
```

## 완료 기준

- [x] buildReport() 메서드에 events 파라미터 추가
- [ ] _prepareReportDataFromEvents() 구현
- [ ] _createSummaryDataFromEvents() 구현
- [ ] 기존 출력 형식 유지 확인
- [ ] 통합 테스트

---

**Phase**: Phase 1 - T02  
**Status**: 진행 중
