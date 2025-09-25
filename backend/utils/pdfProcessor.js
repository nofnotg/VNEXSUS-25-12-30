/**
 * 통합 PDF 프로세서 유틸리티
 * PDF 무결성 검증, pdf-parse, OCR 처리 흐름의
 * 전체 End-to-End 로직을 구현한 스캐폴딩 모듈
 * @module utils/pdfProcessor
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
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
    
    // 2. 파일 무결성 검증
    await validatePdfIntegrity(pdfBuffer, result);
    
    // 3. 임시 파일 저장 (필요한 경우)
    if (options.saveTemp || (!options.skipOcr && (options.useVision || options.useTextract))) {
      const tempDir = path.resolve(TEMP_DIR);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = options.fileName || `temp-${uuidv4()}.pdf`;
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
        pagerender: () => Promise.resolve(), // 렌더링 생략
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
    } catch (pdfError) {
      // pdf-parse 에러 발생 - 특정 에러 유형 확인
      logService('pdfProcessor', `PDF 파싱 실패: ${pdfError.message}`, 'error');
      
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
    
    if ((shouldUseOcr || options.forceOcr) && !options.skipOcr) {
      // 임시 파일이 필요함을 확인
      if (!tempFilePath) {
        const tempDir = path.resolve(TEMP_DIR);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const fileName = options.fileName || `temp-${uuidv4()}.pdf`;
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
          const visionEndTime = new Date();
          const visionTime = (visionEndTime - visionStartTime) / 1000;
          
          result.steps.push({
            step: 'vision_ocr',
            status: 'success',
            message: `Vision OCR 처리 완료: ${ocrResult.text.length}자`,
            timestamp: new Date().toISOString(),
            duration: `${visionTime.toFixed(2)}초`
          });
          
          // 기존 텍스트보다 OCR 결과가 더 많으면 대체
          if (!result.text || ocrResult.text.length > result.text.length) {
            result.text = ocrResult.text;
            result.ocrSource = 'vision';
          }
        } catch (visionError) {
          result.steps.push({
            step: 'vision_ocr',
            status: 'failed',
            message: `Vision OCR 처리 실패: ${visionError.message}`,
            timestamp: new Date().toISOString(),
            error: visionError.message
          });
          
          // Vision 실패 시 Textract 시도
          if (useTextract) {
            logService('pdfProcessor', `Vision OCR 실패, Textract 시도: ${visionError.message}`, 'warn');
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
    
    logService('pdfProcessor', `PDF 처리 실패: ${error.message}`, 'error');
    
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