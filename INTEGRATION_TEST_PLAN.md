# VNEXSUS 통합 테스트 계획

**작성일**: 2025-11-29  
**Phase**: Phase 0-2 완료 후 검증  
**목적**: 구현된 모듈들의 통합 동작 확인

---

## 테스트 범위

### Phase 0: Report Subset Validator
- [x] 파일 생성 완료
- [ ] 실제 케이스 데이터로 실행
- [ ] baseline_metrics.json 생성 확인

### Phase 1: SSOT Event Table
- [x] MedicalEvent Model 구현 완료
- [x] SourceSpan Manager 구현 완료
- [ ] Event 생성 테스트
- [ ] SourceSpan 첨부율 확인

### Phase 2: 고지의무 엔진
- [x] UW Questions 정의 완료
- [x] Rules Engine 구현 완료
- [x] majorEvents.json 확장 완료
- [ ] Question Map 생성 테스트
- [ ] Rule 매칭 정확도 확인

---

## 테스트 시나리오

### 1. End-to-End 테스트

**입력**: 의료 기록 원문 텍스트  
**처리 흐름**:
1. 날짜 블록 추출 (기존 파이프라인)
2. MedicalEvent 생성 (medicalEventModel)
3. SourceSpan 첨부 (sourceSpanManager)
4. Question 매칭 (disclosureRulesEngine)
5. Question Map 출력

**예상 출력**:
```json
{
  "events": [...],
  "questionMap": {
    "Q_UW_TUMOR": {
      "matchedEvents": [...],
      "totalScore": 0.92
    }
  }
}
```

### 2. 단위 테스트

**medicalEventModel.buildEvents()**:
- 입력: dateBlocks, entities, rawText, patientInfo
- 출력: MedicalEvent 배열
- 검증: event.sourceSpan 존재, flags 설정

**sourceSpanManager.attachSourceSpan()**:
- 입력: event, rawText, block
- 출력: sourceSpan
- 검증: start/end/textPreview 존재

**disclosureRulesEngine.processEvents()**:
- 입력: events, patientInfo
- 출력: questionMap
- 검증: 매칭된 질문 개수, 스코어

---

## 테스트 데이터

### 샘플 케이스 1: 암 진단
```
2024-04-09 삼성서울병원
위암 (C16.9) 진단
위절제술 시행
조직검사 결과: 선암
```

**예상 매칭 질문**:
- Q_UW_TUMOR (우선순위 1)
- Q_UW_5Y_ADMISSION_SURGERY (우선순위 2)
- Q_UW_MAJOR_EXAM (조직검사)

### 샘플 케이스 2: 심혈관질환
```
2024-03-15 서울아산병원
협심증 (I20.0) 진단
CAG 시행
스텐트 삽입술
```

**예상 매칭 질문**:
- Q_UW_CARDIO (우선순위 1)
- Q_UW_MAJOR_EXAM (CAG)

---

## 성공 기준

### Phase 0
- [ ] Report subset validator 실행 성공
- [ ] baseline_metrics.json 생성
- [ ] 날짜/ICD/병원 매칭률 측정

### Phase 1
- [ ] Event 생성률 100%
- [ ] SourceSpan 첨부율 95%+
- [ ] ICD 코드 보존 확인

### Phase 2
- [ ] Question 매칭 정확도 90%+
- [ ] Rule 적중률 측정
- [ ] Question Map 생성 성공

---

## 다음 단계

1. **즉시 실행**: 간단한 통합 테스트 스크립트 작성
2. **검증**: 실제 케이스 데이터로 실행
3. **수정**: 발견된 이슈 수정
4. **Phase 3**: Episode Clustering 구현 또는 Phase 0-2 안정화

---

**작성일**: 2025-11-29 21:46
