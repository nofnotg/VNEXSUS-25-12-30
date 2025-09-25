/**
 * Integration Test Suite - Phase 2
 * 
 * 전체 시스템 연동 테스트
 * 
 * 테스트 범위:
 * 1. End-to-End Processing: 전체 처리 파이프라인
 * 2. Performance Testing: 성능 테스트
 * 3. Error Handling Testing: 에러 처리 테스트
 * 4. Validation Testing: 검증 시스템 테스트
 * 5. Memory Management: 메모리 관리 테스트
 */

import { TextArrayDateController } from './textArrayDateControllerComplete.js';
import { ValidationEngine } from './validationEngine.js';
import { globalErrorHandler } from './errorHandler.js';
import fs from 'fs';
import path from 'path';

export class IntegrationTestSuite {
  constructor() {
    this.version = '1.0.0';
    this.controller = new TextArrayDateController();
    this.validationEngine = new ValidationEngine();
    
    // 테스트 설정
    this.testConfig = {
      timeout: 30000, // 30초
      memoryLimit: 500 * 1024 * 1024, // 500MB
      performanceThreshold: {
        processingSpeed: 1000, // 문자/초
        accuracy: 0.8,
        memoryEfficiency: 0.9
      }
    };
    
    // 테스트 결과
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      performance: {},
      startTime: null,
      endTime: null
    };
    
    // 테스트 데이터
    this.testCases = [
      {
        name: 'Basic Date Extraction',
        description: '기본 날짜 추출 테스트',
        input: '2024년 12월 15일 진료받았습니다. 다음 진료는 2024년 12월 22일입니다.',
        expectedDates: 2,
        category: 'basic'
      },
      {
        name: 'Complex Medical Document',
        description: '복잡한 의료 문서 테스트',
        input: `
          환자명: 홍길동
          진료일: 2024.12.15
          
          [진료 기록]
          2024년 12월 10일 초진
          - 혈압 측정: 120/80
          - 처방: 고혈압약
          
          2024년 12월 15일 재진
          - 혈압 개선됨
          - 다음 진료: 2025년 1월 15일
          
          [과거력]
          2023년 5월 건강검진에서 고혈압 발견
        `,
        expectedDates: 5,
        category: 'complex'
      },
      {
        name: 'Edge Cases',
        description: '경계 사례 테스트',
        input: '날짜가 없는 텍스트입니다. 단순한 설명만 포함되어 있습니다.',
        expectedDates: 0,
        category: 'edge'
      },
      {
        name: 'Large Document',
        description: '대용량 문서 테스트',
        input: this.generateLargeDocument(),
        expectedDates: 50,
        category: 'performance'
      },
      {
        name: 'Invalid Input',
        description: '잘못된 입력 테스트',
        input: null,
        expectedError: true,
        category: 'error'
      }
    ];
  }

  /**
   * 전체 통합 테스트 실행
   */
  async runAllTests() {
    console.log('🚀 통합 테스트 시작...');
    this.testResults.startTime = Date.now();
    
    try {
      // 1. 기본 기능 테스트
      await this.runBasicTests();
      
      // 2. 성능 테스트
      await this.runPerformanceTests();
      
      // 3. 에러 처리 테스트
      await this.runErrorHandlingTests();
      
      // 4. 검증 시스템 테스트
      await this.runValidationTests();
      
      // 5. 메모리 관리 테스트
      await this.runMemoryTests();
      
      // 6. 실제 파일 테스트
      await this.runRealFileTests();
      
    } catch (error) {
      console.error('❌ 통합 테스트 실행 중 오류:', error);
      this.testResults.errors.push({
        test: 'Integration Test Suite',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.testResults.endTime = Date.now();
      this.generateTestReport();
    }
    
    return this.testResults;
  }

  /**
   * 기본 기능 테스트
   */
  async runBasicTests() {
    console.log('📋 기본 기능 테스트 시작...');
    
    for (const testCase of this.testCases.filter(tc => tc.category === 'basic' || tc.category === 'complex')) {
      await this.runSingleTest(testCase);
    }
  }

  /**
   * 성능 테스트
   */
  async runPerformanceTests() {
    console.log('⚡ 성능 테스트 시작...');
    
    const performanceTestCase = this.testCases.find(tc => tc.category === 'performance');
    if (performanceTestCase) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        const result = await this.controller.processDocumentDateArrays(performanceTestCase.input);
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const processingTime = endTime - startTime;
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
        const processingSpeed = performanceTestCase.input.length / (processingTime / 1000);
        
        this.testResults.performance = {
          processingTime,
          memoryUsed,
          processingSpeed,
          inputSize: performanceTestCase.input.length,
          success: result.success
        };
        
        // 성능 임계값 검증
        const performancePassed = 
          processingSpeed >= this.testConfig.performanceThreshold.processingSpeed &&
          memoryUsed < this.testConfig.memoryLimit;
        
        if (performancePassed) {
          this.testResults.passed++;
          console.log(`✅ 성능 테스트 통과 - 속도: ${Math.round(processingSpeed)}자/초, 메모리: ${Math.round(memoryUsed/1024/1024)}MB`);
        } else {
          this.testResults.failed++;
          console.log(`❌ 성능 테스트 실패 - 속도: ${Math.round(processingSpeed)}자/초, 메모리: ${Math.round(memoryUsed/1024/1024)}MB`);
        }
        
        this.testResults.total++;
        
      } catch (error) {
        this.testResults.failed++;
        this.testResults.total++;
        this.testResults.errors.push({
          test: 'Performance Test',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * 에러 처리 테스트
   */
  async runErrorHandlingTests() {
    console.log('🛡️ 에러 처리 테스트 시작...');
    
    const errorTestCases = [
      { input: null, description: 'null 입력' },
      { input: '', description: '빈 문자열' },
      { input: 'x'.repeat(2000000), description: '너무 큰 입력' },
      { input: undefined, description: 'undefined 입력' }
    ];
    
    for (const testCase of errorTestCases) {
      try {
        const result = await this.controller.processDocumentDateArrays(testCase.input);
        
        // 에러가 예상되는 경우 success가 false여야 함
        if (!result.success) {
          this.testResults.passed++;
          console.log(`✅ 에러 처리 테스트 통과: ${testCase.description}`);
        } else {
          this.testResults.failed++;
          console.log(`❌ 에러 처리 테스트 실패: ${testCase.description} - 에러가 발생하지 않음`);
        }
        
      } catch (error) {
        // 예상된 에러인 경우 통과
        this.testResults.passed++;
        console.log(`✅ 에러 처리 테스트 통과: ${testCase.description} - ${error.message}`);
      }
      
      this.testResults.total++;
    }
  }

  /**
   * 검증 시스템 테스트
   */
  async runValidationTests() {
    console.log('🔍 검증 시스템 테스트 시작...');
    
    const validationTestCase = {
      input: '2024년 12월 15일 진료받았습니다. 다음 진료는 2024년 12월 22일입니다.',
      description: '검증 시스템 테스트'
    };
    
    try {
      const result = await this.controller.processDocumentDateArrays(validationTestCase.input);
      
      // 검증 결과가 포함되어 있는지 확인
      if (result.validation && result.validation.overallScore !== undefined) {
        this.testResults.passed++;
        console.log(`✅ 검증 시스템 테스트 통과 - 점수: ${result.validation.overallScore.toFixed(3)}`);
      } else {
        this.testResults.failed++;
        console.log(`❌ 검증 시스템 테스트 실패 - 검증 결과 없음`);
      }
      
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({
        test: 'Validation System Test',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    this.testResults.total++;
  }

  /**
   * 메모리 관리 테스트
   */
  async runMemoryTests() {
    console.log('💾 메모리 관리 테스트 시작...');
    
    const initialMemory = process.memoryUsage();
    
    // 여러 번 처리하여 메모리 누수 확인
    for (let i = 0; i < 10; i++) {
      try {
        await this.controller.processDocumentDateArrays(
          '2024년 12월 15일 진료받았습니다. 테스트 ' + i
        );
      } catch (error) {
        // 에러 무시하고 계속
      }
    }
    
    // 가비지 컬렉션 강제 실행
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // 메모리 증가가 합리적인 범위인지 확인 (10MB 이하)
    if (memoryIncrease < 10 * 1024 * 1024) {
      this.testResults.passed++;
      console.log(`✅ 메모리 관리 테스트 통과 - 증가량: ${Math.round(memoryIncrease/1024/1024)}MB`);
    } else {
      this.testResults.failed++;
      console.log(`❌ 메모리 관리 테스트 실패 - 증가량: ${Math.round(memoryIncrease/1024/1024)}MB`);
    }
    
    this.testResults.total++;
  }

  /**
   * 실제 파일 테스트
   */
  async runRealFileTests() {
    console.log('📄 실제 파일 테스트 시작...');
    
    try {
      // Case1.txt 파일 테스트
      const casePath = path.join(process.cwd(), 'src/rag/case_sample/Case1.txt');
      
      if (fs.existsSync(casePath)) {
        const content = fs.readFileSync(casePath, 'utf-8');
        const result = await this.controller.processDocumentDateArrays(content);
        
        if (result.success) {
          this.testResults.passed++;
          console.log(`✅ 실제 파일 테스트 통과 - Case1.txt`);
        } else {
          this.testResults.failed++;
          console.log(`❌ 실제 파일 테스트 실패 - Case1.txt`);
        }
      } else {
        this.testResults.skipped++;
        console.log(`⏭️ 실제 파일 테스트 건너뜀 - Case1.txt 파일 없음`);
      }
      
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({
        test: 'Real File Test',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    this.testResults.total++;
  }

  /**
   * 단일 테스트 실행
   */
  async runSingleTest(testCase) {
    try {
      console.log(`🧪 테스트 실행: ${testCase.name}`);
      
      const startTime = Date.now();
      const result = await this.controller.processDocumentDateArrays(testCase.input);
      const endTime = Date.now();
      
      // 결과 검증
      let passed = false;
      
      if (testCase.expectedError) {
        passed = !result.success;
      } else if (testCase.expectedDates !== undefined) {
        const extractedDates = this.countExtractedDates(result);
        passed = extractedDates === testCase.expectedDates;
      } else {
        passed = result.success;
      }
      
      if (passed) {
        this.testResults.passed++;
        console.log(`✅ ${testCase.name} 통과 (${endTime - startTime}ms)`);
      } else {
        this.testResults.failed++;
        console.log(`❌ ${testCase.name} 실패`);
      }
      
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({
        test: testCase.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`❌ ${testCase.name} 오류: ${error.message}`);
    }
    
    this.testResults.total++;
  }

  /**
   * 추출된 날짜 개수 계산
   */
  countExtractedDates(result) {
    if (!result.result || !result.result.result) return 0;
    
    const primary = result.result.result.primary || [];
    const secondary = result.result.result.secondary || [];
    
    return primary.length + secondary.length;
  }

  /**
   * 대용량 문서 생성
   */
  generateLargeDocument() {
    let content = '';
    const baseDate = new Date('2024-01-01');
    
    for (let i = 0; i < 50; i++) {
      const date = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      content += `
${dateStr} 진료 기록
`;
      content += `환자 상태: 양호\n`;
      content += `처방: 약물 ${i + 1}\n`;
      content += `다음 진료: ${new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}\n`;
      content += `\n`;
    }
    
    return content;
  }

  /**
   * 테스트 리포트 생성
   */
  generateTestReport() {
    const duration = this.testResults.endTime - this.testResults.startTime;
    const successRate = this.testResults.total > 0 ? 
      (this.testResults.passed / this.testResults.total * 100).toFixed(1) : 0;
    
    console.log('\n📊 통합 테스트 결과 리포트');
    console.log('=' .repeat(50));
    console.log(`총 테스트: ${this.testResults.total}`);
    console.log(`통과: ${this.testResults.passed}`);
    console.log(`실패: ${this.testResults.failed}`);
    console.log(`건너뜀: ${this.testResults.skipped}`);
    console.log(`성공률: ${successRate}%`);
    console.log(`실행 시간: ${duration}ms`);
    
    if (this.testResults.performance.processingSpeed) {
      console.log(`\n⚡ 성능 지표:`);
      console.log(`처리 속도: ${Math.round(this.testResults.performance.processingSpeed)}자/초`);
      console.log(`메모리 사용: ${Math.round(this.testResults.performance.memoryUsed/1024/1024)}MB`);
    }
    
    if (this.testResults.errors.length > 0) {
      console.log(`\n❌ 오류 목록:`);
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    console.log('=' .repeat(50));
    
    // 테스트 결과를 파일로 저장
    this.saveTestReport();
  }

  /**
   * 테스트 리포트 저장
   */
  saveTestReport() {
    try {
      const reportData = {
        version: this.version,
        timestamp: new Date().toISOString(),
        results: this.testResults,
        config: this.testConfig
      };
      
      const reportPath = path.join(process.cwd(), 'temp/integration-test-report.json');
      
      // temp 디렉토리 생성
      const tempDir = path.dirname(reportPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 테스트 리포트 저장: ${reportPath}`);
      
    } catch (error) {
      console.error('테스트 리포트 저장 실패:', error.message);
    }
  }
}

// 직접 실행 시 테스트 수행
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new IntegrationTestSuite();
  testSuite.runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}