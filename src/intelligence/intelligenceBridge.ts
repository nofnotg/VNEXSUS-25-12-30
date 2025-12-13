/**
 * Intelligence Bridge - 새로운 지능형 시스템과 기존 DNA 엔진 통합
 * 
 * 혁신적 특징:
 * 1. 기존 MVP 코드와의 완벽한 호환성
 * 2. 점진적 마이그레이션 지원
 * 3. 성능 및 비용 최적화
 */

import { AdaptiveProcessor, ProcessingConfig, ProcessingContext, AdaptiveResult } from './adaptiveProcessor';
import MedicalGeneExtractor from '../dna-engine/core/geneExtractor.cjs';
import TextFilter from '../lib/textFilter';
import { eventTagger } from '../lib/eventTagger';
import { reportMaker } from '../lib/reportMaker';

export interface IntelligenceBridgeConfig {
  useNewIntelligence: boolean;
  hybridMode: boolean; // 기존 + 새로운 시스템 병행
  fallbackToLegacy: boolean;
  performanceThreshold: number;
  costThreshold: number;
}

export interface BridgeResult {
  source: 'LEGACY' | 'INTELLIGENCE' | 'HYBRID';
  legacyResult?: any;
  intelligenceResult?: AdaptiveResult;
  hybridResult?: HybridProcessingResult;
  performanceMetrics: BridgePerformanceMetrics;
  recommendation: ProcessingRecommendation;
}

export interface HybridProcessingResult {
  combinedEvents: any[];
  enhancedTimeline: any;
  qualityImprovement: number;
  costReduction: number;
  processingTimeReduction: number;
}

export interface BridgePerformanceMetrics {
  legacyTime?: number;
  intelligenceTime?: number;
  totalTime: number;
  legacyCost?: number;
  intelligenceCost?: number;
  totalCost: number;
  qualityScore: number;
  accuracyImprovement: number;
}

export interface ProcessingRecommendation {
  recommendedApproach: 'LEGACY' | 'INTELLIGENCE' | 'HYBRID';
  reason: string;
  expectedBenefits: string[];
  migrationSuggestion?: string;
}

export class IntelligenceBridge {
  private config: IntelligenceBridgeConfig;
  private adaptiveProcessor: AdaptiveProcessor;
  private legacyExtractor: MedicalGeneExtractor;
  private textFilter: typeof TextFilter;
  private eventTagger: typeof eventTagger;
  private reportMaker: typeof reportMaker;
  
  // 성능 추적
  private performanceHistory: Map<string, BridgePerformanceMetrics[]> = new Map();
  
  constructor(config: Partial<IntelligenceBridgeConfig> = {}) {
    this.config = {
      useNewIntelligence: true,
      hybridMode: false,
      fallbackToLegacy: true,
      performanceThreshold: 0.8,
      costThreshold: 0.7,
      ...config
    };
    
    this.initializeComponents();
  }

  /**
   * 메인 처리 함수 - 설정에 따라 적절한 처리 방식 선택
   */
  async processDocument(rawText: string, options: any = {}): Promise<BridgeResult> {
    const startTime = Date.now();
    let strategy: string;
    
    try {
      // 처리 전략 결정
      strategy = await this.determineProcessingStrategy(rawText, options);
      
      let result: BridgeResult;
      
      switch (strategy) {
        case 'LEGACY':
          result = await this.processWithLegacy(rawText, options);
          break;
        case 'INTELLIGENCE':
          result = await this.processWithIntelligence(rawText, options);
          break;
        case 'HYBRID':
          result = await this.processWithHybrid(rawText, options);
          break;
        default:
          throw new Error(`Unknown processing strategy: ${strategy}`);
      }
      
      // 성능 메트릭 업데이트
      result.performanceMetrics.totalTime = Date.now() - startTime;
      
      // 추천사항 생성
      result.recommendation = await this.generateRecommendation(result);
      
      // 성능 히스토리 업데이트
      await this.updatePerformanceHistory(strategy, result.performanceMetrics);
      
      return result;
      
    } catch (error) {
      console.error('Intelligence Bridge Error:', error);
      
      // 폴백 처리
      if (this.config.fallbackToLegacy && strategy !== 'LEGACY') {
        console.log('Falling back to legacy processing...');
        return await this.processWithLegacy(rawText, options);
      }
      
      throw error;
    }
  }

  /**
   * 처리 전략 결정
   */
  private async determineProcessingStrategy(
    rawText: string, 
    options: any
  ): Promise<'LEGACY' | 'INTELLIGENCE' | 'HYBRID'> {
    // 강제 설정이 있는 경우
    if (options.forceStrategy) {
      return options.forceStrategy;
    }
    
    // 새로운 지능형 시스템 비활성화된 경우
    if (!this.config.useNewIntelligence) {
      return 'LEGACY';
    }
    
    // 하이브리드 모드 활성화된 경우
    if (this.config.hybridMode) {
      return 'HYBRID';
    }
    
    // 텍스트 복잡도 기반 결정
    const complexity = this.estimateTextComplexity(rawText);
    const textLength = rawText.length;
    
    // 간단한 문서는 레거시로
    if (complexity < 0.3 && textLength < 5000) {
      return 'LEGACY';
    }
    
    // 복잡한 문서는 새로운 시스템으로
    if (complexity > 0.7 || textLength > 20000) {
      return 'INTELLIGENCE';
    }
    
    // 성능 히스토리 기반 결정
    const historicalPerformance = this.getHistoricalPerformance();
    if (historicalPerformance.intelligenceAdvantage > 0.2) {
      return 'INTELLIGENCE';
    }
    
    // 기본값
    return this.config.useNewIntelligence ? 'INTELLIGENCE' : 'LEGACY';
  }

  /**
   * 레거시 시스템으로 처리
   */
  private async processWithLegacy(rawText: string, options: any): Promise<BridgeResult> {
    const startTime = Date.now();
    
    try {
      // 1. 텍스트 필터링
      const filteredText = await this.textFilter.filterText([{ text: rawText, pageIndex: 1 }]);
      
      // 2. DNA 유전자 추출
      const geneResult = await this.legacyExtractor.extractGenes(filteredText[0]?.text || rawText, options);
      
      // 3. 이벤트 태깅
      const taggedEvents = await this.eventTagger.tagEvents(geneResult.genes);
      
      // 4. 보고서 생성
      const timelineEvents = taggedEvents.map(event => ({
        date: new Date().toISOString(),
        rawText: event.event?.rawText || '',
        blocks: [],
        confidence: 0.8,
        pageIndices: [1]
      }));
      const timeline = {
        events: timelineEvents,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        hospitals: [],
        tags: []
      };
      const report = await this.reportMaker.createReport(timeline, undefined, options);
      
      const processingTime = Date.now() - startTime;
      
      return {
        source: 'LEGACY',
        legacyResult: {
          genes: geneResult.genes,
          events: taggedEvents,
          report: report
        },
        performanceMetrics: {
          legacyTime: processingTime,
          totalTime: processingTime,
          legacyCost: this.estimateLegacyCost(rawText),
          totalCost: this.estimateLegacyCost(rawText),
          qualityScore: geneResult.averageConfidence || 0.7,
          accuracyImprovement: 0
        },
        recommendation: {
          recommendedApproach: 'LEGACY',
          reason: 'Legacy system used',
          expectedBenefits: ['Proven stability', 'Familiar output format']
        }
      };
      
    } catch (error) {
      console.error('Legacy processing failed:', error);
      throw error;
    }
  }

  /**
   * 새로운 지능형 시스템으로 처리
   */
  private async processWithIntelligence(rawText: string, options: any): Promise<BridgeResult> {
    const startTime = Date.now();
    
    try {
      // 처리 설정 구성
      const processingConfig: Partial<ProcessingConfig> = {
        mode: options.mode || 'BALANCED',
        costLimit: options.costLimit || 10000,
        accuracyThreshold: options.accuracyThreshold || 0.8,
        realTimeMode: options.realTimeMode || false
      };
      
      const processingContext: Partial<ProcessingContext> = {
        documentType: this.detectDocumentType(rawText),
        urgency: options.urgency || 'MEDIUM',
        complexity: this.estimateTextComplexity(rawText) > 0.7 ? 'COMPLEX' : 'MODERATE'
      };
      
      // 적응형 처리 실행
      this.adaptiveProcessor = new AdaptiveProcessor(processingConfig, processingContext);
      const intelligenceResult = await this.adaptiveProcessor.processAdaptively(rawText);
      
      const processingTime = Date.now() - startTime;
      
      return {
        source: 'INTELLIGENCE',
        intelligenceResult,
        performanceMetrics: {
          intelligenceTime: processingTime,
          totalTime: processingTime,
          intelligenceCost: intelligenceResult.overallMetrics.totalCost,
          totalCost: intelligenceResult.overallMetrics.totalCost,
          qualityScore: intelligenceResult.overallMetrics.averageAccuracy,
          accuracyImprovement: this.calculateAccuracyImprovement(intelligenceResult)
        },
        recommendation: {
          recommendedApproach: 'INTELLIGENCE',
          reason: 'New intelligence system provides enhanced accuracy',
          expectedBenefits: [
            'Higher accuracy',
            'Better cost efficiency',
            'Advanced timeline analysis',
            'Adaptive optimization'
          ]
        }
      };
      
    } catch (error) {
      console.error('Intelligence processing failed:', error);
      throw error;
    }
  }

  /**
   * 하이브리드 처리 (레거시 + 새로운 시스템)
   */
  private async processWithHybrid(rawText: string, options: any): Promise<BridgeResult> {
    const startTime = Date.now();
    
    try {
      // 병렬 처리
      const [legacyResult, intelligenceResult] = await Promise.all([
        this.processWithLegacy(rawText, { ...options, forceStrategy: 'LEGACY' }),
        this.processWithIntelligence(rawText, { ...options, forceStrategy: 'INTELLIGENCE' })
      ]);
      
      // 결과 융합
      const hybridResult = await this.fuseResults(legacyResult, intelligenceResult);
      
      const totalTime = Date.now() - startTime;
      
      return {
        source: 'HYBRID',
        legacyResult: legacyResult.legacyResult,
        intelligenceResult: intelligenceResult.intelligenceResult,
        hybridResult,
        performanceMetrics: {
          legacyTime: legacyResult.performanceMetrics.legacyTime,
          intelligenceTime: intelligenceResult.performanceMetrics.intelligenceTime,
          totalTime,
          legacyCost: legacyResult.performanceMetrics.legacyCost,
          intelligenceCost: intelligenceResult.performanceMetrics.intelligenceCost,
          totalCost: (legacyResult.performanceMetrics.totalCost || 0) + 
                    (intelligenceResult.performanceMetrics.totalCost || 0),
          qualityScore: Math.max(
            legacyResult.performanceMetrics.qualityScore,
            intelligenceResult.performanceMetrics.qualityScore
          ),
          accuracyImprovement: hybridResult.qualityImprovement
        },
        recommendation: {
          recommendedApproach: 'HYBRID',
          reason: 'Hybrid approach provides best of both systems',
          expectedBenefits: [
            'Maximum accuracy through validation',
            'Fallback reliability',
            'Comprehensive analysis',
            'Quality assurance'
          ]
        }
      };
      
    } catch (error) {
      console.error('Hybrid processing failed:', error);
      throw error;
    }
  }

  /**
   * 레거시와 새로운 시스템 결과 융합
   */
  private async fuseResults(
    legacyResult: BridgeResult,
    intelligenceResult: BridgeResult
  ): Promise<HybridProcessingResult> {
    const legacy = legacyResult.legacyResult;
    const intelligence = intelligenceResult.intelligenceResult;
    
    // 이벤트 융합 (중복 제거 및 보완)
    const combinedEvents = await this.combineEvents(
      legacy?.events || [],
      intelligence?.threadData?.events || []
    );
    
    // 타임라인 강화
    const enhancedTimeline = await this.enhanceTimeline(
      legacy?.report,
      intelligence?.finalData?.timeline
    );
    
    // 품질 개선도 계산
    const qualityImprovement = this.calculateQualityImprovement(
      legacyResult.performanceMetrics.qualityScore,
      intelligenceResult.performanceMetrics.qualityScore
    );
    
    // 비용 절감도 계산
    const costReduction = this.calculateCostReduction(
      legacyResult.performanceMetrics.totalCost || 0,
      intelligenceResult.performanceMetrics.totalCost || 0
    );
    
    // 처리 시간 단축도 계산
    const processingTimeReduction = this.calculateTimeReduction(
      legacyResult.performanceMetrics.totalTime,
      intelligenceResult.performanceMetrics.totalTime
    );
    
    return {
      combinedEvents,
      enhancedTimeline,
      qualityImprovement,
      costReduction,
      processingTimeReduction
    };
  }

  // 유틸리티 메서드들
  private initializeComponents(): void {
    this.legacyExtractor = new MedicalGeneExtractor();
    this.textFilter = TextFilter;
    this.eventTagger = eventTagger;
    this.reportMaker = reportMaker;
  }

  private estimateTextComplexity(text: string): number {
    let complexity = 0;
    
    // 길이 기반
    complexity += Math.min(text.length / 50000, 0.3);
    
    // 의료 용어 밀도
    const medicalTerms = (text.match(/(진단|치료|수술|검사|처방|입원|외래)/g) || []).length;
    complexity += Math.min(medicalTerms / 100, 0.3);
    
    // 날짜 및 숫자 밀도
    const dateNumbers = (text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d+/g) || []).length;
    complexity += Math.min(dateNumbers / 200, 0.2);
    
    // 구조적 복잡성
    const structuralElements = (text.match(/[()\[\]{}|]/g) || []).length;
    complexity += Math.min(structuralElements / 300, 0.2);
    
    return Math.min(complexity, 1.0);
  }

  private detectDocumentType(text: string): 'MEDICAL' | 'INSURANCE' | 'MIXED' {
    const medicalKeywords = (text.match(/(진료|진단|치료|수술|검사|처방)/g) || []).length;
    const insuranceKeywords = (text.match(/(보험|청구|급여|보상|계약)/g) || []).length;
    
    if (medicalKeywords > insuranceKeywords * 2) return 'MEDICAL';
    if (insuranceKeywords > medicalKeywords * 2) return 'INSURANCE';
    return 'MIXED';
  }

  private getHistoricalPerformance(): { intelligenceAdvantage: number } {
    // 간단한 성능 비교 (실제로는 더 정교한 분석 필요)
    return { intelligenceAdvantage: 0.15 };
  }

  private estimateLegacyCost(text: string): number {
    return text.length * 0.0002; // 대략적인 추정
  }

  private calculateAccuracyImprovement(result: AdaptiveResult): number {
    // 기준 정확도 대비 개선도
    const baselineAccuracy = 0.7;
    return Math.max(0, result.overallMetrics.averageAccuracy - baselineAccuracy);
  }

  private async combineEvents(legacyEvents: any[], intelligenceEvents: any[]): Promise<any[]> {
    // 이벤트 융합 로직 (중복 제거, 보완 정보 추가)
    const combined = [...legacyEvents];
    
    for (const intEvent of intelligenceEvents) {
      const existing = combined.find(legEvent => 
        this.areEventsSimilar(legEvent, intEvent)
      );
      
      if (existing) {
        // 기존 이벤트 보강
        Object.assign(existing, {
          confidence: Math.max(existing.confidence || 0, intEvent.confidence || 0),
          enhancedMetadata: intEvent.metadata
        });
      } else {
        // 새로운 이벤트 추가
        combined.push(intEvent);
      }
    }
    
    return combined;
  }

  private areEventsSimilar(event1: any, event2: any): boolean {
    // 간단한 유사성 검사 (실제로는 더 정교한 알고리즘 필요)
    return event1.serviceDate === event2.serviceDate &&
           event1.institution === event2.institution;
  }

  private async enhanceTimeline(legacyReport: any, intelligenceTimeline: any): Promise<any> {
    // 타임라인 강화 로직
    return {
      ...legacyReport,
      enhancedAnalysis: intelligenceTimeline?.summary,
      riskAssessment: intelligenceTimeline?.riskAssessment,
      recommendations: intelligenceTimeline?.insuranceRecommendations
    };
  }

  private calculateQualityImprovement(legacyQuality: number, intelligenceQuality: number): number {
    return Math.max(0, intelligenceQuality - legacyQuality);
  }

  private calculateCostReduction(legacyCost: number, intelligenceCost: number): number {
    if (legacyCost === 0) return 0;
    return Math.max(0, (legacyCost - intelligenceCost) / legacyCost);
  }

  private calculateTimeReduction(legacyTime: number, intelligenceTime: number): number {
    if (legacyTime === 0) return 0;
    return Math.max(0, (legacyTime - intelligenceTime) / legacyTime);
  }

  private async generateRecommendation(result: BridgeResult): Promise<ProcessingRecommendation> {
    const metrics = result.performanceMetrics;
    
    // 성능 기반 추천
    if (metrics.qualityScore > this.config.performanceThreshold && 
        metrics.totalCost < this.config.costThreshold * 10000) {
      return {
        recommendedApproach: 'INTELLIGENCE',
        reason: 'High quality with acceptable cost',
        expectedBenefits: ['Better accuracy', 'Advanced features'],
        migrationSuggestion: 'Consider full migration to intelligence system'
      };
    }
    
    if (result.source === 'HYBRID' && result.hybridResult?.qualityImprovement > 0.1) {
      return {
        recommendedApproach: 'HYBRID',
        reason: 'Significant quality improvement with hybrid approach',
        expectedBenefits: ['Best accuracy', 'Reliability'],
        migrationSuggestion: 'Use hybrid mode for critical documents'
      };
    }
    
    return {
      recommendedApproach: 'LEGACY',
      reason: 'Legacy system provides sufficient quality',
      expectedBenefits: ['Proven reliability', 'Lower cost']
    };
  }

  private async updatePerformanceHistory(
    strategy: string, 
    metrics: BridgePerformanceMetrics
  ): Promise<void> {
    if (!this.performanceHistory.has(strategy)) {
      this.performanceHistory.set(strategy, []);
    }
    
    const history = this.performanceHistory.get(strategy)!;
    history.push(metrics);
    
    // 최근 50개만 유지
    if (history.length > 50) {
      this.performanceHistory.set(strategy, history.slice(-50));
    }
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(): any {
    const stats: any = {};
    
    for (const [strategy, history] of this.performanceHistory) {
      if (history.length > 0) {
        stats[strategy] = {
          count: history.length,
          avgTime: history.reduce((sum, m) => sum + m.totalTime, 0) / history.length,
          avgCost: history.reduce((sum, m) => sum + m.totalCost, 0) / history.length,
          avgQuality: history.reduce((sum, m) => sum + m.qualityScore, 0) / history.length
        };
      }
    }
    
    return stats;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<IntelligenceBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default IntelligenceBridge;
