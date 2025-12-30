/**
 * Google Vision OCR 서비스
 * PDF 파일에서 텍스트를 추출하는 기능 제공
 * @module services/visionService
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { chromium } from 'playwright';
import sharp from 'sharp';
import * as gcsService from './gcsService.js';
import * as fileHelper from '../utils/fileHelper.js';
import { logOcrStart, logOcrComplete, logOcrError } from '../utils/logger.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상수
const SERVICE_NAME = 'VISION-OCR';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Google Vision 클라이언트 상태 추적
let visionClient = null;
let lastCredentialsPath = null;
let lastApiKey = null;
let pdfRenderBrowserPromise = null;

async function getPdfRenderBrowser() {
  if (!pdfRenderBrowserPromise) {
    pdfRenderBrowserPromise = chromium.launch({ headless: true });
  }
  return pdfRenderBrowserPromise;
}

export async function closePdfRenderBrowser() {
  const cur = pdfRenderBrowserPromise;
  pdfRenderBrowserPromise = null;
  if (!cur) return;
  try {
    const browser = await cur;
    await browser.close();
  } catch {
  }
}

function getEffectiveTextLength(s) {
  if (typeof s !== 'string') return 0;
  return s.replace(/\s+/g, '').length;
}

/**
 * 실시간 Vision 설정 정보 가져오기
 * @returns {Object} 실시간 Vision 설정 정보
 */
function getVisionConfig() {
  const resolveEnv = (v) => {
    if (typeof v !== 'string' || v.length === 0) return v;
    const replaced = v.replace(/\$\{([A-Z0-9_]+)\}/g, (_m, name) => (process.env[name] ?? _m));
    if (/\$\{[A-Z0-9_]+\}/.test(replaced)) return undefined;
    return replaced;
  };

  const bucketFromEnv = resolveEnv(process.env.GCS_BUCKET_NAME) || resolveEnv(process.env.GCS_BUCKET);
  const credEnv = resolveEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const apiKeyEnv = resolveEnv(process.env.GOOGLE_CLOUD_VISION_API_KEY);
  let credentialsResolved = credEnv;
  try {
    const embeddedCred = path.join(process.cwd(), 'backend', 'config', 'gcp-service-account-key.json');
    if ((!credentialsResolved || (typeof credentialsResolved === 'string' && !fs.existsSync(credentialsResolved))) && fs.existsSync(embeddedCred)) {
      credentialsResolved = embeddedCred;
    }
  } catch {
  }
  return {
    isEnabled: process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION !== 'false',
    credentials: credentialsResolved,
    apiKey: apiKeyEnv,
    bucket: bucketFromEnv || 'medreport-vision-ocr-bucket',
    projectId: resolveEnv(process.env.GCP_PROJECT_ID)
  };
}

/**
 * Vision 클라이언트 초기화 함수
 * @returns {ImageAnnotatorClient} Vision 클라이언트 인스턴스
 */
function getVisionClient() {
  // 실시간 Vision 설정 정보 가져오기
  const config = getVisionConfig();

  // 새로운 서비스 계정 키 또는 API 키가 제공되었는지 확인
  const shouldReinitialize = !visionClient ||
    (config.credentials !== lastCredentialsPath) ||
    (config.apiKey !== lastApiKey);

  // Vision OCR 활성화 여부 체크
  if (!config.isEnabled) {
    console.warn('Vision OCR이 비활성화되었습니다. 환경 변수 ENABLE_VISION_OCR=true 및 USE_VISION=true로 설정해주세요.');
    throw new Error('Vision OCR이 비활성화되었습니다. 환경 변수를 확인하세요.');
  }

  if (shouldReinitialize) {
    console.log('Vision 클라이언트를 초기화합니다...');

    try {
      const options = {};

      // 서비스 계정 키 파일 확인 (우선순위 1)
      if (config.credentials) {
        if (fs.existsSync(config.credentials)) {
          // 절대 경로로 변환하여 keyFilename 옵션 설정
          const absolutePath = path.resolve(config.credentials);
          options.keyFilename = absolutePath;
          console.log(`서비스 계정 키 파일 사용: ${absolutePath}`);
        } else {
          console.warn(`⚠️ 서비스 계정 키 파일을 찾을 수 없습니다: ${config.credentials}. API 키를 대신 사용합니다.`);
          // 파일이 없으면 API 키 사용 시도
        }
      }

      // API 키 확인 (우선순위 2)
      if (!options.keyFilename && config.apiKey) {
        options.key = config.apiKey;
        console.log('Vision API 키 사용');
      }

      // 프로젝트 ID 설정 (선택사항)
      if (config.projectId) {
        options.projectId = config.projectId;
        console.log(`프로젝트 ID 설정: ${config.projectId}`);
      }

      // 인증 방법 확인
      if (!options.keyFilename && !options.key) {
        throw new Error('인증 방법이 설정되지 않았습니다. 서비스 계정 키 파일 또는 API 키가 필요합니다.');
      }

      // Vision 클라이언트 생성
      visionClient = new ImageAnnotatorClient(options);

      // 현재 인증 정보 저장
      lastCredentialsPath = config.credentials;
      lastApiKey = config.apiKey;

      console.log('✅ Vision 클라이언트 초기화 완료');
    } catch (error) {
      console.error(`❌ Vision 클라이언트 초기화 실패: ${error.message}`);
      throw new Error(`Vision 클라이언트 초기화 실패: ${error.message}`);
    }
  }

  return visionClient;
}

/**
 * Vision OCR 서비스 초기화 - 서버 시작 시 호출용
 * @returns {Object} 초기화 결과
 */
export function initializeVision() {
  try {
    // 실시간 Vision 설정 정보 가져오기
    const config = getVisionConfig();

    if (!config.isEnabled) {
      console.warn('Vision OCR이 비활성화되었습니다. 환경 변수 ENABLE_VISION_OCR=true 및 USE_VISION=true로 설정해주세요.');
      return { success: false, error: 'Vision OCR이 비활성화되었습니다.' };
    }

    // 필수 설정 체크
    if (!config.credentials && !config.apiKey) {
      console.error('Vision OCR 인증 정보가 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_CLOUD_VISION_API_KEY가 필요합니다.');
      return { success: false, error: '인증 정보가 설정되지 않았습니다.' };
    }

    if (!config.bucket) {
      console.error('GCS 버킷이 설정되지 않았습니다. GCS_BUCKET_NAME 환경 변수가 필요합니다.');
      return { success: false, error: 'GCS 버킷이 설정되지 않았습니다.' };
    }

    // 클라이언트 초기화 시도
    const client = getVisionClient();

    return {
      success: true,
      config,
      client
    };
  } catch (error) {
    console.error(`Vision OCR 서비스 초기화 실패: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * PDF 파일을 GCS에 업로드하고 OCR 수행 후 결과를 반환하는 메인 함수
 * @param {string} pdfFilePath - 로컬 PDF 파일 경로
 * @returns {Promise<Object>} OCR 결과
 */
export async function processPdfFile(pdfFilePath) {
  // 성능 측정 시작
  const perfData = logOcrStart(SERVICE_NAME, pdfFilePath);

  try {
    // 실시간 Vision 설정 정보 가져오기
    const config = getVisionConfig();

    // 1. Vision OCR 활성화 여부 확인
    if (!config.isEnabled) {
      throw new Error('Vision OCR이 비활성화되었습니다. 환경 변수를 확인하세요.');
    }

    // 2. 버킷 설정 확인
    if (!config.bucket) {
      throw new Error('GCS 버킷이 설정되지 않았습니다. GCS_BUCKET_NAME 환경 변수를 확인하세요.');
    }

    // 3. 인증 설정 확인
    if (!config.credentials && !config.apiKey) {
      throw new Error('Vision OCR 인증 정보가 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_CLOUD_VISION_API_KEY가 필요합니다.');
    }

    // 4. PDF 파일 유효성 검사
    const pdfInfo = fileHelper.validatePdfFile(pdfFilePath);
    if (!pdfInfo.isValid) {
      throw new Error(`유효하지 않은 PDF 파일: ${pdfInfo.error}`);
    }

    // 5. Vision 클라이언트 초기화 확인
    try {
      getVisionClient(); // 클라이언트가 초기화되었는지 확인
    } catch (clientError) {
      throw new Error(`Vision 클라이언트 초기화 실패: ${clientError.message}`);
    }

    // 6. GCS에 PDF 업로드
    const gcsPdfPath = await gcsService.uploadPdfToGcs(pdfFilePath);

    // 7. 결과가 저장될 GCS 경로 접두사 생성
    const outputPrefix = `ocr-results/${uuidv4()}`;

    // 8. Vision OCR 비동기 작업 실행
    const ocrJob = await runAsyncBatchOcr(gcsPdfPath, outputPrefix);

    // 9. OCR 결과 파싱
    const ocrResults = await parseOcrResults(outputPrefix);

    // 10. 결과 반환 및 성능 측정 완료 로깅
    return logOcrComplete(perfData, ocrResults);
  } catch (error) {
    // 오류 로깅 및 오류 정보 반환
    return logOcrError(perfData, error);
  }
}

export async function processPdfFileViaImages(pdfFilePath, options = {}) {
  const perfData = logOcrStart(SERVICE_NAME, `pdf_images:${pdfFilePath}`);
  try {
    const config = getVisionConfig();
    if (!config.isEnabled) {
      throw new Error('Vision OCR이 비활성화되었습니다. 환경 변수를 확인하세요.');
    }
    if (!config.credentials && !config.apiKey) {
      throw new Error('Vision OCR 인증 정보가 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_CLOUD_VISION_API_KEY가 필요합니다.');
    }
    const pdfInfo = fileHelper.validatePdfFile(pdfFilePath);
    if (!pdfInfo.isValid) {
      throw new Error(`유효하지 않은 PDF 파일: ${pdfInfo.error}`);
    }

    const pageCount = Number(options.pageCount);
    if (!Number.isFinite(pageCount) || pageCount <= 0) {
      throw new Error('pageCount가 필요합니다.');
    }

    const pageTexts = [];
    let renderMethod = 'unknown';

    const renderWithSharp = async () => {
      for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
        const imageBuffer = await sharp(pdfFilePath, { density: 150, page: pageNum - 1 }).png().toBuffer();
        const ocr = await extractTextFromImage(imageBuffer);
        const text = typeof ocr?.text === 'string' ? ocr.text : '';
        pageTexts.push({ page: pageNum, text });
      }
      renderMethod = 'sharp';
    };

    const renderWithPdf2pic = async () => {
      const { fromPath } = await import('pdf2pic');
      const base = path.resolve(process.cwd(), 'temp');
      if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
      const savePath = fs.mkdtempSync(path.join(base, 'pdf2pic-'));
      try {
        const convert = fromPath(pdfFilePath, {
          density: 150,
          format: 'png',
          preserveAspectRatio: true,
          savePath,
          saveFilename: 'page'
        });

        for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
          const converted = await convert(pageNum, { responseType: 'buffer' });
          const buf = Buffer.isBuffer(converted) ? converted : converted?.buffer;
          if (!Buffer.isBuffer(buf) || buf.length === 0) {
            pageTexts.push({ page: pageNum, text: '' });
            continue;
          }
          const ocr = await extractTextFromImage(buf);
          const text = typeof ocr?.text === 'string' ? ocr.text : '';
          pageTexts.push({ page: pageNum, text });
        }
      } finally {
        try {
          fs.rmSync(savePath, { recursive: true, force: true });
        } catch {
        }
      }
      renderMethod = 'pdf2pic';
    };

    try {
      await renderWithSharp();
    } catch (sharpError) {
      try {
        await renderWithPdf2pic();
      } catch (pdf2picError) {
        const msg = [sharpError?.message, pdf2picError?.message].filter(Boolean).join(' | ') || 'pdf_render_failed';
        throw new Error(msg);
      }
    }

    const merged = pageTexts.map(p => p.text).join('\n\n');
    const effectiveLen = getEffectiveTextLength(merged);
    if (effectiveLen === 0) {
      throw new Error('이미지 기반 OCR 결과가 비어 있습니다.');
    }

    return logOcrComplete(perfData, {
      text: merged,
      pageCount,
      renderMethod,
      pages: pageTexts.map(p => ({ page: p.page, textLength: (p.text || '').length }))
    });
  } catch (error) {
    return logOcrError(perfData, error);
  }
}

/**
 * PDF 파일에 대한 OCR 처리 실행 (비동기 배치 처리)
 * @param {string} gcsPdfPath - GCS 내 PDF 파일 경로
 * @param {string} outputPrefix - OCR 결과가 저장될 GCS 접두사
 * @returns {Promise<Object>} - OCR 작업 정보
 */
async function runAsyncBatchOcr(gcsPdfPath, outputPrefix) {
  try {
    // 설정 정보 가져오기
    const config = getVisionConfig();

    // Vision API 활성화 여부 확인
    if (!config.isEnabled) {
      throw new Error('Vision OCR이 비활성화되었습니다. 환경 변수를 확인하세요.');
    }

    // Vision 클라이언트 가져오기
    const client = getVisionClient();
    if (!client) {
      throw new Error('Vision 클라이언트가 초기화되지 않았습니다.');
    }

    // GCS 파일 경로를 gs:// URI 형식으로 변환
    const gcsSourceUri = gcsService.getGcsUri(gcsPdfPath);
    const gcsDestinationUri = gcsService.getGcsUri(`${outputPrefix}/`);

    console.log(`OCR 소스 파일: ${gcsSourceUri}`);
    console.log(`OCR 결과 경로: ${gcsDestinationUri}`);

    // 비동기 배치 OCR 요청 설정
    const request = {
      requests: [{
        inputConfig: {
          gcsSource: { uri: gcsSourceUri },
          mimeType: 'application/pdf'
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        outputConfig: {
          gcsDestination: { uri: gcsDestinationUri },
          batchSize: 10  // 한 번에 처리할 페이지 수
        }
      }]
    };

    // 비동기 배치 OCR 요청 전송
    console.log('Vision API 비동기 배치 OCR 요청 전송 중...');
    const [operation] = await client.asyncBatchAnnotateFiles(request);

    // 작업 ID 추출
    const operationId = operation.name.split('/').pop();
    console.log(`OCR 작업 ID: ${operationId}`);

    // 비동기 작업 완료 대기
    console.log('OCR 작업 완료 대기 중...');
    const [result] = await operation.promise();
    console.log('OCR 작업 완료!');

    return {
      operationId,
      outputPrefix,
      result
    };
  } catch (error) {
    console.error(`OCR 처리 오류: ${error.message}`);
    throw new Error(`비동기 배치 OCR 처리 실패: ${error.message}`);
  }
}

/**
 * 비동기 OCR 결과 파싱
 * @param {string} outputPrefix - OCR 결과가 저장된 GCS 접두사
 * @returns {Promise<Object>} - 파싱된 OCR 결과
 */
async function parseOcrResults(outputPrefix) {
  try {
    // GCS에서 결과 파일 목록 조회
    const files = await gcsService.listGcsObjects(outputPrefix);

    // JSON 결과 파일만 필터링
    const jsonFiles = files.filter(file => file.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return { text: '', pages: [] };
    }

    // 모든 JSON 파일 처리
    const pagesData = [];
    const blocksData = [];
    let completeText = '';

    const inferPageOffsetFromFilename = (fileName) => {
      const base = path.basename(fileName);
      const patterns = [
        /-(\d+)-to-(\d+)\.json$/i,
        /_(\d+)_to_(\d+)\.json$/i,
        /-(\d+)-(\d+)\.json$/i,
      ];
      for (const re of patterns) {
        const m = base.match(re);
        if (m) {
          const start = Number(m[1]);
          if (Number.isFinite(start) && start > 0) return start - 1;
        }
      }
      return 0;
    };

    // 파일명 정렬 (페이지 순서 유지를 위해)
    jsonFiles.sort((a, b) => a.name.localeCompare(b.name));

    // 각 JSON 파일 처리
    for (const jsonFile of jsonFiles) {
      // JSON 파일 다운로드 및 파싱
      const jsonData = await gcsService.downloadAndParseJson(jsonFile.name);

      const offset = inferPageOffsetFromFilename(jsonFile.name);
      try {
        const extracted = extractBlocksFromJson(jsonData);
        extracted.forEach(b => {
          blocksData.push({
            ...b,
            page: typeof b.page === 'number' ? b.page + offset : undefined,
            rawFile: jsonFile.name,
            rawPrefix: outputPrefix
          });
        });
      } catch (_) {
      }

      // 페이지 텍스트 추출
      if (jsonData.responses && jsonData.responses.length > 0) {
        for (const response of jsonData.responses) {
          if (response.fullTextAnnotation) {
            const pageText = response.fullTextAnnotation.text || '';

            // 페이지 번호 추출 (파일 이름에서)
            const pageMatch = path.basename(jsonFile.name).match(/(\d+)\.json$/);
            const pageNum = (pageMatch ? parseInt(pageMatch[1], 10) : pagesData.length + 1) + offset;

            // 페이지 데이터 추가
            pagesData.push({
              page: pageNum,
              text: pageText,
              rawFile: jsonFile.name,
              rawPrefix: outputPrefix
            });

            // 전체 텍스트에 추가
            if (pageText) {
              completeText += pageText + '\n\n';
            }
          }
        }
      }
    }

    // 페이지 순서대로 정렬
    pagesData.sort((a, b) => a.page - b.page);
    blocksData.sort((a, b) => (Number(a.page ?? 0) - Number(b.page ?? 0)) || (a.bbox?.yMin - b.bbox?.yMin) || (a.bbox?.xMin - b.bbox?.xMin));

    return {
      text: completeText.trim(),
      pages: pagesData,
      blocks: blocksData,
      pageCount: pagesData.length,
      rawFiles: jsonFiles.map(f => f.name),
      rawPrefix: outputPrefix
    };
  } catch (error) {
    throw new Error(`OCR 결과 파싱 실패: ${error.message}`);
  }
}

/**
 * 이미지 파일에서 텍스트 추출 (Google Vision API 사용)
 * @param {Buffer} imageBuffer - 이미지 파일 버퍼
 * @returns {Promise<Object>} OCR 결과
 */
export async function extractTextFromImage(imageBuffer) {
  const perfData = logOcrStart(SERVICE_NAME, 'image_buffer');

  try {
    // 실시간 Vision 설정 정보 가져오기
    const config = getVisionConfig();

    // Vision OCR 활성화 여부 확인
    if (!config.isEnabled) {
      throw new Error('Vision OCR이 비활성화되었습니다. 환경 변수를 확인하세요.');
    }

    // 인증 설정 확인
    if (!config.credentials && !config.apiKey) {
      throw new Error('Vision OCR 인증 정보가 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_CLOUD_VISION_API_KEY가 필요합니다.');
    }

    // Vision 클라이언트 초기화
    const client = getVisionClient();

    console.log(`[${SERVICE_NAME}] 이미지 OCR 처리 시작`);

    // 이미지에서 텍스트 감지
    const [result] = await client.textDetection({
      image: {
        content: imageBuffer
      }
    });

    const detections = result.textAnnotations;
    let extractedText = '';
    let confidence = 0;

    if (detections && detections.length > 0) {
      // 첫 번째 요소는 전체 텍스트
      extractedText = detections[0].description || '';

      // 평균 신뢰도 계산
      if (detections.length > 1) {
        const confidenceSum = detections.slice(1).reduce((sum, detection) => {
          return sum + (detection.confidence || 0.8);
        }, 0);
        confidence = confidenceSum / (detections.length - 1);
      } else {
        confidence = 0.8; // 기본값
      }
    }

    const result_data = {
      text: extractedText,
      confidence: confidence,
      textLength: extractedText.length,
      detectionCount: detections ? detections.length : 0
    };

    // 성능 로깅
    if (perfData && perfData.startTime) {
      logOcrComplete(perfData, {
        text: extractedText,
        textLength: extractedText.length,
        confidence: confidence
      });
    }

    console.log(`[${SERVICE_NAME}] 이미지 OCR 처리 완료`, {
      textLength: extractedText.length,
      confidence: confidence
    });

    return result_data;

  } catch (error) {
    if (perfData && perfData.startTime) {
      logOcrError(perfData, error);
    }
    console.error(`[${SERVICE_NAME}] 이미지 OCR 처리 실패:`, error.message);
    throw new Error(`이미지 OCR 처리 실패: ${error.message}`);
  }
}

/**
 * OCR 서비스 상태 확인
 * @returns {Promise<Object>} 서비스 상태 정보
 */
export async function getServiceStatus() {
  try {
    const ENABLED = process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION !== 'false';
    const config = getVisionConfig();
    const credPath = config.credentials;
    const hasCredFile = typeof credPath === 'string' && credPath.length > 0 && fs.existsSync(credPath);
    const hasApiKey = typeof config.apiKey === 'string' && config.apiKey.length > 0;
    const hasBucket = typeof config.bucket === 'string' && config.bucket.length > 0;
    const clientAvailable = !!visionClient || ((hasCredFile || hasApiKey) && hasBucket);
    return {
      service: SERVICE_NAME,
      available: ENABLED && clientAvailable,
      enabled: ENABLED,
      hasCredentials: hasCredFile || hasApiKey,
      hasBucket
    };
  } catch (error) {
    return {
      service: SERVICE_NAME,
      available: false,
      error: error.message
    };
  }
}

export function extractBlocksFromJson(json) {
  const out = [];
  const responses = Array.isArray(json?.responses) ? json.responses : [];
  for (const resp of responses) {
    const ann = resp?.fullTextAnnotation;
    const pages = Array.isArray(ann?.pages) ? ann.pages : [];
    for (let pIndex = 0; pIndex < pages.length; pIndex++) {
      const page = pages[pIndex];
      const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
      for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
        const block = blocks[bIndex];
        const paragraphs = Array.isArray(block?.paragraphs) ? block.paragraphs : [];
        const textParts = [];
        for (const para of paragraphs) {
          const words = Array.isArray(para?.words) ? para.words : [];
          const wordTexts = words.map(w => {
            const symbols = Array.isArray(w?.symbols) ? w.symbols : [];
            return symbols.map(s => s?.text ?? '').join('');
          }).filter(s => s.length > 0);
          if (wordTexts.length > 0) {
            textParts.push(wordTexts.join(' '));
          }
        }
        const bp = block?.boundingBox || block?.boundingPoly || null;
        const verts = Array.isArray(bp?.vertices) ? bp.vertices : [];
        const xs = verts.map(v => Number(v?.x ?? 0));
        const ys = verts.map(v => Number(v?.y ?? 0));
        const xMin = xs.length ? Math.min(...xs) : 0;
        const yMin = ys.length ? Math.min(...ys) : 0;
        const xMax = xs.length ? Math.max(...xs) : 0;
        const yMax = ys.length ? Math.max(...ys) : 0;
        out.push({
          page: pIndex + 1,
          blockIndex: bIndex,
          text: textParts.join('\n'),
          bbox: { xMin, yMin, xMax, yMax, width: xMax - xMin, height: yMax - yMin },
          vertices: verts,
          confidence: typeof block?.confidence === 'number' ? block.confidence : undefined
        });
      }
    }
  }
  out.sort((a, b) => (a.bbox.yMin - b.bbox.yMin) || (a.bbox.xMin - b.bbox.xMin));
  return out;
}

export default {
  processPdfFile,
  extractTextFromImage,
  getServiceStatus
};
