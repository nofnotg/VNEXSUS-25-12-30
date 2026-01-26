/**
 * Improved Validator - 날짜 매칭률 개선을 위한 반복 검증 시스템
 * 
 * 핵심 원칙:
 * - Ground Truth = 사용자가 선별한 유효 날짜의 "부분집합"
 * - 우리 추출 결과 ⊇ Ground Truth (100% 포함 필수)
 * - 페이지별 텍스트 저장 + 검색 기능
 * 
 * @module eval/improvedValidator
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Document Index Service
import { createDocumentIndex, loadDocumentIndex, searchByDate, getIndexStats } from '../services/documentIndexService.js';

// 설정
const CONFIG = {
  pdfBaseDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf',
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  outputDir: path.join(__dirname, 'output', 'improved_validation'),
  cacheDir: path.join(__dirname, 'output', 'improved_validation', 'ocr_cache'),
  caseSetsPath: path.join(__dirname, 'output', 'case_sets', 'case_sets_v2.json'),
  popplerPath: 'C:\\poppler\\poppler-24.08.0\\Library\\bin',
  
  // 50페이지 이하 케이스만 (전체 처리 가능)
  targetCases: [2, 5, 13, 15, 17, 18, 29, 30, 41, 42, 44],
  
  model: 'gpt-4o-mini',
  rateLimitDelay: 5000,
  maxRetries: 3
};

// 케이스 세트 로드
function loadCaseSets() {
  if (fs.existsSync(CONFIG.caseSetsPath)) {
    return JSON.parse(fs.readFileSync(CONFIG.caseSetsPath, 'utf-8'));
  }
  return null;
}

// 디렉토리 생성
[CONFIG.outputDir, CONFIG.cacheDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// OpenAI 클라이언트
let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000,
      maxRetries: 2
    });
  }
  return openaiClient;
}

/**
 * 개선된 시스템 프롬프트
 * - 보험 관련 날짜 포함
 * - 과거 날짜 (5년 이상) 포함
 * - 광범위한 키워드 커버리지
 */
const IMPROVED_SYSTEM_PROMPT = `당신은 보험 손해사정 문서 분석 전문가입니다.
제공된 의료 기록 이미지를 분석하여 손해사정 조사에 필요한 **모든 날짜와 정보**를 빠짐없이 추출하세요.

**⚠️ 중요: 날짜 추출 원칙**
1. **모든 날짜를 추출하세요** - 아무리 오래된 과거 날짜도 누락하지 마세요 (5년, 10년 이전도 포함)
2. **보험 관련 날짜 필수** - 보험 가입일, 갱신일, 만기일, 보장개시일, 청약일, 계약일
3. **의료 관련 날짜 필수** - 초진일, 진료일, 입원일, 퇴원일, 수술일, 검사일, 검사보고일
4. **기타 중요 날짜** - 사고일, 발병일, 진단일, 통원기간, 청구일
5. **동일 날짜 중복 허용** - 같은 날짜가 다른 맥락으로 나타나면 모두 기록

**출력 JSON 스키마:**
{
  "patientInfo": {
    "name": "환자명",
    "birthDate": "YYYY-MM-DD",
    "gender": "성별"
  },
  "allDates": [
    {
      "date": "YYYY-MM-DD",
      "context": "날짜가 나타난 맥락 (예: 보험가입, 초진, 입원 등)",
      "type": "날짜 유형",
      "hospital": "관련 병원/기관 (있는 경우)",
      "pageHint": "추정 페이지 위치 (예: 앞부분, 중간, 뒷부분)"
    }
  ],
  "insuranceInfo": [
    {
      "type": "가입/갱신/청구/해지 등",
      "date": "YYYY-MM-DD",
      "company": "보험사명",
      "product": "상품명",
      "details": "기타 정보"
    }
  ],
  "diagnoses": [
    {
      "code": "KCD 코드 (예: C50.1, D18.02)",
      "nameKr": "진단명 한글",
      "date": "진단일",
      "hospital": "진단 병원"
    }
  ],
  "medicalEvents": [
    {
      "type": "진료/입원/수술/검사/치료/통원",
      "name": "상세 내용",
      "date": "YYYY-MM-DD",
      "endDate": "종료일 (입원/통원 기간인 경우)",
      "hospital": "병원명",
      "result": "결과 (검사인 경우)"
    }
  ],
  "hospitals": [
    {
      "name": "병원/기관명",
      "type": "병원/의원/센터/기타",
      "visits": ["방문일1", "방문일2"]
    }
  ],
  "rawTextSummary": "문서 전체 내용 요약 (500자 이내)"
}

**날짜 유형 분류:**
- 보험가입일, 보험갱신일, 보험만기일, 보장개시일, 청약일
- 초진일, 재진일, 진료일, 내원일
- 입원일, 퇴원일, 입원기간
- 수술일, 시술일
- 검사일, 검사보고일, 결과일
- 진단일, 확진일
- 사고일, 발병일, 증상발생일
- 통원시작일, 통원종료일
- 청구일, 접수일

**중요 지침:**
1. 모든 날짜는 YYYY-MM-DD 형식으로 통일
2. 날짜가 "2024.04.09"나 "24.4.9" 형식이면 "2024-04-09"로 변환
3. 불확실한 날짜도 추정하여 포함 (context에 "추정" 표시)
4. 보험 관련 정보는 insuranceInfo에 별도 정리
5. 손해사정에 중요한 모든 정보를 빠짐없이 추출`;

/**
 * PDF를 이미지로 변환 (페이지별)
 */
async function pdfToImages(pdfPath) {
  const images = [];
  const tempDir = path.join(CONFIG.outputDir, 'temp_images', path.basename(pdfPath, '.pdf'));
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    const pdftoppm = path.join(CONFIG.popplerPath, 'pdftoppm.exe');
    const outputPrefix = path.join(tempDir, 'page');
    
    execSync(`"${pdftoppm}" -png -r 150 "${pdfPath}" "${outputPrefix}"`, {
      maxBuffer: 100 * 1024 * 1024
    });
    
    const files = fs.readdirSync(tempDir)
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });
    
    for (const file of files) {
      const imgPath = path.join(tempDir, file);
      const optimized = await sharp(imgPath)
        .resize(1600, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      images.push({
        filename: file,
        base64: `data:image/jpeg;base64,${optimized.toString('base64')}`
      });
    }
  } catch (err) {
    console.error(`PDF 변환 오류: ${err.message}`);
  }
  
  return images;
}

/**
 * Vision LLM 호출 (개선된 프롬프트)
 */
async function callVisionLLM(images, caseInfo) {
  const client = getOpenAI();
  
  const imageContents = images.map(img => ({
    type: 'image_url',
    image_url: { url: img.base64, detail: 'high' }
  }));
  
  const userPrompt = `위 ${images.length}개 페이지의 의료/보험 문서를 분석하여 JSON 형식으로 출력하세요.
환자명: ${caseInfo.patientName || '문서에서 추출'}
케이스: ${caseInfo.caseId}

⚠️ 특히 다음 날짜들을 반드시 찾아주세요:
- 보험 가입일, 갱신일, 만기일
- 모든 진료/입원/수술/검사 날짜
- 과거 진료 기록 날짜 (아무리 오래된 것도)`;

  const response = await client.chat.completions.create({
    model: CONFIG.model,
    messages: [
      { role: 'system', content: IMPROVED_SYSTEM_PROMPT },
      { role: 'user', content: [...imageContents, { type: 'text', text: userPrompt }] }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
    temperature: 0.1
  });
  
  return {
    content: response.choices[0].message.content,
    usage: response.usage
  };
}

/**
 * Ground Truth에서 날짜 추출
 */
function extractGroundTruthDates(groundTruth) {
  const dates = new Set();
  
  // 다양한 날짜 패턴
  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      
      // 합리적인 범위 체크 (미래 날짜 제외 - 2030년 이후)
      if (y >= 1990 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

/**
 * AI 추출 결과에서 모든 날짜 수집
 */
function collectAIDates(generatedJson) {
  const dates = new Set();
  
  // allDates 배열
  if (generatedJson.allDates) {
    generatedJson.allDates.forEach(item => {
      if (item.date && item.date !== 'null') dates.add(item.date);
    });
  }
  
  // 기존 extractedDates
  if (generatedJson.extractedDates) {
    generatedJson.extractedDates.forEach(item => {
      if (item.date && item.date !== 'null') dates.add(item.date);
    });
  }
  
  // insuranceInfo
  if (generatedJson.insuranceInfo) {
    generatedJson.insuranceInfo.forEach(item => {
      if (item.date && item.date !== 'null') dates.add(item.date);
    });
  }
  
  // diagnoses
  if (generatedJson.diagnoses) {
    generatedJson.diagnoses.forEach(item => {
      if (item.date && item.date !== 'null') dates.add(item.date);
    });
  }
  
  // medicalEvents
  if (generatedJson.medicalEvents) {
    generatedJson.medicalEvents.forEach(item => {
      if (item.date && item.date !== 'null') dates.add(item.date);
      if (item.endDate && item.endDate !== 'null') dates.add(item.endDate);
    });
  }
  
  // hospitalizations
  if (generatedJson.hospitalizations) {
    generatedJson.hospitalizations.forEach(item => {
      if (item.admissionDate) dates.add(item.admissionDate);
      if (item.dischargeDate) dates.add(item.dischargeDate);
    });
  }
  
  // surgeries
  if (generatedJson.surgeries) {
    generatedJson.surgeries.forEach(item => {
      if (item.date) dates.add(item.date);
    });
  }
  
  // examinations
  if (generatedJson.examinations) {
    generatedJson.examinations.forEach(item => {
      if (item.date) dates.add(item.date);
    });
  }
  
  // hospitals visits
  if (generatedJson.hospitals) {
    generatedJson.hospitals.forEach(item => {
      if (item.visits) {
        item.visits.forEach(v => dates.add(v));
      }
    });
  }
  
  return Array.from(dates).filter(d => d && d !== 'null' && d.match(/^\d{4}-\d{2}-\d{2}$/)).sort();
}

/**
 * 개선된 매칭 분석
 * - Ground Truth 100% 포함율 측정
 */
function analyzeMatching(aiDates, gtDates) {
  const matched = gtDates.filter(d => aiDates.includes(d));
  const missed = gtDates.filter(d => !aiDates.includes(d));
  const extra = aiDates.filter(d => !gtDates.includes(d));
  
  // Ground Truth 포함율 (핵심 지표)
  const gtCoverageRate = gtDates.length > 0 
    ? Math.round((matched.length / gtDates.length) * 100) 
    : 100;
  
  // 정밀도 (추출한 날짜 중 GT에 있는 비율)
  const precision = aiDates.length > 0
    ? Math.round((matched.length / aiDates.length) * 100)
    : 0;
  
  return {
    gtDates,
    aiDates,
    matched,
    missed,
    extra,
    gtCoverageRate,  // 핵심: GT 날짜 중 몇 %를 포함했는가
    precision,
    gtCount: gtDates.length,
    aiCount: aiDates.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length
  };
}

/**
 * 케이스 처리
 */
async function processCase(caseNum) {
  const caseId = `Case${caseNum}`;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📋 ${caseId} 처리 시작`);
  
  const result = {
    caseId,
    caseNum,
    processedAt: new Date().toISOString(),
    totalPages: 0,
    success: false
  };
  
  try {
    // PDF 폴더 찾기
    const caseFolders = fs.readdirSync(CONFIG.pdfDir)
      .filter(f => f.toLowerCase().startsWith(`case${caseNum}_`));
    
    if (caseFolders.length === 0) {
      result.error = 'PDF 폴더 없음';
      return result;
    }
    
    const pdfFolder = path.join(CONFIG.pdfDir, caseFolders[0]);
    const pdfFiles = fs.readdirSync(pdfFolder).filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      result.error = 'PDF 파일 없음';
      return result;
    }
    
    // 환자명 추출
    const patientName = caseFolders[0].replace(`Case${caseNum}_`, '');
    result.patientName = patientName;
    
    // 모든 PDF를 이미지로 변환
    console.log(`  📄 PDF 변환 중...`);
    const allImages = [];
    const pageSourceMap = []; // 페이지별 원본 파일 추적
    
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(pdfFolder, pdfFile);
      const images = await pdfToImages(pdfPath);
      
      images.forEach((img, idx) => {
        pageSourceMap.push({
          sourceFile: pdfFile,
          sourcePageInFile: idx + 1
        });
      });
      
      allImages.push(...images);
    }
    
    result.totalPages = allImages.length;
    console.log(`  📄 총 ${result.totalPages}페이지`);
    
    // Vision LLM 호출
    console.log(`  🤖 Vision LLM 호출 중...`);
    const startTime = Date.now();
    
    let response;
    let retries = 0;
    
    while (retries < CONFIG.maxRetries) {
      try {
        response = await callVisionLLM(allImages, { caseId, patientName });
        break;
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          retries++;
          console.log(`  ⏳ Rate limit, 30초 대기 후 재시도 (${retries}/${CONFIG.maxRetries})`);
          await new Promise(r => setTimeout(r, 30000));
        } else {
          throw error;
        }
      }
    }
    
    if (!response) {
      result.error = 'Rate limit 초과';
      return result;
    }
    
    result.processingTime = Date.now() - startTime;
    result.usage = response.usage;
    
    // JSON 파싱
    let generatedJson;
    try {
      generatedJson = JSON.parse(response.content);
    } catch (e) {
      result.error = 'JSON 파싱 실패';
      result.rawContent = response.content;
      return result;
    }
    
    result.generatedJson = generatedJson;
    
    // Ground Truth 로드
    const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
    if (fs.existsSync(gtPath)) {
      result.groundTruth = fs.readFileSync(gtPath, 'utf-8');
    }
    
    // 날짜 매칭 분석
    const gtDates = result.groundTruth ? extractGroundTruthDates(result.groundTruth) : [];
    const aiDates = collectAIDates(generatedJson);
    
    result.matching = analyzeMatching(aiDates, gtDates);
    
    // 페이지 인덱스 생성 (Click to Evidence용)
    // Vision LLM은 전체 이미지를 한번에 처리하므로, 별도 페이지별 OCR 필요
    // 여기서는 메타데이터만 저장
    const pageData = allImages.map((img, idx) => ({
      text: '', // Vision LLM은 페이지별 텍스트를 제공하지 않음
      sourceFile: pageSourceMap[idx].sourceFile,
      sourcePageInFile: pageSourceMap[idx].sourcePageInFile
    }));
    
    // 결과 캐시 저장
    const cachePath = path.join(CONFIG.cacheDir, `${caseId}_improved.json`);
    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
    
    result.success = true;
    
    console.log(`  ✅ 완료: GT포함율 ${result.matching.gtCoverageRate}% (${result.matching.matchedCount}/${result.matching.gtCount})`);
    console.log(`     놓친 날짜: ${result.matching.missed.join(', ') || '없음'}`);
    
  } catch (error) {
    result.error = error.message;
    console.error(`  ❌ 오류: ${error.message}`);
  }
  
  return result;
}

/**
 * 전체 검증 실행
 */
async function runValidation() {
  console.log('🚀 개선된 검증 시스템 시작');
  console.log(`대상 케이스: ${CONFIG.targetCases.join(', ')}`);
  console.log(`모델: ${CONFIG.model}`);
  console.log('');
  
  const results = [];
  
  for (let i = 0; i < CONFIG.targetCases.length; i++) {
    const caseNum = CONFIG.targetCases[i];
    
    const result = await processCase(caseNum);
    results.push(result);
    
    // Rate limit 대기
    if (i < CONFIG.targetCases.length - 1) {
      console.log(`\n⏳ ${CONFIG.rateLimitDelay / 1000}초 대기...`);
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
  
  // 요약 생성
  const summary = generateSummary(results);
  
  // 결과 저장
  const outputPath = path.join(CONFIG.outputDir, 'validation_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  
  // 보고서 생성
  generateReport(summary, results);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 검증 완료');
  console.log(`   총 케이스: ${results.length}`);
  console.log(`   성공: ${results.filter(r => r.success).length}`);
  console.log(`   평균 GT 포함율: ${summary.avgGtCoverageRate}%`);
  console.log(`   결과 저장: ${outputPath}`);
}

/**
 * 요약 생성
 */
function generateSummary(results) {
  const successful = results.filter(r => r.success);
  
  const totalGtDates = successful.reduce((sum, r) => sum + r.matching.gtCount, 0);
  const totalMatched = successful.reduce((sum, r) => sum + r.matching.matchedCount, 0);
  const totalMissed = successful.reduce((sum, r) => sum + r.matching.missedCount, 0);
  const totalAiDates = successful.reduce((sum, r) => sum + r.matching.aiCount, 0);
  
  return {
    totalCases: results.length,
    successfulCases: successful.length,
    failedCases: results.length - successful.length,
    totalPages: successful.reduce((sum, r) => sum + r.totalPages, 0),
    
    // 핵심 지표: GT 포함율
    avgGtCoverageRate: successful.length > 0
      ? Math.round(successful.reduce((sum, r) => sum + r.matching.gtCoverageRate, 0) / successful.length)
      : 0,
    
    // 전체 GT 날짜 기준 포함율
    overallGtCoverageRate: totalGtDates > 0
      ? Math.round((totalMatched / totalGtDates) * 100)
      : 0,
    
    totalGtDates,
    totalMatched,
    totalMissed,
    totalAiDates,
    
    // 케이스별 요약
    casesSummary: successful.map(r => ({
      caseId: r.caseId,
      patientName: r.patientName,
      pages: r.totalPages,
      gtCoverage: r.matching.gtCoverageRate,
      gtDates: r.matching.gtCount,
      matched: r.matching.matchedCount,
      missed: r.matching.missed
    }))
  };
}

/**
 * HTML 보고서 생성
 */
function generateReport(summary, results) {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS 개선된 검증 보고서</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 1rem; }
    h2 { color: #2d3748; margin: 1.5rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    .card .value { font-size: 2.5rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }
    .card.danger .value { color: #ef4444; }
    
    .case-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .case-table th, .case-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .case-table th { background: #f8fafc; font-weight: 600; color: #475569; }
    .case-table tr:hover { background: #f8fafc; }
    
    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    
    .missed-dates { color: #dc2626; font-size: 0.875rem; }
    .insight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; }
    .insight h4 { color: #1e40af; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 VNEXSUS 날짜 매칭 개선 검증 보고서</h1>
    <p>검증일: ${new Date().toLocaleString('ko-KR')} | 모델: ${CONFIG.model} | Cycle 1</p>
    
    <h2>📊 핵심 지표</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 80 ? 'success' : summary.overallGtCoverageRate >= 50 ? 'warning' : 'danger'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">전체 GT 포함율</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">매칭된 날짜</div>
      </div>
      <div class="card ${summary.totalMissed === 0 ? 'success' : 'danger'}">
        <div class="value">${summary.totalMissed}</div>
        <div class="label">놓친 날짜</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI 추출 날짜</div>
      </div>
    </div>
    
    <div class="insight">
      <h4>💡 GT 포함율이란?</h4>
      <p>Ground Truth(사용자가 작성한 유효 날짜)가 AI 추출 결과에 100% 포함되어야 합니다.<br>
      현재 ${summary.overallGtCoverageRate}%는 ${summary.totalGtDates}개의 GT 날짜 중 ${summary.totalMatched}개를 포함했음을 의미합니다.</p>
    </div>
    
    <h2>📋 케이스별 상세</h2>
    <table class="case-table">
      <thead>
        <tr>
          <th>케이스</th>
          <th>환자명</th>
          <th>페이지</th>
          <th>GT 포함율</th>
          <th>GT 날짜</th>
          <th>매칭</th>
          <th>놓친 날짜</th>
        </tr>
      </thead>
      <tbody>
        ${summary.casesSummary.map(c => `
        <tr>
          <td><strong>${c.caseId}</strong></td>
          <td>${c.patientName}</td>
          <td>${c.pages}p</td>
          <td>
            <span class="badge ${c.gtCoverage >= 80 ? 'badge-success' : c.gtCoverage >= 50 ? 'badge-warning' : 'badge-danger'}">
              ${c.gtCoverage}%
            </span>
          </td>
          <td>${c.gtDates}개</td>
          <td>${c.matched}개</td>
          <td class="missed-dates">${c.missed.length > 0 ? c.missed.join(', ') : '✅ 없음'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>🔍 놓친 날짜 패턴 분석</h2>
    ${generateMissedDateAnalysis(results)}
    
    <h2>🚀 다음 단계</h2>
    <div class="insight">
      <h4>Cycle 2 개선 방향</h4>
      <ul>
        <li>놓친 날짜 패턴을 분석하여 프롬프트 추가 개선</li>
        <li>특정 유형의 날짜가 반복적으로 누락되면 해당 키워드 강조</li>
        <li>목표: GT 포함율 90% 이상 달성</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.outputDir, 'improved_validation_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`📄 보고서 저장: ${reportPath}`);
}

/**
 * 놓친 날짜 패턴 분석 HTML 생성
 */
function generateMissedDateAnalysis(results) {
  const allMissed = [];
  
  results.filter(r => r.success).forEach(r => {
    r.matching.missed.forEach(date => {
      allMissed.push({
        caseId: r.caseId,
        date,
        context: findDateContext(date, r.groundTruth)
      });
    });
  });
  
  if (allMissed.length === 0) {
    return '<p style="color: #10b981; font-weight: bold;">✅ 모든 GT 날짜가 포함되었습니다!</p>';
  }
  
  return `
    <table class="case-table">
      <thead>
        <tr>
          <th>케이스</th>
          <th>놓친 날짜</th>
          <th>Ground Truth 맥락</th>
        </tr>
      </thead>
      <tbody>
        ${allMissed.map(m => `
        <tr>
          <td>${m.caseId}</td>
          <td><strong>${m.date}</strong></td>
          <td style="font-size: 0.875rem; color: #64748b;">${m.context}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Ground Truth에서 날짜 주변 맥락 찾기
 */
function findDateContext(date, groundTruth) {
  if (!groundTruth) return '';
  
  const datePattern = date.replace(/-/g, '.');
  const idx = groundTruth.indexOf(datePattern);
  
  if (idx === -1) {
    // 다른 형식 시도
    const altPattern = date.replace(/-0/g, '-').replace(/-/g, '.');
    const altIdx = groundTruth.indexOf(altPattern);
    if (altIdx === -1) return '(맥락 없음)';
    return groundTruth.substring(Math.max(0, altIdx - 30), Math.min(groundTruth.length, altIdx + 60))
      .replace(/\r?\n/g, ' ').trim();
  }
  
  return groundTruth.substring(Math.max(0, idx - 30), Math.min(groundTruth.length, idx + 60))
    .replace(/\r?\n/g, ' ').trim();
}

// 실행
runValidation().catch(console.error);
