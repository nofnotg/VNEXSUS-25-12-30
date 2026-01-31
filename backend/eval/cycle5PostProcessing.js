/**
 * Cycle 5: Post-Processing Optimization
 *
 * 목표: Cycle 4 과추출 데이터에 7-Phase 후처리 적용
 * - GT Coverage 56.8% 유지
 * - Precision 23.7% → 70-80% 향상
 * - Noise 대폭 감소
 *
 * 실행: node backend/eval/cycle5PostProcessing.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Phase 모듈 import
import { validateDateRange, validateDates } from './lib/dateRangeValidator.js';
import { scoreByType, normalizeType } from './lib/typeRelevanceScorer.js';
import { scoreByRecency, estimateClaimDate } from './lib/recencyScorer.js';
import { processInsurancePeriods } from './lib/insurancePeriodParser.js';
import { filterDocumentMetadata } from './lib/documentMetadataFilter.js';
import { scoreByContext } from './lib/contextAnalyzer.js';
import { scoreComprehensively, filterByScore } from './lib/comprehensiveScorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  // Cycle 4 캐시 경로
  cycle4CacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  cycle4ResultsPath: path.join(__dirname, 'output/cycle4_topdown/cycle4_topdown_results.json'),

  // Cycle 5 출력 경로
  outputDir: path.join(__dirname, 'output/cycle5_postprocessing'),
  reportsDir: path.join(__dirname, 'output/cycle5_postprocessing/reports'),

  // Ground Truth
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',

  // 필터링 임계값
  minScore: 20,  // 최소 점수 (FILTER 제거)

  // 제외할 케이스 (PDF/GT 불일치)
  excludeCases: [18]
};

// 디렉토리 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// Ground Truth에서 날짜 추출
function extractGroundTruthDates(groundTruth) {
  const dates = new Set();

  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');

      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);

      if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }

  return Array.from(dates).sort();
}

// 날짜 정규화: 타임스탬프 제거 (YYYY-MM-DDThh:mm:ss → YYYY-MM-DD)
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DDThh:mm:ss 형식인 경우 T 이후 제거
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }

  // 이미 YYYY-MM-DD 형식인 경우 그대로 반환
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  return dateStr;
}

// Cycle 4 캐시에서 날짜 수집
function collectCycle4Dates(generatedJson) {
  const allDates = [];

  // allExtractedDates
  if (generatedJson.allExtractedDates) {
    generatedJson.allExtractedDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: normalized,
          originalFormat: item.originalFormat,
          context: item.context || '',
          type: item.type || '기타',
          confidence: item.confidence || 'medium',
          source: 'allExtractedDates'
        });
      }
    });
  }

  // dateRanges (시작일, 종료일 모두)
  if (generatedJson.dateRanges) {
    generatedJson.dateRanges.forEach(item => {
      const startNormalized = normalizeDate(item.startDate);
      const endNormalized = normalizeDate(item.endDate);

      if (startNormalized && startNormalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: startNormalized,
          context: `${item.context} (시작일)`,
          type: item.type ? `${item.type}_시작일` : '기간_시작일',
          source: 'dateRanges_start'
        });
      }
      if (endNormalized && endNormalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: endNormalized,
          context: `${item.context} (종료일)`,
          type: item.type ? `${item.type}_종료일` : '기간_종료일',
          source: 'dateRanges_end'
        });
      }
    });
  }

  // insuranceDates
  if (generatedJson.insuranceDates) {
    generatedJson.insuranceDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: normalized,
          context: `${item.company || ''} ${item.productName || ''} ${item.type || ''}`,
          type: item.type || '보험관련',
          source: 'insuranceDates'
        });
      }
    });
  }

  // tableDates
  if (generatedJson.tableDates) {
    generatedJson.tableDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: normalized,
          context: item.rowContent || '',
          type: item.tableType || '테이블',
          source: 'tableDates'
        });
      }
    });
  }

  return allDates;
}

// 7-Phase 후처리 파이프라인
function applyPostProcessing(dates, caseInfo) {
  const pipeline = {
    phase1: { name: 'Date Range Validation', data: null },
    phase2: { name: 'Type-based Scoring', data: null },
    phase3: { name: 'Recency Scoring', data: null },
    phase4: { name: 'Insurance Period Parsing', data: null },
    phase5: { name: 'Document Metadata Filter', data: null },
    phase6: { name: 'Context Analysis', data: null },
    phase7: { name: 'Comprehensive Scoring', data: null }
  };

  // Phase 1: 날짜 범위 검증
  const phase1Result = validateDates(dates);
  pipeline.phase1.data = phase1Result;
  console.log(`    Phase 1: ${phase1Result.valid.length}/${dates.length} valid dates`);

  // Phase 2: 타입 기반 점수
  const phase2Data = scoreByType(phase1Result.valid);
  pipeline.phase2.data = phase2Data;
  console.log(`    Phase 2: Type scores assigned`);

  // Phase 3: 시간적 중요도
  const claimDate = estimateClaimDate(caseInfo);
  const phase3Data = scoreByRecency(phase2Data, claimDate);
  pipeline.phase3.data = phase3Data;
  console.log(`    Phase 3: Recency scores (claim date: ${claimDate})`);

  // Phase 4: 보험기간 파싱
  const phase4Result = processInsurancePeriods(phase3Data);
  pipeline.phase4.data = phase4Result;
  console.log(`    Phase 4: ${phase4Result.stats.adjusted} insurance periods parsed`);

  // Phase 5: 문서 메타데이터 필터
  const phase5Result = filterDocumentMetadata(phase4Result.processed);
  pipeline.phase5.data = phase5Result;
  console.log(`    Phase 5: ${phase5Result.stats.documentMetadata} document metadata flagged`);

  // Phase 6: 컨텍스트 분석
  const phase6Data = scoreByContext(phase5Result.processed);
  pipeline.phase6.data = phase6Data;
  console.log(`    Phase 6: Context scores assigned`);

  // Phase 7: 종합 점수
  const phase7Data = scoreComprehensively(phase6Data);
  pipeline.phase7.data = phase7Data;

  // 필터링 (minScore 이상만 유지)
  const filtered = filterByScore(phase7Data, CONFIG.minScore);
  console.log(`    Phase 7: ${filtered.kept.length}/${phase7Data.length} dates kept (score >= ${CONFIG.minScore})`);

  return {
    pipeline,
    finalDates: filtered.kept,
    filteredDates: filtered.filtered,
    allProcessed: phase7Data
  };
}

// 매칭 분석
function analyzeMatching(finalDates, gtDates) {
  const aiDates = [...new Set(finalDates.map(d => d.date))].sort();
  const matched = gtDates.filter(d => aiDates.includes(d));
  const missed = gtDates.filter(d => !aiDates.includes(d));
  const extra = aiDates.filter(d => !gtDates.includes(d));

  const gtCoverageRate = gtDates.length > 0
    ? Math.round((matched.length / gtDates.length) * 100)
    : 100;

  const precision = aiDates.length > 0
    ? Math.round((matched.length / aiDates.length) * 100)
    : 0;

  return {
    gtDates,
    aiDates,
    matched,
    missed,
    extra,
    gtCoverageRate,
    precision,
    gtCount: gtDates.length,
    aiCount: aiDates.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length
  };
}

// 케이스 처리
function processCase(caseData) {
  const caseNum = caseData.caseNum;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] ${caseData.patientName} - Post-Processing`);
  console.log(`${'='.repeat(60)}`);

  // Cycle 4 날짜 수집
  const cycle4Dates = collectCycle4Dates(caseData.generatedJson);
  console.log(`  Cycle 4 extracted: ${cycle4Dates.length} dates`);

  // 7-Phase 후처리
  const postProcessed = applyPostProcessing(cycle4Dates, {
    caseNum,
    patientName: caseData.patientName
  });

  // Ground Truth 비교 (Cycle 4 캐시에서 가져오기)
  const gtDates = caseData.matching?.gtDates || [];
  const matching = analyzeMatching(postProcessed.finalDates, gtDates);

  console.log(`  GT Coverage: ${matching.gtCoverageRate}% (${matching.matchedCount}/${matching.gtCount})`);
  console.log(`  Precision: ${matching.precision}% (${matching.matchedCount}/${matching.aiCount})`);
  console.log(`  Extra (noise): ${matching.extraCount} dates`);

  return {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: caseData.patientName,
    cycle4Count: cycle4Dates.length,
    postProcessed,
    matching
  };
}

// HTML 보고서 생성
function generateReport(summary, results, cycle4Summary) {
  const validResults = results.filter(r => r.matching);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS Cycle 5 Post-Processing Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f7fa; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    h2 { color: #2d3748; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }

    .approach-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; }
    .approach-box h3 { margin-bottom: 0.5rem; }

    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0; }
    .comparison-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .comparison-card h4 { color: #475569; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .comparison-card.winner { border: 3px solid #10b981; }

    .summary-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; font-size: 0.85rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }
    .card.danger .value { color: #ef4444; }

    table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 1rem 0; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }

    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }

    .improvement { font-size: 1.5rem; font-weight: bold; }
    .improvement.positive { color: #10b981; }
    .improvement.negative { color: #ef4444; }

    .phases { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin: 2rem 0; }
    .phase { background: white; padding: 1rem; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    .phase .num { font-size: 1.2rem; font-weight: bold; color: #10b981; }
    .phase .name { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cycle 5: Post-Processing Optimization Report</h1>
    <p class="subtitle">7-Phase filtering & scoring system | ${new Date().toLocaleString('ko-KR')}</p>

    <div class="approach-box">
      <h3>7-Phase Post-Processing Pipeline</h3>
      <div class="phases">
        <div class="phase"><div class="num">1</div><div class="name">Date Range Validation</div></div>
        <div class="phase"><div class="num">2</div><div class="name">Type-based Scoring</div></div>
        <div class="phase"><div class="num">3</div><div class="name">Recency Scoring</div></div>
        <div class="phase"><div class="num">4</div><div class="name">Insurance Parser</div></div>
        <div class="phase"><div class="num">5</div><div class="name">Metadata Filter</div></div>
        <div class="phase"><div class="num">6</div><div class="name">Context Analysis</div></div>
        <div class="phase"><div class="num">7</div><div class="name">Comprehensive Scoring</div></div>
      </div>
      <p><strong>Goal:</strong> Maintain GT Coverage (56.8%) while improving Precision to 70-80%</p>
    </div>

    <h2>Cycle 4 vs Cycle 5 Comparison</h2>
    <div class="comparison">
      <div class="comparison-card">
        <h4>Cycle 4 (Top-Down Only)</h4>
        <p><strong>GT Coverage:</strong> ${cycle4Summary.overallGtCoverageRate}%</p>
        <p><strong>Matched:</strong> ${cycle4Summary.totalMatched}/${cycle4Summary.totalGtDates}</p>
        <p><strong>AI Extracted:</strong> ${cycle4Summary.totalAiDates}</p>
        <p><strong>Precision:</strong> ${Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}%</p>
        <p><strong>Noise:</strong> ${cycle4Summary.totalExtra} dates</p>
      </div>
      <div class="comparison-card winner">
        <h4>Cycle 5 (With Post-Processing) 🎯</h4>
        <p><strong>GT Coverage:</strong> ${summary.overallGtCoverageRate}%</p>
        <p><strong>Matched:</strong> ${summary.totalMatched}/${summary.totalGtDates}</p>
        <p><strong>AI Extracted:</strong> ${summary.totalAiDates}</p>
        <p><strong>Precision:</strong> ${summary.overallPrecision}%</p>
        <p><strong>Noise:</strong> ${summary.totalExtra} dates</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin:2rem 0;">
      <div style="text-align:center; padding: 2rem; background: white; border-radius: 12px;">
        <p style="color:#64748b;">Precision Improvement</p>
        <p class="improvement positive">
          +${summary.overallPrecision - Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}%p
        </p>
        <p style="color:#64748b;margin-top:0.5rem;">${Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}% → ${summary.overallPrecision}%</p>
      </div>
      <div style="text-align:center; padding: 2rem; background: white; border-radius: 12px;">
        <p style="color:#64748b;">Noise Reduction</p>
        <p class="improvement positive">
          ${Math.round(((cycle4Summary.totalExtra - summary.totalExtra) / cycle4Summary.totalExtra) * 100)}%
        </p>
        <p style="color:#64748b;margin-top:0.5rem;">${cycle4Summary.totalExtra} → ${summary.totalExtra} dates</p>
      </div>
    </div>

    <h2>Cycle 5 Summary</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 50 ? 'success' : 'warning'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">GT Coverage</div>
      </div>
      <div class="card ${summary.overallPrecision >= 70 ? 'success' : summary.overallPrecision >= 50 ? 'warning' : 'danger'}">
        <div class="value">${summary.overallPrecision}%</div>
        <div class="label">Precision</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">Matched/GT</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI Extracted</div>
      </div>
      <div class="card ${summary.totalExtra < 50 ? 'success' : 'warning'}">
        <div class="value">${summary.totalExtra}</div>
        <div class="label">Extra (Noise)</div>
      </div>
    </div>

    <h2>Case-by-Case Results</h2>
    <table>
      <thead>
        <tr>
          <th>Case</th>
          <th>Patient</th>
          <th>Cycle 4</th>
          <th>Cycle 5</th>
          <th>GT Coverage</th>
          <th>Precision</th>
          <th>GT/Match/Miss</th>
          <th>Noise</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.map(r => `
        <tr>
          <td><strong>${r.caseId}</strong></td>
          <td>${r.patientName || '-'}</td>
          <td>${r.cycle4Count}</td>
          <td>${r.matching.aiCount}</td>
          <td>
            <span class="badge ${r.matching.gtCoverageRate >= 50 ? 'badge-success' : 'badge-warning'}">
              ${r.matching.gtCoverageRate}%
            </span>
          </td>
          <td>
            <span class="badge ${r.matching.precision >= 70 ? 'badge-success' : r.matching.precision >= 50 ? 'badge-warning' : 'badge-danger'}">
              ${r.matching.precision}%
            </span>
          </td>
          <td>${r.matching.gtCount} / ${r.matching.matchedCount} / ${r.matching.missedCount}</td>
          <td>${r.matching.extraCount}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Analysis</h2>
    <div style="background:white; padding:1.5rem; border-radius:12px; margin:1rem 0;">
      <h4 style="color:#1e40af; margin-bottom:1rem;">Key Achievements</h4>
      <ul style="margin-left:1.5rem;">
        <li><strong>Precision:</strong> Improved from ${Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}% to ${summary.overallPrecision}% (+${summary.overallPrecision - Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}%p)</li>
        <li><strong>Noise Reduction:</strong> ${cycle4Summary.totalExtra} → ${summary.totalExtra} dates (${Math.round(((cycle4Summary.totalExtra - summary.totalExtra) / cycle4Summary.totalExtra) * 100)}% reduction)</li>
        <li><strong>GT Coverage:</strong> ${summary.overallGtCoverageRate}% maintained</li>
        <li><strong>Filtering:</strong> ${cycle4Summary.totalAiDates} → ${summary.totalAiDates} dates extracted</li>
      </ul>
    </div>

    <p style="text-align:center;color:#64748b;margin-top:2rem;">
      VNEXSUS AI Claims System | Cycle 5 Post-Processing | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, 'cycle5_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`\nHTML Report: ${reportPath}`);
}

// 메인 실행
async function main() {
  console.log('='.repeat(70));
  console.log('CYCLE 5: POST-PROCESSING OPTIMIZATION');
  console.log('7-Phase filtering & scoring system');
  console.log('='.repeat(70));
  console.log(`Min Score: ${CONFIG.minScore}`);
  console.log(`Exclude Cases: ${CONFIG.excludeCases.join(', ')}`);
  console.log('');

  initDirectories();

  // Cycle 4 결과 로드
  if (!fs.existsSync(CONFIG.cycle4ResultsPath)) {
    console.log(`X Cycle 4 results not found: ${CONFIG.cycle4ResultsPath}`);
    return;
  }

  const cycle4Data = JSON.parse(fs.readFileSync(CONFIG.cycle4ResultsPath, 'utf-8'));
  const cycle4Summary = cycle4Data.summary;

  console.log('Cycle 4 Summary:');
  console.log(`  GT Coverage: ${cycle4Summary.overallGtCoverageRate}%`);
  console.log(`  AI Extracted: ${cycle4Summary.totalAiDates} dates`);
  console.log(`  Matched: ${cycle4Summary.totalMatched}/${cycle4Summary.totalGtDates}`);
  console.log(`  Precision: ${Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}%`);
  console.log('');

  // 케이스 처리
  const results = [];
  for (const caseData of cycle4Data.results) {
    if (CONFIG.excludeCases.includes(caseData.caseNum)) {
      console.log(`\nSkipping Case${caseData.caseNum}: Excluded`);
      continue;
    }

    if (!caseData.matching) {
      console.log(`\nSkipping Case${caseData.caseNum}: No matching data`);
      continue;
    }

    try {
      const result = processCase(caseData);
      results.push(result);
    } catch (error) {
      console.log(`\nCase${caseData.caseNum} failed: ${error.message}`);
      results.push({ caseId: `Case${caseData.caseNum}`, error: error.message });
    }
  }

  // Summary
  const validResults = results.filter(r => r.matching);

  const summary = {
    totalCases: results.length,
    validCases: validResults.length,
    approach: 'post-processing',

    totalGtDates: validResults.reduce((sum, r) => sum + r.matching.gtCount, 0),
    totalMatched: validResults.reduce((sum, r) => sum + r.matching.matchedCount, 0),
    totalMissed: validResults.reduce((sum, r) => sum + r.matching.missedCount, 0),
    totalAiDates: validResults.reduce((sum, r) => sum + r.matching.aiCount, 0),
    totalExtra: validResults.reduce((sum, r) => sum + r.matching.extraCount, 0),

    overallGtCoverageRate: 0,
    overallPrecision: 0
  };

  summary.overallGtCoverageRate = summary.totalGtDates > 0
    ? Math.round((summary.totalMatched / summary.totalGtDates) * 100)
    : 0;

  summary.overallPrecision = summary.totalAiDates > 0
    ? Math.round((summary.totalMatched / summary.totalAiDates) * 100)
    : 0;

  // Save results
  const outputPath = path.join(CONFIG.outputDir, 'cycle5_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results, cycle4Summary }, null, 2), 'utf-8');

  // Generate report
  generateReport(summary, results, cycle4Summary);

  // Console output
  console.log('\n' + '='.repeat(70));
  console.log('CYCLE 5 POST-PROCESSING COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total cases: ${summary.totalCases}`);
  console.log(`Valid cases: ${summary.validCases}`);
  console.log('');
  console.log('=== COMPARISON: Cycle 4 vs Cycle 5 ===');
  console.log(`GT Coverage: ${cycle4Summary.overallGtCoverageRate}% -> ${summary.overallGtCoverageRate}% (${summary.overallGtCoverageRate >= cycle4Summary.overallGtCoverageRate ? '+' : ''}${summary.overallGtCoverageRate - cycle4Summary.overallGtCoverageRate}%p)`);
  console.log(`Precision: ${Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}% -> ${summary.overallPrecision}% (+${summary.overallPrecision - Math.round((cycle4Summary.totalMatched / cycle4Summary.totalAiDates) * 100)}%p)`);
  console.log(`AI Extracted: ${cycle4Summary.totalAiDates} -> ${summary.totalAiDates} dates`);
  console.log(`Noise: ${cycle4Summary.totalExtra} -> ${summary.totalExtra} dates (${Math.round(((cycle4Summary.totalExtra - summary.totalExtra) / cycle4Summary.totalExtra) * 100)}% reduction)`);
  console.log('');
  console.log(`Results saved: ${outputPath}`);
}

main().catch(console.error);
