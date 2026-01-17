/**
 * HybridDateProcessor의 processWithLegacyOnly 메서드 디버깅
 */

import HybridDateProcessor from './postprocess/hybridDateProcessor.js';
import MassiveDateBlockProcessor from './postprocess/massiveDateBlockProcessor.js';

async function debugLegacyOnlyProcessing() {
  console.log('🔍 Legacy Only 처리 디버깅 시작');
  
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  console.log(`\n📝 테스트 텍스트: "${testText}"`);
  
  // 1. MassiveDateBlockProcessor 직접 테스트
  console.log('\n📊 MassiveDateBlockProcessor 직접 테스트:');
  const massiveProcessor = new MassiveDateBlockProcessor();
  const massiveResult = await massiveProcessor.processMassiveDateBlocks(testText);
  console.log(`  - 성공: ${massiveResult.success}`);
  console.log(`  - dateBlocks 개수: ${massiveResult.dateBlocks?.length || 0}`);
  console.log(`  - dateBlocks:`, JSON.stringify(massiveResult.dateBlocks, null, 2));
  
  // 2. HybridDateProcessor의 processWithLegacyOnly 테스트
  console.log('\n🔄 HybridDateProcessor processWithLegacyOnly 테스트:');
  const hybridProcessor = new HybridDateProcessor();
  const hybridResult = await hybridProcessor.processWithLegacyOnly(testText, {});
  console.log(`  - 성공: ${hybridResult.success}`);
  console.log(`  - dateBlocks 개수: ${hybridResult.dateBlocks?.length || 0}`);
  console.log(`  - dateBlocks:`, JSON.stringify(hybridResult.dateBlocks, null, 2));
  
  // 3. 결과 비교
  console.log('\n🔍 결과 비교:');
  console.log(`  - Massive 결과 개수: ${massiveResult.dateBlocks?.length || 0}`);
  console.log(`  - Hybrid Legacy 결과 개수: ${hybridResult.dateBlocks?.length || 0}`);
  
  if (massiveResult.dateBlocks && hybridResult.dateBlocks) {
    console.log(`  - 결과 동일성: ${JSON.stringify(massiveResult.dateBlocks) === JSON.stringify(hybridResult.dateBlocks)}`);
  }
  
  // 4. 전체 processMassiveDateBlocks 호출 (legacy 모드)
  console.log('\n🎯 전체 processMassiveDateBlocks (legacy 모드) 테스트:');
  const fullResult = await hybridProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
  console.log(`  - 성공: ${fullResult.success}`);
  console.log(`  - dateBlocks 개수: ${fullResult.dateBlocks?.length || 0}`);
  console.log(`  - dateBlocks:`, JSON.stringify(fullResult.dateBlocks, null, 2));
  
  // 5. 상세 분석
  console.log('\n🔬 상세 분석:');
  console.log('Massive Result:', JSON.stringify(massiveResult, null, 2));
  console.log('\nHybrid Legacy Result:', JSON.stringify(hybridResult, null, 2));
  console.log('\nFull Result:', JSON.stringify(fullResult, null, 2));
}

// 테스트 실행
debugLegacyOnlyProcessing().catch(console.error);