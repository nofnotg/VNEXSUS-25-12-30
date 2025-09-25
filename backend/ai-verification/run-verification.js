/**
 * AI 검증 시스템 실행 스크립트
 * 
 * 사용법:
 * node backend/ai-verification/run-verification.js
 */

import AIVerificationSystem from './index.js';
import ProcessingComparison from './processing-comparison.js';
import GPT4oRevalidationSystem from './gpt4o-revalidation.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

class VerificationRunner {
  constructor() {
    this.verificationSystem = new AIVerificationSystem();
    this.caseDataPath = path.join(process.cwd(), 'src', 'rag', 'case_sample');
    this.testCases = [];
  }

  /**
   * 12개 케이스 데이터 로드
   */
  async loadTestCases() {
    console.log('📁 테스트 케이스 로드 중...');
    
    try {
      for (let i = 1; i <= 12; i++) {
        const caseFile = path.join(this.caseDataPath, `case${i}.txt`);
        
        try {
          const content = await fs.readFile(caseFile, 'utf8');
          this.testCases.push({
            id: i,
            filename: `case${i}.txt`,
            content: content.trim(),
            size: content.length
          });
          console.log(`✅ Case ${i} 로드 완료 (${content.length} 문자)`);
        } catch (error) {
          console.warn(`⚠️ Case ${i} 로드 실패: ${error.message}`);
        }
      }
      
      console.log(`\n📊 총 ${this.testCases.length}개 케이스 로드 완료`);
      console.log(`📏 평균 케이스 크기: ${Math.round(this.testCases.reduce((sum, c) => sum + c.size, 0) / this.testCases.length)} 문자`);
      
    } catch (error) {
      console.error('❌ 케이스 로드 실패:', error.message);
      throw error;
    }
  }

  /**
   * 전체 검증 프로세스 실행
   */
  async runFullVerification() {
    console.log('\n🚀 AI 검증 시스템 시작...');
    console.log('=' .repeat(60));
    
    // 환경 변수 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }
    
    // 케이스 로드
    await this.loadTestCases();
    
    if (this.testCases.length === 0) {
      throw new Error('로드된 테스트 케이스가 없습니다.');
    }
    
    const results = {
      timestamp: new Date().toISOString(),
      totalCases: this.testCases.length,
      verificationResults: {},
      comparisonResults: null,
      performanceMetrics: {},
      summary: {}
    };
    
    try {
      // 1단계: 하이브리드 vs 순수 로직 비교 (우선순위)
      console.log('\n🔄 1단계: 하이브리드 vs 순수 로직 기반 처리 방식 비교');
      console.log('-'.repeat(60));
      results.comparisonResults = await this.verificationSystem.compareProcessingMethods(this.testCases);
      await this.verificationSystem.saveResults(results.comparisonResults, 'processing-method-comparison.json');
      
      // 2단계: GPT-4o-mini 완전 검증
      console.log('\n🤖 2단계: GPT-4o-mini 모델 완전 검증');
      console.log('-'.repeat(60));
      results.verificationResults['gpt-4o-mini'] = await this.verificationSystem.performFullVerification('gpt-4o-mini', this.testCases);
      await this.verificationSystem.saveResults(results.verificationResults['gpt-4o-mini'], 'gpt-4o-mini-verification.json');
      
      // 3단계: o1-mini 완전 검증
      console.log('\n🧠 3단계: o1-mini 모델 완전 검증');
      console.log('-'.repeat(60));
      results.verificationResults['o1-mini'] = await this.verificationSystem.performFullVerification('o1-mini', this.testCases);
      await this.verificationSystem.saveResults(results.verificationResults['o1-mini'], 'o1-mini-verification.json');
      
      // 4단계: 성능 메트릭 계산
      console.log('\n📊 4단계: 성능 메트릭 계산');
      console.log('-'.repeat(60));
      results.performanceMetrics = this.verificationSystem.calculatePerformanceMetrics(results.verificationResults);
      
      // 5단계: 결과 분석 및 요약
      console.log('\n📋 5단계: 결과 분석 및 요약');
      console.log('-'.repeat(60));
      results.summary = this.generateSummary(results);
      
      // 6단계: GPT-4o 재검증 필요성 판단
      const revalidationSystem = new GPT4oRevalidationSystem();
      const revalidationAssessment = revalidationSystem.assessRevalidationNeed(results.verificationResults);
      
      if (revalidationAssessment.needsRevalidation) {
        console.log('\n🔍 6단계: GPT-4o 최종 재검증 실행');
        console.log('-'.repeat(60));
        console.log(`재검증 사유: ${revalidationAssessment.reason}`);
        
        // GPT-4o 재검증 실행
        const revalidationResults = await revalidationSystem.executeGPT4oRevalidation(
          revalidationAssessment.problematicCases,
          this.testCases,
          results
        );
        
        // 프롬프트 개선 방향 도출
        const promptImprovements = revalidationSystem.derivePromptImprovements(
          revalidationResults,
          results.verificationResults
        );
        
        results.gpt4oRevalidation = {
          assessment: revalidationAssessment,
          revalidationResults,
          promptImprovements,
          summary: revalidationSystem.getRevalidationSummary()
        };
        
        // 재검증 후 메트릭 업데이트
        results.performanceMetrics = this.verificationSystem.calculatePerformanceMetrics(results.verificationResults);
        results.summary = this.generateSummary(results);
      } else {
        console.log('\n✅ GPT-4o 재검증 불필요 - 기존 검증 결과가 충분히 양호함');
        results.gpt4oRevalidation = {
          assessment: revalidationAssessment,
          revalidationSkipped: true,
          reason: '재검증 임계값을 충족함'
        };
      }
      
      // 최종 결과 저장
      await this.verificationSystem.saveResults(results, 'complete-verification-results.json');
      
      // 결과 출력
      this.printFinalResults(results);
      
      return results;
      
    } catch (error) {
      console.error('❌ 검증 프로세스 실패:', error.message);
      
      // 부분 결과라도 저장
      await this.verificationSystem.saveResults({
        ...results,
        error: error.message,
        partialResults: true
      }, 'partial-verification-results.json');
      
      throw error;
    }
  }

  /**
   * GPT-4o 재검증 필요성 평가
   * @param {Object} results 검증 결과
   * @returns {Object} 재검증 필요성 판단 결과
   */
  assessNeedForGPT4oRevalidation(results) {
    const metrics = results.performanceMetrics;
    
    // 정확도가 90% 미만인 모델이 있는지 확인
    const lowAccuracyModels = Object.entries(metrics).filter(([model, metric]) => {
      return parseFloat(metric.accuracy) < 90;
    });
    
    // 모델 간 일관성이 낮은지 확인
    const accuracyValues = Object.values(metrics).map(m => parseFloat(m.accuracy));
    const accuracyVariance = this.calculateVariance(accuracyValues);
    
    // 비용이 예상보다 높은지 확인
    const totalCost = Object.values(metrics).reduce((sum, m) => sum + m.totalCost, 0);
    
    if (lowAccuracyModels.length > 0) {
      return {
        needed: true,
        reason: `정확도 미달 모델 발견: ${lowAccuracyModels.map(([model, metric]) => `${model}(${metric.accuracy}%)`).join(', ')}`
      };
    }
    
    if (accuracyVariance > 100) {
      return {
        needed: true,
        reason: `모델 간 일관성 부족 (분산: ${accuracyVariance.toFixed(2)})`
      };
    }
    
    if (totalCost > 1.0) {
      return {
        needed: true,
        reason: `예상 비용 초과 ($${totalCost.toFixed(4)} > $1.00)`
      };
    }
    
    return {
      needed: false,
      reason: '모든 검증 기준 충족'
    };
  }

  /**
   * 문제가 있는 케이스 식별
   * @param {Object} results 검증 결과
   * @returns {Array} 문제가 있는 케이스들
   */
  identifyProblematicCases(results) {
    const problematicCaseIds = new Set();
    
    // 실패한 케이스들 수집
    Object.values(results.verificationResults).forEach(modelResult => {
      modelResult.results.forEach(result => {
        if (!result.success) {
          problematicCaseIds.add(result.caseId);
        }
      });
    });
    
    // 문제가 있는 케이스들만 반환
    return this.testCases.filter(testCase => problematicCaseIds.has(testCase.id));
  }

  /**
   * 분산 계산
   * @param {Array} values 값 배열
   * @returns {number} 분산
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  /**
   * 결과 요약 생성
   * @param {Object} results 검증 결과
   * @returns {Object} 요약 정보
   */
  generateSummary(results) {
    const summary = {
      overview: {
        totalCases: results.totalCases,
        modelsUsed: Object.keys(results.verificationResults),
        processingMethodsCompared: results.comparisonResults ? 2 : 0
      },
      performance: {},
      recommendations: {},
      costAnalysis: {}
    };
    
    // 성능 요약
    Object.entries(results.performanceMetrics).forEach(([model, metrics]) => {
      summary.performance[model] = {
        accuracy: `${metrics.accuracy}%`,
        avgCost: `$${metrics.totalCost.toFixed(4)}`,
        completeness: `${metrics.completeness.toFixed(1)}%`,
        consistency: `${metrics.consistency.toFixed(1)}%`
      };
    });
    
    // 최적 모델 추천
    const bestModel = this.findBestModel(results.performanceMetrics);
    summary.recommendations.bestModel = bestModel;
    
    // 처리 방식 추천
    if (results.comparisonResults) {
      summary.recommendations.processingMethod = results.comparisonResults.comparison.recommendation;
      summary.recommendations.processingAnalysis = results.comparisonResults.comparison.analysis;
    }
    
    // 비용 분석
    const totalCost = Object.values(results.performanceMetrics).reduce((sum, m) => sum + m.totalCost, 0);
    summary.costAnalysis = {
      totalCost: `$${totalCost.toFixed(4)}`,
      budgetUtilization: `${(totalCost / 5 * 100).toFixed(1)}%`,
      costPerCase: `$${(totalCost / results.totalCases).toFixed(4)}`,
      remainingBudget: `$${Math.max(0, 5 - totalCost).toFixed(4)}`
    };
    
    return summary;
  }

  /**
   * 최적 모델 찾기
   * @param {Object} performanceMetrics 성능 메트릭
   * @returns {Object} 최적 모델 정보
   */
  findBestModel(performanceMetrics) {
    let bestModel = null;
    let bestScore = -1;
    
    Object.entries(performanceMetrics).forEach(([model, metrics]) => {
      // 종합 점수 계산 (정확도 40%, 완성도 30%, 일관성 20%, 비용효율성 10%)
      const accuracyScore = parseFloat(metrics.accuracy);
      const completenessScore = metrics.completeness;
      const consistencyScore = metrics.consistency;
      const costEfficiencyScore = Math.max(0, 100 - (metrics.totalCost * 1000)); // 비용이 낮을수록 높은 점수
      
      const compositeScore = (
        accuracyScore * 0.4 +
        completenessScore * 0.3 +
        consistencyScore * 0.2 +
        costEfficiencyScore * 0.1
      );
      
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestModel = {
          model,
          score: compositeScore.toFixed(2),
          metrics: {
            accuracy: `${accuracyScore}%`,
            completeness: `${completenessScore.toFixed(1)}%`,
            consistency: `${consistencyScore.toFixed(1)}%`,
            cost: `$${metrics.totalCost.toFixed(4)}`
          }
        };
      }
    });
    
    return bestModel;
  }

  /**
   * 최종 결과 출력
   * @param {Object} results 검증 결과
   */
  printFinalResults(results) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 AI 검증 시스템 최종 결과');
    console.log('='.repeat(80));
    
    // 개요
    console.log('\n📊 검증 개요:');
    console.log(`   • 총 케이스 수: ${results.summary.overview.totalCases}개`);
    console.log(`   • 사용된 모델: ${results.summary.overview.modelsUsed.join(', ')}`);
    console.log(`   • 처리 방식 비교: ${results.summary.overview.processingMethodsCompared}가지`);
    
    // 성능 결과
    console.log('\n🏆 모델별 성능:');
    Object.entries(results.summary.performance).forEach(([model, perf]) => {
      console.log(`   ${model}:`);
      console.log(`     - 정확도: ${perf.accuracy}`);
      console.log(`     - 완성도: ${perf.completeness}`);
      console.log(`     - 일관성: ${perf.consistency}`);
      console.log(`     - 평균 비용: ${perf.avgCost}`);
    });
    
    // 추천 사항
    console.log('\n💡 추천 사항:');
    if (results.summary.recommendations.bestModel) {
      const best = results.summary.recommendations.bestModel;
      console.log(`   • 최적 모델: ${best.model} (종합점수: ${best.score})`);
    }
    
    if (results.summary.recommendations.processingMethod) {
      console.log(`   • 권장 처리 방식: ${results.summary.recommendations.processingMethod}`);
    }
    
    // 비용 분석
    console.log('\n💰 비용 분석:');
    console.log(`   • 총 비용: ${results.summary.costAnalysis.totalCost}`);
    console.log(`   • 예산 사용률: ${results.summary.costAnalysis.budgetUtilization}`);
    console.log(`   • 케이스당 비용: ${results.summary.costAnalysis.costPerCase}`);
    console.log(`   • 잔여 예산: ${results.summary.costAnalysis.remainingBudget}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 검증 완료! 상세 결과는 backend/ai-verification/results/ 폴더를 확인하세요.');
    console.log('='.repeat(80));
  }
}

// 메인 실행
async function main() {
  try {
    const runner = new VerificationRunner();
    await runner.runFullVerification();
    
    console.log('\n🎉 AI 검증 시스템이 성공적으로 완료되었습니다!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 AI 검증 시스템 실행 실패:');
    console.error(error.message);
    console.error('\n스택 트레이스:');
    console.error(error.stack);
    
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default VerificationRunner;