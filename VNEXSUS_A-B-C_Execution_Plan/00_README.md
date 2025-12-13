# VNEXSUS A-B-C 품질 향상 실행 패키지

생성시각: 2025-12-07T13:30:37

이 패키지는 현재 VNEXSUS 11-23 코드베이스와 `case_sample` 분석을 바탕으로,
다음 세 가지 목표(A/B/C)를 실제 개발 태스크로 쪼갠 실행 문서입니다.

- A. **report 이벤트 recall 극대화**  
  - 사람 조사자가 report에 쓴 핵심 의료이벤트가 VNEXSUS event table에 최대한 누락 없이 포함되도록 만들기
- B. **고위험(종양/심혈/뇌혈/중대검사) 이벤트 recall 보장**  
  - 어떤 경우에도 놓치면 안 되는 이벤트 집합을 정의하고, 해당 이벤트는 항상 Core 레이어에 노출
- C. **조사자가 복붙해서 쓸 수 있는 보고서 품질 확보**  
  - 구조/섹션/문장 템플릿을 안정화해서, 최소 수정 후 실무 보고서로 사용 가능한 수준

구성 파일 개요:

- `VNEXSUS_PRD_A-B-C.md` : 전체 PRD (제품 요구사항 정리)
- `VNEXSUS_Architecture_Review.md` : 현 구조 분석 및 강/약점 평가
- `VNEXSUS_Execution_Roadmap.md` : 단계별 로드맵 및 마일스톤
- `tasks/` : 개별 개발 태스크 상세 정의 (T01 ~ T09)
