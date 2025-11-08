/**
 * Hybrid Date Processor Module
 * 
 * 기존 MassiveDateBlockProcessor의 안정성과 
 * 코어엔진 EnhancedDateAnchor의 고도화된 분석 능력을 결합한 하이브리드 처리기
 * 
 * 핵심 기능:
 * 1. 기존 시스템의 안정적인 대용량 날짜 블록 처리
 * 2. 코어엔진의 정밀한 날짜 앵커링 및 의료 맥락 분석
 * 3. 어댑터 패턴을 통한 결과 병합 및 검증
 * 4. 점진적 마이그레이션을 위한 호환성 보장
 */

import MassiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import { EnhancedDateAnchor } from '../services/core-engine/enhanced/enhancedDateAnchor.js';

class HybridDateProcessor extends MassiveDateBlockProcessor {
  constructor(options = {}) {
    super();
    
    // 코어엔진 인스턴스 초기화
    this.coreEngine = new EnhancedDateAnchor();
    
    // 하이브리드 처리 옵션
    this.hybridOptions = {
      // 처리 모드: 'legacy', 'core', 'hybrid', 'adaptive'
      processingMode: options.processingMode || 'hybrid',
      
      // 코어엔진 사용 비율 (0.0 ~ 1.0)
      coreEngineRatio: options.coreEngineRatio || 0.3,
      
      // 결과 병합 전략: 'confidence', 'consensus', 'priority'
      mergeStrategy: options.mergeStrategy || 'confidence',
      
      // 성능 모니터링 활성화
      enableMonitoring: options.enableMonitoring !== false,
      
      // 백업 처리 활성화 (실패 시 기존 시스템으로 폴백)
      enableFallback: options.enableFallback !== false
    };
    
    // 성능 메트릭
    this.metrics = {
      totalProcessed: 0,
      legacyProcessed: 0,
      coreEngineProcessed: 0,
      hybridProcessed: 0,
      averageProcessingTime: 0,
      successRate: 0,
      fallbackCount: 0
    };
    
    // 결과 병합기
    this.resultMerger = new HybridResultMerger(this.hybridOptions.mergeStrategy);
    
    console.log('🔄 HybridDateProcessor 초기화 완료');
    console.log(`📊 처리 모드: ${this.hybridOptions.processingMode}`);
    console.log(`⚖️ 코어엔진 비율: ${this.hybridOptions.coreEngineRatio * 100}%`);
  }

  /**
   * 정적 메서드: 하이브리드 날짜 블록 처리 (기존 API 호환성)
   */
  static async processDateBlocks(ocrText, options = {}) {
    const processor = new HybridDateProcessor(options);
    return await processor.processMassiveDateBlocks(ocrText, options);
  }

  /**
   * 하이브리드 날짜 블록 처리 메인 함수
   * @param {string} ocrText OCR로 추출된 원본 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Promise<Object>} 하이브리드 처리 결과
   */
  async processMassiveDateBlocks(ocrText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔄 하이브리드 날짜 블록 처리 시작...');
      
      // 처리 모드 결정
      const processingMode = this.determineProcessingMode(ocrText, options);
      console.log(`📋 처리 모드 결정: ${processingMode}`);
      
      let result;
      
      switch (processingMode) {
        case 'legacy':
          result = await this.processWithLegacyOnly(ocrText, options);
          break;
          
        case 'core':
          result = await this.processWithCoreOnly(ocrText, options);
          break;
          
        case 'hybrid':
          result = await this.processWithHybrid(ocrText, options);
          break;
          
        case 'adaptive':
          result = await this.processWithAdaptive(ocrText, options);
          break;
          
        default:
          throw new Error(`지원하지 않는 처리 모드: ${processingMode}`);
      }
      
      // 성능 메트릭 업데이트
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingMode, processingTime, result.success);
      
      // 결과에 하이브리드 정보 추가
      result.hybrid = {
        processingMode,
        processingTime,
        coreEngineUsed: processingMode !== 'legacy',
        legacySystemUsed: processingMode !== 'core',
        metrics: this.getMetricsSummary()
      };
      
      console.log(`✅ 하이브리드 처리 완료 (${processingTime}ms, 모드: ${processingMode})`);
      return result;
      
    } catch (error) {
      console.error('❌ 하이브리드 날짜 블록 처리 실패:', error);
      
      // 폴백 처리
      if (this.hybridOptions.enableFallback) {
        console.log('🔄 기존 시스템으로 폴백 처리 시도...');
        try {
          const fallbackResult = await super.processMassiveDateBlocks(ocrText, options);
          this.metrics.fallbackCount++;
          
          fallbackResult.hybrid = {
            processingMode: 'fallback',
            originalError: error.message,
            fallbackUsed: true
          };
          
          return fallbackResult;
        } catch (fallbackError) {
          console.error('❌ 폴백 처리도 실패:', fallbackError);
        }
      }
      
      throw new Error(`하이브리드 날짜 블록 처리 실패: ${error.message}`);
    }
  }

  /**
   * 처리 모드 결정 로직
   */
  determineProcessingMode(text, options) {
    // 옵션에서 명시적으로 지정된 경우
    if (options.processingMode) {
      return options.processingMode;
    }
    
    // 기본 설정 사용
    if (this.hybridOptions.processingMode !== 'adaptive') {
      return this.hybridOptions.processingMode;
    }
    
    // 적응형 모드: 텍스트 특성에 따라 자동 결정
    const textComplexity = this.analyzeTextComplexity(text);
    
    if (textComplexity.dateCount < 5) {
      return 'legacy'; // 간단한 경우 기존 시스템
    } else if (textComplexity.medicalContextRatio > 0.7) {
      return 'core'; // 의료 맥락이 많은 경우 코어엔진
    } else {
      return 'hybrid'; // 일반적인 경우 하이브리드
    }
  }

  /**
   * 기존 시스템만으로 처리
   */
  async processWithLegacyOnly(ocrText, options) {
    console.log('📊 기존 시스템 전용 처리...');
    this.metrics.legacyProcessed++;
    
    const result = await super.processMassiveDateBlocks(ocrText, options);
    result.processingMethod = 'legacy_only';
    
    return result;
  }

  /**
   * 코어엔진만으로 처리
   */
  async processWithCoreOnly(ocrText, options) {
    console.log('🧠 코어엔진 전용 처리...');
    this.metrics.coreEngineProcessed++;
    
    try {
      // 코어엔진으로 날짜 앵커링 수행
      const coreResult = await this.coreEngine.dualSweepAnalysis(ocrText, {
        referenceDate: options.referenceDate || new Date(),
        medicalContext: true
      });
      
      if (!coreResult.success) {
        throw new Error('코어엔진 처리 실패');
      }
      
      // 기존 시스템 형식으로 변환
      const convertedResult = this.convertCoreResultToLegacyFormat(coreResult);
      convertedResult.processingMethod = 'core_only';
      
      return convertedResult;
      
    } catch (error) {
      console.error('❌ 코어엔진 전용 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 하이브리드 처리 (기존 + 코어엔진)
   */
  async processWithHybrid(ocrText, options) {
    console.log('🔄 하이브리드 처리...');
    this.metrics.hybridProcessed++;
    
    try {
      // 병렬로 두 시스템 실행
      const [legacyResult, coreResult] = await Promise.allSettled([
        super.processMassiveDateBlocks(ocrText, options),
        this.coreEngine.dualSweepAnalysis(ocrText, {
          referenceDate: options.referenceDate || new Date(),
          medicalContext: true
        })
      ]);
      
      // 결과 검증
      const validLegacyResult = legacyResult.status === 'fulfilled' ? legacyResult.value : null;
      const validCoreResult = coreResult.status === 'fulfilled' ? coreResult.value : null;
      
      if (!validLegacyResult && !validCoreResult) {
        throw new Error('두 시스템 모두 처리 실패');
      }
      
      // 결과 병합
      const mergedResult = await this.resultMerger.merge(
        validLegacyResult,
        validCoreResult,
        ocrText,
        options
      );
      
      mergedResult.processingMethod = 'hybrid';
      mergedResult.legacySuccess = !!validLegacyResult;
      mergedResult.coreSuccess = !!validCoreResult;
      
      return mergedResult;
      
    } catch (error) {
      console.error('❌ 하이브리드 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 적응형 처리 (동적 전략 선택)
   */
  async processWithAdaptive(ocrText, options) {
    console.log('🎯 적응형 처리...');
    
    // 텍스트 복잡도 분석
    const complexity = this.analyzeTextComplexity(ocrText);
    
    // 복잡도에 따른 전략 선택
    if (complexity.score < 0.3) {
      return await this.processWithLegacyOnly(ocrText, options);
    } else if (complexity.score > 0.8) {
      return await this.processWithCoreOnly(ocrText, options);
    } else {
      return await this.processWithHybrid(ocrText, options);
    }
  }

  /**
   * 텍스트 복잡도 분석
   */
  analyzeTextComplexity(text) {
    const dateMatches = text.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g) || [];
    const medicalTerms = text.match(/(진료|검사|수술|처방|투약|입원|퇴원|진단|치료|증상)/g) || [];
    const relativeTerms = text.match(/(오늘|어제|내일|최근|과거|\d+일\s*전|\d+일\s*후)/g) || [];
    
    const dateCount = dateMatches.length;
    const medicalContextRatio = medicalTerms.length / Math.max(text.length / 100, 1);
    const relativeComplexity = relativeTerms.length / Math.max(dateCount, 1);
    
    const score = Math.min(1.0, 
      (dateCount / 10) * 0.4 + 
      medicalContextRatio * 0.4 + 
      relativeComplexity * 0.2
    );
    
    return {
      score,
      dateCount,
      medicalContextRatio,
      relativeComplexity,
      textLength: text.length
    };
  }

  /**
   * 코어엔진 결과를 기존 시스템 형식으로 변환
   */
  convertCoreResultToLegacyFormat(coreResult) {
    const dateBlocks = [];
    const structuredGroups = [];
    
    if (coreResult && coreResult.success && coreResult.result) {
      // 주요 날짜 앵커 변환
      if (coreResult.result.primary && Array.isArray(coreResult.result.primary)) {
        coreResult.result.primary.forEach((anchor, index) => {
          if (anchor.normalized && anchor.normalized.date) {
            dateBlocks.push({
              id: `core_primary_${index}`,
              type: 'coreEngineAnchor',
              date: anchor.normalized.date,
              content: anchor.text || '',
              confidence: anchor.confidence || 0.8,
              medicalContext: anchor.medicalContext || false,
              position: anchor.position || { start: 0, end: anchor.text ? anchor.text.length : 0 },
              source: 'core_primary',
              originalAnchor: anchor
            });
          }
        });
      }
      
      // 보조 날짜 앵커 변환
      if (coreResult.result.secondary && Array.isArray(coreResult.result.secondary)) {
        coreResult.result.secondary.forEach((anchor, index) => {
          if (anchor.normalized && anchor.normalized.date) {
            dateBlocks.push({
              id: `core_secondary_${index}`,
              type: 'coreEngineAnchor',
              date: anchor.normalized.date,
              content: anchor.text || '',
              confidence: (anchor.confidence || 0.7) * 0.9, // 보조 날짜는 신뢰도 약간 낮춤
              medicalContext: anchor.medicalContext || false,
              position: anchor.position || { start: 0, end: anchor.text ? anchor.text.length : 0 },
              source: 'core_secondary',
              originalAnchor: anchor
            });
          }
        });
      }
      
      // 구조화된 그룹 생성
      if (dateBlocks.length > 0) {
        const primaryDates = dateBlocks.filter(block => block.source === 'core_primary');
        const secondaryDates = dateBlocks.filter(block => block.source === 'core_secondary');
        
        if (primaryDates.length > 0) {
          structuredGroups.push({
            id: 'core_primary_group',
            type: 'primaryDateGroup',
            dates: primaryDates.map(block => block.date),
            confidence: this.calculateAverageConfidence(primaryDates),
            medicalRelevance: primaryDates.filter(block => block.medicalContext).length / primaryDates.length,
            dateBlocks: primaryDates.map(block => block.id)
          });
        }
        
        if (secondaryDates.length > 0) {
          structuredGroups.push({
            id: 'core_secondary_group',
            type: 'secondaryDateGroup',
            dates: secondaryDates.map(block => block.date),
            confidence: this.calculateAverageConfidence(secondaryDates),
            medicalRelevance: secondaryDates.filter(block => block.medicalContext).length / secondaryDates.length,
            dateBlocks: secondaryDates.map(block => block.id)
          });
        }
      }
    }
    
    return {
      success: true,
      originalSize: 1000,
      processedSize: 1000,
      structuredGroups,
      dateBlocks,
      statistics: {
        totalDates: dateBlocks.length,
        averageConfidence: this.calculateAverageConfidence(dateBlocks),
        processingTime: 50
      },
      coreEngineData: coreResult // 원본 코어엔진 결과 보존
    };
  }

  /**
   * 평균 신뢰도 계산
   */
  calculateAverageConfidence(blocks) {
    if (!blocks || blocks.length === 0) return 0;
    
    const totalConfidence = blocks.reduce((sum, block) => sum + (block.confidence || 0), 0);
    return totalConfidence / blocks.length;
  }

  /**
   * 성능 메트릭 업데이트
   */
  updateMetrics(processingMode, processingTime, success) {
    this.metrics.totalProcessed++;
    
    // 처리 시간 업데이트
    const currentAvg = this.metrics.averageProcessingTime;
    const count = this.metrics.totalProcessed;
    this.metrics.averageProcessingTime = (currentAvg * (count - 1) + processingTime) / count;
    
    // 성공률 업데이트
    if (success) {
      const successCount = Math.round(this.metrics.successRate * (count - 1)) + 1;
      this.metrics.successRate = successCount / count;
    } else {
      const successCount = Math.round(this.metrics.successRate * (count - 1));
      this.metrics.successRate = successCount / count;
    }
  }

  /**
   * 메트릭 요약 반환
   */
  getMetricsSummary() {
    return {
      ...this.metrics,
      hybridRatio: this.metrics.hybridProcessed / Math.max(this.metrics.totalProcessed, 1),
      coreEngineRatio: this.metrics.coreEngineProcessed / Math.max(this.metrics.totalProcessed, 1),
      legacyRatio: this.metrics.legacyProcessed / Math.max(this.metrics.totalProcessed, 1)
    };
  }
}

/**
 * 하이브리드 결과 병합기
 */
class HybridResultMerger {
  constructor(strategy = 'confidence') {
    this.strategy = strategy;
  }

  /**
   * 두 시스템의 결과를 병합
   */
  async merge(legacyResult, coreResult, originalText, options) {
    console.log('🔄 결과 병합 시작...');
    
    if (!legacyResult && !coreResult) {
      throw new Error('병합할 결과가 없습니다');
    }
    
    // 단일 결과만 있는 경우
    if (!legacyResult) return this.enhanceCoreResult(coreResult, originalText);
    if (!coreResult) return this.enhanceLegacyResult(legacyResult, originalText);
    
    // 두 결과 모두 있는 경우 병합 전략 적용
    switch (this.strategy) {
      case 'confidence':
        return this.mergeByConfidence(legacyResult, coreResult, originalText);
      case 'consensus':
        return this.mergeByConsensus(legacyResult, coreResult, originalText);
      case 'priority':
        return this.mergeByPriority(legacyResult, coreResult, originalText);
      default:
        return this.mergeByConfidence(legacyResult, coreResult, originalText);
    }
  }

  /**
   * 신뢰도 기반 병합
   */
  mergeByConfidence(legacyResult, coreResult, originalText) {
    console.log('📊 신뢰도 기반 병합...');
    
    const mergedDateBlocks = [];
    const mergedGroups = [];
    
    // 기존 시스템 결과 추가
    if (legacyResult.dateBlocks) {
      legacyResult.dateBlocks.forEach(block => {
        mergedDateBlocks.push({
          ...block,
          source: 'legacy',
          confidence: block.confidence || 0.7
        });
      });
    }
    
    // 코어엔진 결과 추가 (높은 신뢰도)
    if (coreResult.result && coreResult.result.primary) {
      coreResult.result.primary.forEach((anchor, index) => {
        mergedDateBlocks.push({
          id: `merged_core_${index}`,
          type: 'coreEngineAnchor',
          date: anchor.normalized?.date,
          content: anchor.text,
          confidence: anchor.confidence || 0.9,
          source: 'core',
          medicalContext: anchor.medicalContext,
          position: anchor.position
        });
      });
    }
    
    // 신뢰도 순으로 정렬
    mergedDateBlocks.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // extractedDates와 dates 필드 생성
    const extractedDates = mergedDateBlocks.map(block => ({
      date: block.date,
      originalDate: block.originalDate || block.content,
      type: block.type,
      confidence: block.confidence,
      source: block.source
    }));

    const dates = mergedDateBlocks.map(block => block.date).filter(date => date);

    return {
      success: true,
      status: 'completed',
      confidence: this.calculateAverageConfidence(mergedDateBlocks),
      processingTime: Date.now(),
      originalSize: legacyResult.originalSize || 0,
      processedSize: legacyResult.processedSize || 0,
      structuredGroups: mergedGroups,
      dateBlocks: mergedDateBlocks,
      extractedDates: extractedDates,
      dates: dates,
      statistics: {
        totalDates: mergedDateBlocks.length,
        legacyDates: mergedDateBlocks.filter(b => b.source === 'legacy').length,
        coreDates: mergedDateBlocks.filter(b => b.source === 'core').length,
        averageConfidence: this.calculateAverageConfidence(mergedDateBlocks),
        mergeStrategy: 'confidence'
      },
      legacyResult,
      coreResult
    };
  }

  /**
   * 합의 기반 병합 (두 시스템이 동의하는 결과 우선)
   */
  mergeByConsensus(legacyResult, coreResult, originalText) {
    console.log('🤝 합의 기반 병합...');
    
    // 간단한 구현: 날짜가 일치하는 경우 높은 신뢰도 부여
    const consensusBlocks = [];
    const legacyDates = this.extractDatesFromResult(legacyResult);
    const coreDates = this.extractDatesFromResult(coreResult);
    
    // 공통 날짜 찾기
    legacyDates.forEach(legacyDate => {
      const matchingCoreDate = coreDates.find(coreDate => 
        this.isSameDate(legacyDate.date, coreDate.date)
      );
      
      if (matchingCoreDate) {
        consensusBlocks.push({
          ...legacyDate,
          confidence: Math.min(0.95, (legacyDate.confidence + matchingCoreDate.confidence) / 2 + 0.2),
          source: 'consensus',
          legacyData: legacyDate,
          coreData: matchingCoreDate
        });
      } else {
        consensusBlocks.push({
          ...legacyDate,
          source: 'legacy_only'
        });
      }
    });
    
    // 코어엔진 전용 날짜 추가
    coreDates.forEach(coreDate => {
      const hasMatch = legacyDates.some(legacyDate => 
        this.isSameDate(legacyDate.date, coreDate.date)
      );
      
      if (!hasMatch) {
        consensusBlocks.push({
          ...coreDate,
          source: 'core_only'
        });
      }
    });
    
    return {
      success: true,
      dateBlocks: consensusBlocks,
      statistics: {
        totalDates: consensusBlocks.length,
        consensusDates: consensusBlocks.filter(b => b.source === 'consensus').length,
        mergeStrategy: 'consensus'
      },
      legacyResult,
      coreResult
    };
  }

  /**
   * 우선순위 기반 병합 (코어엔진 우선)
   */
  mergeByPriority(legacyResult, coreResult, originalText) {
    console.log('🎯 우선순위 기반 병합...');
    
    // 코어엔진 결과를 우선으로 하고, 부족한 부분을 기존 시스템으로 보완
    const priorityBlocks = [];
    
    // 1순위: 코어엔진 결과
    if (coreResult.result && coreResult.result.primary) {
      coreResult.result.primary.forEach((anchor, index) => {
        priorityBlocks.push({
          id: `priority_core_${index}`,
          date: anchor.normalized?.date,
          content: anchor.text,
          confidence: anchor.confidence,
          source: 'core',
          priority: 1
        });
      });
    }
    
    // 2순위: 기존 시스템 결과 (코어엔진과 중복되지 않는 것만)
    if (legacyResult.dateBlocks) {
      legacyResult.dateBlocks.forEach((block, index) => {
        const isDuplicate = priorityBlocks.some(pb => 
          this.isSameDate(pb.date, block.date)
        );
        
        if (!isDuplicate) {
          priorityBlocks.push({
            ...block,
            id: `priority_legacy_${index}`,
            source: 'legacy',
            priority: 2
          });
        }
      });
    }
    
    return {
      success: true,
      dateBlocks: priorityBlocks,
      statistics: {
        totalDates: priorityBlocks.length,
        corePriority: priorityBlocks.filter(b => b.priority === 1).length,
        legacySupport: priorityBlocks.filter(b => b.priority === 2).length,
        mergeStrategy: 'priority'
      },
      legacyResult,
      coreResult
    };
  }

  /**
   * 결과에서 날짜 추출
   */
  extractDatesFromResult(result) {
    const dates = [];
    
    if (result.dateBlocks) {
      result.dateBlocks.forEach(block => {
        if (block.date) {
          dates.push({
            date: block.date,
            confidence: block.confidence || 0.5,
            content: block.content || block.text,
            type: block.type
          });
        }
      });
    }
    
    return dates;
  }

  /**
   * 날짜 동일성 검사
   */
  isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    
    // 문자열을 Date 객체로 변환하여 비교
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    return d1.getTime() === d2.getTime();
  }

  /**
   * 평균 신뢰도 계산
   */
  calculateAverageConfidence(blocks) {
    if (!blocks || blocks.length === 0) return 0;
    
    const totalConfidence = blocks.reduce((sum, block) => sum + (block.confidence || 0), 0);
    return totalConfidence / blocks.length;
  }

  /**
   * 코어엔진 결과 향상
   */
  enhanceCoreResult(coreResult, originalText) {
    console.log('🧠 코어엔진 결과 향상...');
    
    // 코어엔진 결과를 기존 형식으로 변환하고 향상
    const dateBlocks = [];
    
    if (coreResult.result && coreResult.result.primary) {
      dateBlocks.push(...coreResult.result.primary.map((anchor, index) => ({
        id: `enhanced_core_${index}`,
        date: anchor.normalized?.date,
        content: anchor.text,
        confidence: anchor.confidence,
        source: 'core_enhanced',
        medicalContext: anchor.medicalContext
      })));
    }

    const extractedDates = dateBlocks.map(block => ({
      date: block.date,
      originalDate: block.content,
      type: block.type || 'core',
      confidence: block.confidence,
      source: block.source
    }));

    const dates = dateBlocks.map(block => block.date).filter(date => date);
    
    const enhanced = {
      success: true,
      status: 'completed',
      confidence: this.calculateAverageConfidence(dateBlocks),
      processingTime: Date.now(),
      dateBlocks: dateBlocks,
      extractedDates: extractedDates,
      dates: dates,
      statistics: {
        source: 'core_enhanced',
        totalDates: dateBlocks.length
      },
      coreResult
    };
    
    return enhanced;
  }

  /**
   * 기존 시스템 결과 향상
   */
  enhanceLegacyResult(legacyResult, originalText) {
    console.log('📊 기존 시스템 결과 향상...');
    
    // 기존 결과에 향상된 메타데이터 추가
    const enhanced = {
      ...legacyResult,
      status: legacyResult.status || 'completed',
      confidence: legacyResult.confidence || this.calculateAverageConfidence(legacyResult.dateBlocks || []),
      processingTime: legacyResult.processingTime || Date.now(),
      statistics: {
        ...legacyResult.statistics,
        source: 'legacy_enhanced'
      }
    };
    
    // 날짜 블록에 향상된 정보 추가
    if (enhanced.dateBlocks) {
      enhanced.dateBlocks = enhanced.dateBlocks.map(block => ({
        ...block,
        source: 'legacy_enhanced',
        confidence: block.confidence || 0.7
      }));
    }

    // extractedDates와 dates 필드 추가 (없는 경우)
    if (!enhanced.extractedDates && enhanced.dateBlocks) {
      enhanced.extractedDates = enhanced.dateBlocks.map(block => ({
        date: block.date,
        originalDate: block.originalDate || block.content,
        type: block.type,
        confidence: block.confidence,
        source: block.source
      }));
    }

    if (!enhanced.dates && enhanced.dateBlocks) {
      enhanced.dates = enhanced.dateBlocks.map(block => block.date).filter(date => date);
    }
    
    return enhanced;
  }
}

export default HybridDateProcessor;