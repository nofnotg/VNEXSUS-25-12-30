// HybridController 전용 디버깅
console.log('=== HybridController 디버깅 ===');

async function debugController() {
  try {
    const { default: HybridController } = await import('./backend/controllers/hybridController.js');
    
    console.log('HybridController 초기화 중...');
    const controller = new HybridController();
    console.log('✅ HybridController 초기화 완료');
    
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    console.log('테스트 텍스트:', testText);
    
    // dateProcessor 직접 테스트
    console.log('\n=== DateProcessor 직접 테스트 ===');
    const directResult = await controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
    console.log('직접 호출 성공:', directResult.success);
    console.log('직접 호출 DateBlocks:', directResult.dateBlocks?.length || 0);
    
    // executeUnifiedPipeline 테스트 (간단 버전)
    console.log('\n=== ExecuteUnifiedPipeline 테스트 ===');
    
    // Promise.allSettled 시뮬레이션
    console.log('Promise.allSettled 시뮬레이션...');
    const dateResults = await Promise.allSettled([
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' })
    ]);
    
    console.log('Promise.allSettled 결과:');
    console.log('- 결과 개수:', dateResults.length);
    console.log('- 첫 번째 상태:', dateResults[0].status);
    
    if (dateResults[0].status === 'fulfilled') {
      console.log('- 첫 번째 성공:', dateResults[0].value.success);
      console.log('- 첫 번째 DateBlocks:', dateResults[0].value.dateBlocks?.length || 0);
    }
    
    // selectBestResult 테스트
    const fulfilledResults = dateResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    console.log('\n성공한 결과 개수:', fulfilledResults.length);
    
    if (fulfilledResults.length > 0) {
      const bestResult = controller.selectBestResult(fulfilledResults, 'date');
      console.log('최적 결과 선택됨:', !!bestResult);
      console.log('최적 결과 DateBlocks:', bestResult?.dateBlocks?.length || 0);
      
      // extractDatesFromResult 테스트
      const extractedDates = controller.extractDatesFromResult(bestResult);
      console.log('추출된 날짜 개수:', extractedDates?.length || 0);
      console.log('추출된 날짜:', JSON.stringify(extractedDates, null, 2));
    }
    
  } catch (error) {
    console.error('에러 발생:', error.message);
    console.error('스택:', error.stack);
  }
}

debugController();