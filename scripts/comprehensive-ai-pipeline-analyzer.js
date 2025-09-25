/**
 * 🚀 AI Stage3 통합 종합 파이프라인 분석기
 * 
 * 새로운 AI 기반 Stage3를 사용하여 10개 케이스 전체 재분석
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class ComprehensiveAIPipelineAnalyzer {
  constructor() {
    this.results = {};
    this.summary = {
      totalCases: 0,
      successfulCases: 0,
      failedCases: 0,
      stage3Improvements: {
        hospitalsExtracted: 0,
        diagnosesExtracted: 0,
        visitsExtracted: 0
      },
      processingTimes: []
    };
    
    this.caseNumbers = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]; // Case4 제외
    this.baseDir = 'C:\\Users\\Chung\\OneDrive\\바탕 화면\\MediAI_MVP_v6';
    this.outputDir = 'temp/ai-comprehensive-analysis';
  }

  /**
   * 🔍 전체 10개 케이스 AI 파이프라인 분석
   */
  async analyzeAllCases() {
    console.log('🚀 AI Stage3 통합 10개 케이스 전체 분석 시작...\n');
    console.log('=====================================');
    console.log('AI 기반 엔티티 추출 vs 기존 정규식 비교');
    console.log('=====================================\n');

    // 출력 디렉토리 생성
    this.ensureDirectories();

    for (const caseNum of this.caseNumbers) {
      console.log(`📊 Case${caseNum} AI 파이프라인 분석 중...`);
      await this.analyzeSingleCase(caseNum);
      
      // Rate limit 방지를 위한 대기
      await this.safeDelay(3000);
    }

    // 종합 분석 및 보고서 생성
    this.generateComprehensiveReport();
    this.saveResults();
    
    console.log('\n🎉 AI 파이프라인 분석 완료!');
    console.log(`📂 결과 저장: ${this.outputDir}`);
  }

  /**
   * 📊 개별 케이스 AI 파이프라인 분석
   */
  async analyzeSingleCase(caseNum) {
    const caseKey = `Case${caseNum}`;
    
    try {
      // 원본 데이터 로드
      const originalData = await this.loadOriginalData(caseNum);
      const realReport = await this.loadRealReport(caseNum);
      
      // AI 파이프라인 실행
      const pipelineResult = await this.runAIPipeline(originalData.content);
      
      // 결과 분석
      const analysis = this.analyzeResults(pipelineResult, realReport);
      
      // 케이스 결과 저장
      this.results[caseKey] = {
        originalData,
        realReport,
        pipelineResult,
        analysis,
        timestamp: new Date().toISOString()
      };
      
      // 통계 업데이트
      this.updateSummaryStats(caseKey, analysis);
      
      console.log(`   ✅ ${caseKey}: 병원 ${analysis.stage3.hospitalsCount}개, 진단 ${analysis.stage3.diagnosesCount}개`);
      
    } catch (error) {
      console.error(`   ❌ ${caseKey} 분석 실패:`, error.message);
      this.results[caseKey] = {
        error: error.message,
        timestamp: new Date().toISOString()
      };
      this.summary.failedCases++;
    }
  }

  /**
   * 🤖 AI 파이프라인 실행 (Stage3 AI 기반)
   */
  async runAIPipeline(content) {
    try {
      // Enhanced DNA Validation API 호출 (AI Stage3 포함)
      const response = await fetch('http://localhost:3030/api/enhanced-dna-validation/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          extractedText: content
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'API 호출 실패');
      }

      return result.pipelineResults;
      
    } catch (error) {
      console.error('AI 파이프라인 실행 실패:', error.message);
      throw error;
    }
  }

  /**
   * 📈 결과 분석 및 비교
   */
  analyzeResults(pipelineResult, realReport) {
    const stage3 = pipelineResult.stage3 || {};
    const stage4 = pipelineResult.stage4 || {};
    
    return {
      stage1: {
        segmentCount: pipelineResult.stage1?.summary?.segmentCount || 0,
        success: !!pipelineResult.stage1?.success
      },
      stage2: {
        dateGroupCount: pipelineResult.stage2?.output?.length || 0,
        success: !!pipelineResult.stage2?.success
      },
      stage3: {
        hospitalsCount: stage3.summary?.uniqueHospitals || 0,
        diagnosesCount: stage3.summary?.uniqueDiagnoses || 0,
        visitsCount: stage3.summary?.totalVisits || 0,
        extractionMethod: stage3.summary?.extractionMethod || 'Unknown',
        processingTime: stage3.processingTime || 0,
        success: (stage3.summary?.uniqueHospitals > 0 && stage3.summary?.uniqueDiagnoses > 0)
      },
      stage4: {
        reportLength: stage4.data?.reportLength || 0,
        success: !!stage4?.success
      },
      comparison: {
        realReportLength: realReport ? realReport.content.length : 0,
        aiReportLength: stage4.data?.reportLength || 0,
        qualityRatio: realReport ? 
          Math.round((stage4.data?.reportLength || 0) / realReport.content.length * 100) : 0
      }
    };
  }

  /**
   * 📊 통계 업데이트
   */
  updateSummaryStats(caseKey, analysis) {
    this.summary.totalCases++;
    
    if (analysis.stage3.success) {
      this.summary.successfulCases++;
      this.summary.stage3Improvements.hospitalsExtracted += analysis.stage3.hospitalsCount;
      this.summary.stage3Improvements.diagnosesExtracted += analysis.stage3.diagnosesCount;
      this.summary.stage3Improvements.visitsExtracted += analysis.stage3.visitsCount;
    }
    
    if (analysis.stage3.processingTime) {
      this.summary.processingTimes.push(analysis.stage3.processingTime);
    }
  }

  /**
   * 📄 원본 데이터 로드
   */
  async loadOriginalData(caseNum) {
    const filename = caseNum === 1 ? 'Case1_fulltext.txt' : `Cast${caseNum}_fulltext.txt`;
    const filePath = path.join(this.baseDir, 'documents', 'fixtures', filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`원본 파일 없음: ${filename}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      filename,
      length: content.length,
      content
    };
  }

  /**
   * 📋 실제 보고서 로드
   */
  async loadRealReport(caseNum) {
    const filename = caseNum === 1 ? 'Case1_report.txt' : `Cast${caseNum}_report.txt`;
    const filePath = path.join(this.baseDir, 'documents', 'fixtures', filename);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`실제 보고서 없음: ${filename}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      filename,
      length: content.length,
      content
    };
  }

  /**
   * 📊 종합 보고서 생성
   */
  generateComprehensiveReport() {
    console.log('\n📊 AI Stage3 통합 종합 분석 결과');
    console.log('=====================================');
    
    // 전체 성과
    const successRate = Math.round(this.summary.successfulCases / this.summary.totalCases * 100);
    console.log(`📈 전체 성공률: ${this.summary.successfulCases}/${this.summary.totalCases} (${successRate}%)`);
    
    // Stage3 AI 성과
    console.log(`🤖 AI Stage3 성과:`);
    console.log(`   - 총 병원 추출: ${this.summary.stage3Improvements.hospitalsExtracted}개`);
    console.log(`   - 총 진단 추출: ${this.summary.stage3Improvements.diagnosesExtracted}개`);
    console.log(`   - 총 방문 추출: ${this.summary.stage3Improvements.visitsExtracted}회`);
    
    // 처리 시간 통계
    if (this.summary.processingTimes.length > 0) {
      const avgTime = this.summary.processingTimes.reduce((a, b) => a + b, 0) / this.summary.processingTimes.length;
      const maxTime = Math.max(...this.summary.processingTimes);
      const minTime = Math.min(...this.summary.processingTimes);
      
      console.log(`⏱️ AI 처리 시간:`);
      console.log(`   - 평균: ${avgTime.toFixed(2)}초`);
      console.log(`   - 최대: ${maxTime.toFixed(2)}초`);
      console.log(`   - 최소: ${minTime.toFixed(2)}초`);
    }
    
    // 케이스별 상세 결과
    console.log('\n📋 케이스별 AI Stage3 성과:');
    console.log('케이스    | 병원 | 진단 | 방문 | 처리시간 | 상태');
    console.log('---------|------|------|------|----------|------');
    
    Object.entries(this.results).forEach(([caseKey, result]) => {
      if (result.error) {
        console.log(`${caseKey.padEnd(8)} | 실패  | 실패  | 실패  | N/A      | ❌`);
      } else {
        const analysis = result.analysis;
        const hospitals = String(analysis.stage3.hospitalsCount).padEnd(4);
        const diagnoses = String(analysis.stage3.diagnosesCount).padEnd(4);
        const visits = String(analysis.stage3.visitsCount).padEnd(4);
        const time = String(analysis.stage3.processingTime.toFixed(1) + 's').padEnd(8);
        const status = analysis.stage3.success ? '✅' : '❌';
        
        console.log(`${caseKey.padEnd(8)} | ${hospitals} | ${diagnoses} | ${visits} | ${time} | ${status}`);
      }
    });
    
    console.log('=====================================');
  }

  /**
   * 💾 결과 저장
   */
  saveResults() {
    // 전체 결과 JSON 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'ai_comprehensive_results.json'),
      JSON.stringify(this.results, null, 2),
      'utf8'
    );
    
    // 요약 통계 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'ai_summary_statistics.json'),
      JSON.stringify(this.summary, null, 2),
      'utf8'
    );
    
    // 텍스트 보고서 생성
    this.generateTextReport();
    
    console.log(`💾 결과 저장 완료: ${this.outputDir}`);
  }

  /**
   * 📄 텍스트 보고서 생성
   */
  generateTextReport() {
    const reportPath = path.join(this.outputDir, 'ai_comprehensive_report.txt');
    const timestamp = new Date().toISOString();
    
    let report = `
======================================================
AI Stage3 통합 종합 파이프라인 분석 보고서
======================================================
생성일시: ${timestamp}
분석 대상: 10개 케이스 (Case4 제외)
AI 모델: GPT-3.5-turbo (Stage3 엔티티 추출)

■ 전체 성과 요약
- 총 케이스: ${this.summary.totalCases}개
- 성공 케이스: ${this.summary.successfulCases}개
- 실패 케이스: ${this.summary.failedCases}개
- 성공률: ${Math.round(this.summary.successfulCases / this.summary.totalCases * 100)}%

■ AI Stage3 엔티티 추출 성과
- 총 병원 추출: ${this.summary.stage3Improvements.hospitalsExtracted}개
- 총 진단 추출: ${this.summary.stage3Improvements.diagnosesExtracted}개
- 총 방문 추출: ${this.summary.stage3Improvements.visitsExtracted}회

■ 처리 성능
`;

    if (this.summary.processingTimes.length > 0) {
      const avgTime = this.summary.processingTimes.reduce((a, b) => a + b, 0) / this.summary.processingTimes.length;
      const maxTime = Math.max(...this.summary.processingTimes);
      const minTime = Math.min(...this.summary.processingTimes);
      
      report += `- 평균 처리 시간: ${avgTime.toFixed(2)}초
- 최대 처리 시간: ${maxTime.toFixed(2)}초
- 최소 처리 시간: ${minTime.toFixed(2)}초
`;
    }

    report += `
■ 케이스별 상세 결과
`;

    Object.entries(this.results).forEach(([caseKey, result]) => {
      report += `\n[${caseKey}]
`;
      if (result.error) {
        report += `상태: 실패 (${result.error})
`;
      } else {
        const analysis = result.analysis;
        report += `상태: ${analysis.stage3.success ? '성공' : '실패'}
병원 추출: ${analysis.stage3.hospitalsCount}개
진단 추출: ${analysis.stage3.diagnosesCount}개
방문 추출: ${analysis.stage3.visitsCount}회
처리 시간: ${analysis.stage3.processingTime.toFixed(2)}초
추출 방법: ${analysis.stage3.extractionMethod}
`;
      }
    });

    report += `
======================================================
`;

    fs.writeFileSync(reportPath, report, 'utf8');
  }

  /**
   * 📁 디렉토리 생성
   */
  ensureDirectories() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const subDirs = ['stage-results', 'ai-reports', 'comparisons'];
    subDirs.forEach(dir => {
      const fullPath = path.join(this.outputDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  /**
   * ⏱️ 안전 대기
   */
  async safeDelay(ms = 2000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 실행 함수
async function runAIComprehensiveAnalysis() {
  const analyzer = new ComprehensiveAIPipelineAnalyzer();
  await analyzer.analyzeAllCases();
}

// 직접 실행
if (require.main === module) {
  runAIComprehensiveAnalysis().catch(console.error);
}

module.exports = { runAIComprehensiveAnalysis }; 