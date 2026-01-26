/**
 * Enhanced Cycle 2 Report Generator with Reusable Data Structure
 *
 * Features:
 * - Comprehensive data analysis
 * - Reusable structured data export
 * - Detailed HTML report with interactive elements
 * - Case-by-case breakdown
 * - Date extraction analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CYCLE2_DIR = path.join(__dirname, 'output/improved_validation_cycle2');
const RESULTS_PATH = path.join(CYCLE2_DIR, 'improved_validation_results.json');
const CACHE_DIR = path.join(CYCLE2_DIR, 'ocr_cache');
const OUTPUT_DIR = path.join(__dirname, 'output/enhanced_cycle2_analysis');
const REPORT_PATH = path.join(OUTPUT_DIR, 'cycle2_comprehensive_report.html');
const STRUCTURED_DATA_PATH = path.join(OUTPUT_DIR, 'cycle2_structured_data.json');

// Initialize output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load Cycle 2 results
function loadCycle2Results() {
  if (!fs.existsSync(RESULTS_PATH)) {
    throw new Error(`Cycle 2 results not found: ${RESULTS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
}

// Load cached case data
function loadCachedCaseData(caseNum) {
  const cachePath = path.join(CACHE_DIR, `case_${caseNum}_improved.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }
  return null;
}

// Analyze date extraction patterns
function analyzeDatePatterns(results) {
  const patterns = {
    dateTypes: {},
    contexts: [],
    coverage: []
  };

  results.forEach(result => {
    if (!result.generatedJson || !result.matching) return;

    // Analyze date types
    if (result.generatedJson.allDates) {
      result.generatedJson.allDates.forEach(dateItem => {
        const type = dateItem.type || '기타';
        patterns.dateTypes[type] = (patterns.dateTypes[type] || 0) + 1;

        if (dateItem.context) {
          patterns.contexts.push({
            caseId: result.caseId,
            date: dateItem.date,
            context: dateItem.context,
            type
          });
        }
      });
    }

    // Coverage analysis
    patterns.coverage.push({
      caseId: result.caseId,
      patientName: result.patientName,
      gtCoverageRate: result.matching.gtCoverageRate,
      matchedCount: result.matching.matchedCount,
      missedCount: result.matching.missedCount,
      extraCount: result.matching.extraCount
    });
  });

  return patterns;
}

// Generate structured reusable data
function generateStructuredData(cycle2Data) {
  const structured = {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'Cycle 2 Improved Validation',
      model: 'gpt-4o-mini',
      totalCases: cycle2Data.summary.validCases,
      dateFormat: 'YYYY-MM-DD'
    },
    summary: cycle2Data.summary,
    cases: {},
    aggregated: {
      allDates: [],
      datesByType: {},
      datesByCase: {},
      coverageAnalysis: {}
    }
  };

  // Process each case
  cycle2Data.results.forEach(result => {
    if (!result.matching) return;

    const caseNum = result.caseNum;
    const caseData = loadCachedCaseData(caseNum);

    // Store case details
    structured.cases[result.caseId] = {
      caseNum,
      caseId: result.caseId,
      patientName: result.patientName,
      totalPages: result.totalPages,
      processedPages: result.processedPages,
      model: result.model,
      processedAt: result.processedAt,
      cost: result.cost,

      // Matching results
      matching: {
        gtCoverageRate: result.matching.gtCoverageRate,
        gtDates: result.matching.gtDates,
        aiDates: result.matching.aiDates,
        matched: result.matching.matched,
        missed: result.matching.missed,
        extra: result.matching.extra
      },

      // Extracted data
      extractedDates: result.generatedJson?.allDates || [],
      medicalEvents: result.generatedJson?.medicalEvents || [],
      diagnoses: result.generatedJson?.diagnoses || []
    };

    // Aggregate dates
    if (result.generatedJson?.allDates) {
      result.generatedJson.allDates.forEach(dateItem => {
        const type = dateItem.type || '기타';

        // Add to all dates
        structured.aggregated.allDates.push({
          ...dateItem,
          caseId: result.caseId,
          patientName: result.patientName
        });

        // Group by type
        if (!structured.aggregated.datesByType[type]) {
          structured.aggregated.datesByType[type] = [];
        }
        structured.aggregated.datesByType[type].push({
          caseId: result.caseId,
          date: dateItem.date,
          context: dateItem.context
        });

        // Group by case
        if (!structured.aggregated.datesByCase[result.caseId]) {
          structured.aggregated.datesByCase[result.caseId] = [];
        }
        structured.aggregated.datesByCase[result.caseId].push(dateItem);
      });
    }
  });

  // Coverage analysis
  structured.aggregated.coverageAnalysis = {
    avgCoverage: cycle2Data.summary.avgGtCoverageRate,
    overallCoverage: cycle2Data.summary.overallGtCoverageRate,
    totalMatched: cycle2Data.summary.totalMatched,
    totalMissed: cycle2Data.summary.totalMissed,
    totalGtDates: cycle2Data.summary.totalGtDates,
    totalAiDates: cycle2Data.summary.totalAiDates
  };

  return structured;
}

// Generate comprehensive HTML report
function generateHTMLReport(structuredData, patterns) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS Cycle 2 종합 분석 보고서</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Malgun Gothic', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      line-height: 1.6;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .header .subtitle { font-size: 1.1rem; opacity: 0.9; }

    .content { padding: 2rem; }

    h2 {
      color: #2d3748;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #667eea;
      font-size: 1.8rem;
    }

    h3 {
      color: #4a5568;
      margin: 1.5rem 0 1rem;
      font-size: 1.3rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }

    .metric-card {
      background: white;
      padding: 1.5rem;
      border-radius: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      border: 2px solid #e2e8f0;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    }

    .metric-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }

    .metric-card.success .value { color: #10b981; }
    .metric-card.warning .value { color: #f59e0b; }
    .metric-card.danger .value { color: #ef4444; }

    .metric-card .label {
      color: #64748b;
      font-size: 0.9rem;
      font-weight: 500;
    }

    table {
      width: 100%;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 1.5rem 0;
      border-collapse: collapse;
    }

    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }

    tr:hover {
      background: #f8fafc;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-block;
      padding: 0.4rem 0.8rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }

    .case-details {
      background: #f8fafc;
      padding: 1.5rem;
      border-radius: 12px;
      margin: 1rem 0;
      border-left: 4px solid #667eea;
    }

    .case-details h4 {
      color: #2d3748;
      margin-bottom: 1rem;
    }

    .date-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }

    .date-item {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      border-left: 3px solid #667eea;
      font-size: 0.9rem;
    }

    .date-item .date {
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }

    .date-item .type {
      color: #64748b;
      font-size: 0.85rem;
    }

    .date-item .context {
      color: #475569;
      margin-top: 0.5rem;
      font-size: 0.85rem;
      font-style: italic;
    }

    .chart-container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 1.5rem 0;
    }

    .footer {
      text-align: center;
      padding: 2rem;
      color: #64748b;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      margin-top: 2rem;
    }

    .analysis-section {
      background: #f0f9ff;
      padding: 1.5rem;
      border-radius: 12px;
      margin: 1.5rem 0;
      border-left: 4px solid #0ea5e9;
    }

    .analysis-section h4 {
      color: #0c4a6e;
      margin-bottom: 1rem;
    }

    .analysis-section ul {
      margin-left: 1.5rem;
    }

    .analysis-section li {
      margin: 0.5rem 0;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔬 VNEXSUS Cycle 2</h1>
      <h2 style="margin: 0.5rem 0;">종합 분석 보고서</h2>
      <div class="subtitle">
        GPT-4o-mini Vision LLM • 날짜 추출 검증 분석
        <br/>
        생성일시: ${new Date().toLocaleString('ko-KR')}
      </div>
    </div>

    <div class="content">
      <h2>📊 전체 요약</h2>

      <div class="summary-grid">
        <div class="metric-card ${structuredData.summary.overallGtCoverageRate >= 70 ? 'success' : structuredData.summary.overallGtCoverageRate >= 50 ? 'warning' : 'danger'}">
          <div class="value">${structuredData.summary.overallGtCoverageRate}%</div>
          <div class="label">GT Coverage</div>
        </div>

        <div class="metric-card">
          <div class="value">${structuredData.summary.validCases}</div>
          <div class="label">처리된 케이스</div>
        </div>

        <div class="metric-card success">
          <div class="value">${structuredData.summary.totalMatched}</div>
          <div class="label">매칭된 날짜</div>
        </div>

        <div class="metric-card danger">
          <div class="value">${structuredData.summary.totalMissed}</div>
          <div class="label">누락된 날짜</div>
        </div>

        <div class="metric-card info">
          <div class="value">${structuredData.summary.totalAiDates}</div>
          <div class="label">AI 추출 날짜</div>
        </div>

        <div class="metric-card">
          <div class="value">$${structuredData.summary.totalCost.toFixed(2)}</div>
          <div class="label">총 비용</div>
        </div>
      </div>

      <h2>📈 케이스별 상세 결과</h2>

      <table>
        <thead>
          <tr>
            <th>케이스</th>
            <th>환자명</th>
            <th>페이지</th>
            <th>GT Coverage</th>
            <th>매칭/GT/누락</th>
            <th>AI 추출</th>
            <th>비용</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(structuredData.cases).map(c => `
          <tr>
            <td><strong>${c.caseId}</strong></td>
            <td>${c.patientName || '-'}</td>
            <td>${c.processedPages}p</td>
            <td>
              <span class="badge ${c.matching.gtCoverageRate >= 70 ? 'badge-success' : c.matching.gtCoverageRate >= 50 ? 'badge-warning' : 'badge-danger'}">
                ${c.matching.gtCoverageRate}%
              </span>
            </td>
            <td>${c.matching.matched.length} / ${c.matching.gtDates.length} / ${c.matching.missed.length}</td>
            <td>${c.matching.aiDates.length}</td>
            <td>$${c.cost.toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>🎯 날짜 유형별 분석</h2>

      <div class="chart-container">
        <table>
          <thead>
            <tr>
              <th>날짜 유형</th>
              <th>추출 횟수</th>
              <th>비율</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(patterns.dateTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const total = Object.values(patterns.dateTypes).reduce((a, b) => a + b, 0);
              const percentage = ((count / total) * 100).toFixed(1);
              return `
              <tr>
                <td><span class="badge badge-info">${type}</span></td>
                <td><strong>${count}</strong></td>
                <td>${percentage}%</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <h2>🔍 케이스별 상세 분석</h2>

      ${Object.values(structuredData.cases).map(caseData => `
        <div class="case-details">
          <h4>${caseData.caseId}: ${caseData.patientName || '환자명 미상'}</h4>

          <div style="margin-bottom: 1rem;">
            <span class="badge badge-info">페이지: ${caseData.processedPages}</span>
            <span class="badge ${caseData.matching.gtCoverageRate >= 70 ? 'badge-success' : caseData.matching.gtCoverageRate >= 50 ? 'badge-warning' : 'badge-danger'}">
              GT Coverage: ${caseData.matching.gtCoverageRate}%
            </span>
            <span class="badge badge-info">AI 추출: ${caseData.matching.aiDates.length}개</span>
          </div>

          <h5 style="color: #2d3748; margin: 1rem 0 0.5rem;">✅ 매칭된 날짜 (${caseData.matching.matched.length}개)</h5>
          <div style="background: #ecfdf5; padding: 1rem; border-radius: 8px;">
            ${caseData.matching.matched.length > 0 ? caseData.matching.matched.join(', ') : '없음'}
          </div>

          ${caseData.matching.missed.length > 0 ? `
          <h5 style="color: #dc2626; margin: 1rem 0 0.5rem;">❌ 누락된 날짜 (${caseData.matching.missed.length}개)</h5>
          <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; color: #991b1b;">
            ${caseData.matching.missed.join(', ')}
          </div>
          ` : ''}

          <h5 style="color: #2d3748; margin: 1rem 0 0.5rem;">📋 추출된 날짜 상세 (${caseData.extractedDates.length}개)</h5>
          <div class="date-list">
            ${caseData.extractedDates.slice(0, 20).map(dateItem => `
              <div class="date-item">
                <div class="date">${dateItem.date}</div>
                <div class="type">${dateItem.type || '기타'}</div>
                ${dateItem.context ? `<div class="context">${dateItem.context.substring(0, 100)}...</div>` : ''}
              </div>
            `).join('')}
            ${caseData.extractedDates.length > 20 ? `<div style="padding: 1rem; color: #64748b;">... 외 ${caseData.extractedDates.length - 20}개</div>` : ''}
          </div>
        </div>
      `).join('')}

      <h2>💡 핵심 인사이트</h2>

      <div class="analysis-section">
        <h4>주요 발견사항</h4>
        <ul>
          <li><strong>전체 GT Coverage:</strong> ${structuredData.summary.overallGtCoverageRate}% (${structuredData.summary.totalMatched}/${structuredData.summary.totalGtDates})</li>
          <li><strong>평균 GT Coverage:</strong> ${structuredData.summary.avgGtCoverageRate}%</li>
          <li><strong>총 AI 추출 날짜:</strong> ${structuredData.summary.totalAiDates}개 (GT 대비 ${Math.round(structuredData.summary.totalAiDates / structuredData.summary.totalGtDates * 100)}%)</li>
          <li><strong>정밀도:</strong> ${Math.round(structuredData.summary.totalMatched / structuredData.summary.totalAiDates * 100)}% (매칭/추출)</li>
          <li><strong>재현율:</strong> ${structuredData.summary.overallGtCoverageRate}% (매칭/GT)</li>
        </ul>
      </div>

      <div class="analysis-section">
        <h4>개선 방향</h4>
        <ul>
          <li>누락된 날짜 ${structuredData.summary.totalMissed}개에 대한 원인 분석 필요</li>
          <li>가장 많이 추출된 날짜 유형: <strong>${Object.entries(patterns.dateTypes).sort((a, b) => b[1] - a[1])[0][0]}</strong> (${Object.entries(patterns.dateTypes).sort((a, b) => b[1] - a[1])[0][1]}회)</li>
          <li>Coverage가 낮은 케이스(< 50%) 집중 분석 권장</li>
          <li>과추출(Over-extraction) 접근법 고려하여 누락율 감소 시도</li>
        </ul>
      </div>

      <h2>📦 재사용 가능한 데이터</h2>

      <div class="analysis-section">
        <h4>구조화된 데이터 파일</h4>
        <p>모든 추출 결과와 분석 데이터가 JSON 형식으로 저장되었습니다:</p>
        <p><code>${STRUCTURED_DATA_PATH}</code></p>
        <br/>
        <p><strong>포함된 내용:</strong></p>
        <ul>
          <li>케이스별 상세 날짜 추출 결과</li>
          <li>매칭/누락/추가 날짜 목록</li>
          <li>날짜 유형별 집계 데이터</li>
          <li>케이스별 집계 데이터</li>
          <li>Coverage 분석 결과</li>
        </ul>
      </div>
    </div>

    <div class="footer">
      <p><strong>VNEXSUS AI 보험 청구 분석 시스템</strong></p>
      <p>Cycle 2 Improved Validation | GPT-4o-mini Vision LLM</p>
      <p>생성: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// Main execution
async function main() {
  console.log('='.repeat(70));
  console.log('ENHANCED CYCLE 2 REPORT GENERATOR');
  console.log('='.repeat(70));
  console.log('');

  // Load Cycle 2 results
  console.log('Loading Cycle 2 results...');
  const cycle2Data = loadCycle2Results();
  console.log(`  ✓ Loaded ${cycle2Data.summary.validCases} cases`);

  // Analyze patterns
  console.log('\nAnalyzing date extraction patterns...');
  const patterns = analyzeDatePatterns(cycle2Data.results);
  console.log(`  ✓ Found ${Object.keys(patterns.dateTypes).length} date types`);

  // Generate structured data
  console.log('\nGenerating structured reusable data...');
  const structuredData = generateStructuredData(cycle2Data);

  // Save structured data
  fs.writeFileSync(STRUCTURED_DATA_PATH, JSON.stringify(structuredData, null, 2), 'utf-8');
  console.log(`  ✓ Saved: ${STRUCTURED_DATA_PATH}`);

  // Generate HTML report
  console.log('\nGenerating comprehensive HTML report...');
  const html = generateHTMLReport(structuredData, patterns);
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
  console.log(`  ✓ Saved: ${REPORT_PATH}`);

  console.log('\n' + '='.repeat(70));
  console.log('REPORT GENERATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\nHTML Report: ${REPORT_PATH}`);
  console.log(`Structured Data: ${STRUCTURED_DATA_PATH}`);
  console.log('');
}

main().catch(console.error);
