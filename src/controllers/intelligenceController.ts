/**
 * Intelligence Controller - 새로운 지능형 의료문서 처리 컨트롤러
 * 
 * 혁신적 특징:
 * 1. 기존 시스템과의 완벽한 호환성
 * 2. 적응형 처리 전략 자동 선택
 * 3. 실시간 성능 모니터링 및 최적화
 * 4. 멀티 패널 UI 지원 (RAW/THREAD/FINAL)
 */

import { IntelligenceBridge, IntelligenceBridgeConfig, BridgeResult } from '../intelligence/intelligenceBridge';
import { AdaptiveProcessor, ProcessingConfig, ProcessingContext } from '../intelligence/adaptiveProcessor';
import reportController from './reportController';
import path from 'path';
import fs from 'fs/promises';

export interface IntelligenceRequest {
  rawText: string;
  jobId?: string;
  processingMode?: 'FAST' | 'BALANCED' | 'THOROUGH';
  forceStrategy?: 'LEGACY' | 'INTELLIGENCE' | 'HYBRID';
  enableRealTime?: boolean;
  costLimit?: number;
  accuracyThreshold?: number;
  outputFormat?: 'STANDARD' | 'ENHANCED' | 'MULTI_PANEL';
  patientInfo?: any;
  insuranceInfo?: any;
  // Progressive RAG 관련 옵션
  enableProgressiveRAG?: boolean;
  ragMaxResults?: number;
  ragConfidenceThreshold?: number;
}

export interface IntelligenceResponse {
  success: boolean;
  jobId: string;
  processingStrategy: 'LEGACY' | 'INTELLIGENCE' | 'HYBRID';
  results: {
    raw?: RawPanelData;
    thread?: ThreadPanelData;
    final?: FinalPanelData;
  };
  performance: {
    totalTime: number;
    totalCost: number;
    qualityScore: number;
    efficiency: number;
  };
  recommendations: {
    nextProcessing: string;
    optimizations: string[];
    costSavings: string[];
  };
  metadata: {
    timestamp: string;
    version: string;
    processingStages: any[];
  };
  error?: string;
}

export interface RawPanelData {
  originalText: string;
  cleanedText: string;
  chunks: any[];
  filterResults: any;
  statistics: {
    totalCharacters: number;
    processedChunks: number;
    relevantChunks: number;
    averageRelevance: number;
  };
}

export interface ThreadPanelData {
  events: any[];
  nerResults: any[];
  connections: any[];
  qualityMetrics: {
    extractionAccuracy: number;
    eventConfidence: number;
    completeness: number;
  };
  visualizations: {
    eventTimeline: any[];
    connectionGraph: any;
    confidenceDistribution: any;
  };
}

export interface FinalPanelData {
  timeline: any;
  summary: any;
  riskAssessment: any;
  insuranceRecommendations: any[];
  report: {
    standardReport: any;
    enhancedAnalysis: any;
    executiveSummary: string;
  };
  insights: {
    keyFindings: string[];
    riskFactors: string[];
    recommendations: string[];
  };
}

class IntelligenceController {
  private static instance: IntelligenceController;
  private intelligenceBridge: IntelligenceBridge;
  private processingHistory: Map<string, BridgeResult> = new Map();
  
  private constructor() {
    // Intelligence Bridge 초기화
    const bridgeConfig: Partial<IntelligenceBridgeConfig> = {
      useNewIntelligence: true,
      hybridMode: false,
      fallbackToLegacy: true,
      performanceThreshold: 0.8,
      costThreshold: 0.7
    };
    
    this.intelligenceBridge = new IntelligenceBridge(bridgeConfig);
  }
  
  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): IntelligenceController {
    if (!IntelligenceController.instance) {
      IntelligenceController.instance = new IntelligenceController();
    }
    return IntelligenceController.instance;
  }

  /**
   * 메인 지능형 처리 엔드포인트
   */
  public async processDocument(request: IntelligenceRequest): Promise<IntelligenceResponse> {
    const startTime = Date.now();
    const jobId = request.jobId || this.generateJobId();
    
    try {
      console.log(`🧠 Intelligence Controller: 문서 처리 시작 (jobId=${jobId})`);
      
      // 입력 검증
      this.validateRequest(request);
      
      // 처리 옵션 구성
      const processingOptions = this.buildProcessingOptions(request);
      
      // Intelligence Bridge를 통한 처리
      const bridgeResult = await this.intelligenceBridge.processDocument(
        request.rawText,
        processingOptions
      );
      
      // 결과를 UI 패널 형식으로 변환
      const panelData = await this.convertToPanelData(bridgeResult, request);
      
      // 처리 히스토리 저장
      this.processingHistory.set(jobId, bridgeResult);
      
      // 출력 파일 생성 (요청 시)
      if (request.outputFormat !== 'STANDARD') {
        await this.generateOutputFiles(jobId, panelData, bridgeResult);
      }
      
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Intelligence Controller: 처리 완료 (${totalTime}ms, strategy=${bridgeResult.source})`);
      
      return {
        success: true,
        jobId,
        processingStrategy: bridgeResult.source,
        results: panelData,
        performance: {
          totalTime,
          totalCost: bridgeResult.performanceMetrics.totalCost,
          qualityScore: bridgeResult.performanceMetrics.qualityScore,
          efficiency: this.calculateEfficiency(bridgeResult.performanceMetrics)
        },
        recommendations: await this.generateRecommendations(bridgeResult),
        metadata: {
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          processingStages: bridgeResult.intelligenceResult?.processingStages || []
        }
      };
      
    } catch (error: any) {
      console.error(`❌ Intelligence Controller: 처리 실패 (jobId=${jobId})`, error);
      
      return {
        success: false,
        jobId,
        processingStrategy: 'LEGACY',
        results: {},
        performance: {
          totalTime: Date.now() - startTime,
          totalCost: 0,
          qualityScore: 0,
          efficiency: 0
        },
        recommendations: {
          nextProcessing: 'Retry with legacy system',
          optimizations: [],
          costSavings: []
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          processingStages: []
        },
        error: error.message
      };
    }
  }

  /**
   * 실시간 처리 상태 조회
   */
  public async getProcessingStatus(jobId: string): Promise<any> {
    const result = this.processingHistory.get(jobId);
    
    if (!result) {
      return {
        success: false,
        error: 'Job not found'
      };
    }
    
    return {
      success: true,
      jobId,
      status: 'COMPLETED',
      progress: 100,
      stages: result.intelligenceResult?.processingStages || [],
      performance: result.performanceMetrics
    };
  }

  /**
   * 성능 통계 조회
   */
  public getPerformanceStats(): any {
    return {
      bridgeStats: this.intelligenceBridge.getPerformanceStats(),
      processingHistory: {
        totalJobs: this.processingHistory.size,
        recentJobs: Array.from(this.processingHistory.entries())
          .slice(-10)
          .map(([jobId, result]) => ({
            jobId,
            strategy: result.source,
            performance: result.performanceMetrics
          }))
      }
    };
  }

  /**
   * 설정 업데이트
   */
  public updateConfiguration(config: Partial<IntelligenceBridgeConfig>): void {
    this.intelligenceBridge.updateConfig(config);
  }

  /**
   * Express 핸들러 - 문서 처리
   */
  public async documentHandler(req: any, res: any): Promise<void> {
    try {
      const request: IntelligenceRequest = {
        rawText: req.body.text || req.body.rawText,
        jobId: req.body.jobId,
        processingMode: req.body.mode || 'BALANCED',
        forceStrategy: req.body.strategy,
        enableRealTime: req.body.realTime || false,
        costLimit: req.body.costLimit,
        accuracyThreshold: req.body.accuracyThreshold,
        outputFormat: req.body.outputFormat || 'STANDARD',
        patientInfo: req.body.patientInfo,
        insuranceInfo: req.body.insuranceInfo
      };
      
      const response = await this.processDocument(request);
      res.json(response);
      
    } catch (error: any) {
      console.error('Document handler error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '문서 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Express 핸들러 - 상태 조회
   */
  public async statusHandler(req: any, res: any): Promise<void> {
    try {
      const jobId = req.params.jobId || req.query.jobId;
      const status = await this.getProcessingStatus(jobId);
      res.json(status);
      
    } catch (error: any) {
      console.error('Status handler error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '상태 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Express 핸들러 - 성능 통계
   */
  public async statsHandler(req: any, res: any): Promise<void> {
    try {
      const stats = this.getPerformanceStats();
      res.json({
        success: true,
        stats
      });
      
    } catch (error: any) {
      console.error('Stats handler error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '통계 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Express 핸들러 - 설정 업데이트
   */
  public async configHandler(req: any, res: any): Promise<void> {
    try {
      const config = req.body;
      this.updateConfiguration(config);
      
      res.json({
        success: true,
        message: '설정이 업데이트되었습니다.'
      });
      
    } catch (error: any) {
      console.error('Config handler error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '설정 업데이트 중 오류가 발생했습니다.'
      });
    }
  }

  // 유틸리티 메서드들
  private validateRequest(request: IntelligenceRequest): void {
    if (!request.rawText || request.rawText.trim().length === 0) {
      throw new Error('rawText is required and cannot be empty');
    }
    
    if (request.rawText.length > 500000) { // 500KB 제한
      throw new Error('rawText is too large (max 500KB)');
    }
  }

  private buildProcessingOptions(request: IntelligenceRequest): any {
    return {
      mode: request.processingMode || 'BALANCED',
      forceStrategy: request.forceStrategy,
      costLimit: request.costLimit || 10000,
      accuracyThreshold: request.accuracyThreshold || 0.8,
      realTimeMode: request.enableRealTime || false,
      patientInfo: request.patientInfo,
      insuranceInfo: request.insuranceInfo,
      // Progressive RAG 통합 옵션
      enableProgressiveRAG: request.enableProgressiveRAG || false,
      ragOptions: {
        maxResults: request.ragMaxResults || 10,
        confidenceThreshold: request.ragConfidenceThreshold || 0.7,
        includeContext: true,
        includeICDCodes: true
      }
    };
  }

  private async convertToPanelData(
    bridgeResult: BridgeResult,
    request: IntelligenceRequest
  ): Promise<{ raw?: RawPanelData; thread?: ThreadPanelData; final?: FinalPanelData }> {
    const panelData: any = {};
    
    // RAW 패널 데이터
    if (bridgeResult.intelligenceResult?.rawData || bridgeResult.legacyResult) {
      panelData.raw = await this.buildRawPanelData(bridgeResult, request);
    }
    
    // THREAD 패널 데이터
    if (bridgeResult.intelligenceResult?.threadData || bridgeResult.legacyResult) {
      panelData.thread = await this.buildThreadPanelData(bridgeResult);
    }
    
    // FINAL 패널 데이터
    if (bridgeResult.intelligenceResult?.finalData || bridgeResult.legacyResult) {
      panelData.final = await this.buildFinalPanelData(bridgeResult);
    }
    
    return panelData;
  }

  private async buildRawPanelData(
    bridgeResult: BridgeResult,
    request: IntelligenceRequest
  ): Promise<RawPanelData> {
    const rawData = bridgeResult.intelligenceResult?.rawData;
    
    if (rawData) {
      return {
        originalText: rawData.originalText,
        cleanedText: rawData.filterResults?.cleanedText || rawData.originalText,
        chunks: rawData.chunks || [],
        filterResults: rawData.filterResults || {},
        statistics: {
          totalCharacters: rawData.originalText.length,
          processedChunks: rawData.chunks?.length || 0,
          relevantChunks: rawData.chunks?.filter((c: any) => c.relevanceScore > 0.3).length || 0,
          averageRelevance: this.calculateAverageRelevance(rawData.chunks || [])
        }
      };
    }
    
    // 레거시 결과 변환
    return {
      originalText: request.rawText,
      cleanedText: request.rawText,
      chunks: [],
      filterResults: {},
      statistics: {
        totalCharacters: request.rawText.length,
        processedChunks: 0,
        relevantChunks: 0,
        averageRelevance: 0
      }
    };
  }

  private async buildThreadPanelData(bridgeResult: BridgeResult): Promise<ThreadPanelData> {
    const threadData = bridgeResult.intelligenceResult?.threadData;
    const legacyData = bridgeResult.legacyResult;
    
    const events = threadData?.events || legacyData?.events || [];
    const nerResults = threadData?.nerResults || [];
    
    return {
      events,
      nerResults,
      connections: this.extractConnections(events),
      qualityMetrics: {
        extractionAccuracy: threadData?.qualityScore || 0.7,
        eventConfidence: this.calculateAverageConfidence(events),
        completeness: this.calculateCompleteness(events)
      },
      visualizations: {
        eventTimeline: this.buildEventTimeline(events),
        connectionGraph: this.buildConnectionGraph(events),
        confidenceDistribution: this.buildConfidenceDistribution(events)
      }
    };
  }

  private async buildFinalPanelData(bridgeResult: BridgeResult): Promise<FinalPanelData> {
    const finalData = bridgeResult.intelligenceResult?.finalData;
    const legacyData = bridgeResult.legacyResult;
    
    // 기존 리포트 시스템과 통합
    let standardReport = null;
    if (legacyData?.events) {
      try {
        const reportResult = await reportController.generateReport({
          parsedEvents: legacyData.events,
          jobId: this.generateJobId()
        });
        standardReport = reportResult;
      } catch (error) {
        console.warn('Legacy report generation failed:', error);
      }
    }
    
    return {
      timeline: finalData?.timeline || {},
      summary: finalData?.summary || {},
      riskAssessment: finalData?.timeline?.riskAssessment || {},
      insuranceRecommendations: finalData?.timeline?.insuranceRecommendations || [],
      report: {
        standardReport,
        enhancedAnalysis: finalData?.timeline?.summary || {},
        executiveSummary: this.generateExecutiveSummary(finalData?.timeline)
      },
      insights: {
        keyFindings: this.extractKeyFindings(finalData?.timeline),
        riskFactors: this.extractRiskFactors(finalData?.timeline),
        recommendations: this.extractRecommendations(finalData?.timeline)
      }
    };
  }

  private async generateOutputFiles(
    jobId: string,
    panelData: any,
    bridgeResult: BridgeResult
  ): Promise<void> {
    const outputDir = path.resolve(process.cwd(), 'outputs', jobId);
    
    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      // JSON 결과 저장
      await fs.writeFile(
        path.join(outputDir, 'intelligence_result.json'),
        JSON.stringify({
          panelData,
          bridgeResult: {
            source: bridgeResult.source,
            performanceMetrics: bridgeResult.performanceMetrics,
            recommendation: bridgeResult.recommendation
          }
        }, null, 2)
      );
      
      // 요약 리포트 저장
      if (panelData.final?.report?.executiveSummary) {
        await fs.writeFile(
          path.join(outputDir, 'executive_summary.txt'),
          panelData.final.report.executiveSummary
        );
      }
      
      console.log(`📁 Output files generated: ${outputDir}`);
      
    } catch (error) {
      console.warn('Failed to generate output files:', error);
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateEfficiency(metrics: any): number {
    // 효율성 = 품질 / (시간 * 비용 계수)
    const timeScore = Math.max(0, 1 - (metrics.totalTime / 60000)); // 1분 기준
    const costScore = Math.max(0, 1 - (metrics.totalCost / 10000)); // 비용 기준
    
    return (metrics.qualityScore * 0.5) + (timeScore * 0.3) + (costScore * 0.2);
  }

  private async generateRecommendations(bridgeResult: BridgeResult): Promise<any> {
    const recommendations = {
      nextProcessing: 'Continue with current strategy',
      optimizations: [] as string[],
      costSavings: [] as string[]
    };
    
    // 성능 기반 추천
    if (bridgeResult.performanceMetrics.qualityScore < 0.7) {
      recommendations.optimizations.push('Consider THOROUGH mode for better accuracy');
    }
    
    if (bridgeResult.performanceMetrics.totalCost > 8000) {
      recommendations.costSavings.push('Use FAST mode or increase local NER usage');
    }
    
    if (bridgeResult.source === 'LEGACY' && bridgeResult.performanceMetrics.qualityScore > 0.8) {
      recommendations.nextProcessing = 'Consider migrating to Intelligence system';
    }
    
    return recommendations;
  }

  // 데이터 처리 유틸리티 메서드들
  private calculateAverageRelevance(chunks: any[]): number {
    if (chunks.length === 0) return 0;
    return chunks.reduce((sum, chunk) => sum + (chunk.relevanceScore || 0), 0) / chunks.length;
  }

  private extractConnections(events: any[]): any[] {
    return events.flatMap(event => 
      (event.relatedEvents || []).map((relatedId: string) => ({
        source: event.id,
        target: relatedId,
        type: 'RELATED'
      }))
    );
  }

  private calculateAverageConfidence(events: any[]): number {
    if (events.length === 0) return 0;
    return events.reduce((sum, event) => sum + (event.confidence || 0), 0) / events.length;
  }

  private calculateCompleteness(events: any[]): number {
    if (events.length === 0) return 0;
    const completeEvents = events.filter(event => 
      event.serviceDate && event.institution && event.description
    );
    return completeEvents.length / events.length;
  }

  private buildEventTimeline(events: any[]): any[] {
    return events
      .filter(event => event.serviceDate)
      .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime())
      .map(event => ({
        date: event.serviceDate,
        type: event.eventType,
        description: event.description,
        importance: event.importance
      }));
  }

  private buildConnectionGraph(events: any[]): any {
    const nodes = events.map(event => ({
      id: event.id,
      label: event.description?.substring(0, 50) || 'Unknown',
      type: event.eventType
    }));
    
    const edges = this.extractConnections(events);
    
    return { nodes, edges };
  }

  private buildConfidenceDistribution(events: any[]): any {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    events.forEach(event => {
      const confidence = event.confidence || 0;
      if (confidence >= 0.8) distribution.high++;
      else if (confidence >= 0.5) distribution.medium++;
      else distribution.low++;
    });
    
    return distribution;
  }

  private generateExecutiveSummary(timeline: any): string {
    if (!timeline) return '분석 결과가 없습니다.';
    
    const summary = timeline.summary || {};
    const riskAssessment = timeline.riskAssessment || {};
    
    return `
의료문서 분석 요약 보고서

📊 기본 정보:
- 분석 기간: ${summary.dateRange?.start || 'N/A'} ~ ${summary.dateRange?.end || 'N/A'}
- 총 이벤트 수: ${summary.totalEvents || 0}개
- 주요 진료기관: ${summary.keyInstitutions?.join(', ') || 'N/A'}

🏥 주요 진단:
${summary.majorDiagnoses?.map((d: any) => `- ${d.name || d.code}`).join('\n') || '- 주요 진단 없음'}

⚠️ 위험도 평가:
- 전체 위험도: ${riskAssessment.overallRisk || 'N/A'}
- 기왕력: ${riskAssessment.preExistingConditions?.length || 0}건
- 합병증 위험: ${Math.round((riskAssessment.complicationRisk || 0) * 100)}%

💡 주요 소견:
${timeline.events?.filter((e: any) => e.importance === 'HIGH').map((e: any) => `- ${e.description}`).slice(0, 3).join('\n') || '- 특이사항 없음'}

이 보고서는 AI 기반 의료문서 분석 시스템에 의해 자동 생성되었습니다.
    `.trim();
  }

  private extractKeyFindings(timeline: any): string[] {
    if (!timeline) return [];
    
    const findings: string[] = [];
    
    // 중요 이벤트
    const criticalEvents = timeline.events?.filter((e: any) => e.importance === 'HIGH') || [];
    findings.push(...criticalEvents.map((e: any) => e.description).slice(0, 3));
    
    // 주요 진단
    const majorDiagnoses = timeline.summary?.majorDiagnoses || [];
    findings.push(...majorDiagnoses.map((d: any) => `주요 진단: ${d.name || d.code}`));
    
    return findings.slice(0, 5);
  }

  private extractRiskFactors(timeline: any): string[] {
    if (!timeline?.riskAssessment) return [];
    
    const riskFactors: string[] = [];
    const assessment = timeline.riskAssessment;
    
    if (assessment.overallRisk === 'HIGH' || assessment.overallRisk === 'CRITICAL') {
      riskFactors.push(`높은 전체 위험도: ${assessment.overallRisk}`);
    }
    
    if (assessment.preExistingConditions?.length > 0) {
      riskFactors.push(`기왕력 ${assessment.preExistingConditions.length}건`);
    }
    
    if (assessment.complicationRisk > 0.3) {
      riskFactors.push(`합병증 위험 ${Math.round(assessment.complicationRisk * 100)}%`);
    }
    
    return riskFactors;
  }

  private extractRecommendations(timeline: any): string[] {
    if (!timeline?.insuranceRecommendations) return [];
    
    return timeline.insuranceRecommendations
      .map((rec: any) => `${rec.type}: ${rec.reason}`)
      .slice(0, 3);
  }
}

// 컨트롤러 인스턴스 생성 및 내보내기
const intelligenceController = IntelligenceController.getInstance();
export default intelligenceController;

// Express 핸들러 함수들 내보내기
export const documentHandler = intelligenceController.documentHandler.bind(intelligenceController);
export const statusHandler = intelligenceController.statusHandler.bind(intelligenceController);
export const statsHandler = intelligenceController.statsHandler.bind(intelligenceController);
export const configHandler = intelligenceController.configHandler.bind(intelligenceController);