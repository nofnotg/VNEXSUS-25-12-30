/**
 * 향상된 OCR 컨트롤러 (코어 엔진 통합)
 * 기존 OCR 기능 + 코어 엔진 분석 기능
 * @module controllers/enhancedOcrController
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { v4: uuidv4 } = require('uuid');
const pdfAnalyzer = require('../services/pdfAnalyzer.js');
const visionService = require('../services/visionService.js');
const ocrMerger = require('../services/ocrMerger.js');
const fileHelper = require('../utils/fileHelper.js');
const { logService } = require('../utils/logger.js');
const pdfProcessor = require('../utils/pdfProcessor.js');
const coreEngineService = require('../services/coreEngineService.js');

const { globalMemoryOptimizer } = require('../utils/memoryOptimizer.js');
const fs = require('fs');
const path = require('path');

// 진행 중인 작업 추적
const enhancedJobStore = {};

/**
 * 향상된 PDF 업로드 및 OCR + 코어 엔진 처리
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const uploadPdfsEnhanced = async (req, res) => {
  const jobId = uuidv4();
  
  try {
    // CORS 헤더
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 파일 검증
    if (!req.files || req.files.length === 0) {
      logger.warn('업로드 요청에 파일이 없음', { jobId });
      return res.status(400).json({ 
        error: '업로드할 파일이 없습니다.',
        status: 'error',
        code: 'NO_FILES',
        jobId
      });
    }

    logger.info('파일 업로드 처리 시작', { 
      jobId, 
      fileCount: req.files.length,
      files: req.files.map(f => f.originalname)
    });

    // 메타데이터 추출 (코어 엔진용)
    const metadata = extractMetadata(req.body);
    
    // 메모리 최적화 - 대용량 파일 처리 전 메모리 체크
    globalMemoryOptimizer.checkMemoryUsage();
    
    // 작업 초기화
    enhancedJobStore[jobId] = {
      status: 'processing',
      progress: 0,
      files: req.files.map(f => f.originalname),
      metadata,
      startTime: new Date(),
      coreEngineEnabled: coreEngineService.isActive()
    };

    logger.info(`Enhanced OCR job started: ${jobId}, Core Engine: ${coreEngineService.isActive()}`);

    // 비동기 처리 시작
    processEnhancedOcr(jobId, req.files, metadata).catch(error => {
      logger.error(`Enhanced OCR job ${jobId} failed:`, error);
      enhancedJobStore[jobId] = {
        ...enhancedJobStore[jobId],
        status: 'error',
        error: error.message,
        endTime: new Date()
      };
    });

    // 즉시 응답 반환
    res.json({
      message: '파일 업로드가 완료되었습니다. 처리를 시작합니다.',
      jobId,
      status: 'processing',
      coreEngineEnabled: coreEngineService.isActive(),
      metadata: metadata.contractDate ? 'included' : 'not_provided',
      estimatedTime: `${req.files.length * 30}초`
    });

  } catch (error) {
    logService.error('Enhanced OCR upload error:', error);
    res.status(500).json({
      error: '파일 업로드 중 오류가 발생했습니다.',
      details: error.message,
      jobId,
      status: 'error'
    });
  }
};

/**
 * 향상된 OCR 작업 상태 확인
 */
export const getEnhancedJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || !enhancedJobStore[jobId]) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.',
        jobId,
        status: 'not_found'
      });
    }

    const job = enhancedJobStore[jobId];
    
    res.json({
      jobId,
      status: job.status,
      progress: job.progress,
      coreEngineEnabled: job.coreEngineEnabled,
      files: job.files,
      metadata: job.metadata ? 'present' : 'none',
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime,
      error: job.error
    });

  } catch (error) {
    logService.error('Get enhanced job status error:', error);
    res.status(500).json({
      error: '작업 상태 확인 중 오류가 발생했습니다.',
      details: error.message
    });
  }
};

/**
 * 향상된 OCR 결과 조회
 */
export const getEnhancedJobResult = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || !enhancedJobStore[jobId]) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.',
        jobId
      });
    }

    const job = enhancedJobStore[jobId];
    
    if (job.status !== 'completed') {
      return res.status(202).json({
        message: '작업이 아직 완료되지 않았습니다.',
        jobId,
        status: job.status,
        progress: job.progress
      });
    }

    // 결과 반환
    res.json({
      jobId,
      status: 'completed',
      result: job.result,
      coreEngineResult: job.coreEngineResult,
      processingTime: job.endTime - job.startTime,
      timestamp: job.endTime
    });

  } catch (error) {
    logService.error('Get enhanced job result error:', error);
    res.status(500).json({
      error: '결과 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
};

/**
 * 비동기 향상된 OCR 처리
 */
async function processEnhancedOcr(jobId, files, metadata) {
  try {
    const job = enhancedJobStore[jobId];
    
    // 1. 기본 OCR 처리
    job.progress = 10;
    logService.info(`Job ${jobId}: Starting basic OCR processing`);
    
    const ocrResults = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 파일별 OCR 처리
      const result = await processFileOcr(file);
      ocrResults.push(result);
      
      job.progress = 10 + (i + 1) / files.length * 40; // 10-50%
    }

    // 2. OCR 결과 병합
    job.progress = 60;
    logService.info(`Job ${jobId}: Merging OCR results`);
    
    const mergedResult = await ocrMerger.mergeResults(ocrResults);
    
    // 3. 코어 엔진 처리 (활성화된 경우)
    let coreEngineResult = null;
    if (coreEngineService.isActive()) {
      job.progress = 70;
      logService.info(`Job ${jobId}: Running core engine analysis`);
      
      coreEngineResult = await runCoreEngineAnalysis(mergedResult, metadata);
      job.progress = 90;
    }

    // 4. 최종 결과 구성
    job.progress = 95;
    const finalResult = buildFinalResult(mergedResult, coreEngineResult, metadata);
    
    // 5. 작업 완료
    job.progress = 100;
    job.status = 'completed';
    job.result = finalResult;
    job.coreEngineResult = coreEngineResult;
    job.endTime = new Date();
    
    // 메모리 최적화 - 처리 완료 후 메모리 정리
    globalMemoryOptimizer.forceGarbageCollection();
    
    logService.info(`Job ${jobId}: Enhanced OCR processing completed`);

  } catch (error) {
    logService.error(`Job ${jobId}: Enhanced OCR processing failed:`, error);
    enhancedJobStore[jobId].status = 'error';
    enhancedJobStore[jobId].error = error.message;
    enhancedJobStore[jobId].endTime = new Date();
    throw error;
  }
}

/**
 * 개별 파일 OCR 처리
 */
async function processFileOcr(file) {
  try {
    // 기존 OCR 로직 사용
    const tempPath = path.join(process.env.TEMP_DIR || '../temp', file.filename);
    
    // Vision API 사용
    if (process.env.USE_VISION === 'true') {
      return await visionService.processDocument(tempPath);
    }
    
    // PDF 분석기 사용 (폴백)
    return await pdfAnalyzer.analyzePdf(tempPath);
    
  } catch (error) {
    logService.error('File OCR processing error:', error);
    return {
      filename: file.originalname,
      error: error.message,
      text: '',
      pages: []
    };
  }
}

/**
 * 코어 엔진 분석 실행 (Progressive RAG 통합)
 */
async function runCoreEngineAnalysis(ocrResult, metadata) {
  try {
    // OCR 결과를 레코드 형태로 변환
    const records = convertOcrToRecords(ocrResult);
    
    // Progressive RAG 활성화 옵션 추가
    const coreEngineOptions = {
      contractDate: metadata.contractDate,
      records,
      claimDiagnosis: metadata.claimDiagnosis,
      disclosureWindows: metadata.disclosureWindows,
      systemPrompt: buildSystemPrompt(metadata),
      userPrompt: buildUserPrompt(ocrResult, metadata),
      // Progressive RAG 통합 옵션
      enableProgressiveRAG: metadata.enableProgressiveRAG || false,
      ragOptions: {
        maxResults: 10,
        confidenceThreshold: 0.7,
        includeContext: true,
        includeICDCodes: true
      }
    };

    // 코어 엔진 통합 파이프라인 실행
    const coreResult = await coreEngineService.runIntegratedPipeline(coreEngineOptions);

    return coreResult;

  } catch (error) {
    logService.error('Core engine analysis error:', error);
    return {
      coreEngineUsed: true,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 메타데이터 추출 (Progressive RAG 옵션 포함)
 */
function extractMetadata(body) {
  return {
    contractDate: body.contractDate || null,
    claimDiagnosis: body.claimDiagnosis || '',
    disclosureWindows: body.disclosureWindows ? 
      body.disclosureWindows.split(',').map(w => w.trim()) : 
      ['3m', '2y', '5y'],
    patientName: body.patientName || '',
    patientDob: body.patientDob || '',
    reportType: body.reportType || 'standard',
    // Progressive RAG 관련 옵션
    enableProgressiveRAG: body.enableProgressiveRAG === 'true' || body.enableProgressiveRAG === true,
    ragMaxResults: parseInt(body.ragMaxResults) || 10,
    ragConfidenceThreshold: parseFloat(body.ragConfidenceThreshold) || 0.7
  };
}

/**
 * OCR 결과를 레코드 형태로 변환
 */
function convertOcrToRecords(ocrResult) {
  const records = [];
  
  if (ocrResult.pages) {
    ocrResult.pages.forEach((page, pageIndex) => {
      if (page.text) {
        // 페이지별로 레코드 생성
        records.push({
          date: extractDateFromText(page.text),
          text: page.text,
          source: `Page ${pageIndex + 1}`,
          pageNumber: pageIndex + 1
        });
      }
    });
  }
  
  return records;
}

/**
 * 텍스트에서 날짜 추출 (간단한 버전)
 */
function extractDateFromText(text) {
  const datePattern = /\b(20\d{2}[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01]))\b/;
  const match = text.match(datePattern);
  return match ? match[0] : '';
}

/**
 * 시스템 프롬프트 구성
 */
function buildSystemPrompt(metadata) {
  return `당신은 의료 문서 분석 전문 AI입니다. 
손해사정 보고서를 작성하기 위해 의료 기록을 분석하고 정리합니다.
환자 정보: ${metadata.patientName || '미제공'}
청구 진단: ${metadata.claimDiagnosis || '미제공'}
보고서 유형: ${metadata.reportType}`;
}

/**
 * 사용자 프롬프트 구성
 */
function buildUserPrompt(ocrResult, metadata) {
  return `다음 의료 문서를 분석하여 손해사정 보고서를 작성해주세요:

${ocrResult.text || '텍스트 추출 실패'}

계약일: ${metadata.contractDate || '미제공'}
청구 진단: ${metadata.claimDiagnosis || '미제공'}

위 정보를 바탕으로 상세한 의료 분석 보고서를 작성해주세요.`;
}

/**
 * 최종 결과 구성
 */
function buildFinalResult(ocrResult, coreEngineResult, metadata) {
  const result = {
    ocr: ocrResult,
    metadata,
    timestamp: new Date().toISOString(),
    processingMode: coreEngineService.isActive() ? 'enhanced' : 'standard'
  };

  if (coreEngineResult) {
    result.coreEngine = coreEngineResult;
    
    // 코어 엔진 결과가 있으면 요약 정보 추가
    if (coreEngineResult.disclosure) {
      result.summary = {
        disclosureStatus: coreEngineResult.disclosure.windows.map(w => ({
          window: w.window,
          status: w.status,
          evidenceCount: w.evidence.length
        })),
        classification: coreEngineResult.classification?.classificationLine,
        reportGenerated: !!coreEngineResult.report
      };
    }
  }

  return result;
}