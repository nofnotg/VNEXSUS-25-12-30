/**
 * 고급 날짜 분석 컨트롤러
 * 
 * API 요청/응답 처리 및 입력 검증
 */

import { z } from 'zod';
import { 
  AdvancedDateRequest, 
  BatchDateRequest, 
  ERROR_CODES 
} from '../types/index.js';
import { 
  advancedDateService 
} from '../service/advancedDateService.js';
import { logger } from '../../../shared/logging/logger.js';
import { mask } from '../../../shared/security/mask.js';

/**
 * 단일 텍스트 날짜 추출
 */
export const extractDates = async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 입력 검증
    const validatedData = AdvancedDateRequest.parse(req.body);
    
    logger.info({
      event: 'api_request_start',
      endpoint: '/api/v2/medical-analysis/advanced-date/extract',
      requestId,
      method: 'POST',
      textLength: validatedData.text.length,
      options: validatedData.options
    });

    // 서비스 호출
    const result = await advancedDateService.extractDates(
      validatedData.text, 
      validatedData.options
    );

    const processingTime = Date.now() - startTime;

    logger.info({
      event: 'api_request_success',
      requestId,
      processingTime,
      datesFound: result.dates.length,
      confidence: result.metadata.confidence
    });

    res.json({
      success: true,
      data: result,
      metadata: {
        requestId,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.warn({
        event: 'validation_error',
        requestId,
        processingTime,
        errors: error.errors,
        body: mask(JSON.stringify(req.body))
      });

      return res.status(400).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: '입력 데이터가 올바르지 않습니다.',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        metadata: {
          requestId,
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    logger.error({
      event: 'api_request_error',
      requestId,
      processingTime,
      error: error.message,
      stack: error.stack,
      body: mask(JSON.stringify(req.body))
    });

    res.status(500).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: '서버 내부 오류가 발생했습니다.',
      metadata: {
        requestId,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * 배치 날짜 추출
 */
export const extractDatesBatch = async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 입력 검증
    const validatedData = BatchDateRequest.parse(req.body);
    
    logger.info({
      event: 'batch_request_start',
      endpoint: '/api/v2/medical-analysis/advanced-date/extract/batch',
      requestId,
      method: 'POST',
      batchSize: validatedData.texts.length,
      options: validatedData.options
    });

    // 서비스 호출
    const results = await advancedDateService.extractDatesBatch(
      validatedData.texts, 
      validatedData.options
    );

    const processingTime = Date.now() - startTime;
    const totalDatesFound = results.reduce((sum, result) => sum + result.dates.length, 0);

    logger.info({
      event: 'batch_request_success',
      requestId,
      processingTime,
      batchSize: results.length,
      totalDatesFound,
      averageConfidence: results.reduce((sum, r) => sum + r.metadata.confidence, 0) / results.length
    });

    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalTexts: results.length,
          totalDatesFound,
          averageProcessingTime: processingTime / results.length,
          averageConfidence: results.reduce((sum, r) => sum + r.metadata.confidence, 0) / results.length
        }
      },
      metadata: {
        requestId,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.warn({
        event: 'batch_validation_error',
        requestId,
        processingTime,
        errors: error.errors,
        body: mask(JSON.stringify(req.body))
      });

      return res.status(400).json({
        success: false,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: '배치 입력 데이터가 올바르지 않습니다.',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        metadata: {
          requestId,
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    logger.error({
      event: 'batch_request_error',
      requestId,
      processingTime,
      error: error.message,
      stack: error.stack,
      body: mask(JSON.stringify(req.body))
    });

    res.status(500).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: '배치 처리 중 서버 오류가 발생했습니다.',
      metadata: {
        requestId,
        processingTime,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * 헬스체크
 */
export const healthCheck = async (req, res) => {
  const requestId = req.headers['x-request-id'] || `health_${Date.now()}`;
  
  try {
    const healthData = {
      status: 'healthy',
      service: 'advanced-date-analysis',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      environment: process.env.NODE_ENV || 'development'
    };

    logger.info({
      event: 'health_check',
      requestId,
      status: 'healthy',
      memory: healthData.memory
    });

    res.json({
      success: true,
      data: healthData,
      metadata: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error({
      event: 'health_check_error',
      requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: '헬스체크 실패',
      metadata: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });
  }
};