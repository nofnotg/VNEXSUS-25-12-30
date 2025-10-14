# VNEXSUS AI 의료 문서 처리 시스템 API 문서

## 📋 개요

VNEXSUS AI 시스템은 의료 문서의 OCR 처리, AI 기반 프롬프트 보강, 그리고 지능형 후처리를 제공하는 RESTful API입니다.

**Base URL**: `http://localhost:3030`
**API Version**: v1.0
**Content-Type**: `application/json`

## 🔐 인증

현재 버전에서는 API 키 기반 인증을 사용합니다.

```http
Authorization: Bearer YOUR_API_KEY
```

## 📊 응답 형식

모든 API 응답은 다음 형식을 따릅니다:

```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2025-01-07T12:00:00Z",
  "requestId": "uuid"
}
```

오류 응답:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "timestamp": "2025-01-07T12:00:00Z",
  "requestId": "uuid"
}
```

## 🏥 의료 문서 처리 API

### 1. 문서 업로드 및 OCR 처리

#### POST `/api/ocr/process`

의료 문서를 업로드하고 OCR 처리를 수행합니다.

**Request**:
```http
POST /api/ocr/process
Content-Type: multipart/form-data

file: [PDF/Image file]
options: {
  "hospitalId": "string",
  "documentType": "string",
  "enableEnhancement": true,
  "language": "ko"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "originalText": "string",
    "processedText": "string",
    "metadata": {
      "pageCount": 5,
      "processingTime": 1234,
      "confidence": 0.95,
      "detectedLanguage": "ko"
    },
    "enhancement": {
      "applied": true,
      "improvementScore": 0.274,
      "noiseReductionRate": 0.737
    }
  }
}
```

### 2. 문서 상태 조회

#### GET `/api/ocr/status/{documentId}`

처리 중인 문서의 상태를 조회합니다.

**Response**:
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "status": "processing|completed|failed",
    "progress": 75,
    "estimatedTimeRemaining": 30,
    "currentStage": "ocr|enhancement|postprocessing"
  }
}
```

### 3. 처리 결과 다운로드

#### GET `/api/ocr/download/{documentId}`

처리된 문서 결과를 다운로드합니다.

**Query Parameters**:
- `format`: `json|txt|excel` (기본값: json)
- `includeOriginal`: `true|false` (기본값: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "string",
    "expiresAt": "2025-01-07T18:00:00Z",
    "format": "json",
    "fileSize": 1024
  }
}
```

## 🤖 AI 프롬프트 보강 API

### 1. 프롬프트 보강 요청

#### POST `/api/enhancement/enhance`

텍스트에 대한 AI 프롬프트 보강을 요청합니다.

**Request**:
```json
{
  "text": "string",
  "context": {
    "hospitalId": "string",
    "documentType": "string",
    "metadata": {}
  },
  "options": {
    "enhancementLevel": "basic|advanced|premium",
    "focusAreas": ["accuracy", "completeness", "clarity"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "enhancedText": "string",
    "improvements": [
      {
        "type": "grammar",
        "original": "string",
        "enhanced": "string",
        "confidence": 0.95
      }
    ],
    "metrics": {
      "improvementScore": 0.274,
      "processingTime": 1500,
      "tokensUsed": 1250
    }
  }
}
```

### 2. 컨텍스트 분석

#### POST `/api/enhancement/analyze-context`

문서의 컨텍스트를 분석합니다.

**Request**:
```json
{
  "text": "string",
  "hospitalId": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "contextType": "medical_report",
    "detectedPatterns": ["patient_info", "diagnosis", "treatment"],
    "confidence": 0.92,
    "recommendations": [
      {
        "type": "template",
        "templateId": "standard_medical_report",
        "confidence": 0.88
      }
    ]
  }
}
```

## 🏥 병원별 템플릿 관리 API

### 1. 템플릿 목록 조회

#### GET `/api/templates`

사용 가능한 템플릿 목록을 조회합니다.

**Query Parameters**:
- `hospitalId`: 특정 병원의 템플릿만 조회
- `category`: 템플릿 카테고리 필터

**Response**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "string",
        "name": "string",
        "hospitalId": "string",
        "category": "string",
        "patterns": 21,
        "successRate": 0.95,
        "lastUpdated": "2025-01-07T12:00:00Z"
      }
    ],
    "total": 50
  }
}
```

### 2. 템플릿 상세 조회

#### GET `/api/templates/{templateId}`

특정 템플릿의 상세 정보를 조회합니다.

**Response**:
```json
{
  "success": true,
  "data": {
    "templateId": "string",
    "name": "string",
    "description": "string",
    "hospitalId": "string",
    "patterns": [
      {
        "patternId": "string",
        "regex": "string",
        "replacement": "string",
        "priority": 1,
        "successRate": 0.92
      }
    ],
    "metadata": {
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-07T12:00:00Z",
      "version": "1.2.0",
      "usage": 1250
    }
  }
}
```

### 3. 템플릿 캐시 상태

#### GET `/api/templates/cache/status`

템플릿 캐시 시스템의 상태를 조회합니다.

**Response**:
```json
{
  "success": true,
  "data": {
    "cacheInitialized": true,
    "totalHospitals": 4,
    "totalPatterns": 120,
    "processedDocuments": 1500,
    "cacheDirectory": "/path/to/cache",
    "lastUpdate": "2025-01-07T12:00:00Z",
    "hitRate": 0.85
  }
}
```

## 📊 시스템 모니터링 API

### 1. 시스템 상태 조회

#### GET `/api/system/health`

시스템의 전반적인 상태를 조회합니다.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "version": "1.0.0",
    "services": {
      "ocr": "healthy",
      "enhancement": "healthy",
      "templates": "healthy",
      "database": "healthy"
    },
    "performance": {
      "averageResponseTime": 1200,
      "requestsPerMinute": 45,
      "errorRate": 0.01
    }
  }
}
```

### 2. 성능 메트릭 조회

#### GET `/api/system/metrics`

시스템 성능 메트릭을 조회합니다.

**Query Parameters**:
- `period`: `hour|day|week|month` (기본값: day)
- `metrics`: 조회할 메트릭 목록 (쉼표로 구분)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "day",
    "metrics": {
      "totalRequests": 1250,
      "successfulRequests": 1238,
      "averageProcessingTime": 1500,
      "peakProcessingTime": 3000,
      "cacheHitRate": 0.85,
      "enhancementUsage": 0.75,
      "userSatisfactionScore": 4.2
    },
    "trends": {
      "requestVolume": "increasing",
      "processingTime": "stable",
      "errorRate": "decreasing"
    }
  }
}
```

### 3. 로그 조회

#### GET `/api/system/logs`

시스템 로그를 조회합니다.

**Query Parameters**:
- `level`: `error|warn|info|debug` (기본값: info)
- `limit`: 조회할 로그 수 (기본값: 100)
- `since`: 시작 시간 (ISO 8601 형식)

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2025-01-07T12:00:00Z",
        "level": "info",
        "message": "Document processed successfully",
        "documentId": "uuid",
        "processingTime": 1200
      }
    ],
    "total": 1000,
    "hasMore": true
  }
}
```

## 📈 분석 및 리포트 API

### 1. 처리 통계 조회

#### GET `/api/analytics/processing-stats`

문서 처리 통계를 조회합니다.

**Query Parameters**:
- `period`: `day|week|month|year`
- `hospitalId`: 특정 병원 필터
- `documentType`: 문서 유형 필터

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "week",
    "totalDocuments": 500,
    "successfulProcessing": 485,
    "averageProcessingTime": 1800,
    "enhancementUsage": 375,
    "topHospitals": [
      {
        "hospitalId": "강북삼성",
        "documentCount": 150,
        "successRate": 0.97
      }
    ],
    "documentTypes": {
      "medical_report": 300,
      "prescription": 150,
      "lab_result": 50
    }
  }
}
```

### 2. 성능 리포트 생성

#### POST `/api/analytics/generate-report`

성능 리포트를 생성합니다.

**Request**:
```json
{
  "reportType": "performance|usage|quality",
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-07T23:59:59Z"
  },
  "filters": {
    "hospitalId": "string",
    "documentType": "string"
  },
  "format": "json|pdf|excel"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reportId": "uuid",
    "status": "generating",
    "estimatedCompletion": "2025-01-07T12:05:00Z",
    "downloadUrl": null
  }
}
```

## 🔧 설정 관리 API

### 1. 시스템 설정 조회

#### GET `/api/config/system`

시스템 설정을 조회합니다.

**Response**:
```json
{
  "success": true,
  "data": {
    "ocrSettings": {
      "enableVisionOCR": true,
      "defaultLanguage": "ko",
      "confidenceThreshold": 0.8
    },
    "enhancementSettings": {
      "defaultLevel": "advanced",
      "maxTokens": 4000,
      "timeoutSeconds": 30
    },
    "cacheSettings": {
      "ttl": 3600,
      "maxSize": 1000,
      "enableCompression": true
    }
  }
}
```

### 2. 설정 업데이트

#### PUT `/api/config/system`

시스템 설정을 업데이트합니다.

**Request**:
```json
{
  "ocrSettings": {
    "confidenceThreshold": 0.85
  },
  "enhancementSettings": {
    "maxTokens": 5000
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated": true,
    "changedSettings": ["ocrSettings.confidenceThreshold", "enhancementSettings.maxTokens"],
    "restartRequired": false
  }
}
```

## 🚨 오류 코드

| 코드 | 설명 | HTTP 상태 |
|------|------|-----------|
| `INVALID_REQUEST` | 잘못된 요청 형식 | 400 |
| `UNAUTHORIZED` | 인증 실패 | 401 |
| `FORBIDDEN` | 권한 없음 | 403 |
| `NOT_FOUND` | 리소스를 찾을 수 없음 | 404 |
| `FILE_TOO_LARGE` | 파일 크기 초과 | 413 |
| `RATE_LIMIT_EXCEEDED` | 요청 한도 초과 | 429 |
| `PROCESSING_ERROR` | 처리 중 오류 발생 | 500 |
| `SERVICE_UNAVAILABLE` | 서비스 일시 중단 | 503 |

## 📝 사용 예제

### JavaScript (Node.js)

```javascript
const axios = require('axios');

// 문서 처리 요청
async function processDocument(filePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('options', JSON.stringify({
    hospitalId: '강북삼성',
    enableEnhancement: true
  }));

  try {
    const response = await axios.post('http://localhost:3030/api/ocr/process', formData, {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('처리 결과:', response.data);
  } catch (error) {
    console.error('오류:', error.response.data);
  }
}
```

### Python

```python
import requests

# 시스템 상태 확인
def check_system_health():
    headers = {'Authorization': 'Bearer YOUR_API_KEY'}
    
    response = requests.get('http://localhost:3030/api/system/health', headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"시스템 상태: {data['data']['status']}")
    else:
        print(f"오류: {response.status_code}")
```

### cURL

```bash
# 템플릿 목록 조회
curl -X GET "http://localhost:3030/api/templates" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"

# 프롬프트 보강 요청
curl -X POST "http://localhost:3030/api/enhancement/enhance" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "환자 정보 및 진단 내용...",
    "context": {
      "hospitalId": "강북삼성",
      "documentType": "medical_report"
    }
  }'
```

## 📚 추가 리소스

- **Postman Collection**: [다운로드 링크]
- **OpenAPI Specification**: [Swagger UI 링크]
- **SDK 다운로드**: [GitHub 링크]
- **예제 코드**: [GitHub 예제 저장소]

## 🔄 버전 히스토리

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2025-01-07 | 초기 API 릴리스 |
| 0.9.0 | 2025-01-01 | Phase 2 통합 |
| 0.8.0 | 2024-12-15 | Phase 1 완료 |

---

**문서 업데이트**: 2025-01-07
**다음 업데이트**: Phase 3 기능 추가 시