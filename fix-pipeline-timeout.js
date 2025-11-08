// 파이프라인 타임아웃 문제 해결
console.log('=== 파이프라인 타임아웃 문제 해결 ===');

async function fixPipelineTimeout() {
  try {
    const { default: HybridController } = await import('./backend/controllers/hybridController.js');
    
    const controller = new HybridController();
    const testText = "환자는 2024년 12월 15일에 내원했습니다.";
    
    console.log('테스트 텍스트:', testText);
    
    // 타임아웃 설정으로 executeUnifiedPipeline 실행
    console.log('\n=== 타임아웃 설정으로 파이프라인 실행 ===');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('파이프라인 타임아웃 (10초)')), 10000);
    });
    
    const pipelinePromise = controller.executeUnifiedPipeline(testText, {});
    
    try {
      const result = await Promise.race([pipelinePromise, timeoutPromise]);
      
      console.log('\n=== 파이프라인 성공 ===');
      console.log('dates 배열 길이:', result.processedData?.dates?.length || 0);
      console.log('dates 배열:', JSON.stringify(result.processedData?.dates, null, 2));
      
    } catch (error) {
      if (error.message.includes('타임아웃')) {
        console.log('\n❌ 파이프라인이 10초 내에 완료되지 않았습니다.');
        console.log('문제: executeUnifiedPipeline에서 무한 루프나 데드락 발생 가능성');
        
        // 대안: 개별 컴포넌트로 직접 구현
        console.log('\n=== 대안: 직접 구현 ===');
        
        const directResult = await controller.dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
        const extractedDates = controller.extractDatesFromResult(directResult);
        
        console.log('직접 구현 결과:');
        console.log('- 성공:', directResult.success);
        console.log('- 추출된 날짜 개수:', extractedDates?.length || 0);
        console.log('- 추출된 날짜:', JSON.stringify(extractedDates, null, 2));
        
        // 간단한 응답 구조 생성
        const simpleResponse = {
          processedData: {
            dates: extractedDates || [],
            entities: [],
            medical: {
              conditions: [],
              medications: [],
              procedures: [],
              symptoms: []
            }
          },
          success: true,
          confidence: directResult.confidence || 0.6
        };
        
        console.log('\n간단한 응답 구조:', JSON.stringify(simpleResponse, null, 2));
        
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

fixPipelineTimeout();