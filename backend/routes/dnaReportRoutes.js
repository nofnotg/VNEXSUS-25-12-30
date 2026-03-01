// Enhanced DNA Report Generation Routes with Real GPT-4o Integration + Post-processing
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { 
  buildEnhancedMedicalDnaPrompt, 
  loadEnhancedMedicalKnowledgeBase,
  buildStructuredJsonPrompt,
  getJsonModelOptions 
} from '../config/enhancedPromptBuilder.js';
import InsuranceValidationService from '../services/insuranceValidationService.js';
import MedicalTermTranslationService from '../services/medicalTermTranslationService.js';
import StructuredReportGenerator from '../services/structuredReportGenerator.js';
import { validateReportSchema, applyDefaultValues, calculateVisitStatistics } from '../services/structuredReportSchema.js';
// NineItemReportGenerator는 대형 모듈이므로 필요 시점에 동적 import로 로드
import { logger, logApiRequest, logApiResponse, logProcessingStart, logProcessingComplete, logProcessingError } from '../../src/shared/logging/logger.js';
import { ProgressiveRAGSystem } from '../../src/rag/progressiveRAG.js';
import { normalizeDiagnosisLines } from '../../src/shared/utils/report/normalizeDiagnosisLine.js';
// Phase 3 통합 보고서 — postprocess 파이프라인 싱글턴 (이벤트 추출 포함)
import postProcessingManager from '../postprocess/index.js';
// EnhancedMedicalTermProcessor는 CJS 모듈이므로 동적 import로 로드하여 테스트 환경(Jest) 호환성을 확보

const router = express.Router();
// __filename/__dirname은 본 라우트에서 사용하지 않으므로 테스트 환경 호환을 위해 제거

// OpenAI 클라이언트 지연 초기화 함수
function getOpenAIClient() {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
        project: process.env.OPENAI_PROJECT_ID
    });
}

// Zod 입력 스키마 (service 경계에서 검증)
const GenerateRequestSchema = z.object({
  extractedText: z.string().min(1, 'extractedText is required'),
  patientInfo: z
    .object({
      insuranceCompany: z.string().optional(),
      insuranceJoinDate: z.string().optional(),
      patientId: z.string().optional(),
      patientName: z.string().optional(),  // 🆕 환자 이름
      name: z.string().optional(),         // 🆕 환자 이름 (alias)
      birthDate: z.string().optional(),    // 🆕 생년월일
      dateOfBirth: z.string().optional(),  // 🆕 생년월일 (alias)
    })
    .optional(),
  options: z
    .object({
      useNineItem: z.boolean().optional(),
      useStructuredJson: z.boolean().optional(),  // 🆕 JSON 구조화 모드 (방안 C)
      template: z.enum(['standard', 'detailed', 'summary']).optional(),
      enableTranslationEnhancement: z.boolean().optional(),
      enableTermProcessing: z.boolean().optional(),
      skipLLM: z.boolean().optional(),
      timelineSummaryLimit: z.number().optional(),
      timelineLabelStyle: z.enum(['bracket', 'emoji', 'none']).optional(),
    })
    .optional(),
});

// DNA 시퀀싱 기반 보고서 생성 엔드포인트
router.post('/generate', async (req, res) => {
  const startTime = Date.now();
  try {

    // 입력 검증
    const parsed = GenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      logger.warn({ event: 'validation_failed', details: flat });
      return res.status(400).json({ success: false, error: 'Invalid request body', details: flat });
    }

    const { extractedText, patientInfo = {}, options = {} } = parsed.data;

    // 요청 로깅은 검증 이후로 이동하여 유효하지 않은 요청은 즉시 400 반환
    try {
      logApiRequest(req, { route: 'dna-report/generate' });
    } catch (_) {
      // 로깅 실패는 사용자 응답에 영향을 주지 않도록 무시
    }

    logProcessingStart('dna_report_generate', { patientId: patientInfo.patientId });

    // 보험사 유효성 검증 및 손해사정사 식별
    const insuranceService = new InsuranceValidationService();
    const insuranceValidation = patientInfo.insuranceCompany
      ? insuranceService.validateInsuranceCompany(patientInfo.insuranceCompany)
      : { valid: false, normalized: null, isAdjuster: false };

    // 강화된 의료 지식 베이스 로드
    const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();
    
    // 🆕 JSON 구조화 모드 (방안 C) 또는 기존 모드 선택
    const useStructuredJson = options.useStructuredJson ?? true;  // 기본값: true (JSON 모드)
    
    // GPT 입력 텍스트 길이 제한 (토큰 초과 방지)
    const MAX_INPUT_CHARS = 80000; // ~25,000 tokens (시스템 프롬프트 여유분 포함)
    const textForLLM = extractedText.length > MAX_INPUT_CHARS
      ? extractedText.slice(0, MAX_INPUT_CHARS) + '\n\n[이하 텍스트 길이 초과로 생략]'
      : extractedText;
    if (textForLLM !== extractedText) {
      logger.warn({ event: 'input_truncated', originalLength: extractedText.length, truncatedLength: MAX_INPUT_CHARS });
    }

    let systemPrompt, userPrompt;
    if (useStructuredJson) {
      // JSON 구조화 모드: 10항목 보고서를 JSON으로 생성
      const jsonPrompts = buildStructuredJsonPrompt(
        textForLLM,
        knowledgeBase,
        patientInfo?.insuranceJoinDate,
        patientInfo  // 🆕 환자 정보 전달
      );
      systemPrompt = jsonPrompts.systemPrompt;
      userPrompt = jsonPrompts.userPrompt;
      logger.info({ event: 'using_structured_json_mode', hasPatientInfo: !!(patientInfo?.patientName || patientInfo?.name) });
    } else {
      // 기존 모드: 텍스트 형식 보고서
      const legacyPrompts = buildEnhancedMedicalDnaPrompt(
        textForLLM,
        knowledgeBase,
        patientInfo?.insuranceJoinDate
      );
      systemPrompt = legacyPrompts.systemPrompt;
      userPrompt = legacyPrompts.userPrompt;
    }

    // GPT 호출 또는 스킵
    const openai = options.skipLLM ? null : getOpenAIClient();
    let baseReportText = '';
    let structuredJsonData = null;  // 🆕 JSON 구조화 데이터

    if (options.skipLLM) {
      // 개발/테스트용 LLM 스킵: 입력 텍스트를 기반으로 간단한 보고서 헤더만 부여
      baseReportText = `Report_Sample.txt\n\n[Input Summary]\n${extractedText}`;
      logger.info({ event: 'llm_skipped', reason: 'options.skipLLM=true' });
    } else if (useStructuredJson) {
      // 🆕 JSON 모드로 GPT 호출
      const jsonModelOptions = getJsonModelOptions();
      const completion = await openai.chat.completions.create({
        ...jsonModelOptions,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      
      const rawResponse = completion.choices[0]?.message?.content ?? '{}';
      logger.info({ event: 'gpt_json_response_received', length: rawResponse.length });
      
      try {
        // JSON 파싱 및 검증
        structuredJsonData = JSON.parse(rawResponse);
        const validation = validateReportSchema(structuredJsonData);
        
        logger.info({ 
          event: 'json_validation_result', 
          valid: validation.valid,
          completenessScore: validation.completenessScore,
          missingFields: validation.missingFields,
          emptyFields: validation.emptyFields
        });
        
        // 항상 기본값 적용 (누락/빈값 필드 모두 보완)
        structuredJsonData = applyDefaultValues(structuredJsonData, validation);
        
        // 통원/입원 통계 자동 계산 및 보완
        structuredJsonData = calculateVisitStatistics(structuredJsonData);
        
        if (!validation.valid || validation.emptyFields.length > 0) {
          logger.warn({ 
            event: 'applied_default_values', 
            missingFields: validation.missingFields,
            emptyFields: validation.emptyFields 
          });
        }
        
        // 구조화된 보고서 생성기로 텍스트 변환
        const reportGenerator = new StructuredReportGenerator({ debug: false });
        const reportResult = await reportGenerator.generateReport(structuredJsonData);
        
        baseReportText = reportResult.report;
        logger.info({ 
          event: 'structured_report_generated', 
          completenessScore: reportResult.validation?.completenessScore 
        });
        
      } catch (parseError) {
        // JSON 파싱 실패 시 폴백
        logger.error({ event: 'json_parse_failed', error: parseError.message });
        baseReportText = `[JSON 파싱 실패 - 원본 응답]\n${rawResponse}`;
        structuredJsonData = null;
      }
      
    } else {
      // 기존 텍스트 모드
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });
      baseReportText = completion.choices[0]?.message?.content ?? '';
    }

    // 번역 강화 (영-한 병기 등)
    const translationService = new MedicalTermTranslationService();
    let enhancedText = baseReportText;
    let translationMeta = { enhancementCount: 0 };
    if (options.enableTranslationEnhancement) {
      try {
        const enhanced = await translationService.enhanceTextWithTranslations(baseReportText);
        enhancedText = enhanced.enhancedText;
        translationMeta = { enhancementCount: enhanced.enhancementCount };
      } catch (err) {
        logProcessingError('translation_enhancement', err, { patientId: patientInfo.patientId });
      }
    }

    // 의료용어 종합 처리(보험 컨텍스트/ICD/용어 강화)
    let termProcessingMeta = {};
    if (options.enableTermProcessing) {
      try {
        const { default: EnhancedMedicalTermProcessor } = await import('../postprocess/enhancedMedicalTermProcessor.cjs');
        const processor = new EnhancedMedicalTermProcessor();
        const processed = processor.processComprehensive(enhancedText, {
          insuranceCompany: patientInfo.insuranceCompany,
        });
        enhancedText = processed.processedText || enhancedText;
        termProcessingMeta = {
          statistics: processed.statistics,
          pairedTerms: processed.termEnhancement?.pairedTerms?.length ?? 0,
          icdCodes: processed.termEnhancement?.icdCodes?.length ?? 0,
        };
      } catch (err) {
        logProcessingError('term_processing', err, { patientId: patientInfo.patientId });
      }
    }

    // 9항목 보고서 생성 (옵션)
    let nineItemResult = null;
    if (options.useNineItem) {
      try {
        const { default: NineItemReportGenerator } = await import('../services/nineItemReportGenerator.js');
        const generator = new NineItemReportGenerator({
          timelineSummaryLimit: options.timelineSummaryLimit,
          timelineLabelStyle: options.timelineLabelStyle,
          useEnhancedExtractors: true
        });
        const geneSegments = (extractedText || '')
          .split(/\r?\n\r?\n|\r?\n/)
          .map((s) => ({ type: 'text_segment', content: s.trim(), confidence: 0.5 }));
        const dnaResult = {
          extracted_genes: geneSegments,
          causal_network: {},
        };
        nineItemResult = await generator.generateReport(dnaResult, patientInfo, {
          template: options.template || 'standard',
          // 개발/테스트 환경에서 복잡도 낮은 입력으로 AI 경로를 최대한 회피
          strategy: 'logic',
        });
        logger.info({ event: 'nine_item_generated', quality: nineItemResult?.validation?.score });
      } catch (err) {
        logProcessingError('nine_item_generate', err, { patientId: patientInfo.patientId });
      }
    }

    // 진단 라인 정규화(중복 제거/괄호 정리/ICD 표기 통일)
    try {
      const { normalizedText, stats } = normalizeDiagnosisLines(enhancedText);
      if (stats.adjustments > 0) {
        logger.info({ event: 'diagnosis_normalization_applied', adjustments: stats.adjustments });
      }
      enhancedText = normalizedText;
    } catch (err) {
      logProcessingError('diagnosis_normalization', err, { patientId: patientInfo.patientId });
    }

    const processingTimeMs = Date.now() - startTime;

    try {
      const rag = new ProgressiveRAGSystem();
      await rag.initialize();
      await rag.saveAnalysisResult(`dna_${Date.now()}`, enhancedText, { patientId: patientInfo.patientId || null });
    } catch (e) {
      logProcessingError('rag_save', e, { patientId: patientInfo.patientId });
    }
    // 🆕 응답 메시지 결정
    let responseMessage = 'Report_Sample.txt 양식 보고서 생성 완료';
    if (useStructuredJson && structuredJsonData) {
      responseMessage = '10항목 구조화 보고서 생성 완료 (JSON 모드)';
    } else if (options.useNineItem) {
      responseMessage = '9항목 보고서 생성 완료';
    }

    // 🆕 최종 보고서 결정 (우선순위: 구조화 JSON > 9항목 > 텍스트)
    let finalReport = enhancedText;
    if (useStructuredJson && structuredJsonData) {
      finalReport = enhancedText;  // structuredReportGenerator에서 생성된 텍스트
    } else if (options.useNineItem && nineItemResult?.report) {
      finalReport = nineItemResult.report;
    }

    // Phase 3: postprocess 파이프라인으로 UnifiedReport 생성 (RAG 규칙 v2)
    // processOCRResult → medicalEvents 추출 → UnifiedReportBuilder.buildReport()
    let unifiedReport = null;
    try {
      const pipelinePatientInfo = {
        insuranceJoinDate: patientInfo.insuranceJoinDate,
        insuranceCompany: patientInfo.insuranceCompany,
        name: patientInfo.patientName || patientInfo.name,
        birthDate: patientInfo.birthDate || patientInfo.dateOfBirth,
        productType: patientInfo.productType,
      };
      const pipelineResult = await postProcessingManager.processOCRResult(extractedText, {
        patientInfo: pipelinePatientInfo,
        minConfidence: 0.35,
        includeAll: false,
        useHybridApproach: true,
        gptStructuredData: structuredJsonData || null,  // GPT 구조화 데이터 → 이벤트 카드 보강
      });
      unifiedReport = pipelineResult?.pipeline?.unifiedReport || null;
      if (unifiedReport) {
        logger.info({ event: 'unified_report_generated', within3M: unifiedReport.metadata?.within3M, within5Y: unifiedReport.metadata?.within5Y });
      } else {
        logger.warn({ event: 'unified_report_empty', pipelineSuccess: pipelineResult?.success });
      }
    } catch (unifiedErr) {
      logger.warn({ event: 'unified_report_failed', error: unifiedErr.message });
    }

    const responsePayload = {
      success: true,
      message: responseMessage,
      pipeline: useStructuredJson ? 'Structured JSON + Template Engine' : 'Enhanced DNA Sequencing + Timeline Analysis',
      report: finalReport,
      reportText: enhancedText,
      structuredData: structuredJsonData,  // 🆕 JSON 구조화 데이터 포함
      unifiedReport,  // Phase 3: 날짜 오름차순 10항목 경과보고서 (RAG 규칙 v2)
      processingTime: `${processingTimeMs}ms`,
      model: options.skipLLM ? 'skipped' : 'gpt-4o-mini',
      timestamp: new Date().toISOString(),
      sessionId: `dna_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        insuranceValidation,
        translation: translationMeta,
        useStructuredJson,  // 🆕 JSON 모드 사용 여부
        termProcessing: termProcessingMeta,
        nineItem: nineItemResult
          ? {
              validation: nineItemResult.validation,
              statistics: nineItemResult.statistics,
              performanceMetrics: nineItemResult.performanceMetrics,
            }
          : undefined,
      },
    };

    logProcessingComplete('dna_report_generate', processingTimeMs, {
      size: extractedText.length,
      usedNineItem: !!options.useNineItem,
    });
    logApiResponse(req, res, processingTimeMs, { route: 'dna-report/generate' });
    return res.json(responsePayload);
  } catch (error) {
    logProcessingError('dna_report_generate', error, {});

    const errorResponse = {
      success: false,
      error: error.message,
      errorType: error.constructor?.name || 'Error',
      timestamp: new Date().toISOString(),
      fallbackReport: {
        피보험자_기본정보: '시스템 오류로 인한 추출 실패',
        사고_발생_경위: '시스템 오류로 인한 추출 실패',
        초기_증상_및_진료: '시스템 오류로 인한 추출 실패',
        진단_및_검사결과: '시스템 오류로 인한 추출 실패',
        치료_경과: '시스템 오류로 인한 추출 실패',
        현재_상태: '시스템 오류로 인한 추출 실패',
        의료비_지출현황: '시스템 오류로 인한 추출 실패',
        향후_치료계획: '시스템 오류로 인한 추출 실패',
        종합의견: `Enhanced DNA 시퀀싱 처리 중 오류 발생: ${error.message}`,
      },
    };

    if (error.message?.includes('429')) {
      errorResponse.rateLimitExceeded = true;
      errorResponse.suggestion = 'API 사용량 한도 초과. 잠시 후 다시 시도하세요.';
    } else if (error.message?.includes('401')) {
      errorResponse.authenticationError = true;
      errorResponse.suggestion = 'API 키 인증 실패. 환경 변수를 확인하세요.';
    } else if (error.message?.includes('timeout')) {
      errorResponse.timeoutError = true;
      errorResponse.suggestion = '처리 시간 초과. 텍스트 길이를 줄이거나 다시 시도하세요.';
    }

    return res.status(500).json(errorResponse);
  }
});

export default router;
