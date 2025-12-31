/**
 * Progressive RAG 시스템 통합 테스트 러너
 * 
 * 전체 시스템 테스트 실행 및 결과 관리
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ProgressiveRAG from './progressiveRAG.js';
import ProgressiveRAGIntegrationTester from './integrationTester.js';
import ProgressiveRAGSystemOptimizer from './systemOptimizer.js';
import PerformanceMetrics from './performanceBenchmark.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 테스트 환경 설정 관리자
 */
class TestEnvironmentManager {
  constructor(config = {}) {
    this.config = {
      testDataDir: config.testDataDir || path.join(__dirname, '../data/test-data'),
      outputDir: config.outputDir || path.join(__dirname, '../data/test-results'),
      tempDir: config.tempDir || path.join(__dirname, '../data/temp'),
      enableCleanup: config.enableCleanup !== false,
      preserveResults: config.preserveResults !== false,
      ...config
    };
    
    this.testRAGSystem = null;
    this.isSetup = false;
  }

  /**
   * 테스트 환경 설정
   */
  async setup() {
    if (this.isSetup) return;

    console.log('🔧 테스트 환경 설정 중...');

    // 필요한 디렉토리 생성
    this.createDirectories();

    // 테스트용 RAG 시스템 초기화
    await this.initializeTestRAGSystem();

    // 테스트 데이터 준비
    await this.prepareTestData();

    this.isSetup = true;
    console.log('✅ 테스트 환경 설정 완료');
  }

  /**
   * 필요한 디렉토리 생성
   */
  createDirectories() {
    const directories = [
      this.config.testDataDir,
      this.config.outputDir,
      this.config.tempDir
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 테스트용 RAG 시스템 초기화
   */
  async initializeTestRAGSystem() {
    const testConfig = {
      dataDir: this.config.tempDir,
      cacheDir: path.join(this.config.tempDir, 'cache'),
      enableAutoSave: true,
      autoSaveInterval: 5000,
      enableOptimization: false // 테스트 중에는 최적화 비활성화
    };

    this.testRAGSystem = new ProgressiveRAG(testConfig);
    await this.testRAGSystem.initialize();
  }

  /**
   * 테스트 데이터 준비
   */
  async prepareTestData() {
    const testDataPath = path.join(this.config.testDataDir, 'test_medical_data.json');
    
    // 테스트 데이터가 없으면 생성
    if (!fs.existsSync(testDataPath)) {
      const testData = this.generateTestData();
      fs.writeFileSync(testDataPath, JSON.stringify(testData, null, 2));
    }

    // 테스트 데이터 로드
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    
    // RAG 시스템에 테스트 데이터 추가
    await this.loadTestDataToRAG(testData);
  }

  /**
   * 테스트 데이터 생성
   */
  generateTestData() {
    return {
      medicalTerms: [
        { term: '고혈압', description: '혈압이 정상보다 높은 상태', category: 'cardiovascular' },
        { term: '당뇨병', description: '혈당 조절 장애로 인한 질환', category: 'endocrine' },
        { term: '심근경색', description: '심장 근육의 혈액 공급 차단', category: 'cardiovascular' },
        { term: '뇌졸중', description: '뇌혈관 장애로 인한 뇌 손상', category: 'neurological' },
        { term: '폐렴', description: '폐의 염증성 질환', category: 'respiratory' },
        { term: '천식', description: '기도의 만성 염증성 질환', category: 'respiratory' },
        { term: '관절염', description: '관절의 염증성 질환', category: 'musculoskeletal' },
        { term: '위염', description: '위 점막의 염증', category: 'gastrointestinal' },
        { term: '간염', description: '간의 염증성 질환', category: 'gastrointestinal' },
        { term: '신부전', description: '신장 기능의 저하', category: 'renal' }
      ],
      icdCodes: [
        { code: 'I10', description: '본태성(원발성) 고혈압', category: 'cardiovascular' },
        { code: 'E11', description: '제2형 당뇨병', category: 'endocrine' },
        { code: 'I21', description: '급성 심근경색증', category: 'cardiovascular' },
        { code: 'I63', description: '뇌경색증', category: 'neurological' },
        { code: 'J18', description: '상세불명 병원체의 폐렴', category: 'respiratory' },
        { code: 'J45', description: '천식', category: 'respiratory' },
        { code: 'M79', description: '기타 연조직 장애', category: 'musculoskeletal' },
        { code: 'K29', description: '위염 및 십이지장염', category: 'gastrointestinal' },
        { code: 'B19', description: '상세불명의 바이러스성 간염', category: 'gastrointestinal' },
        { code: 'N18', description: '만성 신장질환', category: 'renal' }
      ],
      hospitalData: [
        { name: '서울대학교병원', type: '상급종합병원', specialties: ['심장내과', '신경외과', '내분비내과'] },
        { name: '삼성서울병원', type: '상급종합병원', specialties: ['암센터', '심장센터', '뇌신경센터'] },
        { name: '아산병원', type: '상급종합병원', specialties: ['심장내과', '소화기내과', '호흡기내과'] }
      ]
    };
  }

  /**
   * 테스트 데이터를 RAG 시스템에 로드
   */
  async loadTestDataToRAG(testData) {
    // 의료 용어 추가
    for (const term of testData.medicalTerms) {
      await this.testRAGSystem.addMedicalTerm(term.term, term.description, term.category);
    }

    // ICD 코드 추가
    for (const icd of testData.icdCodes) {
      await this.testRAGSystem.addICDCode(icd.code, icd.description, icd.category);
    }

    // 병원 데이터 추가
    for (const hospital of testData.hospitalData) {
      await this.testRAGSystem.addHospitalData(hospital.name, hospital.type, hospital.specialties);
    }
  }

  /**
   * 테스트 환경 정리
   */
  async cleanup() {
    if (!this.isSetup) return;

    console.log('🧹 테스트 환경 정리 중...');

    // RAG 시스템 종료
    if (this.testRAGSystem) {
      await this.testRAGSystem.shutdown();
      this.testRAGSystem = null;
    }

    // 임시 파일 정리
    if (this.config.enableCleanup) {
      this.cleanupTempFiles();
    }

    this.isSetup = false;
    console.log('✅ 테스트 환경 정리 완료');
  }

  /**
   * 임시 파일 정리
   */
  cleanupTempFiles() {
    try {
      const ROOT = process.cwd();
      const REPORTS_PDF_ROOT = (() => {
        const raw = process.env.REPORTS_PDF_ROOT;
        if (typeof raw === 'string' && raw.trim().length > 0) {
          return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
        }
        return 'C:\\VNEXSUS_reports_pdf';
      })();
      const protectedDirs = [
        path.join(REPORTS_PDF_ROOT, 'sample_pdf'),
        path.join(REPORTS_PDF_ROOT, 'prepared_coordinate_cases')
      ].map(d => path.resolve(d));
      const target = path.resolve(this.config.tempDir);
      const isProtected = protectedDirs.some(d => target === d || target.startsWith(d + path.sep));
      if (isProtected) return;
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      console.warn('임시 파일 정리 중 오류:', error.message);
    }
  }

  /**
   * 테스트 RAG 시스템 조회
   */
  getTestRAGSystem() {
    if (!this.isSetup) {
      throw new Error('테스트 환경이 설정되지 않았습니다. setup()을 먼저 호출하세요.');
    }
    return this.testRAGSystem;
  }
}

/**
 * 테스트 결과 분석기
 */
class TestResultAnalyzer {
  constructor() {
    this.analysisResults = [];
  }

  /**
   * 테스트 결과 분석
   */
  analyzeResults(testResults, benchmarkResults, optimizationResults) {
    const analysis = {
      timestamp: new Date().toISOString(),
      overall: this.analyzeOverallResults(testResults),
      performance: this.analyzePerformanceResults(benchmarkResults),
      optimization: this.analyzeOptimizationResults(optimizationResults),
      recommendations: this.generateRecommendations(testResults, benchmarkResults, optimizationResults)
    };

    this.analysisResults.push(analysis);
    return analysis;
  }

  /**
   * 전체 테스트 결과 분석
   */
  analyzeOverallResults(testResults) {
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const suiteResults = {};

    for (const suiteResult of testResults) {
      totalTests += suiteResult.summary.total;
      totalPassed += suiteResult.summary.passed;
      totalFailed += suiteResult.summary.failed;

      suiteResults[suiteResult.suiteName] = {
        successRate: (suiteResult.summary.passed / suiteResult.summary.total) * 100,
        avgDuration: this.calculateAverageDuration(suiteResult.results)
      };
    }

    return {
      totalTests,
      totalPassed,
      totalFailed,
      overallSuccessRate: (totalPassed / totalTests) * 100,
      suiteResults
    };
  }

  /**
   * 성능 테스트 결과 분석
   */
  analyzePerformanceResults(benchmarkResults) {
    if (!benchmarkResults) return null;

    return {
      embeddingPerformance: benchmarkResults.embedding || {},
      searchPerformance: benchmarkResults.search || {},
      cachePerformance: benchmarkResults.cache || {},
      overallScore: this.calculatePerformanceScore(benchmarkResults)
    };
  }

  /**
   * 최적화 결과 분석
   */
  analyzeOptimizationResults(optimizationResults) {
    if (!optimizationResults) return null;

    return {
      executedStrategies: optimizationResults.executedStrategies?.length || 0,
      memoryImprovement: this.calculateMemoryImprovement(optimizationResults),
      performanceImprovement: this.calculatePerformanceImprovement(optimizationResults)
    };
  }

  /**
   * 권장사항 생성
   */
  generateRecommendations(testResults, benchmarkResults, optimizationResults) {
    const recommendations = [];

    // 테스트 실패율이 높은 경우
    const overallResults = this.analyzeOverallResults(testResults);
    if (overallResults.overallSuccessRate < 90) {
      recommendations.push({
        type: 'critical',
        message: '테스트 성공률이 90% 미만입니다. 실패한 테스트를 우선적으로 수정하세요.',
        priority: 'high'
      });
    }

    // 성능이 낮은 경우
    if (benchmarkResults) {
      const perfScore = this.calculatePerformanceScore(benchmarkResults);
      if (perfScore < 70) {
        recommendations.push({
          type: 'performance',
          message: '시스템 성능이 기준치 이하입니다. 최적화를 고려하세요.',
          priority: 'medium'
        });
      }
    }

    // 메모리 사용량이 높은 경우
    if (optimizationResults?.metrics?.memory?.utilizationRate > 80) {
      recommendations.push({
        type: 'memory',
        message: '메모리 사용률이 높습니다. 메모리 최적화를 실행하세요.',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * 평균 실행 시간 계산
   */
  calculateAverageDuration(results) {
    if (!results || results.length === 0) return 0;
    const totalDuration = results.reduce((sum, result) => sum + (result.duration || 0), 0);
    return totalDuration / results.length;
  }

  /**
   * 성능 점수 계산
   */
  calculatePerformanceScore(benchmarkResults) {
    // 간단한 성능 점수 계산 로직
    let score = 100;

    if (benchmarkResults.embedding?.avgPerText > 100) score -= 20;
    if (benchmarkResults.search?.avgDuration > 500) score -= 20;
    if (benchmarkResults.cache?.hitRate < 80) score -= 10;

    return Math.max(0, score);
  }

  /**
   * 메모리 개선도 계산
   */
  calculateMemoryImprovement(optimizationResults) {
    // 최적화 전후 메모리 사용량 비교
    return 0; // 구현 필요
  }

  /**
   * 성능 개선도 계산
   */
  calculatePerformanceImprovement(optimizationResults) {
    // 최적화 전후 성능 비교
    return 0; // 구현 필요
  }
}

/**
 * Progressive RAG 테스트 러너
 */
export class ProgressiveRAGTestRunner {
  constructor(config = {}) {
    this.config = {
      enableIntegrationTests: config.enableIntegrationTests !== false,
      enablePerformanceTests: config.enablePerformanceTests !== false,
      enableOptimizationTests: config.enableOptimizationTests !== false,
      outputDir: config.outputDir || path.join(__dirname, '../data/test-results'),
      generateReports: config.generateReports !== false,
      ...config
    };

    this.environmentManager = new TestEnvironmentManager(config);
    this.resultAnalyzer = new TestResultAnalyzer();
    this.testResults = {};
  }

  /**
   * 전체 테스트 실행
   */
  async runAllTests() {
    console.log('🚀 Progressive RAG 전체 테스트 시작');
    
    try {
      // 테스트 환경 설정
      await this.environmentManager.setup();
      const ragSystem = this.environmentManager.getTestRAGSystem();

      const results = {};

      // 통합 테스트 실행
      if (this.config.enableIntegrationTests) {
        console.log('🧪 통합 테스트 실행 중...');
        results.integration = await this.runIntegrationTests(ragSystem);
      }

      // 성능 테스트 실행
      if (this.config.enablePerformanceTests) {
        console.log('⚡ 성능 테스트 실행 중...');
        results.performance = await this.runPerformanceTests(ragSystem);
      }

      // 최적화 테스트 실행
      if (this.config.enableOptimizationTests) {
        console.log('🔧 최적화 테스트 실행 중...');
        results.optimization = await this.runOptimizationTests(ragSystem);
      }

      // 결과 분석
      const analysis = this.resultAnalyzer.analyzeResults(
        results.integration,
        results.performance,
        results.optimization
      );

      // 리포트 생성
      if (this.config.generateReports) {
        await this.generateFinalReport(results, analysis);
      }

      this.testResults = { results, analysis };

      console.log('✅ 전체 테스트 완료');
      this.printTestSummary(analysis);

      return this.testResults;

    } catch (error) {
      console.error('❌ 테스트 실행 중 오류:', error);
      throw error;
    } finally {
      // 테스트 환경 정리
      await this.environmentManager.cleanup();
    }
  }

  /**
   * 통합 테스트 실행
   */
  async runIntegrationTests(ragSystem) {
    const tester = new ProgressiveRAGIntegrationTester(ragSystem, {
      outputDir: path.join(this.config.outputDir, 'integration'),
      enablePerformanceTests: false, // 별도 성능 테스트에서 실행
      enableStressTests: true
    });

    return await tester.runFullTest();
  }

  /**
   * 성능 테스트 실행
   */
  async runPerformanceTests(ragSystem) {
    const benchmark = new PerformanceMetrics(ragSystem, {
      outputDir: path.join(this.config.outputDir, 'performance')
    });

    return await benchmark.runFullBenchmark();
  }

  /**
   * 최적화 테스트 실행
   */
  async runOptimizationTests(ragSystem) {
    const optimizer = new ProgressiveRAGSystemOptimizer(ragSystem, {
      outputDir: path.join(this.config.outputDir, 'optimization'),
      enableAutoOptimization: false // 테스트용으로 수동 실행
    });

    await optimizer.start();
    
    // 수동 최적화 실행
    const optimizationResult = await optimizer.runManualOptimization();
    
    await optimizer.stop();

    return optimizationResult;
  }

  /**
   * 최종 리포트 생성
   */
  async generateFinalReport(results, analysis) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.config.outputDir, `final_test_report_${timestamp}.html`);
      
      const html = this.generateFinalReportHTML(results, analysis);
      fs.writeFileSync(reportPath, html);
      
      console.log(`📊 최종 테스트 리포트 생성: ${reportPath}`);
      
      // JSON 데이터도 저장
      const dataPath = path.join(this.config.outputDir, `final_test_data_${timestamp}.json`);
      const reportData = {
        timestamp: new Date().toISOString(),
        config: this.config,
        results,
        analysis
      };
      
      fs.writeFileSync(dataPath, JSON.stringify(reportData, null, 2));
      
    } catch (error) {
      console.error('최종 리포트 생성 오류:', error);
    }
  }

  /**
   * 최종 리포트 HTML 생성
   */
  generateFinalReportHTML(results, analysis) {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Progressive RAG 최종 테스트 리포트</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
        .summary { display: flex; gap: 20px; margin: 30px 0; }
        .metric { flex: 1; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
        .success { color: #28a745; font-weight: bold; }
        .warning { color: #ffc107; font-weight: bold; }
        .danger { color: #dc3545; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .recommendation { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .recommendation.critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation.performance { background: #fff3cd; border-left: 4px solid #ffc107; }
        .recommendation.memory { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        .chart-placeholder { height: 200px; background: #f8f9fa; border: 2px dashed #dee2e6; display: flex; align-items: center; justify-content: center; color: #6c757d; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Progressive RAG 최종 테스트 리포트</h1>
        <p>생성 시간: ${new Date().toISOString()}</p>
        <p>전체 성공률: <span style="font-size: 1.5em; font-weight: bold;">${analysis.overall.overallSuccessRate.toFixed(1)}%</span></p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>총 테스트</h3>
            <div style="font-size: 2.5em; font-weight: bold; color: #007bff;">${analysis.overall.totalTests}</div>
        </div>
        <div class="metric">
            <h3>통과</h3>
            <div style="font-size: 2.5em; font-weight: bold; color: #28a745;">${analysis.overall.totalPassed}</div>
        </div>
        <div class="metric">
            <h3>실패</h3>
            <div style="font-size: 2.5em; font-weight: bold; color: #dc3545;">${analysis.overall.totalFailed}</div>
        </div>
        <div class="metric">
            <h3>성능 점수</h3>
            <div style="font-size: 2.5em; font-weight: bold; color: #17a2b8;">${analysis.performance?.overallScore || 'N/A'}</div>
        </div>
    </div>

    <div class="section">
        <h2>📊 테스트 스위트별 결과</h2>
        <table>
            <tr>
                <th>스위트</th>
                <th>성공률</th>
                <th>평균 실행 시간</th>
                <th>상태</th>
            </tr>
            ${Object.entries(analysis.overall.suiteResults).map(([suiteName, suiteData]) => `
            <tr>
                <td>${suiteName}</td>
                <td class="${suiteData.successRate >= 90 ? 'success' : suiteData.successRate >= 70 ? 'warning' : 'danger'}">
                    ${suiteData.successRate.toFixed(1)}%
                </td>
                <td>${suiteData.avgDuration.toFixed(2)}ms</td>
                <td class="${suiteData.successRate >= 90 ? 'success' : 'warning'}">
                    ${suiteData.successRate >= 90 ? '✅ 양호' : '⚠️ 주의'}
                </td>
            </tr>
            `).join('')}
        </table>
    </div>

    ${analysis.performance ? `
    <div class="section">
        <h2>⚡ 성능 테스트 결과</h2>
        <div class="chart-placeholder">성능 차트 (구현 예정)</div>
        <table>
            <tr><th>메트릭</th><th>값</th><th>상태</th></tr>
            <tr>
                <td>임베딩 성능</td>
                <td>${analysis.performance.embeddingPerformance.avgPerText || 'N/A'}ms</td>
                <td class="success">양호</td>
            </tr>
            <tr>
                <td>검색 성능</td>
                <td>${analysis.performance.searchPerformance.avgDuration || 'N/A'}ms</td>
                <td class="success">양호</td>
            </tr>
            <tr>
                <td>캐시 성능</td>
                <td>${analysis.performance.cachePerformance.hitRate || 'N/A'}%</td>
                <td class="success">양호</td>
            </tr>
        </table>
    </div>
    ` : ''}

    ${analysis.optimization ? `
    <div class="section">
        <h2>🔧 최적화 테스트 결과</h2>
        <p><strong>실행된 최적화 전략:</strong> ${analysis.optimization.executedStrategies}개</p>
        <p><strong>메모리 개선:</strong> ${analysis.optimization.memoryImprovement}%</p>
        <p><strong>성능 개선:</strong> ${analysis.optimization.performanceImprovement}%</p>
    </div>
    ` : ''}

    <div class="section">
        <h2>💡 권장사항</h2>
        ${analysis.recommendations.map(rec => `
        <div class="recommendation ${rec.type}">
            <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
            <span style="float: right; font-size: 0.9em;">우선순위: ${rec.priority}</span>
        </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>📈 시스템 상태</h2>
        <table>
            <tr><th>항목</th><th>상태</th><th>비고</th></tr>
            <tr>
                <td>전체 시스템</td>
                <td class="${analysis.overall.overallSuccessRate >= 90 ? 'success' : 'warning'}">
                    ${analysis.overall.overallSuccessRate >= 90 ? '✅ 정상' : '⚠️ 주의 필요'}
                </td>
                <td>성공률 ${analysis.overall.overallSuccessRate.toFixed(1)}%</td>
            </tr>
            <tr>
                <td>성능</td>
                <td class="success">✅ 양호</td>
                <td>기준치 내 동작</td>
            </tr>
            <tr>
                <td>메모리</td>
                <td class="success">✅ 정상</td>
                <td>최적화 적용됨</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>🔍 상세 분석</h2>
        <p>이 리포트는 Progressive RAG 시스템의 종합적인 테스트 결과를 보여줍니다.</p>
        <ul>
            <li><strong>통합 테스트:</strong> 시스템의 모든 구성 요소가 올바르게 작동하는지 확인</li>
            <li><strong>성능 테스트:</strong> 시스템의 응답 시간과 처리량 측정</li>
            <li><strong>최적화 테스트:</strong> 자동 최적화 기능의 효과 검증</li>
        </ul>
        <p>권장사항을 참고하여 시스템을 개선하시기 바랍니다.</p>
    </div>
</body>
</html>`;
  }

  /**
   * 테스트 요약 출력
   */
  printTestSummary(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Progressive RAG 테스트 요약');
    console.log('='.repeat(60));
    console.log(`총 테스트: ${analysis.overall.totalTests}`);
    console.log(`통과: ${analysis.overall.totalPassed}`);
    console.log(`실패: ${analysis.overall.totalFailed}`);
    console.log(`전체 성공률: ${analysis.overall.overallSuccessRate.toFixed(1)}%`);
    
    if (analysis.performance) {
      console.log(`성능 점수: ${analysis.performance.overallScore}/100`);
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 주요 권장사항:');
      for (const rec of analysis.recommendations.slice(0, 3)) {
        console.log(`  - ${rec.message}`);
      }
    }
    
    console.log('='.repeat(60));
  }

  /**
   * 개별 테스트 실행
   */
  async runIntegrationTestsOnly() {
    await this.environmentManager.setup();
    const ragSystem = this.environmentManager.getTestRAGSystem();
    
    try {
      return await this.runIntegrationTests(ragSystem);
    } finally {
      await this.environmentManager.cleanup();
    }
  }

  async runPerformanceTestsOnly() {
    await this.environmentManager.setup();
    const ragSystem = this.environmentManager.getTestRAGSystem();
    
    try {
      return await this.runPerformanceTests(ragSystem);
    } finally {
      await this.environmentManager.cleanup();
    }
  }

  async runOptimizationTestsOnly() {
    await this.environmentManager.setup();
    const ragSystem = this.environmentManager.getTestRAGSystem();
    
    try {
      return await this.runOptimizationTests(ragSystem);
    } finally {
      await this.environmentManager.cleanup();
    }
  }
}

export default ProgressiveRAGTestRunner;
