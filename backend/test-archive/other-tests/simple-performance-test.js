/**
 * 간단한 하이브리드 프로세서 성능 테스트
 */

import HybridProcessor from './hybridProcessor.js';

console.log('🧪 하이브리드 프로세서 성능 테스트 시작\n');

// 테스트 문서
const testDocument = `
환자명: 홍길동
생년월일: 1980-01-15
진료일: 2024-01-15
진단: 감기 증상 및 두통
처방: 해열제 1일 3회, 진통제 1일 2회
다음 진료 예정일: 2024-01-22
연락처: 010-1234-5678
`.trim();

async function runSimplePerformanceTest() {
  try {
    // 1. 룰 기반 전용 테스트
    console.log('=== 룰 기반 전용 모드 테스트 ===');
    const rulesOnlyProcessor = new HybridProcessor({
      useAIPreprocessing: false,
      fallbackToRules: true,
      enableCaching: true
    });
    
    const rulesStartTime = Date.now();
    const rulesResult = await rulesOnlyProcessor.processDocument(testDocument);
    const rulesEndTime = Date.now();
    const rulesProcessingTime = rulesEndTime - rulesStartTime;
    
    console.log(`✅ 룰 기반 처리 완료:`);
    console.log(`   - 처리 시간: ${rulesProcessingTime}ms`);
    console.log(`   - 추출된 필드: ${Object.keys(rulesResult.extractedData).length}개`);
    console.log(`   - 신뢰도: ${rulesResult.metadata.confidence}%`);
    console.log(`   - 정확도: ${rulesResult.metadata.accuracy}%`);
    
    // 2. 하이브리드 모드 테스트 (AI 폴백)
    console.log('\n=== 하이브리드 모드 테스트 (AI 폴백) ===');
    const hybridProcessor = new HybridProcessor({
      useAIPreprocessing: true,  // AI 시도하지만 API 키 없어서 폴백
      fallbackToRules: true,
      enableCaching: true
    });
    
    const hybridStartTime = Date.now();
    const hybridResult = await hybridProcessor.processDocument(testDocument);
    const hybridEndTime = Date.now();
    const hybridProcessingTime = hybridEndTime - hybridStartTime;
    
    console.log(`✅ 하이브리드 처리 완료:`);
    console.log(`   - 처리 시간: ${hybridProcessingTime}ms`);
    console.log(`   - 추출된 필드: ${Object.keys(hybridResult.extractedData).length}개`);
    console.log(`   - 신뢰도: ${hybridResult.metadata.confidence}%`);
    console.log(`   - 정확도: ${hybridResult.metadata.accuracy}%`);
    
    // 3. 성능 비교
    console.log('\n📊 성능 비교 분석:');
    const speedDiff = ((hybridProcessingTime - rulesProcessingTime) / rulesProcessingTime) * 100;
    
    console.log(`🚀 처리 속도:`);
    console.log(`   - 룰 기반: ${rulesProcessingTime}ms`);
    console.log(`   - 하이브리드: ${hybridProcessingTime}ms`);
    console.log(`   - 차이: ${speedDiff > 0 ? '+' : ''}${Math.round(speedDiff)}%`);
    
    // 4. 메모리 사용량
    const memoryUsage = process.memoryUsage();
    console.log('\n💾 메모리 사용량:');
    console.log(`   - 힙 사용량: ${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 10) / 10}MB`);
    console.log(`   - 총 힙 크기: ${Math.round(memoryUsage.heapTotal / 1024 / 1024 * 10) / 10}MB`);
    
    // 5. 권장사항
    console.log('\n💡 성능 분석 결과:');
    
    if (speedDiff > 50) {
      console.log('   ⚠️ 하이브리드 모드에서 처리 속도가 50% 이상 느려짐');
      console.log('   💡 AI 초기화 오버헤드가 성능에 영향을 미침');
      console.log('   🔧 권장: 캐싱 최적화 또는 AI 모듈 지연 로딩 고려');
    } else if (speedDiff > 20) {
      console.log('   ⚠️ 하이브리드 모드에서 처리 속도가 약간 느려짐');
      console.log('   💡 AI 폴백 로직의 오버헤드가 존재');
      console.log('   🔧 권장: 폴백 조건 최적화');
    } else {
      console.log('   ✅ 성능 차이가 미미함 - 현재 구현이 효율적');
    }
    
    // 6. 프로세서 메트릭
    console.log('\n📈 프로세서 메트릭:');
    const rulesMetrics = rulesOnlyProcessor.getMetrics();
    const hybridMetrics = hybridProcessor.getMetrics();
    
    console.log(`   룰 기반 - 캐시 히트율: ${rulesMetrics.cacheHitRate.toFixed(2)}%`);
    console.log(`   하이브리드 - 캐시 히트율: ${hybridMetrics.cacheHitRate.toFixed(2)}%`);
    
    console.log('\n🎉 성능 테스트 완료!');
    
    return {
      rulesOnly: {
        processingTime: rulesProcessingTime,
        extractedFields: Object.keys(rulesResult.extractedData).length,
        confidence: rulesResult.metadata.confidence,
        accuracy: rulesResult.metadata.accuracy
      },
      hybrid: {
        processingTime: hybridProcessingTime,
        extractedFields: Object.keys(hybridResult.extractedData).length,
        confidence: hybridResult.metadata.confidence,
        accuracy: hybridResult.metadata.accuracy
      },
      speedDiff
    };
    
  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error.message);
    throw error;
  }
}

// 테스트 실행
runSimplePerformanceTest()
  .then(results => {
    console.log('\n✅ 테스트 성공적으로 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 테스트 실행 실패:', error);
    process.exit(1);
  });