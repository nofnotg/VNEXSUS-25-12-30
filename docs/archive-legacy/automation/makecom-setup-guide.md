# Make.com 시나리오 설정 가이드

## 1. 시나리오 블루프린트 가져오기

1. Make.com 계정에 로그인
2. 새 시나리오 생성 → "Import Blueprint" 선택
3. `makecom-scenario-blueprint.json` 파일 업로드

## 2. 필수 연결 설정

### 2.1 OpenAI API 연결
- HTTP 모듈에서 OpenAI API 키 설정
- 환경변수 `OPENAI_API_KEY`에 실제 API 키 입력
- 모델: `gpt-4o` (또는 `gpt-4-turbo`)

### 2.2 Google 서비스 연결
1. Google Docs 연결 생성
2. Google Drive 연결 생성
3. 필요 권한: 문서 생성, 파일 내보내기, 공유 설정

### 2.3 Webhook 설정
1. Webhook 모듈에서 고유 URL 생성
2. URL을 VNEXSUS 프론트엔드에 설정
3. 테스트 페이로드로 연결 확인

## 3. 모듈별 설정 상세

### Webhook Input
- 최대 결과: 1
- 타임아웃: 30초
- JSON 페이로드 자동 파싱 활성화

### Variables 설정
- contract_date: 보험가입일 (YYYY-MM-DD)
- product_type: 상품유형
- claim_diagnosis: 청구진단명
- claimant_*: 피보험자 정보
- medical_records: 의무기록 배열

### OpenAI HTTP 요청
- URL: https://api.openai.com/v1/chat/completions
- Method: POST
- Headers:
  - Authorization: Bearer {{OPENAI_API_KEY}}
  - Content-Type: application/json
- Temperature: 0.3 (일관성 있는 결과)
- Max Tokens: 4000

### Text Parser
- 패턴: JSON 코드 블록 또는 순수 JSON 추출
- 멀티라인 모드 활성화
- 오류 시 계속 진행 비활성화

### Google Docs 생성
- 제목 형식: "손해사정보고서_{이름}_{날짜시간}"
- 본문: 확장형 보고서 + 요약본 + 고지의무 분석

### Google Drive PDF 내보내기
- MIME 타입: application/pdf
- 자동 공유 권한 설정 권장

### Webhook Response
- 상태 코드: 200
- 응답 형식: JSON
- 포함 정보: 문서 ID, PDF 링크, 미리보기, 분석 결과

## 4. 테스트 및 검증

### 4.1 Webhook 테스트
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @webhook-test-payload.json
```

### 4.2 예상 응답 형식
```json
{
  "success": true,
  "doc_id": "1ABC...",
  "doc_title": "손해사정보고서_김철수_2024-01-15_10-30-00",
  "pdf_file_id": "1DEF...",
  "pdf_download_url": "https://drive.google.com/file/d/1DEF.../view",
  "note": "Google Drive에서 공유권한 설정 시 외부열람 가능",
  "preview": "환자 정보...",
  "disclosure_analysis": {
    "threeMonths": [...],
    "twoYears": [...],
    "fiveYears": [...],
    "riskLevel": "high",
    "recommendations": [...]
  },
  "processing_time": "2024-01-15 10:30:45"
}
```

## 5. 오류 처리 및 모니터링

### 5.1 일반적인 오류
- OpenAI API 키 오류: 환경변수 확인
- Google 연결 오류: 권한 재승인 필요
- JSON 파싱 오류: 응답 형식 확인
- 타임아웃 오류: 처리 시간 조정

### 5.2 모니터링 설정
- 실행 로그 확인
- 오류 알림 설정
- 성능 지표 추적
- 월별 사용량 모니터링

## 6. 보안 고려사항

### 6.1 API 키 관리
- 환경변수 사용 (하드코딩 금지)
- 정기적 키 로테이션
- 최소 권한 원칙 적용

### 6.2 데이터 보호
- HTTPS 통신 강제
- 민감 정보 로깅 방지
- Google Drive 공유 권한 제한
- 임시 파일 자동 삭제 설정

## 7. 성능 최적화

### 7.1 처리 속도 개선
- OpenAI 모델 선택 최적화
- 불필요한 데이터 전송 최소화
- 병렬 처리 가능한 작업 분리

### 7.2 비용 최적화
- 토큰 사용량 모니터링
- 캐싱 전략 구현
- 배치 처리 고려

## 8. 확장 가능성

### 8.1 추가 기능
- 이메일 자동 발송
- Slack/Teams 알림
- 데이터베이스 저장
- 다국어 지원

### 8.2 통합 옵션
- CRM 시스템 연동
- 보험사 API 연결
- 전자서명 시스템
- 결제 시스템 연동