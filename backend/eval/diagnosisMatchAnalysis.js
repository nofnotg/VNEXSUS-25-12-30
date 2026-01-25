/**
 * 🔍 진단 매칭률 상세 분석 스크립트
 * 
 * 분석 항목:
 * 1. KCD 코드 매칭률
 * 2. 날짜 매칭률
 * 3. 내용(진단명) 매칭률
 * 4. 병원명 매칭률
 * 5. 치료내용 매칭률
 * 
 * 산출물: 상세 매칭률 보고서 및 개선 방안
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALIDATION_DIR = path.join(__dirname, 'output/validation');
const CASE_SAMPLE_DIR = path.join(__dirname, '../../src/rag/case_sample');

// =================================================================
// KCD 코드 추출 (다양한 형식 지원)
// =================================================================
function extractKCDCodes(text) {
  // 다양한 KCD 코드 패턴
  const patterns = [
    /\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g,           // (E11.78) 형식
    /\[([A-Z]\d{2}(?:\.\d{1,2})?)\]/g,           // [E11.78] 형식
    /([A-Z]\d{2}\.\d{1,2})/g,                     // E11.78 형식 (점 포함)
    /(?:진단명|진 단 명)\s*[:\ㅣ]\s*[^(]*\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g  // 진단명: ... (E11.78)
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

// =================================================================
// 날짜 추출 (다양한 형식 지원)
// =================================================================
function extractDates(text) {
  const patterns = [
    /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,  // 2025.02.17, 2025-02-17
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,    // 2025년 2월 17일
  ];
  
  const dates = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      dates.add(`${year}-${month}-${day}`);
    }
  }
  
  return [...dates];
}

// =================================================================
// 병원명 추출
// =================================================================
function extractHospitals(text) {
  const patterns = [
    /([가-힣]+(?:병원|의원|의료원|클리닉|센터|메디컬))/g,
    /([가-힣]+대학교\s*[가-힣]*병원)/g,
  ];
  
  const hospitals = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      hospitals.add(match[1].replace(/\s+/g, ''));
    }
  }
  
  return [...hospitals];
}

// =================================================================
// 진단명(한글) 추출
// =================================================================
function extractDiagnosisNames(text) {
  const patterns = [
    /진\s*단\s*명\s*[:\ㅣ]?\s*([^(]+)\(/g,       // 진단명: 당뇨병(E11)
    /['']([가-힣\s]+(?:병|증|염|암|종|질환|장애))[']/g,  // '당뇨병'
  ];
  
  const names = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      if (name.length > 2 && name.length < 30) {
        names.add(name);
      }
    }
  }
  
  return [...names];
}

// =================================================================
// AI 생성 JSON에서 정보 추출
// =================================================================
function extractFromGeneratedJson(json) {
  const result = {
    kcdCodes: [],
    dates: [],
    hospitals: [],
    diagnosisNames: []
  };
  
  // 진단 정보
  if (json.diagnoses && Array.isArray(json.diagnoses)) {
    for (const d of json.diagnoses) {
      if (d.code) result.kcdCodes.push(d.code);
      if (d.date) result.dates.push(d.date);
      if (d.hospital) result.hospitals.push(d.hospital);
      if (d.nameKr) result.diagnosisNames.push(d.nameKr);
    }
  }
  
  // 검사 정보
  if (json.examinations && Array.isArray(json.examinations)) {
    for (const e of json.examinations) {
      if (e.date) result.dates.push(e.date);
    }
  }
  
  // 치료 정보
  if (json.treatments && Array.isArray(json.treatments)) {
    for (const t of json.treatments) {
      if (t.date) result.dates.push(t.date);
      if (t.hospital) result.hospitals.push(t.hospital);
    }
  }
  
  // 입원/통원 정보
  if (json.admissionPeriod) {
    if (json.admissionPeriod.startDate) result.dates.push(json.admissionPeriod.startDate);
    if (json.admissionPeriod.endDate) result.dates.push(json.admissionPeriod.endDate);
    if (json.admissionPeriod.hospital) result.hospitals.push(json.admissionPeriod.hospital);
  }
  
  if (json.outpatientPeriod) {
    if (json.outpatientPeriod.startDate) result.dates.push(json.outpatientPeriod.startDate);
    if (json.outpatientPeriod.endDate) result.dates.push(json.outpatientPeriod.endDate);
    if (json.outpatientPeriod.hospitals) {
      result.hospitals.push(...json.outpatientPeriod.hospitals);
    }
  }
  
  // 과거력
  if (json.pastHistory && Array.isArray(json.pastHistory)) {
    for (const p of json.pastHistory) {
      if (p.code) result.kcdCodes.push(p.code);
      if (p.condition) result.diagnosisNames.push(p.condition);
    }
  }
  
  // 중복 제거
  result.kcdCodes = [...new Set(result.kcdCodes)];
  result.dates = [...new Set(result.dates)];
  result.hospitals = [...new Set(result.hospitals.map(h => h.replace(/\s+/g, '')))];
  result.diagnosisNames = [...new Set(result.diagnosisNames)];
  
  return result;
}

// =================================================================
// 매칭률 계산
// =================================================================
function calculateMatchRate(generated, groundTruth) {
  if (groundTruth.length === 0) return { rate: 1, matched: 0, total: 0, missing: [], extra: [] };
  
  const matched = generated.filter(g => groundTruth.some(gt => 
    gt.toLowerCase().includes(g.toLowerCase()) || 
    g.toLowerCase().includes(gt.toLowerCase()) ||
    gt === g
  ));
  
  const missing = groundTruth.filter(gt => !generated.some(g => 
    gt.toLowerCase().includes(g.toLowerCase()) || 
    g.toLowerCase().includes(gt.toLowerCase()) ||
    gt === g
  ));
  
  const extra = generated.filter(g => !groundTruth.some(gt => 
    gt.toLowerCase().includes(g.toLowerCase()) || 
    g.toLowerCase().includes(gt.toLowerCase()) ||
    gt === g
  ));
  
  return {
    rate: matched.length / groundTruth.length,
    matched: matched.length,
    total: groundTruth.length,
    missing,
    extra
  };
}

// =================================================================
// KCD 코드 정규화 (E11 → E11.9 등)
// =================================================================
function normalizeKCDCode(code) {
  // 소수점 없는 코드는 .9로 가정 (상세불명)
  if (/^[A-Z]\d{2}$/.test(code)) {
    return code + '.9';
  }
  return code;
}

function calculateKCDMatchRate(generated, groundTruth) {
  if (groundTruth.length === 0) return { rate: 1, matched: 0, total: 0, details: [] };
  
  const normalizedGen = generated.map(normalizeKCDCode);
  const normalizedGT = groundTruth.map(normalizeKCDCode);
  
  const details = [];
  let matchedCount = 0;
  
  for (const gtCode of normalizedGT) {
    // 정확히 일치
    const exactMatch = normalizedGen.find(g => g === gtCode);
    if (exactMatch) {
      details.push({ gtCode, genCode: exactMatch, matchType: 'exact', matched: true });
      matchedCount++;
      continue;
    }
    
    // 상위 카테고리 일치 (E11.78 vs E11.9 → E11.* 일치)
    const baseGT = gtCode.split('.')[0];
    const categoryMatch = normalizedGen.find(g => g.startsWith(baseGT));
    if (categoryMatch) {
      details.push({ gtCode, genCode: categoryMatch, matchType: 'category', matched: true });
      matchedCount += 0.7; // 부분 점수
      continue;
    }
    
    details.push({ gtCode, genCode: null, matchType: 'missing', matched: false });
  }
  
  // 추가로 생성된 코드 (오탐)
  for (const genCode of normalizedGen) {
    const baseGen = genCode.split('.')[0];
    const exists = normalizedGT.some(gt => gt.startsWith(baseGen));
    if (!exists) {
      details.push({ gtCode: null, genCode, matchType: 'extra', matched: false });
    }
  }
  
  return {
    rate: matchedCount / groundTruth.length,
    matched: matchedCount,
    total: groundTruth.length,
    details
  };
}

// =================================================================
// 케이스별 상세 분석
// =================================================================
async function analyzeCaseInDetail(caseNum) {
  const phase1Path = path.join(VALIDATION_DIR, `phase1_case${caseNum}_4omini.json`);
  const gtPath = path.join(CASE_SAMPLE_DIR, `Case${caseNum}_report.txt`);
  
  if (!fs.existsSync(phase1Path) || !fs.existsSync(gtPath)) {
    return null;
  }
  
  const phase1 = JSON.parse(fs.readFileSync(phase1Path, 'utf-8'));
  const groundTruth = fs.readFileSync(gtPath, 'utf-8');
  
  // Ground Truth에서 정보 추출
  const gtKCDCodes = extractKCDCodes(groundTruth);
  const gtDates = extractDates(groundTruth);
  const gtHospitals = extractHospitals(groundTruth);
  const gtDiagnosisNames = extractDiagnosisNames(groundTruth);
  
  // 생성된 JSON에서 정보 추출
  const generated = extractFromGeneratedJson(phase1.generatedJson);
  
  // 매칭률 계산
  const kcdMatch = calculateKCDMatchRate(generated.kcdCodes, gtKCDCodes);
  const dateMatch = calculateMatchRate(generated.dates, gtDates);
  const hospitalMatch = calculateMatchRate(generated.hospitals, gtHospitals);
  const diagnosisMatch = calculateMatchRate(generated.diagnosisNames, gtDiagnosisNames);
  
  return {
    caseNum,
    groundTruth: {
      kcdCodes: gtKCDCodes,
      dates: gtDates,
      hospitals: gtHospitals,
      diagnosisNames: gtDiagnosisNames
    },
    generated: {
      kcdCodes: generated.kcdCodes,
      dates: generated.dates,
      hospitals: generated.hospitals,
      diagnosisNames: generated.diagnosisNames
    },
    matchRates: {
      kcdCode: kcdMatch,
      date: dateMatch,
      hospital: hospitalMatch,
      diagnosisName: diagnosisMatch
    }
  };
}

// =================================================================
// 문제점 분석 및 개선 방안 도출
// =================================================================
function analyzeProblems(results) {
  const problems = {
    kcdCode: { issues: [], frequency: {}, avgRate: 0 },
    date: { issues: [], frequency: {}, avgRate: 0 },
    hospital: { issues: [], frequency: {}, avgRate: 0 },
    diagnosisName: { issues: [], frequency: {}, avgRate: 0 }
  };
  
  let totalKCD = 0, totalDate = 0, totalHospital = 0, totalDiagnosis = 0;
  
  for (const r of results) {
    // KCD 코드 문제
    totalKCD += r.matchRates.kcdCode.rate;
    for (const detail of r.matchRates.kcdCode.details) {
      if (detail.matchType === 'missing') {
        problems.kcdCode.issues.push({
          caseNum: r.caseNum,
          type: 'missing',
          gtCode: detail.gtCode,
          message: `Ground Truth에 있는 ${detail.gtCode}가 생성되지 않음`
        });
      } else if (detail.matchType === 'category') {
        problems.kcdCode.issues.push({
          caseNum: r.caseNum,
          type: 'partial',
          gtCode: detail.gtCode,
          genCode: detail.genCode,
          message: `${detail.gtCode} → ${detail.genCode} (카테고리만 일치)`
        });
      } else if (detail.matchType === 'extra') {
        problems.kcdCode.issues.push({
          caseNum: r.caseNum,
          type: 'extra',
          genCode: detail.genCode,
          message: `Ground Truth에 없는 ${detail.genCode}가 추가로 생성됨`
        });
      }
    }
    
    // 날짜 문제
    totalDate += r.matchRates.date.rate;
    if (r.matchRates.date.missing.length > 0) {
      problems.date.issues.push({
        caseNum: r.caseNum,
        type: 'missing',
        dates: r.matchRates.date.missing,
        message: `누락된 날짜: ${r.matchRates.date.missing.join(', ')}`
      });
    }
    
    // 병원 문제
    totalHospital += r.matchRates.hospital.rate;
    if (r.matchRates.hospital.missing.length > 0) {
      problems.hospital.issues.push({
        caseNum: r.caseNum,
        type: 'missing',
        hospitals: r.matchRates.hospital.missing,
        message: `누락된 병원: ${r.matchRates.hospital.missing.join(', ')}`
      });
    }
    
    // 진단명 문제
    totalDiagnosis += r.matchRates.diagnosisName.rate;
  }
  
  problems.kcdCode.avgRate = Math.round((totalKCD / results.length) * 100);
  problems.date.avgRate = Math.round((totalDate / results.length) * 100);
  problems.hospital.avgRate = Math.round((totalHospital / results.length) * 100);
  problems.diagnosisName.avgRate = Math.round((totalDiagnosis / results.length) * 100);
  
  return problems;
}

// =================================================================
// 개선 방안 생성
// =================================================================
function generateImprovementPlan(problems) {
  const plan = {
    priority: [],
    improvements: []
  };
  
  // 우선순위 결정 (매칭률이 낮은 순)
  const metrics = [
    { name: 'KCD 코드', rate: problems.kcdCode.avgRate, key: 'kcdCode' },
    { name: '날짜', rate: problems.date.avgRate, key: 'date' },
    { name: '병원명', rate: problems.hospital.avgRate, key: 'hospital' },
    { name: '진단명', rate: problems.diagnosisName.avgRate, key: 'diagnosisName' }
  ].sort((a, b) => a.rate - b.rate);
  
  plan.priority = metrics;
  
  // KCD 코드 개선 방안
  if (problems.kcdCode.avgRate < 70) {
    plan.improvements.push({
      target: 'KCD 코드 매칭',
      currentRate: problems.kcdCode.avgRate,
      rootCause: [
        '1. KCD 코드 형식 불일치 (E11 vs E11.78)',
        '2. 상위 카테고리만 추출하고 세부 코드 누락',
        '3. Ground Truth에 있는 과거력 코드 미추출',
        '4. 청구 관련 코드만 추출하고 병력 코드 누락'
      ],
      solutions: [
        {
          priority: 'HIGH',
          action: '프롬프트에 KCD 코드 완전성 강조',
          detail: '모든 진단명에 KCD 코드를 세부 코드까지 포함하도록 명시',
          implementation: 'enhancedPromptBuilder.js의 systemPrompt에 추가'
        },
        {
          priority: 'HIGH',
          action: 'KCD 코드 정규화 후처리 추가',
          detail: 'E11 → E11.9 자동 변환, 형식 통일',
          implementation: 'structuredReportGenerator.js에 normalizeKCDCode 함수 추가'
        },
        {
          priority: 'MEDIUM',
          action: '과거력 KCD 코드 추출 강화',
          detail: '병력 섹션에서도 KCD 코드 추출하도록 프롬프트 수정',
          implementation: '프롬프트에 "과거력의 모든 질환에도 KCD 코드 포함" 명시'
        }
      ]
    });
  }
  
  // 날짜 매칭 개선 방안
  if (problems.date.avgRate < 70) {
    plan.improvements.push({
      target: '날짜 매칭',
      currentRate: problems.date.avgRate,
      rootCause: [
        '1. 날짜 형식 불일치 (2025.02.17 vs 2025-02-17)',
        '2. 과거 병력 날짜 누락',
        '3. 보험 가입일/갱신일 미추출'
      ],
      solutions: [
        {
          priority: 'HIGH',
          action: '날짜 형식 통일 후처리',
          detail: 'YYYY-MM-DD 형식으로 자동 정규화',
          implementation: 'structuredReportGenerator.js에 normalizeDate 함수 추가'
        },
        {
          priority: 'MEDIUM',
          action: '전체 날짜 스캔 범위 확대',
          detail: '현재 2000~2025 → 1990~2030으로 확대',
          implementation: '프롬프트의 날짜 스캔 범위 수정'
        }
      ]
    });
  }
  
  // 병원명 매칭 개선 방안
  if (problems.hospital.avgRate < 80) {
    plan.improvements.push({
      target: '병원명 매칭',
      currentRate: problems.hospital.avgRate,
      rootCause: [
        '1. 병원명 표기 불일치 (강남성심병원 vs 한림대학교 강남성심병원)',
        '2. 의원명 축약 (이기섭의원 vs 이깁서의원 - OCR 오류)',
        '3. 과거 통원 병원 누락'
      ],
      solutions: [
        {
          priority: 'MEDIUM',
          action: '병원명 정규화 사전 구축',
          detail: '공식 명칭 ↔ 약칭 매핑 테이블 구축',
          implementation: 'hospitalNormalizer.js 신규 생성'
        },
        {
          priority: 'LOW',
          action: 'OCR 오류 보정',
          detail: '흔한 OCR 오류 패턴 자동 수정',
          implementation: 'ocrPostProcessor.js에 병원명 보정 로직 추가'
        }
      ]
    });
  }
  
  return plan;
}

// =================================================================
// HTML 보고서 생성
// =================================================================
function generateDetailedHTMLReport(results, problems, plan) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS 진단 매칭률 상세 분석 보고서</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; padding: 20px; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { text-align: center; color: #1a1a2e; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; border-radius: 16px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); text-align: center; }
    .summary-card h3 { color: #666; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .summary-card .value { font-size: 42px; font-weight: bold; }
    .summary-card .subvalue { font-size: 13px; color: #888; margin-top: 5px; }
    .rate-good { color: #10b981; }
    .rate-medium { color: #f59e0b; }
    .rate-bad { color: #ef4444; }
    .section { background: white; border-radius: 16px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
    .section h2 { color: #1a1a2e; margin-bottom: 20px; font-size: 20px; display: flex; align-items: center; gap: 10px; }
    .section h2::before { content: ''; width: 4px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; color: #555; font-weight: 600; font-size: 13px; }
    tr:hover { background: #fafafa; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .improvement-card { background: linear-gradient(135deg, #667eea08 0%, #764ba208 100%); border: 1px solid #667eea20; border-radius: 12px; padding: 20px; margin-bottom: 15px; }
    .improvement-card h4 { color: #667eea; margin-bottom: 10px; }
    .root-cause { background: #fff5f5; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; }
    .root-cause h5 { color: #ef4444; margin-bottom: 10px; }
    .solution { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 10px 0; border-radius: 0 8px 8px 0; }
    .solution h5 { color: #10b981; margin-bottom: 8px; }
    .priority-high { color: #ef4444; font-weight: bold; }
    .priority-medium { color: #f59e0b; font-weight: bold; }
    .priority-low { color: #10b981; font-weight: bold; }
    .case-analysis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
    .case-card { background: #f8f9fa; border-radius: 10px; padding: 15px; }
    .case-card h5 { color: #333; margin-bottom: 10px; font-size: 14px; }
    .code-list { font-family: monospace; font-size: 12px; color: #666; }
    .match-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; }
    .match-yes { background: #10b981; }
    .match-partial { background: #f59e0b; }
    .match-no { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 진단 매칭률 상세 분석 보고서</h1>
    <p class="subtitle">GPT-4o-mini 보고서 생성 품질 분석 | ${new Date().toLocaleDateString('ko-KR')}</p>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>KCD 코드</h3>
        <div class="value ${problems.kcdCode.avgRate >= 70 ? 'rate-good' : problems.kcdCode.avgRate >= 50 ? 'rate-medium' : 'rate-bad'}">${problems.kcdCode.avgRate}%</div>
        <div class="subvalue">진단 코드 매칭률</div>
      </div>
      <div class="summary-card">
        <h3>날짜</h3>
        <div class="value ${problems.date.avgRate >= 70 ? 'rate-good' : problems.date.avgRate >= 50 ? 'rate-medium' : 'rate-bad'}">${problems.date.avgRate}%</div>
        <div class="subvalue">날짜 정보 매칭률</div>
      </div>
      <div class="summary-card">
        <h3>병원명</h3>
        <div class="value ${problems.hospital.avgRate >= 70 ? 'rate-good' : problems.hospital.avgRate >= 50 ? 'rate-medium' : 'rate-bad'}">${problems.hospital.avgRate}%</div>
        <div class="subvalue">병원 정보 매칭률</div>
      </div>
      <div class="summary-card">
        <h3>진단명</h3>
        <div class="value ${problems.diagnosisName.avgRate >= 70 ? 'rate-good' : problems.diagnosisName.avgRate >= 50 ? 'rate-medium' : 'rate-bad'}">${problems.diagnosisName.avgRate}%</div>
        <div class="subvalue">진단명 텍스트 매칭률</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 우선순위별 개선 필요 항목</h2>
      <table>
        <thead>
          <tr>
            <th>순위</th>
            <th>항목</th>
            <th>현재 매칭률</th>
            <th>목표</th>
            <th>갭</th>
            <th>개선 우선도</th>
          </tr>
        </thead>
        <tbody>
          ${plan.priority.map((p, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${p.name}</td>
              <td><span class="badge ${p.rate >= 70 ? 'badge-success' : p.rate >= 50 ? 'badge-warning' : 'badge-danger'}">${p.rate}%</span></td>
              <td>80%</td>
              <td>${p.rate >= 80 ? '달성' : `${80 - p.rate}%p 부족`}</td>
              <td><span class="${p.rate < 50 ? 'priority-high' : p.rate < 70 ? 'priority-medium' : 'priority-low'}">${p.rate < 50 ? 'HIGH' : p.rate < 70 ? 'MEDIUM' : 'LOW'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>🔬 문제 원인 분석 및 개선 방안</h2>
      ${plan.improvements.map(imp => `
        <div class="improvement-card">
          <h4>${imp.target} (현재: ${imp.currentRate}%)</h4>
          
          <div class="root-cause">
            <h5>🔍 근본 원인</h5>
            <ul>
              ${imp.rootCause.map(rc => `<li>${rc}</li>`).join('')}
            </ul>
          </div>
          
          ${imp.solutions.map(sol => `
            <div class="solution">
              <h5>✅ [${sol.priority}] ${sol.action}</h5>
              <p><strong>상세:</strong> ${sol.detail}</p>
              <p><strong>구현 위치:</strong> <code>${sol.implementation}</code></p>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
    
    <div class="section">
      <h2>📋 케이스별 상세 비교</h2>
      <div class="case-analysis">
        ${results.slice(0, 10).map(r => `
          <div class="case-card">
            <h5>Case ${r.caseNum}</h5>
            <table style="font-size: 12px;">
              <tr>
                <td>KCD 코드</td>
                <td><span class="badge ${r.matchRates.kcdCode.rate >= 0.7 ? 'badge-success' : r.matchRates.kcdCode.rate >= 0.5 ? 'badge-warning' : 'badge-danger'}">${Math.round(r.matchRates.kcdCode.rate * 100)}%</span></td>
                <td class="code-list">${r.groundTruth.kcdCodes.slice(0, 3).join(', ') || 'N/A'}</td>
              </tr>
              <tr>
                <td>날짜</td>
                <td><span class="badge ${r.matchRates.date.rate >= 0.7 ? 'badge-success' : r.matchRates.date.rate >= 0.5 ? 'badge-warning' : 'badge-danger'}">${Math.round(r.matchRates.date.rate * 100)}%</span></td>
                <td class="code-list">${r.matchRates.date.matched}/${r.matchRates.date.total}</td>
              </tr>
              <tr>
                <td>병원</td>
                <td><span class="badge ${r.matchRates.hospital.rate >= 0.7 ? 'badge-success' : r.matchRates.hospital.rate >= 0.5 ? 'badge-warning' : 'badge-danger'}">${Math.round(r.matchRates.hospital.rate * 100)}%</span></td>
                <td class="code-list">${r.matchRates.hospital.matched}/${r.matchRates.hospital.total}</td>
              </tr>
            </table>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="section">
      <h2>🎯 즉시 적용 가능한 개선사항</h2>
      <ol style="padding-left: 20px;">
        <li><strong>프롬프트 수정</strong>: KCD 코드를 세부 코드(E11.78)까지 포함하도록 명시</li>
        <li><strong>후처리 추가</strong>: KCD 코드 정규화 (E11 → E11.9 자동 변환)</li>
        <li><strong>날짜 형식 통일</strong>: 모든 날짜를 YYYY-MM-DD 형식으로 정규화</li>
        <li><strong>과거력 강화</strong>: 5년 이내 병력의 모든 진단 코드 추출 강조</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
      Generated: ${new Date().toISOString()} | VNEXSUS Diagnosis Match Analysis
    </div>
  </div>
</body>
</html>
`;
  return html;
}

// =================================================================
// 메인 실행
// =================================================================
async function main() {
  console.log('═'.repeat(60));
  console.log('🔍 진단 매칭률 상세 분석');
  console.log('═'.repeat(60));
  
  // Phase 1 결과 파일 목록
  const phase1Files = fs.readdirSync(VALIDATION_DIR)
    .filter(f => f.startsWith('phase1_case') && f.endsWith('_4omini.json'));
  
  console.log(`\n📂 분석 대상: ${phase1Files.length}개 케이스`);
  
  // 케이스별 분석
  const results = [];
  for (const file of phase1Files) {
    const match = file.match(/phase1_case(\d+)_4omini\.json/);
    if (!match) continue;
    
    const caseNum = parseInt(match[1]);
    const analysis = await analyzeCaseInDetail(caseNum);
    if (analysis) {
      results.push(analysis);
    }
  }
  
  console.log(`\n✅ 분석 완료: ${results.length}개 케이스`);
  
  // 문제점 분석
  const problems = analyzeProblems(results);
  
  // 결과 출력
  console.log('\n' + '─'.repeat(60));
  console.log('📊 매칭률 요약');
  console.log('─'.repeat(60));
  console.log(`  KCD 코드:  ${problems.kcdCode.avgRate}%`);
  console.log(`  날짜:      ${problems.date.avgRate}%`);
  console.log(`  병원명:    ${problems.hospital.avgRate}%`);
  console.log(`  진단명:    ${problems.diagnosisName.avgRate}%`);
  
  // 개선 방안 생성
  const plan = generateImprovementPlan(problems);
  
  console.log('\n' + '─'.repeat(60));
  console.log('🎯 개선 우선순위');
  console.log('─'.repeat(60));
  plan.priority.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.rate}% → 목표 80%`);
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log('💡 주요 개선 방안');
  console.log('─'.repeat(60));
  for (const imp of plan.improvements) {
    console.log(`\n[${imp.target}] 현재 ${imp.currentRate}%`);
    console.log('  원인:');
    imp.rootCause.slice(0, 2).forEach(rc => console.log(`    - ${rc}`));
    console.log('  해결책:');
    imp.solutions.slice(0, 2).forEach(sol => console.log(`    - [${sol.priority}] ${sol.action}`));
  }
  
  // HTML 보고서 생성
  const html = generateDetailedHTMLReport(results, problems, plan);
  const htmlPath = path.join(VALIDATION_DIR, 'diagnosis_match_analysis.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`\n📄 HTML 보고서: ${htmlPath}`);
  
  // JSON 결과 저장
  const jsonPath = path.join(VALIDATION_DIR, 'diagnosis_match_analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ problems, plan, results }, null, 2));
  console.log(`📄 JSON 데이터: ${jsonPath}`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ 분석 완료');
  console.log('═'.repeat(60));
}

main().catch(console.error);
