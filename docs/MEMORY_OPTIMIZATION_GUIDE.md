# 메모리 최적화 가이드

## 개요
VNEXSUS 백엔드 시스템의 메모리 최적화 기능은 대용량 파일 처리와 장시간 실행되는 작업에서 메모리 효율성을 극대화합니다.

## 메모리 최적화 유틸리티

### globalMemoryOptimizer 클래스
위치: `backend/utils/memoryOptimizer.js`

#### 주요 기능
1. **메모리 사용량 모니터링**
2. **강제 가비지 컬렉션**
3. **메모리 누수 감지**
4. **스트림 기반 파일 처리**
5. **대용량 객체 최적화**

## 사용법

### 1. 기본 import
```javascript
import { globalMemoryOptimizer } from '../utils/memoryOptimizer.js';
```

### 2. 메모리 사용량 체크
```javascript
// 대용량 데이터 처리 전
globalMemoryOptimizer.checkMemoryUsage();
```

### 3. 강제 가비지 컬렉션
```javascript
// 처리 완료 후 메모리 정리
globalMemoryOptimizer.forceGarbageCollection();
```

### 4. 스트림 기반 파일 처리
```javascript
// 대용량 파일을 스트림으로 처리
const stream = globalMemoryOptimizer.createFileStream(filePath);
stream.on('data', (chunk) => {
  // 청크 단위로 처리
});
```

### 5. 메모리 누수 감지
```javascript
// 메모리 누수 모니터링 시작
globalMemoryOptimizer.startMemoryLeakDetection();

// 작업 수행...

// 메모리 누수 체크
const leakDetected = globalMemoryOptimizer.checkMemoryLeak();
if (leakDetected) {
  console.warn('메모리 누수가 감지되었습니다');
}
```

## 적용된 컨트롤러 및 서비스

### 1. OCR Controller (`ocrController.js`)
```javascript
// 파일 처리 시작 전
globalMemoryOptimizer.checkMemoryUsage();

// 모든 파일 처리 완료 후
globalMemoryOptimizer.forceGarbageCollection();
```

### 2. Enhanced OCR Controller (`enhancedOcrController.js`)
```javascript
// 메타데이터 추출 후, 작업 초기화 전
globalMemoryOptimizer.checkMemoryUsage();

// 작업 완료 후
globalMemoryOptimizer.forceGarbageCollection();
```

### 3. Dev Studio Controller (`devStudioController.js`)
```javascript
// AI 프롬프트 테스트 시작 전
globalMemoryOptimizer.checkMemoryUsage();

// AI 처리 완료 후
globalMemoryOptimizer.forceGarbageCollection();
```

### 4. Core Engine Service (`coreEngineService.js`)
```javascript
// 통합 파이프라인 시작 전
globalMemoryOptimizer.checkMemoryUsage();

// 파이프라인 완료 후
globalMemoryOptimizer.forceGarbageCollection();
```

## 메모리 최적화 전략

### 1. 예방적 메모리 관리
- **처리 전 체크**: 대용량 데이터 처리 전 메모리 상태 확인
- **임계값 모니터링**: 메모리 사용량이 80% 초과 시 경고
- **자동 정리**: 임계값 도달 시 자동 가비지 컬렉션

### 2. 스트림 기반 처리
```javascript
// 대용량 파일 처리 시
const processLargeFile = async (filePath) => {
  const stream = globalMemoryOptimizer.createFileStream(filePath, {
    highWaterMark: 64 * 1024 // 64KB 청크
  });
  
  return new Promise((resolve, reject) => {
    let result = '';
    
    stream.on('data', (chunk) => {
      // 청크 단위로 처리하여 메모리 효율성 확보
      result += processChunk(chunk);
    });
    
    stream.on('end', () => resolve(result));
    stream.on('error', reject);
  });
};
```

### 3. 대용량 객체 최적화
```javascript
// 큰 객체 처리 시
const optimizedObject = globalMemoryOptimizer.optimizeLargeObject(largeData, {
  compressionLevel: 6,
  chunkSize: 1024 * 1024 // 1MB 청크
});
```

## 성능 모니터링

### 1. 메모리 사용량 프로파일링
```javascript
// 프로파일링 시작
const profile = globalMemoryOptimizer.startMemoryProfiling();

// 작업 수행...

// 프로파일링 결과
const results = globalMemoryOptimizer.endMemoryProfiling(profile);
console.log('메모리 사용량 분석:', results);
```

### 2. 메모리 통계 조회
```javascript
const stats = globalMemoryOptimizer.getMemoryStats();
console.log('현재 메모리 상태:', stats);
```

### 3. 메모리 권장사항
```javascript
const recommendations = globalMemoryOptimizer.getMemoryRecommendations();
console.log('최적화 권장사항:', recommendations);
```

## 설정 및 환경변수

### 환경변수 설정
```bash
# .env 파일
MEMORY_OPTIMIZATION_ENABLED=true
MEMORY_THRESHOLD_PERCENT=80
GC_INTERVAL_MS=30000
STREAM_CHUNK_SIZE=65536
MEMORY_LEAK_DETECTION=true
```

### 설정 옵션
```javascript
const memoryConfig = {
  enabled: process.env.MEMORY_OPTIMIZATION_ENABLED === 'true',
  thresholdPercent: parseInt(process.env.MEMORY_THRESHOLD_PERCENT) || 80,
  gcInterval: parseInt(process.env.GC_INTERVAL_MS) || 30000,
  streamChunkSize: parseInt(process.env.STREAM_CHUNK_SIZE) || 64 * 1024,
  leakDetection: process.env.MEMORY_LEAK_DETECTION === 'true'
};
```

## 모범 사례

### 1. 컨트롤러에서의 사용
```javascript
export const processLargeData = async (req, res) => {
  try {
    // 1. 처리 전 메모리 체크
    globalMemoryOptimizer.checkMemoryUsage();
    
    // 2. 메모리 누수 감지 시작
    globalMemoryOptimizer.startMemoryLeakDetection();
    
    // 3. 대용량 데이터 처리
    const result = await processData(req.body);
    
    // 4. 메모리 누수 체크
    const leakDetected = globalMemoryOptimizer.checkMemoryLeak();
    if (leakDetected) {
      console.warn('메모리 누수 감지됨');
    }
    
    // 5. 처리 완료 후 정리
    globalMemoryOptimizer.forceGarbageCollection();
    
    res.json({ success: true, result });
  } catch (error) {
    // 오류 발생 시에도 메모리 정리
    globalMemoryOptimizer.forceGarbageCollection();
    res.status(500).json({ error: error.message });
  }
};
```

### 2. 서비스에서의 사용
```javascript
export class DataProcessingService {
  async processLargeDataset(data) {
    // 처리 전 메모리 상태 확인
    globalMemoryOptimizer.checkMemoryUsage();
    
    try {
      // 스트림 기반 처리로 메모리 효율성 확보
      const results = [];
      const stream = globalMemoryOptimizer.createDataStream(data);
      
      for await (const chunk of stream) {
        const processed = await this.processChunk(chunk);
        results.push(processed);
        
        // 주기적으로 메모리 정리
        if (results.length % 100 === 0) {
          globalMemoryOptimizer.forceGarbageCollection();
        }
      }
      
      return results;
    } finally {
      // 항상 메모리 정리
      globalMemoryOptimizer.forceGarbageCollection();
    }
  }
}
```

## 문제 해결

### 1. 메모리 부족 오류
```javascript
// 메모리 부족 시 대응
process.on('memoryUsage', (usage) => {
  if (usage.heapUsed > usage.heapTotal * 0.9) {
    console.warn('메모리 부족 경고');
    globalMemoryOptimizer.forceGarbageCollection();
  }
});
```

### 2. 메모리 누수 디버깅
```javascript
// 메모리 누수 추적
const trackMemoryLeak = () => {
  const initialMemory = process.memoryUsage();
  
  return () => {
    const currentMemory = process.memoryUsage();
    const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
    
    if (heapGrowth > 50 * 1024 * 1024) { // 50MB 증가
      console.warn('잠재적 메모리 누수 감지:', {
        growth: `${heapGrowth / 1024 / 1024}MB`,
        current: `${currentMemory.heapUsed / 1024 / 1024}MB`
      });
    }
  };
};
```

### 3. 성능 최적화 팁
- **적절한 청크 크기**: 64KB-1MB 사이
- **정기적인 GC**: 30초-1분 간격
- **메모리 임계값**: 전체 메모리의 80%
- **스트림 사용**: 10MB 이상 데이터 처리 시

## 모니터링 대시보드

### 메모리 사용량 로그
```javascript
// 정기적인 메모리 상태 로깅
setInterval(() => {
  const stats = globalMemoryOptimizer.getMemoryStats();
  console.log('메모리 상태:', {
    used: `${stats.heapUsed}MB`,
    total: `${stats.heapTotal}MB`,
    usage: `${stats.usagePercent}%`,
    external: `${stats.external}MB`
  });
}, 60000); // 1분마다
```

이 가이드를 통해 VNEXSUS 시스템의 메모리 효율성을 극대화하고 안정적인 대용량 데이터 처리를 구현할 수 있습니다.