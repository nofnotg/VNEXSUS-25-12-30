import HybridController from './backend/controllers/hybridController.js';

console.log('=== SelectBestResult 상세 분석 ===');

async function debugSelectBestResult() {
  try {
    const controller = new HybridController();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    console.log('테스트 텍스트:', testText);
    
    // 1. 각 모드별 개별 실행
    console.log('\n=== 1단계: 각 모드별 개별 실행 ===');
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    const individualResults = [];
    
    for (const mode of modes) {
      try {
        console.log(`\n🔄 ${mode} 모드 실행 중...`);
        const result = await controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: mode });
        
        console.log(`  ✅ ${mode} 성공: ${result.success}`);
        console.log(`  📅 ${mode} dateBlocks: ${result.dateBlocks?.length || 0}`);
        console.log(`  🎯 ${mode} 신뢰도: ${result.statistics?.averageConfidence || result.confidence || 0}`);
        
        if (result.success && result.dateBlocks?.length > 0) {
          individualResults.push({
            mode,
            result,
            dateBlocksCount: result.dateBlocks.length,
            confidence: result.statistics?.averageConfidence || result.confidence || 0
          });
          console.log(`  📋 ${mode} 첫 번째 dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 2));
        }
        
      } catch (error) {
        console.error(`  ❌ ${mode} 모드 실패:`, error.message);
      }
    }
    
    console.log(`\n📊 성공한 결과 개수: ${individualResults.length}`);
    
    // 2. selectBestResult 입력 데이터 준비
    console.log('\n=== 2단계: selectBestResult 입력 데이터 준비 ===');
    const resultsForSelection = individualResults.map(item => item.result);
    
    console.log('selectBestResult에 전달될 데이터:');
    resultsForSelection.forEach((result, index) => {
      console.log(`\n  결과 ${index + 1}:`);
      console.log(`    - success: ${result.success}`);
      console.log(`    - dateBlocks: ${result.dateBlocks?.length || 0}`);
      console.log(`    - confidence: ${result.statistics?.averageConfidence || result.confidence || 0}`);
      console.log(`    - statistics:`, JSON.stringify(result.statistics, null, 2));
    });
    
    // 3. selectBestResult 실행
    console.log('\n=== 3단계: selectBestResult 실행 ===');
    
    if (resultsForSelection.length > 0) {
      console.log('selectBestResult 호출 중...');
      const bestResult = controller.selectBestResult(resultsForSelection, 'date');
      
      console.log('\n🏆 selectBestResult 결과:');
      console.log(`  - success: ${bestResult?.success}`);
      console.log(`  - dateBlocks: ${bestResult?.dateBlocks?.length || 0}`);
      console.log(`  - confidence: ${bestResult?.statistics?.averageConfidence || bestResult?.confidence || 0}`);
      console.log(`  - 전체 결과:`, JSON.stringify(bestResult, null, 2));
      
      // 4. extractDatesFromResult 실행
      console.log('\n=== 4단계: extractDatesFromResult 실행 ===');
      
      if (bestResult) {
        console.log('extractDatesFromResult 호출 중...');
        const extractedDates = controller.extractDatesFromResult(bestResult);
        
        console.log('\n📅 extractDatesFromResult 결과:');
        console.log(`  - 추출된 날짜 개수: ${extractedDates?.length || 0}`);
        console.log(`  - 추출된 날짜 배열:`, JSON.stringify(extractedDates, null, 2));
        
        if (!extractedDates || extractedDates.length === 0) {
          console.log('\n❌ extractDatesFromResult가 빈 배열을 반환했습니다!');
          console.log('bestResult의 dateBlocks 상세 분석:');
          
          if (bestResult.dateBlocks && bestResult.dateBlocks.length > 0) {
            bestResult.dateBlocks.forEach((block, index) => {
              console.log(`\n  dateBlock ${index + 1}:`, JSON.stringify(block, null, 2));
            });
          } else {
            console.log('bestResult에 dateBlocks가 없거나 비어있습니다.');
          }
        }
      } else {
        console.log('❌ selectBestResult가 null/undefined를 반환했습니다!');
      }
      
    } else {
      console.log('❌ 성공한 결과가 없어서 selectBestResult를 호출할 수 없습니다!');
    }
    
    // 5. Promise.allSettled 시뮬레이션
    console.log('\n=== 5단계: Promise.allSettled 시뮬레이션 ===');
    
    const dateResults = await Promise.allSettled([
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'core' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'hybrid' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'adaptive' })
    ]);
    
    console.log('\nPromise.allSettled 결과:');
    console.log(`  - 총 결과 개수: ${dateResults.length}`);
    
    const fulfilledResults = dateResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    console.log(`  - 성공한 결과 개수: ${fulfilledResults.length}`);
    
    fulfilledResults.forEach((result, index) => {
      console.log(`\n  성공 결과 ${index + 1}:`);
      console.log(`    - success: ${result.success}`);
      console.log(`    - dateBlocks: ${result.dateBlocks?.length || 0}`);
      console.log(`    - confidence: ${result.statistics?.averageConfidence || result.confidence || 0}`);
    });
    
    if (fulfilledResults.length > 0) {
      const bestFromAllSettled = controller.selectBestResult(fulfilledResults, 'date');
      console.log('\n🏆 Promise.allSettled 후 selectBestResult:');
      console.log(`  - success: ${bestFromAllSettled?.success}`);
      console.log(`  - dateBlocks: ${bestFromAllSettled?.dateBlocks?.length || 0}`);
      
      const datesFromAllSettled = controller.extractDatesFromResult(bestFromAllSettled);
      console.log(`  - 최종 추출된 날짜: ${datesFromAllSettled?.length || 0}개`);
      console.log(`  - 날짜 배열:`, JSON.stringify(datesFromAllSettled, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 디버깅 실패:', error);
  }
}

debugSelectBestResult();