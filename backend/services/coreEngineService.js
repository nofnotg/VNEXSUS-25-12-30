// coreEngineService.js - 코어 엔진 서비스 래퍼
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
import { computeDisclosure } from '../../src/services/core/disclosureEngine.js';
import { mapDiseaseRules } from '../../src/services/core/diseaseRuleMapper.js';
import { classifyPrimaryMetastasis } from '../../src/services/core/primaryMetastasisClassifier.js';
import { orchestrateReport } from '../../src/services/core/promptOrchestrator.js';
import { validateStructure, FullReportSchema, SummarySchema, DisclosureSchema } from '../../src/services/core/structuredOutput.js';
import { createLogger } from '../utils/enhancedLogger.js';
import { AppError, CoreEngineError, handleCoreEngineError } from '../middleware/errorHandler.js';

import { globalMemoryOptimizer } from '../utils/memoryOptimizer.js';
import { globalStreamOptimizer } from './streamProcessingOptimizer.js';
import { globalLargeFileHandler } from './largeFileHandler.js';

// 새로운 파이프라인 상태 머신 임포트
import { PipelineStateMachine } from './core-engine/index.js';

const logger = createLogger('CORE_ENGINE');

/**
 * 코어 엔진 서비스 - 기존 파이프라인과 호환되는 래퍼
 */
class CoreEngineService {
  constructor() {
    this.isEnabled = process.env.USE_CORE_ENGINE === 'true';
    this.logger = logger;
    
    // 새로운 파이프라인 상태 머신 초기화
    this.pipelineStateMachine = new PipelineStateMachine({
      qualityGate: process.env.CORE_ENGINE_QUALITY_GATE || 'standard',
      maxRetries: parseInt(process.env.CORE_ENGINE_MAX_RETRIES) || 2,
      timeoutMs: parseInt(process.env.CORE_ENGINE_TIMEOUT_MS) || 300000,
      enableCaching: process.env.CORE_ENGINE_ENABLE_CACHING !== 'false',
      enableFallback: process.env.CORE_ENGINE_ENABLE_FALLBACK !== 'false',
      enableDetailedLogging: process.env.CORE_ENGINE_DETAILED_LOGGING === 'true'
    });
    
    // 런타임 환경변수 변경 감지
    this.checkRuntimeToggle();
    
    this.logger.info('코어 엔진 서비스 초기화', { 
      enabled: this.isEnabled,
      nodeEnv: process.env.NODE_ENV,
      pipelineInitialized: !!this.pipelineStateMachine
    });
  }

  /**
   * 파이프라인 실행 상태 조회
   * @returns {Object} 현재 파이프라인 실행 상태
   */
  getPipelineStatus() {
    if (!this.isEnabled || !this.pipelineStateMachine) {
      return {
        enabled: false,
        status: 'disabled',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const status = this.pipelineStateMachine.getExecutionStatus();
      return {
        enabled: true,
        ...status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('파이프라인 상태 조회 중 오류 발생', {}, error);
      return {
        enabled: true,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 파이프라인 중단
   */
  async abortPipeline() {
    if (!this.isEnabled || !this.pipelineStateMachine) {
      this.logger.warn('파이프라인이 비활성화되어 중단할 수 없습니다');
      return { success: false, reason: 'Pipeline not active' };
    }

    try {
      await this.pipelineStateMachine.abort();
      this.logger.info('파이프라인 실행이 중단되었습니다');
      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error('파이프라인 중단 중 오류 발생', {}, error);
      return { 
        success: false, 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  /**
   * 새로운 코어 엔진 분석 메서드 (파이프라인 상태 머신 사용)
   * @param {Object} input - 분석 입력 데이터
   * @param {string} input.text - 분석할 텍스트
   * @param {Array} input.textSegments - 텍스트 세그먼트 배열 (선택사항)
   * @param {Object} input.options - 분석 옵션
   * @param {ReadableStream} input.stream - 대용량 파일 스트림 (선택사항)
   * @returns {Object} 분석 결과 (skeleton JSON 포함)
   */
  async analyze(input) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 분석 건너뜀');
      return { 
        coreEngineUsed: false, 
        reason: 'Core engine disabled',
        timestamp: new Date().toISOString()
      };
    }

    try {
      this.logger.startPerformance('core-engine-analysis');
      
      // 입력 검증
      if (!input) {
        throw new CoreEngineError('입력 데이터가 필요합니다', 'analyze', 'input-validation');
      }

      if (!input.text && !input.textSegments && !input.stream) {
        throw new CoreEngineError('텍스트, 텍스트 세그먼트 또는 스트림이 필요합니다', 'analyze', 'input-validation');
      }

      this.logger.info('코어 엔진 분석 시작', {
        hasText: !!input.text,
        hasTextSegments: !!input.textSegments,
        hasStream: !!input.stream,
        textLength: input.text ? input.text.length : 0,
        segmentCount: input.textSegments ? input.textSegments.length : 0,
        options: input.options || {}
      });

      // 메모리 최적화 - 대용량 텍스트 처리 전 메모리 체크
      globalMemoryOptimizer.checkMemoryUsage();

      let processedInput = input;

      // 대용량 파일 스트림 처리
      if (input.stream) {
        this.logger.info('대용량 파일 스트림 처리 시작');
        
        try {
          const streamResult = await globalStreamOptimizer.processLargeFileStream(
            input.stream,
            async (chunk, metadata) => {
              // 청크를 텍스트로 변환하여 처리
              const chunkText = chunk.toString('utf8');
              return {
                text: chunkText,
                chunkIndex: metadata.chunkIndex,
                totalBytes: metadata.totalBytes
              };
            },
            {
              preferredChunkSize: input.options?.chunkSize,
              maxConcurrency: input.options?.maxConcurrency || 2
            }
          );

          if (!streamResult.success) {
            throw new CoreEngineError('스트림 처리 실패', 'analyze', 'stream-processing');
          }

          // 스트림 결과를 텍스트로 병합
          const combinedText = streamResult.results
            .map(chunk => chunk.text)
            .join('');

          processedInput = {
            ...input,
            text: combinedText,
            streamMetrics: streamResult.metrics
          };

          this.logger.info('스트림 처리 완료', {
            totalChunks: streamResult.results.length,
            totalMB: (streamResult.metrics.totalBytes / 1024 / 1024).toFixed(2),
            processingTimeMs: streamResult.metrics.processingTime,
            throughputMBps: ((streamResult.metrics.totalBytes / 1024 / 1024) / 
                           (streamResult.metrics.processingTime / 1000)).toFixed(2)
          });

        } catch (streamError) {
          this.logger.error('스트림 처리 중 오류 발생', {}, streamError);
          throw new CoreEngineError(
            `스트림 처리 실패: ${streamError.message}`, 
            'analyze', 
            'stream-processing'
          );
        }
      }

      // 파일 경로 처리 (대용량 파일 핸들러 사용)
      if (input.filePath) {
        this.logger.info('파일 경로 처리 시작', { filePath: input.filePath });
        
        try {
          const fileResult = await globalLargeFileHandler.processFile(
            input.filePath,
            async (content, metadata) => {
              // 파일 내용을 분석용 텍스트로 변환
              return {
                text: typeof content === 'string' ? content : content.toString('utf8'),
                fileInfo: metadata.fileInfo,
                strategy: metadata.strategy
              };
            },
            {
              enableProgressTracking: true,
              enablePartialResults: input.options?.enablePartialResults !== false,
              cacheResults: input.options?.cacheResults !== false,
              ...input.options
            }
          );

          if (!fileResult.success) {
            throw new CoreEngineError('파일 처리 실패', 'analyze', 'file-processing');
          }

          processedInput = {
            ...input,
            text: fileResult.result.text,
            fileInfo: fileResult.fileInfo,
            processingStrategy: fileResult.strategy,
            fileProcessingTime: fileResult.processingTime
          };

          this.logger.info('파일 처리 완료', {
            strategy: fileResult.strategy,
            fileSizeMB: fileResult.fileInfo.sizeMB,
            processingTimeMs: fileResult.processingTime,
            throughputMBps: (fileResult.fileInfo.sizeMB / (fileResult.processingTime / 1000)).toFixed(2)
          });

        } catch (fileError) {
          this.logger.error('파일 처리 중 오류 발생', {}, fileError);
          throw new CoreEngineError(
            `파일 처리 실패: ${fileError.message}`, 
            'analyze', 
            'file-processing'
          );
        }
      }

      // 대용량 텍스트 처리 최적화
      if (processedInput.text && processedInput.text.length > 1024 * 1024) { // 1MB 이상
        this.logger.info('대용량 텍스트 감지, 스트림 처리 적용', {
          textSizeMB: (processedInput.text.length / 1024 / 1024).toFixed(2)
        });

        // 텍스트를 스트림으로 변환하여 처리
        const { Readable } = require('stream');
        const textStream = Readable.from([Buffer.from(processedInput.text, 'utf8')]);
        
        const streamResult = await globalStreamOptimizer.processLargeFileStream(
          textStream,
          async (chunk, metadata) => {
            return {
              text: chunk.toString('utf8'),
              chunkIndex: metadata.chunkIndex
            };
          },
          {
            preferredChunkSize: Math.min(256 * 1024, processedInput.text.length / 10), // 256KB 또는 텍스트의 1/10
            maxConcurrency: 1 // 텍스트 순서 보장을 위해 단일 스레드
          }
        );

        if (streamResult.success) {
          processedInput.streamOptimized = true;
          processedInput.streamMetrics = streamResult.metrics;
        }
      }

      // 파이프라인 상태 머신 실행
      const result = await this.pipelineStateMachine.execute(processedInput);

      const performanceData = this.logger.endPerformance('core-engine-analysis', {
        processingTimeMs: result.executionMetadata?.processingTimeMs || 0,
        qualityGate: result.executionMetadata?.qualityGate || 'unknown',
        statesExecuted: result.executionMetadata?.stateHistory?.length || 0,
        retryCount: result.executionMetadata?.retryCount || 0,
        cacheUsed: result.executionMetadata?.cacheUsed || false,
        fallbackUsed: result.executionMetadata?.fallbackUsed || false,
        reportItemCount: result.skeletonJson?.reportItems?.length || 0
      });

      // 메모리 최적화 - 분석 완료 후 메모리 정리
      globalMemoryOptimizer.forceGarbageCollection();

      this.logger.coreEngine('analyze', 'success', {
        processingTime: performanceData.processingTimeMs,
        qualityGate: result.executionMetadata?.qualityGate,
        reportItems: result.skeletonJson?.reportItems?.length || 0,
        performance: performanceData
      });

      return {
        coreEngineUsed: true,
        ...result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.endPerformance('core-engine-analysis');
      this.logger.coreEngine('analyze', 'error', { 
        inputSize: input ? JSON.stringify(input).length : 0 
      }, error);
      
      if (error instanceof CoreEngineError) {
        throw error;
      }
      
      throw handleCoreEngineError('analyze', 'pipeline')(error);
    }
  }

  /**
   * 런타임 환경변수 변경 감지
   */
  checkRuntimeToggle() {
    const currentSetting = process.env.USE_CORE_ENGINE === 'true';
    if (this.isEnabled !== currentSetting) {
      this.isEnabled = currentSetting;
      this.logger.info('코어 엔진 런타임 토글 변경', { 
        previousState: !this.isEnabled,
        currentState: this.isEnabled 
      });
    }
  }

  /**
   * 코어 엔진 사용 여부 확인
   */
  isActive() {
    this.checkRuntimeToggle(); // 매번 확인
    return this.isEnabled;
  }

  /**
   * 고지의무 분석 수행
   * @param {Object} params - 분석 파라미터
   * @param {string} params.contractDate - 계약일 (YYYY-MM-DD)
   * @param {Array} params.records - 의료 기록 배열
   * @param {string} params.claimDiagnosis - 청구 진단명
   * @param {Array} params.disclosureWindows - 고지의무 윈도우 (기본: ['3m','2y','5y'])
   * @returns {Object} 고지의무 분석 결과
   */
  async analyzeDisclosure(params) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 고지의무 분석 건너뜀');
      return null;
    }

    try {
      this.logger.startPerformance('disclosure-analysis');
      
      const {
        contractDate,
        records = [],
        claimDiagnosis = '',
        disclosureWindows = ['3m', '2y', '5y']
      } = params;

      if (!contractDate) {
        throw new CoreEngineError('계약일이 필요합니다', 'analyzeDisclosure', 'disclosure');
      }

      this.logger.info('고지의무 분석 시작', {
        contractDate,
        recordCount: records.length,
        claimDiagnosis,
        disclosureWindows
      });

      const result = computeDisclosure({
        contractDate,
        disclosureWindows,
        records,
        claimDiagnosis
      });

      // 스키마 검증
      const validation = validateStructure(result, DisclosureSchema);
      if (!validation.ok) {
        this.logger.warn('고지의무 스키마 검증 실패', { error: validation.error });
      }

      const performanceData = this.logger.endPerformance('disclosure-analysis', {
        windowsAnalyzed: result.windows.length,
        validationPassed: validation.ok
      });

      this.logger.coreEngine('analyzeDisclosure', 'success', {
        windowsAnalyzed: result.windows.length,
        performance: performanceData
      });

      return result;

    } catch (error) {
      this.logger.endPerformance('disclosure-analysis');
      this.logger.coreEngine('analyzeDisclosure', 'error', { params }, error);
      
      if (error instanceof CoreEngineError) {
        throw error;
      }
      
      throw handleCoreEngineError('analyzeDisclosure', 'disclosure')(error);
    }
  }

  /**
   * 질환 규칙 매핑 수행
   * @param {Array} records - 의료 기록 배열
   * @returns {Array} 매핑된 질환 규칙 결과
   */
  async mapDiseaseRules(records = []) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 질환 규칙 매핑 건너뜀');
      return records; // 원본 반환
    }

    try {
      this.logger.startPerformance('disease-rule-mapping');
      
      this.logger.info('질환 규칙 매핑 시작', { recordCount: records.length });
      
      const result = mapDiseaseRules(records);
      
      const performanceData = this.logger.endPerformance('disease-rule-mapping', {
        inputRecords: records.length,
        outputRecords: result.length
      });
      
      this.logger.coreEngine('mapDiseaseRules', 'success', {
        recordsProcessed: result.length,
        performance: performanceData
      });
      
      return result;

    } catch (error) {
      this.logger.endPerformance('disease-rule-mapping');
      this.logger.coreEngine('mapDiseaseRules', 'error', { recordCount: records.length }, error);
      
      // 실패 시 원본 레코드 반환 (폴백)
      this.logger.warn('질환 규칙 매핑 실패, 원본 레코드 반환', { error: error.message });
      return records;
    }
  }

  /**
   * 원발/전이 분류 수행
   * @param {Array} records - 의료 기록 배열
   * @returns {Object} 분류 결과 { primary, metastasis, classificationLine }
   */
  async classifyPrimaryMetastasis(records = []) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 원발/전이 분류 건너뜀');
      return null;
    }

    try {
      this.logger.startPerformance('primary-metastasis-classification');
      
      this.logger.info('원발/전이 분류 시작', { recordCount: records.length });
      
      const result = classifyPrimaryMetastasis({ records });
      
      const performanceData = this.logger.endPerformance('primary-metastasis-classification', {
        primary: result.primary,
        metastasisCount: result.metastasis.length
      });
      
      this.logger.coreEngine('classifyPrimaryMetastasis', 'success', {
        primary: result.primary,
        metastasisCount: result.metastasis.length,
        performance: performanceData
      });
      
      return result;

    } catch (error) {
      this.logger.endPerformance('primary-metastasis-classification');
      this.logger.coreEngine('classifyPrimaryMetastasis', 'error', { recordCount: records.length }, error);
      
      const fallbackResult = {
        primary: '원발부위 미상',
        metastasis: [],
        classificationLine: '분류: ✅ 원발부위 미상 원발 + 전이 없음'
      };
      
      this.logger.warn('원발/전이 분류 실패, 기본값 반환', { fallback: fallbackResult });
      return fallbackResult;
    }
  }

  /**
   * 보고서 생성 및 요약 자동화
   * @param {Object} params - 보고서 생성 파라미터
   * @param {string} params.systemPrompt - 시스템 프롬프트
   * @param {string} params.userPrompt - 사용자 프롬프트
   * @param {string} params.model - 사용할 모델 (기본: gpt-4o-mini)
   * @returns {Object} { fullReportText, summaryText }
   */
  async generateReport(params) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 보고서 생성 건너뜀');
      return null;
    }

    try {
      this.logger.startPerformance('report-generation');
      
      const {
        systemPrompt,
        userPrompt,
        model = 'gpt-4o-mini'
      } = params;

      if (!systemPrompt || !userPrompt) {
        throw new CoreEngineError('시스템 프롬프트와 사용자 프롬프트가 필요합니다', 'generateReport', 'orchestrator');
      }

      this.logger.info('보고서 생성 시작', {
        model,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length
      });

      const result = await orchestrateReport({
        model,
        systemPrompt,
        userPrompt
      });

      const performanceData = this.logger.endPerformance('report-generation', {
        model,
        fullReportLength: result.fullReportText?.length || 0,
        summaryLength: result.summaryText?.length || 0
      });

      this.logger.coreEngine('generateReport', 'success', {
        model,
        reportGenerated: !!result.fullReportText,
        summaryGenerated: !!result.summaryText,
        performance: performanceData
      });

      return result;

    } catch (error) {
      this.logger.endPerformance('report-generation');
      this.logger.coreEngine('generateReport', 'error', { params }, error);
      
      if (error instanceof CoreEngineError) {
        throw error;
      }
      
      throw handleCoreEngineError('generateReport', 'orchestrator')(error);
    }
  }

  /**
   * 통합 파이프라인 실행 (Progressive RAG 통합)
   * @param {Object} params - 통합 파이프라인 파라미터
   * @returns {Object} 전체 분석 결과
   */
  async runIntegratedPipeline(params) {
    if (!this.isEnabled) {
      this.logger.debug('코어 엔진 비활성화됨, 통합 파이프라인 건너뜀');
      return { coreEngineUsed: false };
    }

    try {
      this.logger.startPerformance('integrated-pipeline');
      
      // 메모리 최적화 - 대용량 데이터 처리 전 메모리 체크
      globalMemoryOptimizer.checkMemoryUsage();
      
      const {
        contractDate,
        records = [],
        claimDiagnosis = '',
        systemPrompt,
        userPrompt,
        disclosureWindows = ['3m', '2y', '5y'],
        // Progressive RAG 관련 옵션
        enableProgressiveRAG = false,
        ragOptions = {}
      } = params;

      this.logger.info('통합 코어 엔진 파이프라인 시작', {
        hasContractDate: !!contractDate,
        recordCount: records.length,
        hasSystemPrompt: !!systemPrompt,
        hasUserPrompt: !!userPrompt,
        enableProgressiveRAG
      });

      // Progressive RAG 결과 초기화
      let ragEnhancedResult = null;

      // Progressive RAG 활성화 시 의료 분석 수행
      if (enableProgressiveRAG) {
        try {
          this.logger.info('Progressive RAG 분석 시작');
          ragEnhancedResult = await this.performProgressiveRAGAnalysis(records, ragOptions);
          this.logger.info('Progressive RAG 분석 완료', {
            medicalTermsCount: ragEnhancedResult?.medicalTerms?.length || 0,
            icdCodesCount: ragEnhancedResult?.icdCodes?.length || 0
          });
        } catch (ragError) {
          this.logger.warn('Progressive RAG 분석 실패, 기본 분석으로 진행', ragError);
        }
      }

      // 1. 질환 규칙 매핑
      const mappedRecords = await this.mapDiseaseRules(records);

      // 2. 고지의무 분석 (계약일이 있는 경우만)
      let disclosureResult = null;
      if (contractDate) {
        disclosureResult = await this.analyzeDisclosure({
          contractDate,
          records: mappedRecords,
          claimDiagnosis,
          disclosureWindows
        });
      }

      // 3. 원발/전이 분류
      const classificationResult = await this.classifyPrimaryMetastasis(mappedRecords);

      // 4. 보고서 생성 (프롬프트가 있는 경우만)
      let reportResult = null;
      if (systemPrompt && userPrompt) {
        // Progressive RAG 결과를 프롬프트에 통합
        const enhancedSystemPrompt = ragEnhancedResult ? 
          this.buildRAGEnhancedSystemPrompt(systemPrompt, ragEnhancedResult) : 
          systemPrompt;
        
        const enhancedUserPrompt = ragEnhancedResult ? 
          this.buildRAGEnhancedUserPrompt(userPrompt, ragEnhancedResult) : 
          userPrompt;

        reportResult = await this.generateReport({
          systemPrompt: enhancedSystemPrompt,
          userPrompt: enhancedUserPrompt
        });
      }

      const result = {
        coreEngineUsed: true,
        mappedRecords,
        disclosure: disclosureResult,
        classification: classificationResult,
        report: reportResult,
        progressiveRAG: ragEnhancedResult,
        timestamp: new Date().toISOString()
      };

      const performanceData = this.logger.endPerformance('integrated-pipeline', {
        stepsCompleted: [
          'diseaseRuleMapping',
          disclosureResult ? 'disclosureAnalysis' : null,
          'primaryMetastasisClassification',
          reportResult ? 'reportGeneration' : null,
          ragEnhancedResult ? 'progressiveRAGAnalysis' : null
        ].filter(Boolean)
      });

      // 메모리 최적화 - 통합 파이프라인 완료 후 메모리 정리
      globalMemoryOptimizer.forceGarbageCollection();

      this.logger.coreEngine('runIntegratedPipeline', 'success', {
        stepsCompleted: performanceData.stepsCompleted,
        performance: performanceData
      });

      return result;

    } catch (error) {
      this.logger.endPerformance('integrated-pipeline');
      this.logger.coreEngine('runIntegratedPipeline', 'error', { params }, error);
      
      return {
        coreEngineUsed: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 스키마 검증 수행
   * @param {Object} data - 검증할 데이터
   * @param {Object} schema - 사용할 스키마
   * @returns {Object} 검증 결과
   */
  validateSchema(data, schemaType = 'summary') {
    try {
      this.logger.debug('스키마 검증 시작', { schemaType, hasData: !!data });
      
      const schemas = {
        full: FullReportSchema,
        summary: SummarySchema,
        disclosure: DisclosureSchema
      };

      const schema = schemas[schemaType];
      if (!schema) {
        const error = new ValidationError(`알 수 없는 스키마 타입: ${schemaType}`);
        this.logger.error('스키마 검증 실패', { schemaType, availableTypes: Object.keys(schemas) }, error);
        throw error;
      }

      const result = validateStructure(data, schema);
      
      this.logger.debug('스키마 검증 완료', { 
        schemaType, 
        isValid: result.isValid,
        errorCount: result.errors?.length || 0
      });

      return result;
    } catch (error) {
      this.logger.error('스키마 검증 중 오류 발생', { schemaType }, error);
      throw error;
    }
  }

  /**
   * 헬스 체크
   * @returns {Object} 서비스 상태
   */
  getHealthStatus() {
    try {
      // 런타임 환경변수 변경 확인
      this.checkRuntimeToggle();
      
      // 파이프라인 상태 머신 헬스 체크
      let pipelineHealth = null;
      if (this.isEnabled && this.pipelineStateMachine) {
        try {
          pipelineHealth = this.pipelineStateMachine.healthCheck();
        } catch (error) {
          pipelineHealth = { 
            status: 'error', 
            error: error.message 
          };
        }
      }
      
      const status = {
        enabled: this.isEnabled,
        status: 'healthy',
        engines: {
          disclosure: 'ready',
          diseaseMapper: 'ready',
          classification: 'ready',
          orchestrator: 'ready',
          validator: 'ready',
          pipelineStateMachine: pipelineHealth ? pipelineHealth.status : 'disabled'
        },
        pipelineHealth,
        timestamp: new Date().toISOString()
      };

      this.logger.debug('헬스 체크 완료', { 
        enabled: this.isEnabled,
        pipelineEnabled: !!this.pipelineStateMachine
      });
      return status;
    } catch (error) {
      this.logger.error('헬스 체크 중 오류 발생', {}, error);
      return {
        enabled: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Progressive RAG 분석 수행
   * @param {Array} records - 의료 기록 데이터
   * @param {Object} ragOptions - RAG 옵션
   * @returns {Object} Progressive RAG 분석 결과
   */
  async performProgressiveRAGAnalysis(records, ragOptions = {}) {
    try {
      // Progressive RAG Manager 동적 로딩
      const { ProgressiveRAGManager } = await import('../rag/ProgressiveRAGManager.js');
      
      // 싱글톤 인스턴스 가져오기
      const ragManager = ProgressiveRAGManager.getInstance();
      
      // 의료 용어 추출
      const medicalTerms = this.extractMedicalTermsFromRecords(records);
      
      // Progressive RAG 분석 수행
      const ragResults = await Promise.all([
        // 의료 용어 검색
        ragManager.searchMedicalTerms(medicalTerms, {
          maxResults: ragOptions.maxResults || 10,
          confidenceThreshold: ragOptions.confidenceThreshold || 0.7
        }),
        
        // ICD 코드 검색
        ragManager.searchICDCodes(medicalTerms, {
          maxResults: ragOptions.maxResults || 10,
          confidenceThreshold: ragOptions.confidenceThreshold || 0.7
        }),
        
        // 의료 문서 분석
        ragManager.analyzeMedicalDocument(records.map(r => r.text || r.diagnosis || '').join('\n'), {
          includeContext: ragOptions.includeContext !== false,
          includeICDCodes: ragOptions.includeICDCodes !== false
        })
      ]);

      return {
        medicalTerms: ragResults[0],
        icdCodes: ragResults[1],
        documentAnalysis: ragResults[2],
        processingTime: Date.now(),
        ragEnabled: true
      };

    } catch (error) {
      this.logger.error('Progressive RAG 분석 오류:', error);
      throw error;
    }
  }

  /**
   * 의료 기록에서 의료 용어 추출
   * @param {Array} records - 의료 기록 배열
   * @returns {Array} 추출된 의료 용어 배열
   */
  extractMedicalTermsFromRecords(records) {
    const medicalTerms = new Set();
    
    // 의료 용어 패턴 정의
    const medicalPatterns = [
      /([가-힣]+병|[가-힣]+증|[가-힣]+염)/g,  // 질병명 패턴
      /([가-힣]+암|[가-힣]+종)/g,             // 암/종양 패턴
      /([가-힣]+수술|[가-힣]+술)/g,           // 수술 패턴
      /([가-힣]+검사|[가-힣]+촬영)/g,         // 검사 패턴
      /([가-힣]+약|[가-힣]+정)/g              // 약물 패턴
    ];

    records.forEach(record => {
      const text = record.text || record.diagnosis || record.treatment || '';
      
      medicalPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => medicalTerms.add(match));
        }
      });
    });

    return Array.from(medicalTerms);
  }

  /**
   * RAG 강화 시스템 프롬프트 구성
   * @param {string} originalPrompt - 원본 시스템 프롬프트
   * @param {Object} ragResult - Progressive RAG 결과
   * @returns {string} RAG 강화 시스템 프롬프트
   */
  buildRAGEnhancedSystemPrompt(originalPrompt, ragResult) {
    const ragContext = `

## Progressive RAG 강화 컨텍스트

### 의료 용어 정보
${ragResult.medicalTerms?.map(term => `- ${term.term}: ${term.definition || '정의 없음'}`).join('\n') || '없음'}

### ICD 코드 정보
${ragResult.icdCodes?.map(code => `- ${code.code}: ${code.description || '설명 없음'}`).join('\n') || '없음'}

### RAG 분석 요약
${ragResult.documentAnalysis?.summary || '분석 결과 없음'}

위의 Progressive RAG 강화 정보를 참고하여 더욱 정확하고 전문적인 의료 분석을 수행하세요.
`;

    return originalPrompt + ragContext;
  }

  /**
   * RAG 강화 사용자 프롬프트 구성
   * @param {string} originalPrompt - 원본 사용자 프롬프트
   * @param {Object} ragResult - Progressive RAG 결과
   * @returns {string} RAG 강화 사용자 프롬프트
   */
  buildRAGEnhancedUserPrompt(originalPrompt, ragResult) {
    const ragInfo = `

## RAG 강화 정보

**추출된 의료 용어:** ${ragResult.medicalTerms?.length || 0}개
**매칭된 ICD 코드:** ${ragResult.icdCodes?.length || 0}개
**RAG 처리 시간:** ${Date.now() - ragResult.processingTime}ms

위의 RAG 강화 컨텍스트를 활용하여 분석해주세요.
`;

    return originalPrompt + ragInfo;
  }
}

// 싱글톤 인스턴스 생성
const coreEngineService = new CoreEngineService();

export default coreEngineService;