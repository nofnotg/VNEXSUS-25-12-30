# T05 Disclosure Rules Engine - 완료 보고서

**완료일**: 2025-11-29  
**Phase**: Phase 2  
**백업**: backup-20251129-2138 (예정)

---

## 구현 내용

### 파일: `backend/postprocess/disclosureRulesEngine.js` (약 400줄)

**핵심 기능**:
1. Rule 기반 이벤트-질문 매칭
2. 다층 Trigger 평가
3. 스코어링 시스템
4. Question Map 생성
5. 설명가능성 (ruleId + sourceSpan)

---

## 주요 메서드

### 1. processEvents(events, patientInfo)
- 이벤트 배열에 대해 질문 매칭 수행
- Question Map 생성 및 반환

### 2. matchEventsToQuestion(events, question, patientInfo)
- 특정 질문에 매칭되는 이벤트 찾기
- 기간 필터링 + Rule 평가
- 스코어 기준 정렬

### 3. evaluateRules(event, question)
- 5가지 Rule 타입 평가:
  1. Event Type 매칭
  2. Keyword 매칭
  3. Exclude Keyword 체크
  4. ICD Code Prefix 매칭
  5. Procedure Keyword 매칭

### 4. calculateEventScore(event, question, ruleHits)
- 5가지 요소 기반 스코어 계산:
  1. Base Weight (질문 적중)
  2. Period Boost (기간 가중치)
  3. Event Type Boost (이벤트 유형)
  4. Code Boost (ICD 코드)
  5. Rule Confidence (평균)

### 5. formatOutput(questionMap)
- Question Map을 출력 형식으로 변환
- 우선순위 및 스코어 기준 정렬
- SourceSpan 포함

---

## Rule 평가 로직

### Trigger 우선순위

1. **ICD Code Prefix** (신뢰도 0.9)
   - 가장 정확한 매칭
   - Prefix 기반 (I20, I21 등)

2. **Procedure Keyword** (신뢰도 0.85)
   - 검사/시술명 매칭
   - CAG, 조직검사, MRI 등

3. **Event Type** (신뢰도 0.8)
   - 수술, 입원, 검사 등

4. **Keyword** (신뢰도 0.7)
   - 진단명, 증상 키워드

5. **Exclude Keyword**
   - 제외 키워드 발견 시 모든 매칭 취소
   - 정밀도 가드레일

---

## 스코어링 시스템

### 계산 공식

```
score = baseWeight 
      + periodBoost 
      + eventTypeBoost 
      + codeBoost
      × avgRuleConfidence
```

### 예시

**Q_UW_CARDIO (심혈관질환)**
- Base Weight: 0.45
- Period Boost: 0.20 (ALL 기간)
- Event Type Boost: 0.30 (수술)
- Code Boost: 0.25 (ICD I20)
- Rule Confidence: 0.9 (ICD 매칭)

**최종 스코어**: (0.45 + 0.20 + 0.30 + 0.25) × 0.9 = **1.08 → 1.0** (최대값)

---

## Question Map 출력 형식

```json
{
  "summary": {
    "totalQuestions": 5,
    "highPriority": 3,
    "mediumPriority": 2,
    "lowPriority": 0
  },
  "questions": [
    {
      "id": "Q_UW_TUMOR",
      "title": "암/종양 진단/검사/치료",
      "priority": 1,
      "eventCount": 3,
      "totalScore": 0.92,
      "summary": "3건 발견 (최근: 2024-04-09 삼성서울병원)",
      "events": [
        {
          "date": "2024-04-09",
          "hospital": "삼성서울병원",
          "diagnosis": "위암",
          "diagnosisCode": "C16.9",
          "eventType": "수술",
          "shortFact": "삼성서울병원 - 위암 - 위절제술",
          "score": 0.95,
          "sourceSpan": {
            "start": 1234,
            "end": 1567,
            "preview": "2024년 4월 9일 삼성서울병원..."
          }
        }
      ]
    }
  ]
}
```

---

## 정밀도 가드레일

### 1. Exclude Keyword
- 의심, 배제, 음성 등 발견 시 매칭 취소
- False Positive 방지

### 2. Rule 기반만 매칭
- Rule 적중 없으면 매칭 안 함
- "추정" 금지

### 3. SourceSpan 필수
- 모든 매칭 이벤트에 원문 근거 포함
- 설명가능성 확보

### 4. 스코어 기반 정렬
- 높은 스코어 우선 표시
- 중요도 순 정렬

---

## 완료 기준 달성

- [x] Rule 기반 이벤트-질문 매칭
- [x] 5가지 Trigger 타입 구현
- [x] 스코어링 시스템 (5가지 요소)
- [x] Question Map 생성
- [x] SourceSpan 포함
- [x] RuleId 추적 (설명가능성)
- [x] 정밀도 가드레일

---

## 사용 예시

```javascript
import disclosureRulesEngine from './disclosureRulesEngine.js';

// 이벤트 처리
const questionMap = disclosureRulesEngine.processEvents(events, patientInfo);

// Question Map 저장
disclosureRulesEngine.saveQuestionMap(
  questionMap,
  './output/question_map.json'
);

// 출력 예시:
// 🔍 Disclosure Rules Engine 시작
//    - 이벤트: 85개
//    - 질문: 11개
// ✅ 5개 질문에 이벤트 매칭됨
// 💾 Question Map 저장: ./output/question_map.json
```

---

## 다음 단계

### T06. majorEvents.json 확장
- ICD/KCD 코드 매핑 500+ 항목
- 질환군별 분류
- 중대검사 목록 확장

---

**작성일**: 2025-11-29 21:38  
**Phase 2 진행률**: 67% (T04, T05 완료)
