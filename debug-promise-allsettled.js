import HybridController from './backend/controllers/hybridController.js';

console.log('=== Promise.allSettled 분석 ===');

async function debugPromiseAllSettled() {
  try {
    const controller = new HybridController();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    console.log('테스트 텍스트:', testText);
    console.log('시작 시간:', new Date().toISOString());
    
    // 개별 모드 테스트 (타임아웃 적용)
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    const individualResults = [];
    
    for (const mode of modes) {
      console.log(`\n🔄 ${mode} 모드 개별 테스트 중...`);
      
      try {
        // 5초 타임아웃 적용
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${mode} 모드 타임아웃 (5초)`)), 5000)
        );
        
        const processingPromise = controller.dateProcessor.processMassiveDateBlocks(testText, { 
          processingMode: mode 
        });
        
        const result = await Promise.race([processingPromise, timeoutPromise]);
        
        console.log(`  ✅ ${mode} 성공: ${result.success}`);
        console.log(`  📅 ${mode} dateBlocks: ${result.dateBlocks?.length || 0}`);
        console.log(`  🎯 ${mode} 신뢰도: ${result.statistics?.averageConfidence || result.confidence || 0}`);
        
        individualResults.push({ mode, result, success: true });
        
      } catch (error) {
        console.log(`  ❌ ${mode} 실패: ${error.message}`);
        individualResults.push({ mode, error: error.message, success: false });
      }
    }
    
    console.log(`\n📊 개별 테스트 완료. 성공: ${individualResults.filter(r => r.success).length}/${modes.length}`);
    
    // Promise.allSettled 테스트 (타임아웃 적용)
    console.log('\n=== Promise.allSettled 테스트 ===');
    console.log('Promise.allSettled 시작 시간:', new Date().toISOString());
    
    try {
      // 10초 타임아웃 적용
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Promise.allSettled 타임아웃 (10초)')), 10000)
      );
      
      const allSettledPromise = Promise.allSettled([
        controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' }),
        controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'core' }),
        controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'hybrid' }),
        controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'adaptive' })
      ]);
      
      const dateResults = await Promise.race([allSettledPromise, timeoutPromise]);
      
      console.log('Promise.allSettled 완료 시간:', new Date().toISOString());
      console.log(`총 결과 개수: ${dateResults.length}`);
      
      const fulfilledResults = dateResults.filter(r => r.status === 'fulfilled').map(r => r.value);
      const rejectedResults = dateResults.filter(r => r.status === 'rejected');
      
      console.log(`성공한 결과: ${fulfilledResults.length}`);
      console.log(`실패한 결과: ${rejectedResults.length}`);
      
      if (rejectedResults.length > 0) {
        console.log('\n❌ 실패한 결과들:');
        rejectedResults.forEach((result, index) => {
          console.log(`  ${index + 1}: ${result.reason?.message || result.reason}`);
        });
      }
      
      if (fulfilledResults.length > 0) {
        console.log('\n✅ 성공한 결과들:');
        fulfilledResults.forEach((result, index) => {
          console.log(`  ${index + 1}: success=${result.success}, dateBlocks=${result.dateBlocks?.length || 0}`);
        });
        
        // selectBestResult 테스트
        console.log('\n🏆 selectBestResult 테스트:');
        const bestResult = controller.selectBestResult(fulfilledResults, 'date');
        console.log(`bestResult 존재: ${!!bestResult}`);
        console.log(`bestResult success: ${bestResult?.success}`);
        console.log(`bestResult dateBlocks: ${bestResult?.dateBlocks?.length || 0}`);
        
        if (bestResult) {
          const extractedDates = controller.extractDatesFromResult(bestResult);
          console.log(`추출된 날짜: ${extractedDates?.length || 0}개`);
          console.log('날짜 배열:', JSON.stringify(extractedDates, null, 2));
        }
      }
      
    } catch (error) {
      console.log('❌ Promise.allSettled 실패:', error.message);
      
      // 대안: 순차 실행
      console.log('\n🔄 대안: 순차 실행 테스트');
      const sequentialResults = [];
      
      for (const mode of modes) {
        try {
          console.log(`  순차 실행: ${mode}`);
          const result = await controller.dateProcessor.processMassiveDateBlocks(testText, { 
            processingMode: mode 
          });
          sequentialResults.push(result);
          console.log(`    ✅ ${mode} 완료`);
        } catch (error) {
          console.log(`    ❌ ${mode} 실패: ${error.message}`);
        }
      }
      
      if (sequentialResults.length > 0) {
        const bestSequential = controller.selectBestResult(sequentialResults, 'date');
        const datesSequential = controller.extractDatesFromResult(bestSequential);
        console.log(`순차 실행 결과: ${datesSequential?.length || 0}개 날짜 추출`);
      }
    }
    
    console.log('\n완료 시간:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ 전체 디버깅 실패:', error);
  }
}

debugPromiseAllSettled();