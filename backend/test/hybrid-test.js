/**
 * 하이브리드 시스템 통합 테스트
 * Phase 2 - UI 통합 및 라우터 구축 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 결과 저장
const testResults = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

/**
 * 테스트 실행 함수
 */
function runTest(testName, testFunction) {
  console.log(`\n🧪 테스트 실행: ${testName}`);
  testResults.summary.total++;
  
  try {
    const result = testFunction();
    if (result) {
      console.log(`✅ ${testName} - 통과`);
      testResults.tests.push({
        name: testName,
        status: 'PASSED',
        message: '테스트 통과'
      });
      testResults.summary.passed++;
    } else {
      console.log(`❌ ${testName} - 실패`);
      testResults.tests.push({
        name: testName,
        status: 'FAILED',
        message: '테스트 실패'
      });
      testResults.summary.failed++;
    }
  } catch (error) {
    console.log(`❌ ${testName} - 오류: ${error.message}`);
    testResults.tests.push({
      name: testName,
      status: 'ERROR',
      message: error.message
    });
    testResults.summary.failed++;
  }
}

/**
 * 1. 하이브리드 컨트롤러 파일 존재 확인
 */
function testHybridControllerExists() {
  const controllerPath = path.join(__dirname, '../controllers/hybridController.js');
  return fs.existsSync(controllerPath);
}

/**
 * 2. 결과 통합 엔진 파일 존재 확인
 */
function testResultMergerExists() {
  const mergerPath = path.join(__dirname, '../services/resultMerger.js');
  return fs.existsSync(mergerPath);
}

/**
 * 3. 성능 모니터 파일 존재 확인
 */
function testPerformanceMonitorExists() {
  const monitorPath = path.join(__dirname, '../services/performanceMonitor.js');
  return fs.existsSync(monitorPath);
}

/**
 * 4. 하이브리드 라우터 파일 존재 확인
 */
function testHybridRoutesExists() {
  const routesPath = path.join(__dirname, '../routes/hybridRoutes.js');
  return fs.existsSync(routesPath);
}

/**
 * 5. 통합 UI 파일 존재 확인
 */
function testHybridInterfaceExists() {
  const interfacePath = path.join(__dirname, '../../frontend/src/components/HybridInterface.jsx');
  return fs.existsSync(interfacePath);
}

/**
 * 6. 성능 대시보드 파일 존재 확인
 */
function testPerformanceDashboardExists() {
  const dashboardPath = path.join(__dirname, '../../frontend/src/components/PerformanceDashboard.jsx');
  return fs.existsSync(dashboardPath);
}

/**
 * 7. 하이브리드 UI HTML 파일 존재 확인
 */
function testHybridHtmlExists() {
  const htmlPath = path.join(__dirname, '../../frontend/hybrid-interface.html');
  return fs.existsSync(htmlPath);
}

/**
 * 8. Phase 1 의존성 파일 존재 확인
 */
function testPhase1Dependencies() {
  const dateProcessorPath = path.join(__dirname, '../postprocess/hybridDateProcessor.js');
  const medicalNormalizerPath = path.join(__dirname, '../postprocess/hybridMedicalNormalizer.js');
  
  return fs.existsSync(dateProcessorPath) && fs.existsSync(medicalNormalizerPath);
}

/**
 * 9. 라우터 통합 확인 (app.js에서 하이브리드 라우터 import 확인)
 */
function testRouterIntegration() {
  const appPath = path.join(__dirname, '../app.js');
  if (!fs.existsSync(appPath)) return false;
  
  const appContent = fs.readFileSync(appPath, 'utf8');
  return appContent.includes('hybridRoutes') && 
         appContent.includes('/api/hybrid');
}

/**
 * 10. 컴포넌트 구조 검증
 */
function testComponentStructure() {
  const hybridControllerPath = path.join(__dirname, '../controllers/hybridController.js');
  if (!fs.existsSync(hybridControllerPath)) return false;
  
  const controllerContent = fs.readFileSync(hybridControllerPath, 'utf8');
  
  // 필수 클래스 및 메서드 존재 확인
  const requiredElements = [
    'class HybridController',
    'processDocument',
    'getSystemStatus',
    'getPerformanceMetrics',
    'HybridDateProcessor',
    'HybridMedicalNormalizer',
    'ResultMerger',
    'PerformanceMonitor'
  ];
  
  return requiredElements.every(element => controllerContent.includes(element));
}

/**
 * 테스트 실행
 */
async function runAllTests() {
  console.log('🚀 Phase 2 하이브리드 시스템 통합 테스트 시작');
  console.log('=' .repeat(60));
  
  // 백엔드 컴포넌트 테스트
  console.log('\n📦 백엔드 컴포넌트 테스트');
  runTest('하이브리드 컨트롤러 존재 확인', testHybridControllerExists);
  runTest('결과 통합 엔진 존재 확인', testResultMergerExists);
  runTest('성능 모니터 존재 확인', testPerformanceMonitorExists);
  runTest('하이브리드 라우터 존재 확인', testHybridRoutesExists);
  
  // 프론트엔드 컴포넌트 테스트
  console.log('\n🎨 프론트엔드 컴포넌트 테스트');
  runTest('통합 UI 컴포넌트 존재 확인', testHybridInterfaceExists);
  runTest('성능 대시보드 존재 확인', testPerformanceDashboardExists);
  runTest('하이브리드 HTML 파일 존재 확인', testHybridHtmlExists);
  
  // 통합 테스트
  console.log('\n🔗 시스템 통합 테스트');
  runTest('Phase 1 의존성 확인', testPhase1Dependencies);
  runTest('라우터 통합 확인', testRouterIntegration);
  runTest('컴포넌트 구조 검증', testComponentStructure);
  
  // 결과 출력
  console.log('\n' + '=' .repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log(`총 테스트: ${testResults.summary.total}`);
  console.log(`통과: ${testResults.summary.passed}`);
  console.log(`실패: ${testResults.summary.failed}`);
  console.log(`성공률: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
  
  // 실패한 테스트 상세 정보
  const failedTests = testResults.tests.filter(test => test.status !== 'PASSED');
  if (failedTests.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.message}`);
    });
  }
  
  // 테스트 결과를 파일로 저장
  const resultPath = path.join(__dirname, 'hybrid-test-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 테스트 결과가 저장되었습니다: ${resultPath}`);
  
  return testResults.summary.failed === 0;
}

// 테스트 실행
runAllTests().then(success => {
  if (success) {
    console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!');
    process.exit(0);
  } else {
    console.log('\n⚠️ 일부 테스트가 실패했습니다. 위의 결과를 확인해주세요.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 테스트 실행 중 오류 발생:', error);
  process.exit(1);
});