/**
 * 날짜 처리 파이프라인 디버깅 스크립트
 * CEO/CTO 관점에서 체계적인 문제 분석
 */

import HybridController from './backend/controllers/hybridController.js';
import HybridDateProcessor from './backend/postprocess/hybridDateProcessor.js';

async function debugDatesPipeline() {
  console.log('🔍 === 날짜 처리 파이프라인 디버깅 시작 ===\n');
  
  const testText = '환자는 2024년 12월 15일에 내원하여 검사를 받았습니다. 2024-12-20에 재방문 예정입니다.';
  console.log('📝 테스트 텍스트:', testText);
  console.log('');

  try {
    // Phase 1: HybridDateProcessor 개별 테스트
    console.log('🧪 Phase 1: HybridDateProcessor 개별 테스트');
    console.log('='.repeat(50));
    
    const dateProcessor = new HybridDateProcessor({
      processingMode: 'unified',
      enableMonitoring: true,
      enableFallback: true,
      enableAllEngines: true
    });

    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    const dateResults = [];

    for (const mode of modes) {
      console.log(`\n📊 ${mode.toUpperCase()} 모드 테스트:`);
      try {
        const result = await dateProcessor.processMassiveDateBlocks(testText, { processingMode: mode });
        dateResults.push({ mode, result, success: true });
        
        console.log(`  ✅ 성공: dateBlocks 개수 = ${result.dateBlocks?.length || 0}`);
        if (result.dateBlocks && result.dateBlocks.length > 0) {
          console.log(`  📅 첫 번째 dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 4));
        } else {
          console.log(`  ❌ dateBlocks가 비어있음`);
          console.log(`  📋 결과 구조:`, Object.keys(result));
        }
      } catch (error) {
        dateResults.push({ mode, error: error.message, success: false });
        console.log(`  ❌ 실패: ${error.message}`);
      }
    }

    // Phase 2: HybridController 통합 테스트
    console.log('\n\n🏗️ Phase 2: HybridController 통합 테스트');
    console.log('='.repeat(50));
    
    const controller = new HybridController();
    
    console.log('\n🚀 executeUnifiedPipeline 실행...');
    const pipelineResult = await controller.executeUnifiedPipeline(testText, {});
    
    console.log('\n📊 파이프라인 결과 분석:');
    console.log(`  - processedData 존재: ${!!pipelineResult.processedData}`);
    console.log(`  - dates 배열 길이: ${pipelineResult.processedData?.dates?.length || 0}`);
    console.log(`  - dates 배열:`, JSON.stringify(pipelineResult.processedData?.dates, null, 2));

    // Phase 3: selectBestResult 분석
    console.log('\n\n🎯 Phase 3: selectBestResult 분석');
    console.log('='.repeat(50));
    
    const successfulResults = dateResults.filter(r => r.success).map(r => r.result);
    console.log(`\n📈 성공한 결과 개수: ${successfulResults.length}`);
    
    if (successfulResults.length > 0) {
      const bestResult = controller.selectBestResult(successfulResults, 'date');
      console.log('\n🏆 선택된 최적 결과:');
      console.log(`  - 신뢰도: ${bestResult?.confidence || 'N/A'}`);
      console.log(`  - dateBlocks 개수: ${bestResult?.dateBlocks?.length || 0}`);
      console.log(`  - 전체 구조:`, JSON.stringify(bestResult, null, 2));
      
      // Phase 4: extractDatesFromResult 분석
      console.log('\n\n📤 Phase 4: extractDatesFromResult 분석');
      console.log('='.repeat(50));
      
      const extractedDates = controller.extractDatesFromResult(bestResult);
      console.log(`\n📅 추출된 날짜 개수: ${extractedDates?.length || 0}`);
      console.log(`📅 추출된 날짜:`, JSON.stringify(extractedDates, null, 2));
    }

    // Phase 5: 종합 분석 및 권장사항
    console.log('\n\n📋 Phase 5: 종합 분석 및 권장사항');
    console.log('='.repeat(50));
    
    const analysis = {
      dateProcessorResults: dateResults.map(r => ({
        mode: r.mode,
        success: r.success,
        dateBlocksCount: r.success ? (r.result.dateBlocks?.length || 0) : 0,
        error: r.error || null
      })),
      pipelineSuccess: !!pipelineResult.processedData,
      finalDatesCount: pipelineResult.processedData?.dates?.length || 0,
      issues: []
    };

    // 문제점 식별
    if (analysis.finalDatesCount === 0) {
      analysis.issues.push('최종 dates 배열이 비어있음');
    }
    
    const successfulModes = analysis.dateProcessorResults.filter(r => r.success && r.dateBlocksCount > 0);
    if (successfulModes.length === 0) {
      analysis.issues.push('모든 날짜 처리 모드에서 dateBlocks 추출 실패');
    } else if (analysis.finalDatesCount === 0) {
      analysis.issues.push('날짜 처리는 성공했으나 최종 변환에서 실패');
    }

    console.log('\n🔍 분석 결과:');
    console.log(JSON.stringify(analysis, null, 2));

    // 권장사항
    console.log('\n💡 권장사항:');
    if (analysis.issues.length > 0) {
      analysis.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
      
      if (successfulModes.length > 0 && analysis.finalDatesCount === 0) {
        console.log('\n🔧 추천 해결책:');
        console.log('  - selectBestResult 로직 검토');
        console.log('  - extractDatesFromResult 로직 검토');
        console.log('  - ResultMerger.mergeResults 동작 확인');
      }
    } else {
      console.log('  ✅ 모든 단계가 정상 동작함');
    }

  } catch (error) {
    console.error('\n❌ 디버깅 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  }
  
  console.log('\n🏁 === 디버깅 완료 ===');
}

// 실행
debugDatesPipeline().catch(console.error);