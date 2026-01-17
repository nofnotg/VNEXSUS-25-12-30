import HybridController from './controllers/hybridController.js';

async function testExtractDatesFromResult() {
  console.log('=== extractDatesFromResult 디버깅 테스트 ===\n');
  
  const hybridController = new HybridController();
  const koreanText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  
  try {
    // 1. 실제 API 파이프라인 실행
    console.log('1. 실제 API 파이프라인 실행:');
    const pipelineResult = await hybridController.executeUnifiedPipeline(koreanText, {});
    
    console.log('Pipeline Result Structure:');
    console.log('- processedData:', JSON.stringify(pipelineResult.processedData, null, 2));
    console.log('- dates 배열:', JSON.stringify(pipelineResult.processedData.dates, null, 2));
    console.log('- dates 배열 길이:', pipelineResult.processedData.dates?.length || 0);
    
    // 2. 개별 날짜 처리기 결과 확인
    console.log('\n2. 개별 날짜 처리기 결과:');
    const dateProcessor = hybridController.dateProcessor;
    
    const legacyResult = await dateProcessor.processMassiveDateBlocks(koreanText, { processingMode: 'legacy' });
    console.log('Legacy Result:');
    console.log('- dateBlocks:', JSON.stringify(legacyResult.dateBlocks, null, 2));
    console.log('- dateBlocks 길이:', legacyResult.dateBlocks?.length || 0);
    
    const adaptiveResult = await dateProcessor.processMassiveDateBlocks(koreanText, { processingMode: 'adaptive' });
    console.log('\nAdaptive Result:');
    console.log('- dateBlocks:', JSON.stringify(adaptiveResult.dateBlocks, null, 2));
    console.log('- dateBlocks 길이:', adaptiveResult.dateBlocks?.length || 0);
    
    // 3. extractDatesFromResult 메서드 직접 테스트
    console.log('\n3. extractDatesFromResult 메서드 직접 테스트:');
    
    console.log('Legacy Result를 extractDatesFromResult에 전달:');
    const extractedFromLegacy = hybridController.extractDatesFromResult(legacyResult);
    console.log('- 추출된 날짜:', JSON.stringify(extractedFromLegacy, null, 2));
    console.log('- 추출된 날짜 개수:', extractedFromLegacy?.length || 0);
    
    console.log('\nAdaptive Result를 extractDatesFromResult에 전달:');
    const extractedFromAdaptive = hybridController.extractDatesFromResult(adaptiveResult);
    console.log('- 추출된 날짜:', JSON.stringify(extractedFromAdaptive, null, 2));
    console.log('- 추출된 날짜 개수:', extractedFromAdaptive?.length || 0);
    
    // 4. selectBestResult 메서드 테스트
    console.log('\n4. selectBestResult 메서드 테스트:');
    const allResults = [legacyResult, adaptiveResult];
    const bestResult = hybridController.selectBestResult(allResults, 'date');
    console.log('Best Result:');
    console.log('- 전체 구조:', JSON.stringify(bestResult, null, 2));
    console.log('- dateBlocks:', JSON.stringify(bestResult?.dateBlocks, null, 2));
    
    console.log('\nBest Result를 extractDatesFromResult에 전달:');
    const extractedFromBest = hybridController.extractDatesFromResult(bestResult);
    console.log('- 추출된 날짜:', JSON.stringify(extractedFromBest, null, 2));
    console.log('- 추출된 날짜 개수:', extractedFromBest?.length || 0);
    
  } catch (error) {
    console.error('❌ 테스트 실행 실패:', error);
    console.error('Stack trace:', error.stack);
  }
}

testExtractDatesFromResult();