import HybridController from './controllers/hybridController.js';
import HybridDateProcessor from './postprocess/hybridDateProcessor.js';

async function debugSelectBestResult() {
  console.log('=== SelectBestResult Debug ===\n');
  
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  console.log(`Test text: ${testText}\n`);
  
  // 1. 각 모드별 직접 처리 결과 확인
  const hybridProcessor = new HybridDateProcessor();
  
  const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
  const dateResults = [];
  
  for (const mode of modes) {
    try {
      console.log(`\n🔍 Processing with ${mode} mode:`);
      const result = await hybridProcessor.processMassiveDateBlocks(testText, { 
        processingMode: mode 
      });
      
      console.log(`  Success: ${result.success}`);
      console.log(`  DateBlocks count: ${result.dateBlocks?.length || 0}`);
      console.log(`  Confidence: ${result.statistics?.averageConfidence || 0}`);
      console.log(`  Processing time: ${result.hybrid?.processingTime || 0}ms`);
      
      if (result.dateBlocks && result.dateBlocks.length > 0) {
        console.log(`  First dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 2));
      }
      
      dateResults.push(result);
      
    } catch (error) {
      console.error(`  Error in ${mode} mode:`, error.message);
      dateResults.push({
        success: false,
        error: error.message,
        dateBlocks: [],
        confidence: 0,
        processingTime: 0
      });
    }
  }
  
  // 2. selectBestResult 테스트
  console.log('\n=== SelectBestResult Test ===\n');
  
  const controller = new HybridController();
  
  console.log('All date results:');
  dateResults.forEach((result, index) => {
    console.log(`  Result ${index} (${modes[index]}):`);
    console.log(`    Success: ${result.success}`);
    console.log(`    DateBlocks: ${result.dateBlocks?.length || 0}`);
    console.log(`    Confidence: ${result.statistics?.averageConfidence || result.confidence || 0}`);
    console.log(`    Processing time: ${result.hybrid?.processingTime || result.processingTime || 0}ms`);
    
    // 점수 계산
    const score = controller.calculateResultScore(result, 'date');
    console.log(`    Calculated score: ${score.toFixed(4)}`);
  });
  
  const bestResult = controller.selectBestResult(dateResults, 'date');
  
  console.log('\nBest result selected:');
  console.log(`  Success: ${bestResult.success}`);
  console.log(`  DateBlocks: ${bestResult.dateBlocks?.length || 0}`);
  console.log(`  Confidence: ${bestResult.statistics?.averageConfidence || bestResult.confidence || 0}`);
  console.log(`  Processing time: ${bestResult.hybrid?.processingTime || bestResult.processingTime || 0}ms`);
  
  if (bestResult.dateBlocks && bestResult.dateBlocks.length > 0) {
    console.log('  DateBlocks content:', JSON.stringify(bestResult.dateBlocks, null, 2));
  }
  
  // 3. extractDatesFromResult 테스트
  console.log('\n=== ExtractDatesFromResult Test ===\n');
  
  const extractedDates = controller.extractDatesFromResult(bestResult);
  console.log('Extracted dates:', JSON.stringify(extractedDates, null, 2));
}

debugSelectBestResult().catch(console.error);