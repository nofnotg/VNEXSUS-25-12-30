/**
 * Progressive RAG 통합 테스트 도구
 * 
 * 전체 시스템 통합 테스트, 성능 검증, 안정성 테스트
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 테스트 케이스 관리자
 */
class TestCaseManager {
  constructor() {
    this.testCases = new Map();
    this.testSuites = new Map();
    this.results = [];
  }

  /**
   * 테스트 케이스 등록
   */
  registerTestCase(name, testFunction, options = {}) {
    this.testCases.set(name, {
      name,
      testFunction,
      timeout: options.timeout || 30000,
      retries: options.retries || 0,
      tags: options.tags || [],
      description: options.description || '',
      priority: options.priority || 'normal'
    });
  }

  /**
   * 테스트 스위트 등록
   */
  registerTestSuite(suiteName, testCases) {
    this.testSuites.set(suiteName, testCases);
  }

  /**
   * 단일 테스트 실행
   */
  async runTestCase(testCase, context = {}) {
    const startTime = performance.now();
    let attempt = 0;
    let lastError = null;

    while (attempt <= testCase.retries) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('테스트 타임아웃')), testCase.timeout);
        });

        const result = await Promise.race([
          testCase.testFunction(context),
          timeoutPromise
        ]);

        const endTime = performance.now();
        const duration = endTime - startTime;

        return {
          name: testCase.name,
          status: 'passed',
          duration,
          attempt: attempt + 1,
          result,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= testCase.retries) {
          console.log(`테스트 재시도 [${testCase.name}] - 시도 ${attempt + 1}/${testCase.retries + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      name: testCase.name,
      status: 'failed',
      duration,
      attempt,
      error: lastError.message,
      stack: lastError.stack,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 테스트 스위트 실행
   */
  async runTestSuite(suiteName, context = {}) {
    const testCaseNames = this.testSuites.get(suiteName);
    if (!testCaseNames) {
      throw new Error(`테스트 스위트를 찾을 수 없음: ${suiteName}`);
    }

    const suiteResults = {
      suiteName,
      startTime: new Date().toISOString(),
      results: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    console.log(`🧪 테스트 스위트 시작: ${suiteName}`);

    for (const testCaseName of testCaseNames) {
      const testCase = this.testCases.get(testCaseName);
      if (!testCase) {
        console.warn(`테스트 케이스를 찾을 수 없음: ${testCaseName}`);
        continue;
      }

      console.log(`  ▶️ ${testCase.name} 실행 중...`);
      const result = await this.runTestCase(testCase, context);
      
      suiteResults.results.push(result);
      suiteResults.summary.total++;
      
      if (result.status === 'passed') {
        suiteResults.summary.passed++;
        console.log(`  ✅ ${testCase.name} - ${result.duration.toFixed(2)}ms`);
      } else {
        suiteResults.summary.failed++;
        console.log(`  ❌ ${testCase.name} - ${result.error}`);
      }
    }

    suiteResults.endTime = new Date().toISOString();
    this.results.push(suiteResults);

    console.log(`📊 스위트 완료: ${suiteResults.summary.passed}/${suiteResults.summary.total} 통과`);
    return suiteResults;
  }

  /**
   * 모든 테스트 실행
   */
  async runAllTests(context = {}) {
    const allResults = [];
    
    for (const suiteName of this.testSuites.keys()) {
      const suiteResult = await this.runTestSuite(suiteName, context);
      allResults.push(suiteResult);
    }

    return allResults;
  }
}

/**
 * Progressive RAG 통합 테스터
 */
export class ProgressiveRAGIntegrationTester {
  constructor(ragSystem, config = {}) {
    this.ragSystem = ragSystem;
    this.config = {
      outputDir: config.outputDir || path.join(__dirname, '../data/test-results'),
      enablePerformanceTests: config.enablePerformanceTests !== false,
      enableStressTests: config.enableStressTests !== false,
      enableCompatibilityTests: config.enableCompatibilityTests !== false,
      testDataSize: config.testDataSize || 50,
      ...config
    };

    this.testManager = new TestCaseManager();
    this.testData = [];
    this.setupTestCases();
  }

  /**
   * 테스트 케이스 설정
   */
  setupTestCases() {
    // 기본 기능 테스트
    this.testManager.registerTestCase('system_initialization', this.testSystemInitialization.bind(this), {
      description: '시스템 초기화 테스트',
      priority: 'high',
      tags: ['basic', 'initialization']
    });

    this.testManager.registerTestCase('embedding_service', this.testEmbeddingService.bind(this), {
      description: '임베딩 서비스 테스트',
      priority: 'high',
      tags: ['basic', 'embedding']
    });

    this.testManager.registerTestCase('vector_database', this.testVectorDatabase.bind(this), {
      description: '벡터 데이터베이스 테스트',
      priority: 'high',
      tags: ['basic', 'database']
    });

    this.testManager.registerTestCase('cache_manager', this.testCacheManager.bind(this), {
      description: '캐시 매니저 테스트',
      priority: 'high',
      tags: ['basic', 'cache']
    });

    this.testManager.registerTestCase('auto_save_manager', this.testAutoSaveManager.bind(this), {
      description: '자동 저장 매니저 테스트',
      priority: 'high',
      tags: ['basic', 'autosave']
    });

    // 통합 기능 테스트
    this.testManager.registerTestCase('medical_term_search', this.testMedicalTermSearch.bind(this), {
      description: '의료 용어 검색 테스트',
      priority: 'high',
      tags: ['integration', 'search']
    });

    this.testManager.registerTestCase('icd_code_search', this.testICDCodeSearch.bind(this), {
      description: 'ICD 코드 검색 테스트',
      priority: 'high',
      tags: ['integration', 'search']
    });

    this.testManager.registerTestCase('end_to_end_workflow', this.testEndToEndWorkflow.bind(this), {
      description: '엔드투엔드 워크플로우 테스트',
      priority: 'high',
      tags: ['integration', 'e2e']
    });

    // 성능 테스트
    if (this.config.enablePerformanceTests) {
      this.testManager.registerTestCase('performance_embedding', this.testPerformanceEmbedding.bind(this), {
        description: '임베딩 성능 테스트',
        priority: 'medium',
        tags: ['performance'],
        timeout: 60000
      });

      this.testManager.registerTestCase('performance_search', this.testPerformanceSearch.bind(this), {
        description: '검색 성능 테스트',
        priority: 'medium',
        tags: ['performance'],
        timeout: 60000
      });
    }

    // 스트레스 테스트
    if (this.config.enableStressTests) {
      this.testManager.registerTestCase('stress_concurrent_requests', this.testStressConcurrentRequests.bind(this), {
        description: '동시 요청 스트레스 테스트',
        priority: 'low',
        tags: ['stress'],
        timeout: 120000
      });

      this.testManager.registerTestCase('stress_memory_usage', this.testStressMemoryUsage.bind(this), {
        description: '메모리 사용량 스트레스 테스트',
        priority: 'low',
        tags: ['stress'],
        timeout: 120000
      });
    }

    // 테스트 스위트 등록
    this.testManager.registerTestSuite('basic', [
      'system_initialization',
      'embedding_service',
      'vector_database',
      'cache_manager',
      'auto_save_manager'
    ]);

    this.testManager.registerTestSuite('integration', [
      'medical_term_search',
      'icd_code_search',
      'end_to_end_workflow'
    ]);

    if (this.config.enablePerformanceTests) {
      this.testManager.registerTestSuite('performance', [
        'performance_embedding',
        'performance_search'
      ]);
    }

    if (this.config.enableStressTests) {
      this.testManager.registerTestSuite('stress', [
        'stress_concurrent_requests',
        'stress_memory_usage'
      ]);
    }
  }

  /**
   * 테스트 데이터 생성
   */
  async generateTestData() {
    this.testData = {
      medicalTerms: [
        '고혈압', '당뇨병', '심근경색', '뇌졸중', '폐렴',
        '천식', '관절염', '위염', '간염', '신부전'
      ],
      icdCodes: [
        'I10', 'E11', 'I21', 'I63', 'J18',
        'J45', 'M79', 'K29', 'B19', 'N18'
      ],
      analysisResults: Array.from({ length: 10 }, (_, i) => ({
        id: `test_analysis_${i}`,
        query: `테스트 쿼리 ${i}`,
        result: { confidence: 0.9, category: 'test' }
      }))
    };

    console.log('📊 테스트 데이터 생성 완료');
  }

  // === 기본 기능 테스트 ===

  /**
   * 시스템 초기화 테스트
   */
  async testSystemInitialization() {
    // RAG 시스템이 올바르게 초기화되었는지 확인
    if (!this.ragSystem) {
      throw new Error('RAG 시스템이 초기화되지 않음');
    }

    // 필수 컴포넌트 확인
    const requiredComponents = [
      'embeddingService',
      'vectorDatabase',
      'cacheManager',
      'autoSaveManager'
    ];

    for (const component of requiredComponents) {
      if (!this.ragSystem[component]) {
        throw new Error(`필수 컴포넌트 누락: ${component}`);
      }
    }

    return { status: 'initialized', components: requiredComponents };
  }

  /**
   * 임베딩 서비스 테스트
   */
  async testEmbeddingService() {
    const testText = '고혈압 치료';
    
    // 임베딩 생성
    const embedding = await this.ragSystem.embeddingService.getEmbedding(testText);
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('임베딩 생성 실패');
    }

    // 배치 임베딩 테스트
    const batchTexts = ['당뇨병', '심근경색', '뇌졸중'];
    const batchEmbeddings = await this.ragSystem.embeddingService.getBatchEmbeddings(batchTexts);
    
    if (!Array.isArray(batchEmbeddings) || batchEmbeddings.length !== batchTexts.length) {
      throw new Error('배치 임베딩 생성 실패');
    }

    return {
      singleEmbedding: { length: embedding.length },
      batchEmbeddings: { count: batchEmbeddings.length }
    };
  }

  /**
   * 벡터 데이터베이스 테스트
   */
  async testVectorDatabase() {
    const testVector = {
      id: 'test_vector_1',
      vector: Array.from({ length: 100 }, () => Math.random()),
      metadata: { text: '테스트 벡터', category: 'test' }
    };

    // 벡터 삽입
    await this.ragSystem.vectorDatabase.upsert([testVector]);

    // 벡터 검색
    const searchResults = await this.ragSystem.vectorDatabase.query(testVector.vector, 5);
    
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      throw new Error('벡터 검색 실패');
    }

    // 벡터 삭제
    await this.ragSystem.vectorDatabase.delete(['test_vector_1']);

    return {
      upsert: 'success',
      query: { resultCount: searchResults.length },
      delete: 'success'
    };
  }

  /**
   * 캐시 매니저 테스트
   */
  async testCacheManager() {
    const testKey = 'test_cache_key';
    const testValue = { data: 'test_data', timestamp: Date.now() };

    // 캐시 저장
    await this.ragSystem.cacheManager.set(testKey, testValue);

    // 캐시 조회
    const cachedValue = await this.ragSystem.cacheManager.get(testKey);
    
    if (!cachedValue || cachedValue.data !== testValue.data) {
      throw new Error('캐시 저장/조회 실패');
    }

    // 캐시 삭제
    await this.ragSystem.cacheManager.delete(testKey);
    
    const deletedValue = await this.ragSystem.cacheManager.get(testKey);
    if (deletedValue !== null) {
      throw new Error('캐시 삭제 실패');
    }

    return {
      set: 'success',
      get: 'success',
      delete: 'success'
    };
  }

  /**
   * 자동 저장 매니저 테스트
   */
  async testAutoSaveManager() {
    const testId = 'test_analysis_1';
    const testResult = {
      query: '테스트 쿼리',
      result: { confidence: 0.95, category: 'test' }
    };

    // 분석 결과 저장
    await this.ragSystem.autoSaveManager.saveAnalysisResult(testId, testResult);

    // 분석 결과 조회
    const savedResult = await this.ragSystem.autoSaveManager.getAnalysisResult(testId);
    
    if (!savedResult || savedResult.query !== testResult.query) {
      throw new Error('분석 결과 저장/조회 실패');
    }

    // 중복 분석 확인
    const isDuplicate = await this.ragSystem.autoSaveManager.isDuplicateAnalysis(testResult.query);
    if (!isDuplicate) {
      throw new Error('중복 분석 감지 실패');
    }

    return {
      save: 'success',
      get: 'success',
      duplicateCheck: 'success'
    };
  }

  // === 통합 기능 테스트 ===

  /**
   * 의료 용어 검색 테스트
   */
  async testMedicalTermSearch() {
    const testTerms = this.testData.medicalTerms.slice(0, 3);
    const results = [];

    for (const term of testTerms) {
      const searchResult = await this.ragSystem.searchMedicalTerms(term);
      results.push({ term, resultCount: searchResult?.length || 0 });
    }

    if (results.length === 0) {
      throw new Error('의료 용어 검색 결과 없음');
    }

    return { searchResults: results };
  }

  /**
   * ICD 코드 검색 테스트
   */
  async testICDCodeSearch() {
    const testCodes = this.testData.icdCodes.slice(0, 3);
    const results = [];

    for (const code of testCodes) {
      const searchResult = await this.ragSystem.searchICDCodes(code);
      results.push({ code, resultCount: searchResult?.length || 0 });
    }

    if (results.length === 0) {
      throw new Error('ICD 코드 검색 결과 없음');
    }

    return { searchResults: results };
  }

  /**
   * 엔드투엔드 워크플로우 테스트
   */
  async testEndToEndWorkflow() {
    const testQuery = '고혈압 진단';
    const workflowSteps = [];

    // 1. 임베딩 생성
    const startTime = performance.now();
    const embedding = await this.ragSystem.embeddingService.getEmbedding(testQuery);
    workflowSteps.push({ step: 'embedding', duration: performance.now() - startTime });

    // 2. 벡터 검색
    const searchStart = performance.now();
    const searchResults = await this.ragSystem.vectorDatabase.query(embedding, 5);
    workflowSteps.push({ step: 'search', duration: performance.now() - searchStart });

    // 3. 결과 저장
    const saveStart = performance.now();
    const analysisId = `e2e_test_${Date.now()}`;
    await this.ragSystem.autoSaveManager.saveAnalysisResult(analysisId, {
      query: testQuery,
      results: searchResults
    });
    workflowSteps.push({ step: 'save', duration: performance.now() - saveStart });

    // 4. 결과 조회
    const retrieveStart = performance.now();
    const savedResult = await this.ragSystem.autoSaveManager.getAnalysisResult(analysisId);
    workflowSteps.push({ step: 'retrieve', duration: performance.now() - retrieveStart });

    const totalDuration = workflowSteps.reduce((sum, step) => sum + step.duration, 0);

    return {
      totalDuration,
      steps: workflowSteps,
      success: savedResult !== null
    };
  }

  // === 성능 테스트 ===

  /**
   * 임베딩 성능 테스트
   */
  async testPerformanceEmbedding() {
    const testTexts = this.testData.medicalTerms;
    const iterations = 10;
    const durations = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      for (const text of testTexts) {
        await this.ragSystem.embeddingService.getEmbedding(text);
      }
      
      durations.push(performance.now() - startTime);
    }

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const avgPerText = avgDuration / testTexts.length;

    return {
      iterations,
      textCount: testTexts.length,
      avgTotalDuration: avgDuration,
      avgPerText,
      throughput: 1000 / avgPerText // texts per second
    };
  }

  /**
   * 검색 성능 테스트
   */
  async testPerformanceSearch() {
    const testQueries = this.testData.medicalTerms;
    const iterations = 5;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      
      for (const query of testQueries) {
        const queryStart = performance.now();
        await this.ragSystem.searchMedicalTerms(query);
        results.push(performance.now() - queryStart);
      }
    }

    const avgDuration = results.reduce((sum, d) => sum + d, 0) / results.length;

    return {
      iterations,
      queryCount: testQueries.length,
      totalQueries: results.length,
      avgDuration,
      throughput: 1000 / avgDuration
    };
  }

  // === 스트레스 테스트 ===

  /**
   * 동시 요청 스트레스 테스트
   */
  async testStressConcurrentRequests() {
    const concurrency = 10;
    const requestsPerWorker = 5;
    const testQuery = '당뇨병 치료';

    const workers = Array.from({ length: concurrency }, async (_, i) => {
      const workerResults = [];
      
      for (let j = 0; j < requestsPerWorker; j++) {
        const startTime = performance.now();
        try {
          await this.ragSystem.searchMedicalTerms(`${testQuery} ${i}-${j}`);
          workerResults.push({
            success: true,
            duration: performance.now() - startTime
          });
        } catch (error) {
          workerResults.push({
            success: false,
            duration: performance.now() - startTime,
            error: error.message
          });
        }
      }
      
      return workerResults;
    });

    const allResults = await Promise.all(workers);
    const flatResults = allResults.flat();
    
    const successCount = flatResults.filter(r => r.success).length;
    const avgDuration = flatResults.reduce((sum, r) => sum + r.duration, 0) / flatResults.length;

    return {
      concurrency,
      totalRequests: flatResults.length,
      successCount,
      failureCount: flatResults.length - successCount,
      successRate: (successCount / flatResults.length) * 100,
      avgDuration
    };
  }

  /**
   * 메모리 사용량 스트레스 테스트
   */
  async testStressMemoryUsage() {
    const initialMemory = process.memoryUsage();
    const iterations = 100;
    const memorySnapshots = [];

    for (let i = 0; i < iterations; i++) {
      // 대량 데이터 처리
      const largeText = this.testData.medicalTerms.join(' ').repeat(10);
      await this.ragSystem.embeddingService.getEmbedding(largeText);
      
      if (i % 10 === 0) {
        memorySnapshots.push({
          iteration: i,
          memory: process.memoryUsage()
        });
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    return {
      iterations,
      initialMemory: initialMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      memoryIncrease,
      memoryIncreasePercent: (memoryIncrease / initialMemory.heapUsed) * 100,
      snapshots: memorySnapshots
    };
  }

  /**
   * 전체 테스트 실행
   */
  async runFullTest() {
    console.log('🚀 Progressive RAG 통합 테스트 시작');

    // 출력 디렉토리 생성
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // 테스트 데이터 생성
    await this.generateTestData();

    // 테스트 컨텍스트 준비
    const context = {
      ragSystem: this.ragSystem,
      testData: this.testData,
      config: this.config
    };

    // 모든 테스트 실행
    const allResults = await this.testManager.runAllTests(context);

    // 결과 저장
    await this.saveTestResults(allResults);

    // 리포트 생성
    await this.generateTestReport(allResults);

    console.log('✅ 통합 테스트 완료');
    return allResults;
  }

  /**
   * 테스트 결과 저장
   */
  async saveTestResults(results) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(this.config.outputDir, `test_results_${timestamp}.json`);
      
      const testReport = {
        timestamp: new Date().toISOString(),
        config: this.config,
        results,
        summary: this.generateTestSummary(results)
      };

      fs.writeFileSync(filePath, JSON.stringify(testReport, null, 2));
      console.log(`💾 테스트 결과 저장: ${filePath}`);
      
    } catch (error) {
      console.error('테스트 결과 저장 오류:', error);
    }
  }

  /**
   * 테스트 요약 생성
   */
  generateTestSummary(results) {
    const summary = {
      totalSuites: results.length,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      overallSuccessRate: 0,
      suites: {}
    };

    for (const suiteResult of results) {
      summary.totalTests += suiteResult.summary.total;
      summary.totalPassed += suiteResult.summary.passed;
      summary.totalFailed += suiteResult.summary.failed;
      
      summary.suites[suiteResult.suiteName] = {
        passed: suiteResult.summary.passed,
        failed: suiteResult.summary.failed,
        total: suiteResult.summary.total,
        successRate: (suiteResult.summary.passed / suiteResult.summary.total) * 100
      };
    }

    summary.overallSuccessRate = (summary.totalPassed / summary.totalTests) * 100;

    return summary;
  }

  /**
   * 테스트 리포트 생성
   */
  async generateTestReport(results) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.config.outputDir, `test_report_${timestamp}.html`);
      
      const html = this.generateHTMLReport(results);
      fs.writeFileSync(reportPath, html);
      
      console.log(`📊 테스트 리포트 생성: ${reportPath}`);
      
    } catch (error) {
      console.error('테스트 리포트 생성 오류:', error);
    }
  }

  /**
   * HTML 리포트 생성
   */
  generateHTMLReport(results) {
    const summary = this.generateTestSummary(results);
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Progressive RAG 통합 테스트 리포트</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { padding: 15px; background: #f9f9f9; border-radius: 8px; text-align: center; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-case { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Progressive RAG 통합 테스트 리포트</h1>
        <p><strong>생성 시간:</strong> ${new Date().toISOString()}</p>
        <p><strong>전체 성공률:</strong> ${summary.overallSuccessRate.toFixed(1)}%</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>총 테스트</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>통과</h3>
            <div style="font-size: 2em; font-weight: bold; color: #28a745;">${summary.totalPassed}</div>
        </div>
        <div class="metric">
            <h3>실패</h3>
            <div style="font-size: 2em; font-weight: bold; color: #dc3545;">${summary.totalFailed}</div>
        </div>
        <div class="metric">
            <h3>스위트</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.totalSuites}</div>
        </div>
    </div>

    ${results.map(suiteResult => `
    <div class="suite">
        <h2>${suiteResult.suiteName} 스위트</h2>
        <p>성공률: ${((suiteResult.summary.passed / suiteResult.summary.total) * 100).toFixed(1)}% 
           (${suiteResult.summary.passed}/${suiteResult.summary.total})</p>
        
        <table>
            <tr>
                <th>테스트 케이스</th>
                <th>상태</th>
                <th>실행 시간</th>
                <th>시도 횟수</th>
                <th>오류</th>
            </tr>
            ${suiteResult.results.map(testResult => `
            <tr>
                <td>${testResult.name}</td>
                <td class="${testResult.status}">${testResult.status === 'passed' ? '✅ 통과' : '❌ 실패'}</td>
                <td>${testResult.duration.toFixed(2)}ms</td>
                <td>${testResult.attempt}</td>
                <td>${testResult.error || '-'}</td>
            </tr>
            `).join('')}
        </table>
    </div>
    `).join('')}

    <div class="suite">
        <h2>📊 스위트별 성능</h2>
        <table>
            <tr>
                <th>스위트</th>
                <th>통과</th>
                <th>실패</th>
                <th>총계</th>
                <th>성공률</th>
            </tr>
            ${Object.entries(summary.suites).map(([suiteName, suiteData]) => `
            <tr>
                <td>${suiteName}</td>
                <td class="passed">${suiteData.passed}</td>
                <td class="failed">${suiteData.failed}</td>
                <td>${suiteData.total}</td>
                <td>${suiteData.successRate.toFixed(1)}%</td>
            </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
  }
}

export default ProgressiveRAGIntegrationTester;