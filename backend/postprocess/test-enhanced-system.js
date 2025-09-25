/**
 * Enhanced Date Block Processing System Test
 * 
 * 실제 Case 파일들을 사용하여 향상된 시스템을 테스트합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PostProcessingManager from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedSystemTester {
  constructor() {
    this.testResults = [];
    this.caseFilesPath = path.join(__dirname, '../../case_files');
  }

  /**
   * 모든 Case 파일에 대해 향상된 시스템 테스트 실행
   */
  async runComprehensiveTest() {
    console.log('🧪 향상된 날짜 블록 처리 시스템 종합 테스트 시작...');
    console.log('=' * 60);
    
    try {
      // Case 파일 목록 가져오기
      const caseFiles = this._getCaseFiles();
      console.log(`📁 발견된 Case 파일: ${caseFiles.length}개`);
      
      for (const caseFile of caseFiles) {
        await this._testSingleCase(caseFile);
      }
      
      // 종합 결과 분석
      this._analyzeOverallResults();
      
      // 결과 저장
      await this._saveTestResults();
      
      console.log('\n✅ 종합 테스트 완료!');
      
    } catch (error) {
      console.error('❌ 테스트 실행 중 오류:', error);
      throw error;
    }
  }

  /**
   * 개별 Case 파일 테스트
   * @param {string} caseFile Case 파일명
   */
  async _testSingleCase(caseFile) {
    const caseNumber = caseFile.match(/Case(\d+)/)?.[1];
    console.log(`\n🔍 Case${caseNumber} 테스트 시작...`);
    
    try {
      // Case 파일 읽기
      const caseFilePath = path.join(this.caseFilesPath, caseFile);
      const caseContent = fs.readFileSync(caseFilePath, 'utf-8');
      
      console.log(`📄 파일 크기: ${caseContent.length} 문자`);
      
      // 기존 시스템과 향상된 시스템 비교 테스트
      const testResult = await this._compareProcessingSystems(caseContent, caseNumber);
      
      this.testResults.push({
        caseNumber,
        fileName: caseFile,
        fileSize: caseContent.length,
        ...testResult
      });
      
      console.log(`✅ Case${caseNumber} 테스트 완료`);
      
    } catch (error) {
      console.error(`❌ Case${caseNumber} 테스트 실패:`, error.message);
      
      this.testResults.push({
        caseNumber,
        fileName: caseFile,
        error: error.message,
        success: false
      });
    }
  }

  /**
   * 기존 시스템과 향상된 시스템 비교
   * @param {string} content Case 파일 내용
   * @param {string} caseNumber Case 번호
   * @returns {Object} 비교 결과
   */
  async _compareProcessingSystems(content, caseNumber) {
    const startTime = Date.now();
    
    try {
      // 향상된 시스템으로 처리
      const enhancedResult = await PostProcessingManager.processOCRResult(content, {
        minConfidence: 0.4,
        useAIExtraction: false,
        includeRawText: true
      });
      
      const processingTime = Date.now() - startTime;
      
      // 결과 분석
      const analysis = this._analyzeProcessingResult(enhancedResult, content);
      
      console.log(`📊 처리 시간: ${processingTime}ms`);
      console.log(`📈 품질 점수: ${analysis.qualityScore}`);
      console.log(`📅 발견된 날짜 블록: ${analysis.dateBlocksFound}개`);
      console.log(`🎯 신뢰도: ${analysis.averageConfidence}`);
      
      return {
        success: true,
        processingTime,
        enhancedResult,
        analysis,
        performance: {
          memoryUsage: process.memoryUsage(),
          processingSpeed: content.length / processingTime // 문자/ms
        }
      };
      
    } catch (error) {
      console.error(`❌ 처리 중 오류: ${error.message}`);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 처리 결과 분석
   * @param {Object} result 처리 결과
   * @param {string} originalContent 원본 내용
   * @returns {Object} 분석 결과
   */
  _analyzeProcessingResult(result, originalContent) {
    const pipeline = result.pipeline;
    const statistics = result.statistics;
    
    // 기본 메트릭
    const dateBlocksFound = pipeline.massiveDateBlocks?.dateBlocks?.length || 0;
    const organizedDataCount = Array.isArray(pipeline.organizedData) ? pipeline.organizedData.length : 0;
    const averageConfidence = statistics.confidence || 0;
    
    // 품질 점수 계산
    let qualityScore = 0;
    
    // 날짜 블록 발견 점수 (40%)
    if (dateBlocksFound > 0) {
      qualityScore += Math.min(dateBlocksFound / 10, 1) * 0.4;
    }
    
    // 신뢰도 점수 (30%)
    qualityScore += averageConfidence * 0.3;
    
    // 데이터 정리 점수 (20%)
    if (organizedDataCount > 0) {
      qualityScore += Math.min(organizedDataCount / 20, 1) * 0.2;
    }
    
    // 처리 효율성 점수 (10%)
    const processingEfficiency = statistics.processedGroups / (originalContent.length / 1000);
    qualityScore += Math.min(processingEfficiency, 1) * 0.1;
    
    // 텍스트 커버리지 분석
    const textCoverage = this._calculateTextCoverage(pipeline.massiveDateBlocks, originalContent);
    
    // 날짜 패턴 분석
    const datePatternAnalysis = this._analyzeDatePatterns(pipeline.massiveDateBlocks);
    
    return {
      qualityScore: parseFloat(qualityScore.toFixed(3)),
      dateBlocksFound,
      organizedDataCount,
      averageConfidence: parseFloat(averageConfidence.toFixed(3)),
      textCoverage,
      datePatternAnalysis,
      dataCompleteness: {
        hasDateBlocks: dateBlocksFound > 0,
        hasOrganizedData: organizedDataCount > 0,
        hasValidConfidence: averageConfidence > 0.3
      }
    };
  }

  /**
   * 텍스트 커버리지 계산
   * @param {Object} massiveDateBlocks 날짜 블록 결과
   * @param {string} originalContent 원본 내용
   * @returns {Object} 커버리지 정보
   */
  _calculateTextCoverage(massiveDateBlocks, originalContent) {
    if (!massiveDateBlocks || !massiveDateBlocks.dateBlocks) {
      return { coverage: 0, coveredLength: 0, totalLength: originalContent.length };
    }
    
    let coveredLength = 0;
    massiveDateBlocks.dateBlocks.forEach(block => {
      if (block.content) {
        coveredLength += block.content.length;
      }
    });
    
    const coverage = originalContent.length > 0 ? coveredLength / originalContent.length : 0;
    
    return {
      coverage: parseFloat(coverage.toFixed(3)),
      coveredLength,
      totalLength: originalContent.length
    };
  }

  /**
   * 날짜 패턴 분석
   * @param {Object} massiveDateBlocks 날짜 블록 결과
   * @returns {Object} 날짜 패턴 분석 결과
   */
  _analyzeDatePatterns(massiveDateBlocks) {
    if (!massiveDateBlocks || !massiveDateBlocks.structuredGroups) {
      return { totalDates: 0, dateRange: null, patterns: {} };
    }
    
    const dates = massiveDateBlocks.structuredGroups.map(group => group.date).filter(Boolean);
    const patterns = {};
    
    dates.forEach(date => {
      // 날짜 형식 패턴 분석
      if (/\d{4}-\d{2}-\d{2}/.test(date)) {
        patterns['ISO'] = (patterns['ISO'] || 0) + 1;
      } else if (/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(date)) {
        patterns['Korean'] = (patterns['Korean'] || 0) + 1;
      } else {
        patterns['Other'] = (patterns['Other'] || 0) + 1;
      }
    });
    
    let dateRange = null;
    if (dates.length > 0) {
      const sortedDates = dates.sort();
      dateRange = {
        earliest: sortedDates[0],
        latest: sortedDates[sortedDates.length - 1],
        span: sortedDates.length
      };
    }
    
    return {
      totalDates: dates.length,
      dateRange,
      patterns
    };
  }

  /**
   * Case 파일 목록 가져오기
   * @returns {Array} Case 파일 목록
   */
  _getCaseFiles() {
    try {
      const files = fs.readdirSync(this.caseFilesPath);
      return files.filter(file => 
        file.startsWith('Case') && 
        file.endsWith('.txt') && 
        !file.includes('_report')
      ).sort();
    } catch (error) {
      console.error('❌ Case 파일 목록 읽기 실패:', error);
      return [];
    }
  }

  /**
   * 전체 결과 분석
   */
  _analyzeOverallResults() {
    console.log('\n📊 종합 결과 분석');
    console.log('=' * 40);
    
    const successfulTests = this.testResults.filter(result => result.success);
    const failedTests = this.testResults.filter(result => !result.success);
    
    console.log(`✅ 성공한 테스트: ${successfulTests.length}개`);
    console.log(`❌ 실패한 테스트: ${failedTests.length}개`);
    console.log(`📈 성공률: ${(successfulTests.length / this.testResults.length * 100).toFixed(1)}%`);
    
    if (successfulTests.length > 0) {
      // 평균 성능 메트릭
      const avgProcessingTime = successfulTests.reduce((sum, test) => sum + test.processingTime, 0) / successfulTests.length;
      const avgQualityScore = successfulTests.reduce((sum, test) => sum + (test.analysis?.qualityScore || 0), 0) / successfulTests.length;
      const avgConfidence = successfulTests.reduce((sum, test) => sum + (test.analysis?.averageConfidence || 0), 0) / successfulTests.length;
      
      console.log(`⚡ 평균 처리 시간: ${avgProcessingTime.toFixed(0)}ms`);
      console.log(`🎯 평균 품질 점수: ${avgQualityScore.toFixed(3)}`);
      console.log(`📊 평균 신뢰도: ${avgConfidence.toFixed(3)}`);
      
      // 최고/최저 성능
      const bestTest = successfulTests.reduce((best, test) => 
        (test.analysis?.qualityScore || 0) > (best.analysis?.qualityScore || 0) ? test : best
      );
      const worstTest = successfulTests.reduce((worst, test) => 
        (test.analysis?.qualityScore || 0) < (worst.analysis?.qualityScore || 0) ? test : worst
      );
      
      console.log(`🏆 최고 성능: Case${bestTest.caseNumber} (품질점수: ${bestTest.analysis?.qualityScore})`);
      console.log(`⚠️ 최저 성능: Case${worstTest.caseNumber} (품질점수: ${worstTest.analysis?.qualityScore})`);
    }
    
    if (failedTests.length > 0) {
      console.log('\n❌ 실패한 테스트들:');
      failedTests.forEach(test => {
        console.log(`  - Case${test.caseNumber}: ${test.error}`);
      });
    }
  }

  /**
   * 테스트 결과 저장
   */
  async _saveTestResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(__dirname, `test-results-${timestamp}.json`);
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      successfulTests: this.testResults.filter(r => r.success).length,
      failedTests: this.testResults.filter(r => !r.success).length,
      results: this.testResults
    };
    
    try {
      fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2), 'utf-8');
      console.log(`💾 테스트 결과 저장됨: ${resultsPath}`);
    } catch (error) {
      console.error('❌ 테스트 결과 저장 실패:', error);
    }
  }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new EnhancedSystemTester();
  
  tester.runComprehensiveTest()
    .then(() => {
      console.log('\n🎉 모든 테스트가 완료되었습니다!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 테스트 실행 중 치명적 오류:', error);
      process.exit(1);
    });
}

export default EnhancedSystemTester;