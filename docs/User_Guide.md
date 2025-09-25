# DNA Engine Phase 2 - 사용자 가이드

## 시작하기

DNA Engine Phase 2는 의료 문서에서 날짜를 자동으로 추출하고 분류하는 고급 시스템입니다. 이 가이드는 시스템을 효과적으로 사용하는 방법을 설명합니다.

## 빠른 시작

### 1. 기본 설치 및 설정

```bash
# 프로젝트 디렉토리로 이동
cd C:\MVP_v7_2AI

# 의존성 설치 (이미 설치되어 있다면 생략)
npm install
```

### 2. 첫 번째 날짜 추출

```javascript
// 기본 사용 예시
import { TextArrayDateController } from './src/dna-engine/core/textArrayDateControllerComplete.js';

// 컨트롤러 생성
const controller = new TextArrayDateController();

// 의료 문서 텍스트
const medicalDocument = `
환자명: 김철수
진료일: 2024년 12월 15일

[진료 기록]
2024년 12월 10일 초진
- 증상: 두통, 어지러움
- 처방: 진통제

다음 진료 예약: 2024년 12월 22일 오후 2시
`;

// 날짜 추출 실행
try {
  const result = await controller.processDocumentDateArrays(medicalDocument);
  
  if (result.success) {
    console.log('✅ 처리 성공!');
    console.log('주요 날짜들:', result.result.primary);
    console.log('보조 날짜들:', result.result.secondary);
    console.log('처리 시간:', result.processingTime, 'ms');
    console.log('검증 점수:', result.validation.overallScore.toFixed(3));
  } else {
    console.log('❌ 처리 실패:', result.error);
  }
} catch (error) {
  console.error('오류 발생:', error.message);
}
```

## 주요 기능 활용

### 1. 성능 최적화 기능

#### 캐시 활용

```javascript
// 캐시를 활용한 빠른 처리
const options = {
  enableCache: true,
  maxCacheSize: 1000  // 캐시 크기 설정
};

const result = await controller.processDocumentDateArrays(document, options);
```

#### 병렬 처리

```javascript
// 대용량 문서를 위한 병렬 처리
const options = {
  enableParallelProcessing: true,
  maxConcurrency: 4  // 동시 처리 수 제한
};

const result = await controller.processDocumentDateArrays(largeDocument, options);
```

### 2. 검증 시스템 활용

#### 검증 레벨 설정

```javascript
// 기본 검증 (빠름)
const basicResult = await controller.processDocumentDateArrays(document, {
  validationLevel: 'basic'
});

// 표준 검증 (균형)
const standardResult = await controller.processDocumentDateArrays(document, {
  validationLevel: 'standard'
});

// 엄격한 검증 (정확함)
const strictResult = await controller.processDocumentDateArrays(document, {
  validationLevel: 'strict'
});
```

#### 검증 결과 해석

```javascript
const result = await controller.processDocumentDateArrays(document);

// 검증 점수 확인
const score = result.validation.overallScore;
const grade = result.validation.qualityGrade;

if (score >= 0.9) {
  console.log('🌟 매우 우수한 결과입니다!');
} else if (score >= 0.8) {
  console.log('👍 좋은 결과입니다.');
} else if (score >= 0.7) {
  console.log('✅ 양호한 결과입니다.');
} else {
  console.log('⚠️ 결과를 재검토해 주세요.');
  
  // 상세 검증 정보 확인
  console.log('정확도:', result.validation.accuracy.score);
  console.log('완성도:', result.validation.completeness.score);
  console.log('일관성:', result.validation.consistency.score);
  console.log('신뢰도:', result.validation.confidence.score);
}
```

### 3. 에러 처리 및 복구

#### 자동 재시도 설정

```javascript
const options = {
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000  // 1초 대기
};

const result = await controller.processDocumentDateArrays(document, options);
```

#### 에러 상황 대응

```javascript
try {
  const result = await controller.processDocumentDateArrays(document);
  
  if (!result.success) {
    // 처리 실패 시 대응
    console.log('처리 실패 원인:', result.error);
    
    // 간단한 옵션으로 재시도
    const fallbackResult = await controller.processDocumentDateArrays(document, {
      validationLevel: 'basic',
      enableParallelProcessing: false
    });
    
    if (fallbackResult.success) {
      console.log('대체 방법으로 처리 성공!');
    }
  }
} catch (error) {
  console.error('시스템 오류:', error.message);
  
  // 오류 유형별 대응
  if (error.message.includes('메모리')) {
    console.log('💡 해결책: 문서를 작은 단위로 나누어 처리해 보세요.');
  } else if (error.message.includes('시간')) {
    console.log('💡 해결책: 타임아웃 설정을 늘려보세요.');
  }
}
```

## 실제 사용 사례

### 사례 1: 진료 기록 처리

```javascript
// 진료 기록에서 날짜 추출
const medicalRecord = `
환자: 이영희 (1985-03-15 생)
진료과: 내과

[진료 이력]
2024.11.20 - 초진 (감기 증상)
2024.11.25 - 재진 (증상 호전)
2024.12.01 - 정기 검진
2024.12.15 - 혈액 검사 결과 확인

[예약 일정]
다음 진료: 2025년 1월 10일 오전 10시
`;

const result = await controller.processDocumentDateArrays(medicalRecord);

// 결과 활용
const dates = [...result.result.primary, ...result.result.secondary];
const sortedDates = dates.sort((a, b) => new Date(a.date) - new Date(b.date));

console.log('시간순 정렬된 날짜들:');
sortedDates.forEach(dateInfo => {
  console.log(`${dateInfo.date} - ${dateInfo.context}`);
});
```

### 사례 2: 대용량 의료 문서 처리

```javascript
// 큰 문서를 청크 단위로 처리
function splitDocument(text, chunkSize = 5000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function processLargeDocument(largeDocument) {
  const chunks = splitDocument(largeDocument);
  const allResults = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`청크 ${i + 1}/${chunks.length} 처리 중...`);
    
    const result = await controller.processDocumentDateArrays(chunks[i], {
      enableCache: true,
      validationLevel: 'basic'  // 빠른 처리를 위해
    });
    
    if (result.success) {
      allResults.push(result.result);
    }
  }
  
  // 결과 통합
  const combinedResult = {
    primary: allResults.flatMap(r => r.primary || []),
    secondary: allResults.flatMap(r => r.secondary || [])
  };
  
  return combinedResult;
}
```

### 사례 3: 실시간 모니터링

```javascript
// 성능 모니터링과 함께 처리
async function processWithMonitoring(document) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  const result = await controller.processDocumentDateArrays(document, {
    includePerformanceMetrics: true
  });
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage();
  
  // 성능 리포트
  console.log('📊 성능 리포트');
  console.log('처리 시간:', endTime - startTime, 'ms');
  console.log('메모리 사용:', Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024), 'MB');
  console.log('처리 속도:', result.optimization.processingSpeed, '자/초');
  console.log('캐시 적중률:', (result.optimization.cacheHitRate * 100).toFixed(1), '%');
  
  return result;
}
```

## 고급 설정

### 1. 커스텀 날짜 패턴

```javascript
// 특별한 날짜 형식을 위한 설정
const customOptions = {
  datePatterns: {
    // 추가 패턴 정의
    custom: [
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
      /\d{2}\/\d{2}\/\d{4}/
    ]
  },
  contextKeywords: {
    // 의료 관련 키워드 추가
    medical: ['진료', '수술', '검사', '처방', '입원', '퇴원']
  }
};

const result = await controller.processDocumentDateArrays(document, customOptions);
```

### 2. 출력 형식 커스터마이징

```javascript
// 결과 형식 설정
const options = {
  outputFormat: {
    includeMetadata: true,
    includeConfidence: true,
    includeContext: true,
    dateFormat: 'YYYY-MM-DD'  // 표준 형식
  }
};

const result = await controller.processDocumentDateArrays(document, options);
```

### 3. 성능 튜닝

```javascript
// 메모리 제한 환경을 위한 설정
const lowMemoryOptions = {
  maxCacheSize: 100,
  enableParallelProcessing: false,
  validationLevel: 'basic',
  memoryLimit: 100 * 1024 * 1024  // 100MB
};

// 고성능 환경을 위한 설정
const highPerformanceOptions = {
  maxCacheSize: 5000,
  enableParallelProcessing: true,
  maxConcurrency: 8,
  validationLevel: 'strict'
};
```

## 문제 해결 가이드

### 일반적인 문제들

#### 1. "메모리 부족" 오류

**증상**: `Memory limit exceeded` 또는 메모리 관련 오류

**해결 방법**:
```javascript
// 메모리 사용량 줄이기
const options = {
  maxCacheSize: 200,
  enableParallelProcessing: false,
  validationLevel: 'basic'
};

// 또는 문서를 작은 단위로 분할
const chunks = splitDocument(largeDocument, 3000);
```

#### 2. "처리 시간 초과" 오류

**증상**: 처리가 너무 오래 걸리거나 타임아웃 발생

**해결 방법**:
```javascript
// 빠른 처리 모드
const options = {
  validationLevel: 'basic',
  enableCache: true,
  timeout: 30000  // 30초 타임아웃
};
```

#### 3. "낮은 검증 점수" 문제

**증상**: validation.overallScore가 0.6 미만

**해결 방법**:
```javascript
// 1. 입력 텍스트 품질 확인
const cleanedText = document
  .replace(/[^\w\s가-힣\d\-\.\/:]/g, ' ')  // 특수문자 제거
  .replace(/\s+/g, ' ')  // 중복 공백 제거
  .trim();

// 2. 검증 레벨 조정
const result = await controller.processDocumentDateArrays(cleanedText, {
  validationLevel: 'basic'
});

// 3. 결과 분석
if (result.validation.overallScore < 0.7) {
  console.log('상세 분석:');
  console.log('- 정확도:', result.validation.accuracy.score);
  console.log('- 완성도:', result.validation.completeness.score);
  console.log('- 일관성:', result.validation.consistency.score);
}
```

### 디버깅 팁

#### 1. 상세 로그 활성화

```javascript
// 디버그 모드로 실행
const result = await controller.processDocumentDateArrays(document, {
  debug: true,
  logLevel: 'verbose'
});
```

#### 2. 단계별 결과 확인

```javascript
// 중간 결과 포함하여 처리
const result = await controller.processDocumentDateArrays(document, {
  includeIntermediateResults: true
});

// 각 단계 결과 확인
console.log('텍스트 분할 결과:', result.intermediateResults.segmentation);
console.log('분류 결과:', result.intermediateResults.classification);
console.log('통합 결과:', result.intermediateResults.integration);
```

#### 3. 성능 프로파일링

```javascript
// 성능 분석 활성화
const result = await controller.processDocumentDateArrays(document, {
  enableProfiling: true
});

// 병목 지점 확인
console.log('성능 프로파일:', result.performance.profiling);
```

## 통합 테스트 실행

### 전체 시스템 테스트

```javascript
// 통합 테스트 실행
import { IntegrationTestSuite } from './src/dna-engine/core/integrationTest.js';

const testSuite = new IntegrationTestSuite();
const results = await testSuite.runAllTests();

console.log('테스트 결과:');
console.log(`총 ${results.total}개 테스트 중 ${results.passed}개 통과`);
console.log(`성공률: ${(results.passed / results.total * 100).toFixed(1)}%`);
```

### 개별 기능 테스트

```javascript
// 특정 기능만 테스트
const testSuite = new IntegrationTestSuite();

// 성능 테스트만 실행
await testSuite.runPerformanceTests();

// 에러 처리 테스트만 실행
await testSuite.runErrorHandlingTests();

// 검증 시스템 테스트만 실행
await testSuite.runValidationTests();
```

## 모범 사례

### 1. 효율적인 문서 처리

```javascript
// ✅ 좋은 예시
async function processDocuments(documents) {
  const controller = new TextArrayDateController();
  const results = [];
  
  for (const doc of documents) {
    // 문서 크기에 따른 적응적 처리
    const options = doc.length > 10000 ? {
      validationLevel: 'basic',
      enableParallelProcessing: false
    } : {
      validationLevel: 'standard',
      enableParallelProcessing: true
    };
    
    const result = await controller.processDocumentDateArrays(doc, options);
    results.push(result);
  }
  
  return results;
}

// ❌ 피해야 할 예시
async function inefficientProcessing(documents) {
  // 매번 새 컨트롤러 생성 (비효율적)
  for (const doc of documents) {
    const controller = new TextArrayDateController();
    await controller.processDocumentDateArrays(doc);
  }
}
```

### 2. 에러 처리 패턴

```javascript
// ✅ 권장 패턴
async function robustProcessing(document) {
  try {
    // 1차 시도: 표준 설정
    let result = await controller.processDocumentDateArrays(document);
    
    if (result.success && result.validation.overallScore >= 0.7) {
      return result;
    }
    
    // 2차 시도: 기본 설정
    result = await controller.processDocumentDateArrays(document, {
      validationLevel: 'basic'
    });
    
    if (result.success) {
      console.warn('기본 모드로 처리됨. 결과를 검토해 주세요.');
      return result;
    }
    
    throw new Error('처리 실패');
    
  } catch (error) {
    console.error('문서 처리 실패:', error.message);
    
    // 최종 대안: 부분 처리
    return await processInChunks(document);
  }
}
```

### 3. 결과 활용 패턴

```javascript
// ✅ 효과적인 결과 활용
function analyzeResults(result) {
  if (!result.success) {
    return { error: '처리 실패' };
  }
  
  const allDates = [...result.result.primary, ...result.result.secondary];
  
  // 날짜 분석
  const analysis = {
    totalDates: allDates.length,
    dateRange: {
      earliest: Math.min(...allDates.map(d => new Date(d.date))),
      latest: Math.max(...allDates.map(d => new Date(d.date)))
    },
    categories: {
      medical: allDates.filter(d => d.category === 'medical').length,
      appointment: allDates.filter(d => d.category === 'appointment').length,
      administrative: allDates.filter(d => d.category === 'administrative').length
    },
    quality: {
      score: result.validation.overallScore,
      grade: result.validation.qualityGrade,
      reliable: result.validation.overallScore >= 0.8
    }
  };
  
  return analysis;
}
```

## 추가 리소스

- **API 문서**: `docs/API_Documentation.md`
- **통합 테스트**: `src/dna-engine/core/integrationTest.js`
- **에러 처리**: `src/dna-engine/core/errorHandler.js`
- **검증 엔진**: `src/dna-engine/core/validationEngine.js`

## 지원 및 문의

기술적 문의나 버그 리포트는 프로젝트 저장소의 Issues 섹션을 이용해 주세요.

---

*이 가이드는 DNA Engine Phase 2 (v2.0.0) 기준으로 작성되었습니다.*