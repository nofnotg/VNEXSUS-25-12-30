// 최소한의 디버깅 스크립트
console.log('=== 최소 디버깅 ===');

async function minimalDebug() {
  try {
    const { default: HybridController } = await import('./backend/controllers/hybridController.js');
    
    const controller = new HybridController();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    // 1. dateProcessor 직접 테스트
    console.log('1. dateProcessor 직접 테스트');
    const directResult = await controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
    console.log('직접 결과 dateBlocks:', directResult.dateBlocks?.length || 0);
    
    // 2. extractDatesFromResult 직접 테스트
    console.log('\n2. extractDatesFromResult 직접 테스트');
    const extractedDates = controller.extractDatesFromResult(directResult);
    console.log('추출된 날짜 개수:', extractedDates?.length || 0);
    console.log('추출된 날짜:', JSON.stringify(extractedDates, null, 2));
    
    // 3. 간단한 파이프라인 시뮬레이션
    console.log('\n3. 파이프라인 시뮬레이션');
    const dateResults = [directResult];
    const bestResult = controller.selectBestResult(dateResults, 'date');
    console.log('bestResult dateBlocks:', bestResult?.dateBlocks?.length || 0);
    
    const finalExtracted = controller.extractDatesFromResult(bestResult);
    console.log('최종 추출 날짜 개수:', finalExtracted?.length || 0);
    
  } catch (error) {
    console.error('에러:', error.message);
  }
}

minimalDebug();