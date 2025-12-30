/**
 * 통합 PDF 프로세서 유틸리티
 * PDF 무결성 검증, pdf-parse, OCR 처리 흐름의
 * 전체 End-to-End 로직을 구현한 스캐폴딩 모듈
 * @module utils/pdfProcessor
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import * as visionService from '../services/visionService.js';
// import * as textractService from '../services/textractService.js';
import { logService } from './logger.js';

// 임시 디렉토리 설정
const TEMP_DIR = process.env.TEMP_DIR || '../temp';

/**
 * PDF 파일 처리 워크플로우를 통합 실행하는 메인 함수
 * @param {Buffer|string} pdfInput - PDF 버퍼 또는 파일 경로
 * @param {Object} options - 처리 옵션
 * @returns {Promise<Object>} 처리 결과 객체
 */
export async function processPdf(pdfInput, options = {}) {
  const startTime = new Date();
  let tempFilePath = null;
  let pdfBuffer = null;
  let result = {
    success: false,
    startTime: startTime.toISOString(),
    steps: []
  };
  
  try {
    const effectiveTextLength = (s) => {
      if (typeof s !== 'string') return 0;
      return s.replace(/\s+/g, '').length;
    };

    // 1. 입력 검증 - 버퍼 또는 파일 경로 확인
    if (Buffer.isBuffer(pdfInput)) {
      pdfBuffer = pdfInput;
      result.steps.push({
        step: 'input_validation',
        status: 'success',
        message: '버퍼 입력 유효성 확인됨',
        timestamp: new Date().toISOString()
      });
    } else if (typeof pdfInput === 'string') {
      // 파일 경로인 경우 파일 읽기
      if (!fs.existsSync(pdfInput)) {
        throw new Error(`파일이 존재하지 않습니다: ${pdfInput}`);
      }
      
      pdfBuffer = fs.readFileSync(pdfInput);
      result.steps.push({
        step: 'input_validation',
        status: 'success',
        message: `파일 로드됨: ${pdfInput}`,
        timestamp: new Date().toISOString(),
        filePath: pdfInput
      });
    } else {
      throw new Error('유효하지 않은 입력: PDF 버퍼 또는 파일 경로를 제공해야 합니다.');
    }
    
    if (options.ocrOverride && typeof options.ocrOverride === 'string' && fs.existsSync(options.ocrOverride)) {
      const raw = fs.readFileSync(options.ocrOverride, 'utf-8');
      const inject = JSON.parse(raw);
      const otext = typeof inject?.text === 'string' ? inject.text : '';
      const opages = Array.isArray(inject?.pages) ? inject.pages : [];
      const oblocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
      const ocount = Number(inject?.pageCount || opages.length || 1);
      result.pageCount = ocount;
      result.text = otext;
      result.pages = opages;
      result.blocks = oblocks;
      result.ocrSource = 'offline_ocr';
      result.textSource = 'offline_ocr';
      result.success = otext.replace(/\s+/g, '').length > 0;
      const endTime = new Date();
      const totalTime = (endTime - startTime) / 1000;
      result.endTime = endTime.toISOString();
      result.processingTime = `${totalTime.toFixed(2)}초`;
      return result;
    }
    
    // 2. 파일 무결성 검증
    await validatePdfIntegrity(pdfBuffer, result);
    
    // 3. 임시 파일 저장 (필요한 경우)
    if (options.saveTemp || (!options.skipOcr && (options.useVision || options.useTextract))) {
      const tempDir = path.resolve(TEMP_DIR);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = options.fileName ? path.basename(options.fileName) : `temp-${uuidv4()}.pdf`;
      tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, pdfBuffer);
      
      result.steps.push({
        step: 'temp_file_creation',
        status: 'success',
        message: `임시 파일 생성됨: ${tempFilePath}`,
        timestamp: new Date().toISOString(),
        tempFilePath
      });
      
      result.tempFilePath = tempFilePath;
    }
    
    // 4. PDF 파싱 시도
    let pdfData = null;
    let isScannedPdf = false;
    let shouldUseOcr = false;
    
    try {
      const pdfParseStartTime = new Date();
      pdfData = await pdfParse(pdfBuffer, {
        version: 'v2.0.0'
      });
      
      const pageCount = pdfData.numpages;
      const textLength = pdfData.text.length;
      const avgCharsPerPage = textLength / Math.max(1, pageCount);
      
      // 평균 텍스트 양이 적으면 스캔 PDF로 간주
      isScannedPdf = avgCharsPerPage < 100;
      shouldUseOcr = isScannedPdf || options.forceOcr;
      
      const pdfParseEndTime = new Date();
      const pdfParseTime = (pdfParseEndTime - pdfParseStartTime) / 1000;
      
      result.steps.push({
        step: 'pdf_parse',
        status: 'success',
        message: `PDF 파싱 완료: ${pageCount}페이지, ${textLength}자`,
        timestamp: new Date().toISOString(),
        duration: `${pdfParseTime.toFixed(2)}초`,
        isScannedPdf,
        shouldUseOcr,
        avgCharsPerPage
      });
      
      // 기본 텍스트 저장
      result.pageCount = pageCount;
      result.text = pdfData.text;
      result.isScannedPdf = isScannedPdf;
      if (options.collectBlocks === true) {
        const syntheticBlocks = buildSyntheticBlocksFromText(result.text, result.pageCount);
        if (syntheticBlocks.length > 0) {
          result.blocks = syntheticBlocks;
          result.blocksSource = 'synthetic_pdf_parse';
        }
      }
    } catch (pdfError) {
      // pdf-parse 에러 발생 - 특정 에러 유형 확인
      logService.error(`[pdfProcessor] PDF 파싱 실패: ${pdfError.message}`);
      
      result.steps.push({
        step: 'pdf_parse',
        status: 'failed',
        message: `PDF 파싱 실패: ${pdfError.message}`,
        timestamp: new Date().toISOString(),
        error: pdfError.message
      });
      
      // PDF 파싱 에러 유형 분류
      if (pdfError.message.includes('password') || pdfError.message.includes('encrypted')) {
        throw new Error('암호화된 PDF 파일입니다. 암호를 해제한 후 다시 시도해주세요.');
      } else if (pdfError.message.includes('stream must have data')) {
        throw new Error('PDF 파일이 손상되었거나 비어 있습니다.');
      } else if (pdfError.message.includes('XFA')) {
        throw new Error('XFA 기반 PDF 양식은 현재 지원되지 않습니다.');
      }
      
      // 파싱 실패 시 OCR 사용
      shouldUseOcr = true;
      isScannedPdf = true;
    }
    
    // 5. OCR 처리 (스캔 PDF이거나 parse 실패한 경우)
    let ocrResult = null;
    
    if (options.ocrOverride && typeof options.ocrOverride === 'string' && fs.existsSync(options.ocrOverride)) {
      const raw = fs.readFileSync(options.ocrOverride, 'utf-8');
      const inject = JSON.parse(raw);
      const otext = typeof inject?.text === 'string' ? inject.text : '';
      const opages = Array.isArray(inject?.pages) ? inject.pages : [];
      const oblocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
      const ocount = Number(inject?.pageCount || opages.length || 1);
      result.text = otext;
      result.pageCount = ocount;
      result.pages = opages;
      result.blocks = oblocks;
      result.ocrSource = 'offline_ocr';
      result.textSource = 'offline_ocr';
      const endTime = new Date();
      const totalTime = (endTime - startTime) / 1000;
      result.success = otext.replace(/\s+/g, '').length > 0;
      result.endTime = endTime.toISOString();
      result.processingTime = `${totalTime.toFixed(2)}초`;
      return result;
    }
    
    if ((shouldUseOcr || options.forceOcr) && !options.skipOcr) {
      // 임시 파일이 필요함을 확인
      if (!tempFilePath) {
        const tempDir = path.resolve(TEMP_DIR);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const fileName = options.fileName ? path.basename(options.fileName) : `temp-${uuidv4()}.pdf`;
        tempFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempFilePath, pdfBuffer);
        result.tempFilePath = tempFilePath;
        
        result.steps.push({
          step: 'temp_file_creation_for_ocr',
          status: 'success',
          message: `OCR용 임시 파일 생성됨: ${tempFilePath}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // OCR 설정에 따라 서비스 선택
      const useVision = options.useVision !== undefined ? options.useVision : process.env.USE_VISION === 'true';
      const useTextract = options.useTextract !== undefined ? options.useTextract : process.env.USE_TEXTRACT === 'true';
      
      if (useVision) {
        try {
          const visionStartTime = new Date();
          ocrResult = await visionService.processPdfFile(tempFilePath);
          if (ocrResult?.error === true) {
            throw new Error(typeof ocrResult?.message === 'string' ? ocrResult.message : 'Vision OCR 처리 실패');
          }
          const visionEndTime = new Date();
          const visionTime = (visionEndTime - visionStartTime) / 1000;
          
          result.steps.push({
            step: 'vision_ocr',
            status: 'success',
            message: `Vision OCR 처리 완료: ${(typeof ocrResult?.text === 'string' ? ocrResult.text.length : 0)}자`,
            timestamp: new Date().toISOString(),
            duration: `${visionTime.toFixed(2)}초`
          });
          
          const ocrText = typeof ocrResult?.text === 'string' ? ocrResult.text : '';
          const ocrEffectiveLen = effectiveTextLength(ocrText);
          const currentEffectiveLen = effectiveTextLength(result.text || '');

          if (ocrEffectiveLen > 0) {
            result.ocrSource = 'vision';
            if (isScannedPdf || currentEffectiveLen === 0 || ocrEffectiveLen > currentEffectiveLen) {
              result.text = ocrText;
            }
          }
          if (ocrResult.rawFiles) {
            result.ocrRawFiles = ocrResult.rawFiles;
            result.ocrRawPrefix = ocrResult.rawPrefix;
          }
          if (typeof ocrResult.pageCount === 'number') {
            result.pageCount = ocrResult.pageCount;
          }
          if (Array.isArray(ocrResult.pages)) {
            result.pages = ocrResult.pages;
          }
          if (Array.isArray(ocrResult.blocks)) {
            result.blocks = ocrResult.blocks;
          }
        } catch (visionError) {
          let fallback = null;
          const allowVisionImageFallback = options.enableVisionImageFallback === true || process.env.ENABLE_VISION_IMAGE_FALLBACK === 'true';
          if (allowVisionImageFallback) {
            try {
              const fallbackStart = new Date();
              fallback = await visionService.processPdfFileViaImages(tempFilePath, { pageCount: result.pageCount || 1 });
              const fallbackEnd = new Date();
              const fallbackTime = (fallbackEnd - fallbackStart) / 1000;
              const fallbackText = typeof fallback?.text === 'string' ? fallback.text : '';
              if (effectiveTextLength(fallbackText) > 0) {
                ocrResult = fallback;
                result.steps.push({
                  step: 'vision_ocr_image_fallback',
                  status: 'success',
                  message: `Vision OCR(image) 처리 완료: ${fallbackText.length}자`,
                  timestamp: new Date().toISOString(),
                  duration: `${fallbackTime.toFixed(2)}초`
                });
                result.ocrSource = 'vision';
                const currentEffectiveLen = effectiveTextLength(result.text || '');
                const fallbackEffectiveLen = effectiveTextLength(fallbackText);
                if (isScannedPdf || currentEffectiveLen === 0 || fallbackEffectiveLen > currentEffectiveLen) {
                  result.text = fallbackText;
                }
                if (typeof fallback?.pageCount === 'number') {
                  result.pageCount = fallback.pageCount;
                }
                if (Array.isArray(fallback?.pages)) {
                  result.pages = fallback.pages;
                }
              }
            } catch {
            }
          }

          result.steps.push({
            step: 'vision_ocr',
            status: 'failed',
            message: `Vision OCR 처리 실패: ${visionError.message}`,
            timestamp: new Date().toISOString(),
            error: visionError.message
          });
          
          // Vision 실패 시 Textract 시도
          if (useTextract) {
            logService.warn(`[pdfProcessor] Vision OCR 실패, Textract 시도: ${visionError.message}`);
          }
        }
      }
      
      // Vision이 없거나 실패했을 때만 Textract 시도
      if (useTextract && (!ocrResult || !result.ocrSource)) {
        try {
          const textractStartTime = new Date();
          // ocrResult = await textractService.processPdfFile(tempFilePath);
        ocrResult = { success: false, error: 'Textract 비활성화됨' };
          const textractEndTime = new Date();
          const textractTime = (textractEndTime - textractStartTime) / 1000;
          
          result.steps.push({
            step: 'textract_ocr',
            status: 'success',
            message: `Textract OCR 처리 완료: ${ocrResult.text.length}자`,
            timestamp: new Date().toISOString(),
            duration: `${textractTime.toFixed(2)}초`
          });
          
          // OCR 결과 저장
          result.text = ocrResult.text;
          result.ocrSource = 'textract';
        } catch (textractError) {
          result.steps.push({
            step: 'textract_ocr',
            status: 'failed',
            message: `Textract OCR 처리 실패: ${textractError.message}`,
            timestamp: new Date().toISOString(),
            error: textractError.message
          });
        }
      }

      const allowLocalOcr = options.useLocalOcr !== undefined ? options.useLocalOcr : process.env.ENABLE_LOCAL_OCR !== 'false';
      const currentEffectiveLen = effectiveTextLength(result.text || '');
      const localOcrMinEffectiveLen = Number(process.env.LOCAL_OCR_MIN_EFFECTIVE_LEN || 32);
      if (allowLocalOcr && (!result.ocrSource || currentEffectiveLen < localOcrMinEffectiveLen)) {
        try {
          const localStartTime = new Date();
          const local = await runLocalOcrOnPdf(tempFilePath, result.pageCount || 1, {
            lang: process.env.LOCAL_OCR_LANG,
            maxPages: options.maxOcrPages
          });
          const localEndTime = new Date();
          const localTime = (localEndTime - localStartTime) / 1000;

          const localText = typeof local?.text === 'string' ? local.text : '';
          const localEffectiveLen = effectiveTextLength(localText);
          if (localEffectiveLen > 0) {
            result.steps.push({
              step: 'local_ocr',
              status: 'success',
              message: `Local OCR 처리 완료: ${localText.length}자`,
              timestamp: new Date().toISOString(),
              duration: `${localTime.toFixed(2)}초`
            });
            result.ocrSource = 'local_tesseract';
            result.text = localText;
            if (typeof local?.pageCount === 'number') {
              result.pageCount = local.pageCount;
            }
            if (Array.isArray(local?.pages)) {
              result.pages = local.pages;
            }
          } else {
            result.steps.push({
              step: 'local_ocr',
              status: 'failed',
              message: 'Local OCR 결과가 비어 있습니다.',
              timestamp: new Date().toISOString()
            });
          }
        } catch (localError) {
          result.steps.push({
            step: 'local_ocr',
            status: 'failed',
            message: `Local OCR 처리 실패: ${localError.message}`,
            timestamp: new Date().toISOString(),
            error: localError.message
          });
        }
      }
    }
    
    if (options.collectBlocks === true && (!Array.isArray(result.blocks) || result.blocks.length === 0)) {
      const syntheticBlocks = buildSyntheticBlocksFromText(result.text, result.pageCount);
      if (syntheticBlocks.length > 0) {
        result.blocks = syntheticBlocks;
        result.blocksSource = 'synthetic_pdf_parse';
      }
    }
    
    // 6. 결과 정리 및 반환
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 1000;
    
    result.success = true;
    result.endTime = endTime.toISOString();
    result.processingTime = `${totalTime.toFixed(2)}초`;
    result.textLength = result.text ? result.text.length : 0;
    
    // 사용된 방법 기록
    if (result.ocrSource) {
      result.textSource = isScannedPdf ? 'ocr_only' : 'pdf_parse_with_ocr';
    } else {
      result.textSource = 'pdf_parse_only';
    }
    
    return result;
  } catch (error) {
    // 처리 중 오류 발생 시
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 1000;
    
    logService.error(`[pdfProcessor] PDF 처리 실패: ${error.message}`);
    
    result.success = false;
    result.endTime = endTime.toISOString();
    result.processingTime = `${totalTime.toFixed(2)}초`;
    result.error = error.message;
    result.errorDetail = error.stack;
    
    // 임시 파일 정리
    if (options.cleanupTemp && tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        result.steps.push({
          step: 'temp_file_cleanup',
          status: 'success',
          message: `임시 파일 삭제됨: ${tempFilePath}`,
          timestamp: new Date().toISOString()
        });
      } catch (cleanupError) {
        result.steps.push({
          step: 'temp_file_cleanup',
          status: 'failed',
          message: `임시 파일 삭제 실패: ${cleanupError.message}`,
          timestamp: new Date().toISOString(),
          error: cleanupError.message
        });
      }
    }
    
    return result;
  } finally {
    // 정리 작업
    if (options.cleanupTemp && tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        result.steps.push({
          step: 'temp_file_cleanup',
          status: 'success',
          message: `임시 파일 삭제됨: ${tempFilePath}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // 정리 오류는 무시
      }
    }
  }
}

async function runLocalOcrOnPdf(pdfFilePath, pageCount, options = {}) {
  const langRaw = typeof options.lang === 'string' && options.lang.trim().length > 0 ? options.lang.trim() : (process.env.LOCAL_OCR_LANG || 'kor+eng');
  const maxPagesRaw = options.maxPages;
  const maxPages = typeof maxPagesRaw === 'number' && Number.isFinite(maxPagesRaw) && maxPagesRaw > 0 ? Math.floor(maxPagesRaw) : null;
  const totalPages = typeof pageCount === 'number' && Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 1;
  const pagesToProcess = maxPages ? Math.min(totalPages, maxPages) : totalPages;

  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker();
  try {
    await worker.loadLanguage(langRaw);
    await worker.initialize(langRaw);

    const pages = [];
    const texts = [];

    const renderWithSharp = async () => {
      for (let page = 1; page <= pagesToProcess; page += 1) {
        const buf = await sharp(pdfFilePath, { density: 150, page: page - 1 }).png().toBuffer();
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          pages.push({ page, text: '' });
          continue;
        }
        const rec = await worker.recognize(buf);
        const text = typeof rec?.data?.text === 'string' ? rec.data.text : '';
        pages.push({ page, text });
        texts.push(text);
      }
    };

    const renderWithPdf2pic = async () => {
      const { fromPath } = await import('pdf2pic');
      const savePath = path.join(path.resolve(TEMP_DIR), `pdf2pic-${uuidv4()}`);
      fs.mkdirSync(savePath, { recursive: true });
      try {
        const convert = fromPath(pdfFilePath, {
          density: 150,
          format: 'png',
          preserveAspectRatio: true,
          savePath,
          saveFilename: 'page'
        });

        for (let page = 1; page <= pagesToProcess; page += 1) {
          const converted = await convert(page, { responseType: 'buffer' });
          const buf = Buffer.isBuffer(converted) ? converted : converted?.buffer;
          if (!Buffer.isBuffer(buf) || buf.length === 0) {
            pages.push({ page, text: '' });
            continue;
          }
          const rec = await worker.recognize(buf);
          const text = typeof rec?.data?.text === 'string' ? rec.data.text : '';
          pages.push({ page, text });
          texts.push(text);
        }
      } finally {
        try {
          fs.rmSync(savePath, { recursive: true, force: true });
        } catch {
        }
      }
    };

    try {
      await renderWithSharp();
    } catch (sharpError) {
      try {
        await renderWithPdf2pic();
      } catch (pdf2picError) {
        const msg = [sharpError?.message, pdf2picError?.message].filter(Boolean).join(' | ') || 'local_ocr_render_failed';
        throw new Error(msg);
      }
    }

    const merged = texts.join('\n\n').trim();
    return { success: merged.length > 0, text: merged, pageCount: pagesToProcess, pages, ocrSource: 'local_tesseract', textLength: merged.length };
  } finally {
    await worker.terminate();
  }
}

function buildSyntheticBlocksFromText(text, pageCount) {
  const raw = typeof text === 'string' ? text : '';
  const pc = typeof pageCount === 'number' && Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const perPage = Math.ceil(lines.length / pc);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const page = Math.floor(i / perPage) + 1;
    const lineIndex = i % perPage;
    blocks.push({
      page,
      blockIndex: lineIndex,
      text: lines[i],
      bbox: { xMin: 0, yMin: lineIndex, xMax: 1, yMax: lineIndex + 1, width: 1, height: 1 },
      vertices: [],
      confidence: undefined,
      synthetic: true
    });
  }
  return blocks;
}

/**
 * PDF 파일 무결성 검증 함수
 * @param {Buffer} pdfBuffer - PDF 파일 버퍼
 * @param {Object} result - 결과 객체 (참조로 업데이트)
 */
async function validatePdfIntegrity(pdfBuffer, result) {
  try {
    // 버퍼 검증
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF 버퍼가 비어 있습니다. (stream must have data)');
    }
    
    // 최소 파일 크기 검증
    if (pdfBuffer.length < 100) {
      throw new Error(`PDF 파일이 너무 작습니다 (${pdfBuffer.length} 바이트). 손상된 파일일 수 있습니다.`);
    }
    
    // PDF 시그니처 확인
    const signature = pdfBuffer.slice(0, 4).toString();
    if (signature !== '%PDF') {
      throw new Error('유효한 PDF 파일이 아닙니다. PDF 시그니처가 없습니다.');
    }
    
    // 암호화 확인
    const pdfContent = pdfBuffer.toString('utf8', 0, Math.min(2000, pdfBuffer.length));
    if (pdfContent.includes('/Encrypt') && pdfContent.includes('/Filter')) {
      throw new Error('암호화된 PDF 파일입니다. 암호를 해제한 후 다시 시도해주세요.');
    }
    
    result.steps.push({
      step: 'integrity_check',
      status: 'success',
      message: `파일 무결성 검증 완료: ${(pdfBuffer.length / 1024).toFixed(2)} KB`,
      timestamp: new Date().toISOString(),
      fileSize: pdfBuffer.length
    });
  } catch (error) {
    result.steps.push({
      step: 'integrity_check',
      status: 'failed',
      message: `파일 무결성 검증 실패: ${error.message}`,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    throw error;
  }
}

/**
 * PDF 텍스트를 추출하는 간편 헬퍼 함수
 * @param {Buffer|string} pdfInput - PDF 파일 버퍼 또는 경로
 * @param {Object} options - 옵션
 * @returns {Promise<string>} 추출된 텍스트
 */
export async function extractTextFromPdf(pdfInput, options = {}) {
  const result = await processPdf(pdfInput, options);
  
  if (!result.success) {
    throw new Error(`텍스트 추출 실패: ${result.error}`);
  }
  
  return result.text || '';
}

export default {
  processPdf,
  extractTextFromPdf
}; 
