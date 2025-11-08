// 빠른 디버깅 테스트
console.log('=== 빠른 디버깅 테스트 시작 ===');

async function quickTest() {
  try {
    // HybridDateProcessor 직접 테스트
    const { default: HybridDateProcessor } = await import('./backend/postprocess/hybridDateProcessor.js');
    
    const processor = new HybridDateProcessor();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    console.log('테스트 텍스트:', testText);
    
    // legacy 모드 테스트
    console.log('\n=== Legacy 모드 테스트 ===');
    const legacyResult = await processor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
    console.log('Legacy 성공:', legacyResult.success);
    console.log('Legacy DateBlocks:', legacyResult.dateBlocks?.length || 0);
    
    if (legacyResult.dateBlocks?.length > 0) {
      console.log('첫 번째 DateBlock:', JSON.stringify(legacyResult.dateBlocks[0], null, 2));
    }
    
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

quickTest();