/**
 * 실제 의료 문서 케이스를 사용한 템플릿 캐시 시스템 테스트
 * src/rag/case_sample/ 의 case.txt 파일들 활용
 */

import fs from 'fs';
import path from 'path';
import hospitalTemplateCache from '../postprocess/hospitalTemplateCache.js';
import preprocessor from '../postprocess/preprocessor.js';

class RealCaseTemplateTest {
  constructor() {
    this.testResults = [];
    this.caseDataDir = path.join(process.cwd(), 'src', 'rag', 'case_sample');
    this.performanceMetrics = {
      totalProcessingTime: 0,
      totalDocuments: 0,
      totalNoiseReduced: 0,
      hospitalPatterns: new Map()
    };
    
    // 경로 확인 및 디버깅
    console.log(`케이스 데이터 디렉토리: ${this.caseDataDir}`);
    console.log(`현재 작업 디렉토리: ${process.cwd()}`);
  }

  /**
   * 전체 실제 케이스 테스트 실행
   */
  async runRealCaseTests() {
    console.log('=== 실제 의료 문서 케이스 템플릿 캐시 테스트 ===\n');

    try {
      // 케이스 파일들 로드
      const caseFiles = this.loadCaseFiles();
      console.log(`📁 발견된 케이스 파일: ${caseFiles.length}개\n`);

      // 각 케이스별 테스트
      for (const caseFile of caseFiles.slice(0, 5)) { // 처음 5개 케이스만 테스트
        await this.testSingleCase(caseFile);
      }

      // 병원별 패턴 분석
      await this.analyzeCrossHospitalPatterns(caseFiles.slice(0, 10));

      // 성능 메트릭 분석
      this.analyzePerformanceMetrics();

      // 파이프라인 무결성 검증
      await this.verifyPipelineIntegrityWithRealData(caseFiles[0]);

      // 결과 요약
      this.printRealCaseTestSummary();

    } catch (error) {
      console.error('실제 케이스 테스트 실행 중 오류:', error);
    }
  }

  /**
   * 케이스 파일들 로드
   */
  loadCaseFiles() {
    try {
      const files = fs.readdirSync(this.caseDataDir);
      return files
        .filter(file => file.startsWith('Case') && file.endsWith('.txt') && !file.includes('_report'))
        .map(file => ({
          name: file,
          path: path.join(this.caseDataDir, file)
        }));
    } catch (error) {
      console.error('케이스 파일 로드 실패:', error);
      return [];
    }
  }

  /**
   * 단일 케이스 테스트
   */
  async testSingleCase(caseFile) {
    console.log(`📄 테스트 중: ${caseFile.name}`);

    try {
      // 파일 내용 읽기
      const content = fs.readFileSync(caseFile.path, 'utf-8');
      const originalLength = content.length;

      // 템플릿 캐시 처리
      const startTime = Date.now();
      const cacheResult = await hospitalTemplateCache.processDocument(content);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      const cleanedLength = cacheResult.cleanedText ? cacheResult.cleanedText.length : originalLength;
      const noiseReduction = ((originalLength - cleanedLength) / originalLength * 100).toFixed(2);

      // 성능 메트릭 업데이트
      this.performanceMetrics.totalProcessingTime += processingTime;
      this.performanceMetrics.totalDocuments++;
      this.performanceMetrics.totalNoiseReduced += parseFloat(noiseReduction);

      // 병원별 패턴 추적
      if (cacheResult.hospital) {
        const hospitalKey = cacheResult.hospital;
        if (!this.performanceMetrics.hospitalPatterns.has(hospitalKey)) {
          this.performanceMetrics.hospitalPatterns.set(hospitalKey, {
            count: 0,
            totalPatterns: 0,
            avgNoiseReduction: 0
          });
        }
        const hospitalData = this.performanceMetrics.hospitalPatterns.get(hospitalKey);
        hospitalData.count++;
        hospitalData.totalPatterns += cacheResult.removedPatterns ? cacheResult.removedPatterns.length : 0;
        hospitalData.avgNoiseReduction = (hospitalData.avgNoiseReduction + parseFloat(noiseReduction)) / hospitalData.count;
      }

      // 결과 기록
      this.addTestResult(caseFile.name, '성공', {
        originalLength,
        cleanedLength,
        noiseReduction: `${noiseReduction}%`,
        processingTime: `${processingTime}ms`,
        hospital: cacheResult.hospital || '미감지',
        patternsFound: cacheResult.removedPatterns ? cacheResult.removedPatterns.length : 0
      });

      console.log(`  ✓ 병원: ${cacheResult.hospital || '미감지'}`);
      console.log(`  ✓ 노이즈 제거: ${noiseReduction}% (${originalLength} → ${cleanedLength})`);
      console.log(`  ✓ 처리 시간: ${processingTime}ms`);
      console.log(`  ✓ 감지된 패턴: ${cacheResult.removedPatterns ? cacheResult.removedPatterns.length : 0}개\n`);

    } catch (error) {
      this.addTestResult(caseFile.name, '실패', { error: error.message });
      console.log(`  ✗ 실패: ${error.message}\n`);
    }
  }

  /**
   * 병원 간 패턴 분석
   */
  async analyzeCrossHospitalPatterns(caseFiles) {
    console.log('🏥 병원별 패턴 분석');

    const hospitalGroups = new Map();

    // 병원별 문서 그룹화
    for (const caseFile of caseFiles) {
      try {
        const content = fs.readFileSync(caseFile.path, 'utf-8');
        const result = await hospitalTemplateCache.processDocument(content);
        
        if (result.hospital) {
          if (!hospitalGroups.has(result.hospital)) {
            hospitalGroups.set(result.hospital, []);
          }
          hospitalGroups.get(result.hospital).push({
            file: caseFile.name,
            patterns: result.removedPatterns || [],
            noiseReduction: result.cleanedText ? 
              ((content.length - result.cleanedText.length) / content.length * 100).toFixed(2) : 0
          });
        }
      } catch (error) {
        console.warn(`  ⚠️ ${caseFile.name} 분석 실패: ${error.message}`);
      }
    }

    // 병원별 통계 출력
    for (const [hospital, documents] of hospitalGroups) {
      const avgNoiseReduction = documents.reduce((sum, doc) => sum + parseFloat(doc.noiseReduction), 0) / documents.length;
      const totalPatterns = documents.reduce((sum, doc) => sum + doc.patterns.length, 0);
      
      console.log(`  🏥 ${hospital}:`);
      console.log(`     - 문서 수: ${documents.length}개`);
      console.log(`     - 평균 노이즈 제거율: ${avgNoiseReduction.toFixed(2)}%`);
      console.log(`     - 총 감지 패턴: ${totalPatterns}개`);
    }
    console.log();
  }

  /**
   * 성능 메트릭 분석
   */
  analyzePerformanceMetrics() {
    console.log('📊 성능 메트릭 분석');
    
    const avgProcessingTime = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalDocuments;
    const avgNoiseReduction = this.performanceMetrics.totalNoiseReduced / this.performanceMetrics.totalDocuments;
    
    console.log(`  ⏱️ 평균 처리 시간: ${avgProcessingTime.toFixed(2)}ms`);
    console.log(`  🧹 평균 노이즈 제거율: ${avgNoiseReduction.toFixed(2)}%`);
    console.log(`  📄 처리된 문서 수: ${this.performanceMetrics.totalDocuments}개`);
    console.log(`  🏥 감지된 병원 수: ${this.performanceMetrics.hospitalPatterns.size}개\n`);
  }

  /**
   * 실제 데이터로 파이프라인 무결성 검증
   */
  async verifyPipelineIntegrityWithRealData(caseFile) {
    console.log('🔍 실제 데이터 파이프라인 무결성 검증');

    try {
      const content = fs.readFileSync(caseFile.path, 'utf-8');

      // 캐시 비활성화 상태에서 전처리
      const resultWithoutCache = await preprocessor.run(content, {
        enableTemplateCache: false
      });

      // 캐시 활성화 상태에서 전처리
      const resultWithCache = await preprocessor.run(content, {
        enableTemplateCache: true
      });

      // 무결성 검증
      const integrityCheck = this.comparePreprocessingResults(resultWithoutCache, resultWithCache);
      
      console.log(`  📄 테스트 파일: ${caseFile.name}`);
      console.log(`  📊 캐시 없음: ${resultWithoutCache.length}개 섹션`);
      console.log(`  📊 캐시 있음: ${resultWithCache.length}개 섹션`);
      
      if (integrityCheck.passed) {
        console.log('  ✅ 파이프라인 무결성 유지됨');
      } else {
        console.log('  ⚠️ 파이프라인 무결성 문제 감지');
        console.log(`     차이점: ${integrityCheck.differences.join(', ')}`);
      }
      console.log();

      this.addTestResult('파이프라인 무결성', integrityCheck.passed ? '성공' : '주의', {
        testFile: caseFile.name,
        sectionsWithoutCache: resultWithoutCache.length,
        sectionsWithCache: resultWithCache.length,
        differences: integrityCheck.differences
      });

    } catch (error) {
      console.log(`  ✗ 무결성 검증 실패: ${error.message}\n`);
      this.addTestResult('파이프라인 무결성', '실패', { error: error.message });
    }
  }

  /**
   * 전처리 결과 비교
   */
  comparePreprocessingResults(result1, result2) {
    const differences = [];
    
    // 섹션 수 비교
    if (result1.length !== result2.length) {
      differences.push(`섹션 수 차이 (${result1.length} vs ${result2.length})`);
    }
    
    // 핵심 데이터 비교 (첫 번째 섹션)
    if (result1.length > 0 && result2.length > 0) {
      const section1 = result1[0];
      const section2 = result2[0];
      
      if (section1.date !== section2.date) {
        differences.push('날짜 정보 차이');
      }
      
      if (section1.hospital !== section2.hospital) {
        differences.push('병원 정보 차이');
      }
    }
    
    return {
      passed: differences.length === 0,
      differences
    };
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
   * 실제 케이스 테스트 결과 요약
   */
  printRealCaseTestSummary() {
    console.log('=== 실제 케이스 테스트 결과 요약 ===');
    
    const successful = this.testResults.filter(r => r.status === '성공').length;
    const failed = this.testResults.filter(r => r.status === '실패').length;
    const warnings = this.testResults.filter(r => r.status === '주의').length;
    
    console.log(`📊 총 테스트: ${this.testResults.length}개`);
    console.log(`✅ 성공: ${successful}개`);
    console.log(`⚠️ 주의: ${warnings}개`);
    console.log(`❌ 실패: ${failed}개`);
    
    // 성능 요약
    if (this.performanceMetrics.totalDocuments > 0) {
      const avgTime = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalDocuments;
      const avgNoise = this.performanceMetrics.totalNoiseReduced / this.performanceMetrics.totalDocuments;
      
      console.log('\n📈 성능 요약:');
      console.log(`   평균 처리 시간: ${avgTime.toFixed(2)}ms`);
      console.log(`   평균 노이즈 제거율: ${avgNoise.toFixed(2)}%`);
      console.log(`   감지된 병원 수: ${this.performanceMetrics.hospitalPatterns.size}개`);
    }
    
    // 병원별 성능
    if (this.performanceMetrics.hospitalPatterns.size > 0) {
      console.log('\n🏥 병원별 성능:');
      for (const [hospital, data] of this.performanceMetrics.hospitalPatterns) {
        console.log(`   ${hospital}: ${data.count}개 문서, 평균 ${data.avgNoiseReduction.toFixed(2)}% 노이즈 제거`);
      }
    }
    
    if (failed === 0) {
      console.log('\n🎉 모든 실제 케이스 테스트가 성공적으로 완료되었습니다!');
      console.log('템플릿 캐시 시스템이 실제 의료 문서에서 효과적으로 작동합니다.');
    } else {
      console.log('\n⚠️ 일부 테스트에서 문제가 발견되었습니다. 상세 내용을 확인해주세요.');
    }
    
    // 결과 저장
    this.saveRealCaseTestResults();
  }

  /**
   * 실제 케이스 테스트 결과 저장
   */
  saveRealCaseTestResults() {
    try {
      const resultsPath = path.join(process.cwd(), 'backend', 'test', 'real_case_template_test_results.json');
      const fullResults = {
        testResults: this.testResults,
        performanceMetrics: {
          ...this.performanceMetrics,
          hospitalPatterns: Array.from(this.performanceMetrics.hospitalPatterns.entries())
        },
        summary: {
          totalTests: this.testResults.length,
          successful: this.testResults.filter(r => r.status === '성공').length,
          failed: this.testResults.filter(r => r.status === '실패').length,
          warnings: this.testResults.filter(r => r.status === '주의').length
        }
      };
      
      fs.writeFileSync(resultsPath, JSON.stringify(fullResults, null, 2));
      console.log(`\n💾 테스트 결과가 저장되었습니다: ${resultsPath}`);
    } catch (error) {
      console.warn('테스트 결과 저장 실패:', error.message);
    }
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new RealCaseTemplateTest();
  test.runRealCaseTests().catch(console.error);
}

export default RealCaseTemplateTest;