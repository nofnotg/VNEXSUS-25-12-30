/**
 * 종합적인 실제 케이스 템플릿 캐시 테스트
 */

import fs from 'fs';
import path from 'path';
import hospitalTemplateCache from '../postprocess/hospitalTemplateCache.js';
import preprocessor from '../postprocess/preprocessor.js';

class ComprehensiveRealCaseTest {
  constructor() {
    this.caseDir = path.join(process.cwd(), 'src', 'rag', 'case_sample');
    this.testResults = [];
    this.performanceMetrics = {
      totalProcessingTime: 0,
      totalDocuments: 0,
      totalNoiseReduced: 0,
      hospitalPatterns: new Map(),
      averageNoiseReduction: 0
    };
  }

  async runComprehensiveTest() {
    console.log('🏥 === 종합적인 실제 케이스 템플릿 캐시 테스트 ===\n');

    try {
      // 케이스 파일들 로드
      const files = fs.readdirSync(this.caseDir);
      const caseFiles = files.filter(file => 
        file.startsWith('Case') && 
        file.endsWith('.txt') && 
        !file.includes('_report')
      ).slice(0, 10); // 최대 10개 파일 테스트

      console.log(`📁 테스트 대상 파일: ${caseFiles.length}개`);
      console.log(`파일 목록: ${caseFiles.join(', ')}\n`);

      // 1. 템플릿 캐시 단독 테스트
      console.log('🔍 1. 템플릿 캐시 단독 테스트');
      await this.testTemplateCacheAlone(caseFiles);

      // 2. 전처리기 통합 테스트
      console.log('\n🔧 2. 전처리기 통합 테스트');
      await this.testPreprocessorIntegration(caseFiles);

      // 3. 성능 분석
      console.log('\n📊 3. 성능 분석');
      this.analyzePerformance();

      // 4. 병원별 패턴 분석
      console.log('\n🏥 4. 병원별 패턴 분석');
      this.analyzeHospitalPatterns();

      // 5. 결과 요약
      console.log('\n📋 5. 테스트 결과 요약');
      this.summarizeResults();

      // 결과 저장
      await this.saveResults();

    } catch (error) {
      console.error('테스트 실행 중 오류:', error);
    }
  }

  async testTemplateCacheAlone(caseFiles) {
    const results = [];
    
    for (const file of caseFiles) {
      try {
        const filePath = path.join(this.caseDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const startTime = Date.now();
        const result = await hospitalTemplateCache.processDocument(content);
        const endTime = Date.now();
        
        const processingTime = endTime - startTime;
        const originalLength = content.length;
        const cleanedLength = result.cleanedText ? result.cleanedText.length : originalLength;
        const noiseReduction = ((originalLength - cleanedLength) / originalLength * 100);
        
        const testResult = {
          file,
          hospital: result.hospital || '미감지',
          originalLength,
          cleanedLength,
          noiseReduction: parseFloat(noiseReduction.toFixed(2)),
          processingTime,
          patternsFound: result.removedPatterns ? result.removedPatterns.length : 0
        };
        
        results.push(testResult);
        
        // 성능 메트릭 업데이트
        this.performanceMetrics.totalProcessingTime += processingTime;
        this.performanceMetrics.totalDocuments++;
        this.performanceMetrics.totalNoiseReduced += noiseReduction;
        
        if (result.hospital) {
          if (!this.performanceMetrics.hospitalPatterns.has(result.hospital)) {
            this.performanceMetrics.hospitalPatterns.set(result.hospital, {
              documents: 0,
              totalNoiseReduction: 0,
              totalPatterns: 0
            });
          }
          const hospitalData = this.performanceMetrics.hospitalPatterns.get(result.hospital);
          hospitalData.documents++;
          hospitalData.totalNoiseReduction += noiseReduction;
          hospitalData.totalPatterns += (result.removedPatterns ? result.removedPatterns.length : 0);
        }
        
        console.log(`  ✓ ${file}: ${result.hospital || '미감지'} - ${noiseReduction.toFixed(2)}% 노이즈 제거 (${processingTime}ms)`);
        
      } catch (error) {
        console.log(`  ❌ ${file}: 처리 실패 - ${error.message}`);
        results.push({
          file,
          error: error.message,
          success: false
        });
      }
    }
    
    this.testResults.push({
      testType: 'templateCacheAlone',
      results
    });
  }

  async testPreprocessorIntegration(caseFiles) {
    const results = [];
    
    // 캐시 비활성화 테스트
    console.log('  📝 캐시 비활성화 테스트...');
    const withoutCacheResults = [];
    
    for (let i = 0; i < Math.min(3, caseFiles.length); i++) {
      const file = caseFiles[i];
      try {
        const filePath = path.join(this.caseDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const startTime = Date.now();
        const result = await preprocessor.run(content, { enableTemplateCache: false });
        const endTime = Date.now();
        
        withoutCacheResults.push({
          file,
          processingTime: endTime - startTime,
          sectionsCount: result.sections ? result.sections.length : 0,
          success: true
        });
        
      } catch (error) {
        withoutCacheResults.push({
          file,
          error: error.message,
          success: false
        });
      }
    }
    
    // 캐시 활성화 테스트
    console.log('  🚀 캐시 활성화 테스트...');
    const withCacheResults = [];
    
    for (let i = 0; i < Math.min(3, caseFiles.length); i++) {
      const file = caseFiles[i];
      try {
        const filePath = path.join(this.caseDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const startTime = Date.now();
        const result = await preprocessor.run(content, { enableTemplateCache: true });
        const endTime = Date.now();
        
        withCacheResults.push({
          file,
          processingTime: endTime - startTime,
          sectionsCount: result.sections ? result.sections.length : 0,
          success: true
        });
        
      } catch (error) {
        withCacheResults.push({
          file,
          error: error.message,
          success: false
        });
      }
    }
    
    // 결과 비교
    console.log('  📊 결과 비교:');
    for (let i = 0; i < Math.min(withoutCacheResults.length, withCacheResults.length); i++) {
      const without = withoutCacheResults[i];
      const with_ = withCacheResults[i];
      
      if (without.success && with_.success) {
        const speedImprovement = without.processingTime > 0 ? 
          ((without.processingTime - with_.processingTime) / without.processingTime * 100).toFixed(1) : 0;
        
        console.log(`    ${without.file}:`);
        console.log(`      캐시 없음: ${without.processingTime}ms, ${without.sectionsCount}개 섹션`);
        console.log(`      캐시 있음: ${with_.processingTime}ms, ${with_.sectionsCount}개 섹션`);
        console.log(`      성능 개선: ${speedImprovement}%`);
      }
    }
    
    this.testResults.push({
      testType: 'preprocessorIntegration',
      withoutCache: withoutCacheResults,
      withCache: withCacheResults
    });
  }

  analyzePerformance() {
    const avgProcessingTime = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalDocuments;
    const avgNoiseReduction = this.performanceMetrics.totalNoiseReduced / this.performanceMetrics.totalDocuments;
    
    console.log(`  📈 평균 처리 시간: ${avgProcessingTime.toFixed(2)}ms`);
    console.log(`  🧹 평균 노이즈 제거율: ${avgNoiseReduction.toFixed(2)}%`);
    console.log(`  📄 처리된 문서 수: ${this.performanceMetrics.totalDocuments}개`);
    console.log(`  ⏱️ 총 처리 시간: ${this.performanceMetrics.totalProcessingTime}ms`);
    
    this.performanceMetrics.averageNoiseReduction = avgNoiseReduction;
  }

  analyzeHospitalPatterns() {
    console.log(`  🏥 감지된 병원 수: ${this.performanceMetrics.hospitalPatterns.size}개`);
    
    for (const [hospital, data] of this.performanceMetrics.hospitalPatterns) {
      const avgNoiseReduction = data.totalNoiseReduction / data.documents;
      const avgPatterns = data.totalPatterns / data.documents;
      
      console.log(`    ${hospital}:`);
      console.log(`      문서 수: ${data.documents}개`);
      console.log(`      평균 노이즈 제거율: ${avgNoiseReduction.toFixed(2)}%`);
      console.log(`      평균 패턴 수: ${avgPatterns.toFixed(1)}개`);
    }
  }

  summarizeResults() {
    const successfulTests = this.testResults[0].results.filter(r => !r.error).length;
    const totalTests = this.testResults[0].results.length;
    
    console.log(`  ✅ 성공한 테스트: ${successfulTests}/${totalTests}`);
    console.log(`  🎯 성공률: ${(successfulTests / totalTests * 100).toFixed(1)}%`);
    console.log(`  🏥 병원 감지율: ${this.performanceMetrics.hospitalPatterns.size}/${totalTests} (${(this.performanceMetrics.hospitalPatterns.size / totalTests * 100).toFixed(1)}%)`);
    console.log(`  📊 전체 평균 노이즈 제거율: ${this.performanceMetrics.averageNoiseReduction.toFixed(2)}%`);
    
    if (this.performanceMetrics.averageNoiseReduction > 50) {
      console.log('  🎉 우수한 노이즈 제거 성능!');
    } else if (this.performanceMetrics.averageNoiseReduction > 20) {
      console.log('  👍 양호한 노이즈 제거 성능');
    } else {
      console.log('  ⚠️ 노이즈 제거 성능 개선 필요');
    }
  }

  async saveResults() {
    const summary = {
      timestamp: new Date().toISOString(),
      testType: 'comprehensive_real_case_test',
      performanceMetrics: {
        ...this.performanceMetrics,
        hospitalPatterns: Object.fromEntries(this.performanceMetrics.hospitalPatterns)
      },
      testResults: this.testResults,
      conclusion: {
        successRate: (this.testResults[0].results.filter(r => !r.error).length / this.testResults[0].results.length * 100).toFixed(1),
        averageNoiseReduction: this.performanceMetrics.averageNoiseReduction.toFixed(2),
        hospitalDetectionRate: (this.performanceMetrics.hospitalPatterns.size / this.performanceMetrics.totalDocuments * 100).toFixed(1)
      }
    };
    
    const resultPath = path.join(process.cwd(), 'comprehensive_real_case_test_results.json');
    fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`\n💾 테스트 결과 저장: ${resultPath}`);
  }
}

// 테스트 실행
const test = new ComprehensiveRealCaseTest();
test.runComprehensiveTest().catch(console.error);