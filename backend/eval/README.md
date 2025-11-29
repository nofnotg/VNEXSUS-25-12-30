# Report Subset Validator

## 목적

"report ⊆ vnexsus" 자동 검증 - Report에 있는 핵심 정보가 VNEXSUS 결과에 누락 없이 포함되는지 확인

## 사용법

### 기본 실행

```bash
node backend/eval/report_subset_validator.js [케이스_디렉토리]
```

### 예시

```bash
# 기본 경로 사용
node backend/eval/report_subset_validator.js

# 커스텀 경로 지정
node backend/eval/report_subset_validator.js ./case_sample
```

## 케이스 디렉토리 구조

```
case_sample/
├── case_001/
│   ├── report.txt      # 조사자 보고서
│   └── vnexsus.txt     # VNEXSUS 출력
├── case_002/
│   ├── report.txt
│   └── vnexsus.txt
└── ...
```

## 검증 항목

1. **날짜 매칭** (YYYY-MM-DD)
   - Report의 모든 날짜가 VNEXSUS에 포함되는지 확인
   - 목표: 95%+ 매칭률

2. **ICD/KCD 코드 매칭**
   - Report의 모든 ICD 코드가 VNEXSUS에 포함되는지 확인
   - Prefix 매칭 지원 (I20.1 ↔ I20)
   - 목표: 95%+ 매칭률

3. **병원명 매칭**
   - Report의 모든 병원이 VNEXSUS에 포함되는지 확인
   - 정규화 후 비교 (공백 제거, 소문자 변환)
   - 목표: 80%+ 매칭률

## 출력 파일

### 1. baseline_metrics.json

전체 케이스의 베이스라인 메트릭

```json
{
  "timestamp": "2025-11-29T20:52:00Z",
  "casesWithBoth": 32,
  "dateMatchRate": 0.408,
  "icdMatchRate": 0.172,
  "hospitalMatchRate": 0.650,
  "missingCasesCount": 28
}
```

### 2. output/baseline_metrics.json

상세 검증 결과 (케이스별 누락 항목 포함)

```json
{
  "totalCases": 50,
  "casesWithBoth": 32,
  "dateMatchRate": 0.408,
  "icdMatchRate": 0.172,
  "hospitalMatchRate": 0.650,
  "validationResults": [...],
  "missingEvents": [...],
  "timestamp": "2025-11-29T20:52:00Z"
}
```

## 완료 기준 (DoD)

- [x] 케이스 디렉토리 자동 스캔
- [x] 날짜/ICD/병원 추출 및 매칭
- [x] 누락 항목 리포트 생성
- [x] 베이스라인 메트릭 JSON 생성
- [x] 요약 통계 출력

## 다음 단계

Phase 1에서 모든 PR은 이 검증을 통과해야 merge 가능 (운영 규칙)

---

**작성일**: 2025-11-29  
**Phase**: Phase 0 - T01
