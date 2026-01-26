/**
 * Cycle 3 Analysis
 * 
 * Cycle 2 캐시 데이터 분석 및 프롬프트 개선안 도출
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  cycle2ResultsPath: path.join(__dirname, 'output/improved_validation_cycle2/improved_validation_results.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  outputDir: path.join(__dirname, 'output/cycle3_analysis')
};

// 출력 디렉토리 생성
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// 날짜 주변 맥락 찾기
function findDateContext(date, text, contextLength = 80) {
  if (!text) return '(no context)';
  
  const patterns = [
    date.replace(/-/g, '.'),
    date.replace(/-0/g, '.').replace(/-/g, '.'),
    date,
    date.replace(/-/g, '/'),
    date.replace(/^(\d{4})-0?(\d{1,2})-0?(\d{1,2})$/, '$1.$2.$3')
  ];
  
  for (const pattern of patterns) {
    const idx = text.indexOf(pattern);
    if (idx !== -1) {
      const start = Math.max(0, idx - contextLength);
      const end = Math.min(text.length, idx + pattern.length + contextLength);
      return text.substring(start, end).replace(/\r?\n/g, ' ').trim();
    }
  }
  
  return '(pattern not found in GT)';
}

// 메인 분석
function runAnalysis() {
  console.log('='.repeat(70));
  console.log('CYCLE 3 ANALYSIS: Missed Dates Pattern Analysis');
  console.log('='.repeat(70));
  
  // Cycle 2 결과 로드
  const cycle2Data = JSON.parse(fs.readFileSync(CONFIG.cycle2ResultsPath, 'utf-8'));
  
  console.log('\n[SUMMARY]');
  console.log(`Total Cases: ${cycle2Data.summary.totalCases}`);
  console.log(`GT Coverage Rate: ${cycle2Data.summary.overallGtCoverageRate}%`);
  console.log(`Matched: ${cycle2Data.summary.totalMatched}/${cycle2Data.summary.totalGtDates}`);
  console.log(`Missed: ${cycle2Data.summary.totalMissed}`);
  console.log(`AI Extracted: ${cycle2Data.summary.totalAiDates}`);
  
  // 케이스별 분석
  console.log('\n' + '='.repeat(70));
  console.log('CASE-BY-CASE ANALYSIS');
  console.log('='.repeat(70));
  
  const allMissedDates = [];
  const patternCategories = {
    insurance: [],
    pastMedical: [],
    recentMedical: [],
    futureDate: [],
    examination: [],
    hospitalization: [],
    other: []
  };
  
  cycle2Data.results.forEach(r => {
    if (!r.matching) return;
    
    console.log(`\n[${r.caseId}] ${r.patientName}`);
    console.log(`  GT Coverage: ${r.matching.gtCoverageRate}% (${r.matching.matchedCount}/${r.matching.gtCount})`);
    console.log(`  AI Extracted: ${r.matching.aiCount}`);
    
    if (r.matching.missed.length > 0) {
      console.log(`  Missed Dates (${r.matching.missedCount}):`);
      
      const gt = loadGroundTruth(r.caseNum);
      
      r.matching.missed.forEach(date => {
        const context = findDateContext(date, gt);
        console.log(`    - ${date}`);
        console.log(`      Context: "${context.substring(0, 100)}..."`);
        
        // 패턴 분류
        const ctxLower = context.toLowerCase();
        const year = parseInt(date.substring(0, 4));
        
        const missedItem = {
          caseId: r.caseId,
          date,
          context
        };
        
        allMissedDates.push(missedItem);
        
        if (ctxLower.includes('insurance') || ctxLower.includes('policy') || 
            context.includes('가입') || context.includes('보험') || 
            context.includes('보장') || context.includes('계약') ||
            context.includes('청약') || context.includes('만기') ||
            context.includes('갱신') || context.includes('NH') ||
            context.includes('KB') || context.includes('삼성') ||
            context.includes('현대')) {
          patternCategories.insurance.push(missedItem);
        } else if (year > 2025) {
          patternCategories.futureDate.push(missedItem);
        } else if (year < 2022) {
          patternCategories.pastMedical.push(missedItem);
        } else if (context.includes('입원') || context.includes('퇴원') ||
                   ctxLower.includes('admission') || ctxLower.includes('discharge')) {
          patternCategories.hospitalization.push(missedItem);
        } else if (context.includes('검사') || context.includes('검진') ||
                   context.includes('보고') || context.includes('판독')) {
          patternCategories.examination.push(missedItem);
        } else if (year >= 2022) {
          patternCategories.recentMedical.push(missedItem);
        } else {
          patternCategories.other.push(missedItem);
        }
      });
    } else {
      console.log(`  Missed Dates: NONE (100% coverage!)`);
    }
  });
  
  // 패턴별 분석
  console.log('\n' + '='.repeat(70));
  console.log('MISSED DATE PATTERNS');
  console.log('='.repeat(70));
  
  console.log(`\n[INSURANCE RELATED] ${patternCategories.insurance.length} dates`);
  patternCategories.insurance.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[FUTURE DATES (>2025)] ${patternCategories.futureDate.length} dates`);
  patternCategories.futureDate.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[PAST MEDICAL (<2022)] ${patternCategories.pastMedical.length} dates`);
  patternCategories.pastMedical.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[HOSPITALIZATION] ${patternCategories.hospitalization.length} dates`);
  patternCategories.hospitalization.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[EXAMINATION/REPORT] ${patternCategories.examination.length} dates`);
  patternCategories.examination.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[RECENT MEDICAL (2022-2025)] ${patternCategories.recentMedical.length} dates`);
  patternCategories.recentMedical.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  console.log(`\n[OTHER] ${patternCategories.other.length} dates`);
  patternCategories.other.forEach(m => {
    console.log(`  ${m.caseId}: ${m.date}`);
    console.log(`    "${m.context.substring(0, 80)}..."`);
  });
  
  // 개선안 도출
  console.log('\n' + '='.repeat(70));
  console.log('PROMPT IMPROVEMENT RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  const recommendations = [];
  
  if (patternCategories.insurance.length > 0) {
    recommendations.push({
      priority: 1,
      category: 'Insurance Dates',
      count: patternCategories.insurance.length,
      issue: 'Insurance-related dates (enrollment, renewal, expiry) are being missed',
      solution: 'Add explicit instruction: "Extract ALL insurance-related dates including: enrollment date, policy start date, renewal date, expiry date, premium payment dates. Look for patterns with insurance company names (NH, KB, Samsung, Hyundai, AXA)."'
    });
  }
  
  if (patternCategories.futureDate.length > 0) {
    recommendations.push({
      priority: 2,
      category: 'Future Dates',
      count: patternCategories.futureDate.length,
      issue: 'Future dates (e.g., policy expiry in 2030) are being missed',
      solution: 'Add instruction: "Include future dates such as policy expiry dates, scheduled appointments, expected treatment dates."'
    });
  }
  
  if (patternCategories.hospitalization.length > 0) {
    recommendations.push({
      priority: 3,
      category: 'Hospitalization Dates',
      count: patternCategories.hospitalization.length,
      issue: 'Hospital admission/discharge dates are being missed',
      solution: 'Add instruction: "Extract ALL hospitalization periods - both admission and discharge dates. Look for patterns like YYYY.MM.DD ~ YYYY.MM.DD, admission/discharge records."'
    });
  }
  
  if (patternCategories.examination.length > 0) {
    recommendations.push({
      priority: 4,
      category: 'Examination/Report Dates',
      count: patternCategories.examination.length,
      issue: 'Examination and report dates are being missed',
      solution: 'Add instruction: "Extract ALL examination dates including: test date, report date, reading date. These may appear separately in lab reports."'
    });
  }
  
  if (patternCategories.recentMedical.length > 0) {
    recommendations.push({
      priority: 5,
      category: 'Recent Medical Events',
      count: patternCategories.recentMedical.length,
      issue: 'Some recent medical event dates are still being missed',
      solution: 'Strengthen instruction for comprehensive date extraction from clinical notes and progress notes.'
    });
  }
  
  if (patternCategories.pastMedical.length > 0) {
    recommendations.push({
      priority: 6,
      category: 'Past Medical History',
      count: patternCategories.pastMedical.length,
      issue: 'Historical medical dates are being missed',
      solution: 'Add instruction: "Extract ALL dates from past medical history sections, regardless of how old they are."'
    });
  }
  
  recommendations.forEach((rec, idx) => {
    console.log(`\n${idx + 1}. [${rec.category}] - ${rec.count} missed dates`);
    console.log(`   Issue: ${rec.issue}`);
    console.log(`   Solution: ${rec.solution}`);
  });
  
  // 결과 저장
  const analysisResult = {
    analyzedAt: new Date().toISOString(),
    summary: {
      totalMissed: allMissedDates.length,
      byCategory: {
        insurance: patternCategories.insurance.length,
        futureDate: patternCategories.futureDate.length,
        pastMedical: patternCategories.pastMedical.length,
        hospitalization: patternCategories.hospitalization.length,
        examination: patternCategories.examination.length,
        recentMedical: patternCategories.recentMedical.length,
        other: patternCategories.other.length
      }
    },
    missedDates: allMissedDates,
    patternCategories,
    recommendations
  };
  
  const outputPath = path.join(CONFIG.outputDir, 'cycle3_analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysisResult, null, 2), 'utf-8');
  console.log(`\nAnalysis saved to: ${outputPath}`);
  
  return analysisResult;
}

runAnalysis();
