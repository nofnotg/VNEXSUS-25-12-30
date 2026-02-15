/**
 * OCR 컨트롤러
 * PDF 파일 업로드 및 텍스트 추출 API 처리
 * @module controllers/ocrController
 */
import { v4 as uuidv4 } from 'uuid';
import * as pdfAnalyzer from '../services/pdfAnalyzer.js';
// import * as textractService from '../services/textractService.js';
import * as visionService from '../services/visionService.js';
import * as gcsService from '../services/gcsService.js';
import * as ocrMerger from '../services/ocrMerger.js';
import * as fileHelper from '../utils/fileHelper.js';
import { logService } from '../utils/logger.js';
import pdfProcessor from '../utils/pdfProcessor.js';
import coreEngineService from '../services/coreEngineService.js';
import postProcessingManager from '../postprocess/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// 진행 중인 작업 추적을 위한 메모리 저장소
export const jobStore = {};

// 임시 디렉토리 경로
const TEMP_DIR = process.env.TEMP_DIR || '../temp';

/**
 * PDF 파일 업로드 및 OCR 처리 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const uploadPdfs = async (req, res) => {
  try {
    console.log('=== 업로드 요청 시작 ===');
    console.log('파일 수:', req.files ? req.files.length : 0);
    console.log('요청 헤더:', req.headers);

    logService.info(`업로드 요청 시작 - 파일 수: ${req.files ? req.files.length : 0}`);

    // CORS 헤더 추가
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');

    // 파일이 없는 경우 에러 반환
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: '업로드할 파일이 없습니다.',
        status: 'error',
        code: 'NO_FILES'
      });
    }

    // 최대 파일 수 제한 확인
    const maxFiles = parseInt(process.env.MAX_FILES) || 8;
    if (req.files.length > maxFiles) {
      return res.status(400).json({
        error: `최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`,
        status: 'error',
        code: 'TOO_MANY_FILES',
        filesReceived: req.files.length,
        maxAllowed: maxFiles
      });
    }

    // 지원되는 파일 형식 확인
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'];
    const invalidFiles = req.files.filter(file => !allowedMimeTypes.includes(file.mimetype));
    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'PDF, PNG, JPG, JPEG, TXT 파일만 업로드 가능합니다.',
        status: 'error',
        code: 'INVALID_FILE_TYPE',
        invalidFiles: invalidFiles.map(f => f.originalname)
      });
    }

    // 파일 무결성 검증 - 파일 사이즈가 0인 파일 체크
    const emptyFiles = req.files.filter(file => file.size === 0);
    if (emptyFiles.length > 0) {
      return res.status(400).json({
        error: '빈 파일이 포함되어 있습니다.',
        status: 'error',
        code: 'EMPTY_FILES',
        emptyFiles: emptyFiles.map(f => f.originalname)
      });
    }

    // 최소 파일 크기 검증 (텍스트 파일은 더 작은 크기 허용)
    const minFileSize = 10; // 바이트 (텍스트 파일 고려하여 축소)
    const tooSmallFiles = req.files.filter(file => file.size < minFileSize);
    if (tooSmallFiles.length > 0) {
      return res.status(400).json({
        error: '손상된 파일이 포함되어 있습니다.',
        status: 'error',
        code: 'CORRUPT_FILES',
        corruptFiles: tooSmallFiles.map(f => ({ name: f.originalname, size: f.size }))
      });
    }

    // 작업 ID 생성 및 상태 초기화
    const jobId = uuidv4();
    const files = req.files;

    // 작업 상태 초기화
    jobStore[jobId] = {
      status: 'processing',
      filesTotal: files.length,
      filesProcessed: 0,
      results: {},
      startTime: new Date().toISOString()
    };

    // 비동기 처리 시작 (응답은 먼저 보냄)
    res.status(202).json({
      jobId,
      message: '파일 분석 작업이 시작되었습니다.',
      status: 'processing',
      statusUrl: `/api/ocr/status/${jobId}`,
      resultUrl: `/api/ocr/result/${jobId}`
    });

    // 각 파일 처리 (비동기)
    logService.info(`processFiles 함수 호출 시작 - jobId: ${jobId}, 파일 수: ${files.length}`);
    processFiles(jobId, files).catch(error => {
      logService.error(`파일 처리 중 예상치 못한 오류: ${error.message}`);
      if (jobStore[jobId]) {
        jobStore[jobId].status = 'failed';
        jobStore[jobId].error = '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.';
        jobStore[jobId].errorDetail = error.message;
      }
    });

  } catch (error) {
    logService.error(`업로드 처리 중 오류: ${error.message}`);
    logService.error(`오류 스택: ${error.stack}`);
    res.status(500).json({
      error: '파일 업로드 중 서버 오류: ' + error.message,
      status: 'error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getInvestigatorView = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }
    const job = jobStore[jobId];
    if (job.status !== 'completed') {
      return res.status(202).json({
        message: '처리 중입니다. 나중에 다시 시도해주세요.',
        status: job.status,
        progress: `${job.filesProcessed}/${job.filesTotal}`,
        elapsedTime: getElapsedTime(job.startTime)
      });
    }
    const texts = Object.values(job.results || {})
      .map(r => r.mergedText || '')
      .filter(t => t && t.length > 0);
    const combinedText = texts.join('\n\n');
    const coreEngine = typeof coreEngineService === 'function' ? new coreEngineService() : coreEngineService;
    const analyzeResult = await coreEngine.analyze({
      text: combinedText,
      options: { jobId }
    });
    const view = analyzeResult?.skeletonJson?.investigatorView;
    if (!view) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }
    return res.json({
      success: true,
      data: view
    });
  } catch (error) {
    logService.error(`조사자 뷰 생성 중 오류: ${error.message}`);
    return res.status(500).json({
      error: '조사자 뷰 생성 중 오류가 발생했습니다.',
      status: 'error',
      code: 'INVESTIGATOR_VIEW_ERROR',
      message: error.message
    });
  }
};

/**
 * OCR 작업 상태 확인 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const getStatus = (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }

    // 상태 정보만 반환 (결과 데이터 제외)
    const { results, ...statusInfo } = jobStore[jobId];
    res.json({
      jobId,
      ...statusInfo,
      elapsedTime: getElapsedTime(statusInfo.startTime)
    });
  } catch (error) {
    logService.error(`상태 확인 중 오류: ${error.message}`);
    res.status(500).json({
      error: '상태 확인 중 오류가 발생했습니다.',
      status: 'error',
      code: 'STATUS_ERROR',
      message: error.message
    });
  }
};

/**
 * OCR 작업 결과 조회 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const getResult = (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }

    const job = jobStore[jobId];

    if (job.status !== 'completed') {
      return res.status(202).json({
        message: '처리 중입니다. 나중에 다시 시도해주세요.',
        status: job.status,
        progress: `${job.filesProcessed}/${job.filesTotal}`,
        elapsedTime: getElapsedTime(job.startTime)
      });
    }

    // 형식 타입 체크 (JSON 또는 텍스트)
    const format = req.query.format || 'json';

    if (format === 'text') {
      // 텍스트 형식으로 반환
      let allText = '';
      Object.entries(job.results).forEach(([fileId, fileData]) => {
        allText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
        allText += fileData.mergedText;
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ocr-result-${jobId}.txt"`);
      return res.send(allText);
    }

    // 기본 JSON 반환 (후처리 결과 포함)
    res.json({
      jobId,
      status: 'completed',
      completedAt: job.completedAt,
      elapsedTime: getElapsedTime(job.startTime, job.completedAt),
      fileCount: job.filesTotal,
      results: job.results,
      // 후처리 파이프라인 결과
      postProcessing: job.postProcessing || null,
      medicalEvents: job.postProcessing?.medicalEvents || [],
      disclosureReport: job.postProcessing?.disclosureReport || null
    });
  } catch (error) {
    logService.error(`결과 조회 중 오류: ${error.message}`);
    res.status(500).json({
      error: '결과 조회 중 오류가 발생했습니다.',
      status: 'error',
      code: 'RESULT_ERROR',
      message: error.message
    });
  }
};

/**
 * OCR 서비스 상태 확인 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const getOcrStatus = async (req, res) => {
  try {
    // 각 OCR 서비스 상태 확인
    const visionStatus = await visionService.getServiceStatus();
    // const textractStatus = await textractService.getServiceStatus();
    const textractStatus = { success: false, message: 'Textract 비활성화' };
    const localEnabled = process.env.ENABLE_LOCAL_OCR !== 'false';

    res.json({
      services: {
        vision: visionStatus,
        textract: textractStatus,
        local: {
          service: 'LOCAL_TESSERACT',
          available: localEnabled,
          enabled: localEnabled,
          lang: process.env.LOCAL_OCR_LANG || 'kor+eng'
        }
      },
      activeServices: [
        ...(visionStatus.available ? ['vision'] : []),
        ...(textractStatus.available ? ['textract'] : []),
        ...(localEnabled ? ['local_tesseract'] : [])
      ],
      canProcessFiles: visionStatus.available || textractStatus.available || localEnabled
    });
  } catch (error) {
    logService.error(`OCR 서비스 상태 확인 중 오류: ${error.message}`);
    res.status(500).json({
      error: 'OCR 서비스 상태 확인 중 오류가 발생했습니다.',
      status: 'error',
      message: error.message
    });
  }
};

/**
 * 파일 처리 (OCR 및 텍스트 추출)
 * @param {string} jobId - 작업 ID
 * @param {Array} files - 업로드된 파일 배열 (PDF, PNG, JPG, JPEG)
 */
async function processFiles(jobId, files) {
  try {
    logService.info(`파일 처리 시작 (총 ${files.length}개 파일)`, { jobId });

    // OCR 설정 로깅
    const offlineMode = process.env.OFFLINE_MODE === 'true';
    const useTextract = !offlineMode && process.env.USE_TEXTRACT === 'true';
    const useVision = !offlineMode && process.env.USE_VISION !== 'false';
    const enableVisionOcr = !offlineMode && process.env.ENABLE_VISION_OCR === 'true';

    // 작업 데이터 초기화
    const jobData = jobStore[jobId];
    jobData.status = 'processing';
    jobData.filesTotal = files.length;
    jobData.filesProcessed = 0;
    jobData.startedAt = new Date().toISOString();

    // 임시 디렉토리 확인 및 생성
    const tempDir = path.resolve(TEMP_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 각 파일 처리
    for (let i = 0; i < files.length; i++) {
      const fileStartTime = new Date();
      const file = files[i];
      const fileId = `file_${i + 1}`;
      let tempFilePath = null;

      try {
        logService.info(`파일 처리 중: ${file.originalname} (${i + 1}/${files.length})`, {
          jobId,
          fileSize: `${(file.size / 1024).toFixed(2)} KB`,
          mimeType: file.mimetype
        });

        // 1. 임시 파일로 저장
        tempFilePath = path.join(tempDir, `${uuidv4()}_${file.originalname}`);
        fs.writeFileSync(tempFilePath, file.buffer);

        // 2. 파일 형식에 따른 처리
        let processorResult;

        if (file.mimetype === 'application/pdf') {
          // PDF 파일 처리
          const processorOptions = {
            useVision,
            useTextract,
            forceOcr: enableVisionOcr && isScannablePdf(file.originalname),
            cleanupTemp: true,
            fileName: path.basename(tempFilePath)
          };

          processorResult = await pdfProcessor.processPdf(file.buffer, processorOptions);

          if (!processorResult.success) {
            throw new Error(processorResult.error || 'PDF 처리에 실패했습니다.');
          }
        } else if (file.mimetype.startsWith('image/')) {
          try {
            if (useVision && enableVisionOcr) {
              const ocrResult = await visionService.extractTextFromImage(file.buffer);
              processorResult = {
                success: true,
                text: ocrResult.text || '',
                textLength: ocrResult.text ? ocrResult.text.length : 0,
                pageCount: 1,
                isScannedPdf: false,
                textSource: 'vision_ocr',
                ocrSource: 'google_vision',
                steps: ['image_upload', 'vision_ocr'],
                confidence: ocrResult.confidence || 0
              };
            } else {
              const { createWorker } = await import('tesseract.js');
              const worker = await createWorker();
              try {
                const langRaw = typeof process.env.LOCAL_OCR_LANG === 'string' && process.env.LOCAL_OCR_LANG.trim().length > 0 ? process.env.LOCAL_OCR_LANG.trim() : 'kor+eng';
                await worker.loadLanguage(langRaw);
                await worker.initialize(langRaw);
                const rec = await worker.recognize(file.buffer);
                const text = (typeof rec?.data?.text === 'string' ? rec.data.text : '').trim();
                processorResult = {
                  success: true,
                  text,
                  textLength: text.length,
                  pageCount: 1,
                  isScannedPdf: false,
                  textSource: 'local_ocr',
                  ocrSource: 'local_tesseract_image',
                  steps: ['image_upload', 'local_tesseract_ocr'],
                  confidence: typeof rec?.data?.confidence === 'number' ? rec.data.confidence : 0
                };
              } finally {
                await worker.terminate();
              }
            }
          } catch (error) {
            throw new Error(`이미지 OCR 처리에 실패했습니다: ${error.message}`);
          }
        } else if (file.mimetype === 'text/plain') {
          // 텍스트 파일 처리 (직접 읽기)
          try {
            const textContent = file.buffer.toString('utf-8');

            processorResult = {
              success: true,
              text: textContent,
              textLength: textContent.length,
              pageCount: 1,
              isScannedPdf: false,
              textSource: 'direct_text',
              ocrSource: 'text_file',
              steps: ['text_file_read'],
              confidence: 1.0
            };
          } catch (error) {
            throw new Error(`텍스트 파일 처리에 실패했습니다: ${error.message}`);
          }
        } else {
          throw new Error(`지원되지 않는 파일 형식입니다: ${file.mimetype}`);
        }

        // 3. 결과 저장
        const fileEndTime = new Date();
        const fileProcessingTime = (fileEndTime - fileStartTime) / 1000;

        jobData.results[fileId] = {
          filename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          pageCount: processorResult.pageCount || 0,
          isScannedPdf: processorResult.isScannedPdf || false,
          processingSteps: processorResult.steps,
          textSource: processorResult.textSource,
          ocrSource: processorResult.ocrSource,
          mergedText: processorResult.text || '',
          textLength: processorResult.textLength || 0,
          ocrRawFiles: processorResult.ocrRawFiles || [],
          ocrRawPrefix: processorResult.ocrRawPrefix || null,
          processingTime: `${fileProcessingTime.toFixed(2)}초`,
          processedAt: new Date().toISOString()
        };

        logService.info(`파일 처리 완료: ${file.originalname}`, {
          jobId,
          processingTime: `${fileProcessingTime.toFixed(2)}초`,
          textSource: processorResult.textSource,
          textLength: processorResult.textLength || 0
        });

        // 4. 진행 상황 업데이트
        jobData.filesProcessed++;

      } catch (fileError) {
        // 개별 파일 처리 실패 시 오류 기록하고 다음 파일로 진행
        const fileEndTime = new Date();
        const fileProcessingTime = (fileEndTime - fileStartTime) / 1000;

        logService.error(`파일 처리 실패: ${files[i].originalname} - ${fileError.message}`, {
          jobId,
          processingTime: `${fileProcessingTime.toFixed(2)}초`,
          error: fileError.stack
        });

        // 에러 유형에 따른 사용자 친화적인 메시지
        let userErrorMessage = fileError.message;
        if (fileError.message.includes('stream must have data')) {
          userErrorMessage = 'PDF 파일이 손상되었거나 비어 있습니다.';
        } else if (fileError.message.includes('password') || fileError.message.includes('encrypted')) {
          userErrorMessage = '암호화된 PDF 파일입니다. 암호를 해제한 후 다시 시도해주세요.';
        } else if (fileError.message.includes('xfa form') || fileError.message.includes('XFA')) {
          userErrorMessage = 'XFA 기반 PDF 양식은 지원되지 않습니다.';
        }

        jobData.results[`file_${i + 1}`] = {
          filename: files[i].originalname,
          fileSize: files[i].size,
          mimeType: files[i].mimetype,
          error: true,
          errorMessage: userErrorMessage,
          errorDetail: fileError.message,
          processingTime: `${fileProcessingTime.toFixed(2)}초`,
          processedAt: new Date().toISOString()
        };

        // 임시 파일 정리
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
            logService.info(`임시 파일 삭제 완료: ${tempFilePath}`, { jobId });
          } catch (unlinkError) {
            logService.error(`임시 파일 삭제 실패: ${unlinkError.message}`, { jobId });
          }
        }

        jobData.filesProcessed++;
      }
    }

    // 모든 파일 처리 완료 - 후처리 파이프라인 실행
    logService.info(`OCR 처리 완료, 후처리 파이프라인 시작`, { jobId });
    
    try {
      // 모든 추출된 텍스트를 합침
      const allTexts = Object.values(jobData.results)
        .filter(r => !r.error && r.mergedText)
        .map(r => r.mergedText);
      
      if (allTexts.length > 0) {
        const combinedText = allTexts.join('\n\n');
        
        // 후처리 파이프라인 실행
        const postProcessResult = await postProcessingManager.processOCRResult(combinedText, {
          patientInfo: {},
          reportFormat: 'json',
          useAIExtraction: false // 규칙 기반 처리만 사용 (LLM 비용 절감)
        });
        
        if (postProcessResult.success) {
          // 후처리 결과 저장
          jobData.postProcessing = {
            success: true,
            medicalEvents: postProcessResult.pipeline.medicalEvents || [],
            disclosureReport: postProcessResult.pipeline.disclosureReport || null,
            safeModeResult: postProcessResult.pipeline.safeModeResult || null,
            statistics: postProcessResult.statistics || {},
            processingTime: postProcessResult.processingTime
          };
          
          logService.info(`후처리 파이프라인 완료`, {
            jobId,
            eventsCount: postProcessResult.pipeline.medicalEvents?.length || 0,
            coreEvents: postProcessResult.statistics?.coreEvents || 0,
            criticalEvents: postProcessResult.statistics?.criticalEvents || 0
          });
        } else {
          logService.warn(`후처리 파이프라인 실패: ${postProcessResult.error}`, { jobId });
          jobData.postProcessing = {
            success: false,
            error: postProcessResult.error || '후처리 실패'
          };
        }
      } else {
        logService.warn(`후처리 스킵: 추출된 텍스트 없음`, { jobId });
        jobData.postProcessing = {
          success: false,
          error: '추출된 텍스트가 없습니다.'
        };
      }
    } catch (postProcessError) {
      logService.error(`후처리 파이프라인 오류: ${postProcessError.message}`, { jobId });
      jobData.postProcessing = {
        success: false,
        error: postProcessError.message
      };
    }
    
    jobData.status = 'completed';
    jobData.completedAt = new Date().toISOString();

    logService.info(`모든 PDF 처리 완료 (${files.length}개 파일)`, {
      jobId,
      elapsedTime: getElapsedTime(jobData.startTime, jobData.completedAt)
    });

  } catch (error) {
    // 전체 처리 실패 시
    logService.error(`PDF 처리 중 오류 발생`, { jobId, error: error.message, stack: error.stack });

    if (jobStore[jobId]) {
      jobStore[jobId].status = 'failed';
      jobStore[jobId].error = error.message;
      jobStore[jobId].completedAt = new Date().toISOString();
    }

    throw error;
  }
}

/**
 * 파일명을 기반으로 OCR이 필요한 스캔된 PDF를 추정
 * @param {string} filename - 파일명
 * @returns {boolean} - OCR 필요 여부
 */
function isScannablePdf(filename) {
  const lowerFilename = filename.toLowerCase();
  const scanKeywords = ['scan', '스캔', 'scanned', '스캔본', '진단서', '소견서', '처방전', '검사결과'];

  return scanKeywords.some(keyword => lowerFilename.includes(keyword));
}

/**
 * 경과 시간 계산
 * @param {string} startTime - 시작 시간 (ISO 문자열)
 * @param {string} endTime - 종료 시간 (ISO 문자열, 없으면 현재 시간)
 * @returns {string} 경과 시간 문자열
 */
function getElapsedTime(startTime, endTime) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diff = Math.round((end - start) / 1000); // 초 단위

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  } else if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  } else {
    return `${seconds}초`;
  }
}

export const getRawFiles = (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !jobStore[jobId]) {
      return res.status(404).json({
        error: '존재하지 않는 작업 ID입니다.',
        status: 'error',
        code: 'JOB_NOT_FOUND'
      });
    }
    const job = jobStore[jobId];
    const files = Object.entries(job.results || {}).map(([fileId, fileData]) => ({
      fileId,
      filename: fileData.filename,
      rawFiles: fileData.ocrRawFiles || [],
      rawPrefix: fileData.ocrRawPrefix || null
    }));
    res.json({ jobId, files });
  } catch (error) {
    res.status(500).json({
      error: '원시 파일 목록 조회 중 오류가 발생했습니다.',
      status: 'error',
      code: 'RAW_LIST_ERROR',
      message: error.message
    });
  }
};

export const getRawContent = async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({
        error: 'path 쿼리 파라미터가 필요합니다.',
        status: 'error',
        code: 'MISSING_PATH'
      });
    }
    const json = await gcsService.downloadAndParseJson(filePath);
    res.json(json);
  } catch (error) {
    res.status(500).json({
      error: '원시 파일 조회 중 오류가 발생했습니다.',
      status: 'error',
      code: 'RAW_FETCH_ERROR',
      message: error.message
    });
  }
};

export const getRawBlocks = async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({
        error: 'path 쿼리 파라미터가 필요합니다.',
        status: 'error',
        code: 'MISSING_PATH'
      });
    }
    const json = await gcsService.downloadAndParseJson(filePath);
    const blocks = visionService.extractBlocksFromJson(json);
    res.json({ count: blocks.length, blocks });
  } catch (error) {
    res.status(500).json({
      error: '블록 조회 중 오류가 발생했습니다.',
      status: 'error',
      code: 'BLOCKS_FETCH_ERROR',
      message: error.message
    });
  }
};

export default {
  uploadPdfs,
  getStatus,
  getResult,
  getOcrStatus,
  getInvestigatorView,
  getRawFiles,
  getRawContent,
  getRawBlocks
};
