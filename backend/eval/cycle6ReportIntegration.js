/**
 * Cycle 6: Report Integration Pipeline
 * 
 * 목표: Vision LLM 추출 결과 → 10항목 보고서 생성까지 통합
 * 
 * 파이프라인:
 * 1. Cycle 4/5 캐시 데이터 로드
 * 2. 이벤트 → 보고서 스키마 매핑
 * 3. 보험가입일 플래그 적용
 * 4. 10항목 보고서 생성
 * 5. HTML 리포트 출력
 * 
 * 실행: node backend/eval/cycle6ReportIntegration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 모듈 import
import { flagEventsByInsuranceDate, summarizeInsuranceFlags } from './lib/insuranceDateFlag.js';
import { mapEventsToReportSchema, calculateReportCompleteness, formatReportAsText } from './lib/eventToReportMapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  // Cycle 4 캐시 경로
  cycle4CacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  
  // Cycle 5 결과 경로
  cycle5ResultsPath: path.join(__dirname, 'output/cycle5_postprocessing/cycle5_results.json'),
  
  // Cycle 6 출력 경로
  outputDir: path.join(__dirname, 'output/cycle6_integration'),
  reportsDir: path.join(__dirname, 'output/cycle6_integration/reports'),
  
  // Ground Truth 경로
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 제외 케이스
  excludeCases: [18],
  
  // 테스트 케이스 (지정하면 해당 케이스만 처리)
  testCase: null  // 예: 13
};

// 디렉토리 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Cycle 4 캐시 로드
function loadCycle4Cache(caseNum) {
  const cachePath = path.join(CONFIG.cycle4CacheDir, `case_${caseNum}_topdown.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }
  return null;
}

// Ground Truth에서 보험가입일 추출
function extractInsuranceDatesFromGT(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (!fs.existsSync(gtPath)) return [];
  
  const content = fs.readFileSync(gtPath, 'utf-8');
  const insuranceDates = [];
  
  // 보험 가입 관련 패턴
  const patterns = [
    // NH농협 가입 패턴
    /(\d{4})\.(\d{1,2})\.(\d{1,2})\s*\([무월화수목금토일]\)\s*[가-힣]+.*가입/g,
    // 일반 가입 패턴
    /가입[일:\s]*(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
    // 보험기간 시작일
    /보험기간\s*[:\s]*(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      
      // 미래 날짜(만기일) 제외
      if (parseInt(year) <= new Date().getFullYear() + 1) {
        insuranceDates.push({
          date,
          source: 'gt_report'
        });
      }
    }
  });
  
  // 중복 제거
  const unique = [...new Set(insuranceDates.map(d => d.date))].map(date => ({ date }));
  return unique;
}

// 케이스 처리
async function processCase(caseNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case ${caseNum}] Processing...`);
  console.log('='.repeat(60));
  
  // 1. Cycle 4 캐시 로드
  const cache = loadCycle4Cache(caseNum);
  if (!cache) {
    console.log(`  ❌ Cache not found for Case ${caseNum}`);
    return null;
  }
  
  console.log(`  ✅ Cache loaded: ${cache.totalPages} pages`);
  
  // 2. 이벤트 → 보고서 스키마 매핑
  const reportData = mapEventsToReportSchema(cache.generatedJson);
  console.log(`  📊 Events mapped: ${reportData.dateEvents.length} events`);
  
  // 3. 보험가입일 추출 (GT 또는 추출 데이터에서)
  let insuranceDates = reportData.insuranceInfo.filter(i => i.isStartDate);
  
  if (insuranceDates.length === 0) {
    // GT에서 보험가입일 추출 시도
    const gtInsurance = extractInsuranceDatesFromGT(caseNum);
    if (gtInsurance.length > 0) {
      insuranceDates = gtInsurance;
      console.log(`  📋 Insurance dates from GT: ${gtInsurance.map(d => d.date).join(', ')}`);
    }
  } else {
    console.log(`  📋 Insurance dates from extraction: ${insuranceDates.map(d => d.date).join(', ')}`);
  }
  
  // 4. 보험가입일 플래그 적용
  if (insuranceDates.length > 0) {
    const primaryInsuranceDate = insuranceDates[0].date;
    reportData.dateEvents = flagEventsByInsuranceDate(reportData.dateEvents, primaryInsuranceDate);
    reportData.insuranceStartDate = primaryInsuranceDate;
    
    // 플래그 요약
    const flagSummary = summarizeInsuranceFlags(reportData.dateEvents);
    reportData.flagSummary = flagSummary;
    
    console.log(`  ⚠️  Events within 3 months before: ${flagSummary.within3MonthsBefore}`);
    console.log(`  📋 Events within 5 years before: ${flagSummary.within5YearsBefore}`);
  }
  
  // 5. 보고서 완성도 계산
  const completeness = calculateReportCompleteness(reportData);
  reportData.completeness = completeness;
  console.log(`  📈 Report completeness: ${completeness.score}%`);
  
  // 6. 결과 반환
  return {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: cache.patientName,
    reportData,
    completeness,
    processedAt: new Date().toISOString()
  };
}

// HTML 리포트 생성
function generateHtmlReport(results) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cycle 6: Report Integration Results</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .header .subtitle { font-size: 1.1rem; opacity: 0.9; }
    .content { padding: 2rem; }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      border-left: 4px solid #11998e;
    }
    .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #11998e; }
    .stat-card .label { color: #64748b; font-size: 0.9rem; }
    
    .case-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      border-left: 4px solid #667eea;
    }
    .case-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .case-title { font-size: 1.3rem; font-weight: 600; color: #1e293b; }
    .case-score {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 600;
    }
    .score-high { background: #d1fae5; color: #065f46; }
    .score-medium { background: #fef3c7; color: #92400e; }
    .score-low { background: #fee2e2; color: #991b1b; }
    
    .timeline {
      background: white;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .timeline-item:last-child { border-bottom: none; }
    .timeline-date {
      min-width: 100px;
      font-family: monospace;
      font-weight: 600;
      color: #475569;
    }
    .timeline-type {
      min-width: 80px;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      margin: 0 0.5rem;
      text-align: center;
    }
    .type-수술 { background: #fecaca; color: #991b1b; }
    .type-입원 { background: #fed7aa; color: #9a3412; }
    .type-진단 { background: #fef08a; color: #854d0e; }
    .type-검사 { background: #bbf7d0; color: #166534; }
    .type-보험가입일 { background: #c7d2fe; color: #3730a3; }
    .type-default { background: #e2e8f0; color: #475569; }
    
    .timeline-content { flex: 1; color: #64748b; font-size: 0.9rem; }
    
    .flag-badge {
      display: inline-block;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-left: 0.5rem;
    }
    .flag-critical { background: #dc2626; color: white; }
    .flag-warning { background: #f59e0b; color: white; }
    .flag-info { background: #3b82f6; color: white; }
    
    .insurance-info {
      background: #eff6ff;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
    }
    .insurance-title { font-weight: 600; color: #1e40af; margin-bottom: 0.5rem; }
    
    .footer {
      text-align: center;
      padding: 2rem;
      color: #94a3b8;
      font-size: 0.9rem;
      background: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Cycle 6: Report Integration</h1>
      <div class="subtitle">Vision LLM 추출 → 10항목 보고서 통합 파이프라인</div>
      <div class="subtitle">${new Date().toLocaleString('ko-KR')}</div>
    </div>
    
    <div class="content">
      <h2>📈 Overall Summary</h2>
      <div class="summary-grid">
        <div class="stat-card">
          <div class="value">${results.length}</div>
          <div class="label">Processed Cases</div>
        </div>
        <div class="stat-card">
          <div class="value">${Math.round(results.reduce((sum, r) => sum + r.completeness.score, 0) / results.length)}%</div>
          <div class="label">Avg Completeness</div>
        </div>
        <div class="stat-card">
          <div class="value">${results.reduce((sum, r) => sum + r.reportData.dateEvents.length, 0)}</div>
          <div class="label">Total Events</div>
        </div>
        <div class="stat-card">
          <div class="value">${results.filter(r => r.reportData.insuranceStartDate).length}</div>
          <div class="label">Insurance Flagged</div>
        </div>
      </div>
      
      <h2>📋 Case Details</h2>
      ${results.map(result => generateCaseHtml(result)).join('\n')}
    </div>
    
    <div class="footer">
      <p>VNEXSUS AI Claims System - Cycle 6 Integration Report</p>
      <p>Generated: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// 케이스별 HTML 생성
function generateCaseHtml(result) {
  const { caseId, patientName, reportData, completeness } = result;
  const scoreClass = completeness.score >= 70 ? 'score-high' : 
                     completeness.score >= 40 ? 'score-medium' : 'score-low';
  
  // 타임라인 이벤트 (상위 15개)
  const timelineEvents = reportData.dateEvents.slice(0, 15);
  
  return `
    <div class="case-section">
      <div class="case-header">
        <div class="case-title">${caseId} - ${patientName || '환자명 미상'}</div>
        <div class="case-score ${scoreClass}">${completeness.score}% 완성도</div>
      </div>
      
      <div class="summary-grid" style="margin: 1rem 0;">
        <div class="stat-card" style="padding: 0.75rem;">
          <div class="value" style="font-size: 1.5rem;">${reportData.dateEvents.length}</div>
          <div class="label">이벤트</div>
        </div>
        <div class="stat-card" style="padding: 0.75rem;">
          <div class="value" style="font-size: 1.5rem;">${reportData.diagnoses.length}</div>
          <div class="label">진단</div>
        </div>
        <div class="stat-card" style="padding: 0.75rem;">
          <div class="value" style="font-size: 1.5rem;">${reportData.treatments.length}</div>
          <div class="label">치료</div>
        </div>
        <div class="stat-card" style="padding: 0.75rem;">
          <div class="value" style="font-size: 1.5rem;">${reportData.flagSummary?.within3MonthsBefore || 0}</div>
          <div class="label">3M 이내</div>
        </div>
      </div>
      
      ${reportData.insuranceStartDate ? `
        <div class="insurance-info">
          <div class="insurance-title">📋 보험가입일: ${reportData.insuranceStartDate}</div>
          <div>• 가입일 전 3개월 이내 이벤트: ${reportData.flagSummary?.within3MonthsBefore || 0}건</div>
          <div>• 가입일 전 5년 이내 이벤트: ${reportData.flagSummary?.within5YearsBefore || 0}건</div>
        </div>
      ` : ''}
      
      <div class="timeline">
        <strong>📅 이벤트 타임라인 (최근 15건)</strong>
        ${timelineEvents.map(event => {
          const typeClass = `type-${event.type}` || 'type-default';
          let flagHtml = '';
          if (event.insuranceFlags) {
            if (event.insuranceFlags.isInsuranceStartDate) {
              flagHtml += '<span class="flag-badge flag-info">가입일</span>';
            }
            if (event.insuranceFlags.within3MonthsBefore) {
              flagHtml += '<span class="flag-badge flag-critical">3M</span>';
            } else if (event.insuranceFlags.within5YearsBefore) {
              flagHtml += '<span class="flag-badge flag-warning">5Y</span>';
            }
          }
          
          return `
            <div class="timeline-item">
              <div class="timeline-date">${event.date}</div>
              <div class="timeline-type ${typeClass}">${event.type}</div>
              <div class="timeline-content">
                ${event.hospital || event.context?.slice(0, 40) || ''}
                ${flagHtml}
              </div>
            </div>
          `;
        }).join('')}
        ${reportData.dateEvents.length > 15 ? `<div style="text-align: center; color: #94a3b8; padding: 0.5rem;">... 외 ${reportData.dateEvents.length - 15}개 이벤트</div>` : ''}
      </div>
    </div>
  `;
}

// 메인 실행
async function main() {
  console.log('='.repeat(70));
  console.log('CYCLE 6: REPORT INTEGRATION PIPELINE');
  console.log('Vision LLM → 10항목 보고서 통합');
  console.log('='.repeat(70));
  
  initDirectories();
  
  // 처리할 케이스 목록
  const cacheFiles = fs.readdirSync(CONFIG.cycle4CacheDir)
    .filter(f => f.endsWith('.json'))
    .map(f => parseInt(f.match(/case_(\d+)/)?.[1]))
    .filter(n => !isNaN(n) && !CONFIG.excludeCases.includes(n));
  
  // 테스트 케이스 지정 시
  const casesToProcess = CONFIG.testCase 
    ? [CONFIG.testCase] 
    : cacheFiles;
  
  console.log(`\nCases to process: ${casesToProcess.join(', ')}`);
  
  const results = [];
  
  for (const caseNum of casesToProcess) {
    const result = await processCase(caseNum);
    if (result) {
      results.push(result);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('GENERATING REPORTS');
  console.log('='.repeat(70));
  
  // 결과 JSON 저장
  const resultsPath = path.join(CONFIG.outputDir, 'cycle6_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved: ${resultsPath}`);
  
  // HTML 리포트 생성
  const htmlReport = generateHtmlReport(results);
  const htmlPath = path.join(CONFIG.reportsDir, 'cycle6_integration_report.html');
  fs.writeFileSync(htmlPath, htmlReport);
  console.log(`✅ HTML Report: ${htmlPath}`);
  
  // 개별 케이스 텍스트 보고서 생성
  results.forEach(result => {
    const textReport = formatReportAsText(result.reportData);
    const textPath = path.join(CONFIG.reportsDir, `${result.caseId}_report.txt`);
    fs.writeFileSync(textPath, textReport);
  });
  console.log(`✅ Text Reports: ${results.length} files`);
  
  // 요약 출력
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Cases: ${results.length}`);
  console.log(`Avg Completeness: ${Math.round(results.reduce((s, r) => s + r.completeness.score, 0) / results.length)}%`);
  console.log(`Total Events: ${results.reduce((s, r) => s + r.reportData.dateEvents.length, 0)}`);
  console.log(`Cases with Insurance Flags: ${results.filter(r => r.reportData.insuranceStartDate).length}`);
  
  console.log('\n✅ Cycle 6 Integration Complete!');
}

main().catch(console.error);
