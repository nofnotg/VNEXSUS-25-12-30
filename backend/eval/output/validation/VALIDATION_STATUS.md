# VNEXSUS 검증 현황 보고서 v2

**작성일**: 2026-01-25  
**상태**: Vision LLM End-to-End 검증 준비 완료

---

## 1. 데이터 구조 정리

### 파일 구조
```
VNEXSUS_reports_pdf/sample_pdf/
├── caseN_report/
│   ├── CaseN.txt          ← Vision LLM OCR 결과 (검증 입력으로 사용 안함)
│   └── CaseN_report.txt   ← Ground Truth (손해사정사 작성 보고서)
└── sample_pdf/
    └── {피보험자이름}/     ← 원본 PDF 파일들 (Vision LLM 검증 입력)
        └── *.pdf
```

### 중요 사항
- **`CaseN.txt`는 검증 입력으로 사용하지 않음** (이미 OCR된 결과)
- **Vision LLM 검증**: `sample_pdf/{피보험자}/` 폴더의 PDF → Vision OCR → 보고서 생성
- **Ground Truth**: `CaseN_report.txt`와 생성된 보고서 비교

---

## 2. 케이스 세트 현황

| 세트 | 케이스 수 | 설명 |
|------|----------|------|
| **전체 집합** | 44개 | report.txt 보유 케이스 |
| **PDF 매칭** | 19개 | Vision LLM 검증 가능 |
| **미매칭** | 25개 | 수동 매핑 필요 |

### PDF 매칭 완료 케이스 (19개)

| CaseID | 피보험자 | PDF 폴더 |
|--------|---------|----------|
| Case2 | 김미화 | 농협손해보험 김미화 (수술비 고지의무 위반) |
| Case5 | 김태형 | KB손해보험 김태형(안정형 협심증) |
| Case9 | 임승희 | KB손해보험 임승희(암진단, 고지의무위반) |
| Case11 | 허전권 | axa손해보험 허전권(담낭암) |
| Case13 | 김인화 | 농협손해보험 김인화(후유장해) |
| Case15 | 고영란 | 고영란 |
| Case17 | 김동아 | 김동아 |
| Case18 | 김명희 | axa손해보험 김명희(뇌혈관질환) |
| Case24 | 김종렬 | 김종렬 |
| Case27 | 박현미 | 박현미 |
| Case28 | 박혜경 | 박혜경 |
| Case29 | 서문정숙 | 서문정숙 |
| Case30 | 송금숙 | 송금숙 |
| Case34 | 윤희정 | 윤희정 |
| Case38 | 이영희 | 이영희 |
| Case39 | 장동현 | 장동현 |
| Case41 | 장우진 | 장우진 |
| Case42 | 정진덕 | 정진덕 |
| Case44 | 최순곤 | 최순곤 |

---

## 3. 기존 검증 결과 무효화

### 무효화 사유
이전 검증(Phase 1-3)은 `CaseN.txt` (이미 OCR된 텍스트)를 입력으로 사용했습니다.
이는 **텍스트 LLM 보고서 생성 성능만 측정**한 것이며, Vision LLM OCR 성능은 포함되지 않았습니다.

### 무효화된 지표
| 파일 | 상태 |
|------|------|
| `phase1_summary.json` | ❌ 무효 (텍스트 입력 테스트) |
| `phase2_summary.json` | ❌ 무효 (텍스트 입력 테스트) |
| `phase3_comparison_report.html` | ❌ 무효 (Vision LLM 미사용) |
| `diagnosis_match_analysis.html` | ❌ 무효 (OCR 오류 미반영) |

---

## 4. 새로운 검증 계획

### Vision LLM End-to-End 검증

**입력**: `sample_pdf/{피보험자}/` 폴더의 PDF 파일들  
**처리**: PDF → Vision LLM (gpt-4o) → 텍스트 추출 → 보고서 생성 (gpt-4o-mini)  
**비교**: 생성된 보고서 vs `CaseN_report.txt` (Ground Truth)

**검증 가능 케이스**: 19개 (PDF 매칭 완료)

### 측정 지표
1. **OCR 정확도**: Vision LLM 텍스트 추출 품질
2. **보고서 품질**: 10항목 구조화 완성도
3. **진단 매칭률**: KCD 코드, 날짜, 병원명 정확도
4. **End-to-End 비용**: OCR + 보고서 생성 총 비용
5. **처리 시간**: PDF 입력 → 최종 보고서 출력

---

## 5. 현재 모델 설정

```env
# OCR 단계 (Vision LLM) - 이미지 처리 필수
OPENAI_VISION_MODEL=gpt-4o

# 보고서 생성 단계 (텍스트 LLM)
OPENAI_MODEL=gpt-4o-mini
OPENAI_REPORT_MODEL=gpt-4o-mini
```

---

## 6. 다음 단계

1. **Vision LLM 검증 스크립트 생성**: PDF 입력 End-to-End 테스트
2. **19개 케이스 검증 실행**: pdfMatchedSet 대상
3. **OCR 정확도 측정**: Vision LLM 추출 텍스트 vs Ground Truth
4. **통합 비용 분석**: OCR + 보고서 생성 총 비용 산정
5. **미매칭 케이스 수동 매핑**: 25개 케이스 연결 작업

---

## 7. 참고 파일 위치

- 케이스 세트 데이터: `backend/eval/output/case_sets/case_sets_v2.json`
- 매핑 테이블: `backend/eval/output/case_sets/case_patient_mapping.txt`
- 이 문서: `backend/eval/output/validation/VALIDATION_STATUS.md`

---

*이 문서는 자동 생성되었습니다. 검증 진행 시 업데이트됩니다.*
