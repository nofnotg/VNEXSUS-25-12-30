# VNEXSUS 단계별 개발 계획 및 테스트 전략

## 📋 개요

본 문서는 VNEXSUS 시스템의 안전하고 체계적인 개선을 위한 단계별 개발 계획과 포괄적인 테스트 전략을 제시합니다. 기존 기능의 완전한 호환성을 보장하면서 점진적으로 시스템을 개선하는 것을 목표로 합니다.

---

## 🎯 전체 개발 로드맵

### 타임라인 개요
```
Phase 1: 안정성 강화 (4주)
├── Week 1: 에러 처리 및 로깅 시스템 구축
├── Week 2: 모니터링 및 알림 시스템 도입
├── Week 3: 캐싱 시스템 구현
└── Week 4: 통합 테스트 및 배포

Phase 2: 성능 최적화 (6주)
├── Week 5-6: 비동기 처리 및 큐 시스템
├── Week 7-8: 병렬 처리 최적화
├── Week 9-10: 메모리 및 리소스 최적화

Phase 3: 확장성 개선 (8주)
├── Week 11-14: 마이크로서비스 아키텍처 도입
├── Week 15-18: 데이터베이스 최적화 및 확장
```

---

## 📅 Phase 1: 안정성 강화 (4주)

### Week 1: 에러 처리 및 로깅 시스템 구축

#### 🎯 목표
- 견고한 에러 처리 메커니즘 구축
- 구조화된 로깅 시스템 도입
- 자동 복구 기능 구현

#### 📋 상세 작업 계획

**Day 1-2: 에러 분류 및 처리 로직 설계**
```javascript
// 작업 1: 에러 분류 시스템 구현
class ErrorClassifier {
  static classify(error) {
    const errorTypes = {
      TEMPORARY: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
      RATE_LIMIT: ['429', 'QUOTA_EXCEEDED'],
      INVALID_INPUT: ['400', 'INVALID_FILE_FORMAT'],
      SYSTEM: ['500', 'INTERNAL_ERROR']
    };
    
    for (const [type, codes] of Object.entries(errorTypes)) {
      if (codes.some(code => error.message.includes(code) || error.code === code)) {
        return type;
      }
    }
    
    return 'UNKNOWN';
  }
}

// 작업 2: 재시도 로직 구현
class RetryManager {
  async executeWithRetry(fn, options = {}) {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const errorType = ErrorClassifier.classify(error);
        
        if (errorType !== 'TEMPORARY' || attempt === maxRetries) {
          throw error;
        }
        
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await this.sleep(delay);
      }
    }
  }
}
```

**Day 3-4: 구조화된 로깅 시스템 구현**
```javascript
// 작업 3: 로깅 시스템 구현
class StructuredLogger {
  constructor() {
    this.winston = require('winston');
    this.logger = this.winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: this.winston.format.combine(
        this.winston.format.timestamp(),
        this.winston.format.errors({ stack: true }),
        this.winston.format.json()
      ),
      transports: [
        new this.winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new this.winston.transports.File({ filename: 'logs/combined.log' }),
        new this.winston.transports.Console({
          format: this.winston.format.simple()
        })
      ]
    });
  }
  
  logRequest(req, res, duration) {
    this.logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  
  logError(error, context = {}) {
    this.logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      errorType: ErrorClassifier.classify(error),
      context,
      timestamp: new Date().toISOString()
    });
  }
}
```

**Day 5: 기존 코드에 에러 처리 적용**
```javascript
// 작업 4: OCR 컨트롤러 개선
// 파일: backend/controllers/ocrController.js
const retryManager = new RetryManager();
const logger = new StructuredLogger();

async uploadPdfs(req, res) {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    logger.logger.info('OCR 요청 시작', { requestId, fileCount: req.files.length });
    
    // 기존 로직 유지하면서 에러 처리 강화
    const result = await retryManager.executeWithRetry(
      () => this.processFilesWithErrorHandling(req.files, requestId),
      { maxRetries: 3, baseDelay: 2000 }
    );
    
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    
    res.status(202).json(result);
    
  } catch (error) {
    logger.logError(error, { requestId, operation: 'uploadPdfs' });
    
    // 기존 에러 응답 형식 유지
    res.status(500).json({
      error: 'OCR 처리 중 오류가 발생했습니다.',
      jobId: null,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
```

#### 🧪 테스트 계획
```javascript
// 테스트 1: 에러 분류 테스트
describe('ErrorClassifier', () => {
  test('TEMPORARY 에러 분류', () => {
    const error = new Error('ECONNRESET');
    expect(ErrorClassifier.classify(error)).toBe('TEMPORARY');
  });
  
  test('RATE_LIMIT 에러 분류', () => {
    const error = new Error('429 Too Many Requests');
    expect(ErrorClassifier.classify(error)).toBe('RATE_LIMIT');
  });
});

// 테스트 2: 재시도 로직 테스트
describe('RetryManager', () => {
  test('성공 시 재시도 없음', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await retryManager.executeWithRetry(mockFn);
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('success');
  });
  
  test('TEMPORARY 에러 시 재시도', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('success');
    
    const result = await retryManager.executeWithRetry(mockFn);
    
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });
});
```

### Week 2: 모니터링 및 알림 시스템 도입

#### 🎯 목표
- 실시간 시스템 상태 모니터링
- 자동 알림 시스템 구축
- 성능 지표 수집 및 분석

#### 📋 상세 작업 계획

**Day 6-7: 메트릭 수집 시스템 구현**
```javascript
// 작업 1: 메트릭 수집기 구현
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.prometheus = require('prom-client');
    
    // 기본 메트릭 등록
    this.httpRequestDuration = new this.prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP 요청 처리 시간',
      labelNames: ['method', 'route', 'status_code']
    });
    
    this.ocrProcessingTime = new this.prometheus.Histogram({
      name: 'ocr_processing_duration_seconds',
      help: 'OCR 처리 시간',
      labelNames: ['file_type', 'file_size_mb']
    });
    
    this.activeJobs = new this.prometheus.Gauge({
      name: 'active_jobs_total',
      help: '현재 처리 중인 작업 수'
    });
  }
  
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration / 1000);
  }
  
  recordOCRProcessing(fileType, fileSizeMB, duration) {
    this.ocrProcessingTime
      .labels(fileType, fileSizeMB.toString())
      .observe(duration / 1000);
  }
  
  incrementActiveJobs() {
    this.activeJobs.inc();
  }
  
  decrementActiveJobs() {
    this.activeJobs.dec();
  }
}
```

**Day 8-9: 헬스 체크 시스템 구현**
```javascript
// 작업 2: 헬스 체크 엔드포인트
class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.registerDefaultChecks();
  }
  
  registerDefaultChecks() {
    // 데이터베이스 연결 체크
    this.checks.set('database', async () => {
      try {
        await db.query('SELECT 1');
        return { status: 'healthy', latency: Date.now() };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
    
    // Redis 연결 체크
    this.checks.set('redis', async () => {
      try {
        await redis.ping();
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
    
    // 외부 API 체크
    this.checks.set('google_vision', async () => {
      try {
        // 간단한 테스트 이미지로 API 체크
        const testResult = await visionClient.textDetection({
          image: { content: Buffer.from('test') }
        });
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    });
  }
  
  async runAllChecks() {
    const results = {};
    const startTime = Date.now();
    
    for (const [name, check] of this.checks) {
      try {
        results[name] = await Promise.race([
          check(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
      } catch (error) {
        results[name] = { status: 'unhealthy', error: error.message };
      }
    }
    
    const overallStatus = Object.values(results).every(r => r.status === 'healthy') 
      ? 'healthy' : 'unhealthy';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      checks: results
    };
  }
}

// 헬스 체크 라우트 추가
app.get('/health', async (req, res) => {
  const healthCheck = await healthChecker.runAllChecks();
  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});
```

**Day 10: 알림 시스템 구현**
```javascript
// 작업 3: 알림 시스템
class AlertManager {
  constructor() {
    this.rules = [];
    this.channels = new Map();
    this.setupDefaultChannels();
  }
  
  setupDefaultChannels() {
    // 이메일 알림
    this.channels.set('email', {
      send: async (message) => {
        // 이메일 발송 로직
        console.log('Email alert:', message);
      }
    });
    
    // 슬랙 알림
    this.channels.set('slack', {
      send: async (message) => {
        // 슬랙 웹훅 호출
        console.log('Slack alert:', message);
      }
    });
  }
  
  addRule(rule) {
    this.rules.push({
      id: uuidv4(),
      ...rule,
      lastTriggered: null
    });
  }
  
  async checkRules(metrics) {
    for (const rule of this.rules) {
      if (this.evaluateRule(rule, metrics)) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }
  
  evaluateRule(rule, metrics) {
    const value = this.getMetricValue(metrics, rule.metric);
    
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }
  
  async triggerAlert(rule, metrics) {
    const now = Date.now();
    
    // 중복 알림 방지 (쿨다운 시간)
    if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown) {
      return;
    }
    
    const message = {
      title: rule.title,
      description: rule.description,
      severity: rule.severity,
      metric: rule.metric,
      currentValue: this.getMetricValue(metrics, rule.metric),
      threshold: rule.threshold,
      timestamp: new Date().toISOString()
    };
    
    // 모든 채널에 알림 발송
    for (const channelName of rule.channels) {
      const channel = this.channels.get(channelName);
      if (channel) {
        await channel.send(message);
      }
    }
    
    rule.lastTriggered = now;
  }
}

// 기본 알림 규칙 설정
alertManager.addRule({
  metric: 'ocr_processing_duration_seconds.p95',
  operator: 'gt',
  threshold: 30,
  severity: 'warning',
  title: 'OCR 처리 시간 지연',
  description: 'OCR 처리 시간이 30초를 초과했습니다.',
  channels: ['email', 'slack'],
  cooldown: 300000 // 5분
});
```

#### 🧪 테스트 계획
```javascript
describe('Monitoring System', () => {
  test('메트릭 수집 정상 동작', () => {
    const collector = new MetricsCollector();
    collector.recordHttpRequest('POST', '/api/ocr/upload', 200, 1500);
    
    // Prometheus 메트릭이 정상적으로 기록되는지 확인
    const metrics = collector.prometheus.register.metrics();
    expect(metrics).toContain('http_request_duration_seconds');
  });
  
  test('헬스 체크 정상 동작', async () => {
    const healthChecker = new HealthChecker();
    const result = await healthChecker.runAllChecks();
    
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('checks');
    expect(['healthy', 'unhealthy']).toContain(result.status);
  });
});
```

### Week 3: 캐싱 시스템 구현

#### 🎯 목표
- Redis 기반 캐싱 시스템 도입
- OCR 결과 캐싱으로 중복 처리 방지
- 성능 향상 및 비용 절감

#### 📋 상세 작업 계획

**Day 11-12: Redis 캐싱 레이어 구현**
```javascript
// 작업 1: 캐싱 서비스 구현
class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    this.defaultTTL = 3600; // 1시간
    this.hashAlgorithm = 'sha256';
  }
  
  generateFileHash(buffer) {
    return crypto
      .createHash(this.hashAlgorithm)
      .update(buffer)
      .digest('hex');
  }
  
  async get(key) {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.logError(error, { operation: 'cache_get', key });
      return null; // 캐시 실패 시 null 반환하여 원본 로직 실행
    }
  }
  
  async set(key, value, ttl = this.defaultTTL) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.logError(error, { operation: 'cache_set', key });
      return false; // 캐시 실패해도 원본 로직에는 영향 없음
    }
  }
  
  async getOCRResult(fileHash) {
    return await this.get(`ocr:${fileHash}`);
  }
  
  async setOCRResult(fileHash, result, ttl = 86400) { // 24시간
    return await this.set(`ocr:${fileHash}`, result, ttl);
  }
  
  async getRuleResult(dataHash) {
    return await this.get(`rule:${dataHash}`);
  }
  
  async setRuleResult(dataHash, result, ttl = 3600) { // 1시간
    return await this.set(`rule:${dataHash}`, result, ttl);
  }
}
```

**Day 13-14: OCR 컨트롤러에 캐싱 적용**
```javascript
// 작업 2: OCR 컨트롤러 캐싱 적용
// 파일: backend/controllers/ocrController.js (수정)

class OCRController {
  constructor() {
    this.cacheService = new CacheService();
    this.metricsCollector = new MetricsCollector();
  }
  
  async uploadPdfs(req, res) {
    const requestId = uuidv4();
    const files = req.files;
    
    try {
      // 1단계: 파일 해시 계산
      const fileHashes = files.map(file => ({
        hash: this.cacheService.generateFileHash(file.buffer),
        file: file
      }));
      
      // 2단계: 캐시 확인
      const cacheResults = await Promise.all(
        fileHashes.map(async ({ hash, file }) => {
          const cached = await this.cacheService.getOCRResult(hash);
          return {
            hash,
            file,
            cached,
            isCacheHit: !!cached
          };
        })
      );
      
      // 3단계: 캐시 히트/미스 분리
      const cacheHits = cacheResults.filter(r => r.isCacheHit);
      const cacheMisses = cacheResults.filter(r => !r.isCacheHit);
      
      // 4단계: 캐시 미스 파일만 처리
      let processedResults = {};
      
      if (cacheMisses.length > 0) {
        const filesToProcess = cacheMisses.map(r => r.file);
        processedResults = await this.processFilesInternal(requestId, filesToProcess);
        
        // 5단계: 새로운 결과 캐싱
        await Promise.all(
          cacheMisses.map(async ({ hash, file }) => {
            const result = processedResults[file.originalname];
            if (result) {
              await this.cacheService.setOCRResult(hash, result);
            }
          })
        );
      }
      
      // 6단계: 캐시 히트와 새 결과 병합
      const finalResults = {};
      
      cacheHits.forEach(({ file, cached }) => {
        finalResults[file.originalname] = cached;
      });
      
      Object.assign(finalResults, processedResults);
      
      // 7단계: 메트릭 기록
      this.metricsCollector.recordCacheMetrics({
        totalFiles: files.length,
        cacheHits: cacheHits.length,
        cacheMisses: cacheMisses.length,
        cacheHitRate: cacheHits.length / files.length
      });
      
      // 8단계: 기존 형식으로 응답 (호환성 보장)
      const jobId = uuidv4();
      await jobStore.setResult(jobId, finalResults);
      
      res.status(202).json({
        jobId,
        status: 'completed',
        message: '파일 처리가 완료되었습니다.',
        cacheStats: {
          totalFiles: files.length,
          fromCache: cacheHits.length,
          processed: cacheMisses.length
        }
      });
      
    } catch (error) {
      logger.logError(error, { requestId, operation: 'uploadPdfs' });
      res.status(500).json({
        error: 'OCR 처리 중 오류가 발생했습니다.',
        jobId: null
      });
    }
  }
}
```

**Day 15: 룰 처리에 캐싱 적용**
```javascript
// 작업 3: 룰 처리 캐싱
// 파일: backend/postprocess/index.js (수정)

class PostProcessingManager {
  constructor() {
    this.cacheService = new CacheService();
  }
  
  async processOCRResult(ocrResult, options = {}) {
    try {
      // 입력 데이터 해시 생성
      const inputHash = this.generateInputHash(ocrResult, options);
      
      // 캐시 확인
      const cachedResult = await this.cacheService.getRuleResult(inputHash);
      if (cachedResult) {
        logger.logger.info('룰 처리 결과 캐시 히트', { inputHash });
        return cachedResult;
      }
      
      // 캐시 미스 시 실제 처리 실행
      const result = await this.processOCRResultInternal(ocrResult, options);
      
      // 결과 캐싱
      await this.cacheService.setRuleResult(inputHash, result);
      
      return result;
      
    } catch (error) {
      logger.logError(error, { operation: 'processOCRResult' });
      throw error;
    }
  }
  
  generateInputHash(ocrResult, options) {
    const input = JSON.stringify({ ocrResult, options });
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  
  // 기존 처리 로직을 별도 메서드로 분리
  async processOCRResultInternal(ocrResult, options) {
    // 기존 processOCRResult 로직 그대로 유지
    // ...
  }
}
```

#### 🧪 테스트 계획
```javascript
describe('Caching System', () => {
  test('파일 해시 생성 일관성', () => {
    const buffer1 = Buffer.from('test content');
    const buffer2 = Buffer.from('test content');
    const buffer3 = Buffer.from('different content');
    
    const hash1 = cacheService.generateFileHash(buffer1);
    const hash2 = cacheService.generateFileHash(buffer2);
    const hash3 = cacheService.generateFileHash(buffer3);
    
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });
  
  test('OCR 결과 캐싱 동작', async () => {
    const fileHash = 'test-hash';
    const testResult = { text: 'test', confidence: 0.95 };
    
    // 캐시 저장
    await cacheService.setOCRResult(fileHash, testResult);
    
    // 캐시 조회
    const cached = await cacheService.getOCRResult(fileHash);
    
    expect(cached).toEqual(testResult);
  });
  
  test('캐시 실패 시 원본 로직 실행', async () => {
    // Redis 연결 실패 시뮬레이션
    jest.spyOn(cacheService.redis, 'get').mockRejectedValue(new Error('Redis error'));
    
    const result = await cacheService.get('test-key');
    expect(result).toBeNull();
  });
});
```

### Week 4: 통합 테스트 및 배포

#### 🎯 목표
- 전체 시스템 통합 테스트
- 성능 벤치마크 측정
- 프로덕션 배포 준비

#### 📋 상세 작업 계획

**Day 16-17: 통합 테스트 실행**
```javascript
// 작업 1: 엔드투엔드 테스트
describe('Phase 1 Integration Tests', () => {
  test('전체 파이프라인 정상 동작 (캐싱 포함)', async () => {
    // 1. 첫 번째 요청 (캐시 미스)
    const response1 = await request(app)
      .post('/api/ocr/upload')
      .attach('files', testPDF);
    
    expect(response1.status).toBe(202);
    expect(response1.body.cacheStats.fromCache).toBe(0);
    
    // 2. 동일한 파일로 두 번째 요청 (캐시 히트)
    const response2 = await request(app)
      .post('/api/ocr/upload')
      .attach('files', testPDF);
    
    expect(response2.status).toBe(202);
    expect(response2.body.cacheStats.fromCache).toBe(1);
  });
  
  test('에러 처리 및 복구 메커니즘', async () => {
    // Google Vision API 장애 시뮬레이션
    jest.spyOn(visionService, 'processDocument')
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue({ text: 'recovered', confidence: 0.9 });
    
    const response = await request(app)
      .post('/api/ocr/upload')
      .attach('files', testPDF);
    
    expect(response.status).toBe(202);
    // 재시도 후 성공해야 함
  });
  
  test('모니터링 메트릭 수집', async () => {
    await request(app)
      .post('/api/ocr/upload')
      .attach('files', testPDF);
    
    const metrics = await request(app).get('/metrics');
    expect(metrics.text).toContain('http_request_duration_seconds');
    expect(metrics.text).toContain('ocr_processing_duration_seconds');
  });
});
```

**Day 18-19: 성능 벤치마크**
```javascript
// 작업 2: 성능 테스트
describe('Performance Benchmarks', () => {
  test('OCR 처리 시간 개선 확인', async () => {
    const startTime = Date.now();
    
    // 동일한 파일 10번 처리 (캐싱 효과 확인)
    const promises = Array(10).fill().map(() =>
      request(app)
        .post('/api/ocr/upload')
        .attach('files', testPDF)
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    // 첫 번째는 실제 처리, 나머지는 캐시에서 조회
    expect(results[0].body.cacheStats.fromCache).toBe(0);
    expect(results[9].body.cacheStats.fromCache).toBe(1);
    
    // 전체 처리 시간이 단일 처리 시간의 2배 미만이어야 함 (캐싱 효과)
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(20000); // 20초 미만
  });
  
  test('메모리 사용량 안정성', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 대량 요청 처리
    for (let i = 0; i < 50; i++) {
      await request(app)
        .post('/api/ocr/upload')
        .attach('files', smallTestPDF);
    }
    
    // 가비지 컬렉션 강제 실행
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 메모리 증가량이 100MB 미만이어야 함
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});
```

**Day 20: 배포 준비 및 실행**
```bash
# 작업 3: 배포 스크립트
#!/bin/bash
# deploy-phase1.sh

echo "Phase 1 배포 시작..."

# 1. 환경 변수 확인
if [ -z "$REDIS_URL" ]; then
  echo "Error: REDIS_URL이 설정되지 않았습니다."
  exit 1
fi

# 2. 의존성 설치
npm install redis prom-client winston

# 3. 데이터베이스 마이그레이션 (필요한 경우)
npm run migrate

# 4. 헬스 체크
echo "헬스 체크 실행 중..."
curl -f http://localhost:3000/health || exit 1

# 5. 캐시 워밍업
echo "캐시 워밍업 중..."
node scripts/cache-warmup.js

# 6. 모니터링 대시보드 설정
echo "모니터링 설정 중..."
docker-compose -f monitoring/docker-compose.yml up -d

echo "Phase 1 배포 완료!"
```

---

## 📅 Phase 2: 성능 최적화 (6주)

### Week 5-6: 비동기 처리 및 큐 시스템

#### 🎯 목표
- Bull Queue 기반 작업 큐 시스템 도입
- 비동기 처리로 응답 시간 개선
- 작업 우선순위 및 재시도 로직 구현

#### 📋 상세 작업 계획

**Day 21-25: 큐 시스템 구현**
```javascript
// 작업 1: 큐 시스템 설계 및 구현
const Queue = require('bull');
const Redis = require('ioredis');

class QueueManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.queues = new Map();
    this.setupQueues();
  }
  
  setupQueues() {
    // OCR 처리 큐
    this.queues.set('ocr', new Queue('OCR Processing', {
      redis: {
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));
    
    // 후처리 큐
    this.queues.set('postprocess', new Queue('Post Processing', {
      redis: { /* Redis 설정 */ },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: 'fixed'
      }
    }));
    
    // AI 처리 큐
    this.queues.set('ai', new Queue('AI Processing', {
      redis: { /* Redis 설정 */ },
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    }));
    
    this.setupWorkers();
  }
  
  setupWorkers() {
    // OCR 워커
    this.queues.get('ocr').process('process-files', 4, async (job) => {
      const { jobId, files } = job.data;
      
      try {
        job.progress(10);
        
        const results = await this.processFilesWithProgress(jobId, files, job);
        
        job.progress(100);
        return results;
        
      } catch (error) {
        logger.logError(error, { jobId, operation: 'ocr-worker' });
        throw error;
      }
    });
    
    // 후처리 워커
    this.queues.get('postprocess').process('process-ocr-result', 2, async (job) => {
      const { jobId, ocrResult, options } = job.data;
      
      try {
        const postProcessor = new PostProcessingManager();
        const result = await postProcessor.processOCRResult(ocrResult, options);
        
        // 다음 단계 큐에 작업 추가
        await this.addJob('ai', 'generate-report', {
          jobId,
          processedData: result,
          options
        });
        
        return result;
        
      } catch (error) {
        logger.logError(error, { jobId, operation: 'postprocess-worker' });
        throw error;
      }
    });
  }
  
  async addJob(queueName, jobType, data, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    const job = await queue.add(jobType, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });
    
    return job;
  }
  
  async processFilesWithProgress(jobId, files, job) {
    const results = {};
    const totalFiles = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 진행률 업데이트
      const progress = 10 + (i / totalFiles) * 80;
      job.progress(progress);
      
      // 파일 처리
      results[file.originalname] = await this.processFile(file);
    }
    
    return results;
  }
}
```

**Day 26-30: 컨트롤러 비동기 처리 적용**
```javascript
// 작업 2: 컨트롤러 비동기 처리 변경
class AsyncOCRController {
  constructor() {
    this.queueManager = new QueueManager();
    this.jobStore = new JobStore();
  }
  
  async uploadPdfs(req, res) {
    const requestId = uuidv4();
    const files = req.files;
    
    try {
      // 1. 작업 ID 생성 및 초기 상태 저장
      const jobId = uuidv4();
      await this.jobStore.createJob(jobId, {
        status: 'queued',
        totalFiles: files.length,
        createdAt: new Date().toISOString(),
        requestId
      });
      
      // 2. 즉시 응답 반환 (기존 형식 유지)
      res.status(202).json({
        jobId,
        status: 'queued',
        message: '파일 처리가 대기열에 추가되었습니다.',
        estimatedTime: this.estimateProcessingTime(files)
      });
      
      // 3. 백그라운드에서 처리 시작
      await this.queueManager.addJob('ocr', 'process-files', {
        jobId,
        files: files.map(f => ({
          buffer: f.buffer.toString('base64'),
          mimetype: f.mimetype,
          originalname: f.originalname,
          size: f.size
        })),
        requestId
      }, {
        priority: this.calculatePriority(files),
        attempts: 3
      });
      
      // 4. 작업 상태 업데이트
      await this.jobStore.updateJob(jobId, { status: 'processing' });
      
    } catch (error) {
      logger.logError(error, { requestId, operation: 'uploadPdfs' });
      res.status(500).json({
        error: 'OCR 처리 요청 중 오류가 발생했습니다.',
        jobId: null
      });
    }
  }
  
  // 기존 상태 조회 API 유지 (호환성 보장)
  async getJobStatus(req, res) {
    const { jobId } = req.params;
    
    try {
      const job = await this.jobStore.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
      }
      
      // 큐에서 실시간 진행률 조회
      const queueJob = await this.queueManager.getJob('ocr', jobId);
      const progress = queueJob ? queueJob.progress() : 0;
      
      res.json({
        jobId,
        status: job.status,
        progress,
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles || 0,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        estimatedTimeRemaining: this.calculateRemainingTime(job, progress)
      });
      
    } catch (error) {
      logger.logError(error, { jobId, operation: 'getJobStatus' });
      res.status(500).json({ error: '상태 조회 중 오류가 발생했습니다.' });
    }
  }
  
  estimateProcessingTime(files) {
    // 파일 크기와 개수를 기반으로 예상 처리 시간 계산
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const avgTimePerMB = 2; // 2초/MB
    const baseTime = 5; // 기본 5초
    
    return Math.ceil(baseTime + (totalSize / (1024 * 1024)) * avgTimePerMB);
  }
  
  calculatePriority(files) {
    // 파일 크기가 작을수록 높은 우선순위
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = totalSize / (1024 * 1024);
    
    if (sizeMB < 10) return 10; // 높은 우선순위
    if (sizeMB < 50) return 5;  // 중간 우선순위
    return 1; // 낮은 우선순위
  }
}
```

#### 🧪 테스트 계획
```javascript
describe('Async Processing System', () => {
  test('작업 큐 추가 및 처리', async () => {
    const jobData = {
      jobId: 'test-job-1',
      files: [{ buffer: 'test', mimetype: 'application/pdf' }]
    };
    
    const job = await queueManager.addJob('ocr', 'process-files', jobData);
    
    expect(job.id).toBeDefined();
    expect(job.data).toEqual(jobData);
  });
  
  test('작업 상태 추적', async () => {
    const response = await request(app)
      .post('/api/ocr/upload')
      .attach('files', testPDF);
    
    const { jobId } = response.body;
    
    // 상태 조회
    const statusResponse = await request(app)
      .get(`/api/ocr/status/${jobId}`);
    
    expect(statusResponse.body.jobId).toBe(jobId);
    expect(['queued', 'processing', 'completed']).toContain(statusResponse.body.status);
  });
  
  test('작업 우선순위 처리', async () => {
    // 큰 파일 (낮은 우선순위)
    const largeFileJob = await queueManager.addJob('ocr', 'process-files', {
      jobId: 'large-job',
      files: [{ size: 100 * 1024 * 1024 }] // 100MB
    });
    
    // 작은 파일 (높은 우선순위)
    const smallFileJob = await queueManager.addJob('ocr', 'process-files', {
      jobId: 'small-job',
      files: [{ size: 1 * 1024 * 1024 }] // 1MB
    });
    
    // 작은 파일이 더 높은 우선순위를 가져야 함
    expect(smallFileJob.opts.priority).toBeGreaterThan(largeFileJob.opts.priority);
  });
});
```

### Week 7-8: 병렬 처리 최적화

#### 🎯 목표
- 파일 병렬 처리로 처리 시간 단축
- CPU 코어 활용 최적화
- 메모리 효율적인 병렬 처리 구현

#### 📋 상세 작업 계획

**Day 31-35: 병렬 처리 엔진 구현**
```javascript
// 작업 1: 병렬 처리 매니저
const pMap = require('p-map');
const os = require('os');

class ParallelProcessingManager {
  constructor() {
    this.maxConcurrency = Math.min(os.cpus().length, 8); // 최대 8개 동시 처리
    this.memoryThreshold = 0.8; // 메모리 사용률 80% 임계값
  }
  
  async processFilesInParallel(files, processor, options = {}) {
    const {
      concurrency = this.calculateOptimalConcurrency(files),
      batchSize = 4,
      memoryCheck = true
    } = options;
    
    // 파일을 배치로 분할
    const batches = this.createBatches(files, batchSize);
    const results = [];
    
    for (const batch of batches) {
      // 메모리 사용량 체크
      if (memoryCheck && this.isMemoryUsageHigh()) {
        await this.waitForMemoryRelease();
      }
      
      // 배치 내 파일들을 병렬 처리
      const batchResults = await pMap(batch, async (file, index) => {
        const startTime = Date.now();
        
        try {
          const result = await processor(file);
          
          // 처리 시간 메트릭 기록
          metricsCollector.recordProcessingTime(
            file.mimetype,
            file.size,
            Date.now() - startTime
          );
          
          return {
            filename: file.originalname,
            result,
            processingTime: Date.now() - startTime
          };
          
        } catch (error) {
          logger.logError(error, {
            filename: file.originalname,
            operation: 'parallel-processing'
          });
          
          return {
            filename: file.originalname,
            error: error.message,
            processingTime: Date.now() - startTime
          };
        }
      }, { concurrency });
      
      results.push(...batchResults);
      
      // 배치 간 짧은 대기 (메모리 정리 시간)
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(100);
      }
    }
    
    return results;
  }
  
  calculateOptimalConcurrency(files) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const avgFileSize = totalSize / files.length;
    const sizeMB = avgFileSize / (1024 * 1024);
    
    // 파일 크기에 따른 동시 처리 수 조정
    if (sizeMB > 50) return 2;      // 큰 파일: 2개
    if (sizeMB > 10) return 4;      // 중간 파일: 4개
    return Math.min(8, this.maxConcurrency); // 작은 파일: 최대 8개
  }
  
  createBatches(files, batchSize) {
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }
  
  isMemoryUsageHigh() {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usageRatio = memUsage.heapUsed / totalMemory;
    
    return usageRatio > this.memoryThreshold;
  }
  
  async waitForMemoryRelease() {
    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }
    
    // 메모리 사용률이 임계값 이하로 떨어질 때까지 대기
    while (this.isMemoryUsageHigh()) {
      await this.sleep(1000);
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Day 36-38: OCR 서비스 병렬 처리 적용**
```javascript
// 작업 2: OCR 서비스 병렬 처리 개선
class OptimizedVisionService {
  constructor() {
    this.parallelManager = new ParallelProcessingManager();
    this.client = new vision.ImageAnnotatorClient();
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 600, // Google Vision API 제한: 600 requests/minute
      interval: 'minute'
    });
  }
  
  async processMultipleDocuments(files) {
    return await this.parallelManager.processFilesInParallel(
      files,
      (file) => this.processDocumentWithRateLimit(file),
      {
        concurrency: this.calculateConcurrency(files),
        batchSize: 4,
        memoryCheck: true
      }
    );
  }
  
  async processDocumentWithRateLimit(file) {
    // 속도 제한 적용
    await this.rateLimiter.removeTokens(1);
    
    // 파일 크기에 따른 처리 방식 선택
    if (file.size > 50 * 1024 * 1024) { // 50MB 이상
      return await this.processLargeDocument(file);
    } else {
      return await this.processStandardDocument(file);
    }
  }
  
  async processLargeDocument(file) {
    // 대용량 파일을 청크로 분할 처리
    const chunks = await this.splitFileIntoChunks(file);
    
    const chunkResults = await pMap(chunks, async (chunk) => {
      return await this.processDocumentChunk(chunk);
    }, { concurrency: 2 }); // 대용량 파일은 동시 처리 수 제한
    
    // 청크 결과 병합
    return this.mergeChunkResults(chunkResults);
  }
  
  async processStandardDocument(file) {
    // 기존 처리 방식 유지
    const [result] = await this.client.textDetection({
      image: { content: file.buffer },
      imageContext: {
        languageHints: ['ko', 'en']
      }
    });
    
    return this.extractTextFromResult(result);
  }
  
  calculateConcurrency(files) {
    const totalFiles = files.length;
    const avgSize = files.reduce((sum, f) => sum + f.size, 0) / totalFiles;
    const sizeMB = avgSize / (1024 * 1024);
    
    // API 제한과 메모리를 고려한 동시 처리 수 계산
    if (sizeMB > 20) return 2;
    if (sizeMB > 5) return 4;
    return Math.min(6, totalFiles); // 최대 6개 동시 처리
  }
}
```

**Day 39-42: 룰 처리 병렬화**
```javascript
// 작업 3: 룰 처리 병렬화
class ParallelRuleProcessor {
  constructor() {
    this.parallelManager = new ParallelProcessingManager();
    this.workerPool = new WorkerPool({
      filename: path.join(__dirname, 'rule-worker.js'),
      minWorkers: 2,
      maxWorkers: os.cpus().length
    });
  }
  
  async processEventsInParallel(events, rules) {
    // 이벤트를 청크로 분할
    const chunks = this.createEventChunks(events, 100); // 100개씩 청크
    
    // 각 청크를 워커에서 병렬 처리
    const results = await pMap(chunks, async (chunk) => {
      return await this.workerPool.exec('processEventChunk', [chunk, rules]);
    }, { concurrency: this.workerPool.maxWorkers });
    
    // 결과 병합
    return this.mergeResults(results);
  }
  
  createEventChunks(events, chunkSize) {
    const chunks = [];
    for (let i = 0; i < events.length; i += chunkSize) {
      chunks.push(events.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  mergeResults(results) {
    return results.reduce((merged, result) => {
      merged.filtered.push(...result.filtered);
      merged.excluded.push(...result.excluded);
      merged.statistics = this.mergeStatistics(merged.statistics, result.statistics);
      return merged;
    }, {
      filtered: [],
      excluded: [],
      statistics: { total: 0, filtered: 0, excluded: 0 }
    });
  }
}

// rule-worker.js (별도 파일)
const { parentPort } = require('worker_threads');

parentPort.on('message', ({ method, args, id }) => {
  try {
    let result;
    
    switch (method) {
      case 'processEventChunk':
        result = processEventChunk(...args);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});

function processEventChunk(events, rules) {
  const filtered = [];
  const excluded = [];
  
  for (const event of events) {
    if (applyRules(event, rules)) {
      filtered.push(event);
    } else {
      excluded.push(event);
    }
  }
  
  return {
    filtered,
    excluded,
    statistics: {
      total: events.length,
      filtered: filtered.length,
      excluded: excluded.length
    }
  };
}
```

#### 🧪 테스트 계획
```javascript
describe('Parallel Processing', () => {
  test('병렬 처리 성능 개선 확인', async () => {
    const files = Array(10).fill().map((_, i) => ({
      originalname: `test${i}.pdf`,
      buffer: Buffer.from(`test content ${i}`),
      size: 1024 * 1024 // 1MB
    }));
    
    // 순차 처리 시간 측정
    const sequentialStart = Date.now();
    for (const file of files) {
      await mockProcessor(file);
    }
    const sequentialTime = Date.now() - sequentialStart;
    
    // 병렬 처리 시간 측정
    const parallelStart = Date.now();
    await parallelManager.processFilesInParallel(files, mockProcessor);
    const parallelTime = Date.now() - parallelStart;
    
    // 병렬 처리가 더 빨라야 함
    expect(parallelTime).toBeLessThan(sequentialTime * 0.7);
  });
  
  test('메모리 사용량 제어', async () => {
    const largeFiles = Array(20).fill().map((_, i) => ({
      originalname: `large${i}.pdf`,
      buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
      size: 10 * 1024 * 1024
    }));
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    await parallelManager.processFilesInParallel(largeFiles, mockProcessor, {
      memoryCheck: true
    });
    
    // 가비지 컬렉션 후 메모리 확인
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 메모리 증가량이 제한적이어야 함
    expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB 미만
  });
});
```

### Week 9-10: 메모리 및 리소스 최적화

#### 🎯 목표
- 메모리 사용량 최적화
- 가비지 컬렉션 튜닝
- 리소스 풀링 구현

#### 📋 상세 작업 계획

**Day 43-47: 메모리 최적화**
```javascript
// 작업 1: 스트리밍 기반 파일 처리
const stream = require('stream');
const { pipeline } = require('stream/promises');

class StreamingFileProcessor extends stream.Transform {
  constructor(options) {
    super({ objectMode: true });
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB 청크
    this.maxBufferSize = options.maxBufferSize || 10 * 1024 * 1024; // 10MB
  }
  
  async _transform(file, encoding, callback) {
    try {
      if (file.size > this.maxBufferSize) {
        // 대용량 파일은 스트리밍 처리
        const result = await this.processFileStream(file);
        callback(null, result);
      } else {
        // 소용량 파일은 기존 방식
        const result = await this.processFileBuffer(file);
        callback(null, result);
      }
    } catch (error) {
      callback(error);
    }
  }
  
  async processFileStream(file) {
    const chunks = [];
    const readable = new stream.Readable({
      read() {
        // 파일을 청크로 읽기
        const chunk = file.buffer.slice(
          chunks.length * this.chunkSize,
          (chunks.length + 1) * this.chunkSize
        );
        
        if (chunk.length === 0) {
          this.push(null); // 스트림 종료
        } else {
          this.push(chunk);
        }
      }
    });
    
    const processedChunks = [];
    
    await pipeline(
      readable,
      new stream.Transform({
        transform(chunk, encoding, callback) {
          // 청크별 처리 로직
          const processed = this.processChunk(chunk);
          processedChunks.push(processed);
          callback();
        }
      })
    );
    
    // 청크 결과 병합
    return this.mergeChunks(processedChunks);
  }
}

// 작업 2: 메모리 풀 관리
class MemoryPool {
  constructor(options = {}) {
    this.maxPoolSize = options.maxPoolSize || 100 * 1024 * 1024; // 100MB
    this.bufferPool = [];
    this.inUse = new Set();
    this.gcThreshold = 0.8; // 80% 메모리 사용 시 GC 실행
  }
  
  getBuffer(size) {
    // 풀에서 적절한 크기의 버퍼 찾기
    const bufferIndex = this.bufferPool.findIndex(
      buffer => buffer.length >= size && !this.inUse.has(buffer)
    );
    
    if (bufferIndex !== -1) {
      const buffer = this.bufferPool[bufferIndex];
      this.inUse.add(buffer);
      return buffer.slice(0, size);
    }
    
    // 새 버퍼 생성
    const newBuffer = Buffer.allocUnsafe(size);
    this.inUse.add(newBuffer);
    return newBuffer;
  }
  
  releaseBuffer(buffer) {
    this.inUse.delete(buffer);
    
    // 풀 크기 제한 확인
    const totalPoolSize = this.bufferPool.reduce((sum, buf) => sum + buf.length, 0);
    
    if (totalPoolSize < this.maxPoolSize) {
      this.bufferPool.push(buffer);
    }
    
    // 메모리 사용량 체크 및 정리
    this.checkMemoryUsage();
  }
  
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const usageRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    if (usageRatio > this.gcThreshold) {
      this.cleanup();
    }
  }
  
  cleanup() {
    // 사용하지 않는 버퍼 정리
    this.bufferPool = this.bufferPool.filter(buffer => this.inUse.has(buffer));
    
    // 가비지 컬렉션 실행
    if (global.gc) {
      global.gc();
    }
  }
}
```

**Day 48-50: 리소스 풀링 구현**
```javascript
// 작업 3: 연결 풀 관리
class ConnectionPoolManager {
  constructor() {
    this.pools = new Map();
    this.setupPools();
  }
  
  setupPools() {
    // Google Vision API 클라이언트 풀
    this.pools.set('vision', {
      pool: [],
      maxSize: 10,
      currentSize: 0,
      createConnection: () => new vision.ImageAnnotatorClient(),
      validateConnection: (client) => client && typeof client.textDetection === 'function'
    });
    
    // 데이터베이스 연결 풀
    this.pools.set('database', {
      pool: [],
      maxSize: 20,
      currentSize: 0,
      createConnection: () => new DatabaseConnection(),
      validateConnection: (conn) => conn && conn.isConnected()
    });
  }
  
  async getConnection(poolName) {
    const poolConfig = this.pools.get(poolName);
    if (!poolConfig) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    // 사용 가능한 연결 찾기
    let connection = poolConfig.pool.pop();
    
    // 연결 유효성 검사
    if (connection && !poolConfig.validateConnection(connection)) {
      connection = null;
    }
    
    // 새 연결 생성 (필요한 경우)
    if (!connection && poolConfig.currentSize < poolConfig.maxSize) {
      connection = poolConfig.createConnection();
      poolConfig.currentSize++;
    }
    
    if (!connection) {
      throw new Error(`No available connections in pool ${poolName}`);
    }
    
    return connection;
  }
  
  releaseConnection(poolName, connection) {
    const poolConfig = this.pools.get(poolName);
    if (!poolConfig) return;
    
    if (poolConfig.validateConnection(connection)) {
      poolConfig.pool.push(connection);
    } else {
      poolConfig.currentSize--;
    }
  }
}
```

#### 🧪 테스트 계획
```javascript
describe('Memory Optimization', () => {
  test('스트리밍 처리 메모리 효율성', async () => {
    const largeFile = {
      buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
      size: 100 * 1024 * 1024
    };
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    const processor = new StreamingFileProcessor({
      chunkSize: 64 * 1024,
      maxBufferSize: 10 * 1024 * 1024
    });
    
    await processor.processFileStream(largeFile);
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // 메모리 증가량이 파일 크기보다 훨씬 작아야 함
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // 20MB 미만
  });
  
  test('메모리 풀 효율성', () => {
    const memoryPool = new MemoryPool();
    
    // 버퍼 할당 및 해제
    const buffer1 = memoryPool.getBuffer(1024);
    const buffer2 = memoryPool.getBuffer(2048);
    
    memoryPool.releaseBuffer(buffer1);
    memoryPool.releaseBuffer(buffer2);
    
    // 재사용 확인
    const buffer3 = memoryPool.getBuffer(1024);
    expect(buffer3.length).toBeGreaterThanOrEqual(1024);
  });
});
```

---

## 📅 Phase 3: 확장성 개선 (8주)

### Week 11-14: 마이크로서비스 아키텍처 도입

#### 🎯 목표
- 모놀리식 구조를 마이크로서비스로 분리
- 서비스 간 통신 최적화
- 독립적인 배포 및 확장 가능

#### 📋 상세 작업 계획

**Day 51-60: 서비스 분리 및 API 게이트웨이**
```javascript
// 작업 1: API 게이트웨이 구현
const express = require('express');
const httpProxy = require('http-proxy-middleware');

class APIGateway {
  constructor() {
    this.app = express();
    this.services = new Map();
    this.setupRoutes();
    this.setupMiddleware();
  }
  
  setupServices() {
    this.services.set('ocr', {
      url: process.env.OCR_SERVICE_URL || 'http://localhost:3001',
      healthCheck: '/health',
      timeout: 30000
    });
    
    this.services.set('rules', {
      url: process.env.RULES_SERVICE_URL || 'http://localhost:3002',
      healthCheck: '/health',
      timeout: 15000
    });
    
    this.services.set('ai', {
      url: process.env.AI_SERVICE_URL || 'http://localhost:3003',
      healthCheck: '/health',
      timeout: 60000
    });
  }
  
  setupRoutes() {
    // OCR 서비스 라우팅
    this.app.use('/api/ocr', httpProxy({
      target: this.services.get('ocr').url,
      changeOrigin: true,
      timeout: this.services.get('ocr').timeout,
      onError: this.handleProxyError.bind(this)
    }));
    
    // 룰 처리 서비스 라우팅
    this.app.use('/api/rules', httpProxy({
      target: this.services.get('rules').url,
      changeOrigin: true,
      timeout: this.services.get('rules').timeout,
      onError: this.handleProxyError.bind(this)
    }));
    
    // AI 서비스 라우팅
    this.app.use('/api/ai', httpProxy({
      target: this.services.get('ai').url,
      changeOrigin: true,
      timeout: this.services.get('ai').timeout,
      onError: this.handleProxyError.bind(this)
    }));
  }
  
  setupMiddleware() {
    // 로드 밸런싱
    this.app.use(this.loadBalancer.bind(this));
    
    // 서킷 브레이커
    this.app.use(this.circuitBreaker.bind(this));
    
    // 요청 추적
    this.app.use(this.requestTracing.bind(this));
  }
  
  handleProxyError(err, req, res) {
    logger.logError(err, {
      url: req.url,
      method: req.method,
      operation: 'api-gateway-proxy'
    });
    
    res.status(503).json({
      error: '서비스를 일시적으로 사용할 수 없습니다.',
      retryAfter: 30
    });
  }
}

// 작업 2: OCR 마이크로서비스
class OCRMicroservice {
  constructor() {
    this.app = express();
    this.setupRoutes();
    this.setupHealthCheck();
  }
  
  setupRoutes() {
    this.app.post('/upload', this.uploadHandler.bind(this));
    this.app.get('/status/:jobId', this.statusHandler.bind(this));
    this.app.get('/result/:jobId', this.resultHandler.bind(this));
  }
  
  setupHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'ocr',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.SERVICE_VERSION || '1.0.0'
      });
    });
  }
  
  async uploadHandler(req, res) {
    // OCR 처리 로직 (기존 코드 유지)
    // ...
  }
}
```

**Day 61-70: 서비스 간 통신 최적화**
```javascript
// 작업 3: 이벤트 기반 통신
const EventEmitter = require('events');

class ServiceCommunicator extends EventEmitter {
  constructor() {
    super();
    this.messageQueue = new MessageQueue();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // OCR 완료 이벤트
    this.on('ocr.completed', async (data) => {
      await this.messageQueue.publish('rules.process', {
        jobId: data.jobId,
        ocrResult: data.result,
        timestamp: new Date().toISOString()
      });
    });
    
    // 룰 처리 완료 이벤트
    this.on('rules.completed', async (data) => {
      await this.messageQueue.publish('ai.generate', {
        jobId: data.jobId,
        processedData: data.result,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  async publishEvent(eventName, data) {
    this.emit(eventName, data);
    
    // 외부 서비스에도 이벤트 전송
    await this.messageQueue.publish(eventName, data);
  }
}

// 작업 4: 분산 트레이싱
class DistributedTracing {
  constructor() {
    this.traces = new Map();
  }
  
  startTrace(traceId, operation) {
    this.traces.set(traceId, {
      traceId,
      operation,
      startTime: Date.now(),
      spans: []
    });
  }
  
  addSpan(traceId, spanName, service, startTime, endTime) {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push({
        spanName,
        service,
        startTime,
        endTime,
        duration: endTime - startTime
      });
    }
  }
  
  endTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.totalDuration = trace.endTime - trace.startTime;
      
      // 트레이스 데이터 저장/전송
      this.saveTrace(trace);
      this.traces.delete(traceId);
    }
  }
}
```

### Week 15-18: 데이터베이스 최적화 및 확장

#### 🎯 목표
- 데이터베이스 성능 최적화
- 읽기 전용 복제본 구성
- 데이터 파티셔닝 구현

#### 📋 상세 작업 계획

**Day 71-84: 데이터베이스 최적화**
```javascript
// 작업 1: 데이터베이스 최적화
class OptimizedDatabase {
  constructor() {
    this.masterDB = new DatabaseConnection(process.env.MASTER_DB_URL);
    this.readReplicas = [
      new DatabaseConnection(process.env.READ_REPLICA_1_URL),
      new DatabaseConnection(process.env.READ_REPLICA_2_URL)
    ];
    this.currentReplicaIndex = 0;
  }
  
  async query(sql, params, options = {}) {
    const { readOnly = false, timeout = 5000 } = options;
    
    if (readOnly) {
      return await this.executeReadQuery(sql, params, timeout);
    } else {
      return await this.executeWriteQuery(sql, params, timeout);
    }
  }
  
  async executeReadQuery(sql, params, timeout) {
    // 읽기 전용 쿼리는 복제본에서 실행
    const replica = this.getNextReplica();
    
    try {
      return await Promise.race([
        replica.query(sql, params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        )
      ]);
    } catch (error) {
      // 복제본 실패 시 마스터에서 재시도
      logger.logError(error, { operation: 'read-replica-query' });
      return await this.masterDB.query(sql, params);
    }
  }
  
  async executeWriteQuery(sql, params, timeout) {
    // 쓰기 쿼리는 마스터에서만 실행
    return await Promise.race([
      this.masterDB.query(sql, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      )
    ]);
  }
  
  getNextReplica() {
    const replica = this.readReplicas[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.readReplicas.length;
    return replica;
  }
}
```

---

## 🧪 통합 테스트 전략

### 테스트 레벨별 전략

#### 1. 단위 테스트 (Unit Tests)
```javascript
// 각 모듈별 단위 테스트
describe('Unit Tests', () => {
  describe('ErrorClassifier', () => {
    test('에러 타입 분류 정확성', () => {
      // 테스트 코드
    });
  });
  
  describe('CacheService', () => {
    test('캐시 저장/조회 기능', () => {
      // 테스트 코드
    });
  });
  
  describe('ParallelProcessingManager', () => {
    test('병렬 처리 성능', () => {
      // 테스트 코드
    });
  });
});
```

#### 2. 통합 테스트 (Integration Tests)
```javascript
describe('Integration Tests', () => {
  test('OCR → 룰 처리 → AI 처리 파이프라인', async () => {
    // 전체 파이프라인 테스트
  });
  
  test('캐싱 시스템 통합', async () => {
    // 캐시와 각 모듈 간 통합 테스트
  });
  
  test('에러 처리 및 복구', async () => {
    // 장애 상황 시뮬레이션 및 복구 테스트
  });
});
```

#### 3. 성능 테스트 (Performance Tests)
```javascript
describe('Performance Tests', () => {
  test('동시 요청 처리 성능', async () => {
    // 부하 테스트
  });
  
  test('메모리 사용량 안정성', async () => {
    // 메모리 리크 테스트
  });
  
  test('응답 시간 개선 확인', async () => {
    // 성능 개선 효과 측정
  });
});
```

---

## 📊 배포 및 모니터링 전략

### 배포 전략

#### 1. 블루-그린 배포
```bash
# 블루-그린 배포 스크립트
#!/bin/bash

CURRENT_ENV=$(kubectl get service vnexsus-service -o jsonpath='{.spec.selector.version}')
NEW_ENV=$([ "$CURRENT_ENV" = "blue" ] && echo "green" || echo "blue")

echo "현재 환경: $CURRENT_ENV"
echo "새 환경: $NEW_ENV"

# 새 환경에 배포
kubectl apply -f k8s/deployment-$NEW_ENV.yaml

# 헬스 체크
kubectl wait --for=condition=ready pod -l version=$NEW_ENV --timeout=300s

# 트래픽 전환
kubectl patch service vnexsus-service -p '{"spec":{"selector":{"version":"'$NEW_ENV'"}}}'

echo "배포 완료: $NEW_ENV"
```

#### 2. 카나리 배포
```yaml
# 카나리 배포 설정
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: vnexsus-rollout
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - setWeight: 30
      - pause: {duration: 10m}
      - setWeight: 50
      - pause: {duration: 15m}
      - setWeight: 100
  selector:
    matchLabels:
      app: vnexsus
  template:
    # Pod 템플릿
```

### 모니터링 및 알림

#### 1. 핵심 지표 모니터링
```javascript
// 모니터링 대시보드 설정
const monitoringConfig = {
  metrics: [
    {
      name: 'request_rate',
      query: 'rate(http_requests_total[5m])',
      threshold: { warning: 100, critical: 200 }
    },
    {
      name: 'error_rate',
      query: 'rate(http_requests_total{status=~"5.."}[5m])',
      threshold: { warning: 0.01, critical: 0.05 }
    },
    {
      name: 'response_time_p95',
      query: 'histogram_quantile(0.95, http_request_duration_seconds_bucket)',
      threshold: { warning: 2, critical: 5 }
    },
    {
      name: 'memory_usage',
      query: 'process_resident_memory_bytes / 1024 / 1024',
      threshold: { warning: 1000, critical: 2000 }
    }
  ],
  alerts: [
    {
      name: 'HighErrorRate',
      condition: 'error_rate > 0.05',
      duration: '5m',
      severity: 'critical',
      channels: ['email', 'slack']
    }
  ]
};
```

---

## 📈 성공 지표 및 KPI

### 성능 지표
- **응답 시간**: 95th percentile < 2초
- **처리량**: 초당 100개 요청 처리
- **에러율**: < 0.1%
- **가용성**: 99.9% 업타임

### 비즈니스 지표
- **사용자 만족도**: 4.5/5.0 이상
- **처리 정확도**: 95% 이상
- **비용 효율성**: 30% 비용 절감

---

## 🔄 지속적 개선 계획

### 월별 개선 계획
- **Month 1-3**: 안정성 및 성능 모니터링
- **Month 4-6**: 사용자 피드백 기반 기능 개선
- **Month 7-9**: 새로운 기술 스택 도입 검토
- **Month 10-12**: 차세대 아키텍처 설계

### 기술 부채 관리
- 주간 코드 리뷰 및 리팩토링
- 월간 아키텍처 검토
- 분기별 기술 스택 업데이트

---

## 📝 결론

본 개발 계획은 VNEXSUS 시스템의 안전하고 체계적인 개선을 위한 로드맵을 제시합니다. 각 Phase별로 점진적인 개선을 통해 기존 기능의 호환성을 보장하면서 성능과 안정성을 크게 향상시킬 수 있습니다.

핵심 성공 요인:
1. **점진적 개선**: 한 번에 모든 것을 바꾸지 않고 단계별로 개선
2. **철저한 테스트**: 각 단계마다 포괄적인 테스트 실행
3. **모니터링**: 실시간 모니터링을 통한 문제 조기 발견
4. **롤백 준비**: 문제 발생 시 즉시 이전 상태로 복구 가능

이 계획을 통해 VNEXSUS는 더욱 안정적이고 확장 가능한 시스템으로 발전할 수 있을 것입니다.