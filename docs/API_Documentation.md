# DNA Engine Phase 2 - API 문서

## 개요

DNA Engine Phase 2는 의료 문서에서 날짜를 추출하고 분류하는 고급 시스템입니다. 이 문서는 Phase 2에서 구현된 주요 기능들과 API 사용법을 설명합니다.

## 주요 개선사항

### ✨ Phase 2 핵심 기능

1. **성능 최적화** - 메모리 사용량 개선 및 처리 속도 향상
2. **에러 처리 강화** - 예외 상황 대응 및 로깅 개선
3. **검증 로직 강화** - 날짜 추출 정확도 향상
4. **통합 테스트** - 전체 시스템 연동 테스트

## 핵심 컴포넌트

### 1. TextArrayDateController

메인 컨트롤러 클래스로, 전체 날짜 추출 프로세스를 관리합니다.

#### 생성자

```javascript
import { TextArrayDateController } from './src/dna-engine/core/textArrayDateControllerComplete.js';

const controller = new TextArrayDateController();
```

#### 주요 메서드

##### `processDocumentDateArrays(documentText, options = {})`

의료 문서에서 날짜를 추출하고 분류하는 메인 함수입니다.

**매개변수:**
- `documentText` (string): 처리할 의료 문서 텍스트
- `options` (object, 선택사항): 처리 옵션

**반환값:**
```javascript
{
  success: boolean,           // 처리 성공 여부
  version: string,           // 엔진 버전
  processingTime: number,    // 처리 시간 (ms)
  input: {
    documentLength: number,  // 입력 문서 길이
    arrayCount: number,      // 생성된 배열 수
    options: object         // 사용된 옵션
  },
  result: {
    primary: Array,         // 주요 날짜들
    secondary: Array,       // 보조 날짜들
    metadata: object        // 메타데이터
  },
  performance: object,      // 성능 메트릭
  quality: object,         // 품질 평가
  optimization: {
    memoryUsed: number,     // 사용된 메모리 (bytes)
    processingSpeed: number, // 처리 속도 (chars/sec)
    cacheHitRate: number    // 캐시 적중률
  },
  validation: {
    overallScore: number,   // 전체 검증 점수 (0-1)
    qualityGrade: string,   // 품질 등급 (A-F)
    details: object         // 상세 검증 결과
  }
}
```

**사용 예시:**

```javascript
const documentText = `
환자명: 홍길동
진료일: 2024년 12월 15일

[진료 기록]
2024년 12월 10일 초진
- 혈압 측정: 120/80
- 처방: 고혈압약

다음 진료: 2024년 12월 22일
`;

try {
  const result = await controller.processDocumentDateArrays(documentText);
  
  if (result.success) {
    console.log('처리 성공!');
    console.log('추출된 주요 날짜:', result.result.primary);
    console.log('처리 시간:', result.processingTime, 'ms');
    console.log('검증 점수:', result.validation.overallScore);
  } else {
    console.error('처리 실패:', result.error);
  }
} catch (error) {
  console.error('오류 발생:', error.message);
}
```

### 2. ValidationEngine

날짜 추출 결과의 정확성을 검증하는 엔진입니다.

#### 생성자

```javascript
import { ValidationEngine } from './src/dna-engine/core/validationEngine.js';

const validator = new ValidationEngine();
```

#### 주요 메서드

##### `validateDateExtractionResults(extractionResult, originalText, options = {})`

날짜 추출 결과를 검증합니다.

**매개변수:**
- `extractionResult` (object): 날짜 추출 결과
- `originalText` (string): 원본 텍스트
- `options` (object, 선택사항): 검증 옵션

**반환값:**
```javascript
{
  overallScore: number,     // 전체 점수 (0-1)
  qualityGrade: string,     // 품질 등급 (A-F)
  accuracy: {
    score: number,          // 정확도 점수
    details: object         // 상세 정보
  },
  completeness: {
    score: number,          // 완성도 점수
    details: object         // 상세 정보
  },
  consistency: {
    score: number,          // 일관성 점수
    details: object         // 상세 정보
  },
  confidence: {
    score: number,          // 신뢰도 점수
    details: object         // 상세 정보
  }
}
```

### 3. ErrorHandler

시스템 전반의 에러 처리를 담당합니다.

#### 주요 함수

##### `globalErrorHandler(error, context = '', severity = 'error')`

전역 에러 처리 함수입니다.

##### `safeExecute(asyncFunction, context = '')`

안전한 비동기 함수 실행을 위한 래퍼입니다.

##### `safeExecuteWithRetry(asyncFunction, options = {})`

재시도 로직이 포함된 안전한 비동기 함수 실행 래퍼입니다.

**사용 예시:**

```javascript
import { safeExecute, safeExecuteWithRetry } from './src/dna-engine/core/errorHandler.js';

// 단순 안전 실행
const result1 = await safeExecute(async () => {
  return await someRiskyOperation();
}, '위험한 작업');

// 재시도가 포함된 안전 실행
const result2 = await safeExecuteWithRetry(async () => {
  return await someUnstableOperation();
}, {
  maxRetries: 3,
  retryDelay: 1000,
  context: '불안정한 작업'
});
```

## 성능 최적화 기능

### 메모리 관리

- **캐시 시스템**: 자주 사용되는 데이터를 메모리에 캐시
- **메모리 모니터링**: 실시간 메모리 사용량 추적
- **가비지 컬렉션 최적화**: 메모리 누수 방지

### 처리 속도 개선

- **병렬 처리**: 가능한 작업들을 병렬로 실행
- **최적화된 정규식**: 성능이 개선된 패턴 매칭
- **스마트 캐싱**: 중복 계산 방지

## 에러 처리 시스템

### 에러 레벨

1. **CRITICAL**: 시스템 중단을 야기하는 심각한 오류
2. **ERROR**: 기능 실행 실패를 야기하는 오류
3. **WARNING**: 주의가 필요한 상황
4. **INFO**: 정보성 메시지

### 에러 복구 전략

- **자동 재시도**: 일시적 오류에 대한 자동 재시도
- **Fallback 메커니즘**: 주요 기능 실패 시 대체 방법 제공
- **Graceful Degradation**: 부분적 기능 제공으로 서비스 연속성 보장

## 검증 시스템

### 다층 검증

1. **구조적 검증**: 날짜 형식의 구조적 유효성
2. **의미적 검증**: 의료 문맥에서의 날짜 의미
3. **일관성 검증**: 추출된 날짜들 간의 논리적 일관성
4. **신뢰도 평가**: 추출 결과의 신뢰도 점수

### 품질 등급

- **A등급**: 90% 이상 - 매우 우수
- **B등급**: 80-89% - 우수
- **C등급**: 70-79% - 양호
- **D등급**: 60-69% - 보통
- **F등급**: 60% 미만 - 개선 필요

## 통합 테스트

### 테스트 범위

1. **End-to-End Processing**: 전체 처리 파이프라인
2. **Performance Testing**: 성능 테스트
3. **Error Handling Testing**: 에러 처리 테스트
4. **Validation Testing**: 검증 시스템 테스트
5. **Memory Management**: 메모리 관리 테스트

### 테스트 실행

```javascript
import { IntegrationTestSuite } from './src/dna-engine/core/integrationTest.js';

const testSuite = new IntegrationTestSuite();
const results = await testSuite.runAllTests();

console.log('테스트 결과:', results);
```

## 설정 옵션

### 기본 설정

```javascript
const defaultOptions = {
  // 성능 설정
  enableCache: true,
  maxCacheSize: 1000,
  enableParallelProcessing: true,
  
  // 검증 설정
  enableValidation: true,
  validationLevel: 'standard', // 'basic', 'standard', 'strict'
  
  // 에러 처리 설정
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  
  // 출력 설정
  includeMetadata: true,
  includePerformanceMetrics: true,
  includeValidationDetails: true
};
```

## 모니터링 및 로깅

### 성능 메트릭

- **처리 시간**: 각 단계별 처리 시간
- **메모리 사용량**: 실시간 메모리 사용량
- **캐시 효율성**: 캐시 적중률 및 효율성
- **처리 속도**: 문자당 처리 속도

### 로그 레벨

- **DEBUG**: 디버깅 정보
- **INFO**: 일반 정보
- **WARN**: 경고 메시지
- **ERROR**: 오류 메시지
- **FATAL**: 치명적 오류

## 문제 해결

### 일반적인 문제

#### 1. 메모리 부족 오류

**증상**: "Memory limit exceeded" 오류

**해결책**:
```javascript
const options = {
  maxCacheSize: 500,  // 캐시 크기 줄이기
  enableParallelProcessing: false  // 병렬 처리 비활성화
};
```

#### 2. 처리 속도 저하

**증상**: 처리 시간이 예상보다 오래 걸림

**해결책**:
```javascript
const options = {
  enableCache: true,  // 캐시 활성화
  enableParallelProcessing: true,  // 병렬 처리 활성화
  validationLevel: 'basic'  // 검증 레벨 낮추기
};
```

#### 3. 검증 점수가 낮음

**증상**: validation.overallScore가 0.6 미만

**해결책**:
- 입력 텍스트의 품질 확인
- 날짜 형식이 지원되는 형식인지 확인
- validationLevel을 'basic'으로 설정하여 테스트

### 디버깅 팁

1. **상세 로그 활성화**:
```javascript
const options = {
  enableDebugLogging: true,
  logLevel: 'DEBUG'
};
```

2. **단계별 결과 확인**:
```javascript
const result = await controller.processDocumentDateArrays(text, {
  includeIntermediateResults: true
});
console.log('중간 결과:', result.intermediateResults);
```

3. **성능 프로파일링**:
```javascript
const result = await controller.processDocumentDateArrays(text, {
  enableProfiling: true
});
console.log('성능 프로파일:', result.performance.profiling);
```

## 버전 정보

- **현재 버전**: 2.0.0
- **호환성**: Node.js 18.0.0 이상
- **의존성**: ES Modules 지원 필요

## 라이선스

이 소프트웨어는 MIT 라이선스 하에 배포됩니다.

## 지원 및 문의

기술적 문의나 버그 리포트는 프로젝트 저장소의 Issues 섹션을 이용해 주세요.

---

*이 문서는 DNA Engine Phase 2 (v2.0.0) 기준으로 작성되었습니다.*