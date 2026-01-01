## 목표
- offline_ocr 포맷(좌표+텍스트 라인/BoundingBox/Confidence)까지 매핑을 확대해 이벤트 생성률을 개선
- 인코딩 혼선(한글 깨짐) 완화 및 파일 필터를 정밀화하여 유효 케이스만 배치 처리
- 집계 지표를 확장해 품질/성능 변화를 수치로 확인

## 범위·원칙
- 업로드·OCR·텍스트추출·UI는 변경 없음
- 후처리(Date Binding v3→패킹→스코어/연관성→10항목 보고서)만 개선·검증
- 출력(JSON/Markdown/HTML) 동등 스키마 유지

## 데이터 매핑 보강
- preparedOcrLoader 확장
  - 라인/블록 대체 필드 지원: { text|content, page, BoundingBox{Left,Top,Width,Height}, Confidence }
  - 다중 구조 지원: items[], blocks[], lines[] 등 키 자동감지
  - 날짜 파싱 유연화: 숫자+임의 구분자(예: 2021??2??16??) → ISO 정규화
  - dates가 비어있을 때 텍스트에서 날짜 후보를 자동 생성(anchor를 block bbox로)
- 인코딩 처리
  - BOM 제거 기본
  - JSON 파싱 실패/한글 깨짐 감지 시 cp949/EUC-KR 재디코딩 시도(iconv-lite 도입)
  - 재디코딩 실패 케이스는 스킵 로그 + 리포트에 기록

## 배치 필터 개선
- offline_ocr_samples 하위 *_offline_ocr.json, *_blocks.json, *_core_engine_report.json만 대상
- manifest/HTML/TXT 제외
- 케이스ID: 파일명 기반 일관 추출

## 측정·리포트 확장
- 케이스 메타: blocks 수, dates 후보 수, 정규화 성공률, 이벤트 수, 평균 score
- 핵심 이벤트 바인딩 지표: 입원/수술/조직/영상 키워드 기반 슬롯 채움율(휴리스틱)
- 처리시간 집계(케이스별/총계)
- summary.json에 Top-5 이벤트 샘플 미리보기(날짜·태그·score)

## 실행·검증
- 샘플 케이스 5건으로 스키마 확인 후 전체 배치 재실행
- 골든 비교 필요 시 report-diff로 이전 대비 변화 확인
- 컨트롤러 opt-in 경로 유지(검증 후 점진 승격)

## 위험·대응
- 포맷 다양성: 자동감지·키 매핑 테이블/폴백 생성으로 완화
- 인코딩 혼선: 재디코딩 시도 + 실패 케이스 라벨링으로 원인 분리
- 성능: 배치 처리/캐시, 파라미터 외부화로 운영 튜닝

## 산출물
- 로더 보강 코드 + 배치 필터 개선 + summary.json(확장 지표)
- 실패/스킵 로그 및 샘플 이벤트 미리보기

## 롤아웃
- 오프라인 샘플 전체 재검증 → 지표 공유 → 필요 튜닝 후 컨트롤러 경로 승격 단계적 진행