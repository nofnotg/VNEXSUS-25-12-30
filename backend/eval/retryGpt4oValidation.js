/**
 * gpt-4o 실패 케이스 재시도 스크립트
 * 
 * Rate limit으로 실패한 6개 케이스를 순차적으로 재시도
 * - Case2, Case13, Case18, Case24, Case27, Case28
 * - 더 긴 딜레이 적용
 * - OCR 캐시 저장
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { execSync } from 'child_process';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  popplerPath: process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin',
  cacheDir: path.join(__dirname, 'output/full_pipeline_validation/ocr_cache'),
  tempDir: path.join(__dirname, 'output/full_pipeline_validation/temp'),
  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 실패한 케이스 목록
  failedCases: [2, 13, 18, 24, 27, 28],
  
  // Rate limit 대응 설정
  rateLimitDelay: 60000, // 60초 딜레이 (충분한 간격)
  maxRetries: 5,
  retryDelay: 30000, // 재시도 간격 30초
  maxPagesPerCall: 50,
  
  costPerPage: 0.0083
};

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000,
      maxRetries: 2
    });
  }
  return openai;
}

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
      
      try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.width > 2000 || metadata.height > 2000) {
          buffer = await sharp(buffer)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        }
      } catch (e) {}
      
      images.push({
        filename: file,
        base64: `data:image/jpeg;base64,${buffer.toString('base64')}`
      });
    }
    
    imageFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
    fs.rmdirSync(tempDir);
    
    return images;
  } catch (error) {
    console.error(`PDF 변환 실패: ${error.message}`);
    throw error;
  }
}

async function callVisionLLM(images, caseInfo) {
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
    model: 'gpt-4o',
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

function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

function analyzeMatching(generated, groundTruth) {
  const result = {
    dates: { matched: [], missed: [], extra: [], rate: 0 },
    kcdCodes: { matched: [], missed: [], extra: [], rate: 0 },
    hospitals: { matched: [], missed: [], extra: [], rate: 0 },
    examinations: { matched: [], missed: [], extra: [], rate: 0 },
    treatments: { matched: [], missed: [], extra: [], rate: 0 }
  };
  
  // 날짜 추출
  const dateRegex = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
  const gtDates = new Set((groundTruth.match(dateRegex) || []).map(d => d.replace(/[./]/g, '-')));
  const genDates = new Set();
  
  if (generated.extractedDates) {
    generated.extractedDates.forEach(d => { if (d.date) genDates.add(d.date); });
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
    if (genDates.has(d)) result.dates.matched.push(d);
    else result.dates.missed.push(d);
  });
  genDates.forEach(d => { if (!gtDates.has(d)) result.dates.extra.push(d); });
  result.dates.rate = gtDates.size > 0 ? Math.round(result.dates.matched.length / gtDates.size * 100) : 0;
  
  // KCD 코드
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
    if (genKcd.has(c)) result.kcdCodes.matched.push(c);
    else result.kcdCodes.missed.push(c);
  });
  genKcd.forEach(c => { if (!gtKcd.has(c)) result.kcdCodes.extra.push(c); });
  result.kcdCodes.rate = gtKcd.size > 0 ? Math.round(result.kcdCodes.matched.length / gtKcd.size * 100) : 0;
  
  // 병원명
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
  
  gtHospitals.forEach(h => {
    const found = [...genHospitals].some(gh => gh.includes(h) || h.includes(gh));
    if (found) result.hospitals.matched.push(h);
    else result.hospitals.missed.push(h);
  });
  result.hospitals.rate = gtHospitals.size > 0 ? Math.round(result.hospitals.matched.length / gtHospitals.size * 100) : 0;
  
  return result;
}

async function processCase(caseInfo) {
  const caseNum = caseInfo.caseNum;
  const cacheFile = path.join(CONFIG.cacheDir, `case_${caseNum}_4o.json`);
  
  const startTime = Date.now();
  const result = {
    caseId: caseInfo.caseId,
    caseNum,
    patientName: caseInfo.patientName,
    model: 'gpt-4o',
    totalPages: 0,
    processedPages: 0,
    processedAt: new Date().toISOString(),
    processingTime: 0,
    cost: 0,
    usage: null,
    generatedJson: null,
    groundTruth: null,
    matching: null,
    error: null
  };
  
  try {
    const pdfFolder = caseInfo.files.pdfFolder;
    const pdfFiles = caseInfo.pdfFiles.filter(f => 
      !f.includes('심평원') && !f.includes('문답서')
    );
    
    console.log(`  📁 PDF 파일: ${pdfFiles.length}개`);
    
    const allImages = [];
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(pdfFolder, pdfFile);
      console.log(`    - ${pdfFile} 변환 중...`);
      const images = await pdfToImages(pdfPath);
      allImages.push(...images);
      result.totalPages += images.length;
    }
    
    const pagesToProcess = allImages.slice(0, CONFIG.maxPagesPerCall);
    result.processedPages = pagesToProcess.length;
    
    if (result.totalPages > CONFIG.maxPagesPerCall) {
      console.log(`  ⚠️ 페이지 제한: ${result.totalPages}p → ${result.processedPages}p`);
    }
    
    console.log(`  📄 ${result.processedPages}페이지 → Vision LLM 호출 (gpt-4o)`);
    
    // Vision LLM 호출 (더 긴 재시도)
    let response = null;
    let retries = 0;
    
    while (retries < CONFIG.maxRetries) {
      try {
        response = await callVisionLLM(pagesToProcess, caseInfo);
        break;
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          retries++;
          const waitTime = CONFIG.retryDelay * retries;
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
    result.cost = result.processedPages * CONFIG.costPerPage;
    
    try {
      result.generatedJson = JSON.parse(response.content);
    } catch (e) {
      result.generatedJson = { rawContent: response.content, parseError: e.message };
    }
    
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
    // 오류 시에도 캐시 저장 안함 (재시도 가능하도록)
  }
  
  return result;
}

async function main() {
  console.log('==============================================');
  console.log('🔄 gpt-4o 실패 케이스 재시도');
  console.log('==============================================\n');
  
  // 케이스 정보 로드
  const caseSets = JSON.parse(fs.readFileSync(CONFIG.caseSetsPath, 'utf-8'));
  
  // 실패 케이스 캐시 삭제
  console.log('🗑️ 기존 실패 캐시 삭제 중...');
  for (const caseNum of CONFIG.failedCases) {
    const cacheFile = path.join(CONFIG.cacheDir, `case_${caseNum}_4o.json`);
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      console.log(`  - 삭제: case_${caseNum}_4o.json`);
    }
  }
  
  console.log(`\n📋 재시도 대상: ${CONFIG.failedCases.length}개 케이스`);
  console.log(`⏱️ 케이스 간 딜레이: ${CONFIG.rateLimitDelay/1000}초\n`);
  
  const results = [];
  
  for (let i = 0; i < CONFIG.failedCases.length; i++) {
    const caseNum = CONFIG.failedCases[i];
    const caseData = caseSets.sets.pdfMatchedSet.find(c => c.caseId === `Case${caseNum}`);
    
    if (!caseData) {
      console.log(`[${i + 1}/${CONFIG.failedCases.length}] Case${caseNum} - 케이스 데이터 없음`);
      continue;
    }
    
    const caseInfo = {
      ...caseData,
      ...caseSets.details[caseNum],
      caseNum
    };
    
    console.log(`[${i + 1}/${CONFIG.failedCases.length}] ${caseInfo.caseId} (${caseInfo.patientName})`);
    
    const result = await processCase(caseInfo);
    results.push(result);
    
    // 다음 케이스 전 충분한 딜레이
    if (i < CONFIG.failedCases.length - 1) {
      console.log(`\n⏳ ${CONFIG.rateLimitDelay/1000}초 대기 중...\n`);
      await new Promise(r => setTimeout(r, CONFIG.rateLimitDelay));
    }
  }
  
  // 결과 요약
  console.log('\n==============================================');
  console.log('✅ 재시도 완료!');
  console.log('==============================================');
  
  const success = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  
  console.log(`✓ 성공: ${success.length}개`);
  console.log(`✗ 실패: ${failed.length}개`);
  
  if (success.length > 0) {
    const totalCost = success.reduce((sum, r) => sum + r.cost, 0);
    console.log(`💰 총 비용: $${totalCost.toFixed(3)}`);
  }
  
  if (failed.length > 0) {
    console.log('\n❌ 실패한 케이스:');
    failed.forEach(r => console.log(`  - ${r.caseId}: ${r.error}`));
  }
}

main().catch(console.error);
