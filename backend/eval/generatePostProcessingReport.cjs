const fs = require('fs');
const path = require('path');

// Load insights data
const insightsPath = path.join(__dirname, 'output/cycle4_postprocessing_insights/insights.json');
const insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cycle 4: Post-Processing Logic 개발 인사이트 리포트</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
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
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .header .subtitle {
      font-size: 1.1rem;
      opacity: 0.95;
    }
    .content {
      padding: 2rem;
    }

    .exec-summary {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 2rem;
      border-radius: 15px;
      margin-bottom: 2rem;
    }
    .exec-summary h2 {
      margin-bottom: 1rem;
      font-size: 1.8rem;
    }
    .exec-summary p {
      font-size: 1.1rem;
      line-height: 1.8;
      margin-bottom: 0.5rem;
    }

    .stats-grid {
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
      border-left: 4px solid #667eea;
    }
    .stat-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    .stat-card .label {
      color: #64748b;
      font-size: 0.9rem;
    }
    .stat-card.warning .value { color: #f59e0b; border-color: #f59e0b; }
    .stat-card.danger .value { color: #ef4444; border-color: #ef4444; }
    .stat-card.success .value { color: #10b981; border-color: #10b981; }

    h2 {
      color: #1e293b;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #e2e8f0;
      font-size: 1.8rem;
    }

    .recommendation {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border-left: 5px solid #cbd5e1;
    }
    .recommendation.priority-critical {
      border-left-color: #dc2626;
      background: #fef2f2;
    }
    .recommendation.priority-high {
      border-left-color: #ea580c;
      background: #fff7ed;
    }
    .recommendation.priority-medium {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }
    .recommendation.priority-low {
      border-left-color: #06b6d4;
      background: #ecfeff;
    }
    .recommendation.priority-implemented {
      border-left-color: #10b981;
      background: #f0fdf4;
    }

    .rec-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .rec-priority {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .rec-priority.critical { background: #dc2626; color: white; }
    .rec-priority.high { background: #ea580c; color: white; }
    .rec-priority.medium { background: #f59e0b; color: white; }
    .rec-priority.low { background: #06b6d4; color: white; }
    .rec-priority.implemented { background: #10b981; color: white; }

    .rec-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: #1e293b;
    }

    .rec-section {
      margin-bottom: 1rem;
    }
    .rec-section-title {
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.5rem;
    }
    .rec-section-content {
      color: #64748b;
      line-height: 1.7;
    }

    .code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1rem;
      border-radius: 8px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      white-space: pre-wrap;
      margin-top: 0.5rem;
      line-height: 1.5;
    }

    .pattern-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    .pattern-table th,
    .pattern-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .pattern-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    .pattern-table tr:hover {
      background: #f8fafc;
    }

    .examples {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      margin-top: 0.5rem;
    }
    .example-item {
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .example-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .example-date {
      font-weight: 600;
      color: #667eea;
    }
    .example-context {
      color: #64748b;
      font-size: 0.85rem;
      margin-top: 0.25rem;
      font-family: monospace;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-noise { background: #fee2e2; color: #991b1b; }
    .badge-valid { background: #d1fae5; color: #065f46; }

    .footer {
      text-align: center;
      padding: 2rem;
      color: #94a3b8;
      font-size: 0.9rem;
      background: #f8fafc;
    }

    .insight-highlight {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 12px;
      margin: 1.5rem 0;
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
    }
    .insight-highlight h3 {
      margin-bottom: 0.75rem;
      font-size: 1.3rem;
    }

    .duplicate-chart {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Cycle 4: Post-Processing Logic 개발 인사이트</h1>
      <p class="subtitle">Vision LLM 과추출 데이터 분석 및 후처리 로직 최적화 방향</p>
      <p class="subtitle">${new Date(insights.metadata.analysisDate).toLocaleString('ko-KR')}</p>
    </div>

    <div class="content">
      <div class="exec-summary">
        <h2>📊 Executive Summary</h2>
        <p><strong>분석 케이스:</strong> ${insights.summary.cases}개 (Case18 제외)</p>
        <p><strong>현재 성능:</strong> GT Coverage ${insights.summary.gtCoverage} | Precision ${insights.summary.precision} | Noise Rate ${insights.summary.noiseRate}</p>
        <p><strong>핵심 발견:</strong> VisionLLM이 ${insights.summary.rawExtractions}개의 날짜를 과추출했으며, 이 중 65.1%가 중복, 76.3%가 Noise입니다.</p>
        <p><strong>최적화 목표:</strong> 후처리 로직을 통해 Precision을 23.7% → 70-80%로 향상시키면서 GT Coverage ${insights.summary.gtCoverage} 유지</p>
      </div>

      <h2>📈 Current Performance Metrics</h2>
      <div class="stats-grid">
        <div class="stat-card warning">
          <div class="value">${insights.summary.gtCoverage}</div>
          <div class="label">GT Coverage</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${insights.summary.precision}</div>
          <div class="label">Precision</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${insights.summary.noiseRate}</div>
          <div class="label">Noise Rate</div>
        </div>
        <div class="stat-card success">
          <div class="value">${insights.summary.duplicateRate}</div>
          <div class="label">Duplicate Rate</div>
        </div>
        <div class="stat-card">
          <div class="value">${insights.summary.rawExtractions}</div>
          <div class="label">Raw Extractions</div>
        </div>
        <div class="stat-card">
          <div class="value">${insights.summary.uniqueDates}</div>
          <div class="label">Unique Dates</div>
        </div>
        <div class="stat-card success">
          <div class="value">${insights.summary.matched}</div>
          <div class="label">Matched with GT</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${insights.summary.missed}</div>
          <div class="label">Missed GT Dates</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${insights.summary.extra}</div>
          <div class="label">Extra (Noise)</div>
        </div>
      </div>

      <div class="insight-highlight">
        <h3>💡 Key Insight: 과추출 전략의 효과</h3>
        <p>VisionLLM이 507개의 날짜를 과추출했지만, 중복 제거만으로도 177개(65% 감소)로 줄어듭니다. 추가로 타입 기반 필터링, 컨텍스트 분석, 날짜 범위 검증을 적용하면 Precision을 70-80%까지 끌어올릴 수 있습니다.</p>
      </div>

      <h2>🎯 Post-Processing 최적화 방향 (우선순위별)</h2>

${insights.postProcessingRecommendations.map((rec, idx) => {
  const priorityClass = rec.priority.toLowerCase().replace('/', '-');
  return `
      <div class="recommendation priority-${priorityClass}">
        <div class="rec-header">
          <span class="rec-priority ${priorityClass}">${rec.priority}</span>
          <span class="rec-title">${rec.category}</span>
        </div>

        ${rec.status ? `
        <div class="rec-section">
          <div class="rec-section-title">Status</div>
          <div class="rec-section-content">${rec.status}</div>
        </div>
        ` : ''}

        <div class="rec-section">
          <div class="rec-section-title">Finding</div>
          <div class="rec-section-content">${rec.finding}</div>
        </div>

        ${rec.impact ? `
        <div class="rec-section">
          <div class="rec-section-title">Impact</div>
          <div class="rec-section-content">${rec.impact}</div>
        </div>
        ` : ''}

        ${rec.recommendation ? `
        <div class="rec-section">
          <div class="rec-section-title">Recommendation</div>
          <div class="rec-section-content">${rec.recommendation.split('\n').map(line =>
            line.trim() ? `<p style="margin-bottom:0.5rem;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''
          ).join('')}</div>
        </div>
        ` : ''}

        ${rec.implementation ? `
        <div class="rec-section">
          <div class="rec-section-title">Implementation</div>
          <div class="code-block">${rec.implementation}</div>
        </div>
        ` : ''}

        ${rec.examples && rec.examples.length > 0 ? `
        <div class="rec-section">
          <div class="rec-section-title">Examples (${rec.examples.length} shown)</div>
          <div class="examples">
            ${rec.examples.slice(0, 5).map(ex => `
            <div class="example-item">
              <div>
                <span class="example-date">${ex.date}</span>
                ${ex.isNoise !== undefined ?
                  `<span class="badge ${ex.isNoise ? 'badge-noise' : 'badge-valid'}">${ex.isNoise ? 'NOISE' : 'VALID'}</span>`
                  : ''}
                ${ex.caseId ? `<span style="color:#94a3b8;font-size:0.85rem;margin-left:0.5rem;">[${ex.caseId}]</span>` : ''}
              </div>
              ${ex.context ? `<div class="example-context">"${ex.context}"</div>` : ''}
            </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
  `;
}).join('')}

      <h2>🔍 Pattern Analysis Details</h2>

      <div class="duplicate-chart">
        <h3 style="margin-bottom:1rem;color:#1e293b;">Duplicate Analysis by Case</h3>
        <table class="pattern-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Raw Count</th>
              <th>Unique Count</th>
              <th>Duplicates</th>
              <th>Duplicate Rate</th>
            </tr>
          </thead>
          <tbody>
            ${insights.insights.duplicateAnalysis.caseBreakdown.map(c => `
            <tr>
              <td><strong>${c.caseId}</strong></td>
              <td>${c.rawCount}</td>
              <td>${c.uniqueCount}</td>
              <td>${c.duplicates}</td>
              <td><strong>${c.duplicateRate}</strong></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="duplicate-chart">
        <h3 style="margin-bottom:1rem;color:#1e293b;">Top Noise Types</h3>
        <table class="pattern-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Count</th>
              <th>Percentage of Total Noise</th>
            </tr>
          </thead>
          <tbody>
            ${insights.insights.noiseCharacteristics.topNoiseTypes.slice(0, 10).map(t => `
            <tr>
              <td><strong>${t.type}</strong></td>
              <td>${t.count}</td>
              <td><strong>${t.percentage}</strong></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h2>🎬 Next Steps</h2>
      <div style="background:#f8fafc;padding:1.5rem;border-radius:12px;margin:1rem 0;">
        <ol style="margin-left:1.5rem;color:#475569;line-height:2;">
          <li><strong>Phase 1 (CRITICAL):</strong> 날짜 범위 검증 (2000-2030) 적용하여 명백한 오류 제거</li>
          <li><strong>Phase 2 (HIGH):</strong> 타입 기반 relevance scoring 시스템 구현</li>
          <li><strong>Phase 3 (HIGH):</strong> 문서 메타데이터 날짜 필터링 (발급일, 출력일, 서류작성일)</li>
          <li><strong>Phase 4 (MEDIUM):</strong> 타임스탬프 및 비교 컨텍스트 분석 로직 추가</li>
          <li><strong>Phase 5 (HIGH):</strong> 종합 relevance scoring 시스템 구현 (다중 요인 조합)</li>
          <li><strong>Phase 6 (LOW):</strong> Coverage 개선을 위한 VisionLLM 프롬프트 엔지니어링</li>
        </ol>
      </div>

    </div>

    <div class="footer">
      <p><strong>VNEXSUS AI Claims System</strong></p>
      <p>Cycle 4 Top-Down Post-Processing Analysis</p>
      <p>${new Date().toISOString()}</p>
      <p style="margin-top:1rem;color:#cbd5e1;">Generated by analyzeCycle4PostProcessingInsights.cjs</p>
    </div>
  </div>
</body>
</html>`;

// Save HTML report
const outputPath = path.join(__dirname, 'output/cycle4_postprocessing_insights/report.html');
fs.writeFileSync(outputPath, html, 'utf8');

console.log(`\n✓ HTML report generated: ${outputPath}\n`);
