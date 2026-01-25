/**
 * 🎯 Phase 3: 3-way 품질 비교 분석
 * 
 * 비교 대상:
 * A) GPT-4o-mini 결과 (Phase 1)
 * B) GPT-4o 결과 (Phase 2)
 * C) 기존 report.txt (Ground Truth)
 * 
 * 산출물: 모델 선택 근거, 품질 지표, 비용 효율성 분석
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALIDATION_DIR = path.join(__dirname, 'output/validation');
const CASE_SAMPLE_DIR = path.join(__dirname, '../../src/rag/case_sample');

// Phase 1과 Phase 2에서 동시에 처리된 케이스 찾기
function findCommonCases() {
  const phase1Files = fs.readdirSync(VALIDATION_DIR)
    .filter(f => f.startsWith('phase1_case') && f.endsWith('_4omini.json'));
  
  const phase2Summary = JSON.parse(
    fs.readFileSync(path.join(VALIDATION_DIR, 'phase2_summary.json'), 'utf-8')
  );
  
  const phase2Cases = phase2Summary.modelComparison['gpt-4o'].results
    .filter(r => !r.error)
    .map(r => r.caseNum);
  
  const phase1Cases = phase1Files.map(f => {
    const match = f.match(/phase1_case(\d+)_4omini\.json/);
    return match ? parseInt(match[1]) : null;
  }).filter(n => n !== null);
  
  return phase1Cases.filter(c => phase2Cases.includes(c));
}

// 케이스별 비교 데이터 수집
function collectComparisonData(caseNum) {
  // Phase 1 결과 (GPT-4o-mini)
  const phase1Path = path.join(VALIDATION_DIR, `phase1_case${caseNum}_4omini.json`);
  const phase1 = JSON.parse(fs.readFileSync(phase1Path, 'utf-8'));
  
  // Phase 2 결과 (GPT-4o)
  const phase2Summary = JSON.parse(
    fs.readFileSync(path.join(VALIDATION_DIR, 'phase2_summary.json'), 'utf-8')
  );
  const phase2 = phase2Summary.modelComparison['gpt-4o'].results
    .find(r => r.caseNum === caseNum);
  
  // Ground Truth (report.txt)
  const groundTruthPath = path.join(CASE_SAMPLE_DIR, `Case${caseNum}_report.txt`);
  const groundTruth = fs.existsSync(groundTruthPath) 
    ? fs.readFileSync(groundTruthPath, 'utf-8')
    : null;
  
  return { caseNum, phase1, phase2, groundTruth };
}

// 진단명 추출
function extractDiagnoses(json) {
  if (!json || !json.diagnoses) return [];
  return json.diagnoses.map(d => ({
    code: d.code,
    nameKr: d.nameKr
  }));
}

// 비용 효율성 계산 (품질/$)
function calculateCostEfficiency(quality, cost) {
  if (cost === 0) return 0;
  return quality / cost;
}

// HTML 보고서 생성
function generateHTMLReport(comparisons, summary) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS Phase 3: 3-Way 품질 비교 분석</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { text-align: center; color: #333; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #333; }
    .summary-card .subvalue { font-size: 14px; color: #888; margin-top: 5px; }
    .model-compare { background: white; border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .model-compare h2 { margin-bottom: 20px; color: #333; }
    .compare-table { width: 100%; border-collapse: collapse; }
    .compare-table th, .compare-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    .compare-table th { background: #f8f9fa; color: #666; font-weight: 600; }
    .compare-table tr:hover { background: #fafafa; }
    .badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .badge-info { background: #cce5ff; color: #004085; }
    .winner { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 3px 10px; border-radius: 20px; font-size: 11px; }
    .recommendation { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border-radius: 12px; padding: 25px; margin-top: 30px; }
    .recommendation h2 { margin-bottom: 15px; }
    .recommendation ul { margin-left: 20px; }
    .recommendation li { margin-bottom: 8px; }
    .case-details { background: white; border-radius: 12px; padding: 25px; margin-top: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .case-row { display: grid; grid-template-columns: 80px 1fr 1fr 1fr; gap: 15px; padding: 15px 0; border-bottom: 1px solid #eee; }
    .case-row:last-child { border-bottom: none; }
    .case-num { font-weight: bold; color: #333; }
    .model-result { padding: 10px; background: #f8f9fa; border-radius: 8px; }
    .model-result h4 { font-size: 12px; color: #666; margin-bottom: 5px; }
    .model-result .score { font-size: 24px; font-weight: bold; }
    .score-good { color: #28a745; }
    .score-medium { color: #ffc107; }
    .score-bad { color: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Phase 3: 3-Way 품질 비교 분석</h1>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>📊 분석 케이스</h3>
        <div class="value">${summary.totalCases}개</div>
        <div class="subvalue">Phase 1 & 2 공통 케이스</div>
      </div>
      <div class="summary-card">
        <h3>💰 총 비용</h3>
        <div class="value">$${summary.totalCost.toFixed(2)}</div>
        <div class="subvalue">Phase 1: $${summary.phase1Cost.toFixed(2)} | Phase 2: $${summary.phase2Cost.toFixed(2)}</div>
      </div>
      <div class="summary-card">
        <h3>🏆 추천 모델</h3>
        <div class="value">${summary.recommendation.model}</div>
        <div class="subvalue">${summary.recommendation.reason}</div>
      </div>
    </div>
    
    <div class="model-compare">
      <h2>📈 모델별 성능 비교</h2>
      <table class="compare-table">
        <thead>
          <tr>
            <th>모델</th>
            <th>평균 품질 점수</th>
            <th>평균 구조 완성도</th>
            <th>평균 진단 매칭</th>
            <th>평균 처리 시간</th>
            <th>케이스당 비용</th>
            <th>비용 효율성</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>GPT-4o-mini</strong></td>
            <td><span class="badge ${summary.gpt4omini.avgQuality >= 60 ? 'badge-success' : summary.gpt4omini.avgQuality >= 40 ? 'badge-warning' : 'badge-danger'}">${summary.gpt4omini.avgQuality}%</span></td>
            <td>${summary.gpt4omini.avgStructure}%</td>
            <td>${summary.gpt4omini.avgDiagnosis}%</td>
            <td>${(summary.gpt4omini.avgTime / 1000).toFixed(1)}초</td>
            <td>$${summary.gpt4omini.avgCost.toFixed(4)}</td>
            <td><span class="badge badge-info">${summary.gpt4omini.efficiency.toFixed(0)} 품질/$</span> ${summary.gpt4omini.isEfficiencyWinner ? '<span class="winner">효율성 1위</span>' : ''}</td>
          </tr>
          <tr>
            <td><strong>GPT-4o</strong></td>
            <td><span class="badge ${summary.gpt4o.avgQuality >= 60 ? 'badge-success' : summary.gpt4o.avgQuality >= 40 ? 'badge-warning' : 'badge-danger'}">${summary.gpt4o.avgQuality}%</span> ${summary.gpt4o.isQualityWinner ? '<span class="winner">품질 1위</span>' : ''}</td>
            <td>${summary.gpt4o.avgStructure}%</td>
            <td>${summary.gpt4o.avgDiagnosis}%</td>
            <td>${(summary.gpt4o.avgTime / 1000).toFixed(1)}초</td>
            <td>$${summary.gpt4o.avgCost.toFixed(4)}</td>
            <td><span class="badge badge-info">${summary.gpt4o.efficiency.toFixed(0)} 품질/$</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="recommendation">
      <h2>🎯 최종 권장사항</h2>
      <ul>
        <li><strong>일반 사용:</strong> ${summary.recommendation.generalUse}</li>
        <li><strong>고품질 필요시:</strong> ${summary.recommendation.highQuality}</li>
        <li><strong>비용 최적화:</strong> ${summary.recommendation.costOptimization}</li>
      </ul>
    </div>
    
    <div class="case-details">
      <h2>📋 케이스별 상세 비교</h2>
      ${comparisons.map(c => `
        <div class="case-row">
          <div class="case-num">Case ${c.caseNum}</div>
          <div class="model-result">
            <h4>GPT-4o-mini</h4>
            <div class="score ${c.phase1.quality.overallScore >= 60 ? 'score-good' : c.phase1.quality.overallScore >= 40 ? 'score-medium' : 'score-bad'}">${c.phase1.quality.overallScore}%</div>
            <div style="font-size:11px;color:#888;">$${c.phase1.cost.toFixed(4)} | ${(c.phase1.processingTime/1000).toFixed(1)}초</div>
          </div>
          <div class="model-result">
            <h4>GPT-4o</h4>
            <div class="score ${c.phase2.quality.overallScore >= 60 ? 'score-good' : c.phase2.quality.overallScore >= 40 ? 'score-medium' : 'score-bad'}">${c.phase2.quality.overallScore}%</div>
            <div style="font-size:11px;color:#888;">$${c.phase2.cost.toFixed(4)} | ${(c.phase2.processingTime/1000).toFixed(1)}초</div>
          </div>
          <div class="model-result">
            <h4>품질 차이</h4>
            <div class="score ${c.qualityDiff > 0 ? 'score-good' : c.qualityDiff < 0 ? 'score-bad' : 'score-medium'}">${c.qualityDiff > 0 ? '+' : ''}${c.qualityDiff}%</div>
            <div style="font-size:11px;color:#888;">4o가 ${c.qualityDiff > 0 ? '우수' : c.qualityDiff < 0 ? '열등' : '동등'}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div style="text-align:center;margin-top:30px;color:#888;font-size:12px;">
      Generated: ${new Date().toISOString()} | VNEXSUS Model Validation Phase 3
    </div>
  </div>
</body>
</html>
`;
  return html;
}

// 메인 실행
async function main() {
  console.log('═'.repeat(60));
  console.log('🎯 Phase 3: 3-Way 품질 비교 분석');
  console.log('═'.repeat(60));
  
  // 공통 케이스 찾기
  const commonCases = findCommonCases();
  console.log(`\n📊 공통 케이스: ${commonCases.length}개`);
  console.log(`   ${commonCases.join(', ')}`);
  
  // 비교 데이터 수집
  const comparisons = [];
  let phase1TotalCost = 0;
  let phase2TotalCost = 0;
  
  for (const caseNum of commonCases) {
    const data = collectComparisonData(caseNum);
    if (data.phase1 && data.phase2) {
      const qualityDiff = data.phase2.quality.overallScore - data.phase1.quality.overallScore;
      comparisons.push({
        caseNum,
        phase1: data.phase1,
        phase2: data.phase2,
        groundTruth: data.groundTruth,
        qualityDiff
      });
      phase1TotalCost += data.phase1.cost || 0;
      phase2TotalCost += data.phase2.cost || 0;
    }
  }
  
  console.log(`\n📈 비교 가능 케이스: ${comparisons.length}개`);
  
  // 통계 계산
  const phase1Stats = {
    avgQuality: Math.round(comparisons.reduce((s, c) => s + c.phase1.quality.overallScore, 0) / comparisons.length),
    avgStructure: Math.round(comparisons.reduce((s, c) => s + c.phase1.quality.structureCompleteness, 0) / comparisons.length),
    avgDiagnosis: Math.round(comparisons.reduce((s, c) => s + c.phase1.quality.diagnosisMatch, 0) / comparisons.length),
    avgTime: Math.round(comparisons.reduce((s, c) => s + c.phase1.processingTime, 0) / comparisons.length),
    avgCost: phase1TotalCost / comparisons.length,
    efficiency: 0
  };
  phase1Stats.efficiency = calculateCostEfficiency(phase1Stats.avgQuality, phase1Stats.avgCost);
  
  const phase2Stats = {
    avgQuality: Math.round(comparisons.reduce((s, c) => s + c.phase2.quality.overallScore, 0) / comparisons.length),
    avgStructure: Math.round(comparisons.reduce((s, c) => s + c.phase2.quality.structureCompleteness, 0) / comparisons.length),
    avgDiagnosis: Math.round(comparisons.reduce((s, c) => s + c.phase2.quality.diagnosisMatch, 0) / comparisons.length),
    avgTime: Math.round(comparisons.reduce((s, c) => s + c.phase2.processingTime, 0) / comparisons.length),
    avgCost: phase2TotalCost / comparisons.length,
    efficiency: 0
  };
  phase2Stats.efficiency = calculateCostEfficiency(phase2Stats.avgQuality, phase2Stats.avgCost);
  
  // 승자 결정
  phase1Stats.isEfficiencyWinner = phase1Stats.efficiency > phase2Stats.efficiency;
  phase2Stats.isQualityWinner = phase2Stats.avgQuality > phase1Stats.avgQuality;
  
  // 권장사항 생성
  const qualityDiffPercent = phase2Stats.avgQuality - phase1Stats.avgQuality;
  const costRatio = phase2Stats.avgCost / phase1Stats.avgCost;
  
  let recommendation;
  if (qualityDiffPercent < 5 && costRatio > 10) {
    recommendation = {
      model: 'GPT-4o-mini',
      reason: `품질 차이 ${qualityDiffPercent}%에 비해 비용이 ${costRatio.toFixed(0)}배 높음`,
      generalUse: 'GPT-4o-mini 권장 (비용 대비 품질 최적)',
      highQuality: 'GPT-4o 사용 (고위험 케이스, 복잡한 진단)',
      costOptimization: 'GPT-4o-mini로 1차 처리 후 필요시 GPT-4o 재처리'
    };
  } else if (qualityDiffPercent >= 10) {
    recommendation = {
      model: 'GPT-4o',
      reason: `품질 ${qualityDiffPercent}% 향상으로 비용 정당화`,
      generalUse: 'GPT-4o 권장 (품질 우선)',
      highQuality: 'GPT-4o 필수',
      costOptimization: '중요도 낮은 케이스만 GPT-4o-mini 사용'
    };
  } else {
    recommendation = {
      model: 'GPT-4o-mini (하이브리드)',
      reason: `품질 차이 ${qualityDiffPercent}%로 상황에 따라 선택`,
      generalUse: 'GPT-4o-mini 기본, 필요시 GPT-4o 업그레이드',
      highQuality: 'GPT-4o 사용',
      costOptimization: '2단계 처리: 4o-mini → 품질 미달시 4o 재처리'
    };
  }
  
  const summary = {
    totalCases: comparisons.length,
    totalCost: phase1TotalCost + phase2TotalCost,
    phase1Cost: phase1TotalCost,
    phase2Cost: phase2TotalCost,
    gpt4omini: phase1Stats,
    gpt4o: phase2Stats,
    recommendation
  };
  
  // 결과 출력
  console.log('\n' + '─'.repeat(60));
  console.log('📊 모델별 성능 비교');
  console.log('─'.repeat(60));
  console.log('\nGPT-4o-mini:');
  console.log(`  평균 품질: ${phase1Stats.avgQuality}%`);
  console.log(`  평균 구조: ${phase1Stats.avgStructure}%`);
  console.log(`  평균 진단: ${phase1Stats.avgDiagnosis}%`);
  console.log(`  평균 시간: ${(phase1Stats.avgTime / 1000).toFixed(1)}초`);
  console.log(`  평균 비용: $${phase1Stats.avgCost.toFixed(4)}`);
  console.log(`  비용 효율: ${phase1Stats.efficiency.toFixed(0)} 품질/$`);
  
  console.log('\nGPT-4o:');
  console.log(`  평균 품질: ${phase2Stats.avgQuality}%`);
  console.log(`  평균 구조: ${phase2Stats.avgStructure}%`);
  console.log(`  평균 진단: ${phase2Stats.avgDiagnosis}%`);
  console.log(`  평균 시간: ${(phase2Stats.avgTime / 1000).toFixed(1)}초`);
  console.log(`  평균 비용: $${phase2Stats.avgCost.toFixed(4)}`);
  console.log(`  비용 효율: ${phase2Stats.efficiency.toFixed(0)} 품질/$`);
  
  console.log('\n' + '─'.repeat(60));
  console.log('🎯 최종 권장사항');
  console.log('─'.repeat(60));
  console.log(`추천 모델: ${recommendation.model}`);
  console.log(`이유: ${recommendation.reason}`);
  console.log(`일반 사용: ${recommendation.generalUse}`);
  console.log(`고품질 필요: ${recommendation.highQuality}`);
  console.log(`비용 최적화: ${recommendation.costOptimization}`);
  
  // HTML 보고서 생성
  const html = generateHTMLReport(comparisons, summary);
  const htmlPath = path.join(VALIDATION_DIR, 'phase3_comparison_report.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`\n📄 HTML 보고서 생성: ${htmlPath}`);
  
  // JSON 요약 저장
  const jsonPath = path.join(VALIDATION_DIR, 'phase3_summary.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`📄 JSON 요약 저장: ${jsonPath}`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Phase 3 완료');
  console.log('═'.repeat(60));
}

main().catch(console.error);
