/**
 * 하이브리드 프로세서 성능 테스트
 * AI 활성화/비활성화 시나리오별 성능 비교
 */

import HybridProcessor from './hybridProcessor.js';

// 테스트 데이터 생성
function generateTestDocuments(count = 10) {
  const documents = [];
  
  for (let i = 0; i < count; i++) {
    documents.push(`
환자명: 홍길동${i}
생년월일: 1980-01-${String(i + 1).padStart(2, '0')}
진료일: 2024-01-${String(i + 1).padStart(2, '0')}
진단: 감기 증상 및 두통
처방: 해열제 1일 3회, 진통제 1일 2회
다음 진료 예정일: 2024-01-${String(i + 8).padStart(2, '0')}
연락처: 010-1234-${String(5678 + i).padStart(4, '0')}
    `.trim());
  }
  
  return documents;
}

// 성능 측정 함수
async function measurePerformance(processor, documents, testName) {
  console.log(`\n🔍 ${testName} 성능 테스트 시작`);
  
  const startTime = Date.now();
  const results = [];
  
  for (let i = 0; i < documents.length; i++) {
    const docStartTime = Date.now();
    
    try {
      const result = await processor.processDocument(documents[i]);
      const docEndTime = Date.now();
      
      results.push({
        docIndex: i,
        processingTime: docEndTime - docStartTime,
        success: true,
        extractedFields: Object.keys(result.extractedData).length,
        confidence: result.metadata.confidence,
        accuracy: result.metadata.accuracy
      });
      
    } catch (error) {
      const docEndTime = Date.now();
      results.push({
        docIndex: i,
        processingTime: docEndTime - docStartTime,
        success: false,
        error: error.message
      });
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // 성능 통계 계산
  const successfulResults = results.filter(r => r.success);
  const avgProcessingTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0) / successfulResults.length;
  const avgExtractedFields = successfulResults.reduce((sum, r) => sum + r.extractedFields, 0) / successfulResults.length;
  const avgConfidence = successfulResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulResults.length;
  const avgAccuracy = successfulResults.reduce((sum, r) => sum + (r.accuracy || 0), 0) / successfulResults.length;
  
  const stats = {
    testName,
    totalDocuments: documents.length,
    successfulProcessing: successfulResults.length,
    failedProcessing: results.length - successfulResults.length,
    totalTime,
    avgProcessingTime: Math.round(avgProcessingTime),
    avgExtractedFields: Math.round(avgExtractedFields * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 10) / 10,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    throughput: Math.round((documents.length / totalTime) * 1000 * 10) / 10, // docs per second
    processorMetrics: processor.getMetrics()
  };
  
  console.log(`✅ ${testName} 완료:`);
  console.log(`   - 총 처리 시간: ${totalTime}ms`);
  console.log(`   - 평균 문서 처리 시간: ${stats.avgProcessingTime}ms`);
  console.log(`   - 처리량: ${stats.throughput} docs/sec`);
  console.log(`   - 성공률: ${Math.round((stats.successfulProcessing / stats.totalDocuments) * 100)}%`);
  console.log(`   - 평균 추출 필드: ${stats.avgExtractedFields}`);
  console.log(`   - 평균 신뢰도: ${stats.avgConfidence}%`);
  console.log(`   - 평균 정확도: ${stats.avgAccuracy}%`);
  
  return stats;
}

// 메모리 사용량 측정
function measureMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 10) / 10, // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 10) / 10, // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 10) / 10, // MB
    external: Math.round(usage.external / 1024 / 1024 * 10) / 10 // MB
  };
}

// 성능 비교 분석
function analyzePerformance(rulesOnlyStats, hybridStats) {
  console.log('\n📊 성능 비교 분석:');
  
  const speedDiff = ((hybridStats.avgProcessingTime - rulesOnlyStats.avgProcessingTime) / rulesOnlyStats.avgProcessingTime) * 100;
  const throughputDiff = ((hybridStats.throughput - rulesOnlyStats.throughput) / rulesOnlyStats.throughput) * 100;
  const accuracyDiff = hybridStats.avgAccuracy - rulesOnlyStats.avgAccuracy;
  const confidenceDiff = hybridStats.avgConfidence - rulesOnlyStats.avgConfidence;
  
  console.log(`🚀 처리 속도:`);
  console.log(`   - 룰 기반: ${rulesOnlyStats.avgProcessingTime}ms`);
  console.log(`   - 하이브리드: ${hybridStats.avgProcessingTime}ms`);
  console.log(`   - 차이: ${speedDiff > 0 ? '+' : ''}${Math.round(speedDiff)}%`);
  
  console.log(`📈 처리량:`);
  console.log(`   - 룰 기반: ${rulesOnlyStats.throughput} docs/sec`);
  console.log(`   - 하이브리드: ${hybridStats.throughput} docs/sec`);
  console.log(`   - 차이: ${throughputDiff > 0 ? '+' : ''}${Math.round(throughputDiff)}%`);
  
  console.log(`🎯 정확도:`);
  console.log(`   - 룰 기반: ${rulesOnlyStats.avgAccuracy}%`);
  console.log(`   - 하이브리드: ${hybridStats.avgAccuracy}%`);
  console.log(`   - 차이: ${accuracyDiff > 0 ? '+' : ''}${Math.round(accuracyDiff * 10) / 10}%`);
  
  console.log(`🔍 신뢰도:`);
  console.log(`   - 룰 기반: ${rulesOnlyStats.avgConfidence}%`);
  console.log(`   - 하이브리드: ${hybridStats.avgConfidence}%`);
  console.log(`   - 차이: ${confidenceDiff > 0 ? '+' : ''}${Math.round(confidenceDiff * 10) / 10}%`);
  
  // 권장사항 생성
  const recommendations = [];
  
  if (speedDiff > 50) {
    recommendations.push('⚠️ 하이브리드 모드에서 처리 속도가 50% 이상 느려짐 - 캐싱 최적화 필요');
  }
  
  if (throughputDiff < -20) {
    recommendations.push('⚠️ 처리량이 20% 이상 감소 - 병렬 처리 고려 필요');
  }
  
  if (accuracyDiff < 10) {
    recommendations.push('💡 정확도 향상이 미미함 - AI 모델 튜닝 또는 룰 개선 필요');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ 성능이 양호함 - 현재 설정 유지 권장');
  }
  
  console.log('\n💡 권장사항:');
  recommendations.forEach(rec => console.log(`   ${rec}`));
  
  return {
    speedDiff,
    throughputDiff,
    accuracyDiff,
    confidenceDiff,
    recommendations
  };
}

// 메인 테스트 실행
async function runPerformanceTests() {
  console.log('🧪 하이브리드 프로세서 성능 테스트 시작\n');
  
  const testDocuments = generateTestDocuments(20);
  console.log(`📄 테스트 문서 ${testDocuments.length}개 생성 완료`);
  
  // 초기 메모리 사용량
  const initialMemory = measureMemoryUsage();
  console.log(`💾 초기 메모리 사용량: ${initialMemory.heapUsed}MB`);
  
  try {
    // 1. 룰 기반 전용 테스트
    console.log('\n=== 룰 기반 전용 모드 테스트 ===');
    const rulesOnlyProcessor = new HybridProcessor({
      useAIPreprocessing: false,
      fallbackToRules: true,
      enableCaching: true
    });
    
    const rulesOnlyStats = await measurePerformance(rulesOnlyProcessor, testDocuments, '룰 기반 전용');
    const rulesOnlyMemory = measureMemoryUsage();
    
    // 2. 하이브리드 모드 테스트 (AI 없이 - 폴백 시나리오)
    console.log('\n=== 하이브리드 모드 테스트 (AI 폴백) ===');
    const hybridProcessor = new HybridProcessor({
      useAIPreprocessing: true,  // AI 시도하지만 API 키 없어서 폴백
      fallbackToRules: true,
      enableCaching: true
    });
    
    const hybridStats = await measurePerformance(hybridProcessor, testDocuments, '하이브리드 (폴백)');
    const hybridMemory = measureMemoryUsage();
    
    // 3. 성능 비교 분석
    const analysis = analyzePerformance(rulesOnlyStats, hybridStats);
    
    // 4. 메모리 사용량 비교
    console.log('\n💾 메모리 사용량 비교:');
    console.log(`   - 초기: ${initialMemory.heapUsed}MB`);
    console.log(`   - 룰 기반 후: ${rulesOnlyMemory.heapUsed}MB (증가: +${rulesOnlyMemory.heapUsed - initialMemory.heapUsed}MB)`);
    console.log(`   - 하이브리드 후: ${hybridMemory.heapUsed}MB (증가: +${hybridMemory.heapUsed - initialMemory.heapUsed}MB)`);
    
    // 5. 캐시 성능 분석
    console.log('\n🗄️ 캐시 성능:');
    console.log(`   - 룰 기반 캐시 히트율: ${rulesOnlyStats.processorMetrics.cacheHitRate.toFixed(2)}%`);
    console.log(`   - 하이브리드 캐시 히트율: ${hybridStats.processorMetrics.cacheHitRate.toFixed(2)}%`);
    
    // 6. 최종 결과 요약
    console.log('\n📋 최종 성능 테스트 결과:');
    console.log(`   ✅ 총 ${testDocuments.length}개 문서 처리 완료`);
    console.log(`   ⚡ 룰 기반 평균 처리 시간: ${rulesOnlyStats.avgProcessingTime}ms`);
    console.log(`   🔄 하이브리드 평균 처리 시간: ${hybridStats.avgProcessingTime}ms`);
    console.log(`   📊 성능 차이: ${analysis.speedDiff > 0 ? '+' : ''}${Math.round(analysis.speedDiff)}%`);
    
    return {
      rulesOnlyStats,
      hybridStats,
      analysis,
      memoryUsage: {
        initial: initialMemory,
        rulesOnly: rulesOnlyMemory,
        hybrid: hybridMemory
      }
    };
    
  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error.message);
    throw error;
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests()
    .then(results => {
      console.log('\n🎉 성능 테스트 완료!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 테스트 실행 실패:', error);
      process.exit(1);
    });
}

export { runPerformanceTests, measurePerformance, analyzePerformance };