const fs = require('fs');
const path = require('path');

class ComprehensiveFlowAnalyzer {
  constructor() {
    this.analysisResults = {
      caseAnalysis: {},
      stageAnalysis: {
        stage1: { totalSegments: 0, totalHospitals: 0, totalDates: 0, cases: [] },
        stage2: { successCount: 0, failureCount: 0, cases: [] },
        stage3: { totalHospitals: 0, totalDiagnoses: 0, totalVisits: 0, cases: [] },
        stage4: { totalReports: 0, averageLength: 0, cases: [] }
      },
      dataLossAnalysis: {},
      qualityComparison: {}
    };
  }

  async analyzeAllCases() {
    console.log('🔍 10개 케이스 전체 흐름 상세 분석 시작...\n');

    const caseNumbers = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12];
    
    for (const caseNum of caseNumbers) {
      if (caseNum === 4) continue; // Case4는 제외
      
      console.log(`📊 Case${caseNum} 분석 중...`);
      await this.analyzeSingleCase(caseNum);
    }

    this.generateComprehensiveReport();
    this.saveResults();
  }

  async analyzeSingleCase(caseNum) {
    const caseKey = `Case${caseNum}`;
    this.analysisResults.caseAnalysis[caseKey] = {
      originalText: null,
      realReport: null,
      aiReport: null,
      stageResults: {},
      dataFlow: {},
      qualityMetrics: {}
    };

    try {
      // 1. 원본 텍스트 로드
      const originalPath = `documents/fixtures/Cast${caseNum}_fulltext.txt`;
      if (fs.existsSync(originalPath)) {
        const originalText = fs.readFileSync(originalPath, 'utf8');
        this.analysisResults.caseAnalysis[caseKey].originalText = {
          length: originalText.length,
          lines: originalText.split('\n').length,
          koreanRatio: (originalText.match(/[가-힣]/g) || []).length / originalText.length
        };
      }

      // 2. 실제 보고서 로드
      const reportPath = `documents/fixtures/Cast${caseNum}_report.txt`;
      if (fs.existsSync(reportPath)) {
        const realReport = fs.readFileSync(reportPath, 'utf8');
        this.analysisResults.caseAnalysis[caseKey].realReport = {
          length: realReport.length,
          lines: realReport.split('\n').length,
          hasPatientInfo: realReport.includes('보험계약사항') || realReport.includes('계약자'),
          hasMedicalEvents: realReport.includes('진단명') || realReport.includes('병원'),
          hasTimelineEvents: realReport.includes('일자') || realReport.includes('내원일')
        };
      }

      // 3. AI 보고서 로드
      const aiReportPath = `temp/comprehensive-analysis/ai-reports/Case${caseNum}_ai_report.txt`;
      if (fs.existsSync(aiReportPath)) {
        const aiReport = fs.readFileSync(aiReportPath, 'utf8');
        this.analysisResults.caseAnalysis[caseKey].aiReport = {
          length: aiReport.length,
          lines: aiReport.split('\n').length,
          hasPatientInfo: !aiReport.includes('환자명 미상'),
          hasMedicalEvents: !aiReport.includes('의료 이벤트 없음'),
          hasTimelineEvents: aiReport.includes('2019') || aiReport.includes('2020') || aiReport.includes('2021')
        };
      }

      // 4. 단계별 결과 분석
      await this.analyzeStageResults(caseNum, caseKey);

      // 5. 데이터 흐름 추적
      this.trackDataFlow(caseKey);

      console.log(`✅ Case${caseNum} 분석 완료`);

    } catch (error) {
      console.error(`❌ Case${caseNum} 분석 실패:`, error.message);
    }
  }

  async analyzeStageResults(caseNum, caseKey) {
    const stageDir = `temp/comprehensive-analysis/stage-by-stage/Case${caseNum}`;
    
    for (let stage = 1; stage <= 4; stage++) {
      const stagePath = path.join(stageDir, `stage${stage}.json`);
      
      if (fs.existsSync(stagePath)) {
        try {
          const stageData = JSON.parse(fs.readFileSync(stagePath, 'utf8'));
          this.analysisResults.caseAnalysis[caseKey].stageResults[`stage${stage}`] = stageData;
          
          // 전체 통계에 추가
          this.updateStageStatistics(stage, stageData, caseKey);
          
        } catch (error) {
          console.error(`  ⚠️ Stage${stage} 데이터 로드 실패:`, error.message);
        }
      }
    }
  }

  updateStageStatistics(stage, stageData, caseKey) {
    const summary = stageData.summary || {};
    
    switch (stage) {
      case 1:
        this.analysisResults.stageAnalysis.stage1.totalSegments += summary.totalSegments || 0;
        this.analysisResults.stageAnalysis.stage1.totalHospitals += summary.hospitalsFound || 0;
        this.analysisResults.stageAnalysis.stage1.totalDates += summary.datesFound || 0;
        this.analysisResults.stageAnalysis.stage1.cases.push({
          case: caseKey,
          segments: summary.totalSegments || 0,
          hospitals: summary.hospitalsFound || 0,
          dates: summary.datesFound || 0
        });
        break;
        
      case 2:
        if (stageData.success !== false) {
          this.analysisResults.stageAnalysis.stage2.successCount++;
        } else {
          this.analysisResults.stageAnalysis.stage2.failureCount++;
        }
        this.analysisResults.stageAnalysis.stage2.cases.push({
          case: caseKey,
          success: stageData.success !== false,
          processingTime: summary.processingTime || 0
        });
        break;
        
      case 3:
        this.analysisResults.stageAnalysis.stage3.totalHospitals += summary.uniqueHospitals || 0;
        this.analysisResults.stageAnalysis.stage3.totalDiagnoses += summary.uniqueDiagnoses || 0;
        this.analysisResults.stageAnalysis.stage3.totalVisits += summary.totalVisits || 0;
        this.analysisResults.stageAnalysis.stage3.cases.push({
          case: caseKey,
          hospitals: summary.uniqueHospitals || 0,
          diagnoses: summary.uniqueDiagnoses || 0,
          visits: summary.totalVisits || 0
        });
        break;
        
      case 4:
        this.analysisResults.stageAnalysis.stage4.totalReports++;
        const reportLength = summary.reportLength || 0;
        this.analysisResults.stageAnalysis.stage4.averageLength = 
          (this.analysisResults.stageAnalysis.stage4.averageLength * (this.analysisResults.stageAnalysis.stage4.totalReports - 1) + reportLength) / 
          this.analysisResults.stageAnalysis.stage4.totalReports;
        this.analysisResults.stageAnalysis.stage4.cases.push({
          case: caseKey,
          reportLength: reportLength,
          tokensUsed: summary.tokensUsed || 0
        });
        break;
    }
  }

  trackDataFlow(caseKey) {
    const caseData = this.analysisResults.caseAnalysis[caseKey];
    const stages = caseData.stageResults;
    
    this.analysisResults.caseAnalysis[caseKey].dataFlow = {
      stage1ToStage2: this.calculateDataTransfer(stages.stage1, stages.stage2),
      stage2ToStage3: this.calculateDataTransfer(stages.stage2, stages.stage3),
      stage3ToStage4: this.calculateDataTransfer(stages.stage3, stages.stage4),
      overallLoss: this.calculateOverallDataLoss(stages)
    };
  }

  calculateDataTransfer(fromStage, toStage) {
    if (!fromStage || !toStage) return { status: 'missing_data' };
    
    return {
      dataPreserved: fromStage.summary && toStage.summary,
      lossDetected: this.detectDataLoss(fromStage.summary, toStage.summary)
    };
  }

  detectDataLoss(fromSummary, toSummary) {
    if (!fromSummary || !toSummary) return true;
    
    // Stage1 -> Stage2/3 데이터 손실 체크
    if (fromSummary.hospitalsFound > 0 && toSummary.uniqueHospitals === 0) return true;
    if (fromSummary.datesFound > 0 && !toSummary.dateRange) return true;
    
    return false;
  }

  calculateOverallDataLoss(stages) {
    const stage1Data = stages.stage1?.summary || {};
    const stage3Data = stages.stage3?.summary || {};
    
    return {
      hospitalLoss: (stage1Data.hospitalsFound || 0) - (stage3Data.uniqueHospitals || 0),
      diagnosisLoss: stage3Data.uniqueDiagnoses === 0 ? 'complete' : 'partial',
      visitLoss: stage3Data.totalVisits === 0 ? 'complete' : 'partial'
    };
  }

  generateComprehensiveReport() {
    console.log('\n📋 종합 분석 보고서 생성 중...');
    
    // 데이터 손실 패턴 분석
    this.analyzeDataLossPatterns();
    
    // 품질 비교 분석
    this.analyzeQualityComparison();
    
    console.log('✅ 종합 분석 완료');
  }

  analyzeDataLossPatterns() {
    const stage3Cases = this.analysisResults.stageAnalysis.stage3.cases;
    
    this.analysisResults.dataLossAnalysis = {
      criticalFindings: {
        zeroHospitalCases: stage3Cases.filter(c => c.hospitals === 0).length,
        zeroDiagnosisCases: stage3Cases.filter(c => c.diagnoses === 0).length,
        zeroVisitCases: stage3Cases.filter(c => c.visits === 0).length,
        totalCases: stage3Cases.length
      },
      stage3FailureRate: stage3Cases.filter(c => c.hospitals === 0 && c.diagnoses === 0 && c.visits === 0).length / stage3Cases.length * 100
    };
  }

  analyzeQualityComparison() {
    const cases = Object.keys(this.analysisResults.caseAnalysis);
    
    let realReportAvgLength = 0;
    let aiReportAvgLength = 0;
    let qualityGap = 0;
    
    cases.forEach(caseKey => {
      const caseData = this.analysisResults.caseAnalysis[caseKey];
      if (caseData.realReport && caseData.aiReport) {
        realReportAvgLength += caseData.realReport.length;
        aiReportAvgLength += caseData.aiReport.length;
        qualityGap += caseData.realReport.length - caseData.aiReport.length;
      }
    });
    
    this.analysisResults.qualityComparison = {
      averageRealReportLength: Math.round(realReportAvgLength / cases.length),
      averageAiReportLength: Math.round(aiReportAvgLength / cases.length),
      averageQualityGap: Math.round(qualityGap / cases.length),
      qualityRatio: Math.round((aiReportAvgLength / realReportAvgLength) * 100)
    };
  }

  saveResults() {
    const outputDir = 'temp/comprehensive-analysis/flow-analysis';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // JSON 결과 저장
    fs.writeFileSync(
      path.join(outputDir, 'comprehensive_flow_analysis.json'),
      JSON.stringify(this.analysisResults, null, 2)
    );
    
    // 텍스트 리포트 생성
    this.generateTextReport(outputDir);
    
    console.log(`\n📊 분석 결과 저장 완료: ${outputDir}`);
  }

  generateTextReport(outputDir) {
    const report = `
🔍 MediAI MVP - 10개 케이스 전체 흐름 상세 분석 보고서
=================================================

📊 전체 통계
-----------
• 분석 케이스: ${Object.keys(this.analysisResults.caseAnalysis).length}개
• Stage3 실패율: ${this.analysisResults.dataLossAnalysis.stage3FailureRate?.toFixed(1)}%
• AI 보고서 품질 비율: ${this.analysisResults.qualityComparison.qualityRatio}%

🏥 Stage별 성과 분석
-----------------
Stage1 (데이터 세그멘테이션):
• 총 세그먼트: ${this.analysisResults.stageAnalysis.stage1.totalSegments}개
• 병원 발견: ${this.analysisResults.stageAnalysis.stage1.totalHospitals}개
• 날짜 발견: ${this.analysisResults.stageAnalysis.stage1.totalDates}개

Stage2 (시간축 정규화):
• 성공: ${this.analysisResults.stageAnalysis.stage2.successCount}건
• 실패: ${this.analysisResults.stageAnalysis.stage2.failureCount}건

Stage3 (엔티티 추출) - ⚠️ 핵심 문제점:
• 병원 추출: ${this.analysisResults.stageAnalysis.stage3.totalHospitals}개 (0개 케이스: ${this.analysisResults.dataLossAnalysis.criticalFindings.zeroHospitalCases}개)
• 진단명 추출: ${this.analysisResults.stageAnalysis.stage3.totalDiagnoses}개 (0개 케이스: ${this.analysisResults.dataLossAnalysis.criticalFindings.zeroDiagnosisCases}개)
• 방문 횟수: ${this.analysisResults.stageAnalysis.stage3.totalVisits}회 (0회 케이스: ${this.analysisResults.dataLossAnalysis.criticalFindings.zeroVisitCases}개)

Stage4 (AI 보고서 생성):
• 평균 보고서 길이: ${Math.round(this.analysisResults.stageAnalysis.stage4.averageLength)}자
• 실제 보고서 평균: ${this.analysisResults.qualityComparison.averageRealReportLength}자
• 품질 격차: ${this.analysisResults.qualityComparison.averageQualityGap}자

🚨 핵심 발견사항
--------------
1. Stage3에서 ${this.analysisResults.dataLossAnalysis.stage3FailureRate?.toFixed(1)}% 완전 실패
2. Stage1에서 추출된 데이터가 Stage3에서 손실됨
3. AI 보고서 품질이 실제 보고서의 ${this.analysisResults.qualityComparison.qualityRatio}% 수준

💡 개선 방안
-----------
1. Stage3 엔티티 추출 로직 전면 재설계 필요
2. Stage1-Stage3 간 데이터 전달 구조 개선
3. 의료 용어 및 병원명 정규화 패턴 강화
`;

    fs.writeFileSync(path.join(outputDir, 'flow_analysis_report.txt'), report);
  }
}

// 실행
async function runFlowAnalysis() {
  const analyzer = new ComprehensiveFlowAnalyzer();
  await analyzer.analyzeAllCases();
}

if (require.main === module) {
  runFlowAnalysis().catch(console.error);
}

module.exports = { runFlowAnalysis }; 