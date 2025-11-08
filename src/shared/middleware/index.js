/**
 * 공유 미들웨어 모음
 * 
 * Express 애플리케이션에서 사용되는 공통 미들웨어들을 정의
 */

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from '../logging/logger.js';
import { mask } from '../security/mask.js';
import { ERROR_CODES } from '../../modules/medical-analysis/types/index.js';

// CORS 미들웨어
export const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// 기본 Rate Limiting 미들웨어
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: {
    success: false,
    error: ERROR_CODES.RATE_LIMIT_ERROR,
    message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      event: 'rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: ERROR_CODES.RATE_LIMIT_ERROR,
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// 요청 검증 미들웨어 팩토리
export const requestValidationMiddleware = (schema) => {
  return (req, res, next) => {
    try {
      const validationResult = schema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn({
          event: 'validation_failed',
          path: req.path,
          method: req.method,
          errors: errors,
          body: mask(JSON.stringify(req.body))
        });

        return res.status(400).json({
          success: false,
          error: ERROR_CODES.VALIDATION_ERROR,
          message: '입력 데이터가 올바르지 않습니다.',
          details: errors,
          metadata: {
            timestamp: new Date().toISOString()
          }
        });
      }

      req.validatedBody = validationResult.data;
      next();
    } catch (error) {
      logger.error({
        event: 'validation_middleware_error',
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: ERROR_CODES.INTERNAL_ERROR,
        message: '요청 처리 중 오류가 발생했습니다.',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

// 보안 헤더 미들웨어
export const securityHeadersMiddleware = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // 의료 데이터 보호를 위한 추가 헤더
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  
  next();
};

// 요청 로깅 미들웨어
export const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  req.startTime = startTime;

  // 요청 로깅
  logger.info({
    event: 'request_start',
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });

  // 응답 완료 시 로깅
  const originalSend = res.send;
  res.send = function(data) {
    const processingTime = Date.now() - startTime;
    
    logger.info({
      event: 'request_complete',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      processingTime,
      responseSize: data ? data.length : 0,
      timestamp: new Date().toISOString()
    });

    return originalSend.call(this, data);
  };

  next();
};

// 에러 처리 미들웨어
export const errorHandlingMiddleware = (error, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  const processingTime = req.startTime ? Date.now() - req.startTime : 0;

  // 에러 로깅
  logger.error({
    event: 'request_error',
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    processingTime,
    timestamp: new Date().toISOString()
  });

  // 에러 타입별 처리
  let statusCode = 500;
  let errorCode = ERROR_CODES.INTERNAL_ERROR;
  let message = '서버 내부 오류가 발생했습니다.';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = '입력 데이터가 올바르지 않습니다.';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
    message = '인증이 필요합니다.';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = ERROR_CODES.AUTHORIZATION_ERROR;
    message = '접근 권한이 없습니다.';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = ERROR_CODES.NOT_FOUND_ERROR;
    message = '요청한 리소스를 찾을 수 없습니다.';
  } else if (error.name === 'TimeoutError') {
    statusCode = 408;
    errorCode = ERROR_CODES.TIMEOUT_ERROR;
    message = '요청 처리 시간이 초과되었습니다.';
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    metadata: {
      requestId,
      processingTime,
      timestamp: new Date().toISOString()
    },
    ...(process.env.NODE_ENV === 'development' && {
      details: {
        stack: error.stack,
        originalMessage: error.message
      }
    })
  });
};

// 404 처리 미들웨어
export const notFoundMiddleware = (req, res) => {
  const requestId = req.requestId || 'unknown';
  
  logger.warn({
    event: 'route_not_found',
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(404).json({
    success: false,
    error: ERROR_CODES.NOT_FOUND_ERROR,
    message: '존재하지 않는 API 경로입니다.',
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /api/health',
        'POST /api/v2/medical-analysis/advanced-date/extract',
        'POST /api/v2/medical-analysis/advanced-date/extract/batch',
        'GET /api/v2/medical-analysis/advanced-date/health'
      ]
    }
  });
};