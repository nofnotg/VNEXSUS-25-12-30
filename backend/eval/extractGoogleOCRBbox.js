/**
 * Google OCR bbox 좌표 추출 스크립트
 *
 * 목표: 10개 케이스에 대해 Google Vision OCR 실행 및 bbox 좌표 추출
 * - Case 2, 5, 13, 15, 17, 29, 30, 41, 42, 44
 * - 각 케이스의 모든 텍스트 블록 + bbox 좌표 추출
 * - 날짜 패턴이 있는 블록 식별
 * - 좌표 정보와 함께 캐시 저장
 *
 * 실행: node backend/eval/extractGoogleOCRBbox.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageAnnotatorClient } from '@google-cloud/vision';
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

  // 출력 경로
  outputDir: path.join(__dirname, 'output/google_ocr_bbox'),
  cacheDir: path.join(__dirname, 'output/google_ocr_bbox/cache'),
  reportsDir: path.join(__dirname, 'output/google_ocr_bbox/reports'),
  tempDir: path.join(__dirname, 'output/google_ocr_bbox/temp'),

  caseSetsPath: path.join(__dirname, 'output/case_sets/case_sets_v2.json'),
  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',

  // 10개 케이스 (Case18 제외)
  targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44],

  // Google Vision 인증
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                   path.join(process.cwd(), 'backend', 'config', 'gcp-service-account-key.json'),

  // API 설정
  rateLimitDelay: 2000,
  maxRetries: 3
};

// Vision 클라이언트
let visionClient = null;

function getVisionClient() {
  if (!visionClient) {
    if (!fs.existsSync(CONFIG.credentialsPath)) {
      throw new Error(`Google 인증 파일을 찾을 수 없습니다: ${CONFIG.credentialsPath}`);
    }

    visionClient = new ImageAnnotatorClient({
      keyFilename: CONFIG.credentialsPath
    });

    console.log(`✅ Google Vision 클라이언트 초기화 완료`);
    console.log(`   인증 파일: ${CONFIG.credentialsPath}`);
  }
  return visionClient;
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

// PDF → 이미지 변환
async function pdfToImages(pdfFolder) {
  const allImages = [];
  const pageSourceMap = [];

  if (!fs.existsSync(pdfFolder)) {
    throw new Error(`PDF 폴더를 찾을 수 없습니다: ${pdfFolder}`);
  }

  const pdfFiles = fs.readdirSync(pdfFolder)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (pdfFiles.length === 0) {
    throw new Error(`PDF 파일이 없습니다: ${pdfFolder}`);
  }

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(pdfFolder, pdfFile);

    // PDF 페이지 수 확인
    const infoOutput = execSync(
      `"${path.join(CONFIG.popplerPath, 'pdfinfo')}" "${pdfPath}"`,
      { encoding: 'utf-8' }
    );

    const pagesMatch = infoOutput.match(/Pages:\s*(\d+)/);
    const numPages = pagesMatch ? parseInt(pagesMatch[1]) : 1;

    console.log(`  PDF: ${pdfFile} (${numPages} 페이지)`);

    // 임시 출력 디렉토리
    const tempPdfDir = path.join(CONFIG.tempDir, `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`);
    fs.mkdirSync(tempPdfDir, { recursive: true });

    // PDF → PNG 변환
    execSync(
      `"${path.join(CONFIG.popplerPath, 'pdftoppm')}" -png -r 200 "${pdfPath}" "${path.join(tempPdfDir, 'page')}"`,
      { encoding: 'utf-8' }
    );

    // 변환된 이미지 수집
    const imageFiles = fs.readdirSync(tempPdfDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    for (const imgFile of imageFiles) {
      const imgPath = path.join(tempPdfDir, imgFile);
      const imgBuffer = fs.readFileSync(imgPath);

      // Sharp로 이미지 최적화
      const optimized = await sharp(imgBuffer)
        .resize(2000, 3000, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();

      allImages.push(optimized);
      pageSourceMap.push({
        pdfFile,
        pageNum: allImages.length,
        originalPath: imgPath
      });
    }

    // 임시 파일 삭제
    fs.rmSync(tempPdfDir, { recursive: true, force: true });
  }

  console.log(`  총 ${allImages.length} 페이지 변환 완료`);
  return { allImages, pageSourceMap };
}

// Google Vision OCR 실행 (bbox 포함)
async function extractOCRWithBbox(imageBuffer, pageNum) {
  const client = getVisionClient();

  try {
    // Vision API 호출
    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer }
    });

    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation) {
      return { blocks: [], text: '' };
    }

    const blocks = [];
    const pages = fullTextAnnotation.pages || [];

    for (const page of pages) {
      const pageBlocks = page.blocks || [];

      for (const block of pageBlocks) {
        const paragraphs = block.paragraphs || [];
        const textParts = [];

        // 텍스트 추출
        for (const para of paragraphs) {
          const words = para.words || [];
          const wordTexts = words.map(w => {
            const symbols = w.symbols || [];
            return symbols.map(s => s.text || '').join('');
          }).filter(s => s.length > 0);

          if (wordTexts.length > 0) {
            textParts.push(wordTexts.join(' '));
          }
        }

        const text = textParts.join('\n');

        // bbox 좌표 추출
        const boundingBox = block.boundingBox || {};
        const vertices = boundingBox.vertices || [];

        const xs = vertices.map(v => v.x || 0);
        const ys = vertices.map(v => v.y || 0);

        const xMin = xs.length ? Math.min(...xs) : 0;
        const yMin = ys.length ? Math.min(...ys) : 0;
        const xMax = xs.length ? Math.max(...xs) : 0;
        const yMax = ys.length ? Math.max(...ys) : 0;

        blocks.push({
          page: pageNum,
          text,
          bbox: {
            xMin,
            yMin,
            xMax,
            yMax,
            width: xMax - xMin,
            height: yMax - yMin
          },
          vertices,
          confidence: block.confidence || 0.9
        });
      }
    }

    return {
      blocks,
      text: fullTextAnnotation.text || ''
    };

  } catch (error) {
    console.error(`  ❌ OCR 실패 (페이지 ${pageNum}):`, error.message);
    return { blocks: [], text: '' };
  }
}

// 날짜 패턴 감지
function hasDatePattern(text) {
  const datePatterns = [
    /\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}[일]?/,  // YYYY.MM.DD, YYYY년 MM월 DD일
    /\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/,           // YY.MM.DD
    /\d{4}\s*\d{2}\s*\d{2}/                            // YYYYMMDD
  ];

  return datePatterns.some(pattern => pattern.test(text));
}

// 케이스 처리
async function processCase(caseNum, caseInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] ${caseInfo.patientName} - Google OCR bbox 추출`);
  console.log(`${'='.repeat(60)}`);

  // 캐시 확인
  const cachePath = path.join(CONFIG.cacheDir, `case_${caseNum}_bbox.json`);
  if (fs.existsSync(cachePath)) {
    console.log(`  ✓ 캐시 사용: ${cachePath}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  const pdfFolder = caseInfo.pdfFolder;
  if (!pdfFolder || !fs.existsSync(pdfFolder)) {
    console.log(`  ❌ PDF 폴더를 찾을 수 없습니다: ${pdfFolder}`);
    return { caseId: `Case${caseNum}`, error: 'PDF folder not found' };
  }

  // PDF → 이미지 변환
  console.log(`  PDF → 이미지 변환 중...`);
  const { allImages, pageSourceMap } = await pdfToImages(pdfFolder);

  // OCR 실행
  console.log(`  Google Vision OCR 실행 중... (${allImages.length} 페이지)`);
  const startTime = Date.now();

  const allBlocks = [];
  let fullText = '';

  for (let i = 0; i < allImages.length; i++) {
    const pageNum = i + 1;
    console.log(`    페이지 ${pageNum}/${allImages.length}...`);

    const { blocks, text } = await extractOCRWithBbox(allImages[i], pageNum);
    allBlocks.push(...blocks);
    fullText += text + '\n\n';

    // Rate limit 방지
    if (i < allImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
    }
  }

  const processingTime = Date.now() - startTime;

  // 날짜 블록 필터링
  const dateBlocks = allBlocks.filter(block => hasDatePattern(block.text));

  console.log(`  ✓ OCR 완료: ${allBlocks.length}개 블록, ${dateBlocks.length}개 날짜 블록`);
  console.log(`  ✓ 처리 시간: ${Math.round(processingTime / 1000)}초`);

  // 결과 저장
  const result = {
    caseId: `Case${caseNum}`,
    caseNum,
    patientName: caseInfo.patientName,
    totalPages: allImages.length,
    processedAt: new Date().toISOString(),
    processingTime,

    // 전체 블록
    blocks: allBlocks,

    // 날짜 패턴이 있는 블록만
    dateBlocks,

    // 통계
    stats: {
      totalBlocks: allBlocks.length,
      dateBlocks: dateBlocks.length,
      fullTextLength: fullText.length
    }
  };

  // 캐시 저장
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  ✓ 캐시 저장: ${cachePath}`);

  return result;
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// Ground Truth 날짜 추출
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

// 메인 실행
async function main() {
  console.log('\n🚀 Google OCR bbox 좌표 추출 시작\n');

  initDirectories();

  const caseSets = loadCaseSets();
  if (!caseSets) {
    console.error('❌ case_sets_v2.json을 찾을 수 없습니다.');
    process.exit(1);
  }

  const results = [];

  for (const caseNum of CONFIG.targetCases) {
    const caseInfo = getCaseInfo(caseSets, caseNum);

    if (!caseInfo) {
      console.log(`\n⚠️  Case${caseNum}: 케이스 정보를 찾을 수 없습니다.`);
      continue;
    }

    try {
      const result = await processCase(caseNum, caseInfo);
      results.push(result);

    } catch (error) {
      console.error(`\n❌ Case${caseNum} 처리 실패:`, error.message);
      results.push({
        caseId: `Case${caseNum}`,
        error: error.message
      });
    }
  }

  // 전체 결과 저장
  const summaryPath = path.join(CONFIG.outputDir, 'bbox_extraction_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    summary: {
      totalCases: CONFIG.targetCases.length,
      validCases: results.filter(r => !r.error).length,
      processedAt: new Date().toISOString()
    },
    results
  }, null, 2), 'utf-8');

  console.log(`\n✅ 전체 처리 완료`);
  console.log(`   결과 저장: ${summaryPath}`);
  console.log(`   캐시 디렉토리: ${CONFIG.cacheDir}`);
}

// 실행
main().catch(error => {
  console.error('\n❌ 실행 실패:', error);
  process.exit(1);
});
