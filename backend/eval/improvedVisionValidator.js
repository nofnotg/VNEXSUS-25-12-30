/**
 * Improved Vision LLM Validator (Cycle 2)
 * 
 * 개선된 프롬프트로 Vision LLM 재처리
 * - 보험 관련 날짜 (가입일, 갱신일, 만기일, 청약일) 포함
 * - 과거 5년 이상 날짜도 모두 추출
 * - 광범위한 키워드 확장
 * - 결과는 별도 폴더에 저장 (기존 데이터 보존)
 * 
 * 실행: node backend/eval/improvedVisionValidator.js
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
  
  // Cycle 2 전용 출력 경로 (기존 데이터와 분리)
  outputDir: path.join(__dirname, 'output/improved_validation_cycle2'),
  cacheDir: path.join(__dirname, 'output/improved_validation_cycle2/ocr_cache'),
  reportsDir: path.join(__dirname, 'output/improved_validation_cycle2/reports'),
  tempDir: path.join(__dirname, 'output/improved_validation_cycle2/temp'),
  
  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  pdfBaseDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf',
  
  // 50페이지 이하 케이스만 처리 (비용 효율)
  targetCases: [2, 5, 13, 15, 17, 18, 29, 30, 41, 42, 44],
  
  // API 설정
  rateLimitDelay: 30000, // 30초 딜레이 (Rate limit 대응)
  maxRetries: 3,
  maxPagesPerCall: 10, // API 호출당 최대 페이지 (TPM 제한 대응) - 축소
  batchDelay: 65000, // 배치 간 대기 시간 (65초 = 1분 이상)
  
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
    const data = JSON.parse(fs.readFileSync(CONFIG.caseSetsPath, 'utf-8'));
    // details 객체에서 케이스 정보 추출
    return data;
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

// PDF를 이미지로 변환 (페이지 소스 추적)
async function pdfToImages(pdfFolder) {
  const allImages = [];
  const pageSourceMap = []; // 각 이미지의 원본 PDF와 페이지 번호 추적
  
  const pdfFiles = fs.readdirSync(pdfFolder)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();
  
  console.log(`  PDF 파일 ${pdfFiles.length}개 발견`);
  
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
      
      // 정리
      imageFiles.forEach(f => fs.unlinkSync(path.join(tempDir, f)));
      fs.rmdirSync(tempDir);
      
      console.log(`    ${pdfFile}: ${pageInFile}p`);
      
    } catch (error) {
      console.error(`    ${pdfFile} 변환 실패: ${error.message}`);
    }
  }
  
  return { allImages, pageSourceMap };
}

// 개선된 시스템 프롬프트
const IMPROVED_SYSTEM_PROMPT = `당신은 보험 손해사정 문서 분석 전문가입니다.
제공된 의료 기록 및 보험 서류 이미지를 분석하여 **모든 날짜와 관련 정보**를 빠짐없이 추출하세요.

## 핵심 지침: 날짜 추출

**반드시 추출해야 할 날짜 유형:**
1. **보험 관련 날짜** (매우 중요!)
   - 보험 가입일, 청약일, 계약일
   - 보장개시일, 보험효력발생일
   - 보험 갱신일, 만기일
   - 보험료 납입일
   - 보험 관련 모든 날짜 (NH, KB, 삼성, 현대 등 보험사 관련)

2. **진료/의료 관련 날짜**
   - 초진일, 재진일, 내원일
   - 입원일, 퇴원일
   - 수술일, 시술일
   - 검사일, 검사보고일, 판독일
   - 진단일, 확진일
   - 통원일, 외래진료일
   - 처방일, 투약일

3. **과거력 날짜** (5년, 10년 이상 과거도 포함!)
   - 과거 진료 기록
   - 기왕증 관련 날짜
   - 가입전 치료 날짜
   - 이전 입원/수술 이력

4. **기타 날짜**
   - 사고일, 발병일
   - 청구일, 접수일
   - 서류 작성일, 발급일

## 출력 JSON 스키마:

{
  "allDates": [
    {
      "date": "YYYY-MM-DD",
      "context": "날짜가 나타난 전체 문맥 (앞뒤 20자 포함)",
      "type": "보험가입일|청약일|계약일|보장개시일|만기일|갱신일|초진일|재진일|입원일|퇴원일|수술일|검사일|검사보고일|진단일|통원일|처방일|사고일|발병일|기타",
      "source": "발견된 문서 유형 (의무기록/보험서류/검사결과지 등)"
    }
  ],
  "insuranceInfo": {
    "policies": [
      {
        "company": "보험사명",
        "productName": "상품명",
        "contractDate": "계약일",
        "effectiveDate": "보장개시일",
        "expiryDate": "만기일"
      }
    ],
    "relatedDates": ["보험 관련 모든 날짜 목록"]
  },
  "medicalEvents": [
    {
      "date": "YYYY-MM-DD",
      "hospital": "병원명",
      "type": "입원|퇴원|수술|검사|진단|통원",
      "description": "내용",
      "diagnosis": "진단명 (있는 경우)"
    }
  ],
  "diagnoses": [
    {
      "code": "KCD 코드",
      "nameKr": "진단명",
      "date": "진단일",
      "hospital": "진단 병원"
    }
  ],
  "hospitals": ["발견된 모든 병원명"],
  "patientInfo": {
    "name": "환자명",
    "birthDate": "생년월일",
    "gender": "성별"
  },
  "rawTextSummary": "문서 내용 요약 (주요 날짜와 이벤트 중심)"
}

## 중요 규칙:
1. **모든 날짜를 빠짐없이 추출** - 같은 날짜가 여러 번 나와도 다른 맥락이면 모두 기록
2. **보험 관련 날짜 특별 주의** - NH, KB, 삼성, 현대해상 등 보험사 관련 날짜는 반드시 포함
3. **과거 날짜도 모두 포함** - 2010년, 2015년 등 오래된 날짜도 누락하지 않음
4. **날짜 형식 통일** - 모든 날짜는 YYYY-MM-DD 형식
5. **맥락 기록** - 각 날짜가 어떤 맥락에서 나왔는지 반드시 기록
6. **불확실한 정보는 null** - 추측하지 말고 문서에 있는 것만 추출`;

// Vision LLM 호출
async function callVisionLLM(images, modelName, caseInfo) {
  const client = getOpenAI();
  
  const imageContents = images.map(img => ({
    type: 'image_url',
    image_url: { url: img.base64, detail: 'high' }
  }));
  
  const userPrompt = `위 ${images.length}개 페이지의 의료/보험 문서를 분석하여 JSON 형식으로 출력하세요.
환자명: ${caseInfo.patientName || '문서에서 추출'}
케이스: ${caseInfo.caseId}

특히 다음에 주의하세요:
- 보험 가입일, 갱신일, 만기일, 청약일 등 보험 관련 날짜
- 과거 5년 이상 된 진료 날짜
- 입원기간 (시작일~종료일)
- 검사 보고일
- 모든 날짜를 빠짐없이 추출`;

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: IMPROVED_SYSTEM_PROMPT },
      { role: 'user', content: [...imageContents, { type: 'text', text: userPrompt }] }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8000, // 더 많은 날짜 추출을 위해 증가
    temperature: 0.1  // 더 정확한 추출을 위해 낮춤
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
      
      if (y >= 1990 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

// AI 추출 결과에서 모든 날짜 수집
function collectAIDates(generatedJson) {
  const dates = new Set();
  
  // allDates (새 형식)
  if (generatedJson.allDates) {
    generatedJson.allDates.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // insuranceInfo
  if (generatedJson.insuranceInfo) {
    if (generatedJson.insuranceInfo.relatedDates) {
      generatedJson.insuranceInfo.relatedDates.forEach(d => {
        if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates.add(d);
        }
      });
    }
    if (generatedJson.insuranceInfo.policies) {
      generatedJson.insuranceInfo.policies.forEach(p => {
        ['contractDate', 'effectiveDate', 'expiryDate'].forEach(key => {
          if (p[key] && p[key].match(/^\d{4}-\d{2}-\d{2}$/)) {
            dates.add(p[key]);
          }
        });
      });
    }
  }
  
  // medicalEvents
  if (generatedJson.medicalEvents) {
    generatedJson.medicalEvents.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // diagnoses
  if (generatedJson.diagnoses) {
    generatedJson.diagnoses.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  // 기존 형식 호환
  if (generatedJson.extractedDates) {
    generatedJson.extractedDates.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  if (generatedJson.examinations) {
    generatedJson.examinations.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  if (generatedJson.treatments) {
    generatedJson.treatments.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  if (generatedJson.hospitalizations) {
    generatedJson.hospitalizations.forEach(item => {
      if (item.admissionDate && item.admissionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.admissionDate);
      }
      if (item.dischargeDate && item.dischargeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.dischargeDate);
      }
    });
  }
  
  if (generatedJson.surgeries) {
    generatedJson.surgeries.forEach(item => {
      if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.date);
      }
    });
  }
  
  if (generatedJson.visitDate && generatedJson.visitDate.date) {
    const d = generatedJson.visitDate.date;
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.add(d);
    }
  }
  
  if (generatedJson.patientInfo && generatedJson.patientInfo.birthDate) {
    const d = generatedJson.patientInfo.birthDate;
    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.add(d);
    }
  }
  
  return Array.from(dates).sort();
}

// 매칭 분석
function analyzeMatching(aiDates, gtDates) {
  const matched = gtDates.filter(d => aiDates.includes(d));
  const missed = gtDates.filter(d => !aiDates.includes(d));
  const extra = aiDates.filter(d => !gtDates.includes(d));
  
  // GT 포함율 (핵심 지표)
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
  console.log(`📋 Case${caseNum} 처리 시작: ${caseInfo.patientName}`);
  console.log(`${'='.repeat(60)}`);
  
  // PDF 폴더 찾기 (절대 경로 사용)
  const pdfFolder = caseInfo.pdfFolder;
  if (!pdfFolder || !fs.existsSync(pdfFolder)) {
    console.log(`  ❌ PDF 폴더 없음: ${pdfFolder}`);
    return { caseId: `Case${caseNum}`, error: 'PDF 폴더 없음' };
  }
  
  // 캐시 확인
  const cachePath = path.join(CONFIG.cacheDir, `case_${caseNum}_improved.json`);
  if (fs.existsSync(cachePath)) {
    console.log(`  ⚡ 캐시 사용: ${cachePath}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }
  
  // PDF → 이미지 변환
  console.log(`  📄 PDF 변환 중...`);
  const { allImages, pageSourceMap } = await pdfToImages(pdfFolder);
  console.log(`  ✅ 총 ${allImages.length}페이지`);
  
  // Vision LLM 호출 (배치 처리)
  console.log(`  🤖 Vision LLM 호출 중 (${CONFIG.model})...`);
  const startTime = Date.now();
  
  let allDates = [];
  let allMedicalEvents = [];
  let allDiagnoses = [];
  let allHospitals = new Set();
  let patientInfo = null;
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  
  try {
    // 배치로 나눠서 처리
    const totalPages = allImages.length;
    const batchSize = CONFIG.maxPagesPerCall;
    const numBatches = Math.ceil(totalPages / batchSize);
    
    console.log(`  📦 ${numBatches}개 배치로 분할 처리 (각 ${batchSize}페이지)`);
    
    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const startIdx = batchIdx * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalPages);
      const batchImages = allImages.slice(startIdx, endIdx);
      
      console.log(`    배치 ${batchIdx + 1}/${numBatches}: 페이지 ${startIdx + 1}-${endIdx}`);
      
      const result = await callVisionLLM(batchImages, CONFIG.model, {
        caseId: `Case${caseNum}`,
        patientName: caseInfo.patientName
      });
      
      const batchJson = JSON.parse(result.content);
      
      // 결과 병합
      if (batchJson.allDates) {
        allDates = allDates.concat(batchJson.allDates);
      }
      if (batchJson.medicalEvents) {
        allMedicalEvents = allMedicalEvents.concat(batchJson.medicalEvents);
      }
      if (batchJson.diagnoses) {
        allDiagnoses = allDiagnoses.concat(batchJson.diagnoses);
      }
      if (batchJson.hospitals) {
        batchJson.hospitals.forEach(h => allHospitals.add(h));
      }
      if (batchJson.patientInfo && !patientInfo) {
        patientInfo = batchJson.patientInfo;
      }
      
      // 기존 형식 호환
      if (batchJson.extractedDates) {
        allDates = allDates.concat(batchJson.extractedDates.map(d => ({
          date: d.date,
          context: d.context,
          type: d.type || '기타',
          source: '의무기록'
        })));
      }
      if (batchJson.extractedHospitals) {
        batchJson.extractedHospitals.forEach(h => allHospitals.add(h));
      }
      
      // 사용량 합산
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
        totalUsage.total_tokens += result.usage.total_tokens || 0;
      }
      
      // 배치 간 대기 (마지막 배치 제외)
      if (batchIdx < numBatches - 1) {
        console.log(`    ⏳ ${CONFIG.batchDelay / 1000}초 대기 (TPM 제한)...`);
        await delay(CONFIG.batchDelay);
      }
    }
    
  } catch (error) {
    console.log(`  ❌ Vision LLM 실패: ${error.message}`);
    return { caseId: `Case${caseNum}`, error: error.message };
  }
  
  // 최종 결과 조합
  const generatedJson = {
    allDates,
    medicalEvents: allMedicalEvents,
    diagnoses: allDiagnoses,
    hospitals: Array.from(allHospitals),
    patientInfo,
    insuranceInfo: { policies: [], relatedDates: [] }
  };
  
  const usage = totalUsage;
  
  const processingTime = Date.now() - startTime;
  const cost = allImages.length * CONFIG.costPerPage[CONFIG.model];
  
  console.log(`  ⏱️ 처리 시간: ${(processingTime / 1000).toFixed(1)}초`);
  console.log(`  💰 예상 비용: $${cost.toFixed(4)}`);
  
  // Ground Truth 비교
  const groundTruth = loadGroundTruth(caseNum);
  const gtDates = groundTruth ? extractGroundTruthDates(groundTruth) : [];
  const aiDates = collectAIDates(generatedJson);
  const matching = analyzeMatching(aiDates, gtDates);
  
  console.log(`  📊 GT 포함율: ${matching.gtCoverageRate}% (${matching.matchedCount}/${matching.gtCount})`);
  if (matching.missed.length > 0) {
    console.log(`  ❌ 놓친 날짜: ${matching.missed.slice(0, 5).join(', ')}${matching.missed.length > 5 ? '...' : ''}`);
  }
  
  // 결과 저장
  const result = {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: caseInfo.patientName,
    totalPages: allImages.length,
    processedPages: Math.min(allImages.length, CONFIG.maxPagesPerCall),
    model: CONFIG.model,
    processedAt: new Date().toISOString(),
    processingTime,
    cost,
    usage,
    generatedJson,
    matching,
    pageSourceMap: pageSourceMap.slice(0, CONFIG.maxPagesPerCall)
  };
  
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  💾 캐시 저장: ${cachePath}`);
  
  return result;
}

// 지연 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ground Truth 맥락 찾기
function findDateContext(date, groundTruth) {
  if (!groundTruth) return '';
  
  const patterns = [
    date.replace(/-/g, '.'),
    date.replace(/-0/g, '-').replace(/-/g, '.'),
    date
  ];
  
  for (const pattern of patterns) {
    const idx = groundTruth.indexOf(pattern);
    if (idx !== -1) {
      return groundTruth.substring(Math.max(0, idx - 40), Math.min(groundTruth.length, idx + 60))
        .replace(/\r?\n/g, ' ').trim();
    }
  }
  
  return '(맥락 없음)';
}

// HTML 보고서 생성
function generateReport(summary, results) {
  const validResults = results.filter(r => r.matching);
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>VNEXSUS Improved Validation Report (Cycle 2)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f5f7fa; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    h2 { color: #2d3748; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    
    .notice { background: #dcfce7; border-left: 4px solid #22c55e; padding: 1rem; margin-bottom: 2rem; border-radius: 0 8px 8px 0; }
    .notice strong { color: #166534; }
    .notice.warning { background: #fef3c7; border-color: #f59e0b; }
    .notice.warning strong { color: #92400e; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    .card .value { font-size: 2.5rem; font-weight: bold; color: #2563eb; }
    .card .label { color: #64748b; margin-top: 0.5rem; font-size: 0.9rem; }
    .card.success .value { color: #10b981; }
    .card.warning .value { color: #f59e0b; }
    .card.danger .value { color: #ef4444; }
    
    table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 1rem 0; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }
    
    .badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0; }
    .comparison-box { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .comparison-box h4 { color: #1e40af; margin-bottom: 1rem; }
    
    .missed { color: #dc2626; }
    .context { color: #64748b; font-size: 0.85rem; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 VNEXSUS 개선된 검증 보고서 (Cycle 2)</h1>
    <p class="subtitle">개선된 프롬프트 적용 | ${new Date().toLocaleString('ko-KR')}</p>
    
    <div class="notice">
      <strong>📌 개선 사항:</strong><br>
      - 보험 관련 날짜 (가입일, 갱신일, 만기일, 청약일) 명시적 추출<br>
      - 과거 5년 이상 날짜도 모두 포함<br>
      - 광범위한 키워드 확장 (초진일, 재진일, 검사보고일 등)
    </div>
    
    <h2>📊 핵심 지표</h2>
    <div class="summary-cards">
      <div class="card ${summary.overallGtCoverageRate >= 80 ? 'success' : summary.overallGtCoverageRate >= 50 ? 'warning' : 'danger'}">
        <div class="value">${summary.overallGtCoverageRate}%</div>
        <div class="label">전체 GT 포함율</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">매칭/GT 날짜</div>
      </div>
      <div class="card ${summary.totalMissed === 0 ? 'success' : summary.totalMissed < 20 ? 'warning' : 'danger'}">
        <div class="value">${summary.totalMissed}</div>
        <div class="label">놓친 날짜</div>
      </div>
      <div class="card">
        <div class="value">${summary.totalAiDates}</div>
        <div class="label">AI 추출 날짜</div>
      </div>
    </div>
    
    <div class="comparison">
      <div class="comparison-box">
        <h4>📈 이전 대비 개선</h4>
        <p>이전 GT 포함율: <strong>31%</strong></p>
        <p>현재 GT 포함율: <strong>${summary.overallGtCoverageRate}%</strong></p>
        <p>개선율: <strong style="color:${summary.overallGtCoverageRate > 31 ? '#10b981' : '#ef4444'}">${summary.overallGtCoverageRate > 31 ? '+' : ''}${summary.overallGtCoverageRate - 31}%p</strong></p>
      </div>
      <div class="comparison-box">
        <h4>💰 비용 정보</h4>
        <p>처리 케이스: ${summary.validCases}개</p>
        <p>총 비용: $${summary.totalCost.toFixed(2)}</p>
        <p>케이스당 평균: $${(summary.totalCost / summary.validCases).toFixed(2)}</p>
      </div>
    </div>
    
    <h2>📋 케이스별 상세</h2>
    <table>
      <thead>
        <tr>
          <th>케이스</th>
          <th>환자명</th>
          <th>페이지</th>
          <th>GT 포함율</th>
          <th>GT/매칭/놓침</th>
          <th>AI 추출</th>
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
          <td>${r.matching.aiCount}개</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <h2>🔍 놓친 날짜 상세</h2>
    <table>
      <thead>
        <tr>
          <th>케이스</th>
          <th>놓친 날짜</th>
          <th>Ground Truth 맥락</th>
        </tr>
      </thead>
      <tbody>
        ${validResults.flatMap(r => {
          const gt = loadGroundTruth(r.caseNum);
          return r.matching.missed.map(date => `
          <tr>
            <td>${r.caseId}</td>
            <td class="missed"><strong>${date}</strong></td>
            <td class="context">"${findDateContext(date, gt)}"</td>
          </tr>
          `);
        }).join('')}
        ${summary.totalMissed === 0 ? '<tr><td colspan="3" style="text-align:center;color:#10b981;font-weight:bold;">✅ 모든 GT 날짜가 포함되었습니다!</td></tr>' : ''}
      </tbody>
    </table>
    
    <p style="text-align:center;color:#64748b;margin-top:2rem;">
      VNEXSUS AI 손해사정 시스템 | Cycle 2 검증 | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, 'improved_validation_report.html');
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`📄 HTML 보고서: ${reportPath}`);
}

// 메인 실행
async function main() {
  console.log('🚀 개선된 Vision LLM 검증 시작 (Cycle 2)');
  console.log(`대상 케이스: ${CONFIG.targetCases.join(', ')}`);
  console.log(`모델: ${CONFIG.model}`);
  console.log(`캐시 경로: ${CONFIG.cacheDir}`);
  console.log('');
  
  initDirectories();
  
  // 케이스 세트 로드
  const caseSets = loadCaseSets();
  if (!caseSets) {
    console.log('❌ case_sets_v2.json 로드 실패');
    return;
  }
  
  const results = [];
  let totalCost = 0;
  
  for (let i = 0; i < CONFIG.targetCases.length; i++) {
    const caseNum = CONFIG.targetCases[i];
    
    // 케이스 정보 찾기
    const caseInfo = getCaseInfo(caseSets, caseNum);
    if (!caseInfo || !caseInfo.hasPdf) {
      console.log(`⚠️ Case${caseNum} 정보 없음 또는 PDF 없음, 스킵`);
      continue;
    }
    
    try {
      const result = await processCase(caseNum, caseInfo);
      results.push(result);
      
      if (result.cost) {
        totalCost += result.cost;
      }
      
      // Rate limit 대응
      if (i < CONFIG.targetCases.length - 1 && !result.error) {
        console.log(`  ⏳ ${CONFIG.rateLimitDelay / 1000}초 대기 (Rate limit 대응)...`);
        await delay(CONFIG.rateLimitDelay);
      }
      
    } catch (error) {
      console.log(`❌ Case${caseNum} 처리 실패: ${error.message}`);
      results.push({ caseId: `Case${caseNum}`, error: error.message });
    }
  }
  
  // 요약 생성
  const validResults = results.filter(r => r.matching);
  
  const summary = {
    totalCases: results.length,
    validCases: validResults.length,
    totalCost,
    
    avgGtCoverageRate: validResults.length > 0
      ? Math.round(validResults.reduce((sum, r) => sum + r.matching.gtCoverageRate, 0) / validResults.length)
      : 0,
    
    totalGtDates: validResults.reduce((sum, r) => sum + r.matching.gtCount, 0),
    totalMatched: validResults.reduce((sum, r) => sum + r.matching.matchedCount, 0),
    totalMissed: validResults.reduce((sum, r) => sum + r.matching.missedCount, 0),
    totalAiDates: validResults.reduce((sum, r) => sum + r.matching.aiCount, 0),
    
    overallGtCoverageRate: 0
  };
  
  summary.overallGtCoverageRate = summary.totalGtDates > 0
    ? Math.round((summary.totalMatched / summary.totalGtDates) * 100)
    : 0;
  
  // 결과 저장
  const outputPath = path.join(CONFIG.outputDir, 'improved_validation_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf-8');
  
  // HTML 보고서 생성
  generateReport(summary, results);
  
  // 콘솔 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 개선된 검증 완료 (Cycle 2)');
  console.log('='.repeat(60));
  console.log(`총 케이스: ${summary.totalCases}`);
  console.log(`유효 케이스: ${summary.validCases}`);
  console.log(`총 비용: $${totalCost.toFixed(2)}`);
  console.log(`\n📈 핵심 지표: Ground Truth 포함율`);
  console.log(`   이전: 31%`);
  console.log(`   현재: ${summary.overallGtCoverageRate}% (${summary.totalMatched}/${summary.totalGtDates})`);
  console.log(`   개선: ${summary.overallGtCoverageRate > 31 ? '+' : ''}${summary.overallGtCoverageRate - 31}%p`);
  console.log(`   놓친 날짜: ${summary.totalMissed}개`);
  console.log(`   AI 추출 날짜: ${summary.totalAiDates}개`);
  console.log(`\n📄 결과 저장: ${outputPath}`);
}

main().catch(console.error);
