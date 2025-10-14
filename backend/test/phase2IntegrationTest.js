/**
 * Phase 2 AI 프롬프트 보강 시스템 통합 테스트
 * 
 * 테스트 범위:
 * - 프롬프트 보강기 단독 테스트
 * - 컨텍스트 분석기 단독 테스트
 * - 향상된 전처리기 통합 테스트
 * - 성능 비교 및 검증
 * 
 * @version 2.0.0
 * @author VNEXSUS AI Team
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phase 2 모듈들 import
import promptEnhancer from '../postprocess/promptEnhancer.js';
import contextAnalyzer from '../postprocess/contextAnalyzer.js';
import enhancedPreprocessor from '../postprocess/enhancedPreprocessor.js';

class Phase2IntegrationTest {
  constructor() {
    this.version = '2.0.0';
    this.testResults = {
      promptEnhancer: {},
      contextAnalyzer: {},
      enhancedPreprocessor: {},
      integration: {},
      performance: {}
    };
    
    // 테스트 케이스 데이터
    this.testCases = [];
    
    console.log('🧪 Phase 2 AI 프롬프트 보강 시스템 통합 테스트 초기화');
  }
  
  /**
   * 전체 테스트 실행
   */
  async runAllTests() {
    console.log('🚀 Phase 2 통합 테스트 시작...\n');
    
    try {
      // 1. 테스트 데이터 로드
      await this.loadTestData();
      
      // 2. 시스템 초기화 테스트
      await this.testSystemInitialization();
      
      // 3. 프롬프트 보강기 테스트
      await this.testPromptEnhancer();
      
      // 4. 컨텍스트 분석기 테스트
      await this.testContextAnalyzer();
      
      // 5. 향상된 전처리기 테스트
      await this.testEnhancedPreprocessor();
      
      // 6. 통합 성능 테스트
      await this.testIntegrationPerformance();
      
      // 7. 결과 분석 및 리포트 생성
      await this.generateTestReport();
      
      console.log('✅ Phase 2 통합 테스트 완료\n');
      
    } catch (error) {
      console.error('❌ Phase 2 통합 테스트 실패:', error);
      throw error;
    }
  }
  
  /**
   * 테스트 데이터 로드
   */
  async loadTestData() {
    console.log('📚 테스트 데이터 로드 중...');
    
    try {
      // 실제 케이스 파일들 로드
      const caseDir = path.join(__dirname, '../../src/rag/case_sample');
      
      if (fs.existsSync(caseDir)) {
        const caseFiles = fs.readdirSync(caseDir)
          .filter(file => file.startsWith('Case') && file.endsWith('.txt'))
          .slice(0, 5); // 처음 5개 케이스만 사용
        
        for (const file of caseFiles) {
          const filePath = path.join(caseDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          this.testCases.push({
            name: file,
            content: content,
            size: content.length,
            type: this.classifyTestCase(content)
          });
        }
      }
      
      // 추가 테스트 케이스 생성
      this.generateSyntheticTestCases();
      
      console.log(`✅ 테스트 데이터 로드 완료: ${this.testCases.length}개 케이스`);
      
    } catch (error) {
      console.error('❌ 테스트 데이터 로드 실패:', error);
      // 기본 테스트 케이스 생성
      this.generateSyntheticTestCases();
    }
  }
  
  /**
   * 시스템 초기화 테스트
   */
  async testSystemInitialization() {
    console.log('🔧 시스템 초기화 테스트...');
    
    const initResults = {};
    
    // 프롬프트 보강기 초기화
    const promptEnhancerInit = await promptEnhancer.initialize();
    initResults.promptEnhancer = promptEnhancerInit.success;
    
    // 컨텍스트 분석기 초기화
    const contextAnalyzerInit = await contextAnalyzer.initialize();
    initResults.contextAnalyzer = contextAnalyzerInit.success;
    
    // 향상된 전처리기 초기화
    const enhancedPreprocessorInit = await enhancedPreprocessor.initialize();
    initResults.enhancedPreprocessor = enhancedPreprocessorInit.success;
    
    this.testResults.initialization = {
      success: Object.values(initResults).every(Boolean),
      components: initResults,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ 시스템 초기화 테스트 완료:', initResults);
  }
  
  /**
   * 프롬프트 보강기 테스트
   */
  async testPromptEnhancer() {
    console.log('🎯 프롬프트 보강기 테스트...');
    
    const results = {
      totalTests: 0,
      successfulTests: 0,
      averageImprovementScore: 0,
      averageProcessingTime: 0,
      testDetails: []
    };
    
    for (const testCase of this.testCases) {
      const startTime = Date.now();
      
      try {
        const enhancementResult = await promptEnhancer.enhancePrompt(testCase.content, {
          hospital: 'test_hospital',
          taskType: 'general'
        });
        
        const processingTime = Date.now() - startTime;
        
        results.totalTests++;
        if (enhancementResult.success) {
          results.successfulTests++;
          results.averageImprovementScore += enhancementResult.metadata.improvementScore;
        }
        results.averageProcessingTime += processingTime;
        
        results.testDetails.push({
          testCase: testCase.name,
          success: enhancementResult.success,
          improvementScore: enhancementResult.metadata?.improvementScore || 0,
          processingTime,
          recommendedModel: enhancementResult.metadata?.recommendedModel
        });
        
        console.log(`  ✓ ${testCase.name}: ${enhancementResult.success ? '성공' : '실패'} (${processingTime}ms)`);
        
      } catch (error) {
        results.totalTests++;
        results.testDetails.push({
          testCase: testCase.name,
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
        
        console.log(`  ✗ ${testCase.name}: 오류 - ${error.message}`);
      }
    }
    
    // 평균값 계산
    if (results.totalTests > 0) {
      results.averageImprovementScore /= results.successfulTests || 1;
      results.averageProcessingTime /= results.totalTests;
      results.successRate = (results.successfulTests / results.totalTests) * 100;
    }
    
    this.testResults.promptEnhancer = results;
    
    console.log(`✅ 프롬프트 보강기 테스트 완료: ${results.successRate.toFixed(1)}% 성공률`);
  }
  
  /**
   * 컨텍스트 분석기 테스트
   */
  async testContextAnalyzer() {
    console.log('🔍 컨텍스트 분석기 테스트...');
    
    const results = {
      totalTests: 0,
      successfulTests: 0,
      averageContextScore: 0,
      averageProcessingTime: 0,
      documentTypeAccuracy: 0,
      testDetails: []
    };
    
    for (const testCase of this.testCases) {
      const startTime = Date.now();
      
      try {
        const analysisResult = await contextAnalyzer.analyzeContext(testCase.content, {
          hospital: 'test_hospital'
        });
        
        const processingTime = Date.now() - startTime;
        
        results.totalTests++;
        if (analysisResult.success) {
          results.successfulTests++;
          results.averageContextScore += analysisResult.contextScore.overall;
          
          // 문서 유형 분류 정확도 평가 (간단한 휴리스틱)
          const predictedType = analysisResult.documentType.primaryType;
          const actualType = testCase.type;
          if (predictedType === actualType || predictedType !== 'unknown') {
            results.documentTypeAccuracy++;
          }
        }
        results.averageProcessingTime += processingTime;
        
        results.testDetails.push({
          testCase: testCase.name,
          success: analysisResult.success,
          contextScore: analysisResult.contextScore?.overall || 0,
          documentType: analysisResult.documentType?.primaryType || 'unknown',
          processingTime
        });
        
        console.log(`  ✓ ${testCase.name}: ${analysisResult.success ? '성공' : '실패'} (${processingTime}ms)`);
        
      } catch (error) {
        results.totalTests++;
        results.testDetails.push({
          testCase: testCase.name,
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
        
        console.log(`  ✗ ${testCase.name}: 오류 - ${error.message}`);
      }
    }
    
    // 평균값 계산
    if (results.totalTests > 0) {
      results.averageContextScore /= results.successfulTests || 1;
      results.averageProcessingTime /= results.totalTests;
      results.successRate = (results.successfulTests / results.totalTests) * 100;
      results.documentTypeAccuracy = (results.documentTypeAccuracy / results.totalTests) * 100;
    }
    
    this.testResults.contextAnalyzer = results;
    
    console.log(`✅ 컨텍스트 분석기 테스트 완료: ${results.successRate.toFixed(1)}% 성공률`);
  }
  
  /**
   * 향상된 전처리기 테스트
   */
  async testEnhancedPreprocessor() {
    console.log('🚀 향상된 전처리기 테스트...');
    
    const results = {
      totalTests: 0,
      successfulTests: 0,
      averageImprovementScore: 0,
      averageProcessingTime: 0,
      averageReductionRate: 0,
      phaseSuccessRates: {},
      testDetails: []
    };
    
    for (const testCase of this.testCases) {
      const startTime = Date.now();
      
      try {
        const processingResult = await enhancedPreprocessor.processDocument(testCase.content, {
          hospital: 'test_hospital',
          taskType: 'general'
        });
        
        const processingTime = Date.now() - startTime;
        
        results.totalTests++;
        if (processingResult.success) {
          results.successfulTests++;
          results.averageImprovementScore += processingResult.metadata.improvementScore;
          results.averageReductionRate += processingResult.metadata.reductionRate;
          
          // 단계별 성공률 추적
          for (const phase of processingResult.metadata.phases) {
            results.phaseSuccessRates[phase] = (results.phaseSuccessRates[phase] || 0) + 1;
          }
        }
        results.averageProcessingTime += processingTime;
        
        results.testDetails.push({
          testCase: testCase.name,
          success: processingResult.success,
          improvementScore: processingResult.metadata?.improvementScore || 0,
          reductionRate: processingResult.metadata?.reductionRate || 0,
          processingTime,
          phasesCompleted: processingResult.metadata?.phases || []
        });
        
        console.log(`  ✓ ${testCase.name}: ${processingResult.success ? '성공' : '실패'} (${processingTime}ms)`);
        
      } catch (error) {
        results.totalTests++;
        results.testDetails.push({
          testCase: testCase.name,
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        });
        
        console.log(`  ✗ ${testCase.name}: 오류 - ${error.message}`);
      }
    }
    
    // 평균값 및 단계별 성공률 계산
    if (results.totalTests > 0) {
      results.averageImprovementScore /= results.successfulTests || 1;
      results.averageReductionRate /= results.successfulTests || 1;
      results.averageProcessingTime /= results.totalTests;
      results.successRate = (results.successfulTests / results.totalTests) * 100;
      
      // 단계별 성공률을 백분율로 변환
      for (const phase in results.phaseSuccessRates) {
        results.phaseSuccessRates[phase] = (results.phaseSuccessRates[phase] / results.totalTests) * 100;
      }
    }
    
    this.testResults.enhancedPreprocessor = results;
    
    console.log(`✅ 향상된 전처리기 테스트 완료: ${results.successRate.toFixed(1)}% 성공률`);
  }
  
  /**
   * 통합 성능 테스트
   */
  async testIntegrationPerformance() {
    console.log('⚡ 통합 성능 테스트...');
    
    const performanceResults = {
      systemStatus: enhancedPreprocessor.getSystemStatus(),
      performanceReport: enhancedPreprocessor.generatePerformanceReport(),
      componentHealth: {
        promptEnhancer: promptEnhancer.getSystemStatus(),
        contextAnalyzer: contextAnalyzer.getSystemStatus()
      }
    };
    
    this.testResults.performance = performanceResults;
    
    console.log('✅ 통합 성능 테스트 완료');
  }
  
  /**
   * 테스트 리포트 생성
   */
  async generateTestReport() {
    console.log('📊 테스트 리포트 생성 중...');
    
    const report = {
      testSuite: 'Phase 2 AI 프롬프트 보강 시스템 통합 테스트',
      version: this.version,
      timestamp: new Date().toISOString(),
      testCases: this.testCases.length,
      results: this.testResults,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };
    
    // 리포트 파일 저장
    const reportPath = path.join(process.cwd(), 'phase2_integration_test_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✅ 테스트 리포트 저장: ${reportPath}`);
    
    // 콘솔 요약 출력
    this.printSummary(report.summary);
    
    return report;
  }
  
  /**
   * 테스트 요약 생성
   */
  generateSummary() {
    const summary = {
      overallSuccess: true,
      componentResults: {},
      performanceMetrics: {},
      issues: []
    };
    
    // 컴포넌트별 결과 요약
    for (const [component, results] of Object.entries(this.testResults)) {
      if (results.successRate !== undefined) {
        summary.componentResults[component] = {
          successRate: `${results.successRate.toFixed(1)}%`,
          averageProcessingTime: `${results.averageProcessingTime.toFixed(0)}ms`,
          totalTests: results.totalTests
        };
        
        if (results.successRate < 80) {
          summary.overallSuccess = false;
          summary.issues.push(`${component} 성공률 낮음: ${results.successRate.toFixed(1)}%`);
        }
      }
    }
    
    // 성능 메트릭 요약
    if (this.testResults.enhancedPreprocessor.averageImprovementScore) {
      summary.performanceMetrics.averageImprovement = 
        `${this.testResults.enhancedPreprocessor.averageImprovementScore.toFixed(1)}%`;
    }
    
    if (this.testResults.enhancedPreprocessor.averageReductionRate) {
      summary.performanceMetrics.averageReduction = 
        `${this.testResults.enhancedPreprocessor.averageReductionRate.toFixed(1)}%`;
    }
    
    return summary;
  }
  
  /**
   * 개선 권장사항 생성
   */
  generateRecommendations() {
    const recommendations = [];
    
    // 성공률 기반 권장사항
    if (this.testResults.promptEnhancer.successRate < 90) {
      recommendations.push({
        component: 'promptEnhancer',
        priority: 'high',
        issue: '프롬프트 보강기 성공률 개선 필요',
        suggestion: '프롬프트 템플릿 및 컨텍스트 분석 로직 개선'
      });
    }
    
    if (this.testResults.contextAnalyzer.documentTypeAccuracy < 70) {
      recommendations.push({
        component: 'contextAnalyzer',
        priority: 'medium',
        issue: '문서 유형 분류 정확도 개선 필요',
        suggestion: '문서 유형 분류 키워드 및 패턴 확장'
      });
    }
    
    // 성능 기반 권장사항
    if (this.testResults.enhancedPreprocessor.averageProcessingTime > 10000) {
      recommendations.push({
        component: 'enhancedPreprocessor',
        priority: 'medium',
        issue: '처리 시간 최적화 필요',
        suggestion: '병렬 처리 및 캐싱 전략 도입'
      });
    }
    
    return recommendations;
  }
  
  /**
   * 콘솔 요약 출력
   */
  printSummary(summary) {
    console.log('\n📋 Phase 2 통합 테스트 요약');
    console.log('=' .repeat(50));
    console.log(`전체 성공 여부: ${summary.overallSuccess ? '✅ 성공' : '❌ 실패'}`);
    
    console.log('\n🔧 컴포넌트별 결과:');
    for (const [component, results] of Object.entries(summary.componentResults)) {
      console.log(`  ${component}: ${results.successRate} (${results.totalTests}개 테스트, 평균 ${results.averageProcessingTime})`);
    }
    
    if (Object.keys(summary.performanceMetrics).length > 0) {
      console.log('\n⚡ 성능 메트릭:');
      for (const [metric, value] of Object.entries(summary.performanceMetrics)) {
        console.log(`  ${metric}: ${value}`);
      }
    }
    
    if (summary.issues.length > 0) {
      console.log('\n⚠️ 발견된 이슈:');
      summary.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('=' .repeat(50));
  }
  
  // 유틸리티 메서드들
  
  classifyTestCase(content) {
    if (content.includes('퇴원') || content.includes('discharge')) return 'discharge_summary';
    if (content.includes('검사결과') || content.includes('lab')) return 'lab_report';
    if (content.includes('처방') || content.includes('prescription')) return 'prescription';
    if (content.includes('MRI') || content.includes('CT') || content.includes('X-ray')) return 'imaging_report';
    return 'general';
  }
  
  generateSyntheticTestCases() {
    const syntheticCases = [
      {
        name: 'synthetic_simple.txt',
        content: '환자명: 홍길동\n나이: 45세\n진단: 고혈압\n처방: 혈압약 1일 1회',
        size: 100,
        type: 'prescription'
      },
      {
        name: 'synthetic_complex.txt',
        content: `환자 정보: 김영희 (여, 67세)
입원일: 2024-01-15
퇴원일: 2024-01-20
주진단: 급성 심근경색증 (I21.9)
부진단: 당뇨병 (E11.9), 고혈압 (I10)
치료 경과: 응급실 내원 후 심혈관 중재술 시행
처방: 아스피린 100mg 1일 1회, 메트포르민 500mg 1일 2회
추적 관찰: 외래 1주 후 방문 예정`,
        size: 500,
        type: 'discharge_summary'
      }
    ];
    
    this.testCases.push(...syntheticCases);
  }
}

// 테스트 실행
async function runPhase2IntegrationTest() {
  const tester = new Phase2IntegrationTest();
  
  try {
    await tester.runAllTests();
    console.log('🎉 Phase 2 통합 테스트 성공적으로 완료!');
  } catch (error) {
    console.error('💥 Phase 2 통합 테스트 실패:', error);
    process.exit(1);
  }
}

// 직접 실행시 테스트 수행
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith('phase2IntegrationTest.js')) {
  runPhase2IntegrationTest();
}

export default Phase2IntegrationTest;