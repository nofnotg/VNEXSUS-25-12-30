/**
 * Error Handler for Medical Document Date Extraction System
 * Phase 2 Error Handling Enhancement
 */

class ErrorHandler {
  constructor() {
    this.version = '2.0.0';
    this.errorLog = [];
    this.errorStats = {
      total: 0,
      byType: {},
      byModule: {},
      critical: 0,
      warning: 0,
      info: 0
    };
    
    // 에러 타입 정의
    this.errorTypes = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      PROCESSING_ERROR: 'PROCESSING_ERROR',
      MEMORY_ERROR: 'MEMORY_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      DATA_ERROR: 'DATA_ERROR',
      SYSTEM_ERROR: 'SYSTEM_ERROR',
      CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
    };
    
    // 에러 심각도 레벨
    this.severityLevels = {
      CRITICAL: 'CRITICAL',
      ERROR: 'ERROR',
      WARNING: 'WARNING',
      INFO: 'INFO'
    };
  }

  /**
   * 에러 처리 메인 메서드
   */
  handleError(error, context = {}) {
    try {
      const errorInfo = this.analyzeError(error, context);
      this.logError(errorInfo);
      this.updateStats(errorInfo);
      
      // 심각도에 따른 처리
      switch (errorInfo.severity) {
        case this.severityLevels.CRITICAL:
          return this.handleCriticalError(errorInfo);
        case this.severityLevels.ERROR:
          return this.handleRegularError(errorInfo);
        case this.severityLevels.WARNING:
          return this.handleWarning(errorInfo);
        case this.severityLevels.INFO:
          return this.handleInfo(errorInfo);
        default:
          return this.handleUnknownError(errorInfo);
      }
    } catch (handlingError) {
      // 에러 핸들러 자체에서 에러 발생 시
      console.error('❌ Error Handler 자체에서 에러 발생:', handlingError);
      return this.createFallbackResponse(error, handlingError);
    }
  }

  /**
   * 에러 분석
   */
  analyzeError(error, context) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      type: this.determineErrorType(error),
      severity: this.determineSeverity(error, context),
      module: context.module || 'unknown',
      function: context.function || 'unknown',
      input: context.input || null,
      context: {
        ...context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
        timestamp: Date.now(),
        memoryUsage: this.getMemoryUsage()
      },
      originalError: error
    };
    
    // 추가 분석
    errorInfo.isRecoverable = this.isRecoverableError(error);
    errorInfo.suggestedAction = this.suggestAction(errorInfo);
    errorInfo.retryable = this.isRetryableError(error);
    
    return errorInfo;
  }

  /**
   * 에러 타입 결정
   */
  determineErrorType(error) {
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';
    
    if (message.includes('validation') || message.includes('invalid')) {
      return this.errorTypes.VALIDATION_ERROR;
    }
    if (message.includes('timeout') || name.includes('timeout')) {
      return this.errorTypes.TIMEOUT_ERROR;
    }
    if (message.includes('memory') || name.includes('memory')) {
      return this.errorTypes.MEMORY_ERROR;
    }
    if (message.includes('data') || message.includes('parse')) {
      return this.errorTypes.DATA_ERROR;
    }
    if (message.includes('config') || message.includes('setting')) {
      return this.errorTypes.CONFIGURATION_ERROR;
    }
    if (name.includes('system') || message.includes('system')) {
      return this.errorTypes.SYSTEM_ERROR;
    }
    
    return this.errorTypes.PROCESSING_ERROR;
  }

  /**
   * 심각도 결정
   */
  determineSeverity(error, context) {
    const message = error.message?.toLowerCase() || '';
    const type = this.determineErrorType(error);
    
    // Critical 조건
    if (type === this.errorTypes.SYSTEM_ERROR ||
        type === this.errorTypes.MEMORY_ERROR ||
        message.includes('critical') ||
        message.includes('fatal')) {
      return this.severityLevels.CRITICAL;
    }
    
    // Warning 조건
    if (type === this.errorTypes.VALIDATION_ERROR ||
        message.includes('warning') ||
        message.includes('deprecated')) {
      return this.severityLevels.WARNING;
    }
    
    // Info 조건
    if (message.includes('info') ||
        message.includes('notice')) {
      return this.severityLevels.INFO;
    }
    
    // 기본값은 ERROR
    return this.severityLevels.ERROR;
  }

  /**
   * 복구 가능한 에러인지 확인
   */
  isRecoverableError(error) {
    const recoverableTypes = [
      this.errorTypes.VALIDATION_ERROR,
      this.errorTypes.DATA_ERROR,
      this.errorTypes.TIMEOUT_ERROR
    ];
    
    const type = this.determineErrorType(error);
    return recoverableTypes.includes(type);
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  isRetryableError(error) {
    const retryableTypes = [
      this.errorTypes.TIMEOUT_ERROR,
      this.errorTypes.PROCESSING_ERROR
    ];
    
    const type = this.determineErrorType(error);
    const message = error.message?.toLowerCase() || '';
    
    return retryableTypes.includes(type) || 
           message.includes('network') ||
           message.includes('connection');
  }

  /**
   * 액션 제안
   */
  suggestAction(errorInfo) {
    switch (errorInfo.type) {
      case this.errorTypes.VALIDATION_ERROR:
        return '입력 데이터를 확인하고 유효성 검사를 통과하는지 검증하세요.';
      case this.errorTypes.MEMORY_ERROR:
        return '메모리 사용량을 확인하고 불필요한 캐시를 정리하세요.';
      case this.errorTypes.TIMEOUT_ERROR:
        return '처리 시간을 늘리거나 데이터를 작은 단위로 분할하세요.';
      case this.errorTypes.DATA_ERROR:
        return '입력 데이터 형식과 구조를 확인하세요.';
      case this.errorTypes.CONFIGURATION_ERROR:
        return '설정 파일과 환경 변수를 확인하세요.';
      default:
        return '로그를 확인하고 필요시 시스템을 재시작하세요.';
    }
  }

  /**
   * Critical 에러 처리
   */
  handleCriticalError(errorInfo) {
    console.error('🚨 CRITICAL ERROR:', errorInfo.message);
    console.error('📍 Module:', errorInfo.module);
    console.error('🔧 Suggested Action:', errorInfo.suggestedAction);
    
    // Critical 에러는 즉시 실패 응답
    return {
      success: false,
      error: {
        type: 'CRITICAL_ERROR',
        message: errorInfo.message,
        id: errorInfo.id,
        timestamp: errorInfo.timestamp,
        recoverable: false,
        suggestedAction: errorInfo.suggestedAction
      },
      fallback: this.getCriticalErrorFallback(errorInfo)
    };
  }

  /**
   * 일반 에러 처리
   */
  handleRegularError(errorInfo) {
    console.error('❌ ERROR:', errorInfo.message);
    console.error('📍 Module:', errorInfo.module);
    
    return {
      success: false,
      error: {
        type: 'ERROR',
        message: errorInfo.message,
        id: errorInfo.id,
        timestamp: errorInfo.timestamp,
        recoverable: errorInfo.isRecoverable,
        retryable: errorInfo.retryable,
        suggestedAction: errorInfo.suggestedAction
      },
      fallback: errorInfo.isRecoverable ? this.getRecoveryFallback(errorInfo) : null
    };
  }

  /**
   * 경고 처리
   */
  handleWarning(errorInfo) {
    console.warn('⚠️ WARNING:', errorInfo.message);
    console.warn('📍 Module:', errorInfo.module);
    
    return {
      success: true,
      warning: {
        type: 'WARNING',
        message: errorInfo.message,
        id: errorInfo.id,
        timestamp: errorInfo.timestamp,
        suggestedAction: errorInfo.suggestedAction
      }
    };
  }

  /**
   * 정보 처리
   */
  handleInfo(errorInfo) {
    console.info('ℹ️ INFO:', errorInfo.message);
    
    return {
      success: true,
      info: {
        type: 'INFO',
        message: errorInfo.message,
        id: errorInfo.id,
        timestamp: errorInfo.timestamp
      }
    };
  }

  /**
   * 알 수 없는 에러 처리
   */
  handleUnknownError(errorInfo) {
    console.error('❓ UNKNOWN ERROR:', errorInfo.message);
    
    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        message: errorInfo.message,
        id: errorInfo.id,
        timestamp: errorInfo.timestamp,
        recoverable: false,
        suggestedAction: '시스템 관리자에게 문의하세요.'
      }
    };
  }

  /**
   * 에러 로깅
   */
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    
    // 로그 크기 제한 (최대 1000개)
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-800); // 최근 800개만 유지
    }
  }

  /**
   * 통계 업데이트
   */
  updateStats(errorInfo) {
    this.errorStats.total++;
    
    // 타입별 통계
    if (!this.errorStats.byType[errorInfo.type]) {
      this.errorStats.byType[errorInfo.type] = 0;
    }
    this.errorStats.byType[errorInfo.type]++;
    
    // 모듈별 통계
    if (!this.errorStats.byModule[errorInfo.module]) {
      this.errorStats.byModule[errorInfo.module] = 0;
    }
    this.errorStats.byModule[errorInfo.module]++;
    
    // 심각도별 통계
    switch (errorInfo.severity) {
      case this.severityLevels.CRITICAL:
        this.errorStats.critical++;
        break;
      case this.severityLevels.WARNING:
        this.errorStats.warning++;
        break;
      case this.severityLevels.INFO:
        this.errorStats.info++;
        break;
    }
  }

  /**
   * Critical 에러 폴백
   */
  getCriticalErrorFallback(errorInfo) {
    return {
      message: '시스템에 심각한 오류가 발생했습니다. 기본 모드로 전환합니다.',
      data: null,
      recommendations: [
        '시스템 재시작을 권장합니다.',
        '로그 파일을 확인하세요.',
        '시스템 관리자에게 문의하세요.'
      ]
    };
  }

  /**
   * 복구 폴백
   */
  getRecoveryFallback(errorInfo) {
    return {
      message: '오류가 발생했지만 기본값으로 계속 진행합니다.',
      data: this.getDefaultData(errorInfo),
      recommendations: [
        '입력 데이터를 확인하세요.',
        '설정을 검토하세요.',
        '필요시 재시도하세요.'
      ]
    };
  }

  /**
   * 기본 데이터 제공
   */
  getDefaultData(errorInfo) {
    switch (errorInfo.module) {
      case 'textArrayDateController':
        return {
          success: false,
          results: [],
          performance: { processingTime: 0, error: true }
        };
      case 'advancedTextArrayDateClassifier':
        return {
          success: false,
          classification: [],
          stats: { error: true }
        };
      case 'enhancedDateAnchor':
        return {
          result: { primary: [], secondary: [] },
          confidence: 0,
          error: true
        };
      default:
        return null;
    }
  }

  /**
   * 폴백 응답 생성
   */
  createFallbackResponse(originalError, handlingError) {
    return {
      success: false,
      error: {
        type: 'ERROR_HANDLER_FAILURE',
        message: 'Error handler 자체에서 오류가 발생했습니다.',
        originalError: originalError.message,
        handlingError: handlingError.message,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 에러 ID 생성
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 메모리 사용량 확인
   */
  getMemoryUsage() {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage();
      }
      return { heapUsed: 0, heapTotal: 0, external: 0 };
    } catch (error) {
      return { error: 'Memory usage unavailable' };
    }
  }

  /**
   * 에러 리포트 생성
   */
  generateErrorReport() {
    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      stats: this.errorStats,
      recentErrors: this.errorLog.slice(-10), // 최근 10개 에러
      systemInfo: {
        memoryUsage: this.getMemoryUsage(),
        uptime: typeof process !== 'undefined' ? process.uptime() : 0
      }
    };
  }

  /**
   * 에러 로그 초기화
   */
  clearErrorLog() {
    this.errorLog = [];
    this.errorStats = {
      total: 0,
      byType: {},
      byModule: {},
      critical: 0,
      warning: 0,
      info: 0
    };
  }
}

// 전역 에러 핸들러 인스턴스
const globalErrorHandler = new ErrorHandler();

/**
 * 안전한 함수 실행 래퍼
 */
function safeExecute(fn, context = {}) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      return globalErrorHandler.handleError(error, context);
    }
  };
}

/**
 * 재시도 로직이 포함된 안전한 실행
 */
function safeExecuteWithRetry(fn, context = {}, maxRetries = 3) {
  return async (...args) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        lastError = error;
        
        const errorInfo = globalErrorHandler.analyzeError(error, {
          ...context,
          attempt,
          maxRetries
        });
        
        if (!errorInfo.retryable || attempt === maxRetries) {
          return globalErrorHandler.handleError(error, context);
        }
        
        // 재시도 전 대기 (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.warn(`⚠️ 재시도 ${attempt}/${maxRetries}: ${error.message}`);
      }
    }
    
    return globalErrorHandler.handleError(lastError, context);
  };
}

export { 
  ErrorHandler, 
  globalErrorHandler, 
  safeExecute, 
  safeExecuteWithRetry 
};