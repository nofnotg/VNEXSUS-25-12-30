/**
 * 간단한 날짜 처리 테스트 - CEO/CTO 관점 문제 분석
 */

import MassiveDateBlockProcessor from './backend/postprocess/massiveDateBlockProcessor.js';
import HybridDateProcessor from './backend/postprocess/hybridDateProcessor.js';

async function simpleTest() {
  console.log('🔍 === 간단한 날짜 처리 테스트 시작 ===\n');
  
  const testText = '환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.';
  console.log('📝 테스트 텍스트:', testText);
  console.log('');

  try {
    // 1. MassiveDateBlockProcessor 직접 테스트
    console.log('🧪 1. MassiveDateBlockProcessor 직접 테스트');
    console.log('-'.repeat(50));
    
    const massiveProcessor = new MassiveDateBlockProcessor();
    const massiveResult = await massiveProcessor.processMassiveDateBlocks(testText);
    
    console.log('✅ MassiveDateBlockProcessor 결과:');
    console.log(`  - success: ${massiveResult.success}`);
    console.log(`  - dateBlocks 개수: ${massiveResult.dateBlocks?.length || 0}`);
    console.log(`  - dateBlocks:`, JSON.stringify(massiveResult.dateBlocks, null, 2));
    
    // 2. HybridDateProcessor legacy 모드 테스트
    console.log('\n🧪 2. HybridDateProcessor (legacy 모드) 테스트');
    console.log('-'.repeat(50));
    
    const hybridProcessor = new HybridDateProcessor();
    const hybridResult = await hybridProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
    
    console.log('✅ HybridDateProcessor (legacy) 결과:');
    console.log(`  - success: ${hybridResult.success}`);
    console.log(`  - dateBlocks 개수: ${hybridResult.dateBlocks?.length || 0}`);
    console.log(`  - dateBlocks:`, JSON.stringify(hybridResult.dateBlocks, null, 2));
    
    // 3. 결과 비교 분석
    console.log('\n📊 3. 결과 비교 분석');
    console.log('-'.repeat(50));
    
    const massiveDateCount = massiveResult.dateBlocks?.length || 0;
    const hybridDateCount = hybridResult.dateBlocks?.length || 0;
    
    console.log(`MassiveDateBlockProcessor: ${massiveDateCount}개 날짜`);
    console.log(`HybridDateProcessor (legacy): ${hybridDateCount}개 날짜`);
    
    if (massiveDateCount === 0 && hybridDateCount === 0) {
      console.log('❌ 문제 발견: 두 프로세서 모두 날짜를 추출하지 못함');
      console.log('🔍 원인 분석 필요: 기본 날짜 추출 로직에 문제가 있을 수 있음');
    } else if (massiveDateCount > 0 && hybridDateCount === 0) {
      console.log('❌ 문제 발견: HybridDateProcessor에서 날짜 손실');
      console.log('🔍 원인 분석 필요: HybridDateProcessor의 래핑 로직 문제');
    } else if (massiveDateCount === 0 && hybridDateCount > 0) {
      console.log('✅ HybridDateProcessor가 개선된 결과 제공');
    } else {
      console.log('✅ 두 프로세서 모두 날짜 추출 성공');
    }

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  }
  
  console.log('\n🏁 === 테스트 완료 ===');
}

// 실행
simpleTest().catch(console.error);