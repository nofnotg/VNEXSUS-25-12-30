# VNEXSUS 개발 실행 계획 요약

## 📊 현재 상태

### 성능 지표 (32건 케이스 기준)
- **Report 날짜 포함률**: 40.8% → 목표 95%+
- **Report ICD 코드 포함률**: 17.2% → 목표 95%+
- **근거 스팬 첨부율**: 미측정 → 목표 95%+

## 🎯 5단계 실행 계획

### Phase 0: 측정/회귀 프레임 (1-2일)
- **T01**: Report Subset Validator 구축
- **산출물**: baseline_metrics.json

### Phase 1: SSOT 정착 (3-5일)
- **T02**: Event Table 도입 (eventModel.js)
- **T03**: SourceSpan 강제 저장
- **목표**: 모든 출력이 event table 기반

### Phase 2: 고지의무 엔진 (5-7일)
- **T04**: UW Question Map (uwQuestions.json)
- **T05**: Disclosure Rules Engine
- **T06**: majorEvents.json 확장 (500+ 코드)
- **목표**: 심사 질문별 자동 매칭

### Phase 3: Episode Clustering (4-6일)
- **T07**: Episode Clustering 구현
- **목표**: 반복 진료 압축, 기간/횟수 계산

### Phase 4: 정밀도 강화 (5-7일)
- **T08**: ICD/KCD 보존 강화 (95%+)
- **T09**: 시간 추출/정렬 (70%+)
- **목표**: Report subset 95%+ 달성

### Phase 5: Hardening (3-5일)
- **T10**: 대시보드 HTML 생성
- **T11**: UI 출력 규격 (3단 레이어)
- **T12**: 개인정보 정책 문서

## 📅 전체 일정

```
Week 1: Phase 0-1 (T01-T03)
Week 2: Phase 2 (T04-T06)
Week 3: Phase 3-4 (T07-T09)
Week 4: Phase 5 (T10-T12)
```

**총 예상 기간**: 3-4주

## ✅ 우선순위

### P0 (최우선)
1. T01 - Report Subset Validator
2. T02 - SSOT Event Table
3. T03 - SourceSpan 강제

### P1 (고지의무)
4. T04 - UW Question Map
5. T05 - Disclosure Rules Engine
6. T06 - majorEvents 확장

### P2 (정밀도)
7. T07 - Episode Clustering
8. T08 - ICD/KCD 보존
9. T09 - 시간 추출/정렬

### P3 (운영성)
10. T10 - 대시보드
11. T11 - UI 출력
12. T12 - 개인정보 정책

## 🚀 다음 액션

1. ✅ 백업 완료 (backup-20251129-1502)
2. ⏭️ **Phase 0 시작**: T01 구축
3. ⏭️ baseline_metrics.json 생성

## 📚 참고 문서

- 상세 계획: `implementation_plan.md` (artifact)
- 개발 문서: `VNEXSUS_dev_plan_tasks/`
- Task 상세: `tasks/T01_*.md` ~ `T12_*.md`

---

**작성일**: 2025-11-29  
**현재 Phase**: Phase 0 준비 단계  
**예상 완료**: 2025-12-27
