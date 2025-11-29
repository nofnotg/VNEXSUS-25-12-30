# 01. Current State (현재 코드/모듈 인식)

## 핵심 파이프라인 (backend/postprocess 기준)
입력(OCR text)
  → EnhancedMassiveDateBlockProcessor: 날짜/블록 구조 분석 (`enhancedMassiveDateBlockProcessor.js`)
  → DateOrganizer: 날짜 정렬/기간 계산 (`dateOrganizer.js`)
  → AIEntityExtractor: JSON 엔티티 추출 + 정규화 (`aiEntityExtractor.js`)
  → DictionaryManager: 필수/제외 키워드 검사, 용어 번역/정규화 (`dictionaryManager.js`, `majorEvents.json`)
  → ReportBuilder: Excel/txt/json 보고서 생성 (`reportBuilder.js`)

## 관찰된 구조적 강점
- 날짜 블록을 계층적으로 분석하고 confidence를 계산하는 설계는 “비정형 대응” 기반으로 매우 유리.
- entity extractor에 normalize 단계가 있어 사전 강화만으로 성능 상승 여지가 큼.
- ReportBuilder가 Excel/text/json을 모두 생성 가능 → SSOT(event table) 고정화에 유리.

## 현재 핵심 갭(고지의무/심사기준/정밀도 관점)
1) **부분집합 보장 실패**: report에 있는 핵심 날짜/코드가 VNEXSUS 결과에 누락되는 케이스가 존재.
2) **ICD/KCD 보존 부족**: report 코드 커버리지가 낮음(샘플 평균 17% 수준).
3) **근거 스팬 결여**: 특정 서술이 원문 어디에서 왔는지 역추적이 어려움.
4) **사건(episode) 단위 압축이 약함**: 조사자는 “기간/횟수/핵심검사/수술”로 묶는데, 현재는 날짜 나열이 중심.
5) **심사기준 우선 라벨 부족**: 가입 전 3개월/5년, 중대검사/수술, 기고지 의심 등 “심사 질문 구조”로 태깅/정렬이 일관되지 않음.
