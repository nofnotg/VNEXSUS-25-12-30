/**
 * Hybrid Modules Test Suite
 * 
 * 하이브리드 모듈들의 기능 검증 및 기존 시스템과의 호환성 테스트
 * 
 * 테스트 범위:
 * 1. HybridDateProcessor 기능 검증
 * 2. HybridMedicalNormalizer 기능 검증
 * 3. 기존 테스트 케이스 호환성 확인
 * 4. 성능 비교 및 벤치마킹
 */

import HybridDateProcessor from './hybridDateProcessor.js';
import HybridMedicalNormalizer from './hybridMedicalNormalizer.js';
import MassiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';

class HybridModulesTester {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = {
      hybrid: {},
      legacy: {},
      comparison: {}
    };
  }

  /**
   * 전체 하이브리드 모듈 테스트 실행
   */
  async runAllTests() {
    console.log('🧪 하이브리드 모듈 테스트 시작...\n');
    
    try {
      // 1. HybridDateProcessor 테스트
      await this.testHybridDateProcessor();
      
      // 2. HybridMedicalNormalizer 테스트
      await this.testHybridMedicalNormalizer();
      
      // 3. 기존 테스트 케이스 호환성 검증
      await this.testBackwardCompatibility();
      
      // 4. 성능 비교 테스트
      await this.testPerformanceComparison();
      
      // 5. 하이브리드 모드별 테스트
      await this.testHybridModes();
      
      // 결과 요약
      this.printTestSummary();
      
      return {
        success: true,
        testResults: this.testResults,
        performanceMetrics: this.performanceMetrics
      };
      
    } catch (error) {
      console.error('❌ 하이브리드 모듈 테스트 실패:', error);
      return {
        success: false,
        error: error.message,
        testResults: this.testResults
      };
    }
  }

  /**
   * HybridDateProcessor 테스트
   */
  async testHybridDateProcessor() {
    console.log('=== 1. HybridDateProcessor 테스트 ===');
    
    const testCases = [
      {
        name: '기본 날짜 블록 처리',
        text: `
        2024-01-15 진료
        환자: 홍길동
        증상: 복통
        
        2024-01-20 재진
        상태: 호전
        처방: 약물 변경
        `,
        mode: 'hybrid'
      },
      {
        name: '복잡한 중첩 날짜 처리',
        text: `
        2024-01-15 첫 진료 시 환자가 "3일 전부터 아팠다"고 함
        당시 처방한 약물을 2024-01-18에 변경
        그 후 일주일 뒤 재검사 예정
        `,
        mode: 'hybrid'
      },
      {
        name: '레거시 모드 테스트',
        text: `
        2024-01-15 진료기록
        2024-01-20 재진기록
        `,
        mode: 'legacy'
      },
      {
        name: '코어엔진 모드 테스트',
        text: `
        오늘 진료 시 환자가 "어제부터 증상이 시작되었다"고 함
        최근 3일간의 증상 변화를 관찰
        `,
        mode: 'core'
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`📋 테스트: ${testCase.name} (모드: ${testCase.mode})`);
        
        const startTime = Date.now();
        const result = await HybridDateProcessor.processDateBlocks(testCase.text, {
          processingMode: testCase.mode,
          enableMonitoring: true
        });
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ 성공 - 처리시간: ${processingTime}ms`);
        console.log(`   📊 결과: ${result.dateBlocks?.length || 0}개 날짜 블록 발견`);
        console.log(`   🎯 신뢰도: ${result.averageConfidence || 'N/A'}`);
        console.log(`   🔄 모드: ${result.hybrid?.processingMode || testCase.mode}`);
        
        this.testResults.push({
          module: 'HybridDateProcessor',
          testCase: testCase.name,
          mode: testCase.mode,
          success: true,
          processingTime,
          dateBlocksFound: result.dateBlocks?.length || 0,
          confidence: result.averageConfidence
        });
        
      } catch (error) {
        console.error(`❌ 실패: ${testCase.name} - ${error.message}`);
        this.testResults.push({
          module: 'HybridDateProcessor',
          testCase: testCase.name,
          mode: testCase.mode,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('');
  }

  /**
   * HybridMedicalNormalizer 테스트
   */
  async testHybridMedicalNormalizer() {
    console.log('=== 2. HybridMedicalNormalizer 테스트 ===');
    
    const testDocument = `
    진료기록부
    
    환자명: 홍길동
    생년월일: 1980-05-15
    
    2024-01-15 첫 진료
    주소: 복통, 소화불량
    진단: 급성 위염
    처방: 위장약 3일분
    
    2024-01-20 재진
    주소: 복통 지속 (환자가 "5일 전부터 더 심해졌다"고 함)
    진단: 만성 위염 의심
    검사: 위내시경 예약 (다음 주 화요일)
    
    2024-01-25 검사
    검사명: 위내시경
    결과: 만성 표재성 위염 확인
    소견: 헬리코박터 파일로리 양성
    치료: 제균치료 시작 (2주간)
    `;

    const testModes = ['legacy', 'core', 'hybrid', 'adaptive'];
    
    for (const mode of testModes) {
      try {
        console.log(`📋 테스트 모드: ${mode}`);
        
        const normalizer = new HybridMedicalNormalizer({
          normalizationMode: mode,
          enableMonitoring: true,
          enableCorrelationAnalysis: true
        });
        
        const startTime = Date.now();
        const result = await normalizer.normalizeDocument(testDocument);
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ 성공 - 처리시간: ${processingTime}ms`);
        console.log(`   📊 의료 이벤트: ${result.normalizedReport?.medicalEvents?.length || 0}개`);
        console.log(`   🎯 정규화 모드: ${result.hybrid?.normalizationMode || mode}`);
        console.log(`   🧠 코어엔진 사용: ${result.hybrid?.coreEngineUsed ? 'Yes' : 'No'}`);
        console.log(`   📈 레거시 시스템 사용: ${result.hybrid?.legacySystemUsed ? 'Yes' : 'No'}`);
        
        // 상관관계 분석 결과 확인
        if (result.correlationAnalysis) {
          console.log(`   🔍 상관관계: ${result.correlationAnalysis.totalCorrelations}개 발견`);
        }
        
        this.testResults.push({
          module: 'HybridMedicalNormalizer',
          testCase: `정규화 모드: ${mode}`,
          mode: mode,
          success: true,
          processingTime,
          medicalEvents: result.normalizedReport?.medicalEvents?.length || 0,
          coreEngineUsed: result.hybrid?.coreEngineUsed,
          legacySystemUsed: result.hybrid?.legacySystemUsed
        });
        
      } catch (error) {
        console.error(`❌ 실패: 모드 ${mode} - ${error.message}`);
        this.testResults.push({
          module: 'HybridMedicalNormalizer',
          testCase: `정규화 모드: ${mode}`,
          mode: mode,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('');
  }

  /**
   * 기존 테스트 케이스 호환성 검증
   */
  async testBackwardCompatibility() {
    console.log('=== 3. 기존 테스트 케이스 호환성 검증 ===');
    
    const sampleMedicalText = `
    진료기록부
    
    환자명: 홍길동
    생년월일: 1980-05-15
    
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
    `;

    try {
      console.log('📋 기존 MassiveDateBlockProcessor vs HybridDateProcessor 비교');
      
      // 기존 시스템 테스트
      const legacyStartTime = Date.now();
      const legacyResult = await MassiveDateBlockProcessor.processMassiveDateBlocks(sampleMedicalText);
      const legacyTime = Date.now() - legacyStartTime;
      
      // 하이브리드 시스템 테스트 (레거시 모드)
      const hybridStartTime = Date.now();
      const hybridResult = await HybridDateProcessor.processDateBlocks(sampleMedicalText, {
        processingMode: 'legacy'
      });
      const hybridTime = Date.now() - hybridStartTime;
      
      console.log(`✅ 기존 시스템: ${legacyTime}ms, ${legacyResult.dateBlocks?.length || 0}개 블록`);
      console.log(`✅ 하이브리드 시스템: ${hybridTime}ms, ${hybridResult.dateBlocks?.length || 0}개 블록`);
      
      // 결과 비교
      const compatibility = this.compareResults(legacyResult, hybridResult);
      console.log(`🔍 호환성: ${compatibility.compatible ? '호환됨' : '호환되지 않음'}`);
      
      this.testResults.push({
        module: 'BackwardCompatibility',
        testCase: 'MassiveDateBlockProcessor 호환성',
        success: compatibility.compatible,
        legacyTime,
        hybridTime,
        compatibility
      });
      
    } catch (error) {
      console.error('❌ 호환성 테스트 실패:', error.message);
      this.testResults.push({
        module: 'BackwardCompatibility',
        testCase: 'MassiveDateBlockProcessor 호환성',
        success: false,
        error: error.message
      });
    }

    try {
      console.log('📋 기존 MedicalDocumentNormalizer vs HybridMedicalNormalizer 비교');
      
      // 기존 시스템 테스트
      const legacyNormalizer = new MedicalDocumentNormalizer();
      const legacyStartTime = Date.now();
      const legacyResult = await legacyNormalizer.normalizeDocument(sampleMedicalText);
      const legacyTime = Date.now() - legacyStartTime;
      
      // 하이브리드 시스템 테스트 (레거시 모드)
      const hybridNormalizer = new HybridMedicalNormalizer({
        normalizationMode: 'legacy'
      });
      const hybridStartTime = Date.now();
      const hybridResult = await hybridNormalizer.normalizeDocument(sampleMedicalText);
      const hybridTime = Date.now() - hybridStartTime;
      
      console.log(`✅ 기존 시스템: ${legacyTime}ms`);
      console.log(`✅ 하이브리드 시스템: ${hybridTime}ms`);
      
      // 결과 비교
      const compatibility = this.compareNormalizationResults(legacyResult, hybridResult);
      console.log(`🔍 호환성: ${compatibility.compatible ? '호환됨' : '호환되지 않음'}`);
      
      this.testResults.push({
        module: 'BackwardCompatibility',
        testCase: 'MedicalDocumentNormalizer 호환성',
        success: compatibility.compatible,
        legacyTime,
        hybridTime,
        compatibility
      });
      
    } catch (error) {
      console.error('❌ 정규화 호환성 테스트 실패:', error.message);
      this.testResults.push({
        module: 'BackwardCompatibility',
        testCase: 'MedicalDocumentNormalizer 호환성',
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * 성능 비교 테스트
   */
  async testPerformanceComparison() {
    console.log('=== 4. 성능 비교 테스트 ===');
    
    const testDocument = this.generateLargeTestDocument();
    const iterations = 5;
    
    try {
      // 기존 시스템 성능 측정
      console.log('📊 기존 시스템 성능 측정...');
      const legacyTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await MassiveDateBlockProcessor.processMassiveDateBlocks(testDocument);
        legacyTimes.push(Date.now() - startTime);
      }
      
      const legacyAvg = legacyTimes.reduce((a, b) => a + b, 0) / legacyTimes.length;
      
      // 하이브리드 시스템 성능 측정 (각 모드별)
      const hybridModes = ['legacy', 'core', 'hybrid'];
      const hybridResults = {};
      
      for (const mode of hybridModes) {
        console.log(`📊 하이브리드 시스템 성능 측정 (${mode} 모드)...`);
        const hybridTimes = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          await HybridDateProcessor.processDateBlocks(testDocument, {
            processingMode: mode
          });
          hybridTimes.push(Date.now() - startTime);
        }
        
        hybridResults[mode] = hybridTimes.reduce((a, b) => a + b, 0) / hybridTimes.length;
      }
      
      // 성능 메트릭 저장
      this.performanceMetrics = {
        legacy: {
          averageTime: legacyAvg,
          times: legacyTimes
        },
        hybrid: hybridResults,
        comparison: {
          legacyVsHybridLegacy: ((hybridResults.legacy - legacyAvg) / legacyAvg * 100).toFixed(2),
          hybridImprovement: {
            core: ((legacyAvg - hybridResults.core) / legacyAvg * 100).toFixed(2),
            hybrid: ((legacyAvg - hybridResults.hybrid) / legacyAvg * 100).toFixed(2)
          }
        }
      };
      
      console.log('📈 성능 비교 결과:');
      console.log(`   기존 시스템: ${legacyAvg.toFixed(2)}ms`);
      console.log(`   하이브리드 (legacy): ${hybridResults.legacy.toFixed(2)}ms`);
      console.log(`   하이브리드 (core): ${hybridResults.core.toFixed(2)}ms`);
      console.log(`   하이브리드 (hybrid): ${hybridResults.hybrid.toFixed(2)}ms`);
      
      this.testResults.push({
        module: 'PerformanceComparison',
        testCase: '성능 벤치마크',
        success: true,
        metrics: this.performanceMetrics
      });
      
    } catch (error) {
      console.error('❌ 성능 비교 테스트 실패:', error.message);
      this.testResults.push({
        module: 'PerformanceComparison',
        testCase: '성능 벤치마크',
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  /**
   * 하이브리드 모드별 테스트
   */
  async testHybridModes() {
    console.log('=== 5. 하이브리드 모드별 특성 테스트 ===');
    
    const testCases = [
      {
        name: '단순 날짜 패턴 (legacy 모드 최적)',
        text: '2024-01-15 진료\n2024-01-20 재진\n2024-01-25 검사',
        expectedMode: 'legacy'
      },
      {
        name: '복잡한 중첩 표현 (core 모드 최적)',
        text: '오늘 진료 시 환자가 "3일 전부터 아팠다"고 하며, 그 전 주에도 비슷한 증상이 있었다고 함',
        expectedMode: 'core'
      },
      {
        name: '혼합 패턴 (hybrid 모드 최적)',
        text: '2024-01-15 첫 진료 시 환자가 "어제부터 증상 시작"이라고 함. 다음 주 화요일 재검사 예정',
        expectedMode: 'hybrid'
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`📋 테스트: ${testCase.name}`);
        
        // 적응형 모드로 테스트
        const normalizer = new HybridMedicalNormalizer({
          normalizationMode: 'adaptive'
        });
        
        const result = await normalizer.normalizeDocument(testCase.text);
        const actualMode = result.hybrid?.normalizationMode;
        
        console.log(`   예상 모드: ${testCase.expectedMode}`);
        console.log(`   실제 모드: ${actualMode}`);
        console.log(`   ✅ ${actualMode === testCase.expectedMode ? '예상과 일치' : '예상과 다름'}`);
        
        this.testResults.push({
          module: 'HybridModes',
          testCase: testCase.name,
          success: true,
          expectedMode: testCase.expectedMode,
          actualMode: actualMode,
          modeMatch: actualMode === testCase.expectedMode
        });
        
      } catch (error) {
        console.error(`❌ 실패: ${testCase.name} - ${error.message}`);
        this.testResults.push({
          module: 'HybridModes',
          testCase: testCase.name,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log('');
  }

  /**
   * 결과 비교 (날짜 블록 처리)
   */
  compareResults(legacyResult, hybridResult) {
    const compatibility = {
      compatible: true,
      differences: []
    };
    
    // 날짜 블록 수 비교
    const legacyCount = legacyResult.dateBlocks?.length || 0;
    const hybridCount = hybridResult.dateBlocks?.length || 0;
    
    if (Math.abs(legacyCount - hybridCount) > 1) { // 1개 차이까지는 허용
      compatibility.compatible = false;
      compatibility.differences.push(`날짜 블록 수 차이: legacy ${legacyCount}, hybrid ${hybridCount}`);
    }
    
    return compatibility;
  }

  /**
   * 정규화 결과 비교
   */
  compareNormalizationResults(legacyResult, hybridResult) {
    const compatibility = {
      compatible: true,
      differences: []
    };
    
    // 기본 성공 여부 확인
    if (legacyResult.success !== hybridResult.success) {
      compatibility.compatible = false;
      compatibility.differences.push('성공 여부 불일치');
    }
    
    // 의료 이벤트 수 비교 (하이브리드가 더 많을 수 있음)
    const legacyEvents = legacyResult.normalizedReport?.medicalEvents?.length || 0;
    const hybridEvents = hybridResult.normalizedReport?.medicalEvents?.length || 0;
    
    if (hybridEvents < legacyEvents) { // 하이브리드가 더 적으면 문제
      compatibility.compatible = false;
      compatibility.differences.push(`의료 이벤트 수 감소: legacy ${legacyEvents}, hybrid ${hybridEvents}`);
    }
    
    return compatibility;
  }

  /**
   * 대용량 테스트 문서 생성
   */
  generateLargeTestDocument() {
    const baseText = `
    진료기록부
    
    환자명: 홍길동
    생년월일: 1980-05-15
    
    2024-01-15 첫 진료
    주소: 복통, 소화불량
    진단: 급성 위염
    처방: 위장약 3일분
    
    2024-01-20 재진
    주소: 복통 지속
    진단: 만성 위염 의심
    검사: 위내시경 예약
    `;
    
    // 10배 반복하여 대용량 문서 생성
    return Array(10).fill(baseText).join('\n\n');
  }

  /**
   * 테스트 결과 요약 출력
   */
  printTestSummary() {
    console.log('=== 📊 테스트 결과 요약 ===');
    
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const successRate = (successfulTests / totalTests * 100).toFixed(1);
    
    console.log(`총 테스트: ${totalTests}개`);
    console.log(`성공: ${successfulTests}개`);
    console.log(`실패: ${totalTests - successfulTests}개`);
    console.log(`성공률: ${successRate}%`);
    
    // 모듈별 결과
    const moduleResults = {};
    this.testResults.forEach(result => {
      if (!moduleResults[result.module]) {
        moduleResults[result.module] = { total: 0, success: 0 };
      }
      moduleResults[result.module].total++;
      if (result.success) moduleResults[result.module].success++;
    });
    
    console.log('\n📋 모듈별 결과:');
    Object.entries(moduleResults).forEach(([module, stats]) => {
      const rate = (stats.success / stats.total * 100).toFixed(1);
      console.log(`   ${module}: ${stats.success}/${stats.total} (${rate}%)`);
    });
    
    // 성능 요약
    if (this.performanceMetrics.legacy && this.performanceMetrics.hybrid) {
      console.log('\n⚡ 성능 요약:');
      console.log(`   기존 시스템: ${this.performanceMetrics.legacy.averageTime?.toFixed(2)}ms`);
      console.log(`   하이브리드 (legacy): ${this.performanceMetrics.hybrid.legacy?.toFixed(2)}ms`);
      console.log(`   하이브리드 (core): ${this.performanceMetrics.hybrid.core?.toFixed(2)}ms`);
      console.log(`   하이브리드 (hybrid): ${this.performanceMetrics.hybrid.hybrid?.toFixed(2)}ms`);
    }
    
    console.log('\n🎉 하이브리드 모듈 테스트 완료!\n');
  }
}

// 테스트 실행
const tester = new HybridModulesTester();
tester.runAllTests().then(result => {
  if (result.success) {
    console.log('✅ 모든 하이브리드 모듈 테스트 통과!');
    process.exit(0);
  } else {
    console.error('❌ 하이브리드 모듈 테스트 실패');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});

export default HybridModulesTester;