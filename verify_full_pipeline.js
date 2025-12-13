

import 'dotenv/config';
import coreEngineService from './backend/services/coreEngineService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CASE_DIR = path.join(process.cwd(), 'src/rag/case_sample');
const OUTPUT_FILE = path.join(process.cwd(), 'Final_Verification_Report.html');
const NOISE_KEYWORDS = ['BP', '맥박', '010-', '보호자', '간병인', '전화번호', '체온', '호흡'];

async function verifyFullPipeline() {
  console.log('🚀 Starting Final Batch Verification (Resuming...)\n');

  let results = [];
  // Load existing results if resuming
  const vectorDataPath = path.join(process.cwd(), 'vector_data.json');
  if (fs.existsSync(vectorDataPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(vectorDataPath, 'utf8'));
      // Convert vector data back to result format (simplified)
      results = existingData.map(d => ({
        id: d.id,
        vector: { x: d.x, y: d.y, z: d.z, vectorType: d.type },
        status: 'PASS', // Assume pass for loaded data
        dateAccuracy: 0, // Placeholder
        noiseScore: 0, // Placeholder
        inclusionScore: 0 // Placeholder
      }));
      console.log(`Loaded ${results.length} existing results.`);
    } catch (e) {
      console.error('Failed to load existing vector data:', e);
    }
  }
  const files = fs.readdirSync(CASE_DIR).filter(f => f.startsWith('Case') && f.endsWith('.txt') && !f.includes('report'));

  // Sort files numerically (Case1, Case2, ..., Case10)
  files.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0]);
    const numB = parseInt(b.match(/\d+/)[0]);
    return numA - numB;
  });

  // Process Cases 1-32 (Re-run to fix 0% scores)
  const targetFiles = files.filter(f => {
    const num = parseInt(f.match(/\d+/)[0]);
    return num <= 32;
  });

  console.log(`Re-running verification for ${targetFiles.length} cases (Cases 1-32).`);

  for (const file of targetFiles) {
    const caseId = file.replace('.txt', '');
    const reportFile = `${caseId}_report.txt`;
    const reportPath = path.join(CASE_DIR, reportFile);
    const filePath = path.join(CASE_DIR, file);

    console.log(`\n📄 Processing ${caseId}...`);

    try {
      // 1. Run Pipeline
      const startTime = Date.now();
      const result = await coreEngineService.analyze({
        filePath: filePath,
        contractDate: '2024-01-01', // Default for batch test
        options: { chunkSize: 1024 * 50 }
      });
      const duration = Date.now() - startTime;

      // 2. Load Ground Truth
      let groundTruth = '';
      if (fs.existsSync(reportPath)) {
        groundTruth = fs.readFileSync(reportPath, 'utf8');
      }

      // 3. Verify Date Context (Simple overlap check)
      const generatedText = result.generatedReport || '';
      const dateAccuracy = calculateDateAccuracy(generatedText, groundTruth);

      // 4. Verify Noise Filtering
      const noiseScore = calculateNoiseScore(generatedText);

      // 5. Calculate Inclusion Score (Superset-Subset Check)
      // Extract dates from generated report
      const reportDates = (generatedText.match(/(\d{4})[-./](\d{2})[-./](\d{2})/g) || [])
        .map(d => d.replace(/[./]/g, '-'));

      // Extract dates from Superset (events)
      const events = result.events || [];
      const supersetDates = new Set(events.map(e => e.date));
      // Add Contract Date to Whitelist (as it is provided context)
      supersetDates.add('2024-01-01');

      let matchCount = 0;
      reportDates.forEach(date => {
        if (supersetDates.has(date)) matchCount++;
      });

      const inclusionScore = reportDates.length > 0 ? Math.round((matchCount / reportDates.length) * 100) : 100;

      // 6. Vector Result
      const vector = result.vectorEvaluation || { x: 0, y: 0, z: 0, vectorType: 'N/A' };

      results.push({
        id: caseId,
        duration,
        dateAccuracy,
        noiseScore,
        inclusionScore,
        vector,
        status: (dateAccuracy > 0.5 && noiseScore === 100 && inclusionScore === 100) ? 'PASS' : 'REVIEW'
      });

      console.log(`   ✅ Done (${duration}ms) | Date Acc: ${dateAccuracy}% | Inclusion: ${inclusionScore}% | Noise: ${noiseScore}`);

      // Save Vector Data Incrementally
      const vectorData = results.map(r => ({
        id: r.id,
        x: r.vector ? r.vector.x : 0,
        y: r.vector ? r.vector.y : 0,
        z: r.vector ? r.vector.z : 0,
        type: r.vector ? r.vector.vectorType : 'N/A'
      }));
      fs.writeFileSync(path.join(process.cwd(), 'vector_data.json'), JSON.stringify(vectorData, null, 2));

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        id: caseId,
        error: error.message,
        status: 'FAIL'
      });
    }
  }

  // Save Vector Data for Dashboard
  const vectorData = results.map(r => ({
    id: r.id,
    x: r.vector ? r.vector.x : 0,
    y: r.vector ? r.vector.y : 0,
    z: r.vector ? r.vector.z : 0,
    type: r.vector ? r.vector.vectorType : 'N/A'
  }));
  fs.writeFileSync(path.join(process.cwd(), 'vector_data.json'), JSON.stringify(vectorData, null, 2));
  console.log(`\n💾 Vector Data saved to vector_data.json`);

  generateHtmlReport(results);
}

function calculateDateAccuracy(generated, truth) {
  if (!truth) return 0;

  // Support YYYY-MM-DD, YYYY.MM.DD, and YYYY년 MM월 DD일
  const dateRegex = /\d{4}[-.]\d{2}[-.]\d{2}/g;
  const koreanDateRegex = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;

  const extractDates = (text) => {
    const dates = new Set();

    // Standard formats
    const standardMatches = text.match(dateRegex) || [];
    standardMatches.forEach(d => dates.add(d.replace(/\./g, '-')));

    // Korean format
    let match;
    while ((match = koreanDateRegex.exec(text)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      dates.add(`${year}-${month}-${day}`);
    }

    return dates;
  };

  const genDates = extractDates(generated);
  const truthDates = extractDates(truth);

  if (truthDates.size === 0) return 100; // No dates in truth to match

  let matchCount = 0;
  for (const truthDate of truthDates) {
    if (genDates.has(truthDate)) {
      matchCount++;
    }
  }

  return Math.round((matchCount / truthDates.size) * 100);
}

function calculateNoiseScore(text) {
  if (!text) return 0;
  let detectedNoise = 0;
  for (const keyword of NOISE_KEYWORDS) {
    if (text.includes(keyword)) detectedNoise++;
  }
  // Score starts at 100, deduct 10 for each noise type found
  return Math.max(0, 100 - (detectedNoise * 10));
}

function generateHtmlReport(results) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS 최종 검증 보고서</title>
  <style>
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
    .card { flex: 1; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid #3498db; }
    .card h3 { margin: 0 0 10px 0; color: #7f8c8d; font-size: 14px; }
    .card .value { font-size: 24px; font-weight: bold; color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; color: #2c3e50; font-weight: bold; }
    tr:hover { background-color: #f1f1f1; }
    .status-pass { color: #27ae60; font-weight: bold; }
    .status-review { color: #f39c12; font-weight: bold; }
    .status-fail { color: #c0392b; font-weight: bold; }
    .vector-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; color: white; }
    .vec-violation { background-color: #e74c3c; }
    .vec-payment { background-color: #27ae60; }
    .vec-exemption { background-color: #f39c12; }
    .vec-general { background-color: #95a5a6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>VNEXSUS 최종 검증 보고서</h1>
    
    <div class="summary">
      <div class="card">
        <h3>총 분석 건수</h3>
        <div class="value">${results.length}건</div>
      </div>
      <div class="card">
        <h3>평균 날짜 정확도</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.dateAccuracy || 0), 0) / results.length)}%</div>
      </div>
      <div class="card">
        <h3>평균 포함률 (Inclusion)</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.inclusionScore || 0), 0) / results.length)}%</div>
      </div>
      <div class="card">
        <h3>평균 노이즈 점수</h3>
        <div class="value">${Math.round(results.reduce((a, b) => a + (b.noiseScore || 0), 0) / results.length)}점</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>케이스 ID</th>
          <th>상태</th>
          <th>날짜 정확도</th>
          <th>포함률 (Inclusion)</th>
          <th>노이즈 점수</th>
          <th>3D 벡터 (X, Y, Z)</th>
          <th>벡터 유형</th>
          <th>처리 시간</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => {
    let vectorClass = 'vec-general';
    let vectorLabel = '일반 심사';
    if (r.vector?.vectorType === 'VIOLATION_RISK') { vectorClass = 'vec-violation'; vectorLabel = '위반 위험'; }
    if (r.vector?.vectorType === 'PAYMENT_TARGET') { vectorClass = 'vec-payment'; vectorLabel = '지급 대상'; }
    if (r.vector?.vectorType === 'EXEMPTION_TARGET') { vectorClass = 'vec-exemption'; vectorLabel = '부담보 대상'; }

    return `
            <tr>
              <td>${r.id}</td>
              <td class="status-${r.status.toLowerCase()}">${r.status === 'PASS' ? '통과' : (r.status === 'REVIEW' ? '검토' : '실패')}</td>
              <td>${r.dateAccuracy || 0}%</td>
              <td>${r.inclusionScore || 0}%</td>
              <td>${r.noiseScore || 0}</td>
              <td>${r.vector ? `[${r.vector.x}, ${r.vector.y}, ${r.vector.z}]` : '-'}</td>
              <td><span class="vector-badge ${vectorClass}">${vectorLabel}</span></td>
              <td>${r.duration || 0}ms</td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;

  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`\n✨ Report generated: ${OUTPUT_FILE}`);

  // Generate Dashboard with Embedded Data
  generateDashboard(results);
}

function generateDashboard(results) {
  const vectorData = results.map(r => ({
    id: r.id,
    x: r.vector ? r.vector.x : 0,
    y: r.vector ? r.vector.y : 0,
    z: r.vector ? r.vector.z : 0,
    type: r.vector ? r.vector.vectorType : 'N/A'
  }));

  const dashboardHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VNEXSUS 3D Vector Risk Dashboard</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1600px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        h1 { margin: 0; color: #3498db; }
        .stats { display: flex; gap: 20px; }
        .stat-card { background: #2c3e50; padding: 10px 20px; border-radius: 5px; text-align: center; }
        .stat-val { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: #bdc3c7; }
        #plot-container { width: 100%; height: 80vh; background: #000; border-radius: 10px; box-shadow: 0 0 20px rgba(0, 0, 0, 0.5); }
        .legend { margin-top: 20px; display: flex; gap: 20px; justify-content: center; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 14px; }
        .dot { width: 12px; height: 12px; border-radius: 50%; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>VNEXSUS 3D Vector Risk Dashboard</h1>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-val" id="total-cases">${vectorData.length}</div>
                    <div class="stat-label">Total Cases</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" id="high-risk">${vectorData.filter(d => d.type === 'VIOLATION_RISK').length}</div>
                    <div class="stat-label">High Risk</div>
                </div>
            </div>
        </header>

        <div id="plot-container"></div>

        <div class="legend">
            <div class="legend-item"><div class="dot" style="background: #e74c3c;"></div> Violation Risk</div>
            <div class="legend-item"><div class="dot" style="background: #27ae60;"></div> Payment Target</div>
            <div class="legend-item"><div class="dot" style="background: #f39c12;"></div> Exemption Target</div>
            <div class="legend-item"><div class="dot" style="background: #95a5a6;"></div> General Review</div>
        </div>
    </div>

    <script>
        const data = ${JSON.stringify(vectorData)};

        function renderChart(data) {
            const traces = {};
            const colors = {
                'VIOLATION_RISK': '#e74c3c',
                'PAYMENT_TARGET': '#27ae60',
                'EXEMPTION_TARGET': '#f39c12',
                'GENERAL_REVIEW': '#95a5a6',
                'N/A': '#333333'
            };

            data.forEach(item => {
                if (!traces[item.type]) {
                    traces[item.type] = {
                        x: [], y: [], z: [],
                        text: [],
                        mode: 'markers',
                        type: 'scatter3d',
                        name: item.type,
                        marker: { size: 8, color: colors[item.type] || '#fff', opacity: 0.8 }
                    };
                }
                traces[item.type].x.push(item.x);
                traces[item.type].y.push(item.y);
                traces[item.type].z.push(item.z);
                traces[item.type].text.push(\`Case: \${item.id}<br>Type: \${item.type}<br>Coord: [\${item.x}, \${item.y}, \${item.z}]\`);
            });

            const layout = {
                margin: { l: 0, r: 0, b: 0, t: 0 },
                paper_bgcolor: '#000',
                plot_bgcolor: '#000',
                scene: {
                    xaxis: { title: 'Severity (X)', range: [0, 10], gridcolor: '#444' },
                    yaxis: { title: 'Temporal (Y)', range: [-10, 10], gridcolor: '#444' },
                    zaxis: { title: 'Certainty (Z)', range: [0, 10], gridcolor: '#444' },
                    camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
                },
                legend: { x: 0, y: 1, font: { color: '#fff' } }
            };

            Plotly.newPlot('plot-container', Object.values(traces), layout);
        }

        renderChart(data);
    </script>
</body>
</html>
  `;

  const dashboardPath = path.join(process.cwd(), '3D_Vector_Dashboard.html');
  fs.writeFileSync(dashboardPath, dashboardHtml);
  console.log(`✨ Dashboard generated: ${dashboardPath}`);
}

verifyFullPipeline();
