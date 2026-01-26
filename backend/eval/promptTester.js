/**
 * 프롬프트 테스터
 * 
 * 프롬프트 버전별 A/B 테스트 및 성능 비교
 * 
 * 실행: node backend/eval/promptTester.js [version] [caseNums]
 * 예시: node backend/eval/promptTester.js v1 2,5,13,15,17
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { execSync } from 'child_process';
import sharp from 'sharp';
import dotenv from 'dotenv';

import PROMPT_VERSIONS from './promptVersions.js';
import { validateReportSchema, applyDefaultValues, calculateVisitStatistics } from '../services/structuredReportSchema.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  popplerPath: process.env.POPPLER_PATH || 'C:\\poppler\\poppler-24.08.0\\Library\\bin',
  
  outputDir: path.join(__dirname, 'output/prompt_test'),
  cacheDir: path.join(__dirname, 'output/prompt_test/cache'),
  reportsDir: path.join(__dirname, 'output/prompt_test/reports'),
  tempDir: path.join(__dirname, 'output/prompt_test/temp'),
  
  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',
  
  // 테스트 케이스 (Case18 제외)
  testCases: [2, 5, 13, 15, 17],
  
  // API 설정
  rateLimitDelay: 30000,
  maxRetries: 3,
  batchDelay: 65000,
  
  model: 'gpt-4o-mini',
  
  costPerPage: 0.0054
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
function initDirectories(version) {
  const dirs = [
    CONFIG.outputDir,
    path.join(CONFIG.cacheDir, version),
    path.join(CONFIG.reportsDir, version),
    CONFIG.tempDir
  ];
  dirs.forEach(dir => {
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

// PDF → 이미지 변환
function convertPdfToImages(pdfPath, outputDir) {
  const images = [];
  const baseName = path.basename(pdfPath, '.pdf');
  
  try {
    execSync(
      `"${CONFIG.popplerPath}\\pdftoppm" -jpeg -r 150 "${pdfPath}" "${outputDir}\\${baseName}"`,
      { stdio: 'pipe' }
    );
    
    const files = fs.readdirSync(outputDir)
      .filter(f => f.startsWith(baseName) && f.endsWith('.jpg'))
      .sort();
    
    for (const file of files) {
      images.push(path.join(outputDir, file));
    }
  } catch (error) {
    console.error(`PDF 변환 오류: ${error.message}`);
  }
  
  return images;
}

// 이미지 최적화
async function optimizeImage(imagePath) {
  const buffer = await sharp(imagePath)
    .resize({ width: 1024, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buffer.toString('base64');
}

// GT 보고서 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// GT에서 날짜 추출
function extractDatesFromGT(gtText) {
  const dates = new Set();
  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(gtText)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      if (parseInt(year) >= 1990 && parseInt(year) <= 2030) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }
  
  return Array.from(dates).sort();
}

// 결과에서 날짜 추출
function extractDatesFromResult(result) {
  const dates = new Set();
  
  function extractFromValue(value) {
    if (!value) return;
    if (typeof value === 'string') {
      const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) dates.add(match[0]);
    } else if (Array.isArray(value)) {
      value.forEach(extractFromValue);
    } else if (typeof value === 'object') {
      Object.values(value).forEach(extractFromValue);
    }
  }
  
  extractFromValue(result);
  return Array.from(dates).sort();
}

// 10항목 완성도 계산
function calculate10ItemCompleteness(result) {
  const items = {
    visitDate: result.visitDate?.date && result.visitDate.date !== '정보 없음',
    chiefComplaint: result.chiefComplaint?.summary && result.chiefComplaint.summary !== '내원경위 정보 없음',
    diagnoses: result.diagnoses?.length > 0 && result.diagnoses[0]?.nameKr !== '진단명 정보 없음',
    examinations: result.examinations?.length > 0,
    pathology: result.pathology !== null,
    treatments: result.treatments?.length > 0 && result.treatments[0]?.name !== '치료내용 정보 없음',
    outpatientPeriod: result.outpatientPeriod?.startDate && result.outpatientPeriod.startDate !== '정보 없음',
    admissionPeriod: result.admissionPeriod?.startDate && result.admissionPeriod.startDate !== '',
    pastHistory: result.pastHistory?.length > 0 && result.pastHistory[0]?.condition !== '과거병력 정보 없음',
    doctorOpinion: result.doctorOpinion?.summary && result.doctorOpinion.summary !== '의사소견 정보 없음',
    disclosureViolation: result.disclosureViolation?.hasViolation !== undefined,
    conclusion: result.conclusion?.summary && result.conclusion.summary !== '추가 검토 필요'
  };
  
  const filled = Object.values(items).filter(v => v).length;
  return {
    score: Math.round((filled / 12) * 100),
    details: items,
    filled,
    total: 12
  };
}

// GT 매칭 분석
function analyzeGTMatching(gtDates, resultDates) {
  const matched = gtDates.filter(d => resultDates.includes(d));
  const missed = gtDates.filter(d => !resultDates.includes(d));
  const extra = resultDates.filter(d => !gtDates.includes(d));
  
  return {
    gtCount: gtDates.length,
    resultCount: resultDates.length,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length,
    coverage: gtDates.length > 0 ? Math.round((matched.length / gtDates.length) * 100) : 0,
    precision: resultDates.length > 0 ? Math.round((matched.length / resultDates.length) * 100) : 0,
    matched,
    missed,
    extra
  };
}

// Vision LLM 호출
async function callVisionLLM(images, prompt, version) {
  const client = getOpenAI();
  const promptConfig = PROMPT_VERSIONS[version];
  
  // 이미지 준비
  const imageContents = [];
  for (const imagePath of images) {
    const base64 = await optimizeImage(imagePath);
    imageContents.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: 'low'
      }
    });
  }
  
  const messages = [
    {
      role: 'system',
      content: promptConfig.systemPrompt
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: promptConfig.userPromptTemplate },
        ...imageContents
      ]
    }
  ];
  
  const response = await client.chat.completions.create({
    model: CONFIG.model,
    messages,
    max_tokens: 4096,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });
  
  return {
    content: response.choices[0].message.content,
    usage: response.usage
  };
}

// 케이스 처리
async function processCase(caseNum, version, caseSets) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${version}] Case ${caseNum} 처리 중...`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  // 케이스 정보
  const caseInfo = caseSets.details[caseNum];
  if (!caseInfo) {
    console.log(`  ❌ 케이스 정보 없음`);
    return null;
  }
  
  // PDF 폴더 확인
  const pdfFolder = caseInfo.files?.pdfFolder;
  if (!pdfFolder || !fs.existsSync(pdfFolder)) {
    console.log(`  ❌ PDF 폴더 없음: ${pdfFolder}`);
    return null;
  }
  
  // 모든 PDF 파일 찾기 및 병합 처리
  const pdfFiles = fs.readdirSync(pdfFolder).filter(f => f.endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log(`  ❌ PDF 파일 없음`);
    return null;
  }
  
  console.log(`  📄 PDF 파일: ${pdfFiles.length}개`);
  
  // 모든 PDF에서 이미지 추출
  const allImages = [];
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(pdfFolder, pdfFile);
    const images = convertPdfToImages(pdfPath, CONFIG.tempDir);
    allImages.push(...images);
    console.log(`    - ${pdfFile}: ${images.length}페이지`);
  }
  
  const images = allImages;
  console.log(`  📸 총 이미지: ${images.length}페이지`);
  
  if (images.length === 0) {
    console.log(`  ❌ 이미지 변환 실패`);
    return null;
  }
  
  // Vision LLM 호출 (최대 30페이지)
  const maxPages = Math.min(images.length, 30);
  const selectedImages = images.slice(0, maxPages);
  
  console.log(`  🤖 Vision LLM 호출 (${selectedImages.length}페이지)...`);
  
  let result;
  try {
    const response = await callVisionLLM(selectedImages, version, version);
    result = JSON.parse(response.content);
    
    // 스키마 검증 및 기본값 적용
    const validation = validateReportSchema(result);
    result = applyDefaultValues(result, validation);
    result = calculateVisitStatistics(result);
    
    console.log(`  ✅ 추출 완료`);
    
  } catch (error) {
    console.log(`  ❌ 오류: ${error.message}`);
    return null;
  }
  
  // GT 로드 및 분석
  const gtText = loadGroundTruth(caseNum);
  const gtDates = gtText ? extractDatesFromGT(gtText) : [];
  const resultDates = extractDatesFromResult(result);
  
  // 분석
  const gtMatching = analyzeGTMatching(gtDates, resultDates);
  const completeness = calculate10ItemCompleteness(result);
  
  console.log(`  📊 GT Coverage: ${gtMatching.coverage}% (${gtMatching.matchedCount}/${gtMatching.gtCount})`);
  console.log(`  📊 Precision: ${gtMatching.precision}% (${gtMatching.matchedCount}/${gtMatching.resultCount})`);
  console.log(`  📊 10항목 완성도: ${completeness.score}% (${completeness.filled}/${completeness.total})`);
  
  // 결과 저장
  const cacheDir = path.join(CONFIG.cacheDir, version);
  const resultPath = path.join(cacheDir, `case_${caseNum}_${version}.json`);
  
  const caseResult = {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: caseInfo.patientName,
    version,
    processedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime,
    totalPages: images.length,
    processedPages: selectedImages.length,
    result,
    gtDates,
    resultDates,
    metrics: {
      gtMatching,
      completeness
    }
  };
  
  fs.writeFileSync(resultPath, JSON.stringify(caseResult, null, 2));
  
  // 임시 파일 정리
  images.forEach(img => {
    try { fs.unlinkSync(img); } catch (e) {}
  });
  
  return caseResult;
}

// HTML 보고서 생성
function generateReport(results, version) {
  const summary = {
    version,
    totalCases: results.length,
    avgCoverage: Math.round(results.reduce((s, r) => s + r.metrics.gtMatching.coverage, 0) / results.length),
    avgPrecision: Math.round(results.reduce((s, r) => s + r.metrics.gtMatching.precision, 0) / results.length),
    avgCompleteness: Math.round(results.reduce((s, r) => s + r.metrics.completeness.score, 0) / results.length),
    totalGtDates: results.reduce((s, r) => s + r.metrics.gtMatching.gtCount, 0),
    totalMatched: results.reduce((s, r) => s + r.metrics.gtMatching.matchedCount, 0),
    totalMissed: results.reduce((s, r) => s + r.metrics.gtMatching.missedCount, 0)
  };
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>프롬프트 ${version} 테스트 결과</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 2rem; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; }
    h1 { color: #1e293b; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; }
    .stat { background: #f8fafc; padding: 1.5rem; border-radius: 8px; text-align: center; }
    .stat .value { font-size: 2rem; font-weight: bold; color: #667eea; }
    .stat .label { color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #667eea; color: white; }
    .good { color: #10b981; }
    .bad { color: #ef4444; }
    .case-detail { background: #f8fafc; padding: 1rem; margin: 1rem 0; border-radius: 8px; }
    .missed { color: #ef4444; }
    .matched { color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 프롬프트 ${version} 테스트 결과</h1>
    <p>테스트 일시: ${new Date().toLocaleString('ko-KR')}</p>
    
    <div class="summary">
      <div class="stat">
        <div class="value">${summary.avgCoverage}%</div>
        <div class="label">평균 GT Coverage</div>
      </div>
      <div class="stat">
        <div class="value">${summary.avgPrecision}%</div>
        <div class="label">평균 Precision</div>
      </div>
      <div class="stat">
        <div class="value">${summary.avgCompleteness}%</div>
        <div class="label">평균 10항목 완성도</div>
      </div>
      <div class="stat">
        <div class="value">${summary.totalMatched}/${summary.totalGtDates}</div>
        <div class="label">총 GT 매칭</div>
      </div>
    </div>
    
    <h2>케이스별 결과</h2>
    <table>
      <tr>
        <th>케이스</th>
        <th>환자명</th>
        <th>페이지</th>
        <th>GT Coverage</th>
        <th>Precision</th>
        <th>10항목 완성도</th>
        <th>누락 날짜</th>
      </tr>
      ${results.map(r => `
        <tr>
          <td><strong>${r.caseId}</strong></td>
          <td>${r.patientName}</td>
          <td>${r.processedPages}/${r.totalPages}</td>
          <td class="${r.metrics.gtMatching.coverage >= 70 ? 'good' : 'bad'}">${r.metrics.gtMatching.coverage}%</td>
          <td class="${r.metrics.gtMatching.precision >= 50 ? 'good' : 'bad'}">${r.metrics.gtMatching.precision}%</td>
          <td class="${r.metrics.completeness.score >= 50 ? 'good' : 'bad'}">${r.metrics.completeness.score}%</td>
          <td class="missed">${r.metrics.gtMatching.missed.slice(0, 3).join(', ')}${r.metrics.gtMatching.missed.length > 3 ? '...' : ''}</td>
        </tr>
      `).join('')}
    </table>
    
    <h2>상세 분석</h2>
    ${results.map(r => `
      <div class="case-detail">
        <h3>${r.caseId} - ${r.patientName}</h3>
        <p><strong>10항목 상세:</strong></p>
        <ul>
          ${Object.entries(r.metrics.completeness.details).map(([k, v]) => 
            `<li class="${v ? 'matched' : 'missed'}">${k}: ${v ? '✅' : '❌'}</li>`
          ).join('')}
        </ul>
        <p><strong>누락 날짜:</strong> <span class="missed">${r.metrics.gtMatching.missed.join(', ') || '없음'}</span></p>
        <p><strong>매칭 날짜:</strong> <span class="matched">${r.metrics.gtMatching.matched.join(', ') || '없음'}</span></p>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

  const reportPath = path.join(CONFIG.reportsDir, version, `${version}_report.html`);
  fs.writeFileSync(reportPath, html);
  
  // JSON 결과도 저장
  const jsonPath = path.join(CONFIG.outputDir, `${version}_results.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2));
  
  return { summary, reportPath, jsonPath };
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  const version = args[0] || 'v1';
  const caseNums = args[1] ? args[1].split(',').map(Number) : CONFIG.testCases;
  
  console.log('='.repeat(70));
  console.log(`프롬프트 테스터 - 버전: ${version}`);
  console.log(`테스트 케이스: ${caseNums.join(', ')}`);
  console.log('='.repeat(70));
  
  initDirectories(version);
  const caseSets = loadCaseSets();
  
  if (!caseSets) {
    console.log('❌ 케이스 세트 로드 실패');
    return;
  }
  
  const results = [];
  
  for (let i = 0; i < caseNums.length; i++) {
    const caseNum = caseNums[i];
    
    try {
      const result = await processCase(caseNum, version, caseSets);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.log(`  ❌ Case ${caseNum} 처리 실패: ${error.message}`);
    }
    
    // Rate limit 대기 (마지막 케이스 제외)
    if (i < caseNums.length - 1) {
      console.log(`\n⏳ Rate limit 대기 (30초)...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
    }
  }
  
  // 보고서 생성
  console.log('\n' + '='.repeat(70));
  console.log('보고서 생성 중...');
  console.log('='.repeat(70));
  
  const report = generateReport(results, version);
  
  console.log(`\n✅ 테스트 완료!`);
  console.log(`📊 평균 GT Coverage: ${report.summary.avgCoverage}%`);
  console.log(`📊 평균 Precision: ${report.summary.avgPrecision}%`);
  console.log(`📊 평균 10항목 완성도: ${report.summary.avgCompleteness}%`);
  console.log(`📄 HTML 보고서: ${report.reportPath}`);
  console.log(`📄 JSON 결과: ${report.jsonPath}`);
}

main().catch(console.error);
