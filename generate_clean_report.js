import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VECTOR_DATA_PATH = path.join(process.cwd(), 'vector_data.json');
const REPORT_PATH = path.join(process.cwd(), 'Final_Verification_Report.html');

function generateCleanReport() {
    console.log('🧹 Cleaning up vector data and generating report...');

    if (!fs.existsSync(VECTOR_DATA_PATH)) {
        console.error('❌ vector_data.json not found.');
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(VECTOR_DATA_PATH, 'utf8'));

    // Deduplicate: Keep the LAST entry for each ID
    const uniqueDataMap = new Map();
    rawData.forEach(item => {
        uniqueDataMap.set(item.id, item);
    });

    const results = Array.from(uniqueDataMap.values());

    // Sort naturally: Case1, Case2, ..., Case10
    results.sort((a, b) => {
        const numA = parseInt(a.id.match(/\d+/)[0]);
        const numB = parseInt(b.id.match(/\d+/)[0]);
        if (numA !== numB) return numA - numB;
        return a.id.localeCompare(b.id);
    });

    console.log(`✅ Deduplicated to ${results.length} unique cases.`);

    // Generate HTML
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS Final Verification Report</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 20px; background: #f4f6f9; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 15px; margin-bottom: 30px; }
    h2 { color: #34495e; margin-top: 40px; margin-bottom: 15px; border-left: 5px solid #3498db; padding-left: 10px; }
    
    /* Summary Cards */
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .card { background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #e1e4e8; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
    .card h3 { margin: 0 0 10px; color: #7f8c8d; font-size: 14px; text-transform: uppercase; }
    .card .value { font-size: 28px; font-weight: 700; color: #2c3e50; }
    .card.highlight .value { color: #3498db; }

    /* Main Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
    th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr:hover { background: #f8f9fa; }
    
    /* Status Badges */
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-review { background: #fff3e0; color: #ef6c00; }
    .badge-fail { background: #ffebee; color: #c62828; }

    /* Vector Badges */
    .vec-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; color: white; }
    .vec-violation { background-color: #e74c3c; }
    .vec-payment { background-color: #27ae60; }
    .vec-exemption { background-color: #f39c12; }
    .vec-general { background-color: #95a5a6; }

    /* Details Section */
    details { margin-bottom: 10px; background: #fff; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
    summary { padding: 15px; cursor: pointer; background: #fcfcfc; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
    summary:hover { background: #f5f5f5; }
    .details-content { padding: 20px; border-top: 1px solid #eee; background: #fff; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .metric-box { background: #f8f9fa; padding: 15px; border-radius: 6px; }
    .metric-label { font-size: 12px; color: #777; margin-bottom: 5px; }
    .metric-val { font-size: 16px; font-weight: 600; }

    /* Progress Bar */
    .progress-bar { background: #eee; height: 8px; border-radius: 4px; overflow: hidden; width: 100px; display: inline-block; vertical-align: middle; margin-right: 10px; }
    .progress-fill { height: 100%; background: #3498db; }
    .score-text { font-weight: bold; font-size: 12px; }

  </style>
</head>
<body>
  <div class="container">
    <h1>VNEXSUS Final Verification Report</h1>
    
    <div class="summary-grid">
      <div class="card">
        <h3>Total Cases</h3>
        <div class="value">${results.length}</div>
      </div>
      <div class="card highlight">
        <h3>Avg Inclusion Score</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.inclusionScore || 0), 0) / results.length)}%</div>
      </div>
      <div class="card">
        <h3>Avg Date Accuracy</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.dateAccuracy || 0), 0) / results.length)}%</div>
      </div>
      <div class="card">
        <h3>Avg Noise Score</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.noiseScore || 0), 0) / results.length)}</div>
      </div>
    </div>

    <h2>1. Summary Table</h2>
    <table>
      <thead>
        <tr>
          <th>Case ID</th>
          <th>Status</th>
          <th>Inclusion (Superset)</th>
          <th>Date Accuracy</th>
          <th>Noise Score</th>
          <th>Vector Type</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => {
        const statusClass = r.status === 'PASS' ? 'badge-pass' : (r.status === 'REVIEW' ? 'badge-review' : 'badge-fail');
        const vectorType = r.type || r.vector?.vectorType || 'UNKNOWN';
        const vectorClass = vectorType === 'VIOLATION_RISK' ? 'vec-violation' :
            (vectorType === 'PAYMENT_TARGET' ? 'vec-payment' :
                (vectorType === 'EXEMPTION_TARGET' ? 'vec-exemption' : 'vec-general'));

        const x = r.x !== undefined ? r.x : r.vector?.x;
        const y = r.y !== undefined ? r.y : r.vector?.y;
        const z = r.z !== undefined ? r.z : r.vector?.z;

        return `
            <tr>
              <td><strong>${r.id}</strong></td>
              <td><span class="badge ${statusClass}">${r.status || 'PASS'}</span></td>
              <td>
                <div class="progress-bar"><div class="progress-fill" style="width: ${r.inclusionScore || 0}%"></div></div>
                <span class="score-text">${r.inclusionScore || 0}%</span>
              </td>
              <td>${r.dateAccuracy || 0}%</td>
              <td>${r.noiseScore || 0}</td>
              <td><span class="vec-badge ${vectorClass}">${vectorType}</span></td>
            </tr>
          `;
    }).join('')}
      </tbody>
    </table>

    <h2>2. Detailed Analysis per Case</h2>
    <p style="color: #666; margin-bottom: 20px;">Click on a case to view detailed metrics and vector analysis.</p>
    
    ${results.map(r => {
        const x = r.x !== undefined ? r.x : r.vector?.x;
        const y = r.y !== undefined ? r.y : r.vector?.y;
        const z = r.z !== undefined ? r.z : r.vector?.z;
        const vectorType = r.type || r.vector?.vectorType || 'UNKNOWN';

        return `
      <details>
        <summary>
          <span>📂 <strong>${r.id}</strong> Analysis</span>
          <span style="font-size: 12px; color: #888;">Inclusion: ${r.inclusionScore || 0}% | Vector: [${x}, ${y}, ${z}]</span>
        </summary>
        <div class="details-content">
          <div class="details-grid">
            <div>
              <h4>📊 Verification Metrics</h4>
              <div class="metric-box">
                <div class="metric-label">Inclusion Score (Superset Coverage)</div>
                <div class="metric-val" style="color: ${r.inclusionScore === 100 ? '#27ae60' : '#e74c3c'}">${r.inclusionScore || 0}%</div>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">Percentage of generated facts found in the source Superset.</p>
              </div>
              <div class="metric-box" style="margin-top: 10px;">
                <div class="metric-label">Date Accuracy</div>
                <div class="metric-val">${r.dateAccuracy || 0}%</div>
              </div>
            </div>
            <div>
              <h4>📐 3D Vector Analysis</h4>
              <div class="metric-box">
                <div class="metric-label">Vector Coordinates (X, Y, Z)</div>
                <div class="metric-val">[${x}, ${y}, ${z}]</div>
              </div>
              <div class="metric-box" style="margin-top: 10px;">
                <div class="metric-label">Classification</div>
                <div class="metric-val">${vectorType}</div>
              </div>
            </div>
          </div>
        </div>
      </details>
    `;
    }).join('')}

  </div>
</body>
</html>`;

    fs.writeFileSync(REPORT_PATH, html);
    console.log(`✨ Clean report generated at: ${REPORT_PATH}`);

    // Optional: Save deduplicated data back
    fs.writeFileSync(VECTOR_DATA_PATH, JSON.stringify(results, null, 2));
    console.log('💾 Deduplicated vector_data.json saved.');
}

generateCleanReport();
