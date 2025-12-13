# VNEXSUS Architecture Review (11-23 기준)

## 1. 현재 구조 요약

- 입력: PDF/이미지 → Vision OCR → raw text
- 전처리: 텍스트 배열화, 라인/블록 분할
- DNA 엔진:
  - 날짜/시간/병원/진단/행위 인식
  - 이벤트 단위 시퀀싱
  - 인과/전후 관계 Skeleton 구성
- 후처리/출력:
  - 엑셀/텍스트 보고서 생성
  - 일부 검증/진단 리포트 HTML

## 2. 강점

1. 다단계 엔진화(DNA 시퀀싱)  
2. 검증/리포트 문화(Phase별 리포트)  
3. Graph/Investigator 등 확장 여지

## 3. 약점/리스크

1. 운영 경로의 모호함 (Prod vs Research 혼재)
2. report ⊆ vnexsus 보장 부재
3. 고지·심사 질문 구조 부재
4. Self-confidence 부재

## 4. 개선 방향 요약

1. SSOT Event Table 정착  
2. Teacher + Validator 기반 튜닝 루프 구축  
3. 고위험 절대규칙 + Question Map 도입  
4. Self-confidence / 안전모드 도입
