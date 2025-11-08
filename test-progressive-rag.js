/**
 * Progressive RAG 시스템 테스트 및 실행 스크립트
 * 
 * 시스템 초기화, 테스트 실행, 성능 검증을 위한 메인 스크립트
 */
import { ProgressiveRAGManager } from './src/rag/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 메인 테스트 실행 함수
 */
async function main() {
  console.log('🚀 Progressive RAG 시스템 테스트 시작');
  console.log('='.repeat(60));

  let ragManager = null;

  try {
    // Progressive RAG 매니저 생성
    ragManager = new ProgressiveRAGManager({
      // 기본 설정
      dataDir: path.join(__dirname, 'data'),
      cacheDir: path.join(__dirname, 'data/cache'),
      logDir: path.join(__dirname, 'logs'),
      
      // RAG 시스템 설정
      enableAutoSave: true,
      autoSaveInterval: 10000, // 10초 (테스트용)
      
      // 최적화 설정
      enableOptimization: true,
      optimizationInterval: 60000, // 1분 (테스트용)
      
      // 메모리 최적화 설정
      enableMemoryOptimization: true,
      memoryThreshold: 70, // 70%
      
      // 응답 시간 최적화 설정
      enableResponseOptimization: true,
      responseTimeThreshold: 500, // 0.5초
      
      // 테스트 설정
      enableTesting: true,
      testOnStartup: true,
      
      // 로깅 설정
      enableLogging: true,
      logLevel: 'info'
    });

    // 1단계: 시스템 초기화
    console.log('\n📋 1단계: 시스템 초기화');
    console.log('-'.repeat(40));
    await ragManager.initialize();

    // 2단계: 시스템 시작
    console.log('\n📋 2단계: 시스템 시작');
    console.log('-'.repeat(40));
    await ragManager.start();

    // 3단계: 기본 기능 테스트
    console.log('\n📋 3단계: 기본 기능 테스트');
    console.log('-'.repeat(40));
    await testBasicFunctionality(ragManager);

    // 4단계: 성능 테스트
    console.log('\n📋 4단계: 성능 테스트');
    console.log('-'.repeat(40));
    await testPerformance(ragManager);

    // 5단계: 전체 통합 테스트
    console.log('\n📋 5단계: 전체 통합 테스트');
    console.log('-'.repeat(40));
    await runFullIntegrationTests(ragManager);

    // 6단계: 최적화 테스트
    console.log('\n📋 6단계: 최적화 테스트');
    console.log('-'.repeat(40));
    await testOptimization(ragManager);

    // 7단계: 시스템 상태 확인
    console.log('\n📋 7단계: 시스템 상태 확인');
    console.log('-'.repeat(40));
    printFinalStatus(ragManager);

    console.log('\n✅ Progressive RAG 시스템 테스트 완료!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  } finally {
    // 시스템 정리
    if (ragManager) {
      console.log('\n🧹 시스템 정리 중...');
      try {
        await ragManager.stop();
        console.log('✅ 시스템 정리 완료');
      } catch (cleanupError) {
        console.error('❌ 시스템 정리 중 오류:', cleanupError);
      }
    }
  }
}

/**
 * 기본 기능 테스트
 */
async function testBasicFunctionality(ragManager) {
  console.log('🔍 기본 기능 테스트 시작...');

  try {
    // 의료 용어 검색 테스트
    console.log('  - 의료 용어 검색 테스트');
    const medicalResult = await ragManager.searchMedicalTerm('고혈압', {
      limit: 5,
      includeRelated: true
    });
    console.log(`    결과: ${medicalResult.results?.length || 0}개 항목 발견`);

    // ICD 코드 검색 테스트
    console.log('  - ICD 코드 검색 테스트');
    const icdResult = await ragManager.searchICDCode('I10', {
      limit: 5,
      includeDescription: true
    });
    console.log(`    결과: ${icdResult.results?.length || 0}개 항목 발견`);

    // 분석 결과 저장 테스트
    console.log('  - 분석 결과 저장 테스트');
    const analysisData = {
      id: `test-analysis-${Date.now()}`,
      type: 'medical_term_analysis',
      term: '고혈압',
      analysis: {
        category: 'cardiovascular',
        severity: 'moderate',
        relatedTerms: ['혈압', '심혈관질환', '고혈압성심질환']
      },
      timestamp: new Date().toISOString()
    };
    
    const saveResult = await ragManager.saveAnalysis(analysisData);
    console.log(`    결과: 분석 저장 ${saveResult.success ? '성공' : '실패'}`);

    console.log('✅ 기본 기능 테스트 완료');

  } catch (error) {
    console.error('❌ 기본 기능 테스트 실패:', error.message);
    throw error;
  }
}

/**
 * 성능 테스트
 */
async function testPerformance(ragManager) {
  console.log('⚡ 성능 테스트 시작...');

  try {
    const testTerms = ['고혈압', '당뇨병', '심근경색', '뇌졸중', '폐렴'];
    const testCodes = ['I10', 'E11', 'I21', 'I63', 'J18'];
    
    // 의료 용어 검색 성능 테스트
    console.log('  - 의료 용어 검색 성능 테스트');
    const medicalStartTime = Date.now();
    
    const medicalPromises = testTerms.map(term => 
      ragManager.searchMedicalTerm(term, { limit: 10 })
    );
    
    await Promise.all(medicalPromises);
    const medicalDuration = Date.now() - medicalStartTime;
    console.log(`    결과: ${testTerms.length}개 용어 검색 완료 (${medicalDuration}ms)`);

    // ICD 코드 검색 성능 테스트
    console.log('  - ICD 코드 검색 성능 테스트');
    const icdStartTime = Date.now();
    
    const icdPromises = testCodes.map(code => 
      ragManager.searchICDCode(code, { limit: 10 })
    );
    
    await Promise.all(icdPromises);
    const icdDuration = Date.now() - icdStartTime;
    console.log(`    결과: ${testCodes.length}개 코드 검색 완료 (${icdDuration}ms)`);

    // 동시 요청 성능 테스트
    console.log('  - 동시 요청 성능 테스트');
    const concurrentStartTime = Date.now();
    
    const concurrentPromises = [
      ...testTerms.map(term => ragManager.searchMedicalTerm(term)),
      ...testCodes.map(code => ragManager.searchICDCode(code))
    ];
    
    await Promise.all(concurrentPromises);
    const concurrentDuration = Date.now() - concurrentStartTime;
    console.log(`    결과: ${concurrentPromises.length}개 동시 요청 완료 (${concurrentDuration}ms)`);

    console.log('✅ 성능 테스트 완료');

  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error.message);
    throw error;
  }
}

/**
 * 전체 통합 테스트 실행
 */
async function runFullIntegrationTests(ragManager) {
  console.log('🧪 전체 통합 테스트 실행...');

  try {
    const testResults = await ragManager.runFullTests();
    
    if (testResults && testResults.analysis) {
      const analysis = testResults.analysis;
      console.log(`  - 총 테스트: ${analysis.overall.totalTests}`);
      console.log(`  - 통과: ${analysis.overall.totalPassed}`);
      console.log(`  - 실패: ${analysis.overall.totalFailed}`);
      console.log(`  - 성공률: ${analysis.overall.overallSuccessRate.toFixed(1)}%`);
      
      if (analysis.performance) {
        console.log(`  - 성능 점수: ${analysis.performance.overallScore}/100`);
      }
      
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        console.log('  - 권장사항:');
        for (const rec of analysis.recommendations.slice(0, 3)) {
          console.log(`    * ${rec.message}`);
        }
      }
    }

    console.log('✅ 전체 통합 테스트 완료');

  } catch (error) {
    console.error('❌ 전체 통합 테스트 실패:', error.message);
    // 통합 테스트 실패는 전체 테스트를 중단하지 않음
  }
}

/**
 * 최적화 테스트
 */
async function testOptimization(ragManager) {
  console.log('🔧 최적화 테스트 시작...');

  try {
    // 수동 최적화 실행
    console.log('  - 수동 최적화 실행');
    const optimizationResult = await ragManager.runOptimization();
    
    if (optimizationResult) {
      console.log(`    결과: ${optimizationResult.executedStrategies?.length || 0}개 최적화 전략 실행`);
      
      if (optimizationResult.metrics) {
        console.log('    메트릭:');
        console.log(`      - 성능: ${optimizationResult.metrics.performance?.score || 'N/A'}`);
        console.log(`      - 메모리: ${optimizationResult.metrics.memory?.utilizationRate || 'N/A'}%`);
        console.log(`      - 캐시: ${optimizationResult.metrics.cache?.hitRate || 'N/A'}%`);
      }
    }

    console.log('✅ 최적화 테스트 완료');

  } catch (error) {
    console.error('❌ 최적화 테스트 실패:', error.message);
    // 최적화 테스트 실패는 전체 테스트를 중단하지 않음
  }
}

/**
 * 최종 시스템 상태 출력
 */
function printFinalStatus(ragManager) {
  console.log('📊 최종 시스템 상태:');
  
  const status = ragManager.getSystemStatus();
  
  console.log(`  - 초기화 상태: ${status.isInitialized ? '✅ 완료' : '❌ 미완료'}`);
  console.log(`  - 실행 상태: ${status.isRunning ? '✅ 실행 중' : '❌ 정지됨'}`);
  console.log(`  - 가동 시간: ${Math.floor(status.uptime / 1000)}초`);
  console.log(`  - 총 쿼리: ${status.stats.totalQueries}`);
  console.log(`  - 총 분석: ${status.stats.totalAnalyses}`);
  console.log(`  - 총 최적화: ${status.stats.totalOptimizations}`);
  console.log(`  - 오류 수: ${status.stats.errors}`);
  console.log(`  - 메모리 사용량: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`);
}

/**
 * 에러 핸들링
 */
process.on('uncaughtException', (error) => {
  console.error('❌ 처리되지 않은 예외:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});

// 메인 함수 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ 메인 함수 실행 실패:', error);
    process.exit(1);
  });
}