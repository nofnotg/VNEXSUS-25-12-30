import HybridController from './backend/controllers/hybridController.js';

async function simplePipelineTest() {
  console.log('=== 간단한 파이프라인 테스트 ===\n');
  
  const testText = "환자는 2024년 12월 15일에 내원했습니다.";
  console.log(`테스트 텍스트: ${testText}\n`);
  
  try {
    const controller = new HybridController();
    
    console.log('🚀 executeUnifiedPipeline 실행...');
    const result = await controller.executeUnifiedPipeline(testText, {});
    
    console.log('\n📊 결과 분석:');
    console.log(`✅ 성공: ${!!result}`);
    console.log(`📋 processedData 존재: ${!!result.processedData}`);
    console.log(`📅 dates 배열 길이: ${result.processedData?.dates?.length || 0}`);
    console.log(`📅 dates 배열:`, JSON.stringify(result.processedData?.dates, null, 2));
    
    if (result.processedData?.dates?.length === 0) {
      console.log('\n❌ 빈 dates 배열 문제 확인됨!');
      
      // 파이프라인 단계별 분석
      if (result.pipelineStages) {
        console.log('\n🔍 파이프라인 단계 분석:');
        result.pipelineStages.forEach((stage, index) => {
          console.log(`  ${index + 1}. ${stage.name}: ${stage.duration}ms`);
          if (stage.results !== undefined) {
            console.log(`     결과 개수: ${stage.results}`);
          }
          if (stage.success !== undefined) {
            console.log(`     성공 개수: ${stage.success}`);
          }
        });
      }
    } else {
      console.log('\n✅ dates 배열에 데이터가 있음 - 문제 해결됨!');
    }
    
  } catch (error) {
    console.error('\n❌ 파이프라인 실행 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
  }
}

simplePipelineTest().catch(console.error);