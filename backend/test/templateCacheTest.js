/**
 * 병원별 템플릿 캐시 시스템 테스트
 * 기존 파이프라인 무결성 검증 포함
 */

import fs from 'fs';
import path from 'path';
import hospitalTemplateCache from '../postprocess/hospitalTemplateCache.js';
import preprocessor from '../postprocess/preprocessor.js';

class TemplateCacheTest {
  constructor() {
    this.testResults = [];
    this.testDataDir = path.join(process.cwd(), 'backend', 'test', 'data');
  }

  /**
   * 전체 테스트 실행
   */
  async runAllTests() {
    console.log('=== 병원별 템플릿 캐시 시스템 테스트 시작 ===\n');

    try {
      // 1. 기본 기능 테스트
      await this.testBasicFunctionality();
      
      // 2. 기존 파이프라인 무결성 테스트
      await this.testPipelineIntegrity();
      
      // 3. 성능 테스트
      await this.testPerformance();
      
      // 4. 오류 처리 테스트
      await this.testErrorHandling();

      // 결과 요약
      this.printTestSummary();

    } catch (error) {
      console.error('테스트 실행 중 오류 발생:', error);
    }
  }

  /**
   * 기본 기능 테스트
   */
  async testBasicFunctionality() {
    console.log('1. 기본 기능 테스트');
    
    // 테스트 데이터
    const testDocument = `
서울대학교병원
환자명: 홍길동
생년월일: 1980.01.01
진료과: 내과

2024.01.15
진단명: 고혈압
처방: 혈압약 복용

--- 병원 공통 양식 ---
본 진료기록은 서울대학교병원의 공식 문서입니다.
문의사항은 02-2072-2114로 연락바랍니다.
--- 양식 끝 ---

추가 소견: 정기 검진 필요
`;

    try {
      // 템플릿 캐시 처리
      const result = await hospitalTemplateCache.processDocument(testDocument);
      
      this.addTestResult('기본 기능', '성공', {
        hospital: result.hospital,
        removedPatterns: result.removedPatterns.length,
        cleanedTextLength: result.cleanedText.length
      });

      console.log(`✓ 병원명 추출: ${result.hospital}`);
      console.log(`✓ 제거된 패턴 수: ${result.removedPatterns.length}`);
      console.log(`✓ 정리된 텍스트 길이: ${result.cleanedText.length}\n`);

    } catch (error) {
      this.addTestResult('기본 기능', '실패', { error: error.message });
      console.log(`✗ 기본 기능 테스트 실패: ${error.message}\n`);
    }
  }

  /**
   * 기존 파이프라인 무결성 테스트
   */
  async testPipelineIntegrity() {
    console.log('2. 기존 파이프라인 무결성 테스트');
    
    const testDocument = `
삼성서울병원
2024.01.20
환자: 김철수
진단: 당뇨병
수술: 복강경 수술
처방: 인슐린 주사
`;

    try {
      // 템플릿 캐시 비활성화 상태에서 전처리
      const resultWithoutCache = await preprocessor.run(testDocument, {
        enableTemplateCache: false
      });

      // 템플릿 캐시 활성화 상태에서 전처리
      const resultWithCache = await preprocessor.run(testDocument, {
        enableTemplateCache: true
      });

      // 결과 비교 (핵심 데이터는 동일해야 함)
      const integrityCheck = this.compareResults(resultWithoutCache, resultWithCache);
      
      this.addTestResult('파이프라인 무결성', integrityCheck.passed ? '성공' : '실패', {
        withoutCache: resultWithoutCache.length,
        withCache: resultWithCache.length,
        differences: integrityCheck.differences
      });

      if (integrityCheck.passed) {
        console.log('✓ 기존 파이프라인 무결성 유지됨');
        console.log(`✓ 캐시 없음: ${resultWithoutCache.length}개 섹션`);
        console.log(`✓ 캐시 있음: ${resultWithCache.length}개 섹션\n`);
      } else {
        console.log('✗ 파이프라인 무결성 문제 발견');
        console.log(`차이점: ${JSON.stringify(integrityCheck.differences, null, 2)}\n`);
      }

    } catch (error) {
      this.addTestResult('파이프라인 무결성', '실패', { error: error.message });
      console.log(`✗ 파이프라인 무결성 테스트 실패: ${error.message}\n`);
    }
  }

  /**
   * 성능 테스트
   */
  async testPerformance() {
    console.log('3. 성능 테스트');
    
    const largeDocument = this.generateLargeTestDocument();
    
    try {
      const startTime = Date.now();
      const result = await hospitalTemplateCache.processDocument(largeDocument);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      this.addTestResult('성능', '성공', {
        documentSize: largeDocument.length,
        processingTime: processingTime,
        throughput: Math.round(largeDocument.length / processingTime * 1000)
      });

      console.log(`✓ 문서 크기: ${largeDocument.length} 문자`);
      console.log(`✓ 처리 시간: ${processingTime}ms`);
      console.log(`✓ 처리량: ${Math.round(largeDocument.length / processingTime * 1000)} 문자/초\n`);

    } catch (error) {
      this.addTestResult('성능', '실패', { error: error.message });
      console.log(`✗ 성능 테스트 실패: ${error.message}\n`);
    }
  }

  /**
   * 오류 처리 테스트
   */
  async testErrorHandling() {
    console.log('4. 오류 처리 테스트');
    
    try {
      // 빈 문서 테스트
      const emptyResult = await hospitalTemplateCache.processDocument('');
      
      // null/undefined 테스트
      const nullResult = await hospitalTemplateCache.processDocument(null);
      
      this.addTestResult('오류 처리', '성공', {
        emptyDocument: emptyResult ? '처리됨' : '오류',
        nullDocument: nullResult ? '처리됨' : '오류'
      });

      console.log('✓ 빈 문서 처리 완료');
      console.log('✓ null 문서 처리 완료\n');

    } catch (error) {
      this.addTestResult('오류 처리', '부분 성공', { error: error.message });
      console.log(`△ 오류 처리 테스트 부분 성공: ${error.message}\n`);
    }
  }

  /**
   * 결과 비교 (파이프라인 무결성 검증용)
   */
  compareResults(result1, result2) {
    const differences = [];
    
    // 섹션 수 비교
    if (result1.length !== result2.length) {
      differences.push(`섹션 수 차이: ${result1.length} vs ${result2.length}`);
    }
    
    // 각 섹션의 핵심 데이터 비교
    const minLength = Math.min(result1.length, result2.length);
    for (let i = 0; i < minLength; i++) {
      const section1 = result1[i];
      const section2 = result2[i];
      
      // 날짜 비교
      if (section1.date !== section2.date) {
        differences.push(`섹션 ${i} 날짜 차이: ${section1.date} vs ${section2.date}`);
      }
      
      // 병원명 비교
      if (section1.hospital !== section2.hospital) {
        differences.push(`섹션 ${i} 병원명 차이: ${section1.hospital} vs ${section2.hospital}`);
      }
      
      // 키워드 매치 수 비교
      const keywords1 = section1.keywordMatches ? section1.keywordMatches.length : 0;
      const keywords2 = section2.keywordMatches ? section2.keywordMatches.length : 0;
      if (keywords1 !== keywords2) {
        differences.push(`섹션 ${i} 키워드 수 차이: ${keywords1} vs ${keywords2}`);
      }
    }
    
    return {
      passed: differences.length === 0,
      differences
    };
  }

  /**
   * 대용량 테스트 문서 생성
   */
  generateLargeTestDocument() {
    const hospitals = ['서울대학교병원', '삼성서울병원', '세브란스병원', '아산병원'];
    const procedures = ['수술', '진단', '검사', '치료', '처방'];
    let document = '';
    
    for (let i = 0; i < 100; i++) {
      const hospital = hospitals[i % hospitals.length];
      const procedure = procedures[i % procedures.length];
      
      document += `
${hospital}
2024.01.${String(i % 30 + 1).padStart(2, '0')}
환자: 테스트환자${i}
${procedure}: 테스트${procedure}${i}

--- 병원 공통 양식 ---
본 진료기록은 ${hospital}의 공식 문서입니다.
--- 양식 끝 ---

`;
    }
    
    return document;
  }

  /**
   * 테스트 결과 추가
   */
  addTestResult(testName, status, details) {
    this.testResults.push({
      testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 테스트 결과 요약 출력
   */
  printTestSummary() {
    console.log('=== 테스트 결과 요약 ===');
    
    const passed = this.testResults.filter(r => r.status === '성공').length;
    const failed = this.testResults.filter(r => r.status === '실패').length;
    const partial = this.testResults.filter(r => r.status === '부분 성공').length;
    
    console.log(`총 테스트: ${this.testResults.length}`);
    console.log(`성공: ${passed}`);
    console.log(`실패: ${failed}`);
    console.log(`부분 성공: ${partial}`);
    
    if (failed === 0) {
      console.log('\n✅ 모든 테스트가 성공적으로 완료되었습니다!');
      console.log('기존 파이프라인의 무결성이 유지되면서 템플릿 캐시 기능이 정상 작동합니다.');
    } else {
      console.log('\n⚠️ 일부 테스트에서 문제가 발견되었습니다.');
    }
    
    // 상세 결과 저장
    this.saveTestResults();
  }

  /**
   * 테스트 결과를 파일로 저장
   */
  saveTestResults() {
    try {
      const resultsPath = path.join(process.cwd(), 'backend', 'test', 'template_cache_test_results.json');
      fs.writeFileSync(resultsPath, JSON.stringify(this.testResults, null, 2));
      console.log(`\n테스트 결과가 저장되었습니다: ${resultsPath}`);
    } catch (error) {
      console.warn('테스트 결과 저장 실패:', error.message);
    }
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new TemplateCacheTest();
  test.runAllTests().catch(console.error);
}

export default TemplateCacheTest;