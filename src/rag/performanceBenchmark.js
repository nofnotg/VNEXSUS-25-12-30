/**
 * Progressive RAG 성능 벤치마킹 도구
 * 
 * 시스템 성능 측정, 최적화 지점 식별, 성능 리포트 생성
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 성능 메트릭 수집기
 */
class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
    this.memoryBaseline = process.memoryUsage();
  }

  /**
   * 측정 시작
   */
  startMeasurement(name) {
    this.startTimes.set(name, performance.now());
  }

  /**
   * 측정 종료
   */
  endMeasurement(name) {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      throw new Error(`측정이 시작되지 않음: ${name}`);
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(name);

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name).push({
      duration,
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage()
    });

    return duration;
  }

  /**
   * 메트릭 통계 계산
   */
  getStats(name) {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map(m => m.duration);
    const sorted = durations.sort((a, b) => a - b);

    return {
      count: measurements.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * 모든 메트릭 조회
   */
  getAllStats() {
    const stats = {};
    for (const name of this.metrics.keys()) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  /**
   * 메모리 사용량 측정
   */
  getMemoryUsage() {
    const current = process.memoryUsage();
    return {
      current,
      baseline: this.memoryBaseline,
      diff: {
        rss: current.rss - this.memoryBaseline.rss,
        heapTotal: current.heapTotal - this.memoryBaseline.heapTotal,
        heapUsed: current.heapUsed - this.memoryBaseline.heapUsed,
        external: current.external - this.memoryBaseline.external
      }
    };
  }

  /**
   * 메트릭 초기화
   */
  reset() {
    this.metrics.clear();
    this.startTimes.clear();
    this.memoryBaseline = process.memoryUsage();
  }
}

/**
 * Progressive RAG 벤치마크 도구
 */
export class ProgressiveRAGBenchmark {
  constructor(ragSystem, config = {}) {
    this.ragSystem = ragSystem;
    this.config = {
      testDataSize: config.testDataSize || 100,
      iterations: config.iterations || 10,
      outputDir: config.outputDir || path.join(__dirname, '../data/benchmarks'),
      enableDetailedLogging: config.enableDetailedLogging !== false,
      ...config
    };

    this.metrics = new PerformanceMetrics();
    this.testData = [];
    this.results = {};
  }

  /**
   * 벤치마크 초기화
   */
  async initialize() {
    try {
      // 출력 디렉토리 생성
      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }

      // 테스트 데이터 생성
      await this.generateTestData();

      console.log('✅ 벤치마크 도구 초기화 완료');
      
    } catch (error) {
      console.error('벤치마크 초기화 오류:', error);
      throw error;
    }
  }

  /**
   * 테스트 데이터 생성
   */
  async generateTestData() {
    const medicalTerms = [
      '고혈압', '당뇨병', '심근경색', '뇌졸중', '폐렴', '천식', '관절염',
      '위염', '간염', '신부전', '심부전', '부정맥', '협심증', '골절',
      '화상', '감염', '알레르기', '빈혈', '백혈병', '암', '종양',
      '수술', '마취', '입원', '외래', '응급실', '중환자실', '검사',
      '진단', '치료', '처방', '약물', '항생제', '진통제', '해열제'
    ];

    const icdCodes = [
      'I10', 'E11', 'I21', 'I63', 'J18', 'J45', 'M79',
      'K29', 'B19', 'N18', 'I50', 'I49', 'I20', 'S72',
      'T30', 'A49', 'T78', 'D50', 'C95', 'C80', 'D48'
    ];

    this.testData = [];

    // 의료 용어 테스트 데이터
    for (let i = 0; i < this.config.testDataSize / 2; i++) {
      const term = medicalTerms[Math.floor(Math.random() * medicalTerms.length)];
      this.testData.push({
        type: 'medical_term',
        query: term,
        expectedType: 'term'
      });
    }

    // ICD 코드 테스트 데이터
    for (let i = 0; i < this.config.testDataSize / 2; i++) {
      const code = icdCodes[Math.floor(Math.random() * icdCodes.length)];
      this.testData.push({
        type: 'icd_code',
        query: code,
        expectedType: 'code'
      });
    }

    console.log(`📊 테스트 데이터 생성: ${this.testData.length}개`);
  }

  /**
   * 전체 벤치마크 실행
   */
  async runFullBenchmark() {
    console.log('🚀 Progressive RAG 벤치마크 시작');
    
    this.results = {
      timestamp: new Date().toISOString(),
      config: this.config,
      tests: {}
    };

    // 개별 기능 벤치마크
    await this.benchmarkEmbedding();
    await this.benchmarkVectorSearch();
    await this.benchmarkCaching();
    await this.benchmarkAutoSave();
    await this.benchmarkEndToEnd();

    // 메모리 사용량 측정
    this.results.memory = this.metrics.getMemoryUsage();

    // 결과 저장
    await this.saveResults();

    // 리포트 생성
    await this.generateReport();

    console.log('✅ 벤치마크 완료');
    return this.results;
  }

  /**
   * 임베딩 성능 벤치마크
   */
  async benchmarkEmbedding() {
    console.log('📊 임베딩 성능 측정 중...');

    const testQueries = this.testData.slice(0, 50).map(d => d.query);
    
    // 단일 임베딩 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const query of testQueries.slice(0, 10)) {
        this.metrics.startMeasurement('embedding_single');
        await this.ragSystem.embeddingService.getEmbedding(query);
        this.metrics.endMeasurement('embedding_single');
      }
    }

    // 배치 임베딩 성능
    for (let i = 0; i < this.config.iterations; i++) {
      this.metrics.startMeasurement('embedding_batch');
      await this.ragSystem.embeddingService.getBatchEmbeddings(testQueries);
      this.metrics.endMeasurement('embedding_batch');
    }

    this.results.tests.embedding = {
      single: this.metrics.getStats('embedding_single'),
      batch: this.metrics.getStats('embedding_batch')
    };
  }

  /**
   * 벡터 검색 성능 벤치마크
   */
  async benchmarkVectorSearch() {
    console.log('📊 벡터 검색 성능 측정 중...');

    // 테스트 데이터 벡터화
    const testVectors = [];
    for (const data of this.testData.slice(0, 20)) {
      const embedding = await this.ragSystem.embeddingService.getEmbedding(data.query);
      testVectors.push({
        id: `test_${testVectors.length}`,
        vector: embedding,
        metadata: { query: data.query, type: data.type }
      });
    }

    // 벡터 삽입 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const vector of testVectors.slice(0, 5)) {
        this.metrics.startMeasurement('vector_upsert');
        await this.ragSystem.vectorDatabase.upsert([vector]);
        this.metrics.endMeasurement('vector_upsert');
      }
    }

    // 벡터 검색 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const vector of testVectors.slice(0, 5)) {
        this.metrics.startMeasurement('vector_query');
        await this.ragSystem.vectorDatabase.query(vector.vector, 5);
        this.metrics.endMeasurement('vector_query');
      }
    }

    this.results.tests.vectorSearch = {
      upsert: this.metrics.getStats('vector_upsert'),
      query: this.metrics.getStats('vector_query')
    };
  }

  /**
   * 캐싱 성능 벤치마크
   */
  async benchmarkCaching() {
    console.log('📊 캐싱 성능 측정 중...');

    const testKeys = this.testData.slice(0, 20).map((d, i) => `cache_test_${i}`);
    const testValues = this.testData.slice(0, 20).map(d => ({ query: d.query, result: 'test_result' }));

    // 캐시 쓰기 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (let j = 0; j < testKeys.length; j++) {
        this.metrics.startMeasurement('cache_set');
        await this.ragSystem.cacheManager.set(testKeys[j], testValues[j]);
        this.metrics.endMeasurement('cache_set');
      }
    }

    // 캐시 읽기 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const key of testKeys) {
        this.metrics.startMeasurement('cache_get');
        await this.ragSystem.cacheManager.get(key);
        this.metrics.endMeasurement('cache_get');
      }
    }

    this.results.tests.caching = {
      set: this.metrics.getStats('cache_set'),
      get: this.metrics.getStats('cache_get')
    };
  }

  /**
   * 자동 저장 성능 벤치마크
   */
  async benchmarkAutoSave() {
    console.log('📊 자동 저장 성능 측정 중...');

    const testResults = this.testData.slice(0, 20).map((d, i) => ({
      id: `autosave_test_${i}`,
      query: d.query,
      result: { analysis: 'test_analysis', confidence: 0.95 }
    }));

    // 저장 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const result of testResults.slice(0, 5)) {
        this.metrics.startMeasurement('autosave_save');
        await this.ragSystem.autoSaveManager.saveAnalysisResult(result.id, result);
        this.metrics.endMeasurement('autosave_save');
      }
    }

    // 조회 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const result of testResults.slice(0, 5)) {
        this.metrics.startMeasurement('autosave_get');
        await this.ragSystem.autoSaveManager.getAnalysisResult(result.id);
        this.metrics.endMeasurement('autosave_get');
      }
    }

    this.results.tests.autoSave = {
      save: this.metrics.getStats('autosave_save'),
      get: this.metrics.getStats('autosave_get')
    };
  }

  /**
   * 엔드투엔드 성능 벤치마크
   */
  async benchmarkEndToEnd() {
    console.log('📊 엔드투엔드 성능 측정 중...');

    // 전체 검색 프로세스 성능
    for (let i = 0; i < this.config.iterations; i++) {
      for (const data of this.testData.slice(0, 10)) {
        this.metrics.startMeasurement('e2e_search');
        
        // 임베딩 생성
        const embedding = await this.ragSystem.embeddingService.getEmbedding(data.query);
        
        // 벡터 검색
        const searchResults = await this.ragSystem.vectorDatabase.query(embedding, 5);
        
        // 결과 저장
        await this.ragSystem.autoSaveManager.saveAnalysisResult(
          `e2e_${Date.now()}_${i}`,
          { query: data.query, results: searchResults }
        );
        
        this.metrics.endMeasurement('e2e_search');
      }
    }

    this.results.tests.endToEnd = {
      search: this.metrics.getStats('e2e_search')
    };
  }

  /**
   * 결과 저장
   */
  async saveResults() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(this.config.outputDir, `benchmark_${timestamp}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
      console.log(`💾 벤치마크 결과 저장: ${filePath}`);
      
    } catch (error) {
      console.error('결과 저장 오류:', error);
    }
  }

  /**
   * 성능 리포트 생성
   */
  async generateReport() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.config.outputDir, `report_${timestamp}.html`);
      
      const html = this.generateHTMLReport();
      fs.writeFileSync(reportPath, html);
      
      console.log(`📊 성능 리포트 생성: ${reportPath}`);
      
    } catch (error) {
      console.error('리포트 생성 오류:', error);
    }
  }

  /**
   * HTML 리포트 생성
   */
  generateHTMLReport() {
    const { tests, memory, timestamp } = this.results;
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Progressive RAG 성능 벤치마크 리포트</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .good { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Progressive RAG 성능 벤치마크 리포트</h1>
        <p><strong>생성 시간:</strong> ${timestamp}</p>
        <p><strong>테스트 데이터 크기:</strong> ${this.config.testDataSize}</p>
        <p><strong>반복 횟수:</strong> ${this.config.iterations}</p>
    </div>

    <div class="section">
        <h2>📊 성능 요약</h2>
        <div class="metric">
            <strong>임베딩 평균 시간:</strong> ${tests.embedding?.single?.avg?.toFixed(2) || 'N/A'}ms
        </div>
        <div class="metric">
            <strong>벡터 검색 평균 시간:</strong> ${tests.vectorSearch?.query?.avg?.toFixed(2) || 'N/A'}ms
        </div>
        <div class="metric">
            <strong>캐시 조회 평균 시간:</strong> ${tests.caching?.get?.avg?.toFixed(2) || 'N/A'}ms
        </div>
        <div class="metric">
            <strong>E2E 검색 평균 시간:</strong> ${tests.endToEnd?.search?.avg?.toFixed(2) || 'N/A'}ms
        </div>
    </div>

    <div class="section">
        <h2>🧠 메모리 사용량</h2>
        <table>
            <tr>
                <th>메트릭</th>
                <th>현재 (MB)</th>
                <th>기준선 (MB)</th>
                <th>차이 (MB)</th>
            </tr>
            <tr>
                <td>RSS</td>
                <td>${(memory.current.rss / 1024 / 1024).toFixed(2)}</td>
                <td>${(memory.baseline.rss / 1024 / 1024).toFixed(2)}</td>
                <td>${(memory.diff.rss / 1024 / 1024).toFixed(2)}</td>
            </tr>
            <tr>
                <td>Heap Used</td>
                <td>${(memory.current.heapUsed / 1024 / 1024).toFixed(2)}</td>
                <td>${(memory.baseline.heapUsed / 1024 / 1024).toFixed(2)}</td>
                <td>${(memory.diff.heapUsed / 1024 / 1024).toFixed(2)}</td>
            </tr>
        </table>
    </div>

    ${Object.entries(tests).map(([testName, testResults]) => `
    <div class="section">
        <h2>📈 ${testName} 상세 결과</h2>
        ${Object.entries(testResults).map(([operation, stats]) => `
        <h3>${operation}</h3>
        <table>
            <tr>
                <th>메트릭</th>
                <th>값</th>
            </tr>
            <tr><td>횟수</td><td>${stats.count}</td></tr>
            <tr><td>평균 (ms)</td><td>${stats.avg?.toFixed(2)}</td></tr>
            <tr><td>최소 (ms)</td><td>${stats.min?.toFixed(2)}</td></tr>
            <tr><td>최대 (ms)</td><td>${stats.max?.toFixed(2)}</td></tr>
            <tr><td>중간값 (ms)</td><td>${stats.median?.toFixed(2)}</td></tr>
            <tr><td>95% (ms)</td><td>${stats.p95?.toFixed(2)}</td></tr>
            <tr><td>99% (ms)</td><td>${stats.p99?.toFixed(2)}</td></tr>
        </table>
        `).join('')}
    </div>
    `).join('')}

    <div class="section">
        <h2>💡 최적화 권장사항</h2>
        <ul>
            ${this.generateOptimizationRecommendations().map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }

  /**
   * 최적화 권장사항 생성
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    const { tests } = this.results;

    // 임베딩 성능 분석
    if (tests.embedding?.single?.avg > 100) {
      recommendations.push('임베딩 생성 시간이 느립니다. 캐싱 전략을 강화하거나 더 빠른 모델을 고려하세요.');
    }

    // 벡터 검색 성능 분석
    if (tests.vectorSearch?.query?.avg > 50) {
      recommendations.push('벡터 검색 시간이 느립니다. 인덱스 최적화나 차원 축소를 고려하세요.');
    }

    // 캐시 성능 분석
    if (tests.caching?.get?.avg > 10) {
      recommendations.push('캐시 조회 시간이 느립니다. 메모리 캐시 크기를 늘리거나 캐시 구조를 최적화하세요.');
    }

    // E2E 성능 분석
    if (tests.endToEnd?.search?.avg > 500) {
      recommendations.push('전체 검색 프로세스가 느립니다. 병렬 처리나 파이프라인 최적화를 고려하세요.');
    }

    // 메모리 사용량 분석
    const memoryIncrease = this.results.memory.diff.heapUsed / 1024 / 1024;
    if (memoryIncrease > 100) {
      recommendations.push(`메모리 사용량이 ${memoryIncrease.toFixed(2)}MB 증가했습니다. 메모리 누수를 확인하세요.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('모든 성능 지표가 양호합니다. 현재 설정을 유지하세요.');
    }

    return recommendations;
  }

  /**
   * 성능 비교 (이전 결과와)
   */
  async compareWithPrevious() {
    try {
      const files = fs.readdirSync(this.config.outputDir)
        .filter(file => file.startsWith('benchmark_') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length < 2) {
        console.log('비교할 이전 결과가 없습니다.');
        return null;
      }

      const previousFile = files[1]; // 두 번째로 최신 파일
      const previousPath = path.join(this.config.outputDir, previousFile);
      const previousResults = JSON.parse(fs.readFileSync(previousPath, 'utf8'));

      const comparison = this.generateComparison(previousResults, this.results);
      
      const comparisonPath = path.join(this.config.outputDir, `comparison_${Date.now()}.json`);
      fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));

      console.log(`📊 성능 비교 결과 저장: ${comparisonPath}`);
      return comparison;

    } catch (error) {
      console.error('성능 비교 오류:', error);
      return null;
    }
  }

  /**
   * 성능 비교 데이터 생성
   */
  generateComparison(previous, current) {
    const comparison = {
      timestamp: new Date().toISOString(),
      previous: previous.timestamp,
      current: current.timestamp,
      improvements: {},
      regressions: {}
    };

    // 각 테스트별 비교
    for (const [testName, currentTest] of Object.entries(current.tests)) {
      const previousTest = previous.tests[testName];
      if (!previousTest) continue;

      comparison.improvements[testName] = {};
      comparison.regressions[testName] = {};

      for (const [operation, currentStats] of Object.entries(currentTest)) {
        const previousStats = previousTest[operation];
        if (!previousStats) continue;

        const improvement = ((previousStats.avg - currentStats.avg) / previousStats.avg) * 100;
        
        if (improvement > 5) {
          comparison.improvements[testName][operation] = {
            improvement: improvement.toFixed(2) + '%',
            previous: previousStats.avg.toFixed(2) + 'ms',
            current: currentStats.avg.toFixed(2) + 'ms'
          };
        } else if (improvement < -5) {
          comparison.regressions[testName][operation] = {
            regression: Math.abs(improvement).toFixed(2) + '%',
            previous: previousStats.avg.toFixed(2) + 'ms',
            current: currentStats.avg.toFixed(2) + 'ms'
          };
        }
      }
    }

    return comparison;
  }
}

export default ProgressiveRAGBenchmark;