/**
 * Cycle 4 Top-Down Validator
 * 
 * 과추출 후 정제 방식 (Top-Down Approach)
 * - 모든 날짜를 극단적으로 추출
 * - 후처리로 노이즈 제거
 * - GT 100% 포함율 목표
 * 
 * 실행: node backend/eval/cycle4TopDownValidator.js
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
  
  // Cycle 4 전용 출력 경로
  outputDir: path.join(__dirname, 'output/cycle4_topdown'),
  cacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  reportsDir: path.join(__dirname, 'output/cycle4_topdown/reports'),
  tempDir: path.join(__dirname, 'output/cycle4_topdown/temp'),
  
  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 50페이지 이하 케이스 (Case18 제외 - GT 불일치)
  targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44],

  // 제외할 케이스 (PDF/GT 불일치)
  excludeCases: [18],
  
  // API 설정
  rateLimitDelay: 30000,
  maxRetries: 3,
  maxPagesPerCall: 10,
  batchDelay: 65000,
  
  // 비용 단가
  costPerPage: {
    'gpt-4o-mini': 0.0054,
    'gpt-4o': 0.0083
  },
  
  // 사용 모델
  model: 'gpt-4o-mini'
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

// 케이스 세트 로드
function loadCaseSets() {
  if (fs.existsSync(CONFIG.caseSetsPath)) {
    return JSON.parse(fs.readFileSync(CONFIG.caseSetsPath, 'utf-8'));
  }
  return null;
}

// 케이스 정보 가져오기
function getCaseInfo(caseSets, caseNum) {
  if (caseSets.details && caseSets.details[caseNum]) {
    const detail = caseSets.details[caseNum];
    return {
      caseId: `Case${caseNum}`,
      patientName: detail.patientName,
      pdfFolder: detail.files && detail.files.pdfFolder ? detail.files.pdfFolder : null,
      hasPdf: detail.hasPdf
    };
  }
  return null;
}

// PDF를 이미지로 변환
async function pdfToImages(pdfFolder) {
  const allImages = [];
  const pageSourceMap = [];
  
  const pdfFiles = fs.readdirSync(pdfFolder)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();
  
  console.log(`  PDF files: ${pdfFiles.length}`);
  
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(pdfFolder, pdfFile);
    const pdftoppm = path.join(CONFIG.popplerPath, 'pdftoppm.exe');
    const tempDir = path.join(CONFIG.tempDir, `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    const outputPrefix = path.join(tempDir, 'page');
    
    try {
      const cmd = `"${pdftoppm}" -jpeg -r 150 "${pdfPath}" "${outputPrefix}"`;
      execSync(cmd, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });
      
      const imageFiles = fs.readdirSync(tempDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();
      
      let pageInFile = 0;
      for (const file of imageFiles) {
        pageInFile++;
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
        
        allImages.push({
          filename: file,
          base64: `data:image/jpeg;base64,${buffer.toString('base64')}`
        });
        
        pageSourceMap.push({
          globalPageNum: allImages.length,
          sourceFile: pdfFile,
          pageInFile: pageInFile
        });
      }
      
      imageFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
      fs.rmdirSync(tempDir);
      
      console.log(`    ${pdfFile}: ${pageInFile}p`);
      
    } catch (error) {
      console.error(`    ${pdfFile} failed: ${error.message}`);
    }
  }
  
  return { allImages, pageSourceMap };
}

// TOP-DOWN 극단적 과추출 프롬프트
const TOPDOWN_SYSTEM_PROMPT = `당신은 보험 손해사정 문서에서 날짜를 추출하는 전문가입니다.
응답은 반드시 유효한 JSON 형식으로 출력해야 합니다.

## 절대 원칙: 의심스러우면 무조건 추출하세요!

**누락은 치명적입니다. 과추출은 괜찮습니다.**

### 반드시 추출해야 할 날짜 (예외 없음!)

1. **테이블/표의 모든 날짜**
   - "일자 | 사고경위 | 병원/기관" 형식의 첫 열
   - "일자 | 확인내용 | 관련기관" 형식의 첫 열
   - 표 형태로 정렬된 모든 날짜 열

2. **기간 표현의 시작일과 종료일 모두**
   - "2020.10.15 ~ 2025.10.15" → 두 날짜 모두
   - "입원기간 : 2025.07.07 ~ 2025.07.14" → 두 날짜 모두
   - "통원기간 : 2024.04.12 ~ 2024.11.04" → 두 날짜 모두
   - "심평원 진료내역(2020.01.17 ~ 2024.01.24)" → 두 날짜 모두

3. **보험사 언급 주변 100자 내 모든 날짜**
   - NH, KB, 삼성, 현대, AXA, DB손해보험, 농협손해보험
   - 보험 가입일, 보장개시일, 만기일, 갱신일

4. **미래 날짜도 포함**
   - 2030년, 2040년, 2050년 등 보험 만기일
   - 예약일, 추적관찰 예정일

5. **과거 날짜도 모두 포함**
   - 2007년, 2012년 등 오래된 날짜
   - 기왕증, 과거력 관련 날짜

6. **다양한 형식의 날짜**
   - YYYY.MM.DD (2024.04.09)
   - YYYY-MM-DD (2024-04-09)
   - YYYY/MM/DD (2024/04/09)
   - YY.MM.DD (24.04.09)
   - YYYY년 MM월 DD일

7. **키워드 주변 날짜 (키워드 발견 시 주변 50자 내 날짜 모두)**
   - 심평원, 진료내역, 가입, 보장, 청구, 계약
   - 입원, 퇴원, 수술, 검사, 진단, 통원
   - 초진, 재진, 내원, 치료

### 출력 형식

**중요**: 날짜는 반드시 YYYY-MM-DD 형식으로만 출력하세요. hh:mm:ss 시간 정보는 포함하지 마세요.

{
  "allExtractedDates": [
    {
      "date": "YYYY-MM-DD",
      "originalFormat": "문서에서 발견된 원래 형식",
      "context": "날짜 앞뒤 30자 맥락",
      "type": "보험가입|보험만기|심평원조회기간|입원|퇴원|수술|검사|진단|통원|기타",
      "confidence": "high|medium|low",
      "importance": "critical|high|medium|low"
    }
  ],
  "dateRanges": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "context": "기간 맥락",
      "type": "입원기간|통원기간|보장기간|조회기간|기타",
      "importance": "critical|high|medium|low"
    }
  ],
  "insuranceDates": [
    {
      "date": "YYYY-MM-DD",
      "company": "보험사명",
      "type": "가입일|보장개시일|만기일|갱신일",
      "productName": "상품명 (있는 경우)",
      "importance": "critical (가입일/보장개시일) | low (만기일)"
    }
  ],
  "tableDates": [
    {
      "date": "YYYY-MM-DD",
      "rowContent": "해당 행 전체 내용",
      "tableType": "사고경위표|확인내용표|진료내역표|기타",
      "importance": "high (의료 이벤트) | medium (기타)"
    }
  ]
}

### 중요도 기준 (importance)

**critical (매우 중요)**:
- 보험 가입일 (보장개시일)
- 주요 의료 사건 발생일 (수술일, 진단일)

**high (중요)**:
- 입원일, 퇴원일
- 검사일, 치료일
- 통원 시작일

**medium (보통)**:
- 문서 작성일
- 기타 날짜

**low (낮음)**:
- 보험 만기일 (보험 심사에 무관)
- 조회기간 종료일

**중요**: 보험기간의 경우, 시작일(보장개시일)은 importance="critical", 종료일(만기일)은 importance="low"로 태깅하세요.

### 타임스탬프 제외

날짜는 반드시 YYYY-MM-DD 형식으로만 출력하세요.
hh:mm:ss 시간 정보는 보험 심사에 불필요하므로 포함하지 마세요.

### 최종 점검

추출 완료 후 다음을 확인하세요:
- [ ] 테이블의 모든 날짜를 추출했는가?
- [ ] 기간 표현의 시작일과 종료일 모두 추출했는가?
- [ ] 보험사 언급 주변의 날짜를 모두 추출했는가?
- [ ] 미래 날짜(만기일 등)를 포함했는가? (importance="low"로 태깅)
- [ ] 과거 날짜(과거력 등)를 포함했는가?
- [ ] 모든 날짜에 importance를 태깅했는가?
- [ ] hh:mm:ss 시간 정보는 제외했는가?

**누락보다 과추출이 낫습니다!**`;

// Vision LLM 호출
async function callVisionLLM(images, modelName, caseInfo) {
  const client = getOpenAI();
  
  const imageContents = images.map(img => ({
    type: 'image_url',
    image_url: { url: img.base64, detail: 'high' }
  }));
  
  const userPrompt = `위 ${images.length}개 페이지에서 모든 날짜를 빠짐없이 추출하여 JSON 형식으로 출력하세요.
환자명: ${caseInfo.patientName || '문서에서 확인'}
케이스: ${caseInfo.caseId}

특히 주의:
1. 테이블/표의 날짜 열 전체
2. "YYYY.MM.DD ~ YYYY.MM.DD" 기간의 시작일/종료일 모두
3. 보험사(NH, KB, 삼성, AXA, DB) 관련 날짜
4. 심평원 진료내역 조회기간의 시작일/종료일

의심스러우면 무조건 추출하세요! 결과는 반드시 JSON 형식으로 출력하세요.`;

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: TOPDOWN_SYSTEM_PROMPT },
      { role: 'user', content: [...imageContents, { type: 'text', text: userPrompt }] }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 16000, // 더 많은 날짜 추출을 위해 증가
    temperature: 0.1
  });
  
  return {
    content: response.choices[0].message.content,
    usage: response.usage
  };
}

// 지연 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// Ground Truth에서 날짜 추출
function extractGroundTruthDates(groundTruth) {
  const dates = new Set();
  
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
      
      if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

// 날짜 정규화: 타임스탬프 제거 (YYYY-MM-DDThh:mm:ss → YYYY-MM-DD)
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DDThh:mm:ss 형식인 경우 T 이후 제거
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }

  // 이미 YYYY-MM-DD 형식인 경우 그대로 반환
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  return dateStr;
}

// AI 추출 결과에서 모든 날짜 수집 (Top-Down 형식)
function collectAIDates(generatedJson) {
  const dates = new Set();
  
  // allExtractedDates
  if (generatedJson.allExtractedDates) {
    generatedJson.allExtractedDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }
  
  // dateRanges (시작일, 종료일 모두)
  if (generatedJson.dateRanges) {
    generatedJson.dateRanges.forEach(item => {
      const startNormalized = normalizeDate(item.startDate);
      const endNormalized = normalizeDate(item.endDate);

      if (startNormalized && startNormalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(startNormalized);
      }
      if (endNormalized && endNormalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(endNormalized);
      }
    });
  }

  // insuranceDates
  if (generatedJson.insuranceDates) {
    generatedJson.insuranceDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  // tableDates
  if (generatedJson.tableDates) {
    generatedJson.tableDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }
  
  // 기존 형식 호환
  if (generatedJson.allDates) {
    generatedJson.allDates.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  if (generatedJson.medicalEvents) {
    generatedJson.medicalEvents.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }

  if (generatedJson.diagnoses) {
    generatedJson.diagnoses.forEach(item => {
      const normalized = normalizeDate(item.date);
      if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(normalized);
      }
    });
  }
  
  return Array.from(dates).sort();
}

// 매칭 분석
function analyzeMatching(aiDates, gtDates) {
  const matched = gtDates.filter(d => aiDates.includes(d));
  const missed = gtDates.filter(d => !aiDates.includes(d));
  const extra = aiDates.filter(d => !gtDates.includes(d));
  
  const gtCoverageRate = gtDates.length > 0 
    ? Math.round((matched.length / gtDates.length) * 100) 
    : 100;
  
  return {
    gtDates,
    aiDates,
    matched,
    missed,
    extra,
    gtCoverageRate,
    gtCount: gtDates.length,
    aiCount: aiDates.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length
  };
}

// 케이스 처리
async function processCase(caseNum, caseInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] ${caseInfo.patientName} - Top-Down Processing`);
  console.log(`${'='.repeat(60)}`);

  // 캐시 먼저 확인 (PDF 경로 문제 우회)
  const cachePath = path.join(CONFIG.cacheDir, `case_${caseNum}_topdown.json`);
  if (fs.existsSync(cachePath)) {
    console.log(`  * Using cache: ${cachePath}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  const pdfFolder = caseInfo.pdfFolder;
  if (!pdfFolder || !fs.existsSync(pdfFolder)) {
    console.log(`  X PDF folder not found: ${pdfFolder}`);
    return { caseId: `Case${caseNum}`, error: 'PDF folder not found' };
  }
  
  // PDF 변환
  console.log(`  Converting PDFs...`);
  const { allImages, pageSourceMap } = await pdfToImages(pdfFolder);
  console.log(`  Total pages: ${allImages.length}`);
  
  // Vision LLM 호출 (배치 처리)
  console.log(`  Calling Vision LLM (${CONFIG.model}) - Top-Down mode...`);
  const startTime = Date.now();
  
  let allExtractedDates = [];
  let allDateRanges = [];
  let allInsuranceDates = [];
  let allTableDates = [];
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  
  try {
    const totalPages = allImages.length;
    const batchSize = CONFIG.maxPagesPerCall;
    const numBatches = Math.ceil(totalPages / batchSize);
    
    console.log(`  Processing ${numBatches} batches (${batchSize} pages each)`);
    
    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const startIdx = batchIdx * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalPages);
      const batchImages = allImages.slice(startIdx, endIdx);
      
      console.log(`    Batch ${batchIdx + 1}/${numBatches}: pages ${startIdx + 1}-${endIdx}`);
      
      const result = await callVisionLLM(batchImages, CONFIG.model, {
        caseId: `Case${caseNum}`,
        patientName: caseInfo.patientName
      });
      
      const batchJson = JSON.parse(result.content);
      
      // 결과 병합
      if (batchJson.allExtractedDates) {
        allExtractedDates = allExtractedDates.concat(batchJson.allExtractedDates);
      }
      if (batchJson.dateRanges) {
        allDateRanges = allDateRanges.concat(batchJson.dateRanges);
      }
      if (batchJson.insuranceDates) {
        allInsuranceDates = allInsuranceDates.concat(batchJson.insuranceDates);
      }
      if (batchJson.tableDates) {
        allTableDates = allTableDates.concat(batchJson.tableDates);
      }
      
      // 기존 형식 호환
      if (batchJson.allDates) {
        allExtractedDates = allExtractedDates.concat(batchJson.allDates.map(d => ({
          date: d.date,
          context: d.context,
          type: d.type || 'other',
          confidence: 'medium'
        })));
      }
      
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
        totalUsage.total_tokens += result.usage.total_tokens || 0;
      }
      
      // 배치 간 대기
      if (batchIdx < numBatches - 1) {
        console.log(`    Waiting ${CONFIG.batchDelay / 1000}s for rate limit...`);
        await delay(CONFIG.batchDelay);
      }
    }
    
  } catch (error) {
    console.log(`  X Vision LLM failed: ${error.message}`);
    return { caseId: `Case${caseNum}`, error: error.message };
  }
  
  // 최종 결과 조합
  const generatedJson = {
    allExtractedDates,
    dateRanges: allDateRanges,
    insuranceDates: allInsuranceDates,
    tableDates: allTableDates
  };
  
  const processingTime = Date.now() - startTime;
  const cost = allImages.length * CONFIG.costPerPage[CONFIG.model];
  
  console.log(`  Processing time: ${(processingTime / 1000).toFixed(1)}s`);
  console.log(`  Estimated cost: $${cost.toFixed(4)}`);
  
  // Ground Truth 비교
  const groundTruth = loadGroundTruth(caseNum);
  const gtDates = groundTruth ? extractGroundTruthDates(groundTruth) : [];
  const aiDates = collectAIDates(generatedJson);
  const matching = analyzeMatching(aiDates, gtDates);
  
  console.log(`  GT Coverage: ${matching.gtCoverageRate}% (${matching.matchedCount}/${matching.gtCount})`);
  console.log(`  AI Extracted: ${matching.aiCount} dates`);
  console.log(`  Extra (noise): ${matching.extraCount} dates`);
  if (matching.missed.length > 0) {
    console.log(`  Missed: ${matching.missed.slice(0, 5).join(', ')}${matching.missed.length > 5 ? '...' : ''}`);
  } else {
    console.log(`  Missed: NONE - 100% GT Coverage!`);
  }
  
  // 결과 저장
  const result = {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: caseInfo.patientName,
    totalPages: allImages.length,
    processedPages: allImages.length,
    model: CONFIG.model,
    approach: 'top-down',
    processedAt: new Date().toISOString(),
    processingTime,
    cost,
    usage: totalUsage,
    generatedJson,
    matching,
    pageSourceMap
  };
  
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  Cached: ${cachePath}`);
  
  return result;
}

// HTML 보고서 생성
function generateReport(summary, results, cycle2Summary) {
  const validResults = results.filter(r => r.matching);
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS Cycle 4 Top-Down Validation Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f7fa; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    h2 { color: #2d3748; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    
    .approach-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; }
    .approach-box h3 { margin-bottom: 0.5rem; }
    
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0; }
    .comparison-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .comparison-card h4 { color: #475569; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .comparison-card.winner { border: 3px solid #10b981; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; font-size: 0.85rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }
    .card.danger .value { color: #ef4444; }
    
    table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 1rem 0; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }
    
    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    
    .improvement { font-size: 1.5rem; font-weight: bold; }
    .improvement.positive { color: #10b981; }
    .improvement.negative { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cycle 4: Top-Down Validation Report</h1>
    <p class="subtitle">Over-extraction then refinement approach | ${new Date().toLocaleString('ko-KR')}</p>
    
    <div class="approach-box">
      <h3>Top-Down Approach (Over-extraction)</h3>
      <p><strong>Strategy:</strong> Extract ALL possible dates aggressively, then filter noise in post-processing.</p>
      <p><strong>Goal:</strong> Achieve 100% GT coverage by minimizing false negatives (missed dates).</p>
    </div>
    
    <h2>Cycle 2 vs Cycle 4 Comparison</h2>
    <div class="comparison">
      <div class="comparison-card ${cycle2Summary.overallGtCoverageRate < summary.overallGtCoverageRate ? '' : 'winner'}">
        <h4>Cycle 2 (Bottom-Up)</h4>
        <p><strong>GT Coverage:</strong> ${cycle2Summary.overallGtCoverageRate}%</p>
        <p><strong>Matched:</strong> ${cycle2Summary.totalMatched}/${cycle2Summary.totalGtDates}</p>
        <p><strong>Missed:</strong> ${cycle2Summary.totalMissed}</p>
        <p><strong>AI Extracted:</strong> ${cycle2Summary.totalAiDates}</p>
        <p><strong>Cost:</strong> $${cycle2Summary.totalCost?.toFixed(2) || 'N/A'}</p>
      </div>
      <div class="comparison-card ${cycle2Summary.overallGtCoverageRate < summary.overallGtCoverageRate ? 'winner' : ''}">
        <h4>Cycle 4 (Top-Down)</h4>
        <p><strong>GT Coverage:</strong> ${summary.overallGtCoverageRate}%</p>
        <p><strong>Matched:</strong> ${summary.totalMatched}/${summary.totalGtDates}</p>
        <p><strong>Missed:</strong> ${summary.totalMissed}</p>
        <p><strong>AI Extracted:</strong> ${summary.totalAiDates}</p>
        <p><strong>Cost:</strong> $${summary.totalCost?.toFixed(2) || 'N/A'}</p>
      </div>
    </div>
    
    <div style="text-align:center; padding: 2rem; background: white; border-radius: 12px; margin: 2rem 0;">
      <p style="color:#64748b;">GT Coverage Improvement</p>
      <p class="improvement ${summary.overallGtCoverageRate > cycle2Summary.overallGtCoverageRate ? 'positive' : 'negative'}">
        ${summary.overallGtCoverageRate > cycle2Summary.overallGtCoverageRate ? '+' : ''}${summary.overallGtCoverageRate - cycle2Summary.overallGtCoverageRate}%p
      </p>
      <p style="color:#64748b;margin-top:0.5rem;">${cycle2Summary.overallGtCoverageRate}% → ${summary.overallGtCoverageRate}%</p>
    </div>
    
    <h2>Cycle 4 Summary</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 80 ? 'success' : summary.overallGtCoverageRate >= 50 ? 'warning' : 'danger'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">GT Coverage</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">Matched/GT</div>
      </div>
      <div class="card ${summary.totalMissed === 0 ? 'success' : summary.totalMissed < 10 ? 'warning' : 'danger'}">
        <div class="value">${summary.totalMissed}</div>
        <div class="label">Missed</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI Extracted</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalExtra}</div>
        <div class="label">Extra (Noise)</div>
      </div>
    </div>
    
    <h2>Case-by-Case Results</h2>
    <table>
      <thead>
        <tr>
          <th>Case</th>
          <th>Patient</th>
          <th>Pages</th>
          <th>GT Coverage</th>
          <th>GT/Match/Miss</th>
          <th>AI Extracted</th>
          <th>Extra (Noise)</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.map(r => `
        <tr>
          <td><strong>${r.caseId}</strong></td>
          <td>${r.patientName || '-'}</td>
          <td>${r.totalPages}p</td>
          <td>
            <span class="badge ${r.matching.gtCoverageRate >= 80 ? 'badge-success' : r.matching.gtCoverageRate >= 50 ? 'badge-warning' : 'badge-danger'}">
              ${r.matching.gtCoverageRate}%
            </span>
          </td>
          <td>${r.matching.gtCount} / ${r.matching.matchedCount} / ${r.matching.missedCount}</td>
          <td>${r.matching.aiCount}</td>
          <td>${r.matching.extraCount}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>Analysis</h2>
    <div style="background:white; padding:1.5rem; border-radius:12px; margin:1rem 0;">
      <h4 style="color:#1e40af; margin-bottom:1rem;">Key Findings</h4>
      <ul style="margin-left:1.5rem;">
        <li><strong>Over-extraction Effect:</strong> AI extracted ${summary.totalAiDates} dates (${Math.round(summary.totalAiDates / summary.totalGtDates * 100)}% of GT count)</li>
        <li><strong>Noise Level:</strong> ${summary.totalExtra} extra dates (${Math.round(summary.totalExtra / summary.totalAiDates * 100)}% noise ratio)</li>
        <li><strong>Coverage vs Precision Trade-off:</strong> ${summary.overallGtCoverageRate}% coverage with ${Math.round(summary.totalMatched / summary.totalAiDates * 100)}% precision</li>
      </ul>
    </div>
    
    <p style="text-align:center;color:#64748b;margin-top:2rem;">
      VNEXSUS AI Claims System | Cycle 4 Top-Down | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, 'cycle4_topdown_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`\nHTML Report: ${reportPath}`);
}

// 메인 실행
async function main() {
  console.log('='.repeat(70));
  console.log('CYCLE 4: TOP-DOWN VALIDATION');
  console.log('Over-extraction then refinement approach');
  console.log('='.repeat(70));
  console.log(`Target cases: ${CONFIG.targetCases.join(', ')}`);
  console.log(`Model: ${CONFIG.model}`);
  console.log(`Cache: ${CONFIG.cacheDir}`);
  console.log('');
  
  initDirectories();
  
  const caseSets = loadCaseSets();
  if (!caseSets) {
    console.log('X Failed to load case_sets_v2.json');
    return;
  }
  
  // Cycle 2 결과 로드 (비교용)
  let cycle2Summary = { overallGtCoverageRate: 50, totalMatched: 39, totalGtDates: 78, totalMissed: 39, totalAiDates: 263, totalCost: 2.35 };
  const cycle2Path = path.join(__dirname, 'output/improved_validation_cycle2/improved_validation_results.json');
  if (fs.existsSync(cycle2Path)) {
    const cycle2Data = JSON.parse(fs.readFileSync(cycle2Path, 'utf-8'));
    cycle2Summary = cycle2Data.summary;
  }
  
  const results = [];
  let totalCost = 0;
  
  for (let i = 0; i < CONFIG.targetCases.length; i++) {
    const caseNum = CONFIG.targetCases[i];
    
    const caseInfo = getCaseInfo(caseSets, caseNum);
    if (!caseInfo || !caseInfo.hasPdf) {
      console.log(`\nSkipping Case${caseNum}: No PDF`);
      continue;
    }
    
    try {
      const result = await processCase(caseNum, caseInfo);
      results.push(result);
      
      if (result.cost) {
        totalCost += result.cost;
      }
      
      // Rate limit
      if (i < CONFIG.targetCases.length - 1 && !result.error) {
        console.log(`\nWaiting ${CONFIG.rateLimitDelay / 1000}s for rate limit...`);
        await delay(CONFIG.rateLimitDelay);
      }
      
    } catch (error) {
      console.log(`\nCase${caseNum} failed: ${error.message}`);
      results.push({ caseId: `Case${caseNum}`, error: error.message });
    }
  }
  
  // Summary
  const validResults = results.filter(r => r.matching);
  
  const summary = {
    totalCases: results.length,
    validCases: validResults.length,
    totalCost,
    approach: 'top-down',
    
    avgGtCoverageRate: validResults.length > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.matching.gtCoverageRate, 0) / validResults.length)
      : 0,
    
    totalGtDates: validResults.reduce((sum, r) => sum + r.matching.gtCount, 0),
    totalMatched: validResults.reduce((sum, r) => sum + r.matching.matchedCount, 0),
    totalMissed: validResults.reduce((sum, r) => sum + r.matching.missedCount, 0),
    totalAiDates: validResults.reduce((sum, r) => sum + r.matching.aiCount, 0),
    totalExtra: validResults.reduce((sum, r) => sum + r.matching.extraCount, 0),
    
    overallGtCoverageRate: 0
  };
  
  summary.overallGtCoverageRate = summary.totalGtDates > 0
    ? Math.round((summary.totalMatched / summary.totalGtDates) * 100)
    : 0;
  
  // Save results
  const outputPath = path.join(CONFIG.outputDir, 'cycle4_topdown_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results, cycle2Summary }, null, 2), 'utf-8');
  
  // Generate report
  generateReport(summary, results, cycle2Summary);
  
  // Console output
  console.log('\n' + '='.repeat(70));
  console.log('CYCLE 4 TOP-DOWN VALIDATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total cases: ${summary.totalCases}`);
  console.log(`Valid cases: ${summary.validCases}`);
  console.log(`Total cost: $${totalCost.toFixed(2)}`);
  console.log('');
  console.log('=== COMPARISON: Cycle 2 vs Cycle 4 ===');
  console.log(`GT Coverage: ${cycle2Summary.overallGtCoverageRate}% -> ${summary.overallGtCoverageRate}% (${summary.overallGtCoverageRate > cycle2Summary.overallGtCoverageRate ? '+' : ''}${summary.overallGtCoverageRate - cycle2Summary.overallGtCoverageRate}%p)`);
  console.log(`Matched: ${cycle2Summary.totalMatched}/${cycle2Summary.totalGtDates} -> ${summary.totalMatched}/${summary.totalGtDates}`);
  console.log(`Missed: ${cycle2Summary.totalMissed} -> ${summary.totalMissed}`);
  console.log(`AI Extracted: ${cycle2Summary.totalAiDates} -> ${summary.totalAiDates}`);
  console.log(`Extra (Noise): N/A -> ${summary.totalExtra}`);
  console.log('');
  console.log(`Results saved: ${outputPath}`);
}

main().catch(console.error);
