## 목표
- C:\VNEXSUS_reports_pdf 내 준비된 31건의 "좌표 포함 OCR 대체원문"을 사용해 후처리 로직(Date Binding v3→이벤트 패킹→10항목 보고서→스코어/연관성)을 실증 검증
- 실시간 OCR 호출 없이 동일 스키마(Event JSON v1, 보고서 JSON/MD/HTML)로 출력을 생성하고 품질 지표를 산출

## 자료 확인·가정
- 폴더 구조: C:\VNEXSUS_reports_pdf 하위에 각 케이스별 OCR 결과 파일(텍스트+좌표)이 존재
- 포맷 가정: JSON/NDJSON/CSV 중 하나로, 최소한 다음 필드가 포함
  - date 후보: text, bbox(page,x,y,width,height), confidence
  - 텍스트 블록: text, bbox(page,x,y,width,height), page
- 실제 포맷이 상이하면 로더에서 포맷 자동감지(파일 확장자/헤더)를 통해 매핑

## 데이터 로더 설계
- 파일 검색: glob로 *.json / *.ndjson / *.csv 탐색, 케이스ID는 파일명에서 추출(case_001 등)
- 파서:
  - JSON/NDJSON: 키 매핑 테이블로 BindInput(dates, blocks, contractDate, claimKeywords)로 변환
  - CSV: 열 헤더 매핑(bbox_x,bbox_y,bbox_w,bbox_h,text,page,kind,confidence)
- 검증: Zod 스키마(BindInput)로 형식 검사, 실패 시 로깅·스킵·리포트에 포함

## 파이프라인 실행
- 어댑터(runMedicalEventReport)로 일괄 처리: 좌표 바인딩→패킹→스코어링→연관성→10항목 보고서(JSON/MD/HTML)
- 출력 저장: outputs/ten-report/{caseId}/report.json|md|html
- 메타: 이벤트 수, 평균 score, relEdges 밀도, 처리시간 기록

## 측정·리포트
- 날짜 정규화 성공률: 추출된 date 후보 파싱률(목표 99%+)
- 바인딩 정확도(핵심 이벤트): 입원/수술/조직검사/영상검사 슬롯 채움 유효성(표준 키워드 기반), 목표 95%+
- 10항목 누락률: ‘미기재’ 처리 비율과 필수 슬롯 출력 보장률
- 형식 동등성: JSON/MD/HTML 스키마 비교(report-diff 연계)
- 성능: 케이스별 처리시간·메모리(가능한 범위)·핫 경로 추정(정규화·클러스터링)
- 집계 리포트: summary.json(지표·분포·실패 케이스 목록) 생성

## 컨트롤러 병행 활성화(옵션)
- reportController에 tenItemReport=true 옵션 시 신규 생성기 경로로 출력(경로/로그 메타 유지)
- 기본값은 기존 경로 유지, 검증 완료 후 점진 승격

## RAG 활용
- 보고서 생성 중 필수 병기(ICD/KCD·검사 약어) 누락 시 로컬 캐시→웹 1회→자동 적재(출처/날짜/신뢰도)
- 영문/한글 병기 미충족 케이스에 ‘확인요망’ 메타 부여

## 산출물
- 케이스별 출력(ten-report) + 집계 리포트(summary.json)
- 실패·스킵 케이스 로그, 포맷 자동감지·매핑 규칙 문서화

## 위험·대응
- 포맷 다양성: 자동감지·키 매핑 테이블로 완화, 실패 시 스킵 로그
- 좌표 품질 편차: 텍스트 Fallback·반경/클러스터 파라미터 튜닝
- 성능: 배치 실행·캐시 활용, 파라미터 외부화

## 실행 순서(단계적)
1) 로더 구현(파일 탐색·파서·BindInput 변환) → 5건 샘플 실행으로 스키마 확인
2) 전체 31건 배치 실행 → 출력 저장
3) 집계 지표 산출 → 리포트 공유
4) 컨트롤러 opt-in 경로 연결(테스트 후 비활성 기본 유지)
