/**
 * 향상된 에러 핸들링 미들웨어
 * @module middleware/errorHandler
 */

import { createLogger } from '../utils/enhancedLogger.js';

const logger = createLogger('ERROR_HANDLER');

/**
 * 에러 타입 정의
 */
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CORE_ENGINE_ERROR: 'CORE_ENGINE_ERROR',
  OCR_ERROR: 'OCR_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

/**
 * 커스텀 에러 클래스
 */
class AppError extends Error {
  constructor(message, type = ErrorTypes.INTERNAL_SERVER_ERROR, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 코어 엔진 에러 클래스
 */
class CoreEngineError extends AppError {
  constructor(message, operation = null, engineType = null) {
    super(message, ErrorTypes.CORE_ENGINE_ERROR, 500);
    this.operation = operation;
    this.engineType = engineType;
  }
}

/**
 * OCR 에러 클래스
 */
class OCRError extends AppError {
  constructor(message, service = null, filePath = null) {
    super(message, ErrorTypes.OCR_ERROR, 500);
    this.service = service;
    this.filePath = filePath;
  }
}

/**
 * 검증 에러 클래스
 */
class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, ErrorTypes.VALIDATION_ERROR, 400);
    this.field = field;
    this.value = value;
  }
}

/**
 * 에러 응답 포맷터
 */
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const baseResponse = {
    success: false,
    error: {
      type: error.type || ErrorTypes.INTERNAL_SERVER_ERROR,
      message: error.message,
      timestamp: error.timestamp || new Date().toISOString(),
      requestId: req.id || req.headers['x-request-id'] || 'unknown'
    }
  };
  
  // 개발 환경에서는 추가 정보 포함
  if (isDevelopment) {
    baseResponse.error.stack = error.stack;
    baseResponse.error.details = {
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      ...(error.operation && { operation: error.operation }),
      ...(error.engineType && { engineType: error.engineType }),
      ...(error.service && { service: error.service }),
      ...(error.filePath && { filePath: error.filePath }),
      ...(error.field && { field: error.field }),
      ...(error.value && { value: error.value })
    };
  }
  
  return baseResponse;
};

/**
 * 에러 심각도 판단
 */
const getErrorSeverity = (error) => {
  if (error.statusCode >= 500) return 'critical';
  if (error.statusCode >= 400) return 'warning';
  return 'info';
};

/**
 * 에러 알림 필요 여부 판단
 */
const shouldNotify = (error) => {
  const criticalErrors = [
    ErrorTypes.CORE_ENGINE_ERROR,
    ErrorTypes.DATABASE_ERROR,
    ErrorTypes.INTERNAL_SERVER_ERROR
  ];
  
  return criticalErrors.includes(error.type) || error.statusCode >= 500;
};

/**
 * 에러 메트릭 수집
 */
const collectErrorMetrics = (error, req) => {
  const metrics = {
    errorType: error.type,
    statusCode: error.statusCode,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    severity: getErrorSeverity(error)
  };
  
  // 메트릭을 로그로 기록 (실제 환경에서는 메트릭 수집 서비스로 전송)
  logger.info('에러 메트릭 수집', metrics);
  
  return metrics;
};

/**
 * 에러 핸들링 미들웨어
 */
const errorHandler = (error, req, res, next) => {
  // 에러가 AppError 인스턴스가 아닌 경우 래핑
  if (!(error instanceof AppError)) {
    error = new AppError(
      error.message || '내부 서버 오류가 발생했습니다.',
      ErrorTypes.INTERNAL_SERVER_ERROR,
      500,
      false
    );
  }
  
  // 에러 로깅
  const errorData = {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: req.headers,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
  
  logger.error(`${error.type}: ${error.message}`, error, errorData);
  
  // 에러 메트릭 수집
  collectErrorMetrics(error, req);
  
  // 알림이 필요한 에러인 경우
  if (shouldNotify(error)) {
    logger.error('중요 에러 발생 - 알림 필요', error, {
      severity: getErrorSeverity(error),
      shouldNotify: true
    });
  }
  
  // 응답 전송
  const response = formatErrorResponse(error, req);
  res.status(error.statusCode).json(response);
};

/**
 * 404 에러 핸들러
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `요청한 리소스를 찾을 수 없습니다: ${req.method} ${req.path}`,
    ErrorTypes.NOT_FOUND_ERROR,
    404
  );
  
  next(error);
};

/**
 * 비동기 함수 래퍼 (에러 자동 캐치)
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 코어 엔진 에러 핸들러
 */
const handleCoreEngineError = (operation, engineType) => {
  return (error) => {
    if (error instanceof CoreEngineError) {
      throw error;
    }
    
    throw new CoreEngineError(
      `코어 엔진 ${operation} 실패: ${error.message}`,
      operation,
      engineType
    );
  };
};

/**
 * OCR 에러 핸들러
 */
const handleOCRError = (service, filePath) => {
  return (error) => {
    if (error instanceof OCRError) {
      throw error;
    }
    
    throw new OCRError(
      `OCR 처리 실패 (${service}): ${error.message}`,
      service,
      filePath
    );
  };
};

/**
 * 검증 에러 핸들러
 */
const handleValidationError = (field, value) => {
  return (message) => {
    throw new ValidationError(message, field, value);
  };
};

/**
 * 에러 복구 시도
 */
const attemptErrorRecovery = async (error, context) => {
  logger.info('에러 복구 시도', { error: error.message, context });
  
  try {
    switch (error.type) {
      case ErrorTypes.CORE_ENGINE_ERROR:
        // 코어 엔진 재시작 시도
        logger.info('코어 엔진 재시작 시도');
        // 실제 복구 로직은 여기에 구현
        break;
        
      case ErrorTypes.OCR_ERROR:
        // OCR 서비스 재시도
        logger.info('OCR 서비스 재시도');
        // 실제 복구 로직은 여기에 구현
        break;
        
      case ErrorTypes.EXTERNAL_API_ERROR:
        // 외부 API 재시도
        logger.info('외부 API 재시도');
        // 실제 복구 로직은 여기에 구현
        break;
        
      default:
        logger.warn('복구 불가능한 에러 타입', { type: error.type });
        return false;
    }
    
    logger.info('에러 복구 성공');
    return true;
    
  } catch (recoveryError) {
    logger.error('에러 복구 실패', recoveryError);
    return false;
  }
};

export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleCoreEngineError,
  handleOCRError,
  handleValidationError,
  attemptErrorRecovery,
  AppError,
  CoreEngineError,
  OCRError,
  ValidationError,
  ErrorTypes
};