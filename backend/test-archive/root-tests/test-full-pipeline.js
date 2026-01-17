// 전체 파이프라인 간단 테스트
console.log('=== 전체 파이프라인 테스트 ===');

async function testFullPipeline() {
  try {
    const { default: HybridController } = await import('./backend/controllers/hybridController.js');
    
    const controller = new HybridController();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    console.log('테스트 텍스트:', testText);
    console.log('\n=== executeUnifiedPipeline 실행 ===');
    
    const result = await controller.executeUnifiedPipeline(testText, {});
    
    console.log('\n=== 최종 결과 ===');
    console.log('성공:', result.success);
    console.log('processedData.dates 길이:', result.processedData?.dates?.length || 0);
    
    if (result.processedData?.dates?.length > 0) {
      console.log('첫 번째 날짜:', JSON.stringify(result.processedData.dates[0], null, 2));
    } else {
      console.log('❌ dates 배열이 비어있습니다!');
      
      // 디버깅 정보 출력
      console.log('\n=== 디버깅 정보 ===');
      console.log('전체 processedData:', JSON.stringify(result.processedData, null, 2));
    }
    
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

testFullPipeline();