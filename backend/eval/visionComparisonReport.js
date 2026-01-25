/**
 * 🎯 Vision LLM 비교 보고서 생성 스크립트
 * 
 * gpt-4o-mini vs gpt-4o 비교 분석 보고서 생성
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATHS = {
  validationDir: path.join(__dirname, 'output/vision_validation'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  outputDir: path.join(__dirname, 'output/vision_validation')
};

/**
 * Ground Truth에서 KCD 코드 추출
 */
function extractKCDCodes(text) {
  const patterns = [
    /\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g,
    /\[([A-Z]\d{2}(?:\.\d{1,2})?)\]/g,
    /([A-Z]\d{2}\.\d{1,2})/g
  ];
  
  const codes = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const code = match[1] || match[0];
      if (/^[A-Z]\d{2}(?:\.\d{1,2})?$/.test(code)) {
        codes.add(code);
      }
    }
  }
  return [...codes];
}

/**
 * 생성된 JSON에서 KCD 코드 추출
 */
function extractKCDFromJson(json) {
  const codes = [];
  
  if (json.diagnoses && Array.isArray(json.diagnoses)) {
    for (const d of json.diagnoses) {
      if (d.code) codes.push(d.code);
    }
  }
  
  if (json.pastHistory && Array.isArray(json.pastHistory)) {
    for (const p of json.pastHistory) {
      if (p.code) codes.push(p.code);
    }
  }
  
  return [...new Set(codes)];
}

/**
 * 구조 완성도 계산
 */
function calculateStructureCompleteness(json) {
  const requiredFields = [
    'visitDate', 'chiefComplaint', 'diagnoses', 'examinations', 
    'pathology', 'treatments', 'outpatientPeriod', 'admissionPeriod',
    'pastHistory', 'doctorOpinion'
  ];
  
  let score = 0;
  for (const field of requiredFields) {
    if (json[field]) {
      if (Array.isArray(json[field]) && json[field].length > 0) {
        score += 10;
      } else if (typeof json[field] === 'object' && Object.keys(json[field]).length > 0) {
        score += 10;
      } else if (json[field] !== null) {
        score += 5;
      }
    }
  }
  
  return Math.min(score, 100);
}

/**
 * KCD 코드 매칭률 계산
 */
function calculateKCDMatchRate(generatedCodes, groundTruthCodes) {
  if (groundTruthCodes.length === 0) return 100;
  
  let matched = 0;
  for (const gtCode of groundTruthCodes) {
    const baseGT = gtCode.split('.')[0];
    if (generatedCodes.some(gc => gc.startsWith(baseGT))) {
      matched++;
    }
  }
  
  return Math.round((matched / groundTruthCodes.length) * 100);
}

/**
 * 비교 분석 수행
 */
function analyzeResults() {
  console.log('═'.repeat(60));
  console.log('🔍 Vision LLM 비교 보고서 생성');
  console.log('═'.repeat(60));
  
  // 결과 파일 로드
  const validationFiles = fs.readdirSync(PATHS.validationDir)
    .filter(f => f.endsWith('.json') && f.startsWith('case_') && !f.includes('_error'));
  
  const results = {
    'gpt-4o-mini': [],
    'gpt-4o': []
  };
  
  const comparisons = [];
  
  for (const file of validationFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PATHS.validationDir, file), 'utf-8'));
      if (data.model && data.generatedJson && !data.generatedJson.error) {
        results[data.model].push(data);
      }
    } catch (e) {
      // 파싱 실패시 무시
    }
  }
  
  console.log(`\n📊 로드된 결과: gpt-4o-mini ${results['gpt-4o-mini'].length}개, gpt-4o ${results['gpt-4o'].length}개`);
  
  // 공통 케이스 찾기 (양쪽 모델에서 모두 성공한 케이스)
  const miniCases = new Set(results['gpt-4o-mini'].map(r => r.caseNum));
  const fullCases = new Set(results['gpt-4o'].map(r => r.caseNum));
  const commonCases = [...miniCases].filter(c => fullCases.has(c));
  
  console.log(`\n🔗 공통 케이스: ${commonCases.length}개`);
  
  // 각 케이스별 비교
  for (const caseNum of commonCases) {
    const miniResult = results['gpt-4o-mini'].find(r => r.caseNum === caseNum);
    const fullResult = results['gpt-4o'].find(r => r.caseNum === caseNum);
    
    // Ground Truth 로드
    const gtPath = path.join(PATHS.groundTruthDir, `Case${caseNum}_report.txt`);
    let groundTruth = '';
    let gtKCDCodes = [];
    
    if (fs.existsSync(gtPath)) {
      groundTruth = fs.readFileSync(gtPath, 'utf-8');
      gtKCDCodes = extractKCDCodes(groundTruth);
    }
    
    // 분석
    const miniJson = miniResult.generatedJson;
    const fullJson = fullResult.generatedJson;
    
    const miniStructure = calculateStructureCompleteness(miniJson);
    const fullStructure = calculateStructureCompleteness(fullJson);
    
    const miniKCDCodes = extractKCDFromJson(miniJson);
    const fullKCDCodes = extractKCDFromJson(fullJson);
    
    const miniKCDMatch = calculateKCDMatchRate(miniKCDCodes, gtKCDCodes);
    const fullKCDMatch = calculateKCDMatchRate(fullKCDCodes, gtKCDCodes);
    
    comparisons.push({
      caseId: `Case${caseNum}`,
      caseNum,
      patientName: miniResult.patientName,
      mini: {
        processingTime: miniResult.processingTime,
        cost: miniResult.cost,
        structure: miniStructure,
        kcdMatch: miniKCDMatch,
        kcdCount: miniKCDCodes.length,
        diagnosisCount: miniJson.diagnoses?.length || 0
      },
      full: {
        processingTime: fullResult.processingTime,
        cost: fullResult.cost,
        structure: fullStructure,
        kcdMatch: fullKCDMatch,
        kcdCount: fullKCDCodes.length,
        diagnosisCount: fullJson.diagnoses?.length || 0
      },
      groundTruth: {
        kcdCount: gtKCDCodes.length
      }
    });
  }
  
  // 통계 계산
  const summary = {
    totalComparisons: comparisons.length,
    'gpt-4o-mini': {
      avgTime: comparisons.reduce((s, c) => s + c.mini.processingTime, 0) / comparisons.length,
      avgCost: comparisons.reduce((s, c) => s + c.mini.cost, 0) / comparisons.length,
      totalCost: comparisons.reduce((s, c) => s + c.mini.cost, 0),
      avgStructure: Math.round(comparisons.reduce((s, c) => s + c.mini.structure, 0) / comparisons.length),
      avgKCDMatch: Math.round(comparisons.reduce((s, c) => s + c.mini.kcdMatch, 0) / comparisons.length)
    },
    'gpt-4o': {
      avgTime: comparisons.reduce((s, c) => s + c.full.processingTime, 0) / comparisons.length,
      avgCost: comparisons.reduce((s, c) => s + c.full.cost, 0) / comparisons.length,
      totalCost: comparisons.reduce((s, c) => s + c.full.cost, 0),
      avgStructure: Math.round(comparisons.reduce((s, c) => s + c.full.structure, 0) / comparisons.length),
      avgKCDMatch: Math.round(comparisons.reduce((s, c) => s + c.full.kcdMatch, 0) / comparisons.length)
    }
  };
  
  // 비용 효율성 계산
  summary['gpt-4o-mini'].efficiency = summary['gpt-4o-mini'].avgStructure / summary['gpt-4o-mini'].avgCost;
  summary['gpt-4o'].efficiency = summary['gpt-4o'].avgStructure / summary['gpt-4o'].avgCost;
  
  summary.costRatio = summary['gpt-4o'].avgCost / summary['gpt-4o-mini'].avgCost;
  summary.winner = summary['gpt-4o-mini'].efficiency > summary['gpt-4o'].efficiency ? 'gpt-4o-mini' : 'gpt-4o';
  
  // 결과 출력
  console.log('\n' + '─'.repeat(60));
  console.log('📊 모델 비교 결과');
  console.log('─'.repeat(60));
  
  console.log('\ngpt-4o-mini:');
  console.log(`  평균 처리 시간: ${(summary['gpt-4o-mini'].avgTime / 1000).toFixed(1)}초`);
  console.log(`  평균 비용: $${summary['gpt-4o-mini'].avgCost.toFixed(4)}`);
  console.log(`  평균 구조 완성도: ${summary['gpt-4o-mini'].avgStructure}%`);
  console.log(`  평균 KCD 매칭률: ${summary['gpt-4o-mini'].avgKCDMatch}%`);
  console.log(`  비용 효율성: ${summary['gpt-4o-mini'].efficiency.toFixed(0)} 점/$`);
  
  console.log('\ngpt-4o:');
  console.log(`  평균 처리 시간: ${(summary['gpt-4o'].avgTime / 1000).toFixed(1)}초`);
  console.log(`  평균 비용: $${summary['gpt-4o'].avgCost.toFixed(4)}`);
  console.log(`  평균 구조 완성도: ${summary['gpt-4o'].avgStructure}%`);
  console.log(`  평균 KCD 매칭률: ${summary['gpt-4o'].avgKCDMatch}%`);
  console.log(`  비용 효율성: ${summary['gpt-4o'].efficiency.toFixed(0)} 점/$`);
  
  console.log(`\n📌 비용 비율: gpt-4o는 gpt-4o-mini보다 ${summary.costRatio.toFixed(1)}배 비쌈`);
  console.log(`🏆 추천 모델: ${summary.winner}`);
  
  // HTML 보고서 생성
  generateHTMLReport(comparisons, summary);
  
  // JSON 저장
  fs.writeFileSync(
    path.join(PATHS.outputDir, 'vision_comparison_summary.json'),
    JSON.stringify({ summary, comparisons }, null, 2)
  );
  
  console.log('\n📄 JSON 저장: vision_comparison_summary.json');
}

/**
 * HTML 보고서 생성
 */
function generateHTMLReport(comparisons, summary) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS Vision LLM 비교 분석 보고서</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { text-align: center; color: white; margin-bottom: 30px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; border-radius: 16px; padding: 25px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; }
    .summary-card h3 { color: #666; font-size: 13px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .summary-card .value { font-size: 36px; font-weight: bold; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .summary-card .subvalue { font-size: 13px; color: #888; margin-top: 5px; }
    .model-compare { background: white; border-radius: 16px; padding: 30px; margin-bottom: 25px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .model-compare h2 { color: #333; margin-bottom: 25px; font-size: 22px; display: flex; align-items: center; gap: 10px; }
    .model-compare h2::before { content: ''; width: 5px; height: 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; color: #555; font-weight: 600; font-size: 13px; text-transform: uppercase; }
    tr:hover { background: #fafafa; }
    .badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .winner-badge { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    .recommendation { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border-radius: 16px; padding: 30px; margin-top: 30px; }
    .recommendation h2 { margin-bottom: 20px; font-size: 22px; }
    .recommendation ul { margin-left: 25px; }
    .recommendation li { margin-bottom: 10px; font-size: 15px; }
    .case-table { margin-top: 30px; }
    .cost-diff { font-weight: bold; }
    .cost-diff.positive { color: #ef4444; }
    .cost-diff.negative { color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Vision LLM 비교 분석 보고서</h1>
    <p style="text-align:center;color:rgba(255,255,255,0.9);margin-bottom:30px;">PDF → Vision OCR → 보고서 생성 End-to-End 검증 결과</p>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>분석 케이스</h3>
        <div class="value">${summary.totalComparisons}</div>
        <div class="subvalue">공통 검증 케이스</div>
      </div>
      <div class="summary-card">
        <h3>비용 차이</h3>
        <div class="value">${summary.costRatio.toFixed(1)}x</div>
        <div class="subvalue">gpt-4o가 더 비쌈</div>
      </div>
      <div class="summary-card">
        <h3>총 비용</h3>
        <div class="value">$${(summary['gpt-4o-mini'].totalCost + summary['gpt-4o'].totalCost).toFixed(2)}</div>
        <div class="subvalue">mini: $${summary['gpt-4o-mini'].totalCost.toFixed(2)} / 4o: $${summary['gpt-4o'].totalCost.toFixed(2)}</div>
      </div>
      <div class="summary-card">
        <h3>추천 모델</h3>
        <div class="value" style="font-size:24px;">${summary.winner}</div>
        <div class="subvalue">비용 대비 품질 최적</div>
      </div>
    </div>
    
    <div class="model-compare">
      <h2>모델별 성능 비교</h2>
      <table>
        <thead>
          <tr>
            <th>모델</th>
            <th>평균 처리 시간</th>
            <th>평균 비용</th>
            <th>구조 완성도</th>
            <th>KCD 매칭률</th>
            <th>비용 효율성</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>gpt-4o-mini</strong> ${summary.winner === 'gpt-4o-mini' ? '<span class="winner-badge">추천</span>' : ''}</td>
            <td>${(summary['gpt-4o-mini'].avgTime / 1000).toFixed(1)}초</td>
            <td>$${summary['gpt-4o-mini'].avgCost.toFixed(4)}</td>
            <td><span class="badge badge-${summary['gpt-4o-mini'].avgStructure >= 70 ? 'success' : summary['gpt-4o-mini'].avgStructure >= 50 ? 'warning' : 'danger'}">${summary['gpt-4o-mini'].avgStructure}%</span></td>
            <td><span class="badge badge-${summary['gpt-4o-mini'].avgKCDMatch >= 70 ? 'success' : summary['gpt-4o-mini'].avgKCDMatch >= 50 ? 'warning' : 'danger'}">${summary['gpt-4o-mini'].avgKCDMatch}%</span></td>
            <td><span class="badge badge-info">${summary['gpt-4o-mini'].efficiency.toFixed(0)} 점/$</span></td>
          </tr>
          <tr>
            <td><strong>gpt-4o</strong> ${summary.winner === 'gpt-4o' ? '<span class="winner-badge">추천</span>' : ''}</td>
            <td>${(summary['gpt-4o'].avgTime / 1000).toFixed(1)}초</td>
            <td>$${summary['gpt-4o'].avgCost.toFixed(4)}</td>
            <td><span class="badge badge-${summary['gpt-4o'].avgStructure >= 70 ? 'success' : summary['gpt-4o'].avgStructure >= 50 ? 'warning' : 'danger'}">${summary['gpt-4o'].avgStructure}%</span></td>
            <td><span class="badge badge-${summary['gpt-4o'].avgKCDMatch >= 70 ? 'success' : summary['gpt-4o'].avgKCDMatch >= 50 ? 'warning' : 'danger'}">${summary['gpt-4o'].avgKCDMatch}%</span></td>
            <td><span class="badge badge-info">${summary['gpt-4o'].efficiency.toFixed(0)} 점/$</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="model-compare case-table">
      <h2>케이스별 상세 비교</h2>
      <table>
        <thead>
          <tr>
            <th>케이스</th>
            <th>피보험자</th>
            <th>gpt-4o-mini 구조</th>
            <th>gpt-4o 구조</th>
            <th>gpt-4o-mini KCD</th>
            <th>gpt-4o KCD</th>
            <th>비용 차이</th>
          </tr>
        </thead>
        <tbody>
          ${comparisons.map(c => `
            <tr>
              <td><strong>${c.caseId}</strong></td>
              <td>${c.patientName || 'N/A'}</td>
              <td><span class="badge badge-${c.mini.structure >= 70 ? 'success' : c.mini.structure >= 50 ? 'warning' : 'danger'}">${c.mini.structure}%</span></td>
              <td><span class="badge badge-${c.full.structure >= 70 ? 'success' : c.full.structure >= 50 ? 'warning' : 'danger'}">${c.full.structure}%</span></td>
              <td>${c.mini.kcdMatch}%</td>
              <td>${c.full.kcdMatch}%</td>
              <td class="cost-diff ${c.full.cost > c.mini.cost ? 'positive' : 'negative'}">+$${(c.full.cost - c.mini.cost).toFixed(4)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="recommendation">
      <h2>🎯 최종 권장사항</h2>
      <ul>
        <li><strong>일반 사용:</strong> gpt-4o-mini 권장 (비용 대비 품질 최적, ${summary.costRatio.toFixed(1)}배 저렴)</li>
        <li><strong>고품질 필요시:</strong> gpt-4o 사용 (복잡한 의료 문서, 고위험 케이스)</li>
        <li><strong>비용 최적화:</strong> gpt-4o-mini로 1차 처리 후, 품질 미달시 gpt-4o 재처리</li>
      </ul>
    </div>
    
    <div style="text-align:center;margin-top:30px;color:rgba(255,255,255,0.7);font-size:12px;">
      Generated: ${new Date().toISOString()} | VNEXSUS Vision LLM Validation
    </div>
  </div>
</body>
</html>
`;

  fs.writeFileSync(path.join(PATHS.outputDir, 'vision_comparison_report.html'), html);
  console.log('\n📄 HTML 보고서 생성: vision_comparison_report.html');
}

// 메인 실행
analyzeResults();
