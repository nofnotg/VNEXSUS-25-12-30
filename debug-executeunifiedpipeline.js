import HybridController from './backend/controllers/hybridController.js';
import HybridDateProcessor from './backend/postprocess/hybridDateProcessor.js';

async function debugExecuteUnifiedPipeline() {
  console.log('=== ExecuteUnifiedPipeline 상세 분석 ===\n');
  
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다. 다음 예약은 2024년 12월 20일입니다.";
  console.log(`테스트 텍스트: ${testText}\n`);
  
  // 1. HybridDateProcessor 직접 테스트
  console.log('🔍 1단계: HybridDateProcessor 직접 테스트');
  console.log('='.repeat(60));
  
  const hybridProcessor = new HybridDateProcessor({
    processingMode: 'unified',
    enableMonitoring: true,
    enableFallback: true,
    enableAllEngines: true
  });
  
  const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
  
  for (const mode of modes) {
    try {
      console.log(`\n📊 ${mode} 모드 직접 테스트:`);
      const result = await hybridProcessor.processMassiveDateBlocks(testText, { 
        processingMode: mode 
      });
      
      console.log(`  ✅ 성공: ${result.success}`);
      console.log(`  📅 DateBlocks: ${result.dateBlocks?.length || 0}`);
      console.log(`  🎯 신뢰도: ${result.statistics?.averageConfidence || result.confidence || 0}`);
      
    } catch (error) {
      console.error(`  ❌ ${mode} 모드 에러:`, error.message);
    }
  }
  
  // 2. executeUnifiedPipeline의 Promise.allSettled 시뮬레이션
  console.log('\n\n🚀 2단계: Promise.allSettled 시뮬레이션');
  console.log('='.repeat(60));
  
  const controller = new HybridController();
  
  console.log('\n📋 각 Promise 개별 실행:');
  
  const promises = [
    { name: 'legacy', promise: controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' }) },
    { name: 'core', promise: controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'core' }) },
    { name: 'hybrid', promise: controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'hybrid' }) },
    { name: 'adaptive', promise: controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'adaptive' }) }
  ];
  
  for (const { name, promise } of promises) {
    try {
      console.log(`\n🔄 ${name} Promise 실행 중...`);
      const result = await promise;
      console.log(`  ✅ ${name} 성공: ${result.success}`);
      console.log(`  📅 ${name} DateBlocks: ${result.dateBlocks?.length || 0}`);
      console.log(`  🎯 ${name} 신뢰도: ${result.statistics?.averageConfidence || result.confidence || 0}`);
    } catch (error) {
      console.error(`  ❌ ${name} Promise 실패:`, error.message);
    }
  }
  
  // 3. Promise.allSettled 실제 실행
  console.log('\n\n⚡ 3단계: Promise.allSettled 실제 실행');
  console.log('='.repeat(60));
  
  try {
    const dateResults = await Promise.allSettled([
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'core' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'hybrid' }),
      controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'adaptive' })
    ]);
    
    console.log(`\n📊 Promise.allSettled 결과:`);
    console.log(`  - 총 결과 개수: ${dateResults.length}`);
    
    dateResults.forEach((result, index) => {
      const modeName = modes[index];
      console.log(`\n  ${modeName} 결과:`);
      console.log(`    - 상태: ${result.status}`);
      
      if (result.status === 'fulfilled') {
        console.log(`    - 성공: ${result.value.success}`);
        console.log(`    - DateBlocks: ${result.value.dateBlocks?.length || 0}`);
        console.log(`    - 신뢰도: ${result.value.statistics?.averageConfidence || result.value.confidence || 0}`);
      } else {
        console.log(`    - 에러: ${result.reason?.message || result.reason}`);
      }
    });
    
    // 4. selectBestResult에 전달되는 데이터 확인
    console.log('\n\n🎯 4단계: selectBestResult 입력 데이터 확인');
    console.log('='.repeat(60));
    
    const fulfilledResults = dateResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    console.log(`\n📈 성공한 결과 개수: ${fulfilledResults.length}`);
    
    fulfilledResults.forEach((result, index) => {
      console.log(`\n  결과 ${index + 1}:`);
      console.log(`    - 성공: ${result.success}`);
      console.log(`    - DateBlocks: ${result.dateBlocks?.length || 0}`);
      console.log(`    - 신뢰도: ${result.statistics?.averageConfidence || result.confidence || 0}`);
    });
    
    if (fulfilledResults.length > 0) {
      const bestResult = controller.selectBestResult(fulfilledResults, 'date');
      console.log('\n🏆 선택된 최적 결과:');
      console.log(`  - 성공: ${bestResult.success}`);
      console.log(`  - DateBlocks: ${bestResult.dateBlocks?.length || 0}`);
      console.log(`  - 신뢰도: ${bestResult.statistics?.averageConfidence || bestResult.confidence || 0}`);
      
      const extractedDates = controller.extractDatesFromResult(bestResult);
      console.log(`  - 추출된 날짜: ${extractedDates?.length || 0}개`);
      console.log(`  - 날짜 배열:`, JSON.stringify(extractedDates, null, 2));
    } else {
      console.log('\n❌ 성공한 결과가 없음 - 이것이 빈 dates 배열의 원인!');
    }
    
  } catch (error) {
    console.error('\n❌ Promise.allSettled 실행 실패:', error);
  }
  
  // 5. 전체 executeUnifiedPipeline 실행
  console.log('\n\n🏗️ 5단계: 전체 executeUnifiedPipeline 실행');
  console.log('='.repeat(60));
  
  try {
    const pipelineResult = await controller.executeUnifiedPipeline(testText, {});
    console.log('\n📊 파이프라인 최종 결과:');
    console.log(`  - processedData 존재: ${!!pipelineResult.processedData}`);
    console.log(`  - dates 배열 길이: ${pipelineResult.processedData?.dates?.length || 0}`);
    console.log(`  - dates 배열:`, JSON.stringify(pipelineResult.processedData?.dates, null, 2));
    console.log(`  - 파이프라인 단계: ${pipelineResult.pipelineStages?.length || 0}개`);
    
    if (pipelineResult.pipelineStages) {
      pipelineResult.pipelineStages.forEach((stage, index) => {
        console.log(`    단계 ${index + 1}: ${stage.name} (${stage.duration}ms)`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ executeUnifiedPipeline 실행 실패:', error);
  }
}

debugExecuteUnifiedPipeline().catch(console.error);