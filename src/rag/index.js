/**
 * Progressive RAG 시스템 메인 진입점
 * 
 * 모든 RAG 시스템 구성 요소를 통합하고 초기화하는 메인 모듈
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ProgressiveRAG from './progressiveRAG.js';
import ProgressiveRAGTestRunner from './testRunner.js';
import ProgressiveRAGSystemOptimizer from './systemOptimizer.js';
import MemoryOptimizer from './memoryOptimizer.js';
import ResponseTimeOptimizer from './responseTimeOptimizer.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Progressive RAG 시스템 관리자
 */
export class ProgressiveRAGManager {
  constructor(config = {}) {
    this.config = {
      // 기본 설정
      dataDir: config.dataDir || path.join(__dirname, '../data'),
      cacheDir: config.cacheDir || path.join(__dirname, '../data/cache'),
      logDir: config.logDir || path.join(__dirname, '../logs'),
      
      // RAG 시스템 설정
      enableAutoSave: config.enableAutoSave !== false,
      autoSaveInterval: config.autoSaveInterval || 30000, // 30초
      
      // 최적화 설정
      enableOptimization: config.enableOptimization !== false,
      optimizationInterval: config.optimizationInterval || 300000, // 5분
      
      // 메모리 최적화 설정
      enableMemoryOptimization: config.enableMemoryOptimization !== false,
      memoryThreshold: config.memoryThreshold || 80, // 80%
      
      // 응답 시간 최적화 설정
      enableResponseOptimization: config.enableResponseOptimization !== false,
      responseTimeThreshold: config.responseTimeThreshold || 1000, // 1초
      
      // 테스트 설정
      enableTesting: config.enableTesting || false,
      testOnStartup: config.testOnStartup || false,
      
      // 로깅 설정
      enableLogging: config.enableLogging !== false,
      logLevel: config.logLevel || 'info',
      
      ...config
    };

    this.ragSystem = null;
    this.systemOptimizer = null;
    this.memoryOptimizer = null;
    this.responseOptimizer = null;
    this.testRunner = null;
    
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = null;
    this.stats = {
      totalQueries: 0,
      totalAnalyses: 0,
      totalOptimizations: 0,
      errors: 0
    };
  }

  /**
   * 시스템 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Progressive RAG 시스템이 이미 초기화되었습니다.');
      return;
    }

    console.log('🚀 Progressive RAG 시스템 초기화 시작...');
    
    try {
      // 필요한 디렉토리 생성
      this.createDirectories();

      // 로깅 설정
      this.setupLogging();

      // 메인 RAG 시스템 초기화
      await this.initializeRAGSystem();

      // 최적화 시스템 초기화
      if (this.config.enableOptimization) {
        await this.initializeOptimizers();
      }

      // 테스트 러너 초기화
      if (this.config.enableTesting) {
        this.initializeTestRunner();
      }

      // 시작업 테스트 실행
      if (this.config.testOnStartup) {
        await this.runStartupTests();
      }

      this.isInitialized = true;
      this.startTime = new Date();
      
      console.log('✅ Progressive RAG 시스템 초기화 완료');
      this.printSystemInfo();

    } catch (error) {
      console.error('❌ Progressive RAG 시스템 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 필요한 디렉토리 생성
   */
  createDirectories() {
    const directories = [
      this.config.dataDir,
      this.config.cacheDir,
      this.config.logDir,
      path.join(this.config.dataDir, 'embeddings'),
      path.join(this.config.dataDir, 'vectors'),
      path.join(this.config.dataDir, 'analysis'),
      path.join(this.config.dataDir, 'backups'),
      path.join(this.config.dataDir, 'test-results')
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 로깅 설정
   */
  setupLogging() {
    if (!this.config.enableLogging) return;

    // 간단한 로깅 설정 (실제 환경에서는 winston 등 사용 권장)
    const logFile = path.join(this.config.logDir, `progressive-rag-${new Date().toISOString().split('T')[0]}.log`);
    
    // 기본 로깅 함수 오버라이드
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] [INFO] ${args.join(' ')}\n`;
      fs.appendFileSync(logFile, message);
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] [ERROR] ${args.join(' ')}\n`;
      fs.appendFileSync(logFile, message);
      originalError(...args);
    };
  }

  /**
   * RAG 시스템 초기화
   */
  async initializeRAGSystem() {
    console.log('📚 RAG 시스템 초기화 중...');
    
    this.ragSystem = new ProgressiveRAG({
      dataDir: this.config.dataDir,
      cacheDir: this.config.cacheDir,
      enableAutoSave: this.config.enableAutoSave,
      autoSaveInterval: this.config.autoSaveInterval
    });

    await this.ragSystem.initialize();
    console.log('✅ RAG 시스템 초기화 완료');
  }

  /**
   * 최적화 시스템 초기화
   */
  async initializeOptimizers() {
    console.log('⚡ 최적화 시스템 초기화 중...');

    // 시스템 최적화기
    this.systemOptimizer = new ProgressiveRAGSystemOptimizer(this.ragSystem, {
      outputDir: path.join(this.config.dataDir, 'optimization'),
      enableAutoOptimization: true,
      optimizationInterval: this.config.optimizationInterval
    });

    // 메모리 최적화기
    if (this.config.enableMemoryOptimization) {
      this.memoryOptimizer = new MemoryOptimizer(this.ragSystem, {
        threshold: this.config.memoryThreshold,
        enableAutoCleanup: true
      });
    }

    // 응답 시간 최적화기
    if (this.config.enableResponseOptimization) {
      this.responseOptimizer = new ResponseTimeOptimizer(this.ragSystem, {
        threshold: this.config.responseTimeThreshold,
        enableParallelProcessing: true
      });
    }

    console.log('✅ 최적화 시스템 초기화 완료');
  }

  /**
   * 테스트 러너 초기화
   */
  initializeTestRunner() {
    console.log('🧪 테스트 러너 초기화 중...');
    
    this.testRunner = new ProgressiveRAGTestRunner({
      outputDir: path.join(this.config.dataDir, 'test-results'),
      enableIntegrationTests: true,
      enablePerformanceTests: true,
      enableOptimizationTests: true
    });

    console.log('✅ 테스트 러너 초기화 완료');
  }

  /**
   * 시작업 테스트 실행
   */
  async runStartupTests() {
    if (!this.testRunner) return;

    console.log('🔍 시작업 테스트 실행 중...');
    
    try {
      // 기본 통합 테스트만 실행
      const results = await this.testRunner.runIntegrationTestsOnly();
      
      // 테스트 결과 확인
      const successRate = this.calculateTestSuccessRate(results);
      
      if (successRate < 80) {
        console.warn(`⚠️ 시작업 테스트 성공률이 낮습니다: ${successRate.toFixed(1)}%`);
      } else {
        console.log(`✅ 시작업 테스트 성공: ${successRate.toFixed(1)}%`);
      }
      
    } catch (error) {
      console.error('❌ 시작업 테스트 실패:', error.message);
      // 시작업 테스트 실패는 시스템 초기화를 중단하지 않음
    }
  }

  /**
   * 테스트 성공률 계산
   */
  calculateTestSuccessRate(testResults) {
    if (!testResults || !Array.isArray(testResults)) return 0;
    
    let totalTests = 0;
    let totalPassed = 0;
    
    for (const suiteResult of testResults) {
      totalTests += suiteResult.summary.total;
      totalPassed += suiteResult.summary.passed;
    }
    
    return totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  }

  /**
   * 시스템 시작
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      console.log('⚠️ Progressive RAG 시스템이 이미 실행 중입니다.');
      return;
    }

    console.log('▶️ Progressive RAG 시스템 시작...');

    try {
      // 최적화 시스템 시작
      if (this.systemOptimizer) {
        await this.systemOptimizer.start();
      }

      if (this.memoryOptimizer) {
        await this.memoryOptimizer.start();
      }

      if (this.responseOptimizer) {
        await this.responseOptimizer.start();
      }

      this.isRunning = true;
      console.log('✅ Progressive RAG 시스템 시작 완료');

      // 시스템 상태 모니터링 시작
      this.startStatusMonitoring();

    } catch (error) {
      console.error('❌ Progressive RAG 시스템 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 상태 모니터링 시작
   */
  startStatusMonitoring() {
    // 5분마다 시스템 상태 출력
    setInterval(() => {
      this.printSystemStatus();
    }, 300000);
  }

  /**
   * 시스템 정지
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Progressive RAG 시스템이 실행 중이 아닙니다.');
      return;
    }

    console.log('⏹️ Progressive RAG 시스템 정지 중...');

    try {
      // 최적화 시스템 정지
      if (this.responseOptimizer) {
        await this.responseOptimizer.stop();
      }

      if (this.memoryOptimizer) {
        await this.memoryOptimizer.stop();
      }

      if (this.systemOptimizer) {
        await this.systemOptimizer.stop();
      }

      // RAG 시스템 정지
      if (this.ragSystem) {
        await this.ragSystem.shutdown();
      }

      this.isRunning = false;
      console.log('✅ Progressive RAG 시스템 정지 완료');

    } catch (error) {
      console.error('❌ Progressive RAG 시스템 정지 중 오류:', error);
      throw error;
    }
  }

  /**
   * 의료 용어 검색
   */
  async searchMedicalTerm(term, options = {}) {
    if (!this.isRunning) {
      throw new Error('Progressive RAG 시스템이 실행 중이 아닙니다.');
    }

    try {
      this.stats.totalQueries++;
      
      const result = await this.ragSystem.searchMedicalTerm(term, options);
      
      // 응답 시간 최적화기가 있으면 모니터링
      if (this.responseOptimizer) {
        this.responseOptimizer.recordRequest('searchMedicalTerm', result.duration || 0);
      }
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error('의료 용어 검색 오류:', error);
      throw error;
    }
  }

  /**
   * ICD 코드 검색
   */
  async searchICDCode(code, options = {}) {
    if (!this.isRunning) {
      throw new Error('Progressive RAG 시스템이 실행 중이 아닙니다.');
    }

    try {
      this.stats.totalQueries++;
      
      const result = await this.ragSystem.searchICDCode(code, options);
      
      // 응답 시간 최적화기가 있으면 모니터링
      if (this.responseOptimizer) {
        this.responseOptimizer.recordRequest('searchICDCode', result.duration || 0);
      }
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error('ICD 코드 검색 오류:', error);
      throw error;
    }
  }

  /**
   * 분석 결과 저장
   */
  async saveAnalysis(analysisData) {
    if (!this.isRunning) {
      throw new Error('Progressive RAG 시스템이 실행 중이 아닙니다.');
    }

    try {
      this.stats.totalAnalyses++;
      
      const result = await this.ragSystem.saveAnalysis(analysisData);
      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error('분석 결과 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 전체 테스트 실행
   */
  async runFullTests() {
    if (!this.testRunner) {
      throw new Error('테스트 러너가 초기화되지 않았습니다.');
    }

    console.log('🧪 전체 테스트 실행 시작...');
    
    try {
      const results = await this.testRunner.runAllTests();
      console.log('✅ 전체 테스트 실행 완료');
      return results;
      
    } catch (error) {
      console.error('❌ 전체 테스트 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 수동 최적화 실행
   */
  async runOptimization() {
    if (!this.systemOptimizer) {
      throw new Error('시스템 최적화기가 초기화되지 않았습니다.');
    }

    console.log('⚡ 수동 최적화 실행 시작...');
    
    try {
      this.stats.totalOptimizations++;
      
      const result = await this.systemOptimizer.runManualOptimization();
      console.log('✅ 수동 최적화 실행 완료');
      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ 수동 최적화 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 정보 출력
   */
  printSystemInfo() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Progressive RAG 시스템 정보');
    console.log('='.repeat(60));
    console.log(`데이터 디렉토리: ${this.config.dataDir}`);
    console.log(`캐시 디렉토리: ${this.config.cacheDir}`);
    console.log(`로그 디렉토리: ${this.config.logDir}`);
    console.log(`자동 저장: ${this.config.enableAutoSave ? '활성화' : '비활성화'}`);
    console.log(`최적화: ${this.config.enableOptimization ? '활성화' : '비활성화'}`);
    console.log(`테스트: ${this.config.enableTesting ? '활성화' : '비활성화'}`);
    console.log('='.repeat(60));
  }

  /**
   * 시스템 상태 출력
   */
  printSystemStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    console.log('\n' + '='.repeat(60));
    console.log('📊 Progressive RAG 시스템 상태');
    console.log('='.repeat(60));
    console.log(`상태: ${this.isRunning ? '🟢 실행 중' : '🔴 정지됨'}`);
    console.log(`가동 시간: ${uptimeHours}시간 ${uptimeMinutes}분`);
    console.log(`총 쿼리: ${this.stats.totalQueries}`);
    console.log(`총 분석: ${this.stats.totalAnalyses}`);
    console.log(`총 최적화: ${this.stats.totalOptimizations}`);
    console.log(`오류 수: ${this.stats.errors}`);
    
    // 메모리 사용량
    const memUsage = process.memoryUsage();
    console.log(`메모리 사용량: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    console.log('='.repeat(60));
  }

  /**
   * 시스템 상태 조회
   */
  getSystemStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const memUsage = process.memoryUsage();

    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime,
      stats: { ...this.stats },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      config: { ...this.config }
    };
  }

  /**
   * RAG 시스템 조회
   */
  getRAGSystem() {
    return this.ragSystem;
  }

  /**
   * 최적화 시스템 조회
   */
  getOptimizers() {
    return {
      system: this.systemOptimizer,
      memory: this.memoryOptimizer,
      response: this.responseOptimizer
    };
  }

  /**
   * 테스트 러너 조회
   */
  getTestRunner() {
    return this.testRunner;
  }
}

// 기본 인스턴스 생성 및 내보내기
const defaultManager = new ProgressiveRAGManager();

export default defaultManager;

// 개별 클래스들도 내보내기
export {
  ProgressiveRAG,
  ProgressiveRAGTestRunner,
  ProgressiveRAGSystemOptimizer,
  MemoryOptimizer,
  ResponseTimeOptimizer
};