import HybridController from './backend/controllers/hybridController.js';

console.log('=== 최적화된 파이프라인 구현 ===');

class OptimizedHybridController extends HybridController {
  
  /**
   * executeUnifiedPipeline의 최적화된 버전
   * 기존 파이프라인의 성능 문제를 해결하고 타임아웃을 적용
   */
  async executeOptimizedPipeline(text, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || 30000; // 30초 기본 타임아웃
    
    console.log(`🚀 최적화된 파이프라인 시작 (타임아웃: ${timeout}ms)`);
    console.log(`📝 입력 텍스트 길이: ${text?.length || 0}자`);
    
    try {
      // 타임아웃 Promise 생성
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`파이프라인 타임아웃 (${timeout}ms)`)), timeout)
      );
      
      // 실제 파이프라인 실행
      const pipelinePromise = this._executeOptimizedPipelineCore(text, options);
      
      // 타임아웃과 경쟁
      const result = await Promise.race([pipelinePromise, timeoutPromise]);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ 최적화된 파이프라인 완료 (${processingTime}ms)`);
      
      return {
        ...result,
        processingTime,
        optimized: true
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 최적화된 파이프라인 실패 (${processingTime}ms):`, error.message);
      
      // 폴백: 간단한 날짜 추출
      return this._executeFallbackPipeline(text, options);
    }
  }
  
  /**
   * 최적화된 파이프라인 핵심 로직
   */
  async _executeOptimizedPipelineCore(text, options) {
    console.log('\n=== Stage 1: 날짜 처리 (최적화) ===');
    
    // 1. 병렬 처리 대신 순차 처리로 변경 (메모리 효율성)
    const dateResults = [];
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    
    for (const mode of modes) {
      try {
        console.log(`  🔄 ${mode} 모드 처리 중...`);
        const result = await this.dateProcessor.processMassiveDateBlocks(text, { 
          processingMode: mode,
          timeout: 5000 // 각 모드별 5초 타임아웃
        });
        
        if (result.success) {
          dateResults.push(result);
          console.log(`  ✅ ${mode}: ${result.dateBlocks?.length || 0}개 블록`);
        } else {
          console.log(`  ⚠️ ${mode}: 실패`);
        }
        
      } catch (error) {
        console.log(`  ❌ ${mode}: ${error.message}`);
      }
    }
    
    console.log(`📊 성공한 날짜 처리 결과: ${dateResults.length}개`);
    
    // 2. 최적 결과 선택
    console.log('\n=== Stage 2: 최적 결과 선택 ===');
    const bestDateResult = this.selectBestResult(dateResults, 'date');
    
    if (!bestDateResult) {
      console.log('⚠️ 최적 날짜 결과 없음');
      return {
        success: false,
        error: '날짜 처리 결과 없음',
        dates: [],
        statistics: { totalProcessed: 0 }
      };
    }
    
    console.log(`✅ 최적 결과 선택: ${bestDateResult.dateBlocks?.length || 0}개 블록`);
    
    // 3. NestedDateResolver (간소화)
    console.log('\n=== Stage 3: 중첩 날짜 해결 (간소화) ===');
    let resolvedDates = [];
    
    try {
      // 타임아웃 적용된 NestedDateResolver
      const resolverTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NestedDateResolver 타임아웃')), 3000)
      );
      
      const resolverPromise = this.nestedDateResolver.resolveNestedDates(text, bestDateResult.dateBlocks || []);
      const nestedResult = await Promise.race([resolverPromise, resolverTimeout]);
      
      resolvedDates = nestedResult.resolvedDates || [];
      console.log(`✅ 중첩 날짜 해결: ${resolvedDates.length}개`);
      
    } catch (error) {
      console.log(`⚠️ 중첩 날짜 해결 실패, 기본 결과 사용: ${error.message}`);
      resolvedDates = bestDateResult.dateBlocks || [];
    }
    
    // 4. 결과 통합 및 날짜 추출
    console.log('\n=== Stage 4: 결과 통합 ===');
    
    // 통합된 결과 생성
    const mergedResult = {
      ...bestDateResult,
      dateBlocks: resolvedDates.length > 0 ? resolvedDates : bestDateResult.dateBlocks
    };
    
    // 날짜 추출
    const extractedDates = this.extractDatesFromResult(mergedResult);
    console.log(`📅 최종 추출된 날짜: ${extractedDates?.length || 0}개`);
    
    // 5. 품질 점수 계산
    const qualityScore = this.calculateQualityScore(mergedResult, extractedDates);
    console.log(`🎯 품질 점수: ${qualityScore}`);
    
    return {
      success: true,
      dates: extractedDates || [],
      bestResult: mergedResult,
      qualityScore,
      statistics: {
        totalProcessed: dateResults.length,
        modesUsed: modes,
        nestedDatesResolved: resolvedDates.length,
        finalDateCount: extractedDates?.length || 0
      }
    };
  }
  
  /**
   * 폴백 파이프라인 (간단한 날짜 추출)
   */
  async _executeFallbackPipeline(text, options) {
    console.log('\n🔄 폴백 파이프라인 실행');
    
    try {
      // 가장 안정적인 legacy 모드만 사용
      const result = await this.dateProcessor.processMassiveDateBlocks(text, { 
        processingMode: 'legacy' 
      });
      
      if (result.success && result.dateBlocks?.length > 0) {
        const extractedDates = this.extractDatesFromResult(result);
        
        console.log(`✅ 폴백 성공: ${extractedDates?.length || 0}개 날짜 추출`);
        
        return {
          success: true,
          dates: extractedDates || [],
          bestResult: result,
          fallback: true,
          statistics: {
            totalProcessed: 1,
            modesUsed: ['legacy'],
            finalDateCount: extractedDates?.length || 0
          }
        };
      }
      
    } catch (error) {
      console.error('❌ 폴백 파이프라인도 실패:', error.message);
    }
    
    return {
      success: false,
      error: '모든 파이프라인 실패',
      dates: [],
      statistics: { totalProcessed: 0 }
    };
  }
  
  /**
   * 품질 점수 계산 (간소화)
   */
  calculateQualityScore(result, dates) {
    if (!result || !dates) return 0;
    
    let score = 0;
    
    // 날짜 개수 점수 (40%)
    const dateCount = dates.length;
    score += Math.min(dateCount / 5, 1) * 0.4;
    
    // 신뢰도 점수 (40%)
    const avgConfidence = result.statistics?.averageConfidence || result.confidence || 0;
    score += avgConfidence * 0.4;
    
    // 성공 여부 (20%)
    if (result.success) score += 0.2;
    
    return Math.round(score * 100) / 100;
  }
}

// 테스트 실행
async function testOptimizedPipeline() {
  console.log('=== 최적화된 파이프라인 테스트 ===\n');
  
  const controller = new OptimizedHybridController();
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다. 다음 예약은 2024년 12월 20일입니다.";
  
  console.log(`테스트 텍스트: ${testText}\n`);
  
  try {
    // 최적화된 파이프라인 실행
    const result = await controller.executeOptimizedPipeline(testText, {
      timeout: 15000 // 15초 타임아웃
    });
    
    console.log('\n🎉 최적화된 파이프라인 결과:');
    console.log(`  성공: ${result.success}`);
    console.log(`  추출된 날짜: ${result.dates?.length || 0}개`);
    console.log(`  처리 시간: ${result.processingTime}ms`);
    console.log(`  품질 점수: ${result.qualityScore}`);
    console.log(`  폴백 사용: ${result.fallback || false}`);
    
    if (result.dates && result.dates.length > 0) {
      console.log('\n📅 추출된 날짜 목록:');
      result.dates.forEach((date, index) => {
        console.log(`  ${index + 1}. ${date.date} (신뢰도: ${date.confidence})`);
      });
    }
    
    console.log('\n📊 통계:');
    console.log(`  처리된 모드: ${result.statistics?.modesUsed?.join(', ') || 'N/A'}`);
    console.log(`  최종 날짜 개수: ${result.statistics?.finalDateCount || 0}`);
    
    // 기존 파이프라인과 비교
    console.log('\n=== 기존 파이프라인과 비교 ===');
    console.log('기존 executeUnifiedPipeline: 타임아웃 (30초+)');
    console.log(`최적화된 파이프라인: ${result.processingTime}ms`);
    console.log(`성능 개선: ${result.processingTime < 30000 ? '✅ 대폭 개선' : '❌ 여전히 느림'}`);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testOptimizedPipeline();