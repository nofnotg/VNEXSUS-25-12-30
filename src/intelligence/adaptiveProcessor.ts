/**
 * Adaptive Processor - 적응형 지능 처리 시스템
 * 
 * 혁신적 특징:
 * 1. 동적 처리 전략 선택 (비용 vs 정확도 최적화)
 * 2. 실시간 품질 모니터링 및 적응
 * 3. 멀티 패널 UI를 위한 단계별 결과 제공
 */

import { SmartChunker, SmartChunk, ChunkingConfig } from './smartChunker.js';
import { HybridNER, MedicalEvent, NERResult } from './hybridNER.js';
import { TimelineEngine, TimelineAnalysis, TimelineConfig } from './timelineEngine.js';
import TextFilter from '../lib/textFilter.js';
import { MedicalGeneExtractor } from '../dna-engine/core/geneExtractor.cjs';

export interface ProcessingConfig {
  mode: 'FAST' | 'BALANCED' | 'THOROUGH';
  costLimit: number; // 최대 비용 (토큰 기준)
  accuracyThreshold: number; // 최소 정확도 요구사항
  realTimeMode: boolean;
  enableCaching: boolean;
  adaptiveOptimization: boolean;
}

export interface ProcessingStage {
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  progress: number; // 0-100
  result?: any;
  metrics?: StageMetrics;
  timestamp: string;
}

export interface StageMetrics {
  processingTime: number;
  tokenUsage: number;
  accuracy: number;
  confidence: number;
  costEstimate: number;
}

export interface AdaptiveResult {
  rawData: {
    originalText: string;
    chunks: SmartChunk[];
    filterResults: any;
  };
  threadData: {
    events: MedicalEvent[];
    nerResults: NERResult[];
    qualityScore: number;
  };
  finalData: {
    timeline: TimelineAnalysis;
    summary: ProcessingSummary;
    recommendations: ProcessingRecommendation[];
  };
  processingStages: ProcessingStage[];
  overallMetrics: OverallMetrics;
  adaptiveInsights: AdaptiveInsight[];
}

export interface ProcessingSummary {
  totalDocuments: number;
  processedChunks: number;
  extractedEvents: number;
  timelineSpan: string;
  keyFindings: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  processingQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export interface ProcessingRecommendation {
  type: 'OPTIMIZATION' | 'QUALITY' | 'COST' | 'ACCURACY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  action: string;
  impact: string;
}

export interface OverallMetrics {
  totalProcessingTime: number;
  totalTokenUsage: number;
  totalCost: number;
  averageAccuracy: number;
  overallConfidence: number;
  efficiencyScore: number;
}

export interface AdaptiveInsight {
  category: 'PERFORMANCE' | 'QUALITY' | 'COST' | 'PATTERN';
  insight: string;
  confidence: number;
  actionable: boolean;
  recommendation?: string;
}

export interface ProcessingContext {
  documentType: 'MEDICAL' | 'INSURANCE' | 'MIXED';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  previousResults?: AdaptiveResult[];
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  preferredMode: 'FAST' | 'BALANCED' | 'THOROUGH';
  costSensitivity: number; // 0-1
  qualityRequirement: number; // 0-1
  timeConstraint: number; // minutes
}

export class AdaptiveProcessor {
  private smartChunker: SmartChunker;
  private hybridNER: HybridNER;
  private timelineEngine: TimelineEngine;
  private textFilter: typeof TextFilter;
  private geneExtractor: MedicalGeneExtractor;
  
  private config: ProcessingConfig;
  private context: ProcessingContext;
  private stages: ProcessingStage[];
  private startTime: number;
  
  // 적응형 최적화를 위한 학습 데이터
  private performanceHistory: Map<string, number[]> = new Map();
  private costHistory: Map<string, number[]> = new Map();
  private qualityHistory: Map<string, number[]> = new Map();
  
  // 동적 임계값
  private dynamicThresholds = {
    chunkRelevance: 0.3,
    nerConfidence: 0.7,
    timelineQuality: 0.8,
    costEfficiency: 0.6
  };

  constructor(
    config: Partial<ProcessingConfig> = {},
    context: Partial<ProcessingContext> = {}
  ) {
    this.config = {
      mode: 'BALANCED',
      costLimit: 10000, // 토큰 기준
      accuracyThreshold: 0.8,
      realTimeMode: false,
      enableCaching: true,
      adaptiveOptimization: true,
      ...config
    };
    
    this.context = {
      documentType: 'MIXED',
      urgency: 'MEDIUM',
      complexity: 'MODERATE',
      ...context
    };
    
    this.initializeComponents();
    this.stages = this.initializeStages();
    this.startTime = Date.now();
  }

  /**
   * 메인 적응형 처리 함수
   */
  async processAdaptively(rawText: string): Promise<AdaptiveResult> {
    try {
      // 전처리: 처리 전략 최적화
      await this.optimizeProcessingStrategy(rawText);
      
      // 1단계: RAW 데이터 처리
      const rawData = await this.processRawStage(rawText);
      
      // 2단계: THREAD 데이터 처리
      const threadData = await this.processThreadStage(rawData.chunks);
      
      // 3단계: FINAL 데이터 처리
      const finalData = await this.processFinalStage(threadData.events);
      
      // 후처리: 메트릭 계산 및 인사이트 생성
      const overallMetrics = this.calculateOverallMetrics();
      const adaptiveInsights = await this.generateAdaptiveInsights();
      
      // 학습 데이터 업데이트
      if (this.config.adaptiveOptimization) {
        await this.updateLearningData(overallMetrics);
      }
      
      return {
        rawData,
        threadData,
        finalData,
        processingStages: this.stages,
        overallMetrics,
        adaptiveInsights
      };
      
    } catch (error) {
      await this.handleProcessingError(error);
      throw error;
    }
  }

  /**
   * 처리 전략 최적화
   */
  private async optimizeProcessingStrategy(rawText: string): Promise<void> {
    const textLength = rawText.length;
    const estimatedComplexity = this.estimateComplexity(rawText);
    
    // 동적 모드 조정
    if (this.config.adaptiveOptimization) {
      if (textLength > 50000 && this.context.urgency === 'HIGH') {
        this.config.mode = 'FAST';
      } else if (estimatedComplexity > 0.8 && this.context.urgency === 'LOW') {
        this.config.mode = 'THOROUGH';
      }
    }
    
    // 임계값 동적 조정
    this.adjustDynamicThresholds(estimatedComplexity);
    
    // 컴포넌트 재구성
    await this.reconfigureComponents();
  }

  /**
   * RAW 단계 처리
   */
  private async processRawStage(rawText: string): Promise<any> {
    const stage = this.getStage('RAW_PROCESSING');
    stage.status = 'PROCESSING';
    
    try {
      const startTime = Date.now();
      
      // 텍스트 필터링
      const filterResults = await this.textFilter.filterText([{ text: rawText, pageIndex: 1 }]);
      stage.progress = 30;
      
      // 스마트 청킹
      const chunks = await this.smartChunker.chunkText(filterResults[0]?.text || rawText);
      stage.progress = 70;
      
      // 품질 검증
      const qualityScore = this.validateRawQuality(chunks);
      stage.progress = 100;
      
      const processingTime = Date.now() - startTime;
      stage.metrics = {
        processingTime,
        tokenUsage: this.estimateTokenUsage(rawText),
        accuracy: qualityScore,
        confidence: qualityScore,
        costEstimate: this.estimateCost(rawText.length)
      };
      
      stage.status = 'COMPLETED';
      stage.result = { originalText: rawText, chunks, filterResults };
      
      return stage.result;
      
    } catch (error) {
      stage.status = 'ERROR';
      throw error;
    }
  }

  /**
   * THREAD 단계 처리
   */
  private async processThreadStage(chunks: SmartChunk[]): Promise<any> {
    const stage = this.getStage('THREAD_PROCESSING');
    stage.status = 'PROCESSING';
    
    try {
      const startTime = Date.now();
      
      // 관련성 기반 청크 필터링
      const relevantChunks = chunks.filter(chunk => 
        chunk.relevanceScore >= this.dynamicThresholds.chunkRelevance
      );
      stage.progress = 20;
      
      // 하이브리드 NER 처리
      const nerResults: NERResult[] = [];
      const events: MedicalEvent[] = [];
      
      for (let i = 0; i < relevantChunks.length; i++) {
        const chunk = relevantChunks[i];
        const nerResult = await this.hybridNER.processChunks([chunk]);
        
        if (nerResult.length > 0) {
          events.push(...nerResult);
        }
        
        stage.progress = 20 + (i / relevantChunks.length) * 70;
      }
      
      // 이벤트 중복 제거 및 병합
      const mergedEvents = await this.mergeAndDeduplicateEvents(events);
      stage.progress = 95;
      
      // 품질 점수 계산
      const qualityScore = this.calculateThreadQuality(nerResults, mergedEvents);
      stage.progress = 100;
      
      const processingTime = Date.now() - startTime;
      stage.metrics = {
        processingTime,
        tokenUsage: this.calculateNERTokenUsage(relevantChunks),
        accuracy: qualityScore,
        confidence: this.calculateAverageConfidence(nerResults),
        costEstimate: this.estimateNERCost(relevantChunks)
      };
      
      stage.status = 'COMPLETED';
      stage.result = { events: mergedEvents, nerResults, qualityScore };
      
      return stage.result;
      
    } catch (error) {
      stage.status = 'ERROR';
      throw error;
    }
  }

  /**
   * FINAL 단계 처리
   */
  private async processFinalStage(events: MedicalEvent[]): Promise<any> {
    const stage = this.getStage('FINAL_PROCESSING');
    stage.status = 'PROCESSING';
    
    try {
      const startTime = Date.now();
      
      // 타임라인 분석
      const timeline = await this.timelineEngine.analyzeTimeline(events);
      stage.progress = 60;
      
      // 종합 요약 생성
      const summary = this.generateProcessingSummary(timeline);
      stage.progress = 80;
      
      // 추천사항 생성
      const recommendations = await this.generateProcessingRecommendations(timeline);
      stage.progress = 100;
      
      const processingTime = Date.now() - startTime;
      stage.metrics = {
        processingTime,
        tokenUsage: this.estimateTimelineTokenUsage(events),
        accuracy: timeline.qualityMetrics.reliability,
        confidence: timeline.qualityMetrics.completeness,
        costEstimate: this.estimateTimelineCost(events)
      };
      
      stage.status = 'COMPLETED';
      stage.result = { timeline, summary, recommendations };
      
      return stage.result;
      
    } catch (error) {
      stage.status = 'ERROR';
      throw error;
    }
  }

  /**
   * 적응형 인사이트 생성
   */
  private async generateAdaptiveInsights(): Promise<AdaptiveInsight[]> {
    const insights: AdaptiveInsight[] = [];
    
    // 성능 인사이트
    const avgProcessingTime = this.stages.reduce((sum, stage) => 
      sum + (stage.metrics?.processingTime || 0), 0) / this.stages.length;
    
    if (avgProcessingTime > 5000) { // 5초 이상
      insights.push({
        category: 'PERFORMANCE',
        insight: '처리 시간이 평균보다 길어 최적화가 필요합니다.',
        confidence: 0.8,
        actionable: true,
        recommendation: 'FAST 모드 사용 또는 청크 크기 조정을 고려하세요.'
      });
    }
    
    // 비용 인사이트
    const totalCost = this.calculateOverallMetrics().totalCost;
    if (totalCost > this.config.costLimit * 0.8) {
      insights.push({
        category: 'COST',
        insight: '비용이 한계에 근접하고 있습니다.',
        confidence: 0.9,
        actionable: true,
        recommendation: '로컬 NER 비중을 높이거나 필터링을 강화하세요.'
      });
    }
    
    // 품질 인사이트
    const avgAccuracy = this.calculateOverallMetrics().averageAccuracy;
    if (avgAccuracy < this.config.accuracyThreshold) {
      insights.push({
        category: 'QUALITY',
        insight: '정확도가 요구 수준에 미달합니다.',
        confidence: 0.85,
        actionable: true,
        recommendation: 'THOROUGH 모드 사용 또는 임계값 조정을 고려하세요.'
      });
    }
    
    // 패턴 인사이트
    if (this.performanceHistory.size > 5) {
      const performanceTrend = this.analyzePerformanceTrend();
      if (performanceTrend === 'DECLINING') {
        insights.push({
          category: 'PATTERN',
          insight: '최근 처리 성능이 하락 추세입니다.',
          confidence: 0.7,
          actionable: true,
          recommendation: '시스템 리소스 확인 및 캐시 정리를 권장합니다.'
        });
      }
    }
    
    return insights;
  }

  // 유틸리티 메서드들
  private initializeComponents(): void {
    const chunkingConfig: Partial<ChunkingConfig> = {
      maxChunkSize: this.config.mode === 'FAST' ? 800 : 1200,
      overlapSize: this.config.mode === 'THOROUGH' ? 200 : 100,
      enableSmartSplitting: this.config.mode !== 'FAST'
    };
    
    const timelineConfig: Partial<TimelineConfig> = {
      includeMinorEvents: this.config.mode === 'THOROUGH',
      riskThreshold: this.config.mode === 'FAST' ? 0.8 : 0.6
    };
    
    this.smartChunker = new SmartChunker(chunkingConfig);
    this.hybridNER = new HybridNER();
    this.timelineEngine = new TimelineEngine(timelineConfig);
    this.textFilter = TextFilter;
    this.geneExtractor = new MedicalGeneExtractor();
  }

  private initializeStages(): ProcessingStage[] {
    return [
      {
        name: 'RAW_PROCESSING',
        status: 'PENDING',
        progress: 0,
        timestamp: new Date().toISOString()
      },
      {
        name: 'THREAD_PROCESSING',
        status: 'PENDING',
        progress: 0,
        timestamp: new Date().toISOString()
      },
      {
        name: 'FINAL_PROCESSING',
        status: 'PENDING',
        progress: 0,
        timestamp: new Date().toISOString()
      }
    ];
  }

  private getStage(name: string): ProcessingStage {
    return this.stages.find(stage => stage.name === name)!;
  }

  private estimateComplexity(text: string): number {
    let complexity = 0;
    
    // 텍스트 길이 기반
    complexity += Math.min(text.length / 100000, 0.3);
    
    // 의료 용어 밀도
    const medicalTerms = (text.match(/(진단|치료|수술|검사|처방|입원)/g) || []).length;
    complexity += Math.min(medicalTerms / 100, 0.3);
    
    // 날짜 및 숫자 밀도
    const dateNumbers = (text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d+/g) || []).length;
    complexity += Math.min(dateNumbers / 200, 0.2);
    
    // 특수 문자 및 구조
    const specialChars = (text.match(/[()\[\]{}|]/g) || []).length;
    complexity += Math.min(specialChars / 500, 0.2);
    
    return Math.min(complexity, 1.0);
  }

  private adjustDynamicThresholds(complexity: number): void {
    if (this.config.mode === 'FAST') {
      this.dynamicThresholds.chunkRelevance = 0.4;
      this.dynamicThresholds.nerConfidence = 0.6;
    } else if (this.config.mode === 'THOROUGH') {
      this.dynamicThresholds.chunkRelevance = 0.2;
      this.dynamicThresholds.nerConfidence = 0.8;
    }
    
    // 복잡도에 따른 조정
    if (complexity > 0.7) {
      this.dynamicThresholds.chunkRelevance -= 0.1;
      this.dynamicThresholds.nerConfidence += 0.1;
    }
  }

  private async reconfigureComponents(): Promise<void> {
    // 설정 변경에 따른 컴포넌트 재구성
    this.initializeComponents();
  }

  private validateRawQuality(chunks: SmartChunk[]): number {
    if (chunks.length === 0) return 0;
    
    const avgRelevance = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / chunks.length;
    const hasMetadata = chunks.filter(chunk => 
      (chunk.firstDate || chunk.lastDate) || chunk.institutions.length > 0
    ).length / chunks.length;
    
    return (avgRelevance * 0.6) + (hasMetadata * 0.4);
  }

  private calculateThreadQuality(nerResults: NERResult[], events: MedicalEvent[]): number {
    if (nerResults.length === 0) return 0;
    
    const avgConfidence = nerResults.reduce((sum, result) => sum + result.confidence, 0) / nerResults.length;
    const eventDensity = Math.min(events.length / 10, 1.0); // 10개 이상이면 만점
    
    return (avgConfidence * 0.7) + (eventDensity * 0.3);
  }

  private async mergeAndDeduplicateEvents(events: MedicalEvent[]): Promise<MedicalEvent[]> {
    // 간단한 중복 제거 로직 (실제로는 더 정교한 알고리즘 필요)
    const uniqueEvents = new Map<string, MedicalEvent>();
    
    for (const event of events) {
      const key = `${event.serviceDate}-${event.institution}-${event.eventType}`;
      if (!uniqueEvents.has(key) || uniqueEvents.get(key)!.confidence < event.confidence) {
        uniqueEvents.set(key, event);
      }
    }
    
    return Array.from(uniqueEvents.values());
  }

  private calculateAverageConfidence(nerResults: NERResult[]): number {
    if (nerResults.length === 0) return 0;
    return nerResults.reduce((sum, result) => sum + result.confidence, 0) / nerResults.length;
  }

  private generateProcessingSummary(timeline: TimelineAnalysis): ProcessingSummary {
    return {
      totalDocuments: 1, // 현재는 단일 문서 처리
      processedChunks: this.stages[0].result?.chunks?.length || 0,
      extractedEvents: timeline.events.length,
      timelineSpan: `${timeline.summary.dateRange.start} ~ ${timeline.summary.dateRange.end}`,
      keyFindings: timeline.summary.majorDiagnoses.map(d => d.name),
      riskLevel: timeline.riskAssessment.overallRisk,
      processingQuality: this.determineProcessingQuality()
    };
  }

  private async generateProcessingRecommendations(timeline: TimelineAnalysis): Promise<ProcessingRecommendation[]> {
    const recommendations: ProcessingRecommendation[] = [];
    
    // 성능 최적화 추천
    const totalTime = Date.now() - this.startTime;
    if (totalTime > 30000) { // 30초 이상
      recommendations.push({
        type: 'OPTIMIZATION',
        priority: 'HIGH',
        description: '처리 시간이 과도하게 길어졌습니다.',
        action: 'FAST 모드로 전환하거나 청크 크기를 줄이세요.',
        impact: '처리 속도 50% 향상 예상'
      });
    }
    
    // 품질 개선 추천
    if (timeline.qualityMetrics.completeness < 0.7) {
      recommendations.push({
        type: 'QUALITY',
        priority: 'MEDIUM',
        description: '정보 완성도가 낮습니다.',
        action: 'THOROUGH 모드 사용 또는 추가 데이터 수집을 고려하세요.',
        impact: '정확도 20% 향상 예상'
      });
    }
    
    return recommendations;
  }

  private calculateOverallMetrics(): OverallMetrics {
    const totalProcessingTime = Date.now() - this.startTime;
    const totalTokenUsage = this.stages.reduce((sum, stage) => 
      sum + (stage.metrics?.tokenUsage || 0), 0);
    const totalCost = this.stages.reduce((sum, stage) => 
      sum + (stage.metrics?.costEstimate || 0), 0);
    const averageAccuracy = this.stages.reduce((sum, stage) => 
      sum + (stage.metrics?.accuracy || 0), 0) / this.stages.length;
    const overallConfidence = this.stages.reduce((sum, stage) => 
      sum + (stage.metrics?.confidence || 0), 0) / this.stages.length;
    
    const efficiencyScore = this.calculateEfficiencyScore(
      totalProcessingTime, totalCost, averageAccuracy
    );
    
    return {
      totalProcessingTime,
      totalTokenUsage,
      totalCost,
      averageAccuracy,
      overallConfidence,
      efficiencyScore
    };
  }

  private calculateEfficiencyScore(time: number, cost: number, accuracy: number): number {
    // 효율성 = (정확도 * 100) / (시간 * 비용 계수)
    const timeScore = Math.max(0, 1 - (time / 60000)); // 1분 기준
    const costScore = Math.max(0, 1 - (cost / this.config.costLimit));
    
    return (accuracy * 0.5) + (timeScore * 0.3) + (costScore * 0.2);
  }

  private determineProcessingQuality(): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    const avgAccuracy = this.calculateOverallMetrics().averageAccuracy;
    
    if (avgAccuracy >= 0.9) return 'EXCELLENT';
    if (avgAccuracy >= 0.8) return 'GOOD';
    if (avgAccuracy >= 0.6) return 'FAIR';
    return 'POOR';
  }

  private analyzePerformanceTrend(): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    // 간단한 트렌드 분석 (실제로는 더 정교한 알고리즘 필요)
    return 'STABLE';
  }

  private async updateLearningData(metrics: OverallMetrics): Promise<void> {
    const key = `${this.config.mode}-${this.context.complexity}`;
    
    // 성능 히스토리 업데이트
    if (!this.performanceHistory.has(key)) {
      this.performanceHistory.set(key, []);
    }
    this.performanceHistory.get(key)!.push(metrics.totalProcessingTime);
    
    // 비용 히스토리 업데이트
    if (!this.costHistory.has(key)) {
      this.costHistory.set(key, []);
    }
    this.costHistory.get(key)!.push(metrics.totalCost);
    
    // 품질 히스토리 업데이트
    if (!this.qualityHistory.has(key)) {
      this.qualityHistory.set(key, []);
    }
    this.qualityHistory.get(key)!.push(metrics.averageAccuracy);
    
    // 히스토리 크기 제한 (최근 100개만 유지)
    [this.performanceHistory, this.costHistory, this.qualityHistory].forEach(history => {
      history.forEach((values, key) => {
        if (values.length > 100) {
          history.set(key, values.slice(-100));
        }
      });
    });
  }

  private async handleProcessingError(error: any): Promise<void> {
    console.error('Adaptive Processing Error:', error);
    
    // 에러 발생 단계 표시
    const currentStage = this.stages.find(stage => stage.status === 'PROCESSING');
    if (currentStage) {
      currentStage.status = 'ERROR';
    }
  }

  // 비용 추정 메서드들
  private estimateTokenUsage(text: string): number {
    return Math.ceil(text.length / 4); // 대략적인 토큰 추정
  }

  private estimateCost(textLength: number): number {
    return textLength * 0.0001; // 대략적인 비용 추정
  }

  private calculateNERTokenUsage(chunks: SmartChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.processedText.length / 4), 0);
  }

  private estimateNERCost(chunks: SmartChunk[]): number {
    return this.calculateNERTokenUsage(chunks) * 0.0002;
  }

  private estimateTimelineTokenUsage(events: MedicalEvent[]): number {
    return events.length * 50; // 이벤트당 평균 토큰
  }

  private estimateTimelineCost(events: MedicalEvent[]): number {
    return this.estimateTimelineTokenUsage(events) * 0.0002;
  }
}

export default AdaptiveProcessor;