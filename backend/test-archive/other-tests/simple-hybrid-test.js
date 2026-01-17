/**
 * 하이브리드 프로세서 간단 테스트
 * AI 비활성화 옵션 테스트
 */

import HybridProcessor from './hybridProcessor.js';

async function testHybridProcessor() {
  console.log('🧪 하이브리드 프로세서 테스트 시작');
  
  try {
    // AI 비활성화 옵션으로 HybridProcessor 생성
    const processor = new HybridProcessor({
      useAIPreprocessing: false,  // 명시적으로 false 설정
      fallbackToRules: true,
      enableCaching: true
    });
    
    console.log('✅ HybridProcessor 생성 성공');
    
    // 100ms 대기 (비동기 초기화 완료 대기)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 테스트 문서
    const testDocument = `
    환자명: 홍길동
    생년월일: 1980-05-15
    진료일: 2024-01-15
    진단: 고혈압, 당뇨병
    처방: 혈압약 1일 2회, 당뇨약 1일 1회
    다음 진료 예정일: 2024-02-15
    연락처: 010-1234-5678
    이메일: hong@example.com
    진료비: 50,000원
    `;
    
    console.log('📄 테스트 문서 처리 중...');
    
    // 문서 처리
    const result = await processor.processDocument(testDocument);
    
    console.log('✅ 처리 결과:');
    console.log('- 처리 방법:', result.processingMethod);
    console.log('- 신뢰도:', result.confidence);
    console.log('- 추출된 날짜:', result.extractedData.dates);
    console.log('- 추출된 금액:', result.extractedData.amounts);
    console.log('- 추출된 엔티티:', result.extractedData.entities);
    
    // 메트릭 확인
    const metrics = processor.getMetrics();
    console.log('\n📊 성능 메트릭:');
    console.log('- 총 처리 문서:', metrics.totalProcessed);
    console.log('- 평균 처리 시간:', Math.round(metrics.averageProcessingTime), 'ms');
    console.log('- 캐시 히트율:', metrics.cacheHitRate.toFixed(2), '%');
    
    console.log('\n🎉 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 테스트 실행
testHybridProcessor();