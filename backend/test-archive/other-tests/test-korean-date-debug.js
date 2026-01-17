/**
 * 한국어 날짜 패턴 매칭 디버깅 테스트
 */

import MassiveDateBlockProcessor from './postprocess/massiveDateBlockProcessor.js';

async function debugKoreanDatePatterns() {
  console.log('🔍 한국어 날짜 패턴 매칭 디버깅 시작');
  
  const processor = new MassiveDateBlockProcessor();
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  
  console.log(`\n📝 테스트 텍스트: "${testText}"`);
  
  // 1. 패턴 직접 테스트
  console.log('\n🎯 패턴 직접 테스트:');
  const koreanPattern = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g;
  const matches = [...testText.matchAll(koreanPattern)];
  console.log(`  - 한국어 패턴 매치 개수: ${matches.length}`);
  matches.forEach((match, index) => {
    console.log(`  - 매치 ${index + 1}: "${match[0]}" (위치: ${match.index})`);
  });
  
  // 2. 텍스트 정제 과정 확인
  console.log('\n🧹 텍스트 정제 과정:');
  const cleanedText = processor._cleanText(testText);
  console.log(`  - 원본 길이: ${testText.length}`);
  console.log(`  - 정제 후 길이: ${cleanedText.length}`);
  console.log(`  - 정제된 텍스트: "${cleanedText}"`);
  
  // 3. 작은 블록 분석 직접 호출
  console.log('\n📊 작은 블록 분석:');
  const smallBlocksResult = processor._analyzeSmallBlocks(cleanedText);
  console.log(`  - 총 날짜 개수: ${smallBlocksResult.totalDates}`);
  console.log(`  - 분포:`, smallBlocksResult.distribution);
  console.log(`  - 한국어 날짜:`, smallBlocksResult.dates.korean);
  
  // 4. 전체 처리 과정
  console.log('\n🔄 전체 처리 과정:');
  const result = await processor.processMassiveDateBlocks(testText);
  console.log(`  - 성공: ${result.success}`);
  console.log(`  - dateBlocks 개수: ${result.dateBlocks?.length || 0}`);
  console.log(`  - dateBlocks:`, result.dateBlocks);
  
  // 5. 패턴 매칭 상세 분석
  console.log('\n🔬 패턴 매칭 상세 분석:');
  const patterns = processor.massiveDatePatterns.smallBlocks;
  Object.entries(patterns).forEach(([type, pattern]) => {
    const typeMatches = [...cleanedText.matchAll(pattern)];
    console.log(`  - ${type} 패턴: ${typeMatches.length}개 매치`);
    typeMatches.forEach((match, index) => {
      console.log(`    * 매치 ${index + 1}: "${match[0]}" (위치: ${match.index})`);
    });
  });
}

// 테스트 실행
debugKoreanDatePatterns().catch(console.error);