/**
 * 거대 날짜 블록 처리 테스트 스크립트
 * 
 * 역할:
 * 1. 거대 날짜 블록 처리 로직 테스트
 * 2. 엔드-투-엔드 파이프라인 검증
 * 3. 성능 및 정확도 측정
 */

import PostProcessingManager from '../postprocess/index.js';
import MassiveDateBlockProcessor from '../postprocess/massiveDateBlockProcessor.js';

// 테스트용 샘플 의료 텍스트
const sampleMedicalText = `
진료기록부

환자명: 홍길동
생년월일: 1980-05-15

=== 진료 기록 ===

2024-01-15
주소: 복통, 소화불량
진단: 급성 위염
처방: 위장약 3일분
의사: 김의사

2024-01-20
주소: 복통 지속
진단: 만성 위염 의심
검사: 위내시경 예약
의사: 김의사

2024-01-25
검사일: 2024-01-25
검사명: 위내시경
결과: 만성 표재성 위염 확인
소견: 헬리코박터 파일로리 양성
치료: 제균치료 시작

2024-02-01
주소: 제균치료 후 경과 관찰
진단: 만성 위염 치료 중
처방: 제균치료 약물 7일분
의사: 김의사

2024-02-15
주소: 증상 호전
진단: 만성 위염 호전
검사: 제균치료 효과 확인 검사 예정
의사: 김의사

입원기록:
입원일: 2024-01-22
퇴원일: 2024-01-24
입원사유: 위내시경 검사 및 관찰

수술기록:
수술일: 2024-01-23
수술명: 내시경적 조직검사
집도의: 이외과

=== 검사 결과 ===

2024-01-25 위내시경:
- 위체부: 발적, 부종
- 위각부: 미란성 병변
- 십이지장: 정상

2024-02-10 혈액검사:
- WBC: 8,500
- RBC: 4.2
- Hb: 12.5
- 헬리코박터 항체: 양성

무의미한 텍스트들...
페이지 1/3
-------------------



빈 줄들이 많이 있음


페이지 2/3
-------------------

2024-03-01
주소: 재검 내원
진단: 제균치료 완료 후 상태
검사: 헬리코박터 재검 음성
결과: 치료 성공
의사: 김의사

페이지 3/3
-------------------

최종 진단: 헬리코박터 파일로리 연관 만성 위염 (치료 완료)
치료 기간: 2024-01-15 ~ 2024-03-01
담당의: 김의사
`;

// 테스트 함수들
class MassiveDateBlockTester {
  constructor() {
    this.testResults = [];
  }

  /**
   * 전체 테스트 실행
   */
  async runAllTests() {
    console.log('🧪 거대 날짜 블록 처리 테스트 시작\n');
    
    try {
      // 1. 기본 거대 날짜 블록 처리 테스트
      await this.testMassiveDateBlockProcessing();
      
      // 2. 후처리 파이프라인 통합 테스트
      await this.testPostProcessingPipeline();
      
      // 3. 성능 테스트
      await this.testPerformance();
      
      // 4. 정확도 테스트
      await this.testAccuracy();
      
      // 5. 엣지 케이스 테스트
      await this.testEdgeCases();
      
      // 결과 요약
      this.printTestSummary();
      
    } catch (error) {
      console.error('❌ 테스트 실행 중 오류:', error);
    }
  }

  /**
   * 거대 날짜 블록 처리 테스트
   */
  async testMassiveDateBlockProcessing() {
    console.log('=== 1. 거대 날짜 블록 처리 테스트 ===');
    
    try {
      const startTime = Date.now();
      const result = await MassiveDateBlockProcessor.processMassiveDateBlocks(sampleMedicalText);
      const processingTime = Date.now() - startTime;
      
      console.log('✅ 거대 날짜 블록 처리 성공');
      console.log(`📊 처리 결과:`);
      console.log(`   - 원본 텍스트 크기: ${result.originalSize} 문자`);
      console.log(`   - 처리된 텍스트 크기: ${result.processedSize} 문자`);
      console.log(`   - 구조화된 그룹 수: ${result.structuredGroups.length}`);
      console.log(`   - 날짜 블록 수: ${result.dateBlocks.length}`);
      console.log(`   - 평균 신뢰도: ${result.statistics.averageConfidence}`);
      console.log(`   - 처리 시간: ${processingTime}ms`);
      
      // 날짜 블록 상세 정보
      console.log('\n📅 발견된 날짜 블록:');
      result.dateBlocks.forEach((block, index) => {
        console.log(`   ${index + 1}. ${block.date} (신뢰도: ${block.confidence})`);
      });
      
      this.testResults.push({
        test: 'massiveDateBlockProcessing',
        success: true,
        processingTime,
        dateBlocksFound: result.dateBlocks.length,
        confidence: result.statistics.averageConfidence
      });
      
    } catch (error) {
      console.error('❌ 거대 날짜 블록 처리 테스트 실패:', error);
      this.testResults.push({
        test: 'massiveDateBlockProcessing',
        success: false,
        error: error.message
      });
    }
    
    console.log('\n');
  }

  /**
   * 후처리 파이프라인 통합 테스트
   */
  async testPostProcessingPipeline() {
    console.log('=== 2. 후처리 파이프라인 통합 테스트 ===');
    
    try {
      const startTime = Date.now();
      const result = await PostProcessingManager.processOCRResult(sampleMedicalText, {
        useAIExtraction: false,
        minConfidence: 0.3
      });
      const processingTime = Date.now() - startTime;
      
      console.log('✅ 후처리 파이프라인 성공');
      console.log(`📊 파이프라인 결과:`);
      console.log(`   - 처리 시간: ${result.processingTime}ms`);
      console.log(`   - 처리된 그룹 수: ${result.statistics.processedGroups}`);
      console.log(`   - 날짜 블록 수: ${result.statistics.dateBlocks}`);
      console.log(`   - 신뢰도: ${result.statistics.confidence}`);
      console.log(`   - 필터링 비율: ${result.statistics.filteringRate}%`);
      
      this.testResults.push({
        test: 'postProcessingPipeline',
        success: true,
        processingTime,
        processedGroups: result.statistics.processedGroups,
        confidence: result.statistics.confidence
      });
      
    } catch (error) {
      console.error('❌ 후처리 파이프라인 테스트 실패:', error);
      this.testResults.push({
        test: 'postProcessingPipeline',
        success: false,
        error: error.message
      });
    }
    
    console.log('\n');
  }

  /**
   * 성능 테스트
   */
  async testPerformance() {
    console.log('=== 3. 성능 테스트 ===');
    
    const iterations = 5;
    const times = [];
    
    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await MassiveDateBlockProcessor.processMassiveDateBlocks(sampleMedicalText);
        const processingTime = Date.now() - startTime;
        times.push(processingTime);
        console.log(`   반복 ${i + 1}: ${processingTime}ms`);
      }
      
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log('✅ 성능 테스트 완료');
      console.log(`📊 성능 결과:`);
      console.log(`   - 평균 처리 시간: ${avgTime.toFixed(1)}ms`);
      console.log(`   - 최소 처리 시간: ${minTime}ms`);
      console.log(`   - 최대 처리 시간: ${maxTime}ms`);
      console.log(`   - 처리량: ${(1000 / avgTime).toFixed(1)} 요청/초`);
      
      this.testResults.push({
        test: 'performance',
        success: true,
        averageTime: avgTime,
        minTime,
        maxTime,
        throughput: 1000 / avgTime
      });
      
    } catch (error) {
      console.error('❌ 성능 테스트 실패:', error);
      this.testResults.push({
        test: 'performance',
        success: false,
        error: error.message
      });
    }
    
    console.log('\n');
  }

  /**
   * 정확도 테스트
   */
  async testAccuracy() {
    console.log('=== 4. 정확도 테스트 ===');
    
    try {
      const result = await MassiveDateBlockProcessor.processMassiveDateBlocks(sampleMedicalText);
      
      // 예상되는 날짜들
      const expectedDates = [
        '2024-01-15', '2024-01-20', '2024-01-25', 
        '2024-02-01', '2024-02-15', '2024-01-22', 
        '2024-01-24', '2024-01-23', '2024-02-10', 
        '2024-03-01'
      ];
      
      const foundDates = result.dateBlocks.map(block => block.date);
      const correctDates = expectedDates.filter(date => foundDates.includes(date));
      const missedDates = expectedDates.filter(date => !foundDates.includes(date));
      const falseDates = foundDates.filter(date => !expectedDates.includes(date));
      
      const accuracy = (correctDates.length / expectedDates.length) * 100;
      const precision = foundDates.length > 0 ? (correctDates.length / foundDates.length) * 100 : 0;
      const recall = (correctDates.length / expectedDates.length) * 100;
      
      console.log('✅ 정확도 테스트 완료');
      console.log(`📊 정확도 결과:`);
      console.log(`   - 정확도 (Accuracy): ${accuracy.toFixed(1)}%`);
      console.log(`   - 정밀도 (Precision): ${precision.toFixed(1)}%`);
      console.log(`   - 재현율 (Recall): ${recall.toFixed(1)}%`);
      console.log(`   - 올바른 날짜: ${correctDates.length}/${expectedDates.length}`);
      console.log(`   - 놓친 날짜: ${missedDates.length}개`);
      console.log(`   - 잘못된 날짜: ${falseDates.length}개`);
      
      if (missedDates.length > 0) {
        console.log(`   - 놓친 날짜 목록: ${missedDates.join(', ')}`);
      }
      
      if (falseDates.length > 0) {
        console.log(`   - 잘못된 날짜 목록: ${falseDates.join(', ')}`);
      }
      
      this.testResults.push({
        test: 'accuracy',
        success: true,
        accuracy,
        precision,
        recall,
        correctDates: correctDates.length,
        expectedDates: expectedDates.length
      });
      
    } catch (error) {
      console.error('❌ 정확도 테스트 실패:', error);
      this.testResults.push({
        test: 'accuracy',
        success: false,
        error: error.message
      });
    }
    
    console.log('\n');
  }

  /**
   * 엣지 케이스 테스트
   */
  async testEdgeCases() {
    console.log('=== 5. 엣지 케이스 테스트 ===');
    
    const edgeCases = [
      {
        name: '빈 텍스트',
        text: ''
      },
      {
        name: '날짜가 없는 텍스트',
        text: '이것은 날짜가 없는 일반적인 텍스트입니다. 의료 기록이 아닙니다.'
      },
      {
        name: '잘못된 날짜 형식',
        text: '2024/13/45 잘못된 날짜 32-99-2024 또 다른 잘못된 날짜'
      },
      {
        name: '매우 긴 텍스트',
        text: sampleMedicalText.repeat(10)
      }
    ];
    
    for (const edgeCase of edgeCases) {
      try {
        console.log(`   테스트: ${edgeCase.name}`);
        const startTime = Date.now();
        const result = await MassiveDateBlockProcessor.processMassiveDateBlocks(edgeCase.text);
        const processingTime = Date.now() - startTime;
        
        console.log(`   ✅ 성공 - 처리 시간: ${processingTime}ms, 날짜 블록: ${result.dateBlocks.length}개`);
        
      } catch (error) {
        console.log(`   ❌ 실패 - ${error.message}`);
      }
    }
    
    this.testResults.push({
      test: 'edgeCases',
      success: true,
      casesCount: edgeCases.length
    });
    
    console.log('\n');
  }

  /**
   * 테스트 결과 요약
   */
  printTestSummary() {
    console.log('=== 📋 테스트 결과 요약 ===');
    
    const successfulTests = this.testResults.filter(result => result.success).length;
    const totalTests = this.testResults.length;
    
    console.log(`총 테스트: ${totalTests}개`);
    console.log(`성공: ${successfulTests}개`);
    console.log(`실패: ${totalTests - successfulTests}개`);
    console.log(`성공률: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📊 상세 결과:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}`);
      
      if (result.success) {
        if (result.processingTime) {
          console.log(`   - 처리 시간: ${result.processingTime}ms`);
        }
        if (result.accuracy) {
          console.log(`   - 정확도: ${result.accuracy.toFixed(1)}%`);
        }
        if (result.confidence) {
          console.log(`   - 신뢰도: ${result.confidence}`);
        }
      } else {
        console.log(`   - 오류: ${result.error}`);
      }
    });
    
    console.log('\n🎉 테스트 완료!');
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MassiveDateBlockTester();
  tester.runAllTests().catch(console.error);
}

export default MassiveDateBlockTester;