/**
 * Integrated Medical Analysis Service
 *
 * 전체 의료 문서 분석 파이프라인 통합 서비스
 * - Vision LLM OCR
 * - Ensemble 날짜 추출 (좌표 + 비좌표)
 * - Medical Timeline 생성
 * - HTML 보고서 출력
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { OCRProviderFactory } from '../providers/ocr/OCRProviderFactory';
import { EnsembleDateExtractor } from '../extractors/EnsembleDateExtractor';
import { MedicalTimelineBuilder } from '../builders/MedicalTimelineBuilder';
import { TextBlock } from './enhancedDateExtractor';
import { OCRBlock } from '../providers/ocr/IOCRProvider';
import { logger } from '../../../shared/logging/logger';

export interface AnalysisOptions {
  // OCR 설정
  ocrProvider?: 'gpt-4o-vision' | 'claude-vision' | 'gemini-vision';
  useEnsemble?: boolean; // Ensemble 사용 여부 (기본 true)

  // 출력 설정
  generateHTML?: boolean; // HTML 보고서 생성 (기본 true)
  outputDir?: string; // 출력 디렉토리 (기본 './outputs')

  // 추가 정보
  patientName?: string;
  insuranceCompany?: string;
}

export interface AnalysisResult {
  success: boolean;
  metadata: {
    inputFile: string;
    processingTime: number;
    ocrProvider: string;
    ocrCost?: number;
    dateCount: number;
    eventCount: number;
  };
  timeline?: {
    events: any[];
    summary: string;
    isValid: boolean;
    warnings: string[];
  };
  outputFiles?: {
    html?: string;
    json?: string;
  };
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Integrated Medical Analysis Service
 */
export class IntegratedMedicalAnalysisService {
  private ensembleExtractor: EnsembleDateExtractor;
  private timelineBuilder: MedicalTimelineBuilder;

  constructor() {
    this.ensembleExtractor = new EnsembleDateExtractor();
    this.timelineBuilder = new MedicalTimelineBuilder();
  }

  /**
   * PDF 파일 분석 (전체 파이프라인)
   */
  async analyzePDF(pdfPath: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const startTime = Date.now();

    const {
      ocrProvider = 'gpt-4o-vision',
      useEnsemble = true,
      generateHTML = true,
      outputDir = './outputs',
      patientName,
      insuranceCompany,
    } = options;

    try {
      logger.info({
        event: 'integrated_analysis_start',
        pdfPath,
        options,
      });

      // 1. OCR Provider 초기화
      await OCRProviderFactory.initialize();
      const provider = OCRProviderFactory.create(ocrProvider);

      logger.info({
        event: 'ocr_provider_selected',
        providerName: provider.name,
        capabilities: provider.capabilities,
      });

      // 2. OCR 실행 (Vision LLM)
      const ocrResult = await provider.extractText({
        type: 'pdf',
        path: pdfPath,
      });

      logger.info({
        event: 'ocr_complete',
        blockCount: ocrResult.blocks.length,
        pageCount: ocrResult.metadata.pageCount,
        processingTime: ocrResult.metadata.processingTime,
        cost: ocrResult.metadata.totalCost,
      });

      // 3. OCRBlock → TextBlock 변환
      const textBlocks = this.convertOCRBlocksToTextBlocks(ocrResult.blocks);

      // 4. Ensemble 날짜 추출
      const extractedDates = await this.ensembleExtractor.extractDates(textBlocks, {
        useCoordinateBased: ocrResult.metadata.hasCoordinates,
        useNonCoordinateBased: true,
        mergingStrategy: 'union',
      });

      logger.info({
        event: 'date_extraction_complete',
        dateCount: extractedDates.length,
      });

      // 5. Timeline 생성
      const timeline = await this.timelineBuilder.buildTimeline(extractedDates, {
        patientInfo: {
          name: patientName,
          insuranceCompany,
        },
      });

      logger.info({
        event: 'timeline_build_complete',
        eventCount: timeline.events.length,
        isValid: timeline.isValid,
        warnings: timeline.warnings.length,
      });

      // 6. 출력 파일 생성
      const outputFiles: { html?: string; json?: string } = {};

      if (generateHTML || outputDir) {
        // 출력 디렉토리 생성
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        const baseName = basename(pdfPath, '.pdf');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        // JSON 저장
        const jsonPath = join(outputDir, `${baseName}-${timestamp}-result.json`);
        const jsonData = {
          metadata: {
            inputFile: pdfPath,
            processingTime: Date.now() - startTime,
            ocrProvider: provider.name,
            ocrCost: ocrResult.metadata.totalCost,
            dateCount: extractedDates.length,
            eventCount: timeline.events.length,
          },
          timeline,
          extractedDates,
        };
        writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
        outputFiles.json = jsonPath;

        logger.info({
          event: 'json_report_saved',
          path: jsonPath,
        });

        // HTML 저장
        if (generateHTML) {
          const htmlPath = join(outputDir, `${baseName}-${timestamp}-timeline.html`);
          const htmlContent = this.timelineBuilder.generateHTMLTimeline(timeline);
          writeFileSync(htmlPath, htmlContent);
          outputFiles.html = htmlPath;

          logger.info({
            event: 'html_report_saved',
            path: htmlPath,
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        metadata: {
          inputFile: pdfPath,
          processingTime,
          ocrProvider: provider.name,
          ocrCost: ocrResult.metadata.totalCost,
          dateCount: extractedDates.length,
          eventCount: timeline.events.length,
        },
        timeline: {
          events: timeline.events,
          summary: timeline.summary,
          isValid: timeline.isValid,
          warnings: timeline.warnings,
        },
        outputFiles,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        event: 'integrated_analysis_error',
        error: error as Error,
        processingTime,
      });

      return {
        success: false,
        metadata: {
          inputFile: pdfPath,
          processingTime,
          ocrProvider,
          dateCount: 0,
          eventCount: 0,
        },
        error: {
          message: (error as Error).message,
          stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
        },
      };
    }
  }

  /**
   * OCRBlock → TextBlock 변환
   */
  private convertOCRBlocksToTextBlocks(ocrBlocks: OCRBlock[]): TextBlock[] {
    return ocrBlocks.map((block) => ({
      page: block.pageIndex || 0,
      text: block.text,
      bbox: block.bbox || { x: 0, y: 0, width: 0, height: 0 },
      confidence: block.confidence,
    }));
  }

  /**
   * 배치 분석 (여러 PDF)
   */
  async analyzeBatch(
    pdfPaths: string[],
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    logger.info({
      event: 'batch_analysis_start',
      fileCount: pdfPaths.length,
    });

    for (const pdfPath of pdfPaths) {
      const result = await this.analyzePDF(pdfPath, options);
      results.push(result);

      // 에러 발생 시 로그만 남기고 계속 진행
      if (!result.success) {
        logger.warn({
          event: 'batch_analysis_file_failed',
          pdfPath,
          error: result.error?.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    logger.info({
      event: 'batch_analysis_complete',
      totalFiles: pdfPaths.length,
      successCount,
      failureCount: pdfPaths.length - successCount,
    });

    return results;
  }

  /**
   * 통계 생성
   */
  generateStatistics(results: AnalysisResult[]): {
    totalFiles: number;
    successCount: number;
    failureCount: number;
    totalDates: number;
    totalEvents: number;
    avgDatesPerFile: number;
    avgEventsPerFile: number;
    totalCost: number;
    avgCostPerFile: number;
    totalProcessingTime: number;
    avgProcessingTimePerFile: number;
  } {
    const successResults = results.filter((r) => r.success);

    const totalDates = successResults.reduce((sum, r) => sum + r.metadata.dateCount, 0);
    const totalEvents = successResults.reduce((sum, r) => sum + r.metadata.eventCount, 0);
    const totalCost = successResults.reduce((sum, r) => sum + (r.metadata.ocrCost || 0), 0);
    const totalProcessingTime = results.reduce((sum, r) => sum + r.metadata.processingTime, 0);

    return {
      totalFiles: results.length,
      successCount: successResults.length,
      failureCount: results.length - successResults.length,
      totalDates,
      totalEvents,
      avgDatesPerFile: successResults.length > 0 ? totalDates / successResults.length : 0,
      avgEventsPerFile: successResults.length > 0 ? totalEvents / successResults.length : 0,
      totalCost,
      avgCostPerFile: successResults.length > 0 ? totalCost / successResults.length : 0,
      totalProcessingTime,
      avgProcessingTimePerFile: results.length > 0 ? totalProcessingTime / results.length : 0,
    };
  }
}

// 싱글톤 인스턴스
let serviceInstance: IntegratedMedicalAnalysisService | null = null;

export function getIntegratedMedicalAnalysisService(): IntegratedMedicalAnalysisService {
  if (!serviceInstance) {
    serviceInstance = new IntegratedMedicalAnalysisService();
  }
  return serviceInstance;
}
