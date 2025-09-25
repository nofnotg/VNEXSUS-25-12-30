/**
 * 하이브리드 vs 순수 로직 기반 처리 방식 비교 평가 시스템
 * 
 * 역할:
 * 1. 기존 후처리 시스템과 AI 하이브리드 방식 성능 비교
 * 2. 정량적/정성적 평가 지표 제공
 * 3. 실시간 성능 모니터링 및 분석
 * 4. 최적 처리 방식 추천 시스템
 */

import PostProcessingManager from '../postprocess/index.js';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

class ProcessingComparisonSystem {
  constructor() {
    this.postProcessingManager = new PostProcessingManager();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.comparisonResults = {
      hybrid: [],
      pureLogic: [],
      metrics: {},
      analysis: {}
    };
    
    this.evaluationCriteria = {
      accuracy: { weight: 0.35, description: '정확도 - 추출된 정보의 정확성' },
      completeness: { weight: 0.25, description: '완성도 - 필요한 정보의 완전성' },
      consistency: { weight: 0.20, description: '일관성 - 처리 결과의 일관성' },
      efficiency: { weight: 0.15, description: '효율성 - 처리 속도 및 리소스 사용' },
      costEffectiveness: { weight: 0.05, description: '비용 효율성 - 처리 비용 대비 효과' }
    };
  }

  /**
   * 전체 비교 평가 실행
   * @param {Array} testCases 테스트 케이스 배열
   * @returns {Promise<Object>} 비교 평가 결과
   */
  async runComprehensiveComparison(testCases) {
    console.log('🔄 하이브리드 vs 순수 로직 기반 처리 방식 종합 비교 시작...');
    console.log(`📊 평가 대상: ${testCases.length}개 케이스`);
    console.log('📋 평가 기준:', Object.entries(this.evaluationCriteria).map(([key, criteria]) => 
      `${key}(${(criteria.weight * 100).toFixed(0)}%)`
    ).join(', '));
    
    const startTime = Date.now();
    
    try {
      // 1단계: 각 케이스별 두 방식 처리
      console.log('\n=== 1단계: 케이스별 처리 방식 비교 ===');
      await this.processCasesWithBothMethods(testCases);
      
      // 2단계: 정량적 메트릭 계산
      console.log('\n=== 2단계: 정량적 메트릭 계산 ===');
      this.calculateQuantitativeMetrics();
      
      // 3단계: 정성적 분석
      console.log('\n=== 3단계: 정성적 분석 ===');
      await this.performQualitativeAnalysis();
      
      // 4단계: 종합 평가 및 추천
      console.log('\n=== 4단계: 종합 평가 및 추천 ===');
      const recommendation = this.generateRecommendation();
      
      const totalTime = Date.now() - startTime;
      
      const finalResults = {
        timestamp: new Date().toISOString(),
        totalProcessingTime: totalTime,
        testCasesCount: testCases.length,
        hybridResults: this.comparisonResults.hybrid,
        pureLogicResults: this.comparisonResults.pureLogic,
        quantitativeMetrics: this.comparisonResults.metrics,
        qualitativeAnalysis: this.comparisonResults.analysis,
        recommendation,
        evaluationCriteria: this.evaluationCriteria
      };
      
      // 결과 저장
      await this.saveComparisonResults(finalResults);
      
      console.log(`\n✅ 비교 평가 완료 (${totalTime}ms)`);
      return finalResults;
      
    } catch (error) {
      console.error('❌ 비교 평가 실패:', error.message);
      throw error;
    }
  }

  /**
   * 각 케이스를 두 방식으로 처리
   * @param {Array} testCases 테스트 케이스
   */
  async processCasesWithBothMethods(testCases) {
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n처리 중: 케이스 ${testCase.id} (${i + 1}/${testCases.length})`);
      
      try {
        // 하이브리드 방식 처리
        console.log('  🤖 하이브리드 방식 처리...');
        const hybridResult = await this.processWithHybridMethod(testCase);
        this.comparisonResults.hybrid.push(hybridResult);
        
        // 순수 로직 기반 처리
        console.log('  ⚙️ 순수 로직 기반 처리...');
        const pureLogicResult = await this.processWithPureLogic(testCase);
        this.comparisonResults.pureLogic.push(pureLogicResult);
        
        console.log(`  ✅ 케이스 ${testCase.id} 처리 완료`);
        
      } catch (error) {
        console.error(`  ❌ 케이스 ${testCase.id} 처리 실패:`, error.message);
        
        // 실패한 케이스도 기록
        this.comparisonResults.hybrid.push({
          caseId: testCase.id,
          success: false,
          error: error.message,
          method: 'hybrid'
        });
        
        this.comparisonResults.pureLogic.push({
          caseId: testCase.id,
          success: false,
          error: error.message,
          method: 'pureLogic'
        });
      }
    }
  }

  /**
   * 하이브리드 방식 처리 (AI + 최소 로직)
   * @param {Object} testCase 테스트 케이스
   * @returns {Promise<Object>} 처리 결과
   */
  async processWithHybridMethod(testCase) {
    const startTime = Date.now();
    
    try {
      // 기존 후처리 시스템을 AI 강화 모드로 실행
      const result = await this.postProcessingManager.processOCRResult(testCase.content, {
        useAIExtraction: true,
        useHybridApproach: true,
        minConfidence: 0.3,
        includeAll: false,
        aiExtractionOptions: {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          maxTokens: 2048
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      // AI 비용 계산
      const aiCost = this.calculateAICost(result.pipeline.aiExtractedData);
      
      return {
        caseId: testCase.id,
        method: 'hybrid',
        success: true,
        processingTime,
        inputSize: testCase.content.length,
        result: {
          massiveDateBlocks: result.pipeline.massiveDateBlocks,
          organizedData: result.pipeline.organizedData,
          aiExtractedData: result.pipeline.aiExtractedData,
          finalReport: result.pipeline.finalReport
        },
        metrics: {
          confidence: result.statistics.confidence,
          filteringRate: result.statistics.filteringRate,
          processedGroups: result.statistics.processedGroups,
          dateBlocks: result.statistics.dateBlocks
        },
        cost: aiCost,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        caseId: testCase.id,
        method: 'hybrid',
        success: false,
        processingTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 순수 로직 기반 처리
   * @param {Object} testCase 테스트 케이스
   * @returns {Promise<Object>} 처리 결과
   */
  async processWithPureLogic(testCase) {
    const startTime = Date.now();
    
    try {
      // 기존 후처리 시스템을 순수 로직 모드로 실행
      const result = await this.postProcessingManager.processOCRResult(testCase.content, {
        useAIExtraction: false,
        useHybridApproach: false,
        minConfidence: 0.5,
        includeAll: true,
        translateTerms: true,
        requireKeywords: false
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        caseId: testCase.id,
        method: 'pureLogic',
        success: true,
        processingTime,
        inputSize: testCase.content.length,
        result: {
          massiveDateBlocks: result.pipeline.massiveDateBlocks,
          preprocessedData: result.pipeline.preprocessedData,
          organizedData: result.pipeline.organizedData,
          finalReport: result.pipeline.finalReport
        },
        metrics: {
          confidence: result.statistics.confidence,
          filteringRate: result.statistics.filteringRate,
          processedGroups: result.statistics.processedGroups,
          dateBlocks: result.statistics.dateBlocks
        },
        cost: 0, // 순수 로직은 API 비용 없음
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        caseId: testCase.id,
        method: 'pureLogic',
        success: false,
        processingTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * AI 비용 계산
   * @param {Object} aiData AI 추출 데이터
   * @returns {number} 계산된 비용
   */
  calculateAICost(aiData) {
    if (!aiData || !aiData.usage) return 0;
    
    const { prompt_tokens, completion_tokens } = aiData.usage;
    
    // GPT-4o-mini 가격 (2024년 기준)
    const promptCost = (prompt_tokens / 1000) * 0.00015;
    const completionCost = (completion_tokens / 1000) * 0.0006;
    
    return promptCost + completionCost;
  }

  /**
   * 정량적 메트릭 계산
   */
  calculateQuantitativeMetrics() {
    const hybridSuccessful = this.comparisonResults.hybrid.filter(r => r.success);
    const pureLogicSuccessful = this.comparisonResults.pureLogic.filter(r => r.success);
    
    this.comparisonResults.metrics = {
      hybrid: this.calculateMethodMetrics(hybridSuccessful, 'hybrid'),
      pureLogic: this.calculateMethodMetrics(pureLogicSuccessful, 'pureLogic'),
      comparison: this.calculateComparisonMetrics(hybridSuccessful, pureLogicSuccessful)
    };
  }

  /**
   * 방식별 메트릭 계산
   * @param {Array} results 결과 배열
   * @param {string} method 방식명
   * @returns {Object} 메트릭
   */
  calculateMethodMetrics(results, method) {
    if (results.length === 0) {
      return {
        successRate: 0,
        avgProcessingTime: 0,
        avgConfidence: 0,
        totalCost: 0,
        avgFilteringRate: 0,
        avgProcessedGroups: 0
      };
    }
    
    const totalResults = method === 'hybrid' ? 
      this.comparisonResults.hybrid.length : 
      this.comparisonResults.pureLogic.length;
    
    return {
      successRate: (results.length / totalResults * 100).toFixed(2),
      avgProcessingTime: Math.round(results.reduce((sum, r) => sum + r.processingTime, 0) / results.length),
      avgConfidence: (results.reduce((sum, r) => sum + (r.metrics?.confidence || 0), 0) / results.length).toFixed(3),
      totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(6),
      avgFilteringRate: (results.reduce((sum, r) => sum + (r.metrics?.filteringRate || 0), 0) / results.length).toFixed(2),
      avgProcessedGroups: Math.round(results.reduce((sum, r) => sum + (r.metrics?.processedGroups || 0), 0) / results.length),
      avgDateBlocks: Math.round(results.reduce((sum, r) => sum + (r.metrics?.dateBlocks || 0), 0) / results.length)
    };
  }

  /**
   * 비교 메트릭 계산
   * @param {Array} hybridResults 하이브리드 결과
   * @param {Array} pureLogicResults 순수 로직 결과
   * @returns {Object} 비교 메트릭
   */
  calculateComparisonMetrics(hybridResults, pureLogicResults) {
    const hybridMetrics = this.comparisonResults.metrics.hybrid;
    const pureLogicMetrics = this.comparisonResults.metrics.pureLogic;
    
    return {
      speedComparison: {
        hybridFaster: hybridMetrics.avgProcessingTime < pureLogicMetrics.avgProcessingTime,
        speedDifference: Math.abs(hybridMetrics.avgProcessingTime - pureLogicMetrics.avgProcessingTime),
        speedRatio: (hybridMetrics.avgProcessingTime / pureLogicMetrics.avgProcessingTime).toFixed(2)
      },
      accuracyComparison: {
        hybridMoreAccurate: parseFloat(hybridMetrics.avgConfidence) > parseFloat(pureLogicMetrics.avgConfidence),
        confidenceDifference: Math.abs(parseFloat(hybridMetrics.avgConfidence) - parseFloat(pureLogicMetrics.avgConfidence)).toFixed(3),
        confidenceRatio: (parseFloat(hybridMetrics.avgConfidence) / parseFloat(pureLogicMetrics.avgConfidence)).toFixed(2)
      },
      costComparison: {
        hybridCostPerCase: (parseFloat(hybridMetrics.totalCost) / hybridResults.length).toFixed(6),
        pureLogicCostPerCase: 0,
        totalCostDifference: parseFloat(hybridMetrics.totalCost)
      },
      reliabilityComparison: {
        hybridSuccessRate: parseFloat(hybridMetrics.successRate),
        pureLogicSuccessRate: parseFloat(pureLogicMetrics.successRate),
        reliabilityDifference: Math.abs(parseFloat(hybridMetrics.successRate) - parseFloat(pureLogicMetrics.successRate)).toFixed(2)
      }
    };
  }

  /**
   * 정성적 분석 수행
   */
  async performQualitativeAnalysis() {
    console.log('  📝 정성적 분석 수행 중...');
    
    // 샘플 케이스들의 결과를 AI로 분석
    const sampleAnalysis = await this.analyzeResultQuality();
    
    this.comparisonResults.analysis = {
      qualityAssessment: sampleAnalysis,
      strengthsAndWeaknesses: this.identifyStrengthsAndWeaknesses(),
      useCaseRecommendations: this.generateUseCaseRecommendations(),
      riskAssessment: this.assessRisks()
    };
  }

  /**
   * 결과 품질 분석
   * @returns {Promise<Object>} 품질 분석 결과
   */
  async analyzeResultQuality() {
    // 성공한 케이스 중 몇 개를 샘플로 선택
    const hybridSamples = this.comparisonResults.hybrid.filter(r => r.success).slice(0, 3);
    const pureLogicSamples = this.comparisonResults.pureLogic.filter(r => r.success).slice(0, 3);
    
    if (hybridSamples.length === 0 || pureLogicSamples.length === 0) {
      return {
        analysis: '충분한 샘플 데이터가 없어 정성적 분석을 수행할 수 없습니다.',
        confidence: 0
      };
    }
    
    try {
      const analysisPrompt = `
다음은 의료 데이터 처리의 두 가지 방식에 대한 결과 샘플입니다.

하이브리드 방식 (AI + 최소 로직) 결과:
${JSON.stringify(hybridSamples.map(s => ({
  caseId: s.caseId,
  processingTime: s.processingTime,
  confidence: s.metrics?.confidence,
  processedGroups: s.metrics?.processedGroups
})), null, 2)}

순수 로직 기반 방식 결과:
${JSON.stringify(pureLogicSamples.map(s => ({
  caseId: s.caseId,
  processingTime: s.processingTime,
  confidence: s.metrics?.confidence,
  processedGroups: s.metrics?.processedGroups
})), null, 2)}

두 방식의 결과를 비교하여 다음 관점에서 분석해주세요:
1. 데이터 추출의 정확성
2. 결과의 일관성
3. 처리 효율성
4. 실용성 및 적용 가능성

JSON 형식으로 응답해주세요:
{
  "accuracy_analysis": "정확성 분석",
  "consistency_analysis": "일관성 분석",
  "efficiency_analysis": "효율성 분석",
  "practicality_analysis": "실용성 분석",
  "overall_assessment": "종합 평가",
  "confidence_score": 0-100
}
`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 의료 데이터 처리 시스템 분석 전문가입니다. 객관적이고 실용적인 관점에서 분석해주세요.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1024
      });
      
      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.warn('  ⚠️ AI 품질 분석 실패, 기본 분석 사용:', error.message);
      
      return {
        accuracy_analysis: '자동 분석 불가 - 수동 검토 필요',
        consistency_analysis: '자동 분석 불가 - 수동 검토 필요',
        efficiency_analysis: '자동 분석 불가 - 수동 검토 필요',
        practicality_analysis: '자동 분석 불가 - 수동 검토 필요',
        overall_assessment: '정성적 분석을 위해 결과를 수동으로 검토해주세요.',
        confidence_score: 0
      };
    }
  }

  /**
   * 강점과 약점 식별
   * @returns {Object} 강점과 약점
   */
  identifyStrengthsAndWeaknesses() {
    const hybridMetrics = this.comparisonResults.metrics.hybrid;
    const pureLogicMetrics = this.comparisonResults.metrics.pureLogic;
    const comparison = this.comparisonResults.metrics.comparison;
    
    return {
      hybrid: {
        strengths: [
          parseFloat(hybridMetrics.avgConfidence) > parseFloat(pureLogicMetrics.avgConfidence) ? 
            '높은 정확도 및 신뢰도' : null,
          hybridMetrics.avgProcessedGroups > pureLogicMetrics.avgProcessedGroups ? 
            '더 많은 데이터 그룹 처리' : null,
          '복잡한 의료 용어 및 맥락 이해',
          '자연어 처리 능력'
        ].filter(Boolean),
        weaknesses: [
          parseFloat(hybridMetrics.totalCost) > 0 ? 'API 비용 발생' : null,
          hybridMetrics.avgProcessingTime > pureLogicMetrics.avgProcessingTime ? 
            '상대적으로 느린 처리 속도' : null,
          '인터넷 연결 의존성',
          'AI 모델 변경에 따른 불확실성'
        ].filter(Boolean)
      },
      pureLogic: {
        strengths: [
          '비용 효율성 (API 비용 없음)',
          pureLogicMetrics.avgProcessingTime < hybridMetrics.avgProcessingTime ? 
            '빠른 처리 속도' : null,
          '예측 가능한 결과',
          '오프라인 동작 가능',
          '시스템 리소스 효율성'
        ].filter(Boolean),
        weaknesses: [
          parseFloat(pureLogicMetrics.avgConfidence) < parseFloat(hybridMetrics.avgConfidence) ? 
            '상대적으로 낮은 정확도' : null,
          '복잡한 의료 용어 처리 한계',
          '맥락 이해 부족',
          '정규식 패턴 유지보수 필요'
        ].filter(Boolean)
      }
    };
  }

  /**
   * 사용 사례별 추천 생성
   * @returns {Object} 사용 사례별 추천
   */
  generateUseCaseRecommendations() {
    const hybridMetrics = this.comparisonResults.metrics.hybrid;
    const pureLogicMetrics = this.comparisonResults.metrics.pureLogic;
    
    return {
      highAccuracyRequired: {
        recommendation: parseFloat(hybridMetrics.avgConfidence) > parseFloat(pureLogicMetrics.avgConfidence) ? 'hybrid' : 'pureLogic',
        reason: '높은 정확도가 요구되는 의료 진단 보고서 처리'
      },
      highVolumeProcessing: {
        recommendation: hybridMetrics.avgProcessingTime < pureLogicMetrics.avgProcessingTime ? 'hybrid' : 'pureLogic',
        reason: '대량의 의료 데이터 일괄 처리'
      },
      costSensitive: {
        recommendation: 'pureLogic',
        reason: 'API 비용을 최소화해야 하는 환경'
      },
      complexMedicalTerms: {
        recommendation: 'hybrid',
        reason: '복잡한 의료 용어와 맥락 이해가 중요한 경우'
      },
      realTimeProcessing: {
        recommendation: hybridMetrics.avgProcessingTime < pureLogicMetrics.avgProcessingTime ? 'hybrid' : 'pureLogic',
        reason: '실시간 처리가 필요한 응급 의료 시스템'
      },
      offlineEnvironment: {
        recommendation: 'pureLogic',
        reason: '인터넷 연결이 제한된 환경'
      }
    };
  }

  /**
   * 위험 평가
   * @returns {Object} 위험 평가 결과
   */
  assessRisks() {
    const hybridSuccessRate = parseFloat(this.comparisonResults.metrics.hybrid.successRate);
    const pureLogicSuccessRate = parseFloat(this.comparisonResults.metrics.pureLogic.successRate);
    
    return {
      hybrid: {
        technicalRisks: [
          hybridSuccessRate < 95 ? 'AI 모델 응답 불안정성' : null,
          'API 서비스 중단 위험',
          'API 비용 증가 위험',
          '모델 업데이트로 인한 결과 변화'
        ].filter(Boolean),
        mitigationStrategies: [
          'Fallback 로직 구현',
          'API 응답 캐싱',
          '비용 모니터링 시스템',
          '모델 버전 고정'
        ]
      },
      pureLogic: {
        technicalRisks: [
          pureLogicSuccessRate < 95 ? '정규식 패턴 매칭 실패' : null,
          '새로운 의료 용어 대응 지연',
          '복잡한 문서 구조 처리 한계',
          '수동 패턴 업데이트 필요'
        ].filter(Boolean),
        mitigationStrategies: [
          '정규식 패턴 지속적 업데이트',
          '의료 용어 사전 확장',
          '예외 처리 로직 강화',
          '자동 패턴 학습 시스템 도입'
        ]
      }
    };
  }

  /**
   * 최종 추천 생성
   * @returns {Object} 최종 추천
   */
  generateRecommendation() {
    const hybridMetrics = this.comparisonResults.metrics.hybrid;
    const pureLogicMetrics = this.comparisonResults.metrics.pureLogic;
    const comparison = this.comparisonResults.metrics.comparison;
    
    // 가중치 기반 종합 점수 계산
    const hybridScore = this.calculateCompositeScore(hybridMetrics, 'hybrid');
    const pureLogicScore = this.calculateCompositeScore(pureLogicMetrics, 'pureLogic');
    
    const recommendedMethod = hybridScore > pureLogicScore ? 'hybrid' : 'pureLogic';
    const scoreDifference = Math.abs(hybridScore - pureLogicScore);
    
    return {
      recommendedMethod,
      confidence: scoreDifference > 10 ? 'high' : scoreDifference > 5 ? 'medium' : 'low',
      scores: {
        hybrid: hybridScore.toFixed(2),
        pureLogic: pureLogicScore.toFixed(2),
        difference: scoreDifference.toFixed(2)
      },
      reasoning: this.generateRecommendationReasoning(recommendedMethod, hybridMetrics, pureLogicMetrics, comparison),
      implementationStrategy: this.generateImplementationStrategy(recommendedMethod),
      nextSteps: this.generateNextSteps(recommendedMethod)
    };
  }

  /**
   * 종합 점수 계산
   * @param {Object} metrics 메트릭
   * @param {string} method 방식
   * @returns {number} 종합 점수
   */
  calculateCompositeScore(metrics, method) {
    const accuracyScore = parseFloat(metrics.avgConfidence) * 100;
    const completenessScore = parseFloat(metrics.successRate);
    const consistencyScore = 100 - (parseFloat(metrics.avgFilteringRate) || 0); // 필터링이 적을수록 일관성 높음
    const efficiencyScore = Math.max(0, 100 - (metrics.avgProcessingTime / 1000)); // 처리 시간이 적을수록 효율성 높음
    const costEffectivenessScore = method === 'pureLogic' ? 100 : Math.max(0, 100 - (parseFloat(metrics.totalCost) * 10000));
    
    return (
      accuracyScore * this.evaluationCriteria.accuracy.weight +
      completenessScore * this.evaluationCriteria.completeness.weight +
      consistencyScore * this.evaluationCriteria.consistency.weight +
      efficiencyScore * this.evaluationCriteria.efficiency.weight +
      costEffectivenessScore * this.evaluationCriteria.costEffectiveness.weight
    );
  }

  /**
   * 추천 근거 생성
   * @param {string} recommendedMethod 추천 방식
   * @param {Object} hybridMetrics 하이브리드 메트릭
   * @param {Object} pureLogicMetrics 순수 로직 메트릭
   * @param {Object} comparison 비교 결과
   * @returns {string} 추천 근거
   */
  generateRecommendationReasoning(recommendedMethod, hybridMetrics, pureLogicMetrics, comparison) {
    if (recommendedMethod === 'hybrid') {
      return `하이브리드 방식을 추천합니다. 주요 근거: 평균 신뢰도 ${hybridMetrics.avgConfidence} (순수 로직: ${pureLogicMetrics.avgConfidence}), 성공률 ${hybridMetrics.successRate}% (순수 로직: ${pureLogicMetrics.successRate}%). AI의 맥락 이해 능력이 복잡한 의료 데이터 처리에 유리합니다.`;
    } else {
      return `순수 로직 기반 방식을 추천합니다. 주요 근거: 처리 속도 ${pureLogicMetrics.avgProcessingTime}ms (하이브리드: ${hybridMetrics.avgProcessingTime}ms), 비용 효율성 (API 비용 없음), 성공률 ${pureLogicMetrics.successRate}%. 안정적이고 예측 가능한 결과를 제공합니다.`;
    }
  }

  /**
   * 구현 전략 생성
   * @param {string} recommendedMethod 추천 방식
   * @returns {Array} 구현 전략
   */
  generateImplementationStrategy(recommendedMethod) {
    if (recommendedMethod === 'hybrid') {
      return [
        '1. AI 모델 응답 안정성 확보를 위한 재시도 로직 구현',
        '2. API 비용 모니터링 및 예산 관리 시스템 구축',
        '3. Fallback 메커니즘으로 순수 로직 방식 병행 운영',
        '4. AI 응답 품질 검증 로직 추가',
        '5. 점진적 롤아웃을 통한 안정성 검증'
      ];
    } else {
      return [
        '1. 정규식 패턴 최적화 및 확장',
        '2. 의료 용어 사전 지속적 업데이트',
        '3. 예외 처리 로직 강화',
        '4. 성능 모니터링 시스템 구축',
        '5. 향후 AI 하이브리드 전환을 위한 아키텍처 준비'
      ];
    }
  }

  /**
   * 다음 단계 생성
   * @param {string} recommendedMethod 추천 방식
   * @returns {Array} 다음 단계
   */
  generateNextSteps(recommendedMethod) {
    const commonSteps = [
      '1. 상세 구현 계획 수립',
      '2. 개발 환경 설정 및 테스트 케이스 확장',
      '3. 성능 벤치마크 기준 설정'
    ];
    
    if (recommendedMethod === 'hybrid') {
      return [
        ...commonSteps,
        '4. OpenAI API 키 및 사용량 모니터링 설정',
        '5. AI 응답 품질 평가 메트릭 정의',
        '6. 프로덕션 환경 배포 전 충분한 테스트'
      ];
    } else {
      return [
        ...commonSteps,
        '4. 정규식 패턴 라이브러리 구축',
        '5. 의료 데이터 처리 정확도 향상 방안 연구',
        '6. 향후 AI 도입을 위한 데이터 수집 및 분석'
      ];
    }
  }

  /**
   * 비교 결과 저장
   * @param {Object} results 비교 결과
   */
  async saveComparisonResults(results) {
    const resultsDir = path.join(process.cwd(), 'backend', 'ai-verification', 'results');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
      
      // 전체 결과 저장
      await fs.writeFile(
        path.join(resultsDir, 'processing-method-comparison.json'),
        JSON.stringify(results, null, 2),
        'utf8'
      );
      
      // 요약 보고서 저장
      const summary = {
        timestamp: results.timestamp,
        recommendation: results.recommendation,
        keyMetrics: {
          hybrid: results.quantitativeMetrics.hybrid,
          pureLogic: results.quantitativeMetrics.pureLogic
        },
        qualitativeInsights: results.qualitativeAnalysis
      };
      
      await fs.writeFile(
        path.join(resultsDir, 'comparison-summary.json'),
        JSON.stringify(summary, null, 2),
        'utf8'
      );
      
      console.log('✅ 비교 결과 저장 완료');
      
    } catch (error) {
      console.error('❌ 비교 결과 저장 실패:', error.message);
    }
  }
}

export default ProcessingComparisonSystem;