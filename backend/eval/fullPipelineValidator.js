/**
 * 전체 파이프라인 검증 스크립트
 * 
 * Vision LLM (OCR) + 후처리 로직 + 보고서 생성
 * - gpt-4o-mini: 19개 케이스 전체
 * - gpt-4o: 10개 케이스 (대용량 제외)
 * - OCR 결과 캐시 저장 (재사용 가능)
 * - 상세 매칭 검증 및 HTML 보고서 생성
 * 
 * 실행: node backend/eval/fullPipelineValidator.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { execSync } from 'child_process';
import sharp from 'sharp';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  popplerPath: process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin',
  outputDir: path.join(__dirname, 'output/full_pipeline_validation'),
  cacheDir: path.join(__dirname, 'output/full_pipeline_validation/ocr_cache'),
  reportsDir: path.join(__dirname, 'output/full_pipeline_validation/reports'),
  tempDir: path.join(__dirname, 'output/full_pipeline_validation/temp'),
  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  pageCountsPath: path.join(__dirname, 'output/pdf_page_counts.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 대용량 케이스 (100p 이상) 제외
  largeCases: [9, 11, 38], // Case9(191p), Case11(134p), Case38(115p)
  
  // API 설정
  rateLimitDelay: 10000, // 10초 딜레이 (Rate limit 대응)
  maxRetries: 3,
  maxPagesPerCall: 50, // API 호출당 최대 페이지 (토큰 제한 대응)
  
  // 비용 단가 (페이지당)
  costPerPage: {
    'gpt-4o-mini': 0.0054,
    'gpt-4o': 0.0083
  }
};

// OpenAI 클라이언트
let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000,
      maxRetries: CONFIG.maxRetries
    });
  }
  return openai;
}

// 디렉토리 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.cacheDir, CONFIG.reportsDir, CONFIG.tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// PDF를 이미지로 변환
async function pdfToImages(pdfPath, maxPages = 999) {
  const pdftoppm = path.join(CONFIG.popplerPath, 'pdftoppm.exe');
  const tempDir = path.join(CONFIG.tempDir, `pdf-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const outputPrefix = path.join(tempDir, 'page');
  
  try {
    const cmd = `"${pdftoppm}" -jpeg -r 150 -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;
    execSync(cmd, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
    
    const imageFiles = fs.readdirSync(tempDir)
      .filter(f => f.endsWith('.jpg'))
      .sort();
    
    const images = [];
    for (const file of imageFiles) {
      const imagePath = path.join(tempDir, file);
      let buffer = fs.readFileSync(imagePath);
      
      // 이미지 최적화
      try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width > 2000 || metadata.height > 2000) {
          buffer = await sharp(buffer)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        }
      } catch (e) {
        // 원본 사용
      }
      
      images.push({
        filename: file,
        base64: `data:image/jpeg;base64,${buffer.toString('base64')}`
      });
    }
    
    // 정리
    imageFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
    fs.rmdirSync(tempDir);
    
    return images;
  } catch (error) {
    console.error(`PDF 변환 실패: ${error.message}`);
    throw error;
  }
}

// Vision LLM 호출
async function callVisionLLM(images, modelName, caseInfo) {
  const client = getOpenAI();
  
  const imageContents = images.map(img => ({
    type: 'image_url',
    image_url: { url: img.base64, detail: 'high' }
  }));
  
  const systemPrompt = `당신은 보험 청구 문서 분석 전문가입니다.
제공된 의료 기록 이미지를 분석하여 10항목 손해사정 보고서를 JSON 형식으로 생성하세요.

**출력 JSON 스키마:**
{
  "patientInfo": {
    "name": "환자명",
    "birthDate": "생년월일 (YYYY-MM-DD)",
    "gender": "성별"
  },
  "visitDate": {
    "date": "최초 내원일 (YYYY-MM-DD)",
    "hospital": "병원명",
    "department": "진료과"
  },
  "chiefComplaint": {
    "summary": "주요 증상 요약",
    "onsetDate": "증상 발생일",
    "details": "상세 내용"
  },
  "diagnoses": [
    {
      "code": "KCD 코드 (예: C50.1)",
      "nameKr": "진단명 한글",
      "date": "진단일",
      "isPrimary": true,
      "hospital": "진단 병원"
    }
  ],
  "examinations": [
    {
      "name": "검사명",
      "date": "검사일",
      "result": "결과",
      "hospital": "검사 병원"
    }
  ],
  "treatments": [
    {
      "name": "치료명/시술명",
      "date": "치료일",
      "hospital": "치료 병원"
    }
  ],
  "medications": [
    {
      "name": "약물명",
      "dosage": "용량",
      "period": "투여기간"
    }
  ],
  "hospitalizations": [
    {
      "hospital": "병원명",
      "admissionDate": "입원일",
      "dischargeDate": "퇴원일",
      "reason": "입원 사유"
    }
  ],
  "surgeries": [
    {
      "name": "수술명",
      "date": "수술일",
      "hospital": "수술 병원"
    }
  ],
  "prognosis": {
    "summary": "예후 요약",
    "followUpDate": "추적관찰일"
  },
  "extractedDates": [
    {
      "date": "YYYY-MM-DD",
      "context": "날짜가 나타난 맥락",
      "type": "진료일/입원일/수술일/검사일 등"
    }
  ],
  "extractedHospitals": ["병원명1", "병원명2"],
  "rawTextSummary": "문서 내용 요약 (500자 이내)"
}

**중요 지침:**
1. 모든 날짜는 YYYY-MM-DD 형식으로 통일
2. KCD 코드는 정확하게 추출 (예: C50.1, I10, M51.1)
3. 발견된 모든 날짜를 extractedDates에 포함
4. 발견된 모든 병원명을 extractedHospitals에 포함
5. 확실하지 않은 정보는 null로 표시`;

  const userPrompt = `위 ${images.length}개 페이지의 의료 문서를 분석하여 JSON 형식으로 출력하세요.
환자명: ${caseInfo.patientName || '문서에서 추출'}
케이스: ${caseInfo.caseId}`;

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [...imageContents, { type: 'text', text: userPrompt }] }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0.2
  });
  
  return {
    content: response.choices[0].message.content,
    usage: response.usage
  };
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// 매칭 분석
function analyzeMatching(generated, groundTruth) {
  const result = {
    dates: { matched: [], missed: [], extra: [], rate: 0 },
    kcdCodes: { matched: [], missed: [], extra: [], rate: 0 },
    hospitals: { matched: [], missed: [], extra: [], rate: 0 },
    examinations: { matched: [], missed: [], extra: [], rate: 0 },
    treatments: { matched: [], missed: [], extra: [], rate: 0 },
    diagnoses: { matched: [], missed: [], extra: [], rate: 0 }
  };
  
  // 날짜 추출
  const dateRegex = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
  const gtDates = new Set((groundTruth.match(dateRegex) || []).map(d => d.replace(/[./]/g, '-')));
  const genDates = new Set();
  
  if (generated.extractedDates) {
    generated.extractedDates.forEach(d => {
      if (d.date) genDates.add(d.date);
    });
  }
  if (generated.visitDate?.date) genDates.add(generated.visitDate.date);
  if (generated.diagnoses) {
    generated.diagnoses.forEach(d => { if (d.date) genDates.add(d.date); });
  }
  if (generated.examinations) {
    generated.examinations.forEach(e => { if (e.date) genDates.add(e.date); });
  }
  if (generated.treatments) {
    generated.treatments.forEach(t => { if (t.date) genDates.add(t.date); });
  }
  if (generated.hospitalizations) {
    generated.hospitalizations.forEach(h => {
      if (h.admissionDate) genDates.add(h.admissionDate);
      if (h.dischargeDate) genDates.add(h.dischargeDate);
    });
  }
  if (generated.surgeries) {
    generated.surgeries.forEach(s => { if (s.date) genDates.add(s.date); });
  }
  
  gtDates.forEach(d => {
    if (genDates.has(d)) {
      result.dates.matched.push(d);
    } else {
      result.dates.missed.push(d);
    }
  });
  genDates.forEach(d => {
    if (!gtDates.has(d)) {
      result.dates.extra.push(d);
    }
  });
  result.dates.rate = gtDates.size > 0 ? Math.round(result.dates.matched.length / gtDates.size * 100) : 0;
  
  // KCD 코드 추출
  const kcdRegex = /[A-Z]\d{2}(?:\.\d{1,2})?/g;
  const gtKcd = new Set(groundTruth.match(kcdRegex) || []);
  const genKcd = new Set();
  
  if (generated.diagnoses) {
    generated.diagnoses.forEach(d => {
      if (d.code) {
        const match = d.code.match(kcdRegex);
        if (match) match.forEach(c => genKcd.add(c));
      }
    });
  }
  
  gtKcd.forEach(c => {
    if (genKcd.has(c)) {
      result.kcdCodes.matched.push(c);
    } else {
      result.kcdCodes.missed.push(c);
    }
  });
  genKcd.forEach(c => {
    if (!gtKcd.has(c)) {
      result.kcdCodes.extra.push(c);
    }
  });
  result.kcdCodes.rate = gtKcd.size > 0 ? Math.round(result.kcdCodes.matched.length / gtKcd.size * 100) : 0;
  
  // 병원명 추출
  const hospitalKeywords = ['병원', '의원', '의료원', '센터', '클리닉'];
  const gtHospitals = new Set();
  const genHospitals = new Set();
  
  hospitalKeywords.forEach(kw => {
    const regex = new RegExp(`[가-힣A-Za-z0-9]+${kw}`, 'g');
    (groundTruth.match(regex) || []).forEach(h => gtHospitals.add(h));
  });
  
  if (generated.extractedHospitals) {
    generated.extractedHospitals.forEach(h => genHospitals.add(h));
  }
  if (generated.visitDate?.hospital) genHospitals.add(generated.visitDate.hospital);
  if (generated.diagnoses) {
    generated.diagnoses.forEach(d => { if (d.hospital) genHospitals.add(d.hospital); });
  }
  
  gtHospitals.forEach(h => {
    const found = [...genHospitals].some(gh => gh.includes(h) || h.includes(gh));
    if (found) {
      result.hospitals.matched.push(h);
    } else {
      result.hospitals.missed.push(h);
    }
  });
  result.hospitals.rate = gtHospitals.size > 0 ? Math.round(result.hospitals.matched.length / gtHospitals.size * 100) : 0;
  
  // 검사 추출
  const examKeywords = ['CT', 'MRI', 'X-ray', '초음파', '내시경', '조직검사', 'PET', 'MRA', '혈액검사'];
  const gtExams = new Set();
  const genExams = new Set();
  
  examKeywords.forEach(kw => {
    if (groundTruth.includes(kw)) gtExams.add(kw);
  });
  
  if (generated.examinations) {
    generated.examinations.forEach(e => {
      examKeywords.forEach(kw => {
        if (e.name && e.name.includes(kw)) genExams.add(kw);
      });
    });
  }
  
  gtExams.forEach(e => {
    if (genExams.has(e)) {
      result.examinations.matched.push(e);
    } else {
      result.examinations.missed.push(e);
    }
  });
  result.examinations.rate = gtExams.size > 0 ? Math.round(result.examinations.matched.length / gtExams.size * 100) : 0;
  
  // 치료 추출
  const treatKeywords = ['수술', '절제술', '항암', '방사선', '치료', '시술'];
  const gtTreats = new Set();
  const genTreats = new Set();
  
  treatKeywords.forEach(kw => {
    const regex = new RegExp(`[가-힣]*${kw}[가-힣]*`, 'g');
    (groundTruth.match(regex) || []).forEach(t => gtTreats.add(t));
  });
  
  if (generated.treatments) {
    generated.treatments.forEach(t => { if (t.name) genTreats.add(t.name); });
  }
  if (generated.surgeries) {
    generated.surgeries.forEach(s => { if (s.name) genTreats.add(s.name); });
  }
  
  gtTreats.forEach(t => {
    const found = [...genTreats].some(gt => gt.includes(t) || t.includes(gt));
    if (found) {
      result.treatments.matched.push(t);
    } else {
      result.treatments.missed.push(t);
    }
  });
  result.treatments.rate = gtTreats.size > 0 ? Math.round(result.treatments.matched.length / gtTreats.size * 100) : 0;
  
  return result;
}

// 케이스 처리 (배치 처리 및 페이지 제한 적용)
async function processCase(caseInfo, modelName, pageCounts) {
  const caseNum = caseInfo.caseNum;
  const cacheFile = path.join(CONFIG.cacheDir, `case_${caseNum}_${modelName.replace('gpt-', '')}.json`);
  
  // 캐시 확인
  if (fs.existsSync(cacheFile)) {
    console.log(`  📦 캐시 사용: ${cacheFile}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }
  
  const startTime = Date.now();
  const result = {
    caseId: caseInfo.caseId,
    caseNum,
    patientName: caseInfo.patientName,
    model: modelName,
    totalPages: 0,
    processedPages: 0,
    processedAt: new Date().toISOString(),
    processingTime: 0,
    cost: 0,
    usage: null,
    generatedJson: null,
    groundTruth: null,
    matching: null,
    error: null,
    batches: []
  };
  
  try {
    // PDF 파일 수집
    const pdfFolder = caseInfo.files.pdfFolder;
    const pdfFiles = caseInfo.pdfFiles.filter(f => 
      !f.includes('심평원') && !f.includes('문답서')
    );
    
    console.log(`  📁 PDF 파일: ${pdfFiles.length}개`);
    
    // 모든 PDF를 이미지로 변환
    const allImages = [];
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(pdfFolder, pdfFile);
      console.log(`    - ${pdfFile} 변환 중...`);
      const images = await pdfToImages(pdfPath);
      allImages.push(...images);
      result.totalPages += images.length;
    }
    
    // 페이지 제한 적용 (토큰 제한 대응)
    const pagesToProcess = allImages.slice(0, CONFIG.maxPagesPerCall);
    result.processedPages = pagesToProcess.length;
    
    if (result.totalPages > CONFIG.maxPagesPerCall) {
      console.log(`  ⚠️ 페이지 제한: ${result.totalPages}p → ${result.processedPages}p (최대 ${CONFIG.maxPagesPerCall}p)`);
    }
    
    console.log(`  📄 ${result.processedPages}페이지 → Vision LLM 호출 (${modelName})`);
    
    // Vision LLM 호출 (재시도 로직 포함)
    let response = null;
    let retries = 0;
    while (retries < CONFIG.maxRetries) {
      try {
        response = await callVisionLLM(pagesToProcess, modelName, caseInfo);
        break;
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          retries++;
          const waitTime = 15000 * retries; // 15초, 30초, 45초
          console.log(`  ⏳ Rate limit, ${waitTime/1000}초 대기 후 재시도 (${retries}/${CONFIG.maxRetries})`);
          await new Promise(r => setTimeout(r, waitTime));
        } else {
          throw error;
        }
      }
    }
    
    if (!response) {
      throw new Error('최대 재시도 횟수 초과');
    }
    
    result.usage = response.usage;
    result.cost = result.processedPages * CONFIG.costPerPage[modelName];
    
    // JSON 파싱
    try {
      result.generatedJson = JSON.parse(response.content);
    } catch (e) {
      result.generatedJson = { rawContent: response.content, parseError: e.message };
    }
    
    // Ground Truth 로드 및 매칭 분석
    result.groundTruth = loadGroundTruth(caseNum);
    if (result.groundTruth && result.generatedJson) {
      result.matching = analyzeMatching(result.generatedJson, result.groundTruth);
    }
    
    result.processingTime = Date.now() - startTime;
    
    // 캐시 저장
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  ✅ 완료 (${Math.round(result.processingTime / 1000)}초, $${result.cost.toFixed(3)})`);
    
  } catch (error) {
    result.error = error.message;
    result.processingTime = Date.now() - startTime;
    console.error(`  ❌ 오류: ${error.message}`);
    
    // 오류 발생 시에도 캐시 저장 (재시도 방지)
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
  }
  
  return result;
}

// HTML 보고서 생성
function generateHTMLReport(results, summary) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS 파이프라인 검증 보고서 - ${timestamp}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #1a237e; border-bottom: 3px solid #3f51b5; padding-bottom: 10px; }
    h2 { color: #283593; margin-top: 30px; }
    h3 { color: #303f9f; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .summary-card h4 { margin: 0 0 10px 0; color: #5c6bc0; }
    .summary-card .value { font-size: 2em; font-weight: bold; color: #1a237e; }
    .summary-card .label { color: #666; font-size: 0.9em; }
    .model-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
    .model-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .model-card.mini { border-top: 4px solid #4caf50; }
    .model-card.full { border-top: 4px solid #2196f3; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
    th, td { padding: 12px; text-align: left; border: 1px solid #e0e0e0; }
    th { background: #e8eaf6; color: #1a237e; }
    tr:nth-child(even) { background: #fafafa; }
    .rate-bar { height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
    .rate-fill { height: 100%; border-radius: 10px; transition: width 0.3s; }
    .rate-fill.high { background: linear-gradient(90deg, #4caf50, #8bc34a); }
    .rate-fill.medium { background: linear-gradient(90deg, #ff9800, #ffb74d); }
    .rate-fill.low { background: linear-gradient(90deg, #f44336, #e57373); }
    .insight-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; border-radius: 0 5px 5px 0; }
    .insight-box.critical { background: #ffebee; border-left-color: #f44336; }
    .insight-box.success { background: #e8f5e9; border-left-color: #4caf50; }
    .insight-box.info { background: #e3f2fd; border-left-color: #2196f3; }
    .case-detail { background: white; margin: 20px 0; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .matching-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .matching-item { padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .matching-item .title { font-weight: bold; color: #333; }
    .matching-item .count { font-size: 1.2em; color: #1a237e; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin: 2px; }
    .tag.matched { background: #c8e6c9; color: #2e7d32; }
    .tag.missed { background: #ffcdd2; color: #c62828; }
    .tag.extra { background: #fff9c4; color: #f57f17; }
    .footer { margin-top: 40px; padding: 20px; text-align: center; color: #666; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 VNEXSUS 파이프라인 검증 보고서</h1>
    <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
    
    <h2>📊 검증 요약</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h4>총 케이스</h4>
        <div class="value">${summary.totalCases}</div>
        <div class="label">gpt-4o-mini: ${summary.miniCases}개 / gpt-4o: ${summary.fullCases}개</div>
      </div>
      <div class="summary-card">
        <h4>총 페이지</h4>
        <div class="value">${summary.totalPages.toLocaleString()}</div>
        <div class="label">PDF 문서 전체 페이지</div>
      </div>
      <div class="summary-card">
        <h4>총 비용</h4>
        <div class="value">$${summary.totalCost.toFixed(2)}</div>
        <div class="label">gpt-4o-mini: $${summary.miniCost.toFixed(2)} / gpt-4o: $${summary.fullCost.toFixed(2)}</div>
      </div>
      <div class="summary-card">
        <h4>평균 처리시간</h4>
        <div class="value">${Math.round(summary.avgProcessingTime / 1000)}초</div>
        <div class="label">케이스당 평균</div>
      </div>
    </div>
    
    <h2>⚖️ 모델 성능 비교</h2>
    <div class="model-comparison">
      <div class="model-card mini">
        <h3>🟢 gpt-4o-mini</h3>
        <p><strong>케이스:</strong> ${summary.miniCases}개 (전체)</p>
        <p><strong>비용:</strong> $${summary.miniCost.toFixed(2)} (페이지당 $${CONFIG.costPerPage['gpt-4o-mini']})</p>
        <table>
          <tr><th>항목</th><th>평균 매칭률</th></tr>
          <tr><td>날짜</td><td><div class="rate-bar"><div class="rate-fill ${summary.miniAvg.dates >= 50 ? 'high' : summary.miniAvg.dates >= 25 ? 'medium' : 'low'}" style="width: ${summary.miniAvg.dates}%"></div></div> ${summary.miniAvg.dates}%</td></tr>
          <tr><td>KCD 코드</td><td><div class="rate-bar"><div class="rate-fill ${summary.miniAvg.kcd >= 50 ? 'high' : summary.miniAvg.kcd >= 25 ? 'medium' : 'low'}" style="width: ${summary.miniAvg.kcd}%"></div></div> ${summary.miniAvg.kcd}%</td></tr>
          <tr><td>병원명</td><td><div class="rate-bar"><div class="rate-fill ${summary.miniAvg.hospitals >= 50 ? 'high' : summary.miniAvg.hospitals >= 25 ? 'medium' : 'low'}" style="width: ${summary.miniAvg.hospitals}%"></div></div> ${summary.miniAvg.hospitals}%</td></tr>
          <tr><td>검사</td><td><div class="rate-bar"><div class="rate-fill ${summary.miniAvg.exams >= 50 ? 'high' : summary.miniAvg.exams >= 25 ? 'medium' : 'low'}" style="width: ${summary.miniAvg.exams}%"></div></div> ${summary.miniAvg.exams}%</td></tr>
          <tr><td>치료</td><td><div class="rate-bar"><div class="rate-fill ${summary.miniAvg.treats >= 50 ? 'high' : summary.miniAvg.treats >= 25 ? 'medium' : 'low'}" style="width: ${summary.miniAvg.treats}%"></div></div> ${summary.miniAvg.treats}%</td></tr>
        </table>
      </div>
      <div class="model-card full">
        <h3>🔵 gpt-4o</h3>
        <p><strong>케이스:</strong> ${summary.fullCases}개 (대용량 제외)</p>
        <p><strong>비용:</strong> $${summary.fullCost.toFixed(2)} (페이지당 $${CONFIG.costPerPage['gpt-4o']})</p>
        <table>
          <tr><th>항목</th><th>평균 매칭률</th></tr>
          <tr><td>날짜</td><td><div class="rate-bar"><div class="rate-fill ${summary.fullAvg.dates >= 50 ? 'high' : summary.fullAvg.dates >= 25 ? 'medium' : 'low'}" style="width: ${summary.fullAvg.dates}%"></div></div> ${summary.fullAvg.dates}%</td></tr>
          <tr><td>KCD 코드</td><td><div class="rate-bar"><div class="rate-fill ${summary.fullAvg.kcd >= 50 ? 'high' : summary.fullAvg.kcd >= 25 ? 'medium' : 'low'}" style="width: ${summary.fullAvg.kcd}%"></div></div> ${summary.fullAvg.kcd}%</td></tr>
          <tr><td>병원명</td><td><div class="rate-bar"><div class="rate-fill ${summary.fullAvg.hospitals >= 50 ? 'high' : summary.fullAvg.hospitals >= 25 ? 'medium' : 'low'}" style="width: ${summary.fullAvg.hospitals}%"></div></div> ${summary.fullAvg.hospitals}%</td></tr>
          <tr><td>검사</td><td><div class="rate-bar"><div class="rate-fill ${summary.fullAvg.exams >= 50 ? 'high' : summary.fullAvg.exams >= 25 ? 'medium' : 'low'}" style="width: ${summary.fullAvg.exams}%"></div></div> ${summary.fullAvg.exams}%</td></tr>
          <tr><td>치료</td><td><div class="rate-bar"><div class="rate-fill ${summary.fullAvg.treats >= 50 ? 'high' : summary.fullAvg.treats >= 25 ? 'medium' : 'low'}" style="width: ${summary.fullAvg.treats}%"></div></div> ${summary.fullAvg.treats}%</td></tr>
        </table>
      </div>
    </div>
    
    <h2>💡 인사이트 및 개선 방향</h2>
    ${generateInsights(summary)}
    
    <h2>📋 케이스별 상세 결과</h2>
    ${results.map(r => generateCaseDetailHTML(r)).join('')}
    
    <div class="footer">
      <p>VNEXSUS AI 손해사정 시스템 - 파이프라인 검증 보고서</p>
      <p>생성: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, `full_pipeline_report_${timestamp}.html`);
  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

function generateInsights(summary) {
  const insights = [];
  
  // 모델 비교 인사이트
  if (summary.fullAvg && summary.miniAvg) {
    const dateDiff = summary.fullAvg.dates - summary.miniAvg.dates;
    const kcdDiff = summary.fullAvg.kcd - summary.miniAvg.kcd;
    const costRatio = CONFIG.costPerPage['gpt-4o'] / CONFIG.costPerPage['gpt-4o-mini'];
    
    if (dateDiff > 10) {
      insights.push({
        type: 'info',
        title: '📅 날짜 추출 성능',
        content: `gpt-4o가 날짜 추출에서 ${dateDiff}%p 더 높은 성능을 보입니다. 날짜 정확도가 중요한 경우 gpt-4o 사용을 권장합니다.`
      });
    }
    
    if (kcdDiff > 15) {
      insights.push({
        type: 'success',
        title: '🏥 KCD 코드 인식',
        content: `gpt-4o가 KCD 진단코드 추출에서 ${kcdDiff}%p 우수합니다. 진단코드 정확도가 필수인 보험 심사에 적합합니다.`
      });
    }
    
    insights.push({
      type: 'info',
      title: '💰 비용 효율성',
      content: `gpt-4o는 gpt-4o-mini 대비 ${costRatio.toFixed(1)}배 비용이 발생합니다. 비용 대비 성능 향상이 ${((dateDiff + kcdDiff) / 2).toFixed(1)}%p로, ${(dateDiff + kcdDiff) / 2 > 10 ? '투자 가치가 있습니다.' : '일반 케이스는 gpt-4o-mini가 효율적입니다.'}`
    });
  }
  
  // 날짜 매칭 개선
  if (summary.miniAvg.dates < 30) {
    insights.push({
      type: 'critical',
      title: '⚠️ 날짜 매칭률 개선 필요',
      content: `현재 날짜 매칭률이 ${summary.miniAvg.dates}%로 낮습니다. 원인: 1) 여러 날짜 형식 혼재 (YYYY.MM.DD, YYYY년 MM월 DD일 등), 2) 이미지 품질 문제, 3) 손글씨/스캔 문서. 개선안: 날짜 형식 정규화 후처리 강화, 이미지 전처리 개선.`
    });
  }
  
  // KCD 코드 개선
  if (summary.miniAvg.kcd < 20) {
    insights.push({
      type: 'critical',
      title: '🔍 KCD 코드 추출 한계',
      content: `KCD 코드 매칭률이 ${summary.miniAvg.kcd}%로 매우 낮습니다. 원인: 1) 진단서가 후반 페이지에 위치, 2) 코드 누락/오인식. 개선안: 전체 페이지 처리, KCD 코드 데이터베이스 기반 검증 추가.`
    });
  }
  
  // 병원명 개선
  if (summary.miniAvg.hospitals >= 50) {
    insights.push({
      type: 'success',
      title: '✅ 병원명 추출 양호',
      content: `병원명 추출률이 ${summary.miniAvg.hospitals}%로 양호합니다. 문서 헤더에 병원명이 명확하게 표시된 경우가 많아 인식률이 높습니다.`
    });
  }
  
  // 검사/치료 개선
  insights.push({
    type: 'info',
    title: '🧪 검사/치료 매칭 개선안',
    content: `검사(${summary.miniAvg.exams}%), 치료(${summary.miniAvg.treats}%) 매칭률 향상을 위해: 1) 의료 용어 사전 기반 후처리 추가, 2) 유사어 매칭 (예: "위내시경" = "상부위장관내시경"), 3) 약어 확장 (CT, MRI 등).`
  });
  
  // 시스템 권장사항
  insights.push({
    type: 'info',
    title: '🚀 시스템 권장사항',
    content: `1) 일반 케이스: gpt-4o-mini 사용 (비용 효율적)\n2) 복잡/고위험 케이스: gpt-4o 사용 (정확도 우선)\n3) OCR 캐시 활용으로 재처리 시 비용 절감\n4) 후처리 로직에서 날짜/병원명 정규화 강화`
  });
  
  return insights.map(i => `
    <div class="insight-box ${i.type}">
      <strong>${i.title}</strong>
      <p>${i.content.replace(/\n/g, '<br>')}</p>
    </div>
  `).join('');
}

function generateCaseDetailHTML(result) {
  if (!result || result.error) {
    return `<div class="case-detail">
      <h3>${result?.caseId || 'Unknown'} - ❌ 오류</h3>
      <p>오류: ${result?.error || '알 수 없는 오류'}</p>
    </div>`;
  }
  
  const m = result.matching || {};
  
  return `<div class="case-detail">
    <h3>${result.caseId} (${result.patientName}) - ${result.model}</h3>
    <p><strong>페이지:</strong> ${result.totalPages}p | <strong>처리시간:</strong> ${Math.round(result.processingTime / 1000)}초 | <strong>비용:</strong> $${result.cost.toFixed(3)}</p>
    
    <div class="matching-grid">
      <div class="matching-item">
        <div class="title">📅 날짜 매칭</div>
        <div class="count">${m.dates?.rate || 0}%</div>
        <div>일치: ${m.dates?.matched?.length || 0} / 누락: ${m.dates?.missed?.length || 0}</div>
        <div>${(m.dates?.matched || []).slice(0, 3).map(d => `<span class="tag matched">${d}</span>`).join('')}</div>
        <div>${(m.dates?.missed || []).slice(0, 3).map(d => `<span class="tag missed">${d}</span>`).join('')}</div>
      </div>
      <div class="matching-item">
        <div class="title">🏷️ KCD 코드</div>
        <div class="count">${m.kcdCodes?.rate || 0}%</div>
        <div>일치: ${m.kcdCodes?.matched?.length || 0} / 누락: ${m.kcdCodes?.missed?.length || 0}</div>
        <div>${(m.kcdCodes?.matched || []).map(c => `<span class="tag matched">${c}</span>`).join('')}</div>
        <div>${(m.kcdCodes?.missed || []).map(c => `<span class="tag missed">${c}</span>`).join('')}</div>
      </div>
      <div class="matching-item">
        <div class="title">🏥 병원명</div>
        <div class="count">${m.hospitals?.rate || 0}%</div>
        <div>일치: ${m.hospitals?.matched?.length || 0} / 누락: ${m.hospitals?.missed?.length || 0}</div>
        <div>${(m.hospitals?.matched || []).slice(0, 2).map(h => `<span class="tag matched">${h}</span>`).join('')}</div>
      </div>
      <div class="matching-item">
        <div class="title">🧪 검사</div>
        <div class="count">${m.examinations?.rate || 0}%</div>
        <div>일치: ${m.examinations?.matched?.length || 0} / 누락: ${m.examinations?.missed?.length || 0}</div>
      </div>
      <div class="matching-item">
        <div class="title">💊 치료</div>
        <div class="count">${m.treatments?.rate || 0}%</div>
        <div>일치: ${m.treatments?.matched?.length || 0} / 누락: ${m.treatments?.missed?.length || 0}</div>
      </div>
    </div>
  </div>`;
}

// 메인 실행
async function main() {
  console.log('==============================================');
  console.log('🔬 VNEXSUS 전체 파이프라인 검증 시작');
  console.log('==============================================\n');
  
  initDirectories();
  
  // 케이스 정보 로드
  const caseSets = JSON.parse(fs.readFileSync(CONFIG.caseSetsPath, 'utf-8'));
  const pageCounts = JSON.parse(fs.readFileSync(CONFIG.pageCountsPath, 'utf-8'));
  
  const allCases = caseSets.sets.pdfMatchedSet.map(c => {
    const caseNum = parseInt(c.caseId.replace('Case', ''));
    return {
      ...c,
      ...caseSets.details[caseNum],
      caseNum,
      isLarge: CONFIG.largeCases.includes(caseNum)
    };
  });
  
  // gpt-4o-mini: 19개 전체
  const miniCases = allCases;
  
  // gpt-4o: 10개 (대용량 제외, 페이지 적은 순)
  const fullCases = allCases
    .filter(c => !c.isLarge)
    .sort((a, b) => a.totalPages - b.totalPages)
    .slice(0, 10);
  
  console.log(`📋 gpt-4o-mini 대상: ${miniCases.length}개 케이스`);
  console.log(`📋 gpt-4o 대상: ${fullCases.length}개 케이스 (대용량 ${CONFIG.largeCases.length}개 제외)`);
  
  const results = [];
  
  // gpt-4o-mini 처리
  console.log('\n========== gpt-4o-mini 검증 ==========');
  for (let i = 0; i < miniCases.length; i++) {
    const c = miniCases[i];
    console.log(`\n[${i + 1}/${miniCases.length}] ${c.caseId} (${c.patientName})`);
    
    const result = await processCase(c, 'gpt-4o-mini', pageCounts);
    results.push(result);
    
    // Rate limit 대응
    if (i < miniCases.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
  
  // gpt-4o 처리
  console.log('\n========== gpt-4o 검증 ==========');
  for (let i = 0; i < fullCases.length; i++) {
    const c = fullCases[i];
    console.log(`\n[${i + 1}/${fullCases.length}] ${c.caseId} (${c.patientName})`);
    
    const result = await processCase(c, 'gpt-4o', pageCounts);
    results.push(result);
    
    // Rate limit 대응
    if (i < fullCases.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
  
  // 요약 계산
  const miniResults = results.filter(r => r.model === 'gpt-4o-mini' && !r.error);
  const fullResults = results.filter(r => r.model === 'gpt-4o' && !r.error);
  
  const calcAvg = (arr, field) => {
    const valid = arr.filter(r => r.matching?.[field]?.rate !== undefined);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((sum, r) => sum + r.matching[field].rate, 0) / valid.length);
  };
  
  const summary = {
    totalCases: results.length,
    miniCases: miniResults.length,
    fullCases: fullResults.length,
    totalPages: results.reduce((sum, r) => sum + (r.totalPages || 0), 0),
    totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    miniCost: miniResults.reduce((sum, r) => sum + (r.cost || 0), 0),
    fullCost: fullResults.reduce((sum, r) => sum + (r.cost || 0), 0),
    avgProcessingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length,
    miniAvg: {
      dates: calcAvg(miniResults, 'dates'),
      kcd: calcAvg(miniResults, 'kcdCodes'),
      hospitals: calcAvg(miniResults, 'hospitals'),
      exams: calcAvg(miniResults, 'examinations'),
      treats: calcAvg(miniResults, 'treatments')
    },
    fullAvg: {
      dates: calcAvg(fullResults, 'dates'),
      kcd: calcAvg(fullResults, 'kcdCodes'),
      hospitals: calcAvg(fullResults, 'hospitals'),
      exams: calcAvg(fullResults, 'examinations'),
      treats: calcAvg(fullResults, 'treatments')
    }
  };
  
  // JSON 결과 저장
  const jsonPath = path.join(CONFIG.outputDir, 'validation_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  
  // HTML 보고서 생성
  const htmlPath = generateHTMLReport(results, summary);
  
  console.log('\n==============================================');
  console.log('✅ 검증 완료!');
  console.log('==============================================');
  console.log(`📊 총 케이스: ${summary.totalCases}개`);
  console.log(`📄 총 페이지: ${summary.totalPages}p`);
  console.log(`💰 총 비용: $${summary.totalCost.toFixed(2)}`);
  console.log(`📁 결과 저장: ${jsonPath}`);
  console.log(`📝 HTML 보고서: ${htmlPath}`);
}

main().catch(console.error);
