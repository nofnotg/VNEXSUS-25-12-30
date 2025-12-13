/**
 * Post-processing API Routes
 * 
 * 후처리 관련 API 엔드포인트
 */

import express from 'express';
import reportController from '../controllers/reportController.js';
import { logger, logApiRequest, logApiResponse, logProcessingStart, logProcessingComplete, logProcessingError } from '../shared/logging/logger.js';
import { validateReportRequest, validateReportResponse } from '../modules/reports/types/structuredOutput.js';
import { ERRORS } from '../shared/constants/errors.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * 보고서 생성 엔드포인트
 * POST /api/postprocess/report
 * 
 * Request Body:
 * {
 *   jobId: string,              // 작업 ID
 *   parsedEvents: Array,        // 파싱된 이벤트 배열
 *   patientInfo: Object,        // 환자 정보 (옵션)
 *   insuranceInfo: Object,      // 보험 정보 (옵션)
 *   filterResult: Object        // 필터링 결과 (옵션)
 * }
 * 
 * Response:
 * {
 *   success: boolean,           // 성공 여부
 *   reportPath: string,         // 보고서 파일 경로 (성공 시)
 *   error: string,              // 오류 메시지 (실패 시)
 *   stats: {                    // 통계 정보
 *     total: number,            // 총 이벤트 수
 *     filtered: number,         // 필터링된 이벤트 수
 *     ...
 *   }
 * }
 */
router.post('/report', async (req, res) => {
  const start = Date.now();
  try {
    // 요청 로깅 (마스킹 적용)
    logApiRequest(req, { route: '/api/postprocess/report' });

    // Zod 스키마 기반 요청 검증
    const parsed = validateReportRequest(req.body);
    if (!parsed.success) {
      logProcessingError('report_generation', new Error('request_schema_invalid'), {
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message, code: i.code })),
        route: 'postprocess_report',
      });
      const duration = Date.now() - start;
      logApiResponse(req, res, duration, { success: false, error: ERRORS.INVALID_REQUEST_SCHEMA.code });
      return res.status(ERRORS.INVALID_REQUEST_SCHEMA.status).json({
        success: false,
        error: ERRORS.INVALID_REQUEST_SCHEMA.message,
        details: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    const { jobId, parsedEvents, patientInfo, insuranceInfo, filterResult, options } = parsed.data;

    // 처리 시작 로깅
    logProcessingStart('report_generation', {
      jobId,
      eventCount: parsedEvents.length,
      minConfidence: options?.minConfidence,
    });

    // 보고서 컨트롤러 호출
    const result = await reportController.generateReport({
      jobId,
      parsedEvents,
      patientInfo,
      insuranceInfo,
      filterResult,
      options,
    });

    const duration = Date.now() - start;

    // 응답 스키마 검증
    const respParsed = validateReportResponse(result);
    if (!respParsed.success) {
      logProcessingError('report_generation', new Error('response_schema_invalid'), {
        issues: respParsed.error.issues.map(i => ({ path: i.path, message: i.message, code: i.code })),
        route: 'postprocess_report',
      });
      logApiResponse(req, res, duration, { success: false, error: ERRORS.INVALID_RESPONSE_SCHEMA.code });
      return res.status(ERRORS.INVALID_RESPONSE_SCHEMA.status).json({
        success: false,
        error: ERRORS.INVALID_RESPONSE_SCHEMA.message,
        details: respParsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    // 처리 완료 로깅
    logProcessingComplete('report_generation', duration, {
      success: result.success,
      eventCount: result?.stats?.total ?? parsedEvents.length,
      filtered: result?.stats?.filtered ?? 0,
    });

    // 결과 반환 및 응답 로깅
    if (result.success) {
      logApiResponse(req, res, duration, { success: true, reportPath: result.reportPath });
      res.json(result);
    } else {
      logApiResponse(req, res, duration, { success: false, error: result.error || ERRORS.INTERNAL_ERROR.code });
      res.status(result.error ? 500 : ERRORS.INTERNAL_ERROR.status).json(result.error ? result : { success: false, error: ERRORS.INTERNAL_ERROR.message });
    }
  } catch (error) {
    const duration = Date.now() - start;
    logProcessingError('report_generation', error, { route: 'postprocess_report' });
    logApiResponse(req, res, duration, { success: false, error: ERRORS.INTERNAL_ERROR.code });
    res.status(ERRORS.INTERNAL_ERROR.status).json({
      success: false,
      error: error.message || ERRORS.INTERNAL_ERROR.message,
    });
  }
});

/**
 * 보고서 다운로드 엔드포인트
 * GET /api/postprocess/report/:jobId/:filename
 * 
 * 생성된 보고서 파일 다운로드
 */
router.get('/report/:jobId/:filename', (req, res) => {
  const start = Date.now();
  try {
    logApiRequest(req, { route: '/api/postprocess/report/:jobId/:filename' });
    const { jobId, filename } = req.params;
    
    // 파일 경로 생성
    const filepath = path.resolve(process.cwd(), 'outputs', jobId, filename);
    
    // 파일 존재 여부 확인
    if (!fs.existsSync(filepath)) {
      const duration = Date.now() - start;
      logApiResponse(req, res, duration, { success: false, error: ERRORS.REPORT_DOWNLOAD_NOT_FOUND.code });
      return res.status(ERRORS.REPORT_DOWNLOAD_NOT_FOUND.status).json({
        success: false,
        error: ERRORS.REPORT_DOWNLOAD_NOT_FOUND.message,
      });
    }
    
    // 파일 다운로드 응답
    res.download(filepath, filename, (err) => {
      const duration = Date.now() - start;
      if (err) {
        logProcessingError('report_download', err, { jobId, filename });
        logApiResponse(req, res, duration, { success: false, error: ERRORS.REPORT_DOWNLOAD_ERROR.code });
        res.status(ERRORS.REPORT_DOWNLOAD_ERROR.status).json({
          success: false,
          error: ERRORS.REPORT_DOWNLOAD_ERROR.message,
        });
      } else {
        logApiResponse(req, res, duration, { success: true, filename });
      }
    });
  } catch (error) {
    const duration = Date.now() - start;
    logProcessingError('report_download', error, { route: 'postprocess_report_download' });
    logApiResponse(req, res, duration, { success: false, error: ERRORS.INTERNAL_ERROR.code });
    res.status(ERRORS.INTERNAL_ERROR.status).json({
      success: false,
      error: error.message || ERRORS.INTERNAL_ERROR.message,
    });
  }
});

export default router; 
