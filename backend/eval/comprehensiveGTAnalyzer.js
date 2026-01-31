/**
 * 종합 GT 분석 - 의료 vs 보험 분류 및 항목별 분석
 *
 * 핵심:
 * - 보험 관련 내용은 GT 지표에서 별도로 분류
 * - 의료 이벤트 날짜와 내용이 GT 검증의 목표
 * - 항목별 상세 분석 (9-10항목 보고서 형식)
 *
 * 실행: node backend/eval/comprehensiveGTAnalyzer.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  cycle4CacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  outputDir: path.join(__dirname, 'output/comprehensive_gt_analysis'),
  reportsDir: path.join(__dirname, 'output/comprehensive_gt_analysis/reports'),

  groundTruthDir: '/home/user/VNEXSUS-25-12-30/src/rag/case_sample',

  targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44]
};

// 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * GT 날짜 카테고리 분류기
 */
class GTDateCategorizer {
  constructor() {
    // 의료 이벤트 키워드
    this.medicalKeywords = {
      visit: ['내원', '진료', '외래', '통원', '방문', '초진', '재진'],
      admission: ['입원', '재원'],
      discharge: ['퇴원'],
      surgery: ['수술', '시술', '처치'],
      examination: ['검사', 'CT', 'MRI', 'X-ray', 'X선', '촬영', '조직검사', '병리검사', '혈액검사'],
      diagnosis: ['진단', '소견', '판정', '확진'],
      treatment: ['치료', '투약', '주사', '처방']
    };

    // 보험 관련 키워드
    this.insuranceKeywords = {
      start: ['보험가입', '가입일', '보장개시일', '계약일', '보험계약', '청약일'],
      end: ['만기일', '종료일', '갱신일', '해지일'],
      claim: ['청구', '보험금', '지급']
    };

    // 9-10항목 보고서 키워드
    this.reportItemKeywords = {
      '1.내원일시': ['내원', '진료', '방문', '외래'],
      '2.내원경위': ['경위', '의뢰', '증상', '주소'],
      '3.진단병명': ['진단', 'diagnosis', 'ICD', 'KCD'],
      '4.검사결과': ['검사', 'test', 'lab', 'CT', 'MRI', 'X-ray'],
      '5.수술후조직검사': ['병리', 'pathology', 'TNM', 'stage'],
      '6.치료내용': ['치료', 'treatment', '수술', '약물', '처치'],
      '7.통원기간': ['통원', 'outpatient'],
      '8.입원기간': ['입원', 'admission', 'hospitalization'],
      '9.과거병력': ['과거', 'past history', '기왕증'],
      '10.의사소견': ['소견', 'opinion', 'impression']
    };
  }

  /**
   * GT 날짜 카테고리 분류
   */
  categorizeDate(date, context) {
    const lowerContext = context.toLowerCase();
    const categories = [];

    // 의료 이벤트 분류
    for (const [type, keywords] of Object.entries(this.medicalKeywords)) {
      if (keywords.some(kw => lowerContext.includes(kw.toLowerCase()))) {
        categories.push(`medical_${type}`);
      }
    }

    // 보험 관련 분류
    for (const [type, keywords] of Object.entries(this.insuranceKeywords)) {
      if (keywords.some(kw => lowerContext.includes(kw.toLowerCase()))) {
        categories.push(`insurance_${type}`);
      }
    }

    // 항목 분류
    for (const [item, keywords] of Object.entries(this.reportItemKeywords)) {
      if (keywords.some(kw => lowerContext.includes(kw.toLowerCase()))) {
        categories.push(`item_${item}`);
      }
    }

    // 카테고리가 없으면 기타
    if (categories.length === 0) {
      categories.push('other');
    }

    // 주 카테고리 결정
    let primaryCategory = 'other';
    if (categories.some(c => c.startsWith('medical_'))) {
      primaryCategory = 'medical';
    } else if (categories.some(c => c.startsWith('insurance_'))) {
      primaryCategory = 'insurance';
    }

    return {
      primaryCategory,
      categories,
      context: context.substring(0, 150)
    };
  }
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// Ground Truth 날짜 추출 (카테고리 포함)
function extractGroundTruthDatesWithCategory(groundTruth, categorizer) {
  const dates = [];

  const patterns = [
    { regex: /(\d{4})\.(\d{1,2})\.(\d{1,2})/g, name: 'YYYY.MM.DD' },
    { regex: /(\d{4})-(\d{1,2})-(\d{1,2})/g, name: 'YYYY-MM-DD' },
    { regex: /(\d{4})\/(\d{1,2})\/(\d{1,2})/g, name: 'YYYY/MM/DD' },
    { regex: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, name: 'YYYY년 MM월 DD일' }
  ];

  for (const { regex, name } of patterns) {
    const regexCopy = new RegExp(regex.source, regex.flags);
    let match;

    while ((match = regexCopy.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');

      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);

      if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const normalizedDate = `${year}-${month}-${day}`;

        // 주변 컨텍스트 추출 (더 넓게)
        const startIdx = Math.max(0, match.index - 100);
        const endIdx = Math.min(groundTruth.length, match.index + match[0].length + 100);
        const context = groundTruth.substring(startIdx, endIdx);

        // 카테고리 분류
        const categoryInfo = categorizer.categorizeDate(normalizedDate, context);

        dates.push({
          date: normalizedDate,
          originalFormat: match[0],
          pattern: name,
          context,
          position: match.index,
          ...categoryInfo
        });
      }
    }
  }

  return dates;
}

// Cycle 4 결과 로드
function loadCycle4Dates(caseNum) {
  const cycle4CachePath = path.join(CONFIG.cycle4CacheDir, `case_${caseNum}_topdown.json`);

  if (!fs.existsSync(cycle4CachePath)) {
    return [];
  }

  const cycle4Data = JSON.parse(fs.readFileSync(cycle4CachePath, 'utf-8'));
  const generatedJson = cycle4Data.generatedJson || {};

  const dates = new Set();

  // allExtractedDates
  if (generatedJson.allExtractedDates) {
    generatedJson.allExtractedDates.forEach(item => {
      const normalized = item.date.split('T')[0];
      if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  // dateRanges
  if (generatedJson.dateRanges) {
    generatedJson.dateRanges.forEach(item => {
      if (item.startDate) {
        const normalized = item.startDate.split('T')[0];
        if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates.add(normalized);
        }
      }
      if (item.endDate) {
        const normalized = item.endDate.split('T')[0];
        if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates.add(normalized);
        }
      }
    });
  }

  // insuranceDates
  if (generatedJson.insuranceDates) {
    generatedJson.insuranceDates.forEach(item => {
      const normalized = item.date.split('T')[0];
      if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  // tableDates
  if (generatedJson.tableDates) {
    generatedJson.tableDates.forEach(item => {
      const normalized = item.date.split('T')[0];
      if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  return Array.from(dates).sort();
}

// 카테고리별 매칭 분석
function analyzeCategoryMatching(extractedDates, gtDates) {
  const extractedSet = new Set(extractedDates);

  // 전체 매칭
  const totalMatched = gtDates.filter(d => extractedSet.has(d.date));
  const totalMissed = gtDates.filter(d => !extractedSet.has(d.date));

  // 의료 이벤트 매칭
  const medicalGT = gtDates.filter(d => d.primaryCategory === 'medical');
  const medicalMatched = medicalGT.filter(d => extractedSet.has(d.date));
  const medicalMissed = medicalGT.filter(d => !extractedSet.has(d.date));

  // 보험 관련 매칭
  const insuranceGT = gtDates.filter(d => d.primaryCategory === 'insurance');
  const insuranceMatched = insuranceGT.filter(d => extractedSet.has(d.date));
  const insuranceMissed = insuranceGT.filter(d => !extractedSet.has(d.date));

  // 기타 매칭
  const otherGT = gtDates.filter(d => d.primaryCategory === 'other');
  const otherMatched = otherGT.filter(d => extractedSet.has(d.date));
  const otherMissed = otherGT.filter(d => !extractedSet.has(d.date));

  return {
    total: {
      gt: gtDates.length,
      matched: totalMatched.length,
      missed: totalMissed.length,
      rate: gtDates.length > 0 ? Math.round((totalMatched.length / gtDates.length) * 100) : 100,
      missedDates: totalMissed
    },
    medical: {
      gt: medicalGT.length,
      matched: medicalMatched.length,
      missed: medicalMissed.length,
      rate: medicalGT.length > 0 ? Math.round((medicalMatched.length / medicalGT.length) * 100) : 100,
      missedDates: medicalMissed
    },
    insurance: {
      gt: insuranceGT.length,
      matched: insuranceMatched.length,
      missed: insuranceMissed.length,
      rate: insuranceGT.length > 0 ? Math.round((insuranceMatched.length / insuranceGT.length) * 100) : 100,
      missedDates: insuranceMissed
    },
    other: {
      gt: otherGT.length,
      matched: otherMatched.length,
      missed: otherMissed.length,
      rate: otherGT.length > 0 ? Math.round((otherMatched.length / otherGT.length) * 100) : 100,
      missedDates: otherMissed
    }
  };
}

// 케이스 분석
async function analyzeCase(caseNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] 종합 GT 분석`);
  console.log(`${'='.repeat(60)}`);

  // GT 로드
  const groundTruth = loadGroundTruth(caseNum);
  if (!groundTruth) {
    console.log(`  ❌ GT를 찾을 수 없습니다.`);
    return null;
  }

  // GT 날짜 추출 및 카테고리 분류
  const categorizer = new GTDateCategorizer();
  const gtDates = extractGroundTruthDatesWithCategory(groundTruth, categorizer);

  console.log(`  GT 날짜: ${gtDates.length}개`);
  console.log(`    - 의료 이벤트: ${gtDates.filter(d => d.primaryCategory === 'medical').length}개`);
  console.log(`    - 보험 관련: ${gtDates.filter(d => d.primaryCategory === 'insurance').length}개`);
  console.log(`    - 기타: ${gtDates.filter(d => d.primaryCategory === 'other').length}개`);

  // Cycle 4 결과 로드
  const cycle4Dates = loadCycle4Dates(caseNum);
  console.log(`  Cycle 4 추출: ${cycle4Dates.length}개`);

  // 카테고리별 매칭 분석
  const matching = analyzeCategoryMatching(cycle4Dates, gtDates);

  console.log(`\n  --- 카테고리별 GT 매칭율 ---`);
  console.log(`  전체: ${matching.total.rate}% (${matching.total.matched}/${matching.total.gt})`);
  console.log(`  의료 이벤트: ${matching.medical.rate}% (${matching.medical.matched}/${matching.medical.gt}) ⭐ 핵심`);
  console.log(`  보험 관련: ${matching.insurance.rate}% (${matching.insurance.matched}/${matching.insurance.gt})`);
  console.log(`  기타: ${matching.other.rate}% (${matching.other.matched}/${matching.other.gt})`);

  if (matching.medical.missed > 0) {
    console.log(`\n  ⚠️  누락된 의료 이벤트 날짜: ${matching.medical.missed}개`);
    matching.medical.missedDates.slice(0, 3).forEach(d => {
      console.log(`     - ${d.date}: ${d.categories.filter(c => c.startsWith('medical_')).join(', ')}`);
    });
  }

  return {
    caseId: `Case${caseNum}`,
    caseNum,
    gtDates,
    cycle4Dates,
    matching,
    extractedCount: cycle4Dates.length
  };
}

// 상세 HTML 보고서 생성
function generateDetailedHTMLReport(results) {
  const totalCases = results.length;

  // 전체 통계
  const totalStats = {
    totalGT: results.reduce((sum, r) => sum + r.matching.total.gt, 0),
    totalMatched: results.reduce((sum, r) => sum + r.matching.total.matched, 0),
    medicalGT: results.reduce((sum, r) => sum + r.matching.medical.gt, 0),
    medicalMatched: results.reduce((sum, r) => sum + r.matching.medical.matched, 0),
    insuranceGT: results.reduce((sum, r) => sum + r.matching.insurance.gt, 0),
    insuranceMatched: results.reduce((sum, r) => sum + r.matching.insurance.matched, 0)
  };

  const avgTotalRate = Math.round((totalStats.totalMatched / totalStats.totalGT) * 100);
  const avgMedicalRate = Math.round((totalStats.medicalMatched / totalStats.medicalGT) * 100);
  const avgInsuranceRate = totalStats.insuranceGT > 0 ? Math.round((totalStats.insuranceMatched / totalStats.insuranceGT) * 100) : 100;

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>종합 GT 분석 보고서 - 의료 vs 보험 분류</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
    }
    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .header .subtitle {
      font-size: 18px;
      opacity: 0.9;
    }
    .content {
      padding: 40px;
    }
    h2 {
      color: #333;
      font-size: 28px;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
    }
    h3 {
      color: #555;
      font-size: 22px;
      margin: 30px 0 15px 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .summary-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      transition: transform 0.3s;
    }
    .summary-card:hover {
      transform: translateY(-5px);
    }
    .summary-card.highlight {
      background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
    }
    .summary-card.medical {
      background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
      color: white;
    }
    .summary-card.insurance {
      background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
      color: white;
    }
    .card-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 36px;
      font-weight: bold;
    }
    .card-detail {
      font-size: 14px;
      margin-top: 8px;
      opacity: 0.9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    th, td {
      padding: 14px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    tbody tr:hover {
      background: #f5f7fa;
    }
    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-success {
      background: #00b894;
      color: white;
    }
    .badge-warning {
      background: #fdcb6e;
      color: #2d3436;
    }
    .badge-danger {
      background: #d63031;
      color: white;
    }
    .badge-medical {
      background: #0984e3;
      color: white;
    }
    .badge-insurance {
      background: #6c5ce7;
      color: white;
    }
    .badge-other {
      background: #636e72;
      color: white;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e0e0e0;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 13px;
      transition: width 0.3s;
    }
    .progress-fill.medical {
      background: linear-gradient(90deg, #0984e3 0%, #74b9ff 100%);
    }
    .progress-fill.insurance {
      background: linear-gradient(90deg, #6c5ce7 0%, #a29bfe 100%);
    }
    .progress-fill.total {
      background: linear-gradient(90deg, #00b894 0%, #55efc4 100%);
    }
    .case-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 25px;
      margin: 20px 0;
      border-left: 5px solid #667eea;
    }
    .case-card h3 {
      margin-top: 0;
      color: #667eea;
    }
    .missed-list {
      background: #fff5f5;
      border-left: 4px solid #d63031;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .missed-list h4 {
      color: #d63031;
      margin-bottom: 10px;
    }
    .missed-item {
      padding: 8px 0;
      border-bottom: 1px solid #ffe0e0;
    }
    .missed-item:last-child {
      border-bottom: none;
    }
    .date-highlight {
      background: #ffeaa7;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
    }
    .key-insight {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border-left: 5px solid #2196F3;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }
    .key-insight h3 {
      color: #1976D2;
      margin-top: 0;
    }
    .footer {
      background: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #636e72;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 종합 GT 분석 보고서</h1>
      <div class="subtitle">의료 이벤트 vs 보험 관련 분류 및 상세 분석</div>
      <div class="subtitle" style="margin-top: 10px; opacity: 0.8;">
        생성 시간: ${new Date().toLocaleString('ko-KR')} | 분석 케이스: ${totalCases}개
      </div>
    </div>

    <div class="content">
      <h2>📊 전체 요약</h2>

      <div class="key-insight">
        <h3>🎯 핵심 발견사항</h3>
        <ul style="margin-left: 20px; line-height: 1.8;">
          <li><strong>의료 이벤트 날짜</strong>가 GT 검증의 핵심 목표입니다.</li>
          <li><strong>보험 관련 날짜</strong>는 별도로 분류하여 분석합니다.</li>
          <li>GT는 부분집합 (쟁점사항 관련 날짜만), OCR은 전체집합 (모든 의료기록)입니다.</li>
        </ul>
      </div>

      <div class="summary-grid">
        <div class="summary-card medical">
          <div class="card-label">의료 이벤트 GT 매칭율 ⭐</div>
          <div class="card-value">${avgMedicalRate}%</div>
          <div class="card-detail">${totalStats.medicalMatched}/${totalStats.medicalGT} 매칭</div>
        </div>

        <div class="summary-card insurance">
          <div class="card-label">보험 관련 GT 매칭율</div>
          <div class="card-value">${avgInsuranceRate}%</div>
          <div class="card-detail">${totalStats.insuranceMatched}/${totalStats.insuranceGT} 매칭</div>
        </div>

        <div class="summary-card ${avgTotalRate === 100 ? 'highlight' : ''}">
          <div class="card-label">전체 GT 매칭율</div>
          <div class="card-value">${avgTotalRate}%</div>
          <div class="card-detail">${totalStats.totalMatched}/${totalStats.totalGT} 매칭</div>
        </div>

        <div class="summary-card">
          <div class="card-label">분석 케이스 수</div>
          <div class="card-value">${totalCases}</div>
          <div class="card-detail">Case 2, 5, 13, 15, 17, 29, 30, 41, 42, 44</div>
        </div>
      </div>

      <h2>📋 케이스별 상세 분석</h2>

      <table>
        <thead>
          <tr>
            <th>케이스</th>
            <th>전체 GT</th>
            <th>전체 매칭율</th>
            <th>의료 이벤트 GT ⭐</th>
            <th>의료 매칭율</th>
            <th>보험 GT</th>
            <th>보험 매칭율</th>
            <th>추출 총 날짜</th>
          </tr>
        </thead>
        <tbody>`;

  for (const result of results) {
    const m = result.matching;
    const totalBadge = m.total.rate === 100 ? 'badge-success' : (m.total.rate >= 80 ? 'badge-warning' : 'badge-danger');
    const medicalBadge = m.medical.rate === 100 ? 'badge-success' : (m.medical.rate >= 80 ? 'badge-warning' : 'badge-danger');
    const insuranceBadge = m.insurance.rate === 100 ? 'badge-success' : (m.insurance.rate >= 80 ? 'badge-warning' : 'badge-danger');

    html += `
          <tr>
            <td><strong>${result.caseId}</strong></td>
            <td>${m.total.gt}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill total" style="width: ${m.total.rate}%">
                  ${m.total.rate}%
                </div>
              </div>
            </td>
            <td><span class="badge badge-medical">${m.medical.gt}개</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill medical" style="width: ${m.medical.rate}%">
                  ${m.medical.rate}%
                </div>
              </div>
            </td>
            <td><span class="badge badge-insurance">${m.insurance.gt}개</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill insurance" style="width: ${m.insurance.rate}%">
                  ${m.insurance.rate}%
                </div>
              </div>
            </td>
            <td>${result.extractedCount}</td>
          </tr>`;
  }

  html += `
        </tbody>
      </table>

      <h2>🔍 누락 분석 (의료 이벤트 중심)</h2>`;

  for (const result of results) {
    if (result.matching.medical.missed > 0) {
      html += `
      <div class="case-card">
        <h3>${result.caseId}</h3>
        <div class="missed-list">
          <h4>⚠️ 누락된 의료 이벤트 날짜: ${result.matching.medical.missed}개</h4>`;

      for (const missed of result.matching.medical.missedDates) {
        const categories = missed.categories.filter(c => c.startsWith('medical_')).map(c => c.replace('medical_', '')).join(', ');
        html += `
          <div class="missed-item">
            <span class="date-highlight">${missed.date}</span>
            <span class="badge badge-medical">${categories}</span><br>
            <small style="color: #666;">${missed.context.substring(0, 100)}...</small>
          </div>`;
      }

      html += `
        </div>
      </div>`;
    }
  }

  // 보험 관련 누락
  const insuranceMissedCases = results.filter(r => r.matching.insurance.missed > 0);
  if (insuranceMissedCases.length > 0) {
    html += `
      <h2>💼 보험 관련 누락 분석 (참고용)</h2>`;

    for (const result of insuranceMissedCases) {
      html += `
      <div class="case-card">
        <h3>${result.caseId}</h3>
        <div class="missed-list" style="background: #f0f0ff; border-left-color: #6c5ce7;">
          <h4 style="color: #6c5ce7;">💼 누락된 보험 관련 날짜: ${result.matching.insurance.missed}개</h4>`;

      for (const missed of result.matching.insurance.missedDates) {
        const categories = missed.categories.filter(c => c.startsWith('insurance_')).map(c => c.replace('insurance_', '')).join(', ');
        html += `
          <div class="missed-item" style="border-bottom-color: #d0d0ff;">
            <span class="date-highlight">${missed.date}</span>
            <span class="badge badge-insurance">${categories}</span><br>
            <small style="color: #666;">${missed.context.substring(0, 100)}...</small>
          </div>`;
      }

      html += `
        </div>
      </div>`;
    }
  }

  html += `
      <h2>📈 결론 및 권장사항</h2>

      <div class="key-insight">
        <h3>✅ 성과</h3>
        <ul style="margin-left: 20px; line-height: 1.8;">
          <li><strong>의료 이벤트 GT 매칭율:</strong> ${avgMedicalRate}%</li>
          <li><strong>카테고리별 분류:</strong> 의료 vs 보험 명확히 구분</li>
          <li><strong>전체집합 접근:</strong> GT(부분집합)를 포함하는 전체 날짜 추출</li>
        </ul>
      </div>`;

  if (avgMedicalRate < 100) {
    html += `
      <div class="key-insight" style="background: linear-gradient(135deg, #fff5f5 0%, #ffe0e0 100%); border-left-color: #d63031;">
        <h3 style="color: #d63031;">⚠️ 개선 필요</h3>
        <ul style="margin-left: 20px; line-height: 1.8;">
          <li><strong>의료 이벤트 날짜 누락:</strong> ${totalStats.medicalGT - totalStats.medicalMatched}개</li>
          <li><strong>누락 패턴 분석:</strong> 진료/검사/수술 등 카테고리별 누락 원인 파악</li>
          <li><strong>추출 로직 강화:</strong> 의료 키워드 주변 탐색 범위 확대</li>
        </ul>
      </div>`;
  } else {
    html += `
      <div class="key-insight" style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left-color: #28a745;">
        <h3 style="color: #28a745;">🎉 축하합니다!</h3>
        <p style="margin-left: 20px; line-height: 1.8;">
          <strong>의료 이벤트 날짜 GT 매칭율 100% 달성!</strong><br>
          이제 실제 파이프라인에 통합하고 프로덕션 배포를 준비하세요.
        </p>
      </div>`;
  }

  html += `
    </div>

    <div class="footer">
      <p style="margin-bottom: 10px;"><strong>VNEXSUS Medical OCR Pipeline - Comprehensive GT Analysis</strong></p>
      <p>보고서 생성: ${new Date().toLocaleString('ko-KR')}</p>
      <p style="margin-top: 10px; font-size: 12px;">의료 이벤트 날짜와 내용이 GT 검증의 목표입니다.</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// 메인 실행
async function main() {
  console.log('\n🚀 종합 GT 분석 시작 (의료 vs 보험 분류)\n');

  initDirectories();

  const results = [];

  for (const caseNum of CONFIG.targetCases) {
    try {
      const result = await analyzeCase(caseNum);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Case${caseNum} 분석 실패:`, error.message);
    }
  }

  // JSON 결과 저장
  const jsonPath = path.join(CONFIG.outputDir, 'comprehensive_gt_analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: {
      totalCases: CONFIG.targetCases.length,
      validCases: results.length,
      processedAt: new Date().toISOString(),
      totalStats: {
        totalGT: results.reduce((sum, r) => sum + r.matching.total.gt, 0),
        totalMatched: results.reduce((sum, r) => sum + r.matching.total.matched, 0),
        medicalGT: results.reduce((sum, r) => sum + r.matching.medical.gt, 0),
        medicalMatched: results.reduce((sum, r) => sum + r.matching.medical.matched, 0),
        insuranceGT: results.reduce((sum, r) => sum + r.matching.insurance.gt, 0),
        insuranceMatched: results.reduce((sum, r) => sum + r.matching.insurance.matched, 0)
      }
    },
    results
  }, null, 2), 'utf-8');

  // HTML 보고서 생성
  const html = generateDetailedHTMLReport(results);
  const htmlPath = path.join(CONFIG.reportsDir, 'comprehensive_gt_analysis.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n✅ 분석 완료`);
  console.log(`   JSON 결과: ${jsonPath}`);
  console.log(`   HTML 보고서: ${htmlPath}`);

  // 요약 출력
  const totalStats = {
    totalGT: results.reduce((sum, r) => sum + r.matching.total.gt, 0),
    totalMatched: results.reduce((sum, r) => sum + r.matching.total.matched, 0),
    medicalGT: results.reduce((sum, r) => sum + r.matching.medical.gt, 0),
    medicalMatched: results.reduce((sum, r) => sum + r.matching.medical.matched, 0),
    insuranceGT: results.reduce((sum, r) => sum + r.matching.insurance.gt, 0),
    insuranceMatched: results.reduce((sum, r) => sum + r.matching.insurance.matched, 0)
  };

  console.log(`\n📊 전체 요약:`);
  console.log(`   의료 이벤트 GT 매칭율: ${Math.round((totalStats.medicalMatched / totalStats.medicalGT) * 100)}% (${totalStats.medicalMatched}/${totalStats.medicalGT}) ⭐`);
  console.log(`   보험 관련 GT 매칭율: ${totalStats.insuranceGT > 0 ? Math.round((totalStats.insuranceMatched / totalStats.insuranceGT) * 100) : 100}% (${totalStats.insuranceMatched}/${totalStats.insuranceGT})`);
  console.log(`   전체 GT 매칭율: ${Math.round((totalStats.totalMatched / totalStats.totalGT) * 100)}% (${totalStats.totalMatched}/${totalStats.totalGT})`);
}

main().catch(error => {
  console.error('\n❌ 실행 실패:', error);
  process.exit(1);
});
