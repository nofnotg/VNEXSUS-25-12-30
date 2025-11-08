# 캐시 관리 API 문서

## 개요
VNEXSUS 백엔드 시스템의 캐시 관리 API는 Redis 기반 캐싱 시스템을 통해 성능 최적화를 제공합니다.

## 기본 정보
- **Base URL**: `/api/cache`
- **인증**: 필요 없음 (내부 관리용)
- **응답 형식**: JSON

## API 엔드포인트

### 1. 캐시 통계 조회
```
GET /api/cache/stats
```

**응답 예시:**
```json
{
  "success": true,
  "stats": {
    "totalKeys": 150,
    "memoryUsage": "2.5MB",
    "hitRate": 85.2,
    "missRate": 14.8,
    "keysByPrefix": {
      "ocr-status": 45,
      "ocr-result": 30,
      "analyze": 25,
      "status": 50
    }
  }
}
```

### 2. 캐시 키 목록 조회
```
GET /api/cache/keys?prefix=ocr-status&limit=50
```

**쿼리 파라미터:**
- `prefix` (선택): 특정 접두사로 필터링
- `limit` (선택): 반환할 키 개수 제한 (기본값: 100)

**응답 예시:**
```json
{
  "success": true,
  "keys": [
    "cache:ocr-status:job123",
    "cache:ocr-status:job124",
    "cache:ocr-result:job125"
  ],
  "total": 3
}
```

### 3. 특정 캐시 조회
```
GET /api/cache/get/:key
```

**응답 예시:**
```json
{
  "success": true,
  "key": "cache:ocr-status:job123",
  "value": {
    "status": "completed",
    "progress": 100
  },
  "ttl": 1800
}
```

### 4. 캐시 삭제
```
DELETE /api/cache/delete/:key
```

**응답 예시:**
```json
{
  "success": true,
  "message": "캐시가 성공적으로 삭제되었습니다"
}
```

### 5. 패턴별 캐시 삭제
```
DELETE /api/cache/clear?pattern=ocr-*
```

**쿼리 파라미터:**
- `pattern` (필수): 삭제할 키 패턴 (예: `ocr-*`, `analyze:*`)

**응답 예시:**
```json
{
  "success": true,
  "deletedCount": 25,
  "message": "25개의 캐시가 삭제되었습니다"
}
```

### 6. 전체 캐시 초기화
```
DELETE /api/cache/flush
```

**응답 예시:**
```json
{
  "success": true,
  "message": "모든 캐시가 초기화되었습니다"
}
```

## 캐시 키 구조

### 키 네이밍 규칙
- 형식: `cache:{prefix}:{identifier}`
- 예시:
  - `cache:ocr-status:job123` - OCR 작업 상태
  - `cache:ocr-result:job456` - OCR 결과
  - `cache:analyze:hash789` - 분석 결과
  - `cache:status:service` - 서비스 상태

### TTL (Time To Live) 설정
- **OCR 상태**: 30초
- **OCR 결과**: 5분
- **분석 결과**: 5분
- **서비스 상태**: 1분
- **검증 결과**: 2분

## 캐시 미들웨어 사용법

### 기본 캐시 미들웨어
```javascript
import { cacheResponse } from '../middleware/cacheMiddleware.js';

// 1분 TTL, 'status' 접두사
router.get('/status', cacheResponse(60, 'status'), getStatus);
```

### 분석 결과 캐시 미들웨어
```javascript
import { cacheAnalysisResponse } from '../middleware/cacheMiddleware.js';

// 5분 TTL, 'analyze' 접두사, 요청 본문 기반 키 생성
router.post('/analyze', cacheAnalysisResponse(300, 'analyze'), analyzeData);
```

## 성능 최적화 팁

### 1. 적절한 TTL 설정
- 자주 변경되는 데이터: 짧은 TTL (30초-1분)
- 안정적인 데이터: 긴 TTL (5-10분)
- 정적 데이터: 매우 긴 TTL (1시간 이상)

### 2. 키 패턴 최적화
- 명확한 접두사 사용
- 계층적 구조 활용
- 특수문자 피하기

### 3. 메모리 관리
- 정기적인 캐시 정리
- 불필요한 키 삭제
- 메모리 사용량 모니터링

## 모니터링 및 디버깅

### 캐시 히트율 확인
```bash
curl http://localhost:3000/api/cache/stats
```

### 특정 패턴 키 조회
```bash
curl "http://localhost:3000/api/cache/keys?prefix=ocr-status&limit=10"
```

### 캐시 내용 확인
```bash
curl http://localhost:3000/api/cache/get/cache:ocr-status:job123
```

## 오류 처리

### 일반적인 오류 응답
```json
{
  "success": false,
  "error": "오류 메시지",
  "code": "ERROR_CODE"
}
```

### 오류 코드
- `CACHE_NOT_FOUND`: 캐시 키를 찾을 수 없음
- `INVALID_PATTERN`: 잘못된 패턴 형식
- `REDIS_CONNECTION_ERROR`: Redis 연결 오류
- `CACHE_OPERATION_FAILED`: 캐시 작업 실패

## 보안 고려사항

### 접근 제한
- 내부 네트워크에서만 접근 가능
- 프로덕션 환경에서는 인증 필요
- 민감한 데이터 캐시 시 암호화 고려

### 데이터 보호
- 개인정보 캐시 금지
- 임시 데이터만 캐시
- 정기적인 캐시 정리