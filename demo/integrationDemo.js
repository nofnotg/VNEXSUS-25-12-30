/**
 * GPT-4o Mini Enhanced Integration System Demo
 * 
 * 완성된 통합 시스템의 실제 동작 데모 및 성능 검증
 * 모든 구성 요소의 연동 상태와 성능 지표를 실시간으로 확인
 */

import { IntegrationOrchestrator } from '../src/integration/integrationOrchestrator.js';
import fs from 'fs/promises';
import path from 'path';

class IntegrationDemo {
  constructor() {
    this.orchestrator = null;
    this.demoResults = {
      startTime: null,
      endTime: null,
      testCases: [],
      performanceMetrics: {},
      errors: [],
      summary: {}
    };
    
    // 데모 설정
    this.config = {
      testCases: [
        {
          name: '기본 의료 보고서 생성',
          prompt: '환자 김철수(45세, 남성)의 당뇨병 진단 및 치료 계획을 포함한 의료 보고서를 작성해주세요.',
          options: { priority: 'normal' }
        },
        {
          name: '복잡한 다중 증상 분석',
          prompt: '환자 이영희(62세, 여성)가 호흡곤란, 가슴 통증, 부종을 호소하고 있습니다. 심혈관계 질환 가능성을 포함한 종합적인 의료 보고서를 작성해주세요.',
          options: { priority: 'high', context: { symptoms: ['dyspnea', 'chest_pain', 'edema'] } }
        },
        {
          name: '응급 상황 보고서',
          prompt: '응급실에 내원한 환자 박민수(28세, 남성)의 교통사고 외상에 대한 응급 의료 보고서를 신속하게 작성해주세요.',
          options: { priority: 'urgent', context: { emergency: true } }
        },
        {
          name: '소아과 진료 보고서',
          prompt: '소아 환자 최지우(7세, 여성)의 발열과 기침 증상에 대한 소아과 전문 의료 보고서를 작성해주세요.',
          options: { priority: 'normal', context: { specialty: 'pediatrics' } }
        },
        {
          name: '정신건강 평가 보고서',
          prompt: '환자 정수민(35세, 남성)의 우울증 및 불안장애 증상에 대한 정신건강 평가 보고서를 작성해주세요.',
          options: { priority: 'normal', context: { specialty: 'psychiatry' } }
        }
      ],
      
      // 성능 테스트 설정
      performanceTest: {
        concurrentRequests: 3,
        totalRequests: 10,
        requestInterval: 2000 // 2초 간격
      },
      
      // 결과 저장 경로
      outputDirectory: './demo/results',
      reportFileName: `integration-demo-${Date.now()}.json`
    };
    
    console.log('🎭 Integration Demo 초기화 완료');
  }

  /**
   * 데모 실행
   */
  async run() {
    console.log('🚀 GPT-4o Mini Enhanced Integration System Demo 시작');
    console.log('=' .repeat(60));
    
    this.demoResults.startTime = Date.now();
    
    try {
      // 1. 통합 시스템 초기화
      await this.initializeSystem();
      
      // 2. 시스템 상태 확인
      await this.checkSystemHealth();
      
      // 3. 기본 기능 테스트
      await this.runBasicFunctionTests();
      
      // 4. 성능 테스트
      await this.runPerformanceTests();
      
      // 5. A/B 테스트 시뮬레이션
      await this.runABTestSimulation();
      
      // 6. 에러 처리 테스트
      await this.runErrorHandlingTests();
      
      // 7. 최종 결과 분석
      await this.analyzeResults();
      
      // 8. 리포트 생성
      await this.generateFinalReport();
      
      console.log('✅ 데모 완료!');
      
    } catch (error) {
      console.error('❌ 데모 실행 중 오류 발생:', error);
      this.demoResults.errors.push({
        timestamp: Date.now(),
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.demoResults.endTime = Date.now();
      
      // 시스템 정리
      await this.cleanup();
    }
  }

  /**
   * 통합 시스템 초기화
   */
  async initializeSystem() {
    console.log('\n📋 1. 통합 시스템 초기화');
    console.log('-'.repeat(40));
    
    try {
      // IntegrationOrchestrator 생성
      this.orchestrator = new IntegrationOrchestrator({
        enableEnhancedService: true,
        enableOptimization: true,
        enableMonitoring: true,
        enableCompatibility: true,
        integrationMode: 'gradual',
        logDirectory: './demo/logs',
        enableDetailedLogging: true,
        enableAutoTuning: true,
        tuningInterval: 30000 // 30초 (데모용)
      });
      
      // 시스템 초기화 및 시작
      await this.orchestrator.initialize();
      await this.orchestrator.start();
      
      console.log('✅ 통합 시스템 초기화 완료');
      
      // 초기화 상태 기록
      this.demoResults.initialization = {
        timestamp: Date.now(),
        status: 'success',
        components: this.orchestrator.getStatus()
      };
      
    } catch (error) {
      console.error('❌ 시스템 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 상태 확인
   */
  async checkSystemHealth() {
    console.log('\n🏥 2. 시스템 상태 확인');
    console.log('-'.repeat(40));
    
    try {
      const healthStatus = await this.orchestrator.performHealthCheck();
      
      console.log(`전체 상태: ${healthStatus.overall}`);
      
      for (const [component, status] of Object.entries(healthStatus.components)) {
        const statusIcon = status.status === 'healthy' ? '✅' : 
                          status.status === 'degraded' ? '⚠️' : '❌';
        console.log(`${statusIcon} ${component}: ${status.status}`);
      }
      
      this.demoResults.healthCheck = healthStatus;
      
    } catch (error) {
      console.error('❌ 상태 확인 실패:', error);
      this.demoResults.errors.push({
        timestamp: Date.now(),
        phase: 'health_check',
        error: error.message
      });
    }
  }

  /**
   * 기본 기능 테스트
   */
  async runBasicFunctionTests() {
    console.log('\n🧪 3. 기본 기능 테스트');
    console.log('-'.repeat(40));
    
    for (let i = 0; i < this.config.testCases.length; i++) {
      const testCase = this.config.testCases[i];
      
      console.log(`\n테스트 ${i + 1}: ${testCase.name}`);
      
      try {
        const startTime = Date.now();
        
        const result = await this.orchestrator.generateMedicalReport(
          testCase.prompt,
          testCase.options
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 결과 분석
        const testResult = {
          name: testCase.name,
          prompt: testCase.prompt.substring(0, 100) + '...',
          options: testCase.options,
          success: result.success !== false,
          duration: duration,
          service: result.integration?.service || 'unknown',
          tokenUsage: result.metadata?.tokenUsage || {},
          qualityScore: result.integration?.qualityScore || 0,
          optimizationApplied: result.integration?.optimizationApplied || false,
          timestamp: startTime
        };
        
        this.demoResults.testCases.push(testResult);
        
        // 결과 출력
        const successIcon = testResult.success ? '✅' : '❌';
        console.log(`${successIcon} 결과: ${testResult.success ? '성공' : '실패'}`);
        console.log(`⏱️ 소요 시간: ${duration}ms`);
        console.log(`🔧 사용 서비스: ${testResult.service}`);
        console.log(`📊 품질 점수: ${(testResult.qualityScore * 100).toFixed(1)}%`);
        
        if (testResult.tokenUsage.totalTokens) {
          console.log(`🎯 토큰 사용량: ${testResult.tokenUsage.totalTokens}`);
        }
        
        // 간격 대기
        if (i < this.config.testCases.length - 1) {
          await this.sleep(1000);
        }
        
      } catch (error) {
        console.error(`❌ 테스트 ${i + 1} 실패:`, error);
        
        this.demoResults.testCases.push({
          name: testCase.name,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
        
        this.demoResults.errors.push({
          timestamp: Date.now(),
          phase: 'basic_function_test',
          testCase: testCase.name,
          error: error.message
        });
      }
    }
  }

  /**
   * 성능 테스트
   */
  async runPerformanceTests() {
    console.log('\n⚡ 4. 성능 테스트');
    console.log('-'.repeat(40));
    
    try {
      const performanceResults = {
        concurrentTest: null,
        loadTest: null,
        stressTest: null
      };
      
      // 동시 요청 테스트
      console.log('\n📊 동시 요청 테스트');
      performanceResults.concurrentTest = await this.runConcurrentTest();
      
      // 부하 테스트
      console.log('\n🔥 부하 테스트');
      performanceResults.loadTest = await this.runLoadTest();
      
      // 스트레스 테스트
      console.log('\n💪 스트레스 테스트');
      performanceResults.stressTest = await this.runStressTest();
      
      this.demoResults.performanceMetrics = performanceResults;
      
    } catch (error) {
      console.error('❌ 성능 테스트 실패:', error);
      this.demoResults.errors.push({
        timestamp: Date.now(),
        phase: 'performance_test',
        error: error.message
      });
    }
  }

  /**
   * 동시 요청 테스트
   */
  async runConcurrentTest() {
    const concurrentRequests = this.config.performanceTest.concurrentRequests;
    const testPrompt = '환자의 기본 건강 상태를 평가하는 간단한 의료 보고서를 작성해주세요.';
    
    console.log(`${concurrentRequests}개의 동시 요청 실행...`);
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        this.orchestrator.generateMedicalReport(testPrompt, { 
          testId: `concurrent_${i}` 
        }).catch(error => ({ error: error.message, testId: `concurrent_${i}` }))
      );
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r.success !== false && !r.error).length;
    const failureCount = results.length - successCount;
    
    const testResult = {
      totalRequests: concurrentRequests,
      successCount,
      failureCount,
      successRate: successCount / concurrentRequests,
      totalTime: endTime - startTime,
      averageTime: (endTime - startTime) / concurrentRequests,
      results: results.map(r => ({
        success: r.success !== false && !r.error,
        service: r.integration?.service,
        duration: r.integration?.processingTime,
        error: r.error
      }))
    };
    
    console.log(`✅ 성공: ${successCount}/${concurrentRequests} (${(testResult.successRate * 100).toFixed(1)}%)`);
    console.log(`⏱️ 총 시간: ${testResult.totalTime}ms`);
    console.log(`📊 평균 시간: ${testResult.averageTime.toFixed(0)}ms`);
    
    return testResult;
  }

  /**
   * 부하 테스트
   */
  async runLoadTest() {
    const totalRequests = this.config.performanceTest.totalRequests;
    const interval = this.config.performanceTest.requestInterval;
    const testPrompt = '환자의 일반적인 건강 검진 결과를 요약한 의료 보고서를 작성해주세요.';
    
    console.log(`${totalRequests}개의 순차 요청 실행 (${interval}ms 간격)...`);
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      try {
        const result = await this.orchestrator.generateMedicalReport(testPrompt, {
          testId: `load_${i}`
        });
        
        results.push({
          success: true,
          duration: Date.now() - requestStart,
          service: result.integration?.service,
          tokenUsage: result.metadata?.tokenUsage?.totalTokens || 0
        });
        
        console.log(`📋 요청 ${i + 1}/${totalRequests} 완료 (${Date.now() - requestStart}ms)`);
        
      } catch (error) {
        results.push({
          success: false,
          duration: Date.now() - requestStart,
          error: error.message
        });
        
        console.log(`❌ 요청 ${i + 1}/${totalRequests} 실패: ${error.message}`);
      }
      
      // 간격 대기 (마지막 요청 제외)
      if (i < totalRequests - 1) {
        await this.sleep(interval);
      }
    }
    
    const endTime = Date.now();
    const successCount = results.filter(r => r.success).length;
    const totalTokens = results.reduce((sum, r) => sum + (r.tokenUsage || 0), 0);
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    const testResult = {
      totalRequests,
      successCount,
      failureCount: totalRequests - successCount,
      successRate: successCount / totalRequests,
      totalTime: endTime - startTime,
      averageDuration,
      totalTokens,
      averageTokens: totalTokens / successCount || 0,
      throughput: (successCount / ((endTime - startTime) / 1000)).toFixed(2) // requests per second
    };
    
    console.log(`✅ 성공률: ${(testResult.successRate * 100).toFixed(1)}%`);
    console.log(`⏱️ 평균 응답 시간: ${averageDuration.toFixed(0)}ms`);
    console.log(`🚀 처리량: ${testResult.throughput} req/sec`);
    console.log(`🎯 총 토큰 사용량: ${totalTokens}`);
    
    return testResult;
  }

  /**
   * 스트레스 테스트
   */
  async runStressTest() {
    console.log('높은 부하 상황에서의 시스템 안정성 테스트...');
    
    const stressPrompt = '복잡한 다중 질환을 가진 환자의 종합적인 의료 보고서를 상세하게 작성해주세요. 환자는 당뇨병, 고혈압, 심장질환을 동시에 앓고 있으며, 각 질환 간의 상호작용과 통합적인 치료 계획이 필요합니다.';
    
    const stressRequests = 5;
    const results = [];
    const startTime = Date.now();
    
    // 스트레스 상황 시뮬레이션 (빠른 연속 요청)
    const promises = [];
    for (let i = 0; i < stressRequests; i++) {
      promises.push(
        this.orchestrator.generateMedicalReport(stressPrompt, {
          testId: `stress_${i}`,
          priority: 'high'
        }).then(result => ({
          success: true,
          service: result.integration?.service,
          duration: result.integration?.processingTime,
          tokenUsage: result.metadata?.tokenUsage?.totalTokens || 0
        })).catch(error => ({
          success: false,
          error: error.message,
          duration: 0
        }))
      );
      
      // 짧은 간격으로 요청 시작
      if (i < stressRequests - 1) {
        await this.sleep(200);
      }
    }
    
    const stressResults = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = stressResults.filter(r => r.success).length;
    const totalTokens = stressResults.reduce((sum, r) => sum + (r.tokenUsage || 0), 0);
    
    const testResult = {
      totalRequests: stressRequests,
      successCount,
      failureCount: stressRequests - successCount,
      successRate: successCount / stressRequests,
      totalTime: endTime - startTime,
      totalTokens,
      systemStability: successCount / stressRequests >= 0.8 ? 'stable' : 'unstable'
    };
    
    console.log(`🎯 시스템 안정성: ${testResult.systemStability}`);
    console.log(`✅ 성공률: ${(testResult.successRate * 100).toFixed(1)}%`);
    console.log(`⏱️ 총 처리 시간: ${testResult.totalTime}ms`);
    
    return testResult;
  }

  /**
   * A/B 테스트 시뮬레이션
   */
  async runABTestSimulation() {
    console.log('\n🧪 5. A/B 테스트 시뮬레이션');
    console.log('-'.repeat(40));
    
    try {
      // A/B 테스트 시작 (호환성 관리자를 통해)
      if (this.orchestrator.components.compatibility) {
        await this.orchestrator.components.compatibility.startABTest();
        
        console.log('A/B 테스트 활성화됨');
        
        // 테스트 요청들 실행
        const abTestResults = [];
        const testPrompt = '환자의 정기 건강 검진 결과를 바탕으로 한 의료 보고서를 작성해주세요.';
        
        for (let i = 0; i < 10; i++) {
          try {
            const result = await this.orchestrator.generateMedicalReport(testPrompt, {
              userId: `user_${i % 5}`, // 5명의 사용자 시뮬레이션
              testId: `ab_test_${i}`
            });
            
            abTestResults.push({
              success: true,
              service: result.integration?.service,
              duration: result.integration?.processingTime,
              userId: `user_${i % 5}`
            });
            
            console.log(`📊 A/B 테스트 요청 ${i + 1}/10 완료 (서비스: ${result.integration?.service})`);
            
          } catch (error) {
            abTestResults.push({
              success: false,
              error: error.message,
              userId: `user_${i % 5}`
            });
          }
          
          await this.sleep(500);
        }
        
        // A/B 테스트 결과 분석
        const analysisResult = await this.orchestrator.components.compatibility.analyzeABTestResults();
        
        this.demoResults.abTestResults = {
          testResults: abTestResults,
          analysis: analysisResult
        };
        
        console.log('📈 A/B 테스트 분석 결과:');
        console.log(`Enhanced 서비스 성공률: ${(analysisResult.enhanced.successRate * 100).toFixed(1)}%`);
        console.log(`기존 서비스 성공률: ${(analysisResult.existing.successRate * 100).toFixed(1)}%`);
        console.log(`권장사항: ${analysisResult.recommendation?.action || 'N/A'}`);
        
      } else {
        console.log('⚠️ 호환성 관리자가 비활성화되어 A/B 테스트를 건너뜁니다.');
      }
      
    } catch (error) {
      console.error('❌ A/B 테스트 시뮬레이션 실패:', error);
      this.demoResults.errors.push({
        timestamp: Date.now(),
        phase: 'ab_test_simulation',
        error: error.message
      });
    }
  }

  /**
   * 에러 처리 테스트
   */
  async runErrorHandlingTests() {
    console.log('\n🛡️ 6. 에러 처리 테스트');
    console.log('-'.repeat(40));
    
    const errorTests = [
      {
        name: '빈 프롬프트 테스트',
        prompt: '',
        expectedError: true
      },
      {
        name: '매우 긴 프롬프트 테스트',
        prompt: 'A'.repeat(10000),
        expectedError: false // 시스템이 처리할 수 있어야 함
      },
      {
        name: '특수 문자 프롬프트 테스트',
        prompt: '환자의 의료 보고서 작성 @#$%^&*()_+{}|:"<>?[]\\;\',./',
        expectedError: false
      }
    ];
    
    const errorTestResults = [];
    
    for (const test of errorTests) {
      console.log(`\n🧪 ${test.name}`);
      
      try {
        const result = await this.orchestrator.generateMedicalReport(test.prompt, {
          testId: `error_test_${test.name}`
        });
        
        const testResult = {
          name: test.name,
          success: result.success !== false,
          expectedError: test.expectedError,
          actualError: false,
          passed: test.expectedError ? false : (result.success !== false)
        };
        
        errorTestResults.push(testResult);
        
        const passIcon = testResult.passed ? '✅' : '❌';
        console.log(`${passIcon} 결과: ${testResult.success ? '성공' : '실패'} (예상: ${test.expectedError ? '에러' : '성공'})`);
        
      } catch (error) {
        const testResult = {
          name: test.name,
          success: false,
          expectedError: test.expectedError,
          actualError: true,
          error: error.message,
          passed: test.expectedError
        };
        
        errorTestResults.push(testResult);
        
        const passIcon = testResult.passed ? '✅' : '❌';
        console.log(`${passIcon} 에러 발생: ${error.message} (예상: ${test.expectedError ? '에러' : '성공'})`);
      }
    }
    
    this.demoResults.errorHandlingTests = errorTestResults;
    
    const passedTests = errorTestResults.filter(t => t.passed).length;
    console.log(`\n📊 에러 처리 테스트 결과: ${passedTests}/${errorTestResults.length} 통과`);
  }

  /**
   * 결과 분석
   */
  async analyzeResults() {
    console.log('\n📊 7. 결과 분석');
    console.log('-'.repeat(40));
    
    const analysis = {
      timestamp: Date.now(),
      totalDuration: this.demoResults.endTime - this.demoResults.startTime,
      
      // 기본 기능 테스트 분석
      basicTests: {
        total: this.demoResults.testCases.length,
        successful: this.demoResults.testCases.filter(t => t.success).length,
        failed: this.demoResults.testCases.filter(t => !t.success).length,
        averageDuration: 0,
        averageQualityScore: 0,
        serviceDistribution: {}
      },
      
      // 성능 분석
      performance: {
        concurrentTestPassed: false,
        loadTestPassed: false,
        stressTestPassed: false,
        overallPerformance: 'unknown'
      },
      
      // 에러 분석
      errorHandling: {
        totalErrors: this.demoResults.errors.length,
        errorsByPhase: {},
        errorHandlingTestsPassed: 0
      },
      
      // 전체 평가
      overallAssessment: {
        grade: 'unknown',
        strengths: [],
        weaknesses: [],
        recommendations: []
      }
    };
    
    // 기본 테스트 분석
    if (this.demoResults.testCases.length > 0) {
      const successfulTests = this.demoResults.testCases.filter(t => t.success);
      
      analysis.basicTests.averageDuration = 
        successfulTests.reduce((sum, t) => sum + (t.duration || 0), 0) / successfulTests.length || 0;
      
      analysis.basicTests.averageQualityScore = 
        successfulTests.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / successfulTests.length || 0;
      
      // 서비스 분포 계산
      successfulTests.forEach(test => {
        const service = test.service || 'unknown';
        analysis.basicTests.serviceDistribution[service] = 
          (analysis.basicTests.serviceDistribution[service] || 0) + 1;
      });
    }
    
    // 성능 분석
    if (this.demoResults.performanceMetrics) {
      const perf = this.demoResults.performanceMetrics;
      
      analysis.performance.concurrentTestPassed = 
        perf.concurrentTest?.successRate >= 0.8;
      
      analysis.performance.loadTestPassed = 
        perf.loadTest?.successRate >= 0.9 && perf.loadTest?.averageDuration < 10000;
      
      analysis.performance.stressTestPassed = 
        perf.stressTest?.systemStability === 'stable';
      
      const passedTests = [
        analysis.performance.concurrentTestPassed,
        analysis.performance.loadTestPassed,
        analysis.performance.stressTestPassed
      ].filter(Boolean).length;
      
      analysis.performance.overallPerformance = 
        passedTests === 3 ? 'excellent' :
        passedTests === 2 ? 'good' :
        passedTests === 1 ? 'fair' : 'poor';
    }
    
    // 에러 분석
    this.demoResults.errors.forEach(error => {
      const phase = error.phase || 'unknown';
      analysis.errorHandling.errorsByPhase[phase] = 
        (analysis.errorHandling.errorsByPhase[phase] || 0) + 1;
    });
    
    if (this.demoResults.errorHandlingTests) {
      analysis.errorHandling.errorHandlingTestsPassed = 
        this.demoResults.errorHandlingTests.filter(t => t.passed).length;
    }
    
    // 전체 평가
    const basicTestSuccessRate = analysis.basicTests.successful / analysis.basicTests.total || 0;
    const performanceScore = 
      analysis.performance.overallPerformance === 'excellent' ? 1 :
      analysis.performance.overallPerformance === 'good' ? 0.8 :
      analysis.performance.overallPerformance === 'fair' ? 0.6 : 0.4;
    
    const overallScore = (basicTestSuccessRate * 0.4) + (performanceScore * 0.4) + 
                        (analysis.errorHandling.totalErrors === 0 ? 0.2 : 0.1);
    
    analysis.overallAssessment.grade = 
      overallScore >= 0.9 ? 'A' :
      overallScore >= 0.8 ? 'B' :
      overallScore >= 0.7 ? 'C' :
      overallScore >= 0.6 ? 'D' : 'F';
    
    // 강점과 약점 분석
    if (basicTestSuccessRate >= 0.9) {
      analysis.overallAssessment.strengths.push('높은 기본 기능 안정성');
    }
    
    if (analysis.performance.overallPerformance === 'excellent') {
      analysis.overallAssessment.strengths.push('우수한 성능');
    }
    
    if (analysis.errorHandling.totalErrors === 0) {
      analysis.overallAssessment.strengths.push('안정적인 에러 처리');
    }
    
    if (basicTestSuccessRate < 0.8) {
      analysis.overallAssessment.weaknesses.push('기본 기능 안정성 개선 필요');
      analysis.overallAssessment.recommendations.push('기본 기능 테스트 케이스 재검토');
    }
    
    if (analysis.performance.overallPerformance === 'poor') {
      analysis.overallAssessment.weaknesses.push('성능 최적화 필요');
      analysis.overallAssessment.recommendations.push('성능 병목 지점 분석 및 개선');
    }
    
    if (analysis.errorHandling.totalErrors > 5) {
      analysis.overallAssessment.weaknesses.push('에러 발생 빈도 높음');
      analysis.overallAssessment.recommendations.push('에러 처리 로직 강화');
    }
    
    this.demoResults.analysis = analysis;
    
    // 분석 결과 출력
    console.log(`📈 전체 평가: ${analysis.overallAssessment.grade}등급`);
    console.log(`✅ 기본 테스트 성공률: ${(basicTestSuccessRate * 100).toFixed(1)}%`);
    console.log(`⚡ 성능 평가: ${analysis.performance.overallPerformance}`);
    console.log(`🛡️ 총 에러 수: ${analysis.errorHandling.totalErrors}`);
    
    if (analysis.overallAssessment.strengths.length > 0) {
      console.log(`💪 강점: ${analysis.overallAssessment.strengths.join(', ')}`);
    }
    
    if (analysis.overallAssessment.weaknesses.length > 0) {
      console.log(`⚠️ 개선점: ${analysis.overallAssessment.weaknesses.join(', ')}`);
    }
  }

  /**
   * 최종 리포트 생성
   */
  async generateFinalReport() {
    console.log('\n📄 8. 최종 리포트 생성');
    console.log('-'.repeat(40));
    
    try {
      // 출력 디렉토리 생성
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
      
      // 통합 리포트 생성
      const integrationReport = await this.orchestrator.generateIntegrationReport();
      
      // 최종 리포트 구성
      const finalReport = {
        metadata: {
          demoVersion: '1.0.0',
          timestamp: Date.now(),
          duration: this.demoResults.endTime - this.demoResults.startTime,
          generatedAt: new Date().toISOString()
        },
        
        demoResults: this.demoResults,
        integrationReport: integrationReport,
        
        summary: {
          totalTests: this.demoResults.testCases.length,
          successfulTests: this.demoResults.testCases.filter(t => t.success).length,
          totalErrors: this.demoResults.errors.length,
          overallGrade: this.demoResults.analysis?.overallAssessment?.grade || 'N/A',
          performanceRating: this.demoResults.analysis?.performance?.overallPerformance || 'N/A'
        },
        
        recommendations: this.demoResults.analysis?.overallAssessment?.recommendations || []
      };
      
      // JSON 파일로 저장
      const reportPath = path.join(this.config.outputDirectory, this.config.reportFileName);
      await fs.writeFile(reportPath, JSON.stringify(finalReport, null, 2));
      
      // HTML 리포트 생성
      const htmlReport = this.generateHTMLReport(finalReport);
      const htmlPath = path.join(this.config.outputDirectory, 
        this.config.reportFileName.replace('.json', '.html'));
      await fs.writeFile(htmlPath, htmlReport);
      
      console.log(`✅ 리포트 저장 완료:`);
      console.log(`📄 JSON: ${reportPath}`);
      console.log(`🌐 HTML: ${htmlPath}`);
      
    } catch (error) {
      console.error('❌ 리포트 생성 실패:', error);
      this.demoResults.errors.push({
        timestamp: Date.now(),
        phase: 'report_generation',
        error: error.message
      });
    }
  }

  /**
   * HTML 리포트 생성
   * @param {Object} report - 리포트 데이터
   * @returns {string} HTML 내용
   */
  generateHTMLReport(report) {
    const summary = report.summary;
    const analysis = report.demoResults.analysis;
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GPT-4o Mini Enhanced Integration Demo Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #007acc; border-left: 4px solid #007acc; padding-left: 10px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; font-size: 14px; }
        .grade-${summary.overallGrade} { color: ${summary.overallGrade === 'A' ? '#28a745' : summary.overallGrade === 'B' ? '#17a2b8' : summary.overallGrade === 'C' ? '#ffc107' : '#dc3545'}; }
        .test-results { margin: 20px 0; }
        .test-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #007acc; }
        .success { border-left-color: #28a745; }
        .failure { border-left-color: #dc3545; }
        .performance-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .performance-fill { height: 100%; background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); transition: width 0.3s ease; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; }
        .timestamp { color: #666; font-size: 12px; text-align: right; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎭 GPT-4o Mini Enhanced Integration Demo Report</h1>
            <p>통합 시스템 성능 검증 및 분석 결과</p>
        </div>

        <div class="section">
            <h2>📊 전체 요약</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value grade-${summary.overallGrade}">${summary.overallGrade}</div>
                    <div class="metric-label">전체 평가</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${summary.successfulTests}/${summary.totalTests}</div>
                    <div class="metric-label">성공한 테스트</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${summary.totalErrors}</div>
                    <div class="metric-label">총 에러 수</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${summary.performanceRating}</div>
                    <div class="metric-label">성능 평가</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🧪 기본 기능 테스트 결과</h2>
            <div class="test-results">
                ${report.demoResults.testCases.map(test => `
                    <div class="test-item ${test.success ? 'success' : 'failure'}">
                        <h4>${test.name} ${test.success ? '✅' : '❌'}</h4>
                        <p><strong>소요 시간:</strong> ${test.duration || 0}ms</p>
                        <p><strong>사용 서비스:</strong> ${test.service || 'N/A'}</p>
                        <p><strong>품질 점수:</strong> ${((test.qualityScore || 0) * 100).toFixed(1)}%</p>
                        ${test.error ? `<p style="color: #dc3545;"><strong>에러:</strong> ${test.error}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        ${analysis ? `
        <div class="section">
            <h2>📈 성능 분석</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${analysis.basicTests.averageDuration.toFixed(0)}ms</div>
                    <div class="metric-label">평균 응답 시간</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${(analysis.basicTests.averageQualityScore * 100).toFixed(1)}%</div>
                    <div class="metric-label">평균 품질 점수</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${analysis.performance.overallPerformance}</div>
                    <div class="metric-label">전체 성능 평가</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${report.recommendations.length > 0 ? `
        <div class="section">
            <h2>💡 권장사항</h2>
            <div class="recommendations">
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
        ` : ''}

        <div class="timestamp">
            리포트 생성 시간: ${report.metadata.generatedAt}<br>
            총 소요 시간: ${(report.metadata.duration / 1000).toFixed(1)}초
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 시스템 정리
   */
  async cleanup() {
    console.log('\n🧹 시스템 정리 중...');
    
    try {
      if (this.orchestrator) {
        await this.orchestrator.stop();
      }
      
      console.log('✅ 시스템 정리 완료');
      
    } catch (error) {
      console.error('❌ 시스템 정리 중 오류:', error);
    }
  }

  /**
   * 대기 함수
   * @param {number} ms - 대기 시간 (밀리초)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 데모 실행
async function runDemo() {
  const demo = new IntegrationDemo();
  await demo.run();
}

// 스크립트가 직접 실행될 때만 데모 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { IntegrationDemo, runDemo };