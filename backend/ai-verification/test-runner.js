/**
 * AI 검증 시스템 테스트 실행기
 * 
 * 역할:
 * 1. 개별 컴포넌트 테스트 실행
 * 2. 통합 테스트 및 시나리오 테스트
 * 3. 성능 벤치마크 테스트
 * 4. 모의 데이터를 이용한 안전한 테스트
 * 5. 테스트 결과 분석 및 리포트 생성
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { FileUtils, PerformanceUtils, LogUtils, DataUtils } from './utils.js';
import AIVerificationSystem from './index.js';
import { ProcessingComparisonSystem } from './processing-comparison.js';
import { AIPromptManager } from './ai-prompts.js';
import { GPT4oRevalidationSystem } from './gpt4o-revalidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 테스트 실행기 클래스
 */
export class TestRunner {
  constructor() {
    this.testResults = [];
    this.startTime = null;
    this.endTime = null;
    this.mockMode = true; // 기본적으로 모의 모드로 실행
  }

  /**
   * 모든 테스트 실행
   * @param {Object} options 테스트 옵션
   * @returns {Promise<Object>} 테스트 결과
   */
  async runAllTests(options = {}) {
    const {
      includeMockTests = true,
      includeIntegrationTests = false,
      includePerformanceTests = true,
      verbose = true
    } = options;

    this.startTime = Date.now();
    LogUtils.info('AI 검증 시스템 테스트 시작', { options });

    try {
      // 1. 환경 검증 테스트
      await this.runEnvironmentTests();

      // 2. 유틸리티 함수 테스트
      await this.runUtilityTests();

      // 3. 모의 데이터 테스트
      if (includeMockTests) {
        await this.runMockDataTests();
      }

      // 4. 컴포넌트 테스트
      await this.runComponentTests();

      // 5. 통합 테스트
      if (includeIntegrationTests) {
        await this.runIntegrationTests();
      }

      // 6. 성능 테스트
      if (includePerformanceTests) {
        await this.runPerformanceTests();
      }

      this.endTime = Date.now();
      const summary = this.generateTestSummary();

      if (verbose) {
        this.printTestResults();
      }

      return summary;

    } catch (error) {
      LogUtils.error('테스트 실행 중 오류 발생', error);
      throw error;
    }
  }

  /**
   * 환경 검증 테스트
   */
  async runEnvironmentTests() {
    LogUtils.info('환경 검증 테스트 시작');

    const tests = [
      {
        name: '설정 파일 검증',
        test: () => this.testConfigValidation()
      },
      {
        name: '디렉토리 구조 검증',
        test: () => this.testDirectoryStructure()
      },
      {
        name: '의존성 검증',
        test: () => this.testDependencies()
      },
      {
        name: '권한 검증',
        test: () => this.testPermissions()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('환경', test.name, test.test);
    }
  }

  /**
   * 유틸리티 함수 테스트
   */
  async runUtilityTests() {
    LogUtils.info('유틸리티 함수 테스트 시작');

    const tests = [
      {
        name: 'FileUtils 테스트',
        test: () => this.testFileUtils()
      },
      {
        name: 'DataUtils 테스트',
        test: () => this.testDataUtils()
      },
      {
        name: 'PerformanceUtils 테스트',
        test: () => this.testPerformanceUtils()
      },
      {
        name: 'LogUtils 테스트',
        test: () => this.testLogUtils()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('유틸리티', test.name, test.test);
    }
  }

  /**
   * 모의 데이터 테스트
   */
  async runMockDataTests() {
    LogUtils.info('모의 데이터 테스트 시작');

    const tests = [
      {
        name: '모의 케이스 데이터 생성',
        test: () => this.testMockCaseGeneration()
      },
      {
        name: '모의 AI 응답 생성',
        test: () => this.testMockAIResponse()
      },
      {
        name: '모의 처리 결과 생성',
        test: () => this.testMockProcessingResults()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('모의데이터', test.name, test.test);
    }
  }

  /**
   * 컴포넌트 테스트
   */
  async runComponentTests() {
    LogUtils.info('컴포넌트 테스트 시작');

    const tests = [
      {
        name: 'AIVerificationSystem 초기화',
        test: () => this.testAIVerificationSystemInit()
      },
      {
        name: 'ProcessingComparisonSystem 초기화',
        test: () => this.testProcessingComparisonSystemInit()
      },
      {
        name: 'AIPromptManager 초기화',
        test: () => this.testAIPromptManagerInit()
      },
      {
        name: 'GPT4oRevalidationSystem 초기화',
        test: () => this.testGPT4oRevalidationSystemInit()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('컴포넌트', test.name, test.test);
    }
  }

  /**
   * 통합 테스트
   */
  async runIntegrationTests() {
    LogUtils.info('통합 테스트 시작');

    const tests = [
      {
        name: '전체 검증 파이프라인 (모의)',
        test: () => this.testFullVerificationPipeline()
      },
      {
        name: '처리 방식 비교 (모의)',
        test: () => this.testProcessingComparison()
      },
      {
        name: '재검증 시스템 (모의)',
        test: () => this.testRevalidationSystem()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('통합', test.name, test.test);
    }
  }

  /**
   * 성능 테스트
   */
  async runPerformanceTests() {
    LogUtils.info('성능 테스트 시작');

    const tests = [
      {
        name: '메모리 사용량 테스트',
        test: () => this.testMemoryUsage()
      },
      {
        name: '처리 속도 테스트',
        test: () => this.testProcessingSpeed()
      },
      {
        name: '동시 처리 테스트',
        test: () => this.testConcurrentProcessing()
      },
      {
        name: '대용량 데이터 테스트',
        test: () => this.testLargeDataProcessing()
      }
    ];

    for (const test of tests) {
      await this.runSingleTest('성능', test.name, test.test);
    }
  }

  /**
   * 단일 테스트 실행
   * @param {string} category 테스트 카테고리
   * @param {string} name 테스트 이름
   * @param {Function} testFn 테스트 함수
   */
  async runSingleTest(category, name, testFn) {
    const startTime = Date.now();
    let result = {
      category,
      name,
      status: 'pending',
      duration: 0,
      error: null,
      details: null
    };

    try {
      LogUtils.debug(`테스트 시작: ${category} - ${name}`);
      
      const testResult = await PerformanceUtils.measureTime(testFn);
      
      result.status = 'passed';
      result.duration = testResult.performance.executionTime;
      result.details = testResult.result;
      
      LogUtils.debug(`테스트 성공: ${category} - ${name}`, {
        duration: `${result.duration.toFixed(2)}ms`
      });
      
    } catch (error) {
      result.status = 'failed';
      result.duration = Date.now() - startTime;
      result.error = {
        message: error.message,
        stack: error.stack
      };
      
      LogUtils.error(`테스트 실패: ${category} - ${name}`, error);
    }

    this.testResults.push(result);
    return result;
  }

  // ===========================================
  // 개별 테스트 구현
  // ===========================================

  /**
   * 설정 파일 검증 테스트
   */
  async testConfigValidation() {
    const requiredKeys = [
      'openai.apiKey',
      'models.gpt4oMini.name',
      'models.o1Mini.name',
      'models.gpt4o.name',
      'verification.thresholds.minScore',
      'paths.caseData',
      'paths.results'
    ];

    const missingKeys = [];
    
    for (const key of requiredKeys) {
      const value = this.getNestedValue(config, key);
      if (value === undefined || value === null) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      throw new Error(`필수 설정 키 누락: ${missingKeys.join(', ')}`);
    }

    return {
      message: '모든 필수 설정이 올바르게 구성됨',
      checkedKeys: requiredKeys.length
    };
  }

  /**
   * 디렉토리 구조 검증 테스트
   */
  async testDirectoryStructure() {
    const requiredDirs = [
      config.paths.caseData,
      config.paths.results,
      path.dirname(config.paths.logs)
    ];

    const results = [];
    
    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
        results.push({ path: dir, exists: true });
      } catch {
        // 디렉토리가 없으면 생성 시도
        try {
          await FileUtils.ensureDirectory(dir);
          results.push({ path: dir, exists: false, created: true });
        } catch (error) {
          results.push({ path: dir, exists: false, error: error.message });
        }
      }
    }

    return {
      message: '디렉토리 구조 검증 완료',
      directories: results
    };
  }

  /**
   * 의존성 검증 테스트
   */
  async testDependencies() {
    const dependencies = [
      { name: 'fs/promises', test: () => import('fs/promises') },
      { name: 'path', test: () => import('path') },
      { name: 'crypto', test: () => import('crypto') }
    ];

    const results = [];
    
    for (const dep of dependencies) {
      try {
        await dep.test();
        results.push({ name: dep.name, available: true });
      } catch (error) {
        results.push({ name: dep.name, available: false, error: error.message });
      }
    }

    const failedDeps = results.filter(r => !r.available);
    if (failedDeps.length > 0) {
      throw new Error(`의존성 로드 실패: ${failedDeps.map(d => d.name).join(', ')}`);
    }

    return {
      message: '모든 의존성이 사용 가능함',
      dependencies: results
    };
  }

  /**
   * 권한 검증 테스트
   */
  async testPermissions() {
    const testFile = path.join(config.paths.results, 'permission-test.tmp');
    
    try {
      // 쓰기 권한 테스트
      await fs.writeFile(testFile, 'test', 'utf-8');
      
      // 읽기 권한 테스트
      const content = await fs.readFile(testFile, 'utf-8');
      
      // 삭제 권한 테스트
      await fs.unlink(testFile);
      
      if (content !== 'test') {
        throw new Error('파일 읽기/쓰기 불일치');
      }
      
      return {
        message: '파일 시스템 권한 정상',
        operations: ['read', 'write', 'delete']
      };
      
    } catch (error) {
      throw new Error(`파일 시스템 권한 오류: ${error.message}`);
    }
  }

  /**
   * FileUtils 테스트
   */
  async testFileUtils() {
    const testDir = path.join(config.paths.results, 'test-fileutils');
    const testFile = path.join(testDir, 'test.json');
    const testData = { test: true, timestamp: Date.now() };

    try {
      // 디렉토리 생성 테스트
      await FileUtils.ensureDirectory(testDir);
      
      // JSON 쓰기 테스트
      await FileUtils.writeJsonSafe(testFile, testData);
      
      // JSON 읽기 테스트
      const readData = await FileUtils.readJsonSafe(testFile);
      
      // 파일 크기 테스트
      const fileSize = await FileUtils.getFileSize(testFile);
      
      // 정리
      await fs.unlink(testFile);
      await fs.rmdir(testDir);
      
      if (JSON.stringify(readData) !== JSON.stringify(testData)) {
        throw new Error('JSON 읽기/쓰기 불일치');
      }
      
      return {
        message: 'FileUtils 모든 기능 정상',
        fileSize,
        operations: ['ensureDirectory', 'writeJsonSafe', 'readJsonSafe', 'getFileSize']
      };
      
    } catch (error) {
      throw new Error(`FileUtils 테스트 실패: ${error.message}`);
    }
  }

  /**
   * DataUtils 테스트
   */
  async testDataUtils() {
    const testObj = {
      a: 1,
      b: { c: 2, d: [3, 4] },
      e: new Date()
    };

    // 깊은 복사 테스트
    const cloned = DataUtils.deepClone(testObj);
    cloned.b.c = 999;
    
    if (testObj.b.c === 999) {
      throw new Error('깊은 복사 실패');
    }

    // 텍스트 정제 테스트
    const dirtyText = '  test\x00\x01  text  ';
    const cleanText = DataUtils.sanitizeText(dirtyText);
    
    if (cleanText !== 'test text') {
      throw new Error('텍스트 정제 실패');
    }

    // 숫자 검증 테스트
    const validNum = DataUtils.validateNumber('123.45', { min: 0, max: 200 });
    const invalidNum = DataUtils.validateNumber('abc');
    
    if (validNum !== 123.45 || invalidNum !== null) {
      throw new Error('숫자 검증 실패');
    }

    return {
      message: 'DataUtils 모든 기능 정상',
      tests: ['deepClone', 'sanitizeText', 'validateNumber']
    };
  }

  /**
   * PerformanceUtils 테스트
   */
  async testPerformanceUtils() {
    // 실행 시간 측정 테스트
    const testFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'test result';
    };

    const result = await PerformanceUtils.measureTime(testFn);
    
    if (result.result !== 'test result') {
      throw new Error('함수 실행 결과 불일치');
    }
    
    if (result.performance.executionTime < 10) {
      throw new Error('실행 시간 측정 오류');
    }

    // 메모리 사용량 테스트
    const memoryUsage = PerformanceUtils.getMemoryUsage();
    
    if (!memoryUsage.rss || !memoryUsage.heapUsed) {
      throw new Error('메모리 사용량 측정 실패');
    }

    return {
      message: 'PerformanceUtils 모든 기능 정상',
      executionTime: result.performance.executionTime,
      memoryUsage: memoryUsage.rss
    };
  }

  /**
   * LogUtils 테스트
   */
  async testLogUtils() {
    // 로그 출력 테스트 (실제 출력은 하지 않음)
    const originalConsoleLog = console.log;
    let logOutput = [];
    
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };

    try {
      LogUtils.info('테스트 메시지', { test: true });
      LogUtils.warn('경고 메시지');
      LogUtils.error('오류 메시지', new Error('테스트 오류'));
      
      console.log = originalConsoleLog;
      
      if (logOutput.length === 0) {
        throw new Error('로그 출력 실패');
      }
      
      return {
        message: 'LogUtils 모든 기능 정상',
        logCount: logOutput.length
      };
      
    } finally {
      console.log = originalConsoleLog;
    }
  }

  /**
   * 모의 케이스 데이터 생성 테스트
   */
  async testMockCaseGeneration() {
    const mockCase = this.generateMockCaseData();
    
    const requiredFields = ['id', 'content', 'expectedResults', 'metadata'];
    const missingFields = requiredFields.filter(field => !mockCase[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`모의 케이스 데이터 필드 누락: ${missingFields.join(', ')}`);
    }
    
    return {
      message: '모의 케이스 데이터 생성 성공',
      caseId: mockCase.id,
      contentLength: mockCase.content.length
    };
  }

  /**
   * 모의 AI 응답 생성 테스트
   */
  async testMockAIResponse() {
    const mockResponse = this.generateMockAIResponse();
    
    const requiredFields = ['model', 'response', 'confidence', 'processingTime'];
    const missingFields = requiredFields.filter(field => mockResponse[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`모의 AI 응답 필드 누락: ${missingFields.join(', ')}`);
    }
    
    return {
      message: '모의 AI 응답 생성 성공',
      model: mockResponse.model,
      confidence: mockResponse.confidence
    };
  }

  /**
   * 모의 처리 결과 생성 테스트
   */
  async testMockProcessingResults() {
    const mockResults = this.generateMockProcessingResults();
    
    if (!Array.isArray(mockResults) || mockResults.length === 0) {
      throw new Error('모의 처리 결과가 배열이 아니거나 비어있음');
    }
    
    const firstResult = mockResults[0];
    const requiredFields = ['caseId', 'method', 'score', 'details'];
    const missingFields = requiredFields.filter(field => firstResult[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`모의 처리 결과 필드 누락: ${missingFields.join(', ')}`);
    }
    
    return {
      message: '모의 처리 결과 생성 성공',
      resultCount: mockResults.length,
      methods: [...new Set(mockResults.map(r => r.method))]
    };
  }

  /**
   * AI 검증 시스템 초기화 테스트
   */
  async testAIVerificationSystemInit() {
    try {
      const system = new AIVerificationSystem();
      
      if (!system.config || !system.results) {
        throw new Error('시스템 초기화 불완전');
      }
      
      return {
        message: 'AIVerificationSystem 초기화 성공',
        hasConfig: !!system.config,
        hasResults: !!system.results
      };
      
    } catch (error) {
      throw new Error(`AIVerificationSystem 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 처리 비교 시스템 초기화 테스트
   */
  async testProcessingComparisonSystemInit() {
    try {
      const system = new ProcessingComparisonSystem();
      
      if (!system.config || !system.results) {
        throw new Error('시스템 초기화 불완전');
      }
      
      return {
        message: 'ProcessingComparisonSystem 초기화 성공',
        hasConfig: !!system.config,
        hasResults: !!system.results
      };
      
    } catch (error) {
      throw new Error(`ProcessingComparisonSystem 초기화 실패: ${error.message}`);
    }
  }

  /**
   * AI 프롬프트 매니저 초기화 테스트
   */
  async testAIPromptManagerInit() {
    try {
      const system = new AIPromptManager();
      
      if (!system.config || !system.prompts) {
        throw new Error('시스템 초기화 불완전');
      }
      
      return {
        message: 'AIPromptManager 초기화 성공',
        hasConfig: !!system.config,
        hasPrompts: !!system.prompts
      };
      
    } catch (error) {
      throw new Error(`AIPromptManager 초기화 실패: ${error.message}`);
    }
  }

  /**
   * GPT-4o 재검증 시스템 초기화 테스트
   */
  async testGPT4oRevalidationSystemInit() {
    try {
      const system = new GPT4oRevalidationSystem();
      
      if (!system.config || !system.results) {
        throw new Error('시스템 초기화 불완전');
      }
      
      return {
        message: 'GPT4oRevalidationSystem 초기화 성공',
        hasConfig: !!system.config,
        hasResults: !!system.results
      };
      
    } catch (error) {
      throw new Error(`GPT4oRevalidationSystem 초기화 실패: ${error.message}`);
    }
  }

  /**
   * 전체 검증 파이프라인 테스트 (모의)
   */
  async testFullVerificationPipeline() {
    const mockCases = [this.generateMockCaseData(), this.generateMockCaseData()];
    
    // 모의 검증 실행
    const results = [];
    
    for (const mockCase of mockCases) {
      const result = {
        caseId: mockCase.id,
        gpt4oMini: this.generateMockAIResponse('gpt-4o-mini'),
        o1Mini: this.generateMockAIResponse('o1-mini'),
        comparison: {
          consistency: Math.random() * 0.3 + 0.7, // 0.7-1.0
          avgScore: Math.random() * 0.2 + 0.8     // 0.8-1.0
        }
      };
      
      results.push(result);
    }
    
    return {
      message: '전체 검증 파이프라인 모의 실행 성공',
      processedCases: results.length,
      avgConsistency: results.reduce((sum, r) => sum + r.comparison.consistency, 0) / results.length
    };
  }

  /**
   * 처리 방식 비교 테스트 (모의)
   */
  async testProcessingComparison() {
    const mockCase = this.generateMockCaseData();
    
    const hybridResult = {
      method: 'hybrid',
      score: Math.random() * 0.2 + 0.8,
      processingTime: Math.random() * 1000 + 500,
      accuracy: Math.random() * 0.1 + 0.9
    };
    
    const logicResult = {
      method: 'logic',
      score: Math.random() * 0.3 + 0.6,
      processingTime: Math.random() * 500 + 200,
      accuracy: Math.random() * 0.2 + 0.7
    };
    
    return {
      message: '처리 방식 비교 모의 실행 성공',
      caseId: mockCase.id,
      hybrid: hybridResult,
      logic: logicResult,
      recommendation: hybridResult.score > logicResult.score ? 'hybrid' : 'logic'
    };
  }

  /**
   * 재검증 시스템 테스트 (모의)
   */
  async testRevalidationSystem() {
    const mockResults = {
      gpt4oMini: { score: 0.65, confidence: 0.7 },
      o1Mini: { score: 0.68, confidence: 0.75 },
      consistency: 0.6
    };
    
    // 재검증 필요성 판단 (모의)
    const needsRevalidation = mockResults.consistency < config.verification.thresholds.revalidationTrigger;
    
    let revalidationResult = null;
    if (needsRevalidation) {
      revalidationResult = {
        model: 'gpt-4o',
        score: Math.random() * 0.2 + 0.8,
        confidence: Math.random() * 0.1 + 0.9,
        improvements: ['프롬프트 명확성 개선', '컨텍스트 정보 추가']
      };
    }
    
    return {
      message: '재검증 시스템 모의 실행 성공',
      needsRevalidation,
      originalConsistency: mockResults.consistency,
      revalidationResult
    };
  }

  /**
   * 메모리 사용량 테스트
   */
  async testMemoryUsage() {
    const initialMemory = process.memoryUsage();
    
    // 메모리 사용량 증가 시뮬레이션
    const largeArray = new Array(100000).fill(0).map((_, i) => ({ id: i, data: 'test'.repeat(100) }));
    
    const peakMemory = process.memoryUsage();
    
    // 메모리 해제
    largeArray.length = 0;
    
    // 가비지 컬렉션 강제 실행 (가능한 경우)
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    
    return {
      message: '메모리 사용량 테스트 완료',
      initial: PerformanceUtils.formatBytes(initialMemory.heapUsed),
      peak: PerformanceUtils.formatBytes(peakMemory.heapUsed),
      final: PerformanceUtils.formatBytes(finalMemory.heapUsed),
      increase: PerformanceUtils.formatBytes(peakMemory.heapUsed - initialMemory.heapUsed)
    };
  }

  /**
   * 처리 속도 테스트
   */
  async testProcessingSpeed() {
    const iterations = 1000;
    const testData = Array.from({ length: iterations }, (_, i) => ({ id: i, text: `테스트 데이터 ${i}` }));
    
    const startTime = process.hrtime.bigint();
    
    // 데이터 처리 시뮬레이션
    const results = testData.map(item => ({
      ...item,
      processed: true,
      hash: DataUtils.generateHash(item.text)
    }));
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // 나노초를 밀리초로
    
    return {
      message: '처리 속도 테스트 완료',
      iterations,
      totalTime: `${duration.toFixed(2)}ms`,
      avgTimePerItem: `${(duration / iterations).toFixed(4)}ms`,
      itemsPerSecond: Math.round(iterations / (duration / 1000))
    };
  }

  /**
   * 동시 처리 테스트
   */
  async testConcurrentProcessing() {
    const concurrency = 5;
    const tasksPerWorker = 10;
    
    const workers = Array.from({ length: concurrency }, async (_, workerId) => {
      const tasks = Array.from({ length: tasksPerWorker }, async (_, taskId) => {
        // 비동기 작업 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return { workerId, taskId, result: Math.random() };
      });
      
      return Promise.all(tasks);
    });
    
    const startTime = Date.now();
    const results = await Promise.all(workers);
    const endTime = Date.now();
    
    const flatResults = results.flat();
    
    return {
      message: '동시 처리 테스트 완료',
      concurrency,
      tasksPerWorker,
      totalTasks: flatResults.length,
      totalTime: `${endTime - startTime}ms`,
      avgTimePerTask: `${((endTime - startTime) / flatResults.length).toFixed(2)}ms`
    };
  }

  /**
   * 대용량 데이터 테스트
   */
  async testLargeDataProcessing() {
    const dataSize = 10000; // 10K 항목
    const largeDataset = Array.from({ length: dataSize }, (_, i) => ({
      id: i,
      content: `대용량 테스트 데이터 ${i} `.repeat(10), // 약 200바이트
      metadata: {
        timestamp: Date.now(),
        category: `category_${i % 10}`,
        tags: [`tag_${i % 5}`, `tag_${(i + 1) % 5}`]
      }
    }));
    
    const startTime = Date.now();
    
    // 데이터 처리 시뮬레이션
    const processed = largeDataset
      .filter(item => item.id % 2 === 0) // 필터링
      .map(item => ({ // 변환
        ...item,
        processed: true,
        contentLength: item.content.length,
        hash: DataUtils.generateHash(item.content)
      }))
      .sort((a, b) => a.id - b.id); // 정렬
    
    const endTime = Date.now();
    
    return {
      message: '대용량 데이터 테스트 완료',
      originalSize: dataSize,
      processedSize: processed.length,
      processingTime: `${endTime - startTime}ms`,
      throughput: `${Math.round(dataSize / ((endTime - startTime) / 1000))} items/sec`
    };
  }

  // ===========================================
  // 모의 데이터 생성 함수들
  // ===========================================

  /**
   * 모의 케이스 데이터 생성
   */
  generateMockCaseData() {
    const id = DataUtils.generateId('case');
    
    return {
      id,
      content: `모의 의료 케이스 데이터 ${id}\n\n환자 정보:\n- 나이: ${20 + Math.floor(Math.random() * 60)}세\n- 성별: ${Math.random() > 0.5 ? '남성' : '여성'}\n\n주요 증상:\n- 증상 1\n- 증상 2\n\n진단 결과:\n- 진단명\n- 치료 계획`,
      expectedResults: {
        entities: ['환자정보', '증상', '진단'],
        confidence: Math.random() * 0.2 + 0.8,
        processingTime: Math.random() * 1000 + 500
      },
      metadata: {
        createdAt: new Date().toISOString(),
        category: 'mock',
        complexity: Math.random() > 0.7 ? 'high' : 'medium'
      }
    };
  }

  /**
   * 모의 AI 응답 생성
   */
  generateMockAIResponse(model = 'gpt-4o-mini') {
    return {
      model,
      response: {
        entities: [
          { type: '환자정보', value: '45세 남성', confidence: 0.95 },
          { type: '증상', value: '두통, 발열', confidence: 0.88 },
          { type: '진단', value: '감기', confidence: 0.82 }
        ],
        summary: '45세 남성 환자의 감기 진단 케이스',
        recommendations: ['충분한 휴식', '수분 섭취', '해열제 복용']
      },
      confidence: Math.random() * 0.2 + 0.8,
      processingTime: Math.random() * 2000 + 1000,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 모의 처리 결과 생성
   */
  generateMockProcessingResults() {
    const methods = ['hybrid', 'logic'];
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      for (const method of methods) {
        results.push({
          caseId: `case_${i + 1}`,
          method,
          score: Math.random() * 0.3 + (method === 'hybrid' ? 0.7 : 0.6),
          accuracy: Math.random() * 0.2 + (method === 'hybrid' ? 0.8 : 0.7),
          processingTime: Math.random() * 1000 + (method === 'hybrid' ? 800 : 400),
          details: {
            entitiesFound: Math.floor(Math.random() * 10) + 5,
            confidence: Math.random() * 0.2 + 0.8,
            errors: Math.floor(Math.random() * 3)
          }
        });
      }
    }
    
    return results;
  }

  // ===========================================
  // 결과 분석 및 출력
  // ===========================================

  /**
   * 테스트 요약 생성
   */
  generateTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = this.testResults.filter(r => r.status === 'failed').length;
    const totalDuration = this.endTime - this.startTime;
    
    const categories = [...new Set(this.testResults.map(r => r.category))];
    const categoryStats = categories.map(category => {
      const categoryTests = this.testResults.filter(r => r.category === category);
      return {
        category,
        total: categoryTests.length,
        passed: categoryTests.filter(r => r.status === 'passed').length,
        failed: categoryTests.filter(r => r.status === 'failed').length,
        avgDuration: categoryTests.reduce((sum, r) => sum + r.duration, 0) / categoryTests.length
      };
    });
    
    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1),
        totalDuration: `${totalDuration}ms`,
        avgTestDuration: `${(totalDuration / totalTests).toFixed(2)}ms`
      },
      categories: categoryStats,
      failedTests: this.testResults
        .filter(r => r.status === 'failed')
        .map(r => ({
          category: r.category,
          name: r.name,
          error: r.error.message
        }))
    };
  }

  /**
   * 테스트 결과 출력
   */
  printTestResults() {
    const summary = this.generateTestSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('AI 검증 시스템 테스트 결과');
    console.log('='.repeat(60));
    
    console.log(`\n📊 전체 요약:`);
    console.log(`   총 테스트: ${summary.summary.totalTests}`);
    console.log(`   성공: ${summary.summary.passedTests} (${summary.summary.successRate}%)`);
    console.log(`   실패: ${summary.summary.failedTests}`);
    console.log(`   총 소요시간: ${summary.summary.totalDuration}`);
    console.log(`   평균 테스트 시간: ${summary.summary.avgTestDuration}`);
    
    console.log(`\n📋 카테고리별 결과:`);
    summary.categories.forEach(cat => {
      const status = cat.failed === 0 ? '✅' : '❌';
      console.log(`   ${status} ${cat.category}: ${cat.passed}/${cat.total} (${cat.avgDuration.toFixed(2)}ms 평균)`);
    });
    
    if (summary.failedTests.length > 0) {
      console.log(`\n❌ 실패한 테스트:`);
      summary.failedTests.forEach(test => {
        console.log(`   - [${test.category}] ${test.name}: ${test.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  // ===========================================
  // 헬퍼 함수들
  // ===========================================

  /**
   * 중첩된 객체 값 가져오기
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// 기본 내보내기
export default TestRunner;

// 직접 실행 시 테스트 수행
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  
  runner.runAllTests({
    includeMockTests: true,
    includeIntegrationTests: true,
    includePerformanceTests: true,
    verbose: true
  }).then(summary => {
    console.log('\n테스트 완료!');
    process.exit(summary.summary.failedTests > 0 ? 1 : 0);
  }).catch(error => {
    console.error('테스트 실행 중 오류:', error);
    process.exit(1);
  });
}