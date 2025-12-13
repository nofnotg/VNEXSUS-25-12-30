# T01. SSOT Event Model 정식 도입

## 목적
모든 출력이 단일 이벤트 테이블(MedicalEvent[])에 의존하도록 구조를 고정한다.

## 작업
- MedicalEvent 타입 정의
- DNA 엔진 결과를 MedicalEvent[]로 정규화
- 후처리 모듈 리팩터링
- 스키마 검증 로직 추가
