/**
 * 🎯 Vision LLM 상세 분석 및 인사이트 보고서 생성
 * 
 * 1. 기존 검증 결과를 분석
 * 2. 항목별 상세 매칭률 계산 (날짜, 진단코드, 병원명, 검사, 치료 등)
 * 3. 개선 인사이트 도출
 * 4. OCR 결과 저장 기능 추가
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATHS = {
  validationDir: path.join(__dirname, 'output/vision_validation'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  ocrCacheDir: path.join(__dirname, 'output/vision_validation/ocr_cache'),
  outputDir: path.join(__dirname, 'output/vision_validation')
};

// 디렉토리 생성
if (!fs.existsSync(PATHS.ocrCacheDir)) {
  fs.mkdirSync(PATHS.ocrCacheDir, { recursive: true });
}

/**
 * 날짜 추출 (다양한 형식 지원)
 */
function extractDates(text) {
  const patterns = [
    /(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})[일]?/g,  // YYYY-MM-DD, YYYY.MM.DD
    /(\d{2})[.\-\/](\d{2})[.\-\/](\d{2})/g,                       // YY-MM-DD
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g                      // YYYY년 MM월 DD일
  ];
  
  const dates = new Set();
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      // 정규화
      let year = match[1];
      let month = match[2];
      let day = match[3];
      
      // 2자리 연도 처리
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');
      
      const normalized = `${year}-${month}-${day}`;
      
      // 유효한 날짜인지 검증
      const dateObj = new Date(normalized);
      if (!isNaN(dateObj.getTime()) && parseInt(year) > 1900 && parseInt(year) < 2100) {
        dates.add(normalized);
      }
    }
  }
  
  return [...dates];
}

/**
 * KCD 코드 추출 (진단코드)
 */
function extractKCDCodes(text) {
  const patterns = [
    /\(([A-Z]\d{2}(?:\.\d{1,2})?)\)/g,
    /\[([A-Z]\d{2}(?:\.\d{1,2})?)\]/g,
    /\b([A-Z]\d{2}\.\d{1,2})\b/g,
    /\b([A-Z]\d{2})\b(?=[^a-zA-Z])/g
  ];
  
  const codes = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const code = match[1] || match[0];
      // 유효한 KCD 코드 형식 검증
      if (/^[A-Z]\d{2}(?:\.\d{1,2})?$/.test(code)) {
        codes.add(code);
      }
    }
  }
  return [...codes];
}

/**
 * 병원명 추출
 */
function extractHospitals(text) {
  const patterns = [
    /([가-힣]+(?:대학교)?(?:병원|의원|의료원|센터))/g,
    /([가-힣]+(?:종합)?병원)/g,
    /([가-힣]+(?:내과|외과|피부과|정형외과|신경외과|안과|이비인후과|산부인과|비뇨기과|재활의학과)(?:의원)?)/g
  ];
  
  const hospitals = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      if (name.length >= 3 && name.length <= 20) {
        hospitals.add(name);
      }
    }
  }
  return [...hospitals];
}

/**
 * 검사명 추출
 */
function extractExaminations(text) {
  const examPatterns = [
    'CT', 'MRI', 'MRA', 'X-ray', 'X선', '초음파', 'PET', 'PET-CT',
    '내시경', '위내시경', '대장내시경', '기관지내시경',
    '혈액검사', '소변검사', '조직검사', '병리검사', '세포검사',
    '심전도', 'ECG', 'EKG', '심초음파',
    '폐기능검사', '간기능검사', '신기능검사',
    'AFP', 'CEA', 'CA19-9', 'CA125', 'PSA'
  ];
  
  const found = [];
  for (const exam of examPatterns) {
    if (text.includes(exam)) {
      found.push(exam);
    }
  }
  return [...new Set(found)];
}

/**
 * 치료/수술명 추출
 */
function extractTreatments(text) {
  const patterns = [
    /([가-힣]+(?:수술|술))/g,
    /([가-힣]+절제술)/g,
    /([가-힣]+절개술)/g,
    /([가-힣]+치료)/g,
    /(항암|방사선|화학요법)/g
  ];
  
  const treatments = new Set();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const name = match[1];
      if (name.length >= 3 && name.length <= 30) {
        treatments.add(name);
      }
    }
  }
  return [...treatments];
}

/**
 * 생성된 JSON에서 필드 추출
 */
function extractFromGeneratedJson(json) {
  const result = {
    dates: [],
    kcdCodes: [],
    hospitals: [],
    examinations: [],
    treatments: [],
    diagnoses: []
  };
  
  // visitDate
  if (json.visitDate) {
    if (json.visitDate.date) result.dates.push(json.visitDate.date);
    if (json.visitDate.hospital) result.hospitals.push(json.visitDate.hospital);
  }
  
  // diagnoses
  if (json.diagnoses && Array.isArray(json.diagnoses)) {
    for (const d of json.diagnoses) {
      if (d.code) result.kcdCodes.push(d.code);
      if (d.date) result.dates.push(d.date);
      if (d.hospital) result.hospitals.push(d.hospital);
      if (d.nameKr) result.diagnoses.push(d.nameKr);
    }
  }
  
  // examinations
  if (json.examinations && Array.isArray(json.examinations)) {
    for (const e of json.examinations) {
      if (e.name) result.examinations.push(e.name);
      if (e.date) result.dates.push(e.date);
    }
  }
  
  // treatments
  if (json.treatments && Array.isArray(json.treatments)) {
    for (const t of json.treatments) {
      if (t.name) result.treatments.push(t.name);
      if (t.date) result.dates.push(t.date);
    }
  }
  
  // pastHistory
  if (json.pastHistory && Array.isArray(json.pastHistory)) {
    for (const p of json.pastHistory) {
      if (p.code) result.kcdCodes.push(p.code);
      if (p.diagnosisDate) result.dates.push(p.diagnosisDate);
    }
  }
  
  // admissionPeriod
  if (json.admissionPeriod) {
    if (json.admissionPeriod.startDate) result.dates.push(json.admissionPeriod.startDate);
    if (json.admissionPeriod.endDate) result.dates.push(json.admissionPeriod.endDate);
    if (json.admissionPeriod.hospital) result.hospitals.push(json.admissionPeriod.hospital);
  }
  
  // outpatientPeriod
  if (json.outpatientPeriod) {
    if (json.outpatientPeriod.startDate) result.dates.push(json.outpatientPeriod.startDate);
    if (json.outpatientPeriod.endDate) result.dates.push(json.outpatientPeriod.endDate);
    if (json.outpatientPeriod.hospitals) {
      result.hospitals.push(...(Array.isArray(json.outpatientPeriod.hospitals) 
        ? json.outpatientPeriod.hospitals 
        : [json.outpatientPeriod.hospitals]));
    }
  }
  
  // 중복 제거
  result.dates = [...new Set(result.dates.filter(d => d))];
  result.kcdCodes = [...new Set(result.kcdCodes.filter(c => c))];
  result.hospitals = [...new Set(result.hospitals.filter(h => h))];
  result.examinations = [...new Set(result.examinations.filter(e => e))];
  result.treatments = [...new Set(result.treatments.filter(t => t))];
  result.diagnoses = [...new Set(result.diagnoses.filter(d => d))];
  
  return result;
}

/**
 * 매칭률 계산
 */
function calculateMatchRate(generated, groundTruth, fuzzyMatch = false) {
  if (groundTruth.length === 0) return { rate: 100, matched: 0, total: 0 };
  
  let matched = 0;
  const matchedItems = [];
  const missedItems = [];
  
  for (const gtItem of groundTruth) {
    let found = false;
    
    if (fuzzyMatch) {
      // 부분 매칭 (날짜의 경우 연월만 비교, 병원명의 경우 부분 포함)
      const gtBase = typeof gtItem === 'string' ? gtItem.split('.')[0].replace(/-/g, '') : gtItem;
      found = generated.some(genItem => {
        const genBase = typeof genItem === 'string' ? genItem.split('.')[0].replace(/-/g, '') : genItem;
        return genBase === gtBase || gtItem.includes(genItem) || genItem.includes(gtItem);
      });
    } else {
      found = generated.includes(gtItem);
    }
    
    if (found) {
      matched++;
      matchedItems.push(gtItem);
    } else {
      missedItems.push(gtItem);
    }
  }
  
  return {
    rate: Math.round((matched / groundTruth.length) * 100),
    matched,
    total: groundTruth.length,
    matchedItems,
    missedItems
  };
}

/**
 * 상세 분석 수행
 */
function performDetailedAnalysis() {
  console.log('═'.repeat(60));
  console.log('🔍 Vision LLM 상세 분석 및 인사이트 생성');
  console.log('═'.repeat(60));
  
  // 결과 파일 로드
  const validationFiles = fs.readdirSync(PATHS.validationDir)
    .filter(f => f.endsWith('.json') && f.startsWith('case_') && !f.includes('_error') && !f.includes('summary'));
  
  const allResults = [];
  const detailedAnalysis = [];
  
  for (const file of validationFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PATHS.validationDir, file), 'utf-8'));
      if (data.generatedJson && !data.generatedJson.error) {
        allResults.push(data);
      }
    } catch (e) {
      // 파싱 실패시 무시
    }
  }
  
  console.log(`\n📊 분석 대상: ${allResults.length}개 케이스`);
  
  // 각 케이스별 상세 분석
  for (const result of allResults) {
    const caseNum = result.caseNum;
    
    // Ground Truth 로드
    const gtPath = path.join(PATHS.groundTruthDir, `Case${caseNum}_report.txt`);
    if (!fs.existsSync(gtPath)) continue;
    
    const groundTruth = fs.readFileSync(gtPath, 'utf-8');
    
    // Ground Truth에서 항목 추출
    const gtExtracted = {
      dates: extractDates(groundTruth),
      kcdCodes: extractKCDCodes(groundTruth),
      hospitals: extractHospitals(groundTruth),
      examinations: extractExaminations(groundTruth),
      treatments: extractTreatments(groundTruth)
    };
    
    // 생성된 JSON에서 항목 추출
    const genExtracted = extractFromGeneratedJson(result.generatedJson);
    
    // 매칭률 계산
    const analysis = {
      caseId: result.caseId,
      caseNum,
      patientName: result.patientName,
      model: result.model,
      processingTime: result.processingTime,
      cost: result.cost,
      matching: {
        dates: calculateMatchRate(genExtracted.dates, gtExtracted.dates, true),
        kcdCodes: calculateMatchRate(genExtracted.kcdCodes, gtExtracted.kcdCodes, true),
        hospitals: calculateMatchRate(genExtracted.hospitals, gtExtracted.hospitals, true),
        examinations: calculateMatchRate(genExtracted.examinations, gtExtracted.examinations, true),
        treatments: calculateMatchRate(genExtracted.treatments, gtExtracted.treatments, true)
      },
      extracted: {
        generated: genExtracted,
        groundTruth: gtExtracted
      }
    };
    
    // 종합 점수 계산
    analysis.overallScore = Math.round(
      (analysis.matching.dates.rate * 0.25) +
      (analysis.matching.kcdCodes.rate * 0.30) +
      (analysis.matching.hospitals.rate * 0.20) +
      (analysis.matching.examinations.rate * 0.15) +
      (analysis.matching.treatments.rate * 0.10)
    );
    
    detailedAnalysis.push(analysis);
    
    // OCR 캐시 저장 (다음번 사용을 위해)
    const cacheData = {
      caseId: result.caseId,
      caseNum,
      model: result.model,
      generatedJson: result.generatedJson,
      extractedData: genExtracted,
      timestamp: result.timestamp,
      cached: true
    };
    fs.writeFileSync(
      path.join(PATHS.ocrCacheDir, `case_${caseNum}_${result.model.replace('gpt-', '')}.json`),
      JSON.stringify(cacheData, null, 2)
    );
  }
  
  // 모델별 통계
  const modelStats = {};
  for (const model of ['gpt-4o-mini', 'gpt-4o']) {
    const modelResults = detailedAnalysis.filter(a => a.model === model);
    if (modelResults.length === 0) continue;
    
    modelStats[model] = {
      count: modelResults.length,
      avgOverallScore: Math.round(modelResults.reduce((s, r) => s + r.overallScore, 0) / modelResults.length),
      avgDateMatch: Math.round(modelResults.reduce((s, r) => s + r.matching.dates.rate, 0) / modelResults.length),
      avgKCDMatch: Math.round(modelResults.reduce((s, r) => s + r.matching.kcdCodes.rate, 0) / modelResults.length),
      avgHospitalMatch: Math.round(modelResults.reduce((s, r) => s + r.matching.hospitals.rate, 0) / modelResults.length),
      avgExamMatch: Math.round(modelResults.reduce((s, r) => s + r.matching.examinations.rate, 0) / modelResults.length),
      avgTreatmentMatch: Math.round(modelResults.reduce((s, r) => s + r.matching.treatments.rate, 0) / modelResults.length),
      avgCost: modelResults.reduce((s, r) => s + r.cost, 0) / modelResults.length,
      avgTime: modelResults.reduce((s, r) => s + r.processingTime, 0) / modelResults.length
    };
  }
  
  // 개선 인사이트 도출
  const insights = generateInsights(detailedAnalysis, modelStats);
  
  // HTML 보고서 생성
  generateDetailedHTMLReport(detailedAnalysis, modelStats, insights);
  
  // JSON 저장
  fs.writeFileSync(
    path.join(PATHS.outputDir, 'vision_detailed_analysis.json'),
    JSON.stringify({ detailedAnalysis, modelStats, insights }, null, 2)
  );
  
  console.log('\n✅ 분석 완료');
  console.log(`   📄 vision_detailed_analysis.json 저장됨`);
  console.log(`   📄 vision_detailed_report.html 생성됨`);
  console.log(`   📂 OCR 캐시 저장됨: ${PATHS.ocrCacheDir}`);
}

/**
 * 개선 인사이트 도출
 */
function generateInsights(analysis, modelStats) {
  const insights = [];
  
  // 날짜 매칭률 분석
  const avgDateMatch = analysis.reduce((s, a) => s + a.matching.dates.rate, 0) / analysis.length;
  if (avgDateMatch < 50) {
    insights.push({
      category: '날짜 추출',
      severity: 'high',
      issue: `날짜 매칭률이 ${avgDateMatch.toFixed(0)}%로 낮음`,
      cause: '다양한 날짜 형식 (YYYY.MM.DD, YYYY년 MM월 DD일 등)에 대한 정규화 미흡',
      recommendation: [
        '프롬프트에 명시적 날짜 형식 지정 (YYYY-MM-DD)',
        '후처리 단계에서 날짜 정규화 로직 강화',
        'PDF의 여러 페이지에서 날짜 정보 종합 수집'
      ]
    });
  }
  
  // KCD 코드 매칭률 분석
  const avgKCDMatch = analysis.reduce((s, a) => s + a.matching.kcdCodes.rate, 0) / analysis.length;
  if (avgKCDMatch < 30) {
    insights.push({
      category: 'KCD 진단코드',
      severity: 'critical',
      issue: `KCD 코드 매칭률이 ${avgKCDMatch.toFixed(0)}%로 매우 낮음`,
      cause: 'PDF 첫 3페이지만 사용하여 진단 코드가 있는 페이지 누락 가능성',
      recommendation: [
        'PDF 전체 페이지 처리 (비용 증가 감안)',
        '진단서/소견서 페이지 우선 탐지 로직 추가',
        'KCD 코드 패턴 인식 프롬프트 강화',
        '진단명 → KCD 코드 매핑 데이터베이스 활용'
      ]
    });
  }
  
  // 병원명 매칭률 분석
  const avgHospitalMatch = analysis.reduce((s, a) => s + a.matching.hospitals.rate, 0) / analysis.length;
  if (avgHospitalMatch < 60) {
    insights.push({
      category: '병원명 추출',
      severity: 'medium',
      issue: `병원명 매칭률이 ${avgHospitalMatch.toFixed(0)}%`,
      cause: '병원명 표기 변형 (약어, 띄어쓰기 차이 등)',
      recommendation: [
        '병원명 정규화 사전 구축',
        '유사도 기반 병원명 매칭 적용',
        'OCR 후 병원명 검증 단계 추가'
      ]
    });
  }
  
  // 모델 비교 인사이트
  if (modelStats['gpt-4o-mini'] && modelStats['gpt-4o']) {
    const mini = modelStats['gpt-4o-mini'];
    const full = modelStats['gpt-4o'];
    
    const scoreDiff = full.avgOverallScore - mini.avgOverallScore;
    const costRatio = full.avgCost / mini.avgCost;
    
    if (scoreDiff < 10 && costRatio > 1.3) {
      insights.push({
        category: '모델 선택',
        severity: 'info',
        issue: `gpt-4o가 ${scoreDiff.toFixed(0)}%p 높은 점수지만 ${costRatio.toFixed(1)}배 비용`,
        cause: 'gpt-4o-mini가 비용 대비 효율적',
        recommendation: [
          '일반 케이스: gpt-4o-mini 사용',
          '복잡/고위험 케이스: gpt-4o 사용',
          '2단계 접근: gpt-4o-mini 1차 → 품질 미달시 gpt-4o 재처리'
        ]
      });
    }
  }
  
  // PDF 페이지 처리 인사이트
  insights.push({
    category: 'PDF 처리',
    severity: 'medium',
    issue: '현재 PDF 첫 3페이지만 처리',
    cause: '비용 절감을 위한 페이지 제한',
    recommendation: [
      '문서 유형 자동 감지 (진단서, 의무기록, 영수증 등)',
      '중요 페이지 우선 처리 알고리즘 구현',
      '필요시 추가 페이지 동적 로드'
    ]
  });
  
  return insights;
}

/**
 * 상세 HTML 보고서 생성
 */
function generateDetailedHTMLReport(analysis, modelStats, insights) {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS Vision LLM 상세 분석 보고서</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; min-height: 100vh; padding: 20px; color: #333; }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 { text-align: center; color: #1a1a2e; margin-bottom: 10px; font-size: 32px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
    
    /* Summary Cards */
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); text-align: center; }
    .summary-card h3 { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .summary-card .subvalue { font-size: 12px; color: #666; margin-top: 5px; }
    .summary-card.highlight { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .summary-card.highlight * { color: white !important; }
    
    /* Model Comparison */
    .section { background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    .section h2 { color: #1a1a2e; margin-bottom: 20px; font-size: 18px; display: flex; align-items: center; gap: 10px; }
    .section h2::before { content: ''; width: 4px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 2px; }
    
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; color: #555; font-weight: 600; font-size: 12px; text-transform: uppercase; }
    tr:hover { background: #fafafa; }
    
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    
    /* Insights */
    .insight-card { background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid; }
    .insight-card.critical { border-color: #ef4444; background: #fef2f2; }
    .insight-card.high { border-color: #f97316; background: #fff7ed; }
    .insight-card.medium { border-color: #eab308; background: #fefce8; }
    .insight-card.info { border-color: #3b82f6; background: #eff6ff; }
    .insight-card h4 { font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .insight-card .issue { font-size: 13px; color: #555; margin-bottom: 10px; }
    .insight-card .cause { font-size: 12px; color: #888; margin-bottom: 10px; font-style: italic; }
    .insight-card ul { margin-left: 20px; font-size: 12px; }
    .insight-card li { margin-bottom: 5px; color: #444; }
    
    /* Chart placeholder */
    .chart-container { display: flex; justify-content: center; gap: 30px; margin: 20px 0; }
    .chart-bar { display: flex; flex-direction: column; align-items: center; }
    .bar-wrapper { display: flex; gap: 4px; align-items: flex-end; height: 120px; }
    .bar { width: 35px; border-radius: 4px 4px 0 0; transition: all 0.3s; }
    .bar.mini { background: linear-gradient(180deg, #667eea 0%, #5a67d8 100%); }
    .bar.full { background: linear-gradient(180deg, #764ba2 0%, #6b21a8 100%); }
    .bar-label { font-size: 11px; color: #666; margin-top: 5px; }
    .bar-value { font-size: 10px; color: #999; }
    
    /* Case Details */
    .case-row { cursor: pointer; }
    .case-row:hover { background: #f0f4ff !important; }
    .case-details { display: none; background: #f8f9fa; }
    .case-details.show { display: table-row; }
    .case-details td { padding: 20px; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .detail-item { background: white; border-radius: 8px; padding: 15px; }
    .detail-item h5 { font-size: 12px; color: #888; margin-bottom: 8px; }
    .detail-item .list { font-size: 12px; color: #333; }
    .detail-item .missed { color: #ef4444; text-decoration: line-through; }
    .detail-item .matched { color: #10b981; }
    
    .footer { text-align: center; color: #999; font-size: 11px; margin-top: 30px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vision LLM 상세 분석 보고서</h1>
    <p class="subtitle">PDF → Vision OCR → 보고서 생성 End-to-End 검증 | 항목별 매칭률 및 개선 인사이트</p>
    
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <h3>분석 케이스</h3>
        <div class="value">${analysis.length}</div>
        <div class="subvalue">총 검증 케이스</div>
      </div>
      <div class="summary-card">
        <h3>평균 날짜 매칭</h3>
        <div class="value">${Math.round(analysis.reduce((s, a) => s + a.matching.dates.rate, 0) / analysis.length)}%</div>
        <div class="subvalue">날짜 추출 정확도</div>
      </div>
      <div class="summary-card">
        <h3>평균 KCD 매칭</h3>
        <div class="value">${Math.round(analysis.reduce((s, a) => s + a.matching.kcdCodes.rate, 0) / analysis.length)}%</div>
        <div class="subvalue">진단코드 정확도</div>
      </div>
      <div class="summary-card">
        <h3>평균 병원명 매칭</h3>
        <div class="value">${Math.round(analysis.reduce((s, a) => s + a.matching.hospitals.rate, 0) / analysis.length)}%</div>
        <div class="subvalue">병원명 정확도</div>
      </div>
      <div class="summary-card highlight">
        <h3>종합 점수</h3>
        <div class="value">${Math.round(analysis.reduce((s, a) => s + a.overallScore, 0) / analysis.length)}%</div>
        <div class="subvalue">가중 평균</div>
      </div>
    </div>
    
    <!-- Model Comparison -->
    <div class="section">
      <h2>모델별 항목 매칭률 비교</h2>
      <table>
        <thead>
          <tr>
            <th>모델</th>
            <th>케이스 수</th>
            <th>날짜 매칭</th>
            <th>KCD 코드</th>
            <th>병원명</th>
            <th>검사명</th>
            <th>치료/수술</th>
            <th>종합 점수</th>
            <th>평균 비용</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(modelStats).map(([model, stats]) => `
            <tr>
              <td><strong>${model}</strong></td>
              <td>${stats.count}</td>
              <td><span class="badge badge-${stats.avgDateMatch >= 50 ? 'success' : stats.avgDateMatch >= 30 ? 'warning' : 'danger'}">${stats.avgDateMatch}%</span></td>
              <td><span class="badge badge-${stats.avgKCDMatch >= 50 ? 'success' : stats.avgKCDMatch >= 30 ? 'warning' : 'danger'}">${stats.avgKCDMatch}%</span></td>
              <td><span class="badge badge-${stats.avgHospitalMatch >= 50 ? 'success' : stats.avgHospitalMatch >= 30 ? 'warning' : 'danger'}">${stats.avgHospitalMatch}%</span></td>
              <td><span class="badge badge-${stats.avgExamMatch >= 50 ? 'success' : stats.avgExamMatch >= 30 ? 'warning' : 'danger'}">${stats.avgExamMatch}%</span></td>
              <td><span class="badge badge-${stats.avgTreatmentMatch >= 50 ? 'success' : stats.avgTreatmentMatch >= 30 ? 'warning' : 'danger'}">${stats.avgTreatmentMatch}%</span></td>
              <td><span class="badge badge-info">${stats.avgOverallScore}%</span></td>
              <td>$${stats.avgCost.toFixed(4)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <!-- Visual Chart -->
      <div class="chart-container">
        ${['날짜', 'KCD코드', '병원명', '검사명', '치료/수술'].map((label, idx) => {
          const miniVal = modelStats['gpt-4o-mini'] ? [
            modelStats['gpt-4o-mini'].avgDateMatch,
            modelStats['gpt-4o-mini'].avgKCDMatch,
            modelStats['gpt-4o-mini'].avgHospitalMatch,
            modelStats['gpt-4o-mini'].avgExamMatch,
            modelStats['gpt-4o-mini'].avgTreatmentMatch
          ][idx] : 0;
          const fullVal = modelStats['gpt-4o'] ? [
            modelStats['gpt-4o'].avgDateMatch,
            modelStats['gpt-4o'].avgKCDMatch,
            modelStats['gpt-4o'].avgHospitalMatch,
            modelStats['gpt-4o'].avgExamMatch,
            modelStats['gpt-4o'].avgTreatmentMatch
          ][idx] : 0;
          return `
            <div class="chart-bar">
              <div class="bar-wrapper">
                <div class="bar mini" style="height: ${miniVal * 1.2}px;" title="gpt-4o-mini: ${miniVal}%"></div>
                <div class="bar full" style="height: ${fullVal * 1.2}px;" title="gpt-4o: ${fullVal}%"></div>
              </div>
              <div class="bar-label">${label}</div>
              <div class="bar-value">${miniVal}% / ${fullVal}%</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="text-align:center;font-size:11px;color:#888;margin-top:10px;">
        <span style="display:inline-block;width:10px;height:10px;background:#667eea;border-radius:2px;margin-right:5px;"></span>gpt-4o-mini
        <span style="display:inline-block;width:10px;height:10px;background:#764ba2;border-radius:2px;margin-left:15px;margin-right:5px;"></span>gpt-4o
      </div>
    </div>
    
    <!-- Insights -->
    <div class="section">
      <h2>개선 인사이트</h2>
      ${insights.map(insight => `
        <div class="insight-card ${insight.severity}">
          <h4>
            ${insight.severity === 'critical' ? '🔴' : insight.severity === 'high' ? '🟠' : insight.severity === 'medium' ? '🟡' : '🔵'}
            ${insight.category}
          </h4>
          <div class="issue"><strong>이슈:</strong> ${insight.issue}</div>
          <div class="cause"><strong>원인:</strong> ${insight.cause}</div>
          <ul>
            ${insight.recommendation.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
    
    <!-- Case Details Table -->
    <div class="section">
      <h2>케이스별 상세 분석</h2>
      <table>
        <thead>
          <tr>
            <th>케이스</th>
            <th>피보험자</th>
            <th>모델</th>
            <th>날짜</th>
            <th>KCD</th>
            <th>병원명</th>
            <th>검사</th>
            <th>치료</th>
            <th>종합</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.map((a, idx) => `
            <tr class="case-row" onclick="toggleDetails(${idx})">
              <td><strong>${a.caseId}</strong></td>
              <td>${a.patientName || 'N/A'}</td>
              <td>${a.model}</td>
              <td><span class="badge badge-${a.matching.dates.rate >= 50 ? 'success' : a.matching.dates.rate >= 30 ? 'warning' : 'danger'}">${a.matching.dates.rate}%</span></td>
              <td><span class="badge badge-${a.matching.kcdCodes.rate >= 50 ? 'success' : a.matching.kcdCodes.rate >= 30 ? 'warning' : 'danger'}">${a.matching.kcdCodes.rate}%</span></td>
              <td><span class="badge badge-${a.matching.hospitals.rate >= 50 ? 'success' : a.matching.hospitals.rate >= 30 ? 'warning' : 'danger'}">${a.matching.hospitals.rate}%</span></td>
              <td><span class="badge badge-${a.matching.examinations.rate >= 50 ? 'success' : a.matching.examinations.rate >= 30 ? 'warning' : 'danger'}">${a.matching.examinations.rate}%</span></td>
              <td><span class="badge badge-${a.matching.treatments.rate >= 50 ? 'success' : a.matching.treatments.rate >= 30 ? 'warning' : 'danger'}">${a.matching.treatments.rate}%</span></td>
              <td><span class="badge badge-info">${a.overallScore}%</span></td>
            </tr>
            <tr class="case-details" id="details-${idx}">
              <td colspan="9">
                <div class="detail-grid">
                  <div class="detail-item">
                    <h5>날짜 (GT: ${a.extracted.groundTruth.dates.length}개, 추출: ${a.extracted.generated.dates.length}개)</h5>
                    <div class="list">
                      <strong>매칭:</strong> ${a.matching.dates.matchedItems?.join(', ') || '없음'}<br>
                      <strong>누락:</strong> <span class="missed">${a.matching.dates.missedItems?.join(', ') || '없음'}</span>
                    </div>
                  </div>
                  <div class="detail-item">
                    <h5>KCD 코드 (GT: ${a.extracted.groundTruth.kcdCodes.length}개, 추출: ${a.extracted.generated.kcdCodes.length}개)</h5>
                    <div class="list">
                      <strong>매칭:</strong> ${a.matching.kcdCodes.matchedItems?.join(', ') || '없음'}<br>
                      <strong>누락:</strong> <span class="missed">${a.matching.kcdCodes.missedItems?.join(', ') || '없음'}</span>
                    </div>
                  </div>
                  <div class="detail-item">
                    <h5>병원명 (GT: ${a.extracted.groundTruth.hospitals.length}개, 추출: ${a.extracted.generated.hospitals.length}개)</h5>
                    <div class="list">
                      <strong>GT:</strong> ${a.extracted.groundTruth.hospitals.join(', ') || '없음'}<br>
                      <strong>추출:</strong> ${a.extracted.generated.hospitals.join(', ') || '없음'}
                    </div>
                  </div>
                  <div class="detail-item">
                    <h5>검사/치료 정보</h5>
                    <div class="list">
                      <strong>검사(GT):</strong> ${a.extracted.groundTruth.examinations.join(', ') || '없음'}<br>
                      <strong>치료(GT):</strong> ${a.extracted.groundTruth.treatments.join(', ') || '없음'}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      Generated: ${new Date().toISOString()} | VNEXSUS Vision LLM Detailed Analysis Report<br>
      OCR 캐시 저장 위치: backend/eval/output/vision_validation/ocr_cache/
    </div>
  </div>
  
  <script>
    function toggleDetails(idx) {
      const details = document.getElementById('details-' + idx);
      details.classList.toggle('show');
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(PATHS.outputDir, 'vision_detailed_report.html'), html);
}

// 메인 실행
performDetailedAnalysis();
