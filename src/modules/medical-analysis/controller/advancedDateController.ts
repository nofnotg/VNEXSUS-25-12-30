/**
 * 고급 날짜 분석 컨트롤러
 * 프로젝트 규칙: API route/handler, 입력검증, 에러 처리 표준화
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AdvancedDateService } from '../service/advancedDateService';
import { AdvancedDateRequest, ERROR_CODES } from '../types/index';
import { API_STATUS_CODES } from '../../../shared/constants/medical';
import { logger, logApiRequest } from '../../../shared/logging/logger';
import { createSafeLogString } from '../../../shared/security/mask';

export class AdvancedDateController {
  private readonly dateService: AdvancedDateService;

  constructor() {
    this.dateService = new AdvancedDateService();
  }

  /**
   * 날짜 추출 API 엔드포인트
   */
  async extractDates(req: Request, res: Response): Promise<void> {
    const traceId = uuidv4();
    const startTime = Date.now();

    try {
      // API 요청 로깅
      logApiRequest(traceId, req.method, (req as any).originalUrl ?? req.path ?? '');

      // 요청 본문 검증
      if (!req.body || typeof req.body !== 'object') {
        res.status(API_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: '요청 본문이 필요합니다'
          },
          metadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0',
            traceId
          }
        });
        return;
      }

      // 텍스트 필드 검증
      if (!req.body.text || typeof req.body.text !== 'string') {
        res.status(API_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'text 필드는 필수이며 문자열이어야 합니다'
          },
          metadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0',
            traceId
          }
        });
        return;
      }

      // 텍스트 길이 제한 검사
      if (req.body.text.length > 50000) {
        res.status(API_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: '텍스트 길이는 50,000자를 초과할 수 없습니다'
          },
          metadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0',
            traceId
          }
        });
        return;
      }

      // 서비스 호출
      const result = await this.dateService.extractDates(req.body as AdvancedDateRequest, traceId);

      // 성공 응답
      if (result.success) {
        logger.info({
          event: 'api_success',
          traceId,
          metadata: {
            endpoint: '/api/advanced-date-analysis',
            processingTime: Date.now() - startTime,
            extractedCount: result.data?.totalCount || 0,
            inputLength: req.body.text.length
          }
        });

        res.status(API_STATUS_CODES.SUCCESS).json(result);
      } else {
        // 서비스 레벨 에러
        logger.warn({
          event: 'service_error',
          traceId,
          error: {
            name: 'ServiceError',
            message: String(result.error?.message ?? result.error?.code ?? 'Service error')
          },
          metadata: {
            endpoint: '/api/advanced-date-analysis',
            processingTime: Date.now() - startTime,
            inputLength: req.body.text.length
          }
        });

        const statusCode = this.getStatusCodeFromError(result.error?.code);
        res.status(statusCode).json(result);
      }

    } catch (error) {
      // 예상치 못한 에러
      const processingTime = Date.now() - startTime;
      
      logger.error({
        event: 'controller_error',
        traceId,
        error: {
          name: (error as Error).name || 'Error',
          message: (error as Error).message,
          stack: (error as Error).stack
        },
        metadata: {
          endpoint: '/api/advanced-date-analysis',
          processingTime,
          inputLength: req.body?.text?.length || 0,
          safeInput: createSafeLogString(req.body?.text || '')
        }
      });

      res.status(API_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: '서버 내부 오류가 발생했습니다'
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      });
    }
  }

  /**
   * 배치 날짜 추출 API 엔드포인트
   */
  async extractDatesBatch(req: Request, res: Response): Promise<void> {
    const traceId = uuidv4();
    const startTime = Date.now();

    try {
      logApiRequest(traceId, req.method, (req as any).originalUrl ?? req.path ?? '');

      // 배치 요청 검증
      if (!req.body || !Array.isArray(req.body.texts)) {
        res.status(API_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'texts 배열이 필요합니다'
          },
          metadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0',
            traceId
          }
        });
        return;
      }

      // 배치 크기 제한
      if (req.body.texts.length > 100) {
        res.status(API_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: '배치 크기는 100개를 초과할 수 없습니다'
          },
          metadata: {
            processingTime: Date.now() - startTime,
            version: '2.0.0',
            traceId
          }
        });
        return;
      }

      // 각 텍스트 검증
      for (let i = 0; i < req.body.texts.length; i++) {
        const text = req.body.texts[i];
        if (typeof text !== 'string') {
          res.status(API_STATUS_CODES.BAD_REQUEST).json({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: `texts[${i}]는 문자열이어야 합니다`
            },
            metadata: {
              processingTime: Date.now() - startTime,
              version: '2.0.0',
              traceId
            }
          });
          return;
        }

        if (text.length > 50000) {
          res.status(API_STATUS_CODES.BAD_REQUEST).json({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: `texts[${i}] 길이는 50,000자를 초과할 수 없습니다`
            },
            metadata: {
              processingTime: Date.now() - startTime,
              version: '2.0.0',
              traceId
            }
          });
          return;
        }
      }

      // 배치 처리
      const results = [];
      const options = req.body.options || {};

      for (let i = 0; i < req.body.texts.length; i++) {
        const text = req.body.texts[i];
        const batchTraceId = `${traceId}-batch-${i}`;
        
        try {
          const result = await this.dateService.extractDates(
            { text, options },
            batchTraceId
          );
          results.push({
            index: i,
            ...result
          });
        } catch (error) {
          results.push({
            index: i,
            success: false,
            error: {
              code: ERROR_CODES.PROCESSING_ERROR,
              message: '배치 항목 처리 중 오류 발생'
            }
          });
        }
      }

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      logger.info({
        event: 'batch_api_success',
        traceId,
        metadata: {
          endpoint: '/api/advanced-date-analysis/batch',
          processingTime,
          totalItems: req.body.texts.length,
          successCount,
          failureCount: req.body.texts.length - successCount
        }
      });

      res.status(API_STATUS_CODES.SUCCESS).json({
        success: true,
        data: {
          results,
          totalItems: req.body.texts.length,
          successCount,
          failureCount: req.body.texts.length - successCount
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        event: 'batch_controller_error',
        traceId,
        error: {
          name: (error as Error).name || 'Error',
          message: (error as Error).message,
          stack: (error as Error).stack
        },
        metadata: {
          endpoint: '/api/advanced-date-analysis/batch',
          processingTime,
          batchSize: req.body?.texts?.length || 0
        }
      });

      res.status(API_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: '배치 처리 중 서버 내부 오류가 발생했습니다'
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      });
    }
  }

  /**
   * 헬스 체크 엔드포인트
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const traceId = uuidv4();
    const startTime = Date.now();

    try {
      // 간단한 날짜 추출 테스트
      const testResult = await this.dateService.extractDates(
        { 
          text: '테스트 날짜: 2024-01-01',
          options: { includeAbsolute: true }
        },
        traceId
      );

      const processingTime = Date.now() - startTime;
      const isHealthy = testResult.success && (testResult.data?.totalCount || 0) > 0;

      res.status(isHealthy ? API_STATUS_CODES.SUCCESS : API_STATUS_CODES.SERVICE_UNAVAILABLE).json({
        success: isHealthy,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          service: 'advanced-date-analysis',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          testResult: {
            success: testResult.success,
            extractedCount: testResult.data?.totalCount || 0
          }
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      });

      logger.info({
        event: 'health_check',
        traceId,
        metadata: {
          endpoint: '/api/advanced-date-analysis/health',
          processingTime,
          isHealthy,
          testExtractedCount: testResult.data?.totalCount || 0
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error({
        event: 'health_check_error',
        traceId,
        error: {
          name: (error as Error).name || 'Error',
          message: (error as Error).message
        },
        metadata: { endpoint: '/api/advanced-date-analysis/health', processingTime }
      });

      res.status(API_STATUS_CODES.SERVICE_UNAVAILABLE).json({
        success: false,
        data: {
          status: 'unhealthy',
          service: 'advanced-date-analysis',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          error: '헬스 체크 실패'
        },
        metadata: {
          processingTime,
          version: '2.0.0',
          traceId
        }
      });
    }
  }

  /**
   * 에러 코드에서 HTTP 상태 코드 매핑
   */
  private getStatusCodeFromError(errorCode?: string): number {
    switch (errorCode) {
      case ERROR_CODES.VALIDATION_ERROR:
        return API_STATUS_CODES.VALIDATION_ERROR;
      case ERROR_CODES.PROCESSING_ERROR:
        return API_STATUS_CODES.INTERNAL_SERVER_ERROR;
      case ERROR_CODES.TIMEOUT_ERROR:
        return API_STATUS_CODES.TIMEOUT;
      case ERROR_CODES.INTERNAL_SERVER_ERROR:
      default:
        return API_STATUS_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}

// 컨트롤러 인스턴스 생성 및 내보내기
export const advancedDateController = new AdvancedDateController();
