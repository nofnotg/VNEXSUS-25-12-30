import HybridController from './controllers/hybridController.js';
import HybridDateProcessor from './postprocess/hybridDateProcessor.js';
import MassiveDateBlockProcessor from './postprocess/massiveDateBlockProcessor.js';

async function testActualPipeline() {
  console.log('=== Actual Pipeline Test ===\n');
  
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  console.log(`Test text: ${testText}\n`);
  
  // 1. 직접 프로세서 테스트
  console.log('1. Direct Processor Tests:');
  
  const legacyProcessor = new MassiveDateBlockProcessor();
  const hybridProcessor = new HybridDateProcessor();
  
  try {
    const legacyResult = await legacyProcessor.processMassiveDateBlocks(testText);
    console.log(`Legacy: ${legacyResult.dateBlocks.length} dateBlocks`);
    console.log('Legacy dateBlocks:', JSON.stringify(legacyResult.dateBlocks, null, 2));
  } catch (error) {
    console.log('Legacy error:', error.message);
  }
  
  try {
    const hybridResult = await hybridProcessor.processMassiveDateBlocks(testText, { processingMode: 'adaptive' });
    console.log(`Hybrid: ${hybridResult.dateBlocks.length} dateBlocks`);
    console.log('Hybrid dateBlocks:', JSON.stringify(hybridResult.dateBlocks, null, 2));
  } catch (error) {
    console.log('Hybrid error:', error.message);
  }
  
  console.log('\n2. HybridController Pipeline Test:');
  
  // 2. HybridController 파이프라인 테스트
  const controller = new HybridController();
  
  const document = { text: testText };
  const options = { processingMode: 'adaptive' };
  
  try {
    const result = await controller.executeUnifiedPipeline(document, options);
    console.log('Pipeline result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Dates count: ${result.dates ? result.dates.length : 0}`);
    console.log(`  Quality score: ${result.hybrid.qualityScore}`);
    console.log(`  Confidence: ${result.hybrid.confidence}`);
    console.log('  Dates:', JSON.stringify(result.dates, null, 2));
    
    // 파이프라인 단계별 결과 확인
    if (result.hybrid.pipelineStages) {
      console.log('\n  Pipeline stages:');
      result.hybrid.pipelineStages.forEach((stage, index) => {
        console.log(`    Stage ${index + 1}: ${stage.stage} - ${stage.status}`);
        if (stage.dateBlocks !== undefined) {
          console.log(`      Date blocks: ${stage.dateBlocks}`);
        }
      });
    }
  } catch (error) {
    console.log('Pipeline error:', error.message);
    console.log('Stack:', error.stack);
  }
}

testActualPipeline().catch(console.error);