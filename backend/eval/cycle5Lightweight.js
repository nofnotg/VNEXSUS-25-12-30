/**
 * Cycle 5 Lightweight: 3-Phase Post-Processing
 *
 * 목표: Cycle 4 과추출 데이터에 경량 후처리 적용
 * - 기존 7-Phase → 3-Phase로 축소
 * - Phase 1: 보험 만기일 제거
 * - Phase 2: 타임스탬프 정규화
 * - Phase 3: 중요도 기반 정렬
 *
 * 실행: node backend/eval/cycle5Lightweight.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  // Cycle 4 캐시 경로
  cycle4CacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  cycle4ResultsPath: path.join(__dirname, 'output/cycle4_topdown/cycle4_topdown_results.json'),

  // Cycle 5 Lightweight 출력 경로
  outputDir: path.join(__dirname, 'output/cycle5_lightweight'),
  reportsDir: path.join(__dirname, 'output/cycle5_lightweight/reports'),

  // Ground Truth
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',

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

// 날짜 정규화
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DDThh:mm:ss → YYYY-MM-DD
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }

  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  return dateStr;
}

// Cycle 4 결과에서 날짜 수집
function collectCycle4Dates(generatedJson) {
  const allDates = [];

  // allExtractedDates
  if (generatedJson.allExtractedDates) {
    generatedJson.allExtractedDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: normalized,
          type: item.type || 'other',
          context: item.context || '',
          importance: item.importance || 'medium',
          confidence: item.confidence || 'medium'
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
          type: item.type ? `${item.type}_시작일` : '기간_시작일',
          context: item.context || '',
          importance: item.importance || 'high'
        });
      }

      if (endNormalized && endNormalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.push({
          date: endNormalized,
          type: item.type ? `${item.type}_종료일` : '기간_종료일',
          context: item.context || '',
          importance: item.importance || 'low'
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
          type: item.type || '보험',
          context: item.context || item.company || '',
          importance: item.importance || 'high'
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
          type: item.tableType || '표',
          context: item.rowContent || '',
          importance: item.importance || 'high'
        });
      }
    });
  }

  return allDates;
}

/**
 * 3-Phase 경량 후처리
 *
 * @param {Array} cycle4Dates - Cycle 4에서 추출된 날짜 배열
 * @returns {object} { processed: Array, stats: object }
 */
function lightweightPostProcessing(cycle4Dates) {
  const stats = {
    phase1Removed: 0,
    phase2Normalized: 0,
    phase3Sorted: 0
  };

  // Phase 1: 보험 만기일 제거
  const phase1 = cycle4Dates.filter(d => {
    // 종료일이면서 보험 컨텍스트인 경우 제거
    const isEndDate = d.type && (d.type.includes('종료일') || d.type.includes('만기일'));
    const isInsuranceContext = d.context && /보험|보장/.test(d.context);

    if (isEndDate && isInsuranceContext) {
      stats.phase1Removed++;
      return false;  // 제거
    }

    return true;  // 유지
  });

  console.log(`    Phase 1: ${cycle4Dates.length} → ${phase1.length} dates (만기일 ${stats.phase1Removed}개 제거)`);

  // Phase 2: 타임스탬프 정규화
  const phase2 = phase1.map(d => {
    const normalized = normalizeDate(d.date);
    if (normalized !== d.date) {
      stats.phase2Normalized++;
    }

    return {
      ...d,
      date: normalized || d.date  // 정규화 실패 시 원본 유지
    };
  });

  console.log(`    Phase 2: ${stats.phase2Normalized}개 날짜 정규화 (타임스탬프 제거)`);

  // Phase 3: 컨텍스트 기반 중요도 정렬
  const importanceOrder = { critical: 3, high: 2, medium: 1, low: 0 };

  const phase3 = phase2.sort((a, b) => {
    const aImportance = importanceOrder[a.importance] || 1;
    const bImportance = importanceOrder[b.importance] || 1;

    return bImportance - aImportance;  // 중요도 높은 순
  });

  stats.phase3Sorted = phase3.length;
  console.log(`    Phase 3: ${stats.phase3Sorted}개 날짜 중요도순 정렬`);

  return { processed: phase3, stats };
}

// 매칭 분석
function analyzeMatching(aiDates, gtDates) {
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
async function processCase(caseNum, cycle4Result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] ${cycle4Result.patientName} - Lightweight Post-Processing`);
  console.log(`${'='.repeat(60)}`);

  // Cycle 4 날짜 수집
  const cycle4Dates = collectCycle4Dates(cycle4Result.generatedJson);
  console.log(`  Cycle 4 extracted: ${cycle4Dates.length} dates`);

  // 3-Phase 경량 후처리
  const { processed, stats } = lightweightPostProcessing(cycle4Dates);

  // Ground Truth 비교
  const groundTruth = loadGroundTruth(caseNum);
  const gtDates = groundTruth ? extractGroundTruthDates(groundTruth) : [];

  const aiDatesUnique = [...new Set(processed.map(d => d.date))].sort();
  const matching = analyzeMatching(aiDatesUnique, gtDates);

  console.log(`  GT Coverage: ${matching.gtCoverageRate}% (${matching.matchedCount}/${matching.gtCount})`);
  console.log(`  Precision: ${matching.precision}% (${matching.matchedCount}/${matching.aiCount})`);
  console.log(`  Extra (noise): ${matching.extraCount} dates`);

  return {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: cycle4Result.patientName,
    cycle4Extracted: cycle4Dates.length,
    lightweightProcessed: processed.length,
    stats,
    matching,
    processedAt: new Date().toISOString()
  };
}

// HTML 보고서 생성
function generateReport(summary, results, cycle4Summary) {
  const validResults = results.filter(r => r.matching);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Cycle 5 Lightweight (3-Phase) Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f7fa; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    h2 { color: #2d3748; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }

    .approach-box { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; }
    .approach-box h3 { margin-bottom: 0.5rem; }

    .summary-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; font-size: 0.85rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }

    table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 1rem 0; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }

    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cycle 5: Lightweight (3-Phase) Report</h1>
    <p class="subtitle">Simplified post-processing | ${new Date().toLocaleString('ko-KR')}</p>

    <div class="approach-box">
      <h3>3-Phase Lightweight Approach</h3>
      <p><strong>Phase 1:</strong> Remove insurance end dates (만기일 제거)</p>
      <p><strong>Phase 2:</strong> Normalize timestamps (타임스탬프 정규화)</p>
      <p><strong>Phase 3:</strong> Sort by importance (중요도 정렬)</p>
    </div>

    <h2>Summary</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 70 ? 'success' : 'warning'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">GT Coverage</div>
      </div>
      <div class="card">
        <div class="value">${summary.avgPrecision}%</div>
        <div class="label">Avg Precision</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">Matched/GT</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI Extracted</div>
      </div>
      <div class="card">
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
          <th>Cycle 4 Extracted</th>
          <th>After Lightweight</th>
          <th>GT Coverage</th>
          <th>Precision</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.map(r => `
        <tr>
          <td><strong>${r.caseId}</strong></td>
          <td>${r.patientName || '-'}</td>
          <td>${r.cycle4Extracted}</td>
          <td>${r.lightweightProcessed}</td>
          <td>
            <span class="badge ${r.matching.gtCoverageRate >= 70 ? 'badge-success' : r.matching.gtCoverageRate >= 50 ? 'badge-warning' : 'badge-danger'}">
              ${r.matching.gtCoverageRate}%
            </span>
          </td>
          <td>
            <span class="badge ${r.matching.precision >= 50 ? 'badge-success' : 'badge-warning'}">
              ${r.matching.precision}%
            </span>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <p style="text-align:center;color:#64748b;margin-top:2rem;">
      VNEXSUS AI Claims System | Cycle 5 Lightweight | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, 'cycle5_lightweight_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`\nHTML Report: ${reportPath}`);
}

// 메인 실행
async function main() {
  console.log('='.repeat(70));
  console.log('CYCLE 5: LIGHTWEIGHT (3-PHASE) POST-PROCESSING');
  console.log('='.repeat(70));
  console.log('Phase 1: Remove insurance end dates');
  console.log('Phase 2: Normalize timestamps');
  console.log('Phase 3: Sort by importance');
  console.log('');

  initDirectories();

  // Cycle 4 결과 로드
  const cycle4Data = JSON.parse(fs.readFileSync(CONFIG.cycle4ResultsPath, 'utf-8'));
  const cycle4Results = cycle4Data.results;

  console.log(`Cycle 4 Summary:`);
  console.log(`  GT Coverage: ${cycle4Data.summary.overallGtCoverageRate}%`);
  console.log(`  AI Extracted: ${cycle4Data.summary.totalAiDates} dates`);
  console.log('');

  const results = [];

  for (const cycle4Result of cycle4Results) {
    if (CONFIG.excludeCases.includes(cycle4Result.caseNum)) {
      console.log(`\nSkipping Case${cycle4Result.caseNum}: Excluded`);
      continue;
    }

    if (!cycle4Result.matching) {
      console.log(`\nSkipping ${cycle4Result.caseId}: No matching data`);
      continue;
    }

    try {
      const result = await processCase(cycle4Result.caseNum, cycle4Result);
      results.push(result);
    } catch (error) {
      console.log(`\n${cycle4Result.caseId} failed: ${error.message}`);
      results.push({ caseId: cycle4Result.caseId, error: error.message });
    }
  }

  // Summary
  const validResults = results.filter(r => r.matching);

  const summary = {
    totalCases: results.length,
    validCases: validResults.length,
    approach: 'lightweight-3phase',

    avgGtCoverageRate: validResults.length > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.matching.gtCoverageRate, 0) / validResults.length)
      : 0,

    avgPrecision: validResults.length > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.matching.precision, 0) / validResults.length)
      : 0,

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
  const outputPath = path.join(CONFIG.outputDir, 'cycle5_lightweight_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');

  // Generate report
  generateReport(summary, results, cycle4Data.summary);

  // Console output
  console.log('\n' + '='.repeat(70));
  console.log('CYCLE 5 LIGHTWEIGHT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total cases: ${summary.totalCases}`);
  console.log(`Valid cases: ${summary.validCases}`);
  console.log('');
  console.log('=== COMPARISON: Cycle 4 vs Cycle 5 Lightweight ===');
  console.log(`GT Coverage: ${cycle4Data.summary.overallGtCoverageRate}% -> ${summary.overallGtCoverageRate}% (${summary.overallGtCoverageRate > cycle4Data.summary.overallGtCoverageRate ? '+' : ''}${summary.overallGtCoverageRate - cycle4Data.summary.overallGtCoverageRate}%p)`);
  console.log(`Precision: N/A -> ${summary.overallPrecision}%`);
  console.log(`Matched: ${cycle4Data.summary.totalMatched}/${cycle4Data.summary.totalGtDates} -> ${summary.totalMatched}/${summary.totalGtDates}`);
  console.log(`AI Extracted: ${cycle4Data.summary.totalAiDates} -> ${summary.totalAiDates}`);
  console.log(`Extra (Noise): ${cycle4Data.summary.totalExtra} -> ${summary.totalExtra}`);
  console.log('');
  console.log(`Results saved: ${outputPath}`);
}

main().catch(console.error);
