/**
 * 공통 미들웨어
 * 프로젝트 규칙: 보안, 검증, 로깅 미들웨어 중앙화
 */

import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger';
import { SYSTEM_CONFIG } from '../constants/medical';

/**
 * CORS 미들웨어
 */
export const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-ID'],
  credentials: true,
  maxAge: 86400 // 24시간
});

/**
 * Rate Limiting 미들웨어
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: SYSTEM_CONFIG.RATE_LIMIT.WINDOW_MS,
  max: SYSTEM_CONFIG.RATE_LIMIT.MAX_REQUESTS,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const traceId = req.headers['x-trace-id'] as string || uuidv4();
    
    logger.warn({
      event: 'rate_limit_exceeded',
      traceId,
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      }
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
      },
      metadata: {
        retryAfter: Math.ceil(SYSTEM_CONFIG.RATE_LIMIT.WINDOW_MS / 1000),
        traceId
      }
    });
  }
});

/**
 * 요청 검증 미들웨어
 */
export const requestValidationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const traceId = req.headers['x-trace-id'] as string || uuidv4();
  
  // Trace ID를 요청 객체에 추가
  (req as any).traceId = traceId;

  // Content-Type 검증 (POST 요청의 경우)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn({
        event: 'invalid_content_type',
        traceId,
        metadata: {
          contentType,
          method: req.method,
          endpoint: req.path
        }
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type은 application/json이어야 합니다.'
        },
        metadata: { traceId }
      });
      return;
    }
  }

  // 요청 크기 검증
  const contentLength = parseInt(req.get('Content-Length') || '0');
  if (contentLength > SYSTEM_CONFIG.MAX_REQUEST_SIZE) {
    logger.warn({
      event: 'request_too_large',
      traceId,
      metadata: {
        contentLength,
        maxSize: SYSTEM_CONFIG.MAX_REQUEST_SIZE,
        endpoint: req.path
      }
    });

    res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: `요청 크기가 너무 큽니다. 최대 ${SYSTEM_CONFIG.MAX_REQUEST_SIZE} bytes까지 허용됩니다.`
      },
      metadata: { traceId }
    });
    return;
  }

  next();
};

/**
 * 에러 핸들링 미들웨어
 */
export const errorHandlingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const traceId = (req as any).traceId || uuidv4();

  logger.error({
    event: 'unhandled_error',
    traceId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    metadata: {
      method: req.method,
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });

  // 개발 환경에서는 스택 트레이스 포함
  const errorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.'
    },
    metadata: {
      traceId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  };

  res.status(500).json(errorResponse);
};

/**
 * 404 핸들링 미들웨어
 */
export const notFoundMiddleware = (req: Request, res: Response): void => {
  const traceId = uuidv4();

  logger.warn({
    event: 'endpoint_not_found',
    traceId,
    metadata: {
      method: req.method,
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: '요청한 엔드포인트를 찾을 수 없습니다.'
    },
    metadata: { traceId }
  });
};

/**
 * 보안 헤더 미들웨어
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 보안 헤더 설정
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HTTPS 강제 (프로덕션 환경)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * 요청 로깅 미들웨어
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const traceId = (req as any).traceId || uuidv4();
  const startTime = Date.now();

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const processingTime = Date.now() - startTime;
    
    logger.info({
      event: 'api_request_completed',
      traceId,
      metadata: {
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        processingTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: req.get('Content-Length') || '0'
      }
    });
  });

  next();
};
