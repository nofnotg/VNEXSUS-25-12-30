import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🧬 12케이스 포괄적 DNA 시퀀싱 파이프라인 분석기
 * 
 * 목적:
 * 1. 12개 케이스 모두에 대해 4단계 파이프라인 실행
 * 2. 각 단계별 결과 상세 저장 및 분석
 * 3. AI 보고서와 실제 보고서 비교
 * 4. 패턴 분석을 통한 로직 개선점 도출
 * 5. 프롬프트 최적화 인사이트 추출
 */

class ComprehensivePipelineAnalyzer {
  constructor() {
    this.baseURL = 'http://localhost:3031';
    this.caseSamplePath = path.join(__dirname, '../documents/fixtures');
    this.resultsPath = path.join(__dirname, '../temp/comprehensive-analysis');
    this.analysisResults = [];
    
    // Rate Limit 안전장치 강화
    this.rateLimitDelay = 30000; // 30초 대기
    this.maxRetries = 5; // 최대 5회 재시도
    this.backoffMultiplier = 2; // 지수적 백오프
    
    // 결과 저장 디렉토리 생성
    if (!fs.existsSync(this.resultsPath)) {
      fs.mkdirSync(this.resultsPath, { recursive: true });
    }
    
    // 세부 분석 디렉토리들 생성
    this.createAnalysisDirectories();
  }

  createAnalysisDirectories() {
    const dirs = [
      'stage-by-stage',      // 단계별 결과
      'pipeline-complete',   // 후처리 완료 결과
      'ai-reports',         // AI 보고서 결과
      'comparisons',        // 비교 분석 결과
      'patterns',           // 패턴 분석 결과
      'insights'            // 인사이트 및 개선점
    ];
    
    dirs.forEach(dir => {
      const dirPath = path.join(this.resultsPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * 12케이스 포괄적 분석 실행 (Rate Limit 안전)
   */
  async runComprehensiveAnalysis() {
    console.log('🚀 12케이스 포괄적 DNA 시퀀싱 파이프라인 분석 시작...');
    console.log('⚠️  Rate Limit 안전모드: 케이스당 30초 대기');
    
    const caseFiles = this.getCaseFiles();
    console.log(`📁 분석 대상: ${caseFiles.length}개 케이스`);
    
    const results = {
      timestamp: new Date().toISOString(),
      totalCases: caseFiles.length,
      successfulCases: 0,
      failedCases: 0,
      caseResults: [],
      overallPatterns: {},
      recommendations: {}
    };
    
    // 배치 처리: 한 번에 1개씩만 처리
    for (let i = 0; i < caseFiles.length; i++) {
      const caseInfo = caseFiles[i];
      console.log(`\n🔍 [${i+1}/${caseFiles.length}] ${caseInfo.caseNumber} 분석 시작...`);
      
      try {
        const caseResult = await this.analyzeSingleCaseWithRetry(caseInfo);
        results.caseResults.push(caseResult);
        results.successfulCases++;
        
        console.log(`✅ ${caseInfo.caseNumber} 분석 완료`);
        
        // Rate Limit 안전 대기 (마지막 케이스가 아닌 경우)
        if (i < caseFiles.length - 1) {
          console.log(`⏳ Rate Limit 안전 대기: ${this.rateLimitDelay/1000}초...`);
          await this.delay(this.rateLimitDelay);
        }
        
      } catch (error) {
        console.error(`❌ ${caseInfo.caseNumber} 최종 분석 실패:`, error.message);
        results.caseResults.push({
          caseNumber: caseInfo.caseNumber,
          error: error.message,
          status: 'failed'
        });
        results.failedCases++;
        
        // 실패 시 추가 대기
        console.log(`⏳ 실패 후 추가 대기: ${this.rateLimitDelay * 2 / 1000}초...`);
        await this.delay(this.rateLimitDelay * 2);
      }
    }
    
    // 포괄적 패턴 분석
    console.log('\n🔬 포괄적 패턴 분석 시작...');
    results.overallPatterns = await this.analyzeOverallPatterns(results.caseResults);
    
    // 개선 권고사항 도출
    console.log('\n💡 개선 권고사항 도출 중...');
    results.recommendations = await this.generateRecommendations(results);
    
    // 최종 결과 저장
    await this.saveFinalResults(results);
    
    console.log('🏁 12케이스 포괄적 분석 완료!');
    return results;
  }

  /**
   * 재시도 로직이 포함된 케이스 분석
   */
  async analyzeSingleCaseWithRetry(caseInfo) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`  🔄 시도 ${attempt}/${this.maxRetries}...`);
        
        const result = await this.analyzeSingleCase(caseInfo);
        
        if (attempt > 1) {
          console.log(`  ✅ ${attempt}번째 시도에서 성공!`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        console.error(`  ❌ 시도 ${attempt} 실패:`, error.message);
        
        if (attempt < this.maxRetries) {
          const waitTime = this.rateLimitDelay * Math.pow(this.backoffMultiplier, attempt - 1);
          console.log(`  ⏳ ${waitTime/1000}초 대기 후 재시도...`);
          await this.delay(waitTime);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 개별 케이스 상세 분석
   */
  async analyzeSingleCase(caseInfo) {
    console.log(`  📖 ${caseInfo.caseNumber} 파일 로딩...`);
    
    // 케이스 파일 읽기
    const caseContent = fs.readFileSync(caseInfo.fulltextPath, 'utf-8');
    const expectedReport = fs.readFileSync(caseInfo.reportPath, 'utf-8');
    
    console.log(`  🧬 4단계 파이프라인 실행...`);
    
    // 4단계 파이프라인 실행
    const pipelineResult = await this.execute4StagePipeline(caseContent, caseInfo);
    
    console.log(`  📊 결과 분석 중...`);
    
    // 단계별 결과 저장
    const stageResults = this.extractStageResults(pipelineResult);
    
    // 품질 비교 분석
    const qualityAnalysis = this.compareReportQuality(
      pipelineResult.finalReport,
      expectedReport,
      stageResults
    );
    
    // 결과 저장
    await this.saveCaseResults(caseInfo.caseNumber, {
      stageResults,
      finalReport: pipelineResult.finalReport,
      expectedReport,
      qualityAnalysis,
      processingTime: pipelineResult.processingTime
    });
    
    return {
      caseNumber: caseInfo.caseNumber,
      status: 'success',
      stageResults,
      finalReport: pipelineResult.finalReport,
      expectedReport,
      qualityAnalysis,
      processingTime: pipelineResult.processingTime
    };
  }

  /**
   * 4단계 파이프라인 실행 (Rate Limit 안전)
   */
  async execute4StagePipeline(caseContent, caseInfo) {
    // 요청 전 안전 대기
    console.log('  ⏳ API 호출 전 안전 대기...');
    await this.delay(2000);
    
    const response = await fetch(`${this.baseURL}/api/enhanced-dna-validation/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'MediAI-Pipeline-Analyzer/1.0'
      },
      body: JSON.stringify({
        extractedText: caseContent,
        patientInfo: {
          insuranceJoinDate: '2023-01-01'
        }
      }),
      timeout: 60000 // 60초 타임아웃
    });
    
    if (response.status === 429) {
      throw new Error('Rate Limit 초과 - 재시도 필요');
    }
    
    if (!response.ok) {
      throw new Error(`Pipeline API 호출 실패: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result;
  }

  /**
   * 단계별 결과 저장
   */
  async saveStageByStageResults(caseNumber, pipelineResult) {
    const stages = ['stage1', 'stage2', 'stage3', 'stage4'];
    
    for (const stage of stages) {
      const stageData = pipelineResult.pipelineResults[stage];
      const filename = `${caseNumber}_${stage}.json`;
      const filepath = path.join(this.resultsPath, 'stage-by-stage', filename);
      
      fs.writeFileSync(filepath, JSON.stringify(stageData, null, 2));
    }
  }

  /**
   * 후처리 완료 결과 저장
   */
  async savePipelineCompleteResults(caseNumber, pipelineResult) {
    const stage3Result = pipelineResult.pipelineResults.stage3;
    const filename = `${caseNumber}_pipeline_complete.json`;
    const filepath = path.join(this.resultsPath, 'pipeline-complete', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(stage3Result, null, 2));
  }

  /**
   * AI 보고서 결과 저장
   */
  async saveAIReportResults(caseNumber, pipelineResult) {
    const aiReport = pipelineResult.finalReport;
    const filename = `${caseNumber}_ai_report.txt`;
    const filepath = path.join(this.resultsPath, 'ai-reports', filename);
    
    fs.writeFileSync(filepath, aiReport);
  }

  /**
   * 상세 비교 분석
   */
  async performDetailedComparison(pipelineResult, expectedReport, caseNumber) {
    const aiReport = pipelineResult.finalReport;
    const stage3Output = pipelineResult.pipelineResults.stage3.output;
    
    const comparison = {
      caseNumber,
      timestamp: new Date().toISOString(),
      
      // 후처리 로직 분석
      preprocessingAnalysis: {
        stage1_segments: pipelineResult.pipelineResults.stage1.summary.totalSegments,
        stage1_hospitals: pipelineResult.pipelineResults.stage1.summary.hospitalsFound,
        stage1_dates: pipelineResult.pipelineResults.stage1.summary.datesFound,
        
        stage2_items: pipelineResult.pipelineResults.stage2.summary.totalItems,
        stage2_dateRange: pipelineResult.pipelineResults.stage2.summary.dateRange,
        
        stage3_hospitals: pipelineResult.pipelineResults.stage3.summary.uniqueHospitals,
        stage3_diagnoses: pipelineResult.pipelineResults.stage3.summary.uniqueDiagnoses,
        stage3_visits: pipelineResult.pipelineResults.stage3.summary.totalVisits
      },
      
      // AI 보고서 품질 분석
      aiReportAnalysis: {
        length: aiReport?.length || 0,
        hasPatientInfo: this.extractPatientInfo(aiReport),
        hasInsuranceInfo: this.extractInsuranceInfo(aiReport),
        hasTimelineEvents: this.extractTimelineEvents(aiReport),
        hasVisitStats: this.extractVisitStats(aiReport)
      },
      
      // 실제 보고서와의 비교 (있는 경우)
      expectedReportComparison: expectedReport ? {
        length: expectedReport.length,
        similarityScore: this.calculateSimilarity(aiReport, expectedReport),
        missingElements: this.findMissingElements(aiReport, expectedReport),
        extraElements: this.findExtraElements(aiReport, expectedReport)
      } : null
    };
    
    // 비교 결과 저장
    const filename = `${caseNumber}_comparison.json`;
    const filepath = path.join(this.resultsPath, 'comparisons', filename);
    fs.writeFileSync(filepath, JSON.stringify(comparison, null, 2));
    
    return comparison;
  }

  /**
   * 케이스별 패턴 분석
   */
  async analyzeCasePatterns(pipelineResult, comparison) {
    const patterns = {
      caseNumber: comparison.caseNumber,
      
      // 후처리 로직 패턴
      preprocessingPatterns: {
        dataExtractionEfficiency: this.calculateExtractionEfficiency(comparison.preprocessingAnalysis),
        bottleneckStage: this.identifyBottleneckStage(comparison.preprocessingAnalysis),
        dataLossPoints: this.identifyDataLossPoints(comparison.preprocessingAnalysis)
      },
      
      // AI 처리 패턴
      aiProcessingPatterns: {
        inputDataQuality: this.assessInputDataQuality(pipelineResult.pipelineResults.stage3),
        outputQuality: this.assessOutputQuality(comparison.aiReportAnalysis),
        processingEfficiency: this.calculateProcessingEfficiency(pipelineResult)
      },
      
      // 품질 패턴
      qualityPatterns: {
        overallScore: this.calculateOverallQualityScore(comparison),
        strengthAreas: this.identifyStrengthAreas(comparison),
        weaknessAreas: this.identifyWeaknessAreas(comparison)
      }
    };
    
    // 패턴 결과 저장
    const filename = `${comparison.caseNumber}_patterns.json`;
    const filepath = path.join(this.resultsPath, 'patterns', filename);
    fs.writeFileSync(filepath, JSON.stringify(patterns, null, 2));
    
    return patterns;
  }

  /**
   * 전체 패턴 분석
   */
  async analyzeOverallPatterns(caseResults) {
    const successfulCases = caseResults.filter(c => c.status === 'completed');
    
    const overallPatterns = {
      // 후처리 로직 전체 패턴
      preprocessingOverview: {
        averageStage1Segments: this.calculateAverage(successfulCases, 'patterns.preprocessingPatterns.dataExtractionEfficiency.stage1Score'),
        averageStage2Items: this.calculateAverage(successfulCases, 'patterns.preprocessingPatterns.dataExtractionEfficiency.stage2Score'),
        averageStage3Entities: this.calculateAverage(successfulCases, 'patterns.preprocessingPatterns.dataExtractionEfficiency.stage3Score'),
        commonBottlenecks: this.identifyCommonBottlenecks(successfulCases),
        dataLossPatterns: this.identifyDataLossPatterns(successfulCases)
      },
      
      // AI 처리 전체 패턴
      aiProcessingOverview: {
        averageReportLength: this.calculateAverage(successfulCases, 'comparison.aiReportAnalysis.length'),
        patientInfoExtractionRate: this.calculateSuccessRate(successfulCases, 'comparison.aiReportAnalysis.hasPatientInfo'),
        insuranceInfoExtractionRate: this.calculateSuccessRate(successfulCases, 'comparison.aiReportAnalysis.hasInsuranceInfo'),
        timelineEventsExtractionRate: this.calculateSuccessRate(successfulCases, 'comparison.aiReportAnalysis.hasTimelineEvents'),
        visitStatsExtractionRate: this.calculateSuccessRate(successfulCases, 'comparison.aiReportAnalysis.hasVisitStats')
      },
      
      // 품질 전체 패턴
      qualityOverview: {
        averageQualityScore: this.calculateAverage(successfulCases, 'patterns.qualityPatterns.overallScore'),
        bestPerformingCases: this.identifyBestCases(successfulCases),
        worstPerformingCases: this.identifyWorstCases(successfulCases),
        qualityFactors: this.identifyQualityFactors(successfulCases)
      }
    };
    
    return overallPatterns;
  }

  /**
   * 개선 권고사항 생성
   */
  async generateRecommendations(analysisResults) {
    const recommendations = {
      // 후처리 로직 개선
      preprocessingImprovements: {
        priority: 'HIGH',
        stage1Improvements: this.generateStage1Recommendations(analysisResults),
        stage2Improvements: this.generateStage2Recommendations(analysisResults),
        stage3Improvements: this.generateStage3Recommendations(analysisResults)
      },
      
      // AI 프롬프트 개선
      promptImprovements: {
        priority: 'MEDIUM',
        systemPromptChanges: this.generateSystemPromptRecommendations(analysisResults),
        userPromptChanges: this.generateUserPromptRecommendations(analysisResults),
        outputFormatChanges: this.generateOutputFormatRecommendations(analysisResults)
      },
      
      // 아키텍처 개선
      architectureImprovements: {
        priority: 'LOW',
        pipelineRedesign: this.generatePipelineRedesignRecommendations(analysisResults),
        alternativeApproaches: this.generateAlternativeApproaches(analysisResults)
      }
    };
    
    // 권고사항 저장
    const filepath = path.join(this.resultsPath, 'insights', 'recommendations.json');
    fs.writeFileSync(filepath, JSON.stringify(recommendations, null, 2));
    
    return recommendations;
  }

  /**
   * 최종 결과 저장
   */
  async saveFinalResults(results) {
    // 종합 결과 저장
    const summaryPath = path.join(this.resultsPath, 'COMPREHENSIVE_ANALYSIS_SUMMARY.json');
    fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
    
    // 마크다운 보고서 생성
    const markdownReport = this.generateMarkdownReport(results);
    const reportPath = path.join(this.resultsPath, 'COMPREHENSIVE_ANALYSIS_REPORT.md');
    fs.writeFileSync(reportPath, markdownReport);
    
    console.log(`📊 종합 분석 결과 저장: ${summaryPath}`);
    console.log(`📋 상세 보고서 생성: ${reportPath}`);
  }

  /**
   * 마크다운 보고서 생성
   */
  generateMarkdownReport(results) {
    return `# 🧬 12케이스 포괄적 DNA 시퀀싱 파이프라인 분석 보고서

## 📊 분석 개요
- **분석 일시**: ${results.timestamp}
- **총 케이스 수**: ${results.totalCases}개
- **성공 케이스**: ${results.successfulCases}개
- **실패 케이스**: ${results.failedCases}개

## 🔬 후처리 로직 분석 결과

### 단계별 성능
- **1단계 (세그멘테이션)**: 평균 ${results.overallPatterns.preprocessingOverview.averageStage1Segments}개 세그먼트
- **2단계 (정규화)**: 평균 ${results.overallPatterns.preprocessingOverview.averageStage2Items}개 항목
- **3단계 (엔티티 정규화)**: 평균 ${results.overallPatterns.preprocessingOverview.averageStage3Entities}개 엔티티

### 주요 병목점
${results.overallPatterns.preprocessingOverview.commonBottlenecks.map(b => `- ${b}`).join('\n')}

## 🤖 AI 처리 분석 결과

### 정보 추출 성공률
- **환자 정보**: ${(results.overallPatterns.aiProcessingOverview.patientInfoExtractionRate * 100).toFixed(1)}%
- **보험 정보**: ${(results.overallPatterns.aiProcessingOverview.insuranceInfoExtractionRate * 100).toFixed(1)}%
- **시간축 이벤트**: ${(results.overallPatterns.aiProcessingOverview.timelineEventsExtractionRate * 100).toFixed(1)}%
- **통원 통계**: ${(results.overallPatterns.aiProcessingOverview.visitStatsExtractionRate * 100).toFixed(1)}%

## 📈 품질 분석 결과

### 전체 품질 점수
- **평균 품질 점수**: ${results.overallPatterns.qualityOverview.averageQualityScore.toFixed(2)}/10

### 최고 성능 케이스
${results.overallPatterns.qualityOverview.bestPerformingCases.map(c => `- ${c.caseNumber}: ${c.score.toFixed(2)}점`).join('\n')}

### 최저 성능 케이스
${results.overallPatterns.qualityOverview.worstPerformingCases.map(c => `- ${c.caseNumber}: ${c.score.toFixed(2)}점`).join('\n')}

## 💡 개선 권고사항

### 🔧 후처리 로직 개선 (HIGH 우선순위)
${results.recommendations.preprocessingImprovements.stage1Improvements.map(r => `- ${r}`).join('\n')}

### 📝 AI 프롬프트 개선 (MEDIUM 우선순위)
${results.recommendations.promptImprovements.systemPromptChanges.map(r => `- ${r}`).join('\n')}

### 🏗️ 아키텍처 개선 (LOW 우선순위)
${results.recommendations.architectureImprovements.pipelineRedesign.map(r => `- ${r}`).join('\n')}

---
*분석 완료 시간: ${new Date().toISOString()}*
`;
  }

  // ===== 유틸리티 메서드들 =====

  /**
   * 지연 함수
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 케이스 파일 목록 가져오기 (Case4 제외)
   */
  getCaseFiles() {
    const files = fs.readdirSync(this.caseSamplePath);
    const caseFiles = [];
    
    for (let i = 1; i <= 12; i++) {
      if (i === 4) continue; // Case4는 report 파일이 없으므로 제외
      
      const fulltextFile = `Cast${i}_fulltext.txt`;
      const reportFile = `Cast${i === 1 ? '1' : i}_report.txt`;
      
      if (files.includes(fulltextFile) && files.includes(reportFile)) {
        caseFiles.push({
          caseNumber: `Case${i}`,
          fulltextPath: path.join(this.caseSamplePath, fulltextFile),
          reportPath: path.join(this.caseSamplePath, reportFile)
        });
      }
    }
    
    return caseFiles;
  }

  /**
   * 단일 케이스 분석
   */
  async analyzeSingleCase(caseInfo) {
    console.log(`  📖 ${caseInfo.caseNumber} 파일 로딩...`);
    
    // 케이스 파일 읽기
    const caseContent = fs.readFileSync(caseInfo.fulltextPath, 'utf-8');
    const expectedReport = fs.readFileSync(caseInfo.reportPath, 'utf-8');
    
    console.log(`  🧬 4단계 파이프라인 실행...`);
    
    // 4단계 파이프라인 실행
    const pipelineResult = await this.execute4StagePipeline(caseContent, caseInfo);
    
    console.log(`  📊 결과 분석 중...`);
    
    // 단계별 결과 저장
    const stageResults = this.extractStageResults(pipelineResult);
    
    // 품질 비교 분석
    const qualityAnalysis = this.compareReportQuality(
      pipelineResult.finalReport,
      expectedReport,
      stageResults
    );
    
    // 결과 저장
    await this.saveCaseResults(caseInfo.caseNumber, {
      stageResults,
      finalReport: pipelineResult.finalReport,
      expectedReport,
      qualityAnalysis,
      processingTime: pipelineResult.processingTime
    });
    
    return {
      caseNumber: caseInfo.caseNumber,
      status: 'success',
      stageResults,
      finalReport: pipelineResult.finalReport,
      expectedReport,
      qualityAnalysis,
      processingTime: pipelineResult.processingTime
    };
  }

  /**
   * 단계별 결과 추출
   */
  extractStageResults(pipelineResult) {
    return {
      stage1: {
        name: '원시 데이터 세그멘테이션',
        summary: pipelineResult.pipelineResults?.stage1?.summary || {},
        data: pipelineResult.pipelineResults?.stage1?.data || {}
      },
      stage2: {
        name: '시간축 데이터 정규화',
        summary: pipelineResult.pipelineResults?.stage2?.summary || {},
        data: pipelineResult.pipelineResults?.stage2?.data || {}
      },
      stage3: {
        name: '엔티티 정규화 및 통계',
        summary: pipelineResult.pipelineResults?.stage3?.summary || {},
        data: pipelineResult.pipelineResults?.stage3?.data || {}
      },
      stage4: {
        name: 'AI 보고서 합성',
        summary: pipelineResult.pipelineResults?.stage4?.summary || {},
        data: pipelineResult.finalReport
      }
    };
  }

  /**
   * 보고서 품질 비교 분석
   */
  compareReportQuality(aiReport, expectedReport, stageResults) {
    const analysis = {
      lengthComparison: {
        ai: aiReport?.length || 0,
        expected: expectedReport?.length || 0,
        ratio: (aiReport?.length || 0) / (expectedReport?.length || 1)
      },
      contentAnalysis: {
        hasPatientInfo: /환자.*:/.test(aiReport || ''),
        hasHospitalStats: /\d+회 통원/.test(aiReport || ''),
        hasDateRange: /\d{4}[.-]\d{2}[.-]\d{2}/.test(aiReport || ''),
        hasDiagnosis: /진단|질병|병명/.test(aiReport || '')
      },
      stageEffectiveness: {
        stage1Segments: stageResults.stage1?.summary?.totalSegments || 0,
        stage2Items: stageResults.stage2?.summary?.totalItems || 0,
        stage3Hospitals: stageResults.stage3?.summary?.uniqueHospitals || 0,
        stage3Diagnoses: stageResults.stage3?.summary?.uniqueDiagnoses || 0
      },
      qualityScore: 0 // 계산될 예정
    };
    
    // 품질 점수 계산 (0-100)
    let score = 0;
    if (analysis.contentAnalysis.hasPatientInfo) score += 20;
    if (analysis.contentAnalysis.hasHospitalStats) score += 25;
    if (analysis.contentAnalysis.hasDateRange) score += 20;
    if (analysis.contentAnalysis.hasDiagnosis) score += 15;
    if (analysis.lengthComparison.ratio > 0.3 && analysis.lengthComparison.ratio < 3) score += 20;
    
    analysis.qualityScore = score;
    
    return analysis;
  }

  /**
   * 케이스별 결과 저장
   */
  async saveCaseResults(caseNumber, results) {
    // 단계별 결과 저장
    const stageByStageDir = path.join(this.resultsPath, 'stage-by-stage', caseNumber);
    if (!fs.existsSync(stageByStageDir)) {
      fs.mkdirSync(stageByStageDir, { recursive: true });
    }
    
    for (const [stage, data] of Object.entries(results.stageResults)) {
      fs.writeFileSync(
        path.join(stageByStageDir, `${stage}.json`),
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    }
    
    // AI 보고서 저장
    fs.writeFileSync(
      path.join(this.resultsPath, 'ai-reports', `${caseNumber}_ai_report.txt`),
      results.finalReport || '보고서 생성 실패',
      'utf-8'
    );
    
    // 품질 분석 저장
    fs.writeFileSync(
      path.join(this.resultsPath, 'comparisons', `${caseNumber}_analysis.json`),
      JSON.stringify(results.qualityAnalysis, null, 2),
      'utf-8'
    );
  }

  /**
   * 포괄적 패턴 분석
   */
  async analyzeOverallPatterns(caseResults) {
    console.log('  🔍 성공/실패 패턴 분석...');
    
    const successfulCases = caseResults.filter(c => c.status === 'success');
    const failedCases = caseResults.filter(c => c.status === 'failed');
    
    const patterns = {
      successRate: successfulCases.length / caseResults.length,
      averageQualityScore: successfulCases.reduce((sum, c) => sum + (c.qualityAnalysis?.qualityScore || 0), 0) / successfulCases.length,
      stageEffectiveness: {
        stage1: { avgSegments: 0, successRate: 0 },
        stage2: { avgItems: 0, successRate: 0 },
        stage3: { avgHospitals: 0, avgDiagnoses: 0, successRate: 0 },
        stage4: { avgLength: 0, successRate: 0 }
      },
      commonFailurePoints: [],
      bestPerformingCases: successfulCases
        .sort((a, b) => (b.qualityAnalysis?.qualityScore || 0) - (a.qualityAnalysis?.qualityScore || 0))
        .slice(0, 3)
        .map(c => c.caseNumber),
      worstPerformingCases: successfulCases
        .sort((a, b) => (a.qualityAnalysis?.qualityScore || 0) - (b.qualityAnalysis?.qualityScore || 0))
        .slice(0, 3)
        .map(c => c.caseNumber)
    };
    
    // 단계별 효과성 계산
    if (successfulCases.length > 0) {
      patterns.stageEffectiveness.stage1.avgSegments = 
        successfulCases.reduce((sum, c) => sum + (c.stageResults?.stage1?.summary?.totalSegments || 0), 0) / successfulCases.length;
      
      patterns.stageEffectiveness.stage2.avgItems = 
        successfulCases.reduce((sum, c) => sum + (c.stageResults?.stage2?.summary?.totalItems || 0), 0) / successfulCases.length;
      
      patterns.stageEffectiveness.stage3.avgHospitals = 
        successfulCases.reduce((sum, c) => sum + (c.stageResults?.stage3?.summary?.uniqueHospitals || 0), 0) / successfulCases.length;
      
      patterns.stageEffectiveness.stage3.avgDiagnoses = 
        successfulCases.reduce((sum, c) => sum + (c.stageResults?.stage3?.summary?.uniqueDiagnoses || 0), 0) / successfulCases.length;
    }
    
    return patterns;
  }

  /**
   * 개선 권고사항 생성
   */
  async generateRecommendations(analysisResults) {
    const recommendations = {
      postProcessingLogic: [],
      aiPromptOptimization: [],
      pipelineArchitecture: [],
      priorityActions: []
    };
    
    const patterns = analysisResults.overallPatterns;
    
    // 후처리 로직 권고사항
    if (patterns.stageEffectiveness.stage3.avgHospitals < 1) {
      recommendations.postProcessingLogic.push({
        priority: 'HIGH',
        issue: 'Stage3 병원 추출 실패',
        recommendation: '병원명 추출 로직 강화 - 정규식 패턴 개선 및 의료기관 사전 확장'
      });
    }
    
    if (patterns.stageEffectiveness.stage3.avgDiagnoses < 1) {
      recommendations.postProcessingLogic.push({
        priority: 'HIGH',
        issue: 'Stage3 진단명 추출 실패',
        recommendation: '진단명 추출 로직 강화 - KCD 코드 매핑 및 의학용어 사전 활용'
      });
    }
    
    // AI 프롬프트 최적화 권고사항
    if (patterns.averageQualityScore < 60) {
      recommendations.aiPromptOptimization.push({
        priority: 'HIGH',
        issue: '전반적 품질 점수 저조',
        recommendation: '프롬프트에 구체적 출력 형식 및 필수 포함 요소 명시'
      });
    }
    
    // 파이프라인 아키텍처 권고사항
    if (patterns.successRate < 0.8) {
      recommendations.pipelineArchitecture.push({
        priority: 'CRITICAL',
        issue: '파이프라인 성공률 저조',
        recommendation: '전체 파이프라인 순서 재검토 - 단일 AI 호출과 성능 비교 필요'
      });
    }
    
    // 우선순위 액션
    recommendations.priorityActions = [
      '1. Stage3 엔티티 추출 로직 전면 개선',
      '2. AI 프롬프트에 후처리 결과 활용 방법 명시',
      '3. 성공 케이스 패턴 분석하여 로직 표준화',
      '4. 실패 케이스 원인 분석 및 예외 처리 강화'
    ];
    
    return recommendations;
  }

  /**
   * 최종 결과 저장
   */
  async saveFinalResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 종합 분석 결과
    fs.writeFileSync(
      path.join(this.resultsPath, `comprehensive_analysis_${timestamp}.json`),
      JSON.stringify(results, null, 2),
      'utf-8'
    );
    
    // 인사이트 리포트 (텍스트 형식)
    const reportContent = this.generateTextReport(results);
    fs.writeFileSync(
      path.join(this.resultsPath, 'insights', `analysis_report_${timestamp}.txt`),
      reportContent,
      'utf-8'
    );
    
    console.log(`\n📄 최종 결과 저장 완료:`);
    console.log(`   📊 종합 분석: comprehensive_analysis_${timestamp}.json`);
    console.log(`   📝 인사이트 리포트: insights/analysis_report_${timestamp}.txt`);
  }

  /**
   * 텍스트 리포트 생성
   */
  generateTextReport(results) {
    const { totalCases, successfulCases, failedCases, overallPatterns, recommendations } = results;
    
    return `
🧬 MediAI DNA 시퀀싱 파이프라인 - 12케이스 포괄적 분석 리포트
===============================================================

📊 전체 분석 결과
- 총 분석 케이스: ${totalCases}개
- 성공한 케이스: ${successfulCases}개 (${Math.round(overallPatterns.successRate * 100)}%)
- 실패한 케이스: ${failedCases}개
- 평균 품질 점수: ${Math.round(overallPatterns.averageQualityScore)}/100

🏆 최고 성능 케이스: ${overallPatterns.bestPerformingCases?.join(', ') || '없음'}
⚠️  최저 성능 케이스: ${overallPatterns.worstPerformingCases?.join(', ') || '없음'}

📈 단계별 효과성 분석
- Stage1 (세그멘테이션): 평균 ${Math.round(overallPatterns.stageEffectiveness.stage1.avgSegments)}개 세그먼트
- Stage2 (시간축 정규화): 평균 ${Math.round(overallPatterns.stageEffectiveness.stage2.avgItems)}개 항목
- Stage3 (엔티티 정규화): 평균 ${Math.round(overallPatterns.stageEffectiveness.stage3.avgHospitals)}개 병원, ${Math.round(overallPatterns.stageEffectiveness.stage3.avgDiagnoses)}개 진단명

🔧 핵심 개선 권고사항
${recommendations.priorityActions?.map((action, i) => `${action}`).join('\n') || '권고사항 생성 실패'}

💡 세부 권고사항
후처리 로직: ${recommendations.postProcessingLogic?.length || 0}개 권고사항
AI 프롬프트: ${recommendations.aiPromptOptimization?.length || 0}개 권고사항
파이프라인 구조: ${recommendations.pipelineArchitecture?.length || 0}개 권고사항

분석 완료 시간: ${new Date().toLocaleString('ko-KR')}
`;
  }

  // 분석 메서드들 (간단한 구현, 실제로는 더 정교하게 구현 필요)
  extractPatientInfo(text) {
    return text && !text.includes('환자명 미상');
  }

  extractInsuranceInfo(text) {
    return text && /보험|AXA|현대해상|삼성화재/.test(text);
  }

  extractTimelineEvents(text) {
    return text && /\d{4}[.-]\d{2}[.-]\d{2}/.test(text);
  }

  extractVisitStats(text) {
    return text && /\d+회 통원/.test(text);
  }

  calculateSimilarity(text1, text2) {
    // 간단한 유사도 계산 (실제로는 더 정교한 알고리즘 필요)
    if (!text1 || !text2) return 0;
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  }

  findMissingElements(aiReport, expectedReport) {
    // 실제 보고서에는 있지만 AI 보고서에는 없는 요소들
    return ['구체적 구현 필요'];
  }

  findExtraElements(aiReport, expectedReport) {
    // AI 보고서에는 있지만 실제 보고서에는 없는 요소들
    return ['구체적 구현 필요'];
  }

  calculateExtractionEfficiency(analysis) {
    return {
      stage1Score: Math.min(analysis.stage1_segments / 10, 1) * 10,
      stage2Score: Math.min(analysis.stage2_items / 10, 1) * 10,
      stage3Score: Math.min((analysis.stage3_hospitals + analysis.stage3_diagnoses + analysis.stage3_visits) / 20, 1) * 10
    };
  }

  identifyBottleneckStage(analysis) {
    const scores = this.calculateExtractionEfficiency(analysis);
    const minScore = Math.min(scores.stage1Score, scores.stage2Score, scores.stage3Score);
    if (minScore === scores.stage1Score) return 'stage1';
    if (minScore === scores.stage2Score) return 'stage2';
    return 'stage3';
  }

  identifyDataLossPoints(analysis) {
    const points = [];
    if (analysis.stage1_segments > analysis.stage2_items) {
      points.push('stage1_to_stage2');
    }
    if (analysis.stage2_items > (analysis.stage3_hospitals + analysis.stage3_diagnoses)) {
      points.push('stage2_to_stage3');
    }
    return points;
  }

  assessInputDataQuality(stage3Result) {
    const output = stage3Result.output;
    return {
      hospitalCount: output.hospitalStats?.length || 0,
      diagnosisCount: output.diagnosisStats?.length || 0,
      totalVisits: output.hospitalStats?.reduce((sum, h) => sum + (h.visitCount || 0), 0) || 0
    };
  }

  assessOutputQuality(aiAnalysis) {
    let score = 0;
    if (aiAnalysis.hasPatientInfo) score += 2.5;
    if (aiAnalysis.hasInsuranceInfo) score += 2.5;
    if (aiAnalysis.hasTimelineEvents) score += 2.5;
    if (aiAnalysis.hasVisitStats) score += 2.5;
    return score;
  }

  calculateProcessingEfficiency(pipelineResult) {
    const stage4 = pipelineResult.pipelineResults.stage4;
    return {
      tokensUsed: stage4.summary.tokensUsed,
      reportLength: stage4.summary.reportLength,
      efficiency: stage4.summary.reportLength / Math.max(stage4.summary.tokensUsed, 1)
    };
  }

  calculateOverallQualityScore(comparison) {
    let score = 0;
    const preprocessing = comparison.preprocessingAnalysis;
    const aiReport = comparison.aiReportAnalysis;
    
    // 후처리 점수 (0-5점)
    score += Math.min((preprocessing.stage3_hospitals + preprocessing.stage3_diagnoses + preprocessing.stage3_visits) / 10, 1) * 5;
    
    // AI 보고서 점수 (0-5점)
    if (aiReport.hasPatientInfo) score += 1.25;
    if (aiReport.hasInsuranceInfo) score += 1.25;
    if (aiReport.hasTimelineEvents) score += 1.25;
    if (aiReport.hasVisitStats) score += 1.25;
    
    return Math.min(score, 10);
  }

  identifyStrengthAreas(comparison) {
    const strengths = [];
    const ai = comparison.aiReportAnalysis;
    
    if (ai.hasPatientInfo) strengths.push('환자정보추출');
    if (ai.hasInsuranceInfo) strengths.push('보험정보추출');
    if (ai.hasTimelineEvents) strengths.push('시간축이벤트');
    if (ai.hasVisitStats) strengths.push('통원통계');
    
    return strengths;
  }

  identifyWeaknessAreas(comparison) {
    const weaknesses = [];
    const ai = comparison.aiReportAnalysis;
    const preprocessing = comparison.preprocessingAnalysis;
    
    if (!ai.hasPatientInfo) weaknesses.push('환자정보추출');
    if (!ai.hasInsuranceInfo) weaknesses.push('보험정보추출');
    if (!ai.hasTimelineEvents) weaknesses.push('시간축이벤트');
    if (!ai.hasVisitStats) weaknesses.push('통원통계');
    if (preprocessing.stage3_hospitals === 0) weaknesses.push('병원정보추출');
    
    return weaknesses;
  }

  calculateAverage(cases, propertyPath) {
    const values = cases.map(c => this.getNestedProperty(c, propertyPath)).filter(v => v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  calculateSuccessRate(cases, propertyPath) {
    const values = cases.map(c => this.getNestedProperty(c, propertyPath)).filter(v => v !== undefined);
    const successCount = values.filter(v => v === true).length;
    return values.length > 0 ? successCount / values.length : 0;
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  identifyCommonBottlenecks(cases) {
    const bottlenecks = cases.map(c => c.patterns?.preprocessingPatterns?.bottleneckStage).filter(b => b);
    const counts = {};
    bottlenecks.forEach(b => counts[b] = (counts[b] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([stage, count]) => `${stage}: ${count}회`);
  }

  identifyDataLossPatterns(cases) {
    const patterns = [];
    cases.forEach(c => {
      const lossPoints = c.patterns?.preprocessingPatterns?.dataLossPoints || [];
      lossPoints.forEach(point => {
        const existing = patterns.find(p => p.point === point);
        if (existing) {
          existing.count++;
        } else {
          patterns.push({ point, count: 1 });
        }
      });
    });
    return patterns.sort((a, b) => b.count - a.count);
  }

  identifyBestCases(cases) {
    return cases
      .map(c => ({ caseNumber: c.caseNumber, score: c.patterns?.qualityPatterns?.overallScore || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  identifyWorstCases(cases) {
    return cases
      .map(c => ({ caseNumber: c.caseNumber, score: c.patterns?.qualityPatterns?.overallScore || 0 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }

  identifyQualityFactors(cases) {
    // 품질에 영향을 미치는 요인들 분석
    return ['후처리_데이터_품질', 'AI_프롬프트_적합성', '케이스_복잡도'];
  }

  generateStage1Recommendations(results) {
    return [
      '의료 키워드 사전 확장',
      '세그멘테이션 알고리즘 개선',
      '날짜 패턴 인식 강화'
    ];
  }

  generateStage2Recommendations(results) {
    return [
      '시간축 정렬 로직 개선',
      '중복 데이터 제거 강화',
      '연관성 기반 그룹화'
    ];
  }

  generateStage3Recommendations(results) {
    return [
      '병원명 정규화 테이블 구축',
      '통원 통계 계산 로직 구현',
      '진단명 표준화 시스템'
    ];
  }

  generateSystemPromptRecommendations(results) {
    return [
      '구조화된 데이터 처리 지시문 추가',
      '의료 전문용어 컨텍스트 강화',
      '출력 형식 명확화'
    ];
  }

  generateUserPromptRecommendations(results) {
    return [
      '케이스별 맞춤형 프롬프트',
      '후처리 결과 활용 최적화',
      '품질 검증 지시문 추가'
    ];
  }

  generateOutputFormatRecommendations(results) {
    return [
      '9개 항목 구조화 강화',
      '통원 통계 필수 포함',
      '시간축 정렬 보장'
    ];
  }

  generatePipelineRedesignRecommendations(results) {
    return [
      '단계별 검증 포인트 추가',
      '데이터 손실 방지 메커니즘',
      '품질 피드백 루프 구현'
    ];
  }

  generateAlternativeApproaches(results) {
    return [
      '하이브리드 접근법 (후처리 + 직접 AI)',
      '단계별 AI 검증 시스템',
      '적응형 파이프라인 구조'
    ];
  }
}

// 실행 함수
async function runAnalysis() {
  const analyzer = new ComprehensivePipelineAnalyzer();
  
  try {
    const results = await analyzer.runComprehensiveAnalysis();
    
    console.log('\n🎉 분석 완료! 주요 결과:');
    console.log(`   ✅ 성공: ${results.successfulCases}/${results.totalCases}케이스`);
    console.log(`   📊 평균 품질: ${Math.round(results.overallPatterns.averageQualityScore)}/100점`);
    console.log(`   🏆 최고 성능: ${results.overallPatterns.bestPerformingCases?.join(', ')}`);
    
    return results;
  } catch (error) {
    console.error('❌ 분석 실패:', error);
    throw error;
  }
}

// 모듈 내보내기
export { ComprehensivePipelineAnalyzer, runAnalysis };

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnalysis().catch(console.error);
} 