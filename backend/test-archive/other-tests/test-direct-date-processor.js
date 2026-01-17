/**
 * HybridDateProcessor 직접 테스트
 * 한국어 날짜 처리 능력 확인
 */

import HybridDateProcessor from './postprocess/hybridDateProcessor.js';

async function testDirectDateProcessor() {
  console.log('🧪 HybridDateProcessor 직접 테스트 시작');
  
  const processor = new HybridDateProcessor({
    enableLegacyMode: true,
    enableCoreEngine: true,
    enableHybridMode: true,
    enableAdaptiveMode: true
  });
  
  const testTexts = [
    "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.",
    "2024-12-15 검사 실시",
    "12/15/2024 진료",
    "2024.12.15 처방전 발급",
    "십이월 십오일 진료 예정"
  ];
  
  const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
  
  for (const text of testTexts) {
    console.log(`\n📝 테스트 텍스트: "${text}"`);
    
    for (const mode of modes) {
      try {
        console.log(`\n🔍 ${mode} 모드 테스트:`);
        
        const result = await processor.processMassiveDateBlocks(text, { 
          processingMode: mode 
        });
        
        console.log(`  ✅ 성공: ${result.success}`);
        console.log(`  📊 dateBlocks 개수: ${result.dateBlocks?.length || 0}`);
        console.log(`  ⏱️ 처리 시간: ${result.hybrid?.processingTime || 0}ms`);
        console.log(`  🎯 신뢰도: ${result.statistics?.averageConfidence || 0}`);
        
        if (result.dateBlocks && result.dateBlocks.length > 0) {
          console.log(`  📅 첫 번째 dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 2));
        }
        
        if (!result.success) {
          console.log(`  ❌ 오류:`, result.error);
        }
        
      } catch (error) {
        console.error(`  💥 ${mode} 모드 오류:`, error.message);
      }
    }
  }
}

// 테스트 실행
testDirectDateProcessor().catch(console.error);