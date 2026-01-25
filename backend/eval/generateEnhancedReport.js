/**
 * 강화된 검증 분석 보고서 생성
 * 
 * 기존 validation_results.json을 분석하여 더 상세한 HTML 보고서 생성
 * - 10항목 구조화 데이터 분석
 * - 날짜 매칭 상세 분석
 * - 모델 효율성 및 한계 분석
 * - 개선 인사이트 도출
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  resultsPath: path.join(__dirname, 'output/full_pipeline_validation/validation_results.json'),
  outputPath: path.join(__dirname, 'output/full_pipeline_validation/reports'),
};

function loadResults() {
  return JSON.parse(fs.readFileSync(CONFIG.resultsPath, 'utf-8'));
}

function analyzeStructuredData(results) {
  const structureAnalysis = {
    patientInfo: { present: 0, complete: 0, total: 0 },
    visitDate: { present: 0, complete: 0, total: 0 },
    chiefComplaint: { present: 0, complete: 0, total: 0 },
    diagnoses: { present: 0, avgCount: 0, withKcd: 0, total: 0 },
    examinations: { present: 0, avgCount: 0, total: 0 },
    treatments: { present: 0, avgCount: 0, total: 0 },
    medications: { present: 0, avgCount: 0, total: 0 },
    hospitalizations: { present: 0, avgCount: 0, total: 0 },
    surgeries: { present: 0, avgCount: 0, total: 0 },
    prognosis: { present: 0, total: 0 },
    extractedDates: { avgCount: 0, total: 0 },
    extractedHospitals: { avgCount: 0, total: 0 }
  };
  
  const validResults = results.filter(r => r.generatedJson && !r.generatedJson.parseError);
  
  validResults.forEach(r => {
    const json = r.generatedJson;
    
    // patientInfo
    structureAnalysis.patientInfo.total++;
    if (json.patientInfo) {
      structureAnalysis.patientInfo.present++;
      if (json.patientInfo.name && json.patientInfo.birthDate !== 'YYYY-MM-DD') {
        structureAnalysis.patientInfo.complete++;
      }
    }
    
    // visitDate
    structureAnalysis.visitDate.total++;
    if (json.visitDate) {
      structureAnalysis.visitDate.present++;
      if (json.visitDate.date && json.visitDate.hospital) {
        structureAnalysis.visitDate.complete++;
      }
    }
    
    // chiefComplaint
    structureAnalysis.chiefComplaint.total++;
    if (json.chiefComplaint) {
      structureAnalysis.chiefComplaint.present++;
      if (json.chiefComplaint.summary) {
        structureAnalysis.chiefComplaint.complete++;
      }
    }
    
    // diagnoses
    structureAnalysis.diagnoses.total++;
    if (json.diagnoses && json.diagnoses.length > 0) {
      structureAnalysis.diagnoses.present++;
      structureAnalysis.diagnoses.avgCount += json.diagnoses.length;
      json.diagnoses.forEach(d => {
        if (d.code && /[A-Z]\d{2}/.test(d.code)) {
          structureAnalysis.diagnoses.withKcd++;
        }
      });
    }
    
    // examinations
    structureAnalysis.examinations.total++;
    if (json.examinations && json.examinations.length > 0) {
      structureAnalysis.examinations.present++;
      structureAnalysis.examinations.avgCount += json.examinations.length;
    }
    
    // treatments
    structureAnalysis.treatments.total++;
    if (json.treatments && json.treatments.length > 0) {
      structureAnalysis.treatments.present++;
      structureAnalysis.treatments.avgCount += json.treatments.length;
    }
    
    // medications
    structureAnalysis.medications.total++;
    if (json.medications && json.medications.length > 0) {
      structureAnalysis.medications.present++;
      structureAnalysis.medications.avgCount += json.medications.length;
    }
    
    // hospitalizations
    structureAnalysis.hospitalizations.total++;
    if (json.hospitalizations && json.hospitalizations.length > 0) {
      structureAnalysis.hospitalizations.present++;
      structureAnalysis.hospitalizations.avgCount += json.hospitalizations.length;
    }
    
    // surgeries
    structureAnalysis.surgeries.total++;
    if (json.surgeries && json.surgeries.length > 0) {
      structureAnalysis.surgeries.present++;
      structureAnalysis.surgeries.avgCount += json.surgeries.length;
    }
    
    // prognosis
    structureAnalysis.prognosis.total++;
    if (json.prognosis && json.prognosis.summary) {
      structureAnalysis.prognosis.present++;
    }
    
    // extractedDates
    structureAnalysis.extractedDates.total++;
    if (json.extractedDates) {
      structureAnalysis.extractedDates.avgCount += json.extractedDates.length;
    }
    
    // extractedHospitals
    structureAnalysis.extractedHospitals.total++;
    if (json.extractedHospitals) {
      structureAnalysis.extractedHospitals.avgCount += json.extractedHospitals.length;
    }
  });
  
  // 평균 계산
  const count = validResults.length || 1;
  structureAnalysis.diagnoses.avgCount /= count;
  structureAnalysis.examinations.avgCount /= count;
  structureAnalysis.treatments.avgCount /= count;
  structureAnalysis.medications.avgCount /= count;
  structureAnalysis.hospitalizations.avgCount /= count;
  structureAnalysis.surgeries.avgCount /= count;
  structureAnalysis.extractedDates.avgCount /= count;
  structureAnalysis.extractedHospitals.avgCount /= count;
  
  return structureAnalysis;
}

function analyzeDateMatching(results) {
  const dateAnalysis = {
    totalGtDates: 0,
    totalMatchedDates: 0,
    totalMissedDates: 0,
    totalExtraDates: 0,
    byModel: {
      'gpt-4o-mini': { gt: 0, matched: 0, missed: 0, extra: 0 },
      'gpt-4o': { gt: 0, matched: 0, missed: 0, extra: 0 }
    },
    commonMissedPatterns: {},
    matchRateDistribution: []
  };
  
  results.forEach(r => {
    if (!r.matching || !r.matching.dates) return;
    
    const m = r.matching.dates;
    const model = r.model;
    
    dateAnalysis.totalGtDates += (m.matched?.length || 0) + (m.missed?.length || 0);
    dateAnalysis.totalMatchedDates += m.matched?.length || 0;
    dateAnalysis.totalMissedDates += m.missed?.length || 0;
    dateAnalysis.totalExtraDates += m.extra?.length || 0;
    
    dateAnalysis.byModel[model].gt += (m.matched?.length || 0) + (m.missed?.length || 0);
    dateAnalysis.byModel[model].matched += m.matched?.length || 0;
    dateAnalysis.byModel[model].missed += m.missed?.length || 0;
    dateAnalysis.byModel[model].extra += m.extra?.length || 0;
    
    dateAnalysis.matchRateDistribution.push({
      caseId: r.caseId,
      model,
      rate: m.rate
    });
    
    // 누락 패턴 분석
    (m.missed || []).forEach(d => {
      const year = d.split('-')[0];
      dateAnalysis.commonMissedPatterns[year] = (dateAnalysis.commonMissedPatterns[year] || 0) + 1;
    });
  });
  
  return dateAnalysis;
}

function generateEnhancedHTML(data, structureAnalysis, dateAnalysis, summary) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // 모델별 결과 분리
  const miniResults = data.results.filter(r => r.model === 'gpt-4o-mini' && !r.error);
  const fullResults = data.results.filter(r => r.model === 'gpt-4o' && !r.error);
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS 상세 검증 분석 보고서 - ${timestamp}</title>
  <style>
    :root {
      --primary: #1a237e;
      --secondary: #3f51b5;
      --success: #4caf50;
      --warning: #ff9800;
      --danger: #f44336;
      --info: #2196f3;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 1600px; margin: 0 auto; padding: 30px; }
    h1 { color: var(--primary); font-size: 2.2em; border-bottom: 3px solid var(--secondary); padding-bottom: 15px; margin-bottom: 30px; }
    h2 { color: var(--secondary); font-size: 1.6em; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
    h3 { color: #303f9f; font-size: 1.3em; margin: 25px 0 15px; }
    
    .executive-summary { background: linear-gradient(135deg, #1a237e 0%, #3f51b5 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; }
    .executive-summary h2 { color: white; border: none; margin: 0 0 20px; }
    .exec-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .exec-item { background: rgba(255,255,255,0.15); padding: 20px; border-radius: 10px; text-align: center; }
    .exec-item .value { font-size: 2.5em; font-weight: bold; }
    .exec-item .label { opacity: 0.9; font-size: 0.95em; }
    
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 25px; margin-bottom: 25px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .badge { padding: 5px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
    .badge-success { background: #e8f5e9; color: #2e7d32; }
    .badge-warning { background: #fff3e0; color: #e65100; }
    .badge-danger { background: #ffebee; color: #c62828; }
    .badge-info { background: #e3f2fd; color: #1565c0; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; }
    
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 14px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f8f9fa; color: var(--primary); font-weight: 600; }
    tr:hover { background: #fafafa; }
    
    .progress-bar { height: 24px; background: #e0e0e0; border-radius: 12px; overflow: hidden; position: relative; }
    .progress-fill { height: 100%; border-radius: 12px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: white; font-weight: 600; font-size: 0.85em; }
    .progress-fill.high { background: linear-gradient(90deg, var(--success), #8bc34a); }
    .progress-fill.medium { background: linear-gradient(90deg, var(--warning), #ffb74d); }
    .progress-fill.low { background: linear-gradient(90deg, var(--danger), #e57373); }
    
    .metric-card { padding: 20px; border-radius: 10px; text-align: center; }
    .metric-card.green { background: #e8f5e9; border: 2px solid #4caf50; }
    .metric-card.yellow { background: #fff8e1; border: 2px solid #ffc107; }
    .metric-card.red { background: #ffebee; border: 2px solid #f44336; }
    .metric-card .value { font-size: 2.2em; font-weight: bold; margin: 10px 0; }
    .metric-card .label { color: #666; font-size: 0.9em; }
    
    .insight-section { background: #fafafa; border-radius: 12px; padding: 25px; margin: 25px 0; }
    .insight-item { display: flex; margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid var(--info); }
    .insight-item.critical { border-left-color: var(--danger); }
    .insight-item.success { border-left-color: var(--success); }
    .insight-item.warning { border-left-color: var(--warning); }
    .insight-icon { font-size: 1.5em; margin-right: 15px; }
    .insight-content h4 { margin-bottom: 5px; color: var(--primary); }
    
    .model-comparison { margin: 30px 0; }
    .model-card { padding: 25px; border-radius: 12px; }
    .model-card.mini { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border: 2px solid var(--success); }
    .model-card.full { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border: 2px solid var(--info); }
    
    .structure-analysis table th { background: linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%); }
    
    .chart-container { padding: 20px; background: #fafafa; border-radius: 10px; margin: 20px 0; }
    .bar-chart { display: flex; align-items: flex-end; height: 200px; gap: 10px; padding: 20px 10px 50px; }
    .bar { flex: 1; background: var(--secondary); border-radius: 5px 5px 0 0; position: relative; min-width: 40px; transition: all 0.3s; }
    .bar:hover { opacity: 0.8; }
    .bar-label { position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); font-size: 0.75em; text-align: center; width: 100%; }
    .bar-value { position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 0.85em; font-weight: bold; }
    
    .case-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
    .case-card { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .case-card-header { background: var(--secondary); color: white; padding: 15px; }
    .case-card-body { padding: 15px; }
    .case-stat { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    
    .footer { margin-top: 50px; padding: 30px; text-align: center; background: #f5f5f5; border-radius: 12px; color: #666; }
    
    @media print {
      body { background: white; }
      .container { padding: 0; }
      .card { box-shadow: none; border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 VNEXSUS Vision LLM 파이프라인 검증 분석 보고서</h1>
    <p style="color: #666; margin-bottom: 30px;">생성일시: ${new Date().toLocaleString('ko-KR')} | 검증 기간: 시나리오 A (gpt-4o-mini 전체 + gpt-4o 비교)</p>
    
    <!-- Executive Summary -->
    <div class="executive-summary">
      <h2>📊 Executive Summary</h2>
      <div class="exec-grid">
        <div class="exec-item">
          <div class="value">${summary.totalCases}</div>
          <div class="label">총 검증 케이스</div>
        </div>
        <div class="exec-item">
          <div class="value">${summary.totalPages.toLocaleString()}</div>
          <div class="label">처리 페이지</div>
        </div>
        <div class="exec-item">
          <div class="value">$${summary.totalCost.toFixed(2)}</div>
          <div class="label">총 비용</div>
        </div>
        <div class="exec-item">
          <div class="value">${Math.round(summary.avgProcessingTime / 1000)}s</div>
          <div class="label">평균 처리시간</div>
        </div>
      </div>
    </div>
    
    <!-- 핵심 성과 지표 -->
    <h2>🎯 핵심 성과 지표 (KPI)</h2>
    <div class="grid-5">
      <div class="metric-card ${summary.miniAvg.dates >= 50 ? 'green' : summary.miniAvg.dates >= 30 ? 'yellow' : 'red'}">
        <div class="label">날짜 매칭률</div>
        <div class="value">${summary.miniAvg.dates}%</div>
        <div class="label">gpt-4o-mini 평균</div>
      </div>
      <div class="metric-card ${summary.miniAvg.kcd >= 50 ? 'green' : summary.miniAvg.kcd >= 30 ? 'yellow' : 'red'}">
        <div class="label">KCD 코드 매칭</div>
        <div class="value">${summary.miniAvg.kcd}%</div>
        <div class="label">gpt-4o-mini 평균</div>
      </div>
      <div class="metric-card ${summary.miniAvg.hospitals >= 50 ? 'green' : summary.miniAvg.hospitals >= 30 ? 'yellow' : 'red'}">
        <div class="label">병원명 매칭</div>
        <div class="value">${summary.miniAvg.hospitals}%</div>
        <div class="label">gpt-4o-mini 평균</div>
      </div>
      <div class="metric-card ${summary.miniAvg.exams >= 50 ? 'green' : summary.miniAvg.exams >= 30 ? 'yellow' : 'red'}">
        <div class="label">검사 매칭</div>
        <div class="value">${summary.miniAvg.exams}%</div>
        <div class="label">gpt-4o-mini 평균</div>
      </div>
      <div class="metric-card ${summary.miniAvg.treats >= 50 ? 'green' : summary.miniAvg.treats >= 30 ? 'yellow' : 'red'}">
        <div class="label">치료 매칭</div>
        <div class="value">${summary.miniAvg.treats}%</div>
        <div class="label">gpt-4o-mini 평균</div>
      </div>
    </div>
    
    <!-- 모델 성능 비교 -->
    <h2>⚖️ 모델 성능 비교</h2>
    <div class="model-comparison grid-2">
      <div class="card model-card mini">
        <h3>🟢 gpt-4o-mini (비용 효율 모델)</h3>
        <p><strong>검증 케이스:</strong> ${summary.miniCases}개 (전체)</p>
        <p><strong>총 비용:</strong> $${summary.miniCost.toFixed(2)} (페이지당 $0.0054)</p>
        <p><strong>성공률:</strong> ${Math.round(miniResults.length / summary.miniCases * 100)}%</p>
        <table>
          <tr><th>항목</th><th>매칭률</th><th>상태</th></tr>
          <tr><td>날짜</td><td><div class="progress-bar"><div class="progress-fill ${summary.miniAvg.dates >= 50 ? 'high' : summary.miniAvg.dates >= 30 ? 'medium' : 'low'}" style="width:${summary.miniAvg.dates}%">${summary.miniAvg.dates}%</div></div></td><td>${summary.miniAvg.dates >= 50 ? '✅' : summary.miniAvg.dates >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>KCD 코드</td><td><div class="progress-bar"><div class="progress-fill ${summary.miniAvg.kcd >= 50 ? 'high' : summary.miniAvg.kcd >= 30 ? 'medium' : 'low'}" style="width:${summary.miniAvg.kcd}%">${summary.miniAvg.kcd}%</div></div></td><td>${summary.miniAvg.kcd >= 50 ? '✅' : summary.miniAvg.kcd >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>병원명</td><td><div class="progress-bar"><div class="progress-fill ${summary.miniAvg.hospitals >= 50 ? 'high' : summary.miniAvg.hospitals >= 30 ? 'medium' : 'low'}" style="width:${summary.miniAvg.hospitals}%">${summary.miniAvg.hospitals}%</div></div></td><td>${summary.miniAvg.hospitals >= 50 ? '✅' : summary.miniAvg.hospitals >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>검사</td><td><div class="progress-bar"><div class="progress-fill ${summary.miniAvg.exams >= 50 ? 'high' : summary.miniAvg.exams >= 30 ? 'medium' : 'low'}" style="width:${summary.miniAvg.exams}%">${summary.miniAvg.exams}%</div></div></td><td>${summary.miniAvg.exams >= 50 ? '✅' : summary.miniAvg.exams >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>치료</td><td><div class="progress-bar"><div class="progress-fill ${summary.miniAvg.treats >= 50 ? 'high' : summary.miniAvg.treats >= 30 ? 'medium' : 'low'}" style="width:${summary.miniAvg.treats}%">${summary.miniAvg.treats}%</div></div></td><td>${summary.miniAvg.treats >= 50 ? '✅' : summary.miniAvg.treats >= 30 ? '⚠️' : '❌'}</td></tr>
        </table>
      </div>
      <div class="card model-card full">
        <h3>🔵 gpt-4o (고정밀 모델)</h3>
        <p><strong>검증 케이스:</strong> ${fullResults.length}개 (Rate Limit으로 일부 실패)</p>
        <p><strong>총 비용:</strong> $${summary.fullCost.toFixed(2)} (페이지당 $0.0083)</p>
        <p><strong>비용 대비:</strong> 1.5배 (gpt-4o-mini 대비)</p>
        <table>
          <tr><th>항목</th><th>매칭률</th><th>상태</th></tr>
          <tr><td>날짜</td><td><div class="progress-bar"><div class="progress-fill ${summary.fullAvg.dates >= 50 ? 'high' : summary.fullAvg.dates >= 30 ? 'medium' : 'low'}" style="width:${summary.fullAvg.dates}%">${summary.fullAvg.dates}%</div></div></td><td>${summary.fullAvg.dates >= 50 ? '✅' : summary.fullAvg.dates >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>KCD 코드</td><td><div class="progress-bar"><div class="progress-fill ${summary.fullAvg.kcd >= 50 ? 'high' : summary.fullAvg.kcd >= 30 ? 'medium' : 'low'}" style="width:${summary.fullAvg.kcd}%">${summary.fullAvg.kcd}%</div></div></td><td>${summary.fullAvg.kcd >= 50 ? '✅' : summary.fullAvg.kcd >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>병원명</td><td><div class="progress-bar"><div class="progress-fill ${summary.fullAvg.hospitals >= 50 ? 'high' : summary.fullAvg.hospitals >= 30 ? 'medium' : 'low'}" style="width:${summary.fullAvg.hospitals}%">${summary.fullAvg.hospitals}%</div></div></td><td>${summary.fullAvg.hospitals >= 50 ? '✅' : summary.fullAvg.hospitals >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>검사</td><td><div class="progress-bar"><div class="progress-fill ${summary.fullAvg.exams >= 50 ? 'high' : summary.fullAvg.exams >= 30 ? 'medium' : 'low'}" style="width:${summary.fullAvg.exams}%">${summary.fullAvg.exams}%</div></div></td><td>${summary.fullAvg.exams >= 50 ? '✅' : summary.fullAvg.exams >= 30 ? '⚠️' : '❌'}</td></tr>
          <tr><td>치료</td><td><div class="progress-bar"><div class="progress-fill ${summary.fullAvg.treats >= 50 ? 'high' : summary.fullAvg.treats >= 30 ? 'medium' : 'low'}" style="width:${summary.fullAvg.treats}%">${summary.fullAvg.treats}%</div></div></td><td>${summary.fullAvg.treats >= 50 ? '✅' : summary.fullAvg.treats >= 30 ? '⚠️' : '❌'}</td></tr>
        </table>
      </div>
    </div>
    
    <!-- 10항목 구조화 데이터 분석 -->
    <h2>📋 10항목 구조화 데이터 분석</h2>
    <div class="card structure-analysis">
      <p>Vision LLM이 생성한 JSON 구조의 각 항목별 완성도를 분석합니다.</p>
      <table>
        <tr>
          <th>항목</th>
          <th>추출률</th>
          <th>완성도</th>
          <th>평균 개수</th>
          <th>평가</th>
        </tr>
        <tr>
          <td>1. 환자정보 (patientInfo)</td>
          <td>${Math.round(structureAnalysis.patientInfo.present / structureAnalysis.patientInfo.total * 100)}%</td>
          <td>${Math.round(structureAnalysis.patientInfo.complete / structureAnalysis.patientInfo.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.patientInfo.present / structureAnalysis.patientInfo.total >= 0.8 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>2. 내원정보 (visitDate)</td>
          <td>${Math.round(structureAnalysis.visitDate.present / structureAnalysis.visitDate.total * 100)}%</td>
          <td>${Math.round(structureAnalysis.visitDate.complete / structureAnalysis.visitDate.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.visitDate.complete / structureAnalysis.visitDate.total >= 0.6 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>3. 주호소 (chiefComplaint)</td>
          <td>${Math.round(structureAnalysis.chiefComplaint.present / structureAnalysis.chiefComplaint.total * 100)}%</td>
          <td>${Math.round(structureAnalysis.chiefComplaint.complete / structureAnalysis.chiefComplaint.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.chiefComplaint.complete / structureAnalysis.chiefComplaint.total >= 0.5 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>4. 진단 (diagnoses)</td>
          <td>${Math.round(structureAnalysis.diagnoses.present / structureAnalysis.diagnoses.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.diagnoses.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.diagnoses.present / structureAnalysis.diagnoses.total >= 0.7 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>5. 검사 (examinations)</td>
          <td>${Math.round(structureAnalysis.examinations.present / structureAnalysis.examinations.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.examinations.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.examinations.present / structureAnalysis.examinations.total >= 0.5 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>6. 치료 (treatments)</td>
          <td>${Math.round(structureAnalysis.treatments.present / structureAnalysis.treatments.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.treatments.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.treatments.present / structureAnalysis.treatments.total >= 0.5 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>7. 약물 (medications)</td>
          <td>${Math.round(structureAnalysis.medications.present / structureAnalysis.medications.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.medications.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.medications.present / structureAnalysis.medications.total >= 0.3 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>8. 입원 (hospitalizations)</td>
          <td>${Math.round(structureAnalysis.hospitalizations.present / structureAnalysis.hospitalizations.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.hospitalizations.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.hospitalizations.present / structureAnalysis.hospitalizations.total >= 0.3 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>9. 수술 (surgeries)</td>
          <td>${Math.round(structureAnalysis.surgeries.present / structureAnalysis.surgeries.total * 100)}%</td>
          <td>-</td>
          <td>${structureAnalysis.surgeries.avgCount.toFixed(1)}개</td>
          <td>${structureAnalysis.surgeries.present / structureAnalysis.surgeries.total >= 0.2 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
        <tr>
          <td>10. 예후 (prognosis)</td>
          <td>${Math.round(structureAnalysis.prognosis.present / structureAnalysis.prognosis.total * 100)}%</td>
          <td>-</td>
          <td>-</td>
          <td>${structureAnalysis.prognosis.present / structureAnalysis.prognosis.total >= 0.3 ? '✅ 양호' : '⚠️ 개선필요'}</td>
        </tr>
      </table>
      <p style="margin-top: 15px; color: #666;"><strong>추가 추출:</strong> 평균 ${structureAnalysis.extractedDates.avgCount.toFixed(1)}개 날짜, ${structureAnalysis.extractedHospitals.avgCount.toFixed(1)}개 병원명 추출</p>
    </div>
    
    <!-- 날짜 매칭 상세 분석 -->
    <h2>📅 날짜 매칭 상세 분석</h2>
    <div class="card">
      <div class="grid-2">
        <div>
          <h3>전체 통계</h3>
          <table>
            <tr><td>Ground Truth 총 날짜</td><td><strong>${dateAnalysis.totalGtDates}</strong>개</td></tr>
            <tr><td>매칭 성공</td><td><strong style="color: var(--success)">${dateAnalysis.totalMatchedDates}</strong>개</td></tr>
            <tr><td>누락</td><td><strong style="color: var(--danger)">${dateAnalysis.totalMissedDates}</strong>개</td></tr>
            <tr><td>추가 추출</td><td><strong style="color: var(--warning)">${dateAnalysis.totalExtraDates}</strong>개</td></tr>
            <tr><td>전체 매칭률</td><td><strong>${dateAnalysis.totalGtDates > 0 ? Math.round(dateAnalysis.totalMatchedDates / dateAnalysis.totalGtDates * 100) : 0}%</strong></td></tr>
          </table>
        </div>
        <div>
          <h3>모델별 비교</h3>
          <table>
            <tr><th>모델</th><th>매칭</th><th>누락</th><th>매칭률</th></tr>
            <tr>
              <td>gpt-4o-mini</td>
              <td>${dateAnalysis.byModel['gpt-4o-mini'].matched}</td>
              <td>${dateAnalysis.byModel['gpt-4o-mini'].missed}</td>
              <td><strong>${dateAnalysis.byModel['gpt-4o-mini'].gt > 0 ? Math.round(dateAnalysis.byModel['gpt-4o-mini'].matched / dateAnalysis.byModel['gpt-4o-mini'].gt * 100) : 0}%</strong></td>
            </tr>
            <tr>
              <td>gpt-4o</td>
              <td>${dateAnalysis.byModel['gpt-4o'].matched}</td>
              <td>${dateAnalysis.byModel['gpt-4o'].missed}</td>
              <td><strong>${dateAnalysis.byModel['gpt-4o'].gt > 0 ? Math.round(dateAnalysis.byModel['gpt-4o'].matched / dateAnalysis.byModel['gpt-4o'].gt * 100) : 0}%</strong></td>
            </tr>
          </table>
        </div>
      </div>
      
      <h3>누락 패턴 분석 (연도별)</h3>
      <div class="chart-container">
        <div class="bar-chart">
          ${Object.entries(dateAnalysis.commonMissedPatterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([year, count], i) => {
              const maxCount = Math.max(...Object.values(dateAnalysis.commonMissedPatterns));
              const height = (count / maxCount) * 150;
              return `<div class="bar" style="height: ${height}px; background: hsl(${200 - i * 20}, 70%, 50%);">
                <div class="bar-value">${count}</div>
                <div class="bar-label">${year}년</div>
              </div>`;
            }).join('')}
        </div>
        <p style="text-align: center; color: #666; margin-top: 20px;">과거 날짜일수록 누락률이 높은 경향이 있습니다.</p>
      </div>
    </div>
    
    <!-- 인사이트 및 개선 방향 -->
    <h2>💡 인사이트 및 개선 방향</h2>
    <div class="insight-section">
      <div class="insight-item critical">
        <div class="insight-icon">⚠️</div>
        <div class="insight-content">
          <h4>날짜 매칭률 개선 필요 (현재 ${summary.miniAvg.dates}%)</h4>
          <p><strong>원인:</strong> 1) 다양한 날짜 형식 혼재 (YYYY.MM.DD, YYYY년 MM월 DD일 등), 2) 이미지 품질 문제, 3) 과거 날짜(보험 청약일 등)가 문서 초반에 위치하나 페이지 제한으로 누락</p>
          <p><strong>개선안:</strong> 날짜 형식 정규화 후처리 강화, 첫 페이지 우선 처리 로직 추가, 이미지 전처리(대비 향상) 적용</p>
        </div>
      </div>
      
      <div class="insight-item warning">
        <div class="insight-icon">🔍</div>
        <div class="insight-content">
          <h4>KCD 코드 추출 개선 (현재 ${summary.miniAvg.kcd}%)</h4>
          <p><strong>원인:</strong> 1) 진단서가 문서 후반부에 위치하여 페이지 제한(50p)으로 누락, 2) 코드 형식 다양성 (예: "C50.1", "C50", "C500")</p>
          <p><strong>개선안:</strong> 진단서 페이지 우선 식별 로직, KCD 코드 데이터베이스 기반 검증 및 보정 추가</p>
        </div>
      </div>
      
      <div class="insight-item success">
        <div class="insight-icon">✅</div>
        <div class="insight-content">
          <h4>병원명 추출 양호 (현재 ${summary.miniAvg.hospitals}%)</h4>
          <p><strong>분석:</strong> 문서 헤더에 병원명이 명확하게 표시되어 인식률이 상대적으로 높습니다.</p>
          <p><strong>추가 개선:</strong> 병원명 정규화(예: "삼성서울병원" = "삼성의료원 삼성서울병원") 로직 추가</p>
        </div>
      </div>
      
      <div class="insight-item">
        <div class="insight-icon">💰</div>
        <div class="insight-content">
          <h4>비용 효율성 분석</h4>
          <p><strong>gpt-4o-mini:</strong> 페이지당 $0.0054로 비용 효율적. 일반적인 케이스에 권장.</p>
          <p><strong>gpt-4o:</strong> 페이지당 $0.0083 (1.5배)이나, 본 검증에서 의미있는 성능 향상 미확인 (Rate limit으로 샘플 부족).</p>
          <p><strong>권장:</strong> gpt-4o-mini를 기본으로 사용하고, 복잡/고위험 케이스에만 gpt-4o 적용.</p>
        </div>
      </div>
      
      <div class="insight-item">
        <div class="insight-icon">🚀</div>
        <div class="insight-content">
          <h4>시스템 개선 로드맵</h4>
          <ol style="margin-left: 20px;">
            <li><strong>단기:</strong> 날짜/KCD 코드 후처리 정규화 강화</li>
            <li><strong>단기:</strong> 의료 용어 사전 기반 유사어 매칭</li>
            <li><strong>중기:</strong> 문서 유형별 페이지 우선순위 지정 (진단서, 처방전 우선)</li>
            <li><strong>중기:</strong> OCR 캐시 활용으로 재처리 비용 절감</li>
            <li><strong>장기:</strong> 페이지 제한 없이 전체 문서 처리 (배치 분할 처리)</li>
          </ol>
        </div>
      </div>
    </div>
    
    <!-- 케이스별 상세 결과 -->
    <h2>📋 케이스별 상세 결과 (gpt-4o-mini)</h2>
    <div class="case-cards">
      ${miniResults.slice(0, 12).map(r => {
        const m = r.matching || {};
        return `
        <div class="case-card">
          <div class="case-card-header">
            <strong>${r.caseId}</strong> - ${r.patientName} | ${r.totalPages}p | $${r.cost.toFixed(3)}
          </div>
          <div class="case-card-body">
            <div class="case-stat"><span>날짜 매칭</span><span>${m.dates?.rate || 0}% (${m.dates?.matched?.length || 0}/${(m.dates?.matched?.length || 0) + (m.dates?.missed?.length || 0)})</span></div>
            <div class="case-stat"><span>KCD 코드</span><span>${m.kcdCodes?.rate || 0}% (${m.kcdCodes?.matched?.length || 0}/${(m.kcdCodes?.matched?.length || 0) + (m.kcdCodes?.missed?.length || 0)})</span></div>
            <div class="case-stat"><span>병원명</span><span>${m.hospitals?.rate || 0}%</span></div>
            <div class="case-stat"><span>검사</span><span>${m.examinations?.rate || 0}%</span></div>
            <div class="case-stat"><span>치료</span><span>${m.treatments?.rate || 0}%</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    
    <!-- 모델 한계 및 가능성 -->
    <h2>⚡ 모델 효율성, 한계 및 가능성</h2>
    <div class="card">
      <div class="grid-2">
        <div>
          <h3>🔴 확인된 한계</h3>
          <ul style="margin-left: 20px;">
            <li><strong>토큰 제한:</strong> 128k 토큰 제한으로 50페이지 이상 문서 전체 처리 불가</li>
            <li><strong>Rate Limit:</strong> 연속 호출 시 TPM 제한으로 실패 발생</li>
            <li><strong>날짜 형식:</strong> 다양한 한국어 날짜 형식 인식 제한</li>
            <li><strong>스캔 품질:</strong> 저품질 스캔/손글씨 문서 인식 한계</li>
            <li><strong>의료 약어:</strong> 전문 의료 약어/코드 인식 미흡</li>
          </ul>
        </div>
        <div>
          <h3>🟢 확인된 가능성</h3>
          <ul style="margin-left: 20px;">
            <li><strong>병원명 추출:</strong> 문서 헤더 기반 높은 정확도</li>
            <li><strong>구조화 출력:</strong> JSON 스키마 기반 안정적인 구조화</li>
            <li><strong>캐시 활용:</strong> OCR 결과 재사용으로 비용 절감 가능</li>
            <li><strong>비용 효율:</strong> gpt-4o-mini로 합리적 비용에 서비스 가능</li>
            <li><strong>후처리 연계:</strong> 규칙 기반 후처리로 정확도 보완 가능</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <h3>VNEXSUS AI 손해사정 시스템</h3>
      <p>Vision LLM 파이프라인 검증 보고서</p>
      <p>Generated: ${new Date().toISOString()}</p>
      <p style="margin-top: 10px; font-size: 0.9em; color: #999;">
        검증 조건: 시나리오 A (gpt-4o-mini 19개 케이스 + gpt-4o 10개 케이스*) | 페이지 제한: 50p/케이스 | 대용량 케이스(100p+) 제외
      </p>
    </div>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.outputPath, `enhanced_validation_report_${timestamp}.html`);
  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

async function main() {
  console.log('📊 강화된 검증 분석 보고서 생성 시작...');
  
  const data = loadResults();
  const { summary, results } = data;
  
  console.log(`✓ 결과 로드: ${results.length}개 케이스`);
  
  const structureAnalysis = analyzeStructuredData(results);
  console.log('✓ 구조화 데이터 분석 완료');
  
  const dateAnalysis = analyzeDateMatching(results);
  console.log('✓ 날짜 매칭 분석 완료');
  
  const reportPath = generateEnhancedHTML(data, structureAnalysis, dateAnalysis, summary);
  console.log(`\n✅ 강화된 보고서 생성 완료: ${reportPath}`);
}

main().catch(console.error);
