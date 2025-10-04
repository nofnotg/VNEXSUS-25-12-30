/**
 * 간단한 하이브리드 프로세서 테스트
 */

async function testHybridProcessor() {
  try {
    console.log('🚀 하이브리드 프로세서 테스트 시작');
    
    // 동적 import 사용
    const { default: HybridProcessor } = await import('./src/preprocessing-ai/hybridProcessor.js');
    
    console.log('✅ HybridProcessor 모듈 로드 성공');
    console.log('HybridProcessor 타입:', typeof HybridProcessor);
    
    // 인스턴스 생성 테스트
    const processor = new HybridProcessor({
      aiModel: 'gpt-4o-mini',
      useAIPreprocessing: false, // AI 비활성화로 테스트
      fallbackToRules: true,
      enableCaching: false
    });
    
    // AI 초기화가 비동기이므로 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ HybridProcessor 인스턴스 생성 성공');
    
    // 간단한 텍스트로 테스트
    const testText = "2023-12-15 서울대학교병원 내과\n진단명: 고혈압";
    
    console.log('📄 간단한 텍스트 처리 테스트 시작...');
    
    const result = await processor.processDocument(testText, {
      startDate: '2023-01-01',
      endDate: '2024-12-31'
    });
    
    console.log('📊 처리 결과:');
    console.log('- 성공 여부:', result.success !== false);
    console.log('- 프로세스 ID:', result.processId);
    console.log('- 메타데이터:', result.processingMetadata);
    
    console.log('✅ 하이브리드 프로세서 기본 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error.message);
    console.error('스택 트레이스:', error.stack);
  }
}

testHybridProcessor();