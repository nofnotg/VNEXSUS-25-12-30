/**
 * GPT-4o 최종 재검증 및 프롬프트 개선 시스템
 * 
 * 역할:
 * 1. GPT-4o-mini와 o1-mini 검증 결과가 기대 수준에 미달할 경우 GPT-4o로 최종 재검증
 * 2. 프롬프트 개선 방향 도출 및 최적화 전략 수립
 * 3. 검증 품질 향상을 위한 체계적 접근법 제공
 * 4. 모델별 성능 비교 및 최적 활용 전략 권고
 */

import OpenAI from 'openai';

class GPT4oRevalidationSystem {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.revalidationThresholds = {
      overallScoreThreshold: 70,    // 전체 점수 임계값
      confidenceThreshold: 75,      // 신뢰도 임계값
      consistencyThreshold: 0.8,    // 모델 간 일관성 임계값
      errorRateThreshold: 0.3       // 오류율 임계값
    };
    
    this.revalidationResults = [];
    this.promptImprovements = [];
  }

  /**
   * 재검증 필요성 평가
   * @param {Array} verificationResults GPT-4o-mini와 o1-mini 검증 결과
   * @returns {Object} 재검증 필요성 평가 결과
   */
  assessRevalidationNeed(verificationResults) {
    console.log('🔍 GPT-4o 재검증 필요성 평가 중...');
    
    const assessment = {
      needsRevalidation: false,
      reasons: [],
      problematicCases: [],
      overallAssessment: {},
      recommendations: []
    };
    
    // 성공한 검증 결과만 분석
    const successfulResults = verificationResults.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      assessment.needsRevalidation = true;
      assessment.reasons.push('모든 검증이 실패함');
      return assessment;
    }
    
    // 1. 전체 점수 평가
    const overallScores = this.extractOverallScores(successfulResults);
    const avgOverallScore = overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length;
    
    if (avgOverallScore < this.revalidationThresholds.overallScoreThreshold) {
      assessment.needsRevalidation = true;
      assessment.reasons.push(`평균 전체 점수가 임계값 미달 (${avgOverallScore.toFixed(2)} < ${this.revalidationThresholds.overallScoreThreshold})`);
    }
    
    // 2. 신뢰도 평가
    const confidenceLevels = this.extractConfidenceLevels(successfulResults);
    const avgConfidence = confidenceLevels.reduce((sum, conf) => sum + conf, 0) / confidenceLevels.length;
    
    if (avgConfidence < this.revalidationThresholds.confidenceThreshold) {
      assessment.needsRevalidation = true;
      assessment.reasons.push(`평균 신뢰도가 임계값 미달 (${avgConfidence.toFixed(2)} < ${this.revalidationThresholds.confidenceThreshold})`);
    }
    
    // 3. 모델 간 일관성 평가
    const consistency = this.evaluateModelConsistency(successfulResults);
    
    if (consistency < this.revalidationThresholds.consistencyThreshold) {
      assessment.needsRevalidation = true;
      assessment.reasons.push(`모델 간 일관성이 임계값 미달 (${consistency.toFixed(2)} < ${this.revalidationThresholds.consistencyThreshold})`);
    }
    
    // 4. 오류율 평가
    const errorRate = (verificationResults.length - successfulResults.length) / verificationResults.length;
    
    if (errorRate > this.revalidationThresholds.errorRateThreshold) {
      assessment.needsRevalidation = true;
      assessment.reasons.push(`오류율이 임계값 초과 (${(errorRate * 100).toFixed(2)}% > ${this.revalidationThresholds.errorRateThreshold * 100}%)`);
    }
    
    // 5. 문제가 있는 케이스 식별
    assessment.problematicCases = this.identifyProblematicCases(successfulResults);
    
    if (assessment.problematicCases.length > 0) {
      assessment.needsRevalidation = true;
      assessment.reasons.push(`${assessment.problematicCases.length}개의 문제가 있는 케이스 발견`);
    }
    
    // 전체 평가 요약
    assessment.overallAssessment = {
      averageOverallScore: avgOverallScore,
      averageConfidence: avgConfidence,
      modelConsistency: consistency,
      errorRate: errorRate,
      successfulVerifications: successfulResults.length,
      totalVerifications: verificationResults.length
    };
    
    // 권고사항 생성
    assessment.recommendations = this.generateRevalidationRecommendations(assessment);
    
    console.log(`  📊 재검증 필요성: ${assessment.needsRevalidation ? '필요' : '불필요'}`);
    console.log(`  📈 평균 점수: ${avgOverallScore.toFixed(2)}, 평균 신뢰도: ${avgConfidence.toFixed(2)}`);
    
    return assessment;
  }

  /**
   * GPT-4o 최종 재검증 실행
   * @param {Array} problematicCases 문제가 있는 케이스들
   * @param {Array} originalTestCases 원본 테스트 케이스들
   * @param {Array} processedResults 처리 결과들
   * @returns {Promise<Array>} 재검증 결과
   */
  async executeGPT4oRevalidation(problematicCases, originalTestCases, processedResults) {
    console.log('🚀 GPT-4o 최종 재검증 시작...');
    
    const revalidationResults = [];
    
    for (const problematicCase of problematicCases) {
      console.log(`  🔍 케이스 ${problematicCase.caseId} GPT-4o 재검증 중...`);
      
      try {
        // 원본 테스트 케이스와 처리 결과 찾기
        const originalCase = originalTestCases.find(tc => tc.id === problematicCase.caseId);
        const processedResult = processedResults.find(pr => pr.caseId === problematicCase.caseId);
        
        if (!originalCase || !processedResult) {
          console.warn(`    ⚠️ 케이스 ${problematicCase.caseId}의 원본 데이터 또는 처리 결과를 찾을 수 없음`);
          continue;
        }
        
        // GPT-4o 재검증 실행
        const revalidationResult = await this.performGPT4oVerification(
          originalCase,
          processedResult,
          problematicCase.issues
        );
        
        revalidationResults.push(revalidationResult);
        
        console.log(`    ✅ 케이스 ${problematicCase.caseId} 재검증 완료`);
        
      } catch (error) {
        console.error(`    ❌ 케이스 ${problematicCase.caseId} 재검증 실패:`, error.message);
        
        revalidationResults.push({
          caseId: problematicCase.caseId,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    this.revalidationResults = revalidationResults;
    
    console.log(`🎯 GPT-4o 재검증 완료: ${revalidationResults.length}개 케이스 처리`);
    
    return revalidationResults;
  }

  /**
   * GPT-4o 검증 수행
   * @param {Object} testCase 테스트 케이스
   * @param {Object} processedResult 처리 결과
   * @param {Array} knownIssues 알려진 문제점들
   * @returns {Promise<Object>} 검증 결과
   */
  async performGPT4oVerification(testCase, processedResult, knownIssues) {
    const startTime = Date.now();
    
    // GPT-4o 전용 고급 검증 프롬프트 생성
    const systemPrompt = this.getGPT4oSystemPrompt();
    const verificationPrompt = this.getGPT4oVerificationPrompt(
      testCase,
      processedResult,
      knownIssues
    );
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: verificationPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      });
      
      const processingTime = Date.now() - startTime;
      
      // 응답 파싱
      const verificationResult = this.parseGPT4oResponse(response);
      
      return {
        caseId: testCase.id,
        model: 'gpt-4o',
        success: true,
        processingTime,
        verificationResult,
        apiUsage: response.usage,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        caseId: testCase.id,
        model: 'gpt-4o',
        success: false,
        processingTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GPT-4o 시스템 프롬프트
   * @returns {string} 시스템 프롬프트
   */
  getGPT4oSystemPrompt() {
    return `당신은 의료 데이터 처리 시스템의 최고 수준 검증 전문가입니다.

**전문 역할:**
1. 다른 AI 모델들의 검증 결과에서 발견된 문제점들을 심층 분석
2. 최고 수준의 정확성과 신뢰성으로 최종 검증 수행
3. 시스템 개선을 위한 구체적이고 실행 가능한 권고사항 제시
4. 프롬프트 최적화 및 검증 프로세스 개선 방향 도출

**검증 원칙:**
- 의료 정보의 정확성과 완전성을 최우선으로 고려
- 다층적 검증을 통한 종합적 품질 평가
- 실무 환경에서의 실용성과 안전성 확보
- 지속적 개선을 위한 체계적 피드백 제공

**분석 접근법:**
- 기존 검증 결과의 한계점 분석
- 원본 데이터와 처리 결과의 정밀 비교
- 의료 표준 및 규제 요구사항 준수 확인
- 시스템 성능 최적화 기회 식별

**응답 품질:**
- 최고 수준의 정확성과 신뢰성
- 구체적이고 실행 가능한 개선 방안
- 명확한 근거와 논리적 설명
- 장기적 관점의 전략적 권고사항`;
  }

  /**
   * GPT-4o 검증 프롬프트
   * @param {Object} testCase 테스트 케이스
   * @param {Object} processedResult 처리 결과
   * @param {Array} knownIssues 알려진 문제점들
   * @returns {string} 검증 프롬프트
   */
  getGPT4oVerificationPrompt(testCase, processedResult, knownIssues) {
    return `다른 AI 모델들의 검증에서 문제가 발견된 케이스에 대해 최고 수준의 최종 검증을 수행해주세요.

**원본 OCR 데이터:**
${this.truncateData(testCase.content, 3000)}

**처리 결과:**
${JSON.stringify(processedResult, null, 2)}

**기존 검증에서 발견된 문제점들:**
${JSON.stringify(knownIssues, null, 2)}

**최종 검증 요구사항:**

1. **기존 문제점 재평가**
   - 다른 모델들이 지적한 문제점들의 타당성 검증
   - 누락되었거나 과대평가된 문제점 식별
   - 문제의 심각도와 우선순위 재평가

2. **종합적 품질 재검증**
   - 정보 추출의 정확성과 완전성
   - 의료 용어 및 표준 준수도
   - 데이터 구조화의 논리적 일관성
   - 실무 활용 가능성

3. **개선 방향 도출**
   - 구체적이고 실행 가능한 수정 방안
   - 시스템 최적화 기회
   - 프롬프트 개선 권고사항
   - 검증 프로세스 향상 방안

**응답 형식:**
\`\`\`json
{
  "revalidation_id": "unique_revalidation_id",
  "case_analysis": {
    "case_complexity": "simple|moderate|complex|highly_complex",
    "data_quality": "원본 데이터 품질 평가",
    "processing_challenges": ["처리 과정의 주요 도전 과제들"],
    "domain_specific_considerations": ["의료 도메인 특수 고려사항들"]
  },
  "issue_revalidation": {
    "confirmed_issues": [
      {
        "issue_type": "문제 유형",
        "severity": "critical|high|medium|low",
        "description": "문제 상세 설명",
        "evidence": "문제 근거",
        "impact_assessment": "영향도 평가"
      }
    ],
    "disputed_issues": [
      {
        "original_claim": "기존 지적 사항",
        "revalidation_finding": "재검증 결과",
        "reasoning": "판단 근거",
        "confidence_level": 0-100
      }
    ],
    "newly_identified_issues": [
      {
        "issue_type": "새로 발견된 문제 유형",
        "severity": "critical|high|medium|low",
        "description": "문제 상세 설명",
        "why_missed": "기존 검증에서 놓친 이유",
        "detection_method": "발견 방법"
      }
    ]
  },
  "comprehensive_quality_assessment": {
    "overall_quality_score": 0-100,
    "confidence_level": 0-100,
    "detailed_scores": {
      "accuracy": 0-100,
      "completeness": 0-100,
      "consistency": 0-100,
      "medical_compliance": 0-100,
      "usability": 0-100
    },
    "quality_dimensions": {
      "information_fidelity": "정보 충실도 평가",
      "structural_integrity": "구조적 무결성 평가",
      "semantic_accuracy": "의미적 정확성 평가",
      "practical_utility": "실용적 활용성 평가"
    },
    "benchmark_comparison": "의료 정보 처리 표준 대비 평가"
  },
  "improvement_recommendations": {
    "immediate_fixes": [
      {
        "fix_type": "수정 유형",
        "target_component": "대상 컴포넌트",
        "specific_action": "구체적 실행 방안",
        "expected_improvement": "예상 개선 효과",
        "implementation_effort": "구현 노력 수준",
        "risk_assessment": "위험 평가"
      }
    ],
    "systematic_improvements": [
      {
        "improvement_area": "개선 영역",
        "strategic_approach": "전략적 접근법",
        "implementation_plan": "구현 계획",
        "success_metrics": ["성공 지표들"],
        "timeline": "구현 일정"
      }
    ],
    "process_optimization": {
      "workflow_improvements": ["워크플로우 개선사항"],
      "automation_opportunities": ["자동화 기회"],
      "quality_gates": ["품질 관문 설정"],
      "monitoring_enhancements": ["모니터링 강화 방안"]
    }
  },
  "prompt_optimization_insights": {
    "current_prompt_analysis": {
      "strengths": ["현재 프롬프트의 강점"],
      "weaknesses": ["현재 프롬프트의 약점"],
      "missing_elements": ["누락된 요소들"],
      "clarity_issues": ["명확성 문제점들"]
    },
    "optimization_recommendations": [
      {
        "optimization_type": "최적화 유형",
        "current_approach": "현재 접근법",
        "recommended_approach": "권장 접근법",
        "rationale": "개선 근거",
        "expected_impact": "예상 효과"
      }
    ],
    "model_specific_guidance": {
      "gpt4o_mini_recommendations": ["GPT-4o-mini 특화 권고사항"],
      "o1_mini_recommendations": ["o1-mini 특화 권고사항"],
      "general_improvements": ["일반적 개선사항"]
    }
  },
  "verification_methodology_assessment": {
    "current_methodology_evaluation": "현재 검증 방법론 평가",
    "methodology_gaps": ["방법론 격차"],
    "enhancement_opportunities": ["향상 기회"],
    "best_practice_recommendations": ["모범 사례 권고사항"]
  },
  "final_verdict": {
    "processing_quality": "excellent|good|acceptable|poor",
    "deployment_readiness": "ready|needs_minor_fixes|needs_major_improvements|not_ready",
    "confidence_in_assessment": 0-100,
    "key_takeaways": ["핵심 시사점들"],
    "next_steps": ["다음 단계 권고사항"]
  }
}
\`\`\`

**검증 지침:**
- 의료 정보의 정확성과 안전성을 최우선으로 고려
- 기존 검증 결과를 비판적으로 재평가
- 실무 환경의 요구사항과 제약 조건 반영
- 지속적 개선을 위한 구체적이고 실행 가능한 권고사항 제시
- 최고 수준의 객관성과 신뢰성 유지`;
  }

  /**
   * 프롬프트 개선 방향 도출
   * @param {Array} revalidationResults 재검증 결과들
   * @param {Array} originalVerificationResults 원본 검증 결과들
   * @returns {Object} 프롬프트 개선 방향
   */
  derivePromptImprovements(revalidationResults, originalVerificationResults) {
    console.log('🔧 프롬프트 개선 방향 도출 중...');
    
    const improvements = {
      overallAssessment: {},
      modelSpecificImprovements: {
        'gpt-4o-mini': [],
        'o1-mini': []
      },
      systematicImprovements: [],
      implementationPlan: {},
      prioritizedActions: []
    };
    
    // 성공한 재검증 결과 분석
    const successfulRevalidations = revalidationResults.filter(r => r.success);
    
    if (successfulRevalidations.length === 0) {
      console.warn('  ⚠️ 성공한 재검증 결과가 없어 개선 방향 도출 제한됨');
      return improvements;
    }
    
    // 1. 전체 평가
    improvements.overallAssessment = this.assessOverallPromptPerformance(
      successfulRevalidations,
      originalVerificationResults
    );
    
    // 2. 모델별 개선사항 추출
    for (const model of ['gpt-4o-mini', 'o1-mini']) {
      improvements.modelSpecificImprovements[model] = this.extractModelSpecificImprovements(
        successfulRevalidations,
        model
      );
    }
    
    // 3. 체계적 개선사항 도출
    improvements.systematicImprovements = this.deriveSystematicImprovements(successfulRevalidations);
    
    // 4. 구현 계획 수립
    improvements.implementationPlan = this.createImplementationPlan(improvements);
    
    // 5. 우선순위 기반 실행 계획
    improvements.prioritizedActions = this.prioritizeImprovementActions(improvements);
    
    this.promptImprovements.push({
      timestamp: new Date().toISOString(),
      improvements,
      basedOnRevalidations: successfulRevalidations.length
    });
    
    console.log(`  ✅ 프롬프트 개선 방향 도출 완료: ${improvements.prioritizedActions.length}개 실행 계획`);
    
    return improvements;
  }

  /**
   * 전체 점수 추출
   * @param {Array} results 검증 결과들
   * @returns {Array} 전체 점수들
   */
  extractOverallScores(results) {
    return results
      .map(r => r.verificationResult?.overall_score || r.verificationResult?.comprehensive_assessment?.overall_quality_score || 0)
      .filter(score => score > 0);
  }

  /**
   * 신뢰도 추출
   * @param {Array} results 검증 결과들
   * @returns {Array} 신뢰도들
   */
  extractConfidenceLevels(results) {
    return results
      .map(r => r.verificationResult?.confidence_level || r.verificationResult?.comprehensive_quality_assessment?.confidence_level || 0)
      .filter(conf => conf > 0);
  }

  /**
   * 모델 간 일관성 평가
   * @param {Array} results 검증 결과들
   * @returns {number} 일관성 점수 (0-1)
   */
  evaluateModelConsistency(results) {
    // 케이스별로 모델 결과 그룹화
    const caseGroups = {};
    
    results.forEach(result => {
      if (!caseGroups[result.caseId]) {
        caseGroups[result.caseId] = [];
      }
      caseGroups[result.caseId].push(result);
    });
    
    // 각 케이스에서 모델 간 점수 차이 계산
    const consistencyScores = [];
    
    Object.values(caseGroups).forEach(caseResults => {
      if (caseResults.length >= 2) {
        const scores = this.extractOverallScores(caseResults);
        if (scores.length >= 2) {
          const maxScore = Math.max(...scores);
          const minScore = Math.min(...scores);
          const consistency = maxScore > 0 ? (1 - (maxScore - minScore) / 100) : 0;
          consistencyScores.push(Math.max(0, consistency));
        }
      }
    });
    
    return consistencyScores.length > 0 ?
      consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length :
      1; // 비교할 데이터가 없으면 완전 일관성으로 간주
  }

  /**
   * 문제가 있는 케이스 식별
   * @param {Array} results 검증 결과들
   * @returns {Array} 문제가 있는 케이스들
   */
  identifyProblematicCases(results) {
    const problematicCases = [];
    
    // 케이스별로 결과 그룹화
    const caseGroups = {};
    results.forEach(result => {
      if (!caseGroups[result.caseId]) {
        caseGroups[result.caseId] = [];
      }
      caseGroups[result.caseId].push(result);
    });
    
    // 각 케이스 분석
    Object.entries(caseGroups).forEach(([caseId, caseResults]) => {
      const issues = [];
      
      // 낮은 점수
      const scores = this.extractOverallScores(caseResults);
      const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
      
      if (avgScore < this.revalidationThresholds.overallScoreThreshold) {
        issues.push({
          type: 'low_score',
          description: `평균 점수가 임계값 미달 (${avgScore.toFixed(2)})`,
          severity: avgScore < 50 ? 'high' : 'medium'
        });
      }
      
      // 낮은 신뢰도
      const confidences = this.extractConfidenceLevels(caseResults);
      const avgConfidence = confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
      
      if (avgConfidence < this.revalidationThresholds.confidenceThreshold) {
        issues.push({
          type: 'low_confidence',
          description: `평균 신뢰도가 임계값 미달 (${avgConfidence.toFixed(2)})`,
          severity: avgConfidence < 50 ? 'high' : 'medium'
        });
      }
      
      // 모델 간 불일치
      if (caseResults.length >= 2) {
        const scoreVariance = this.calculateVariance(scores);
        if (scoreVariance > 400) { // 표준편차 20점 이상
          issues.push({
            type: 'model_disagreement',
            description: `모델 간 점수 차이가 큼 (분산: ${scoreVariance.toFixed(2)})`,
            severity: 'medium'
          });
        }
      }
      
      if (issues.length > 0) {
        problematicCases.push({
          caseId,
          issues,
          averageScore: avgScore,
          averageConfidence: avgConfidence,
          modelResults: caseResults.length
        });
      }
    });
    
    return problematicCases;
  }

  /**
   * 분산 계산
   * @param {Array} values 값들
   * @returns {number} 분산
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * 재검증 권고사항 생성
   * @param {Object} assessment 평가 결과
   * @returns {Array} 권고사항들
   */
  generateRevalidationRecommendations(assessment) {
    const recommendations = [];
    
    if (assessment.overallAssessment.averageOverallScore < 60) {
      recommendations.push({
        priority: 'high',
        action: 'GPT-4o 재검증 즉시 실행',
        reason: '전체 점수가 매우 낮음',
        expectedImpact: '검증 품질 대폭 향상'
      });
    }
    
    if (assessment.overallAssessment.errorRate > 0.2) {
      recommendations.push({
        priority: 'high',
        action: '프롬프트 안정성 개선',
        reason: '높은 오류율',
        expectedImpact: '검증 성공률 향상'
      });
    }
    
    if (assessment.overallAssessment.modelConsistency < 0.7) {
      recommendations.push({
        priority: 'medium',
        action: '모델별 프롬프트 특화',
        reason: '모델 간 일관성 부족',
        expectedImpact: '검증 일관성 향상'
      });
    }
    
    if (assessment.problematicCases.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: '문제 케이스 집중 분석',
        reason: `${assessment.problematicCases.length}개 문제 케이스 존재`,
        expectedImpact: '특정 케이스 처리 품질 향상'
      });
    }
    
    return recommendations;
  }

  /**
   * GPT-4o 응답 파싱
   * @param {Object} response API 응답
   * @returns {Object} 파싱된 결과
   */
  parseGPT4oResponse(response) {
    try {
      const content = response.choices[0].message.content;
      
      if (content.includes('{') && content.includes('}')) {
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        const jsonContent = content.substring(jsonStart, jsonEnd);
        
        return JSON.parse(jsonContent);
      }
      
      return {
        revalidation_id: `gpt4o_${Date.now()}`,
        final_verdict: {
          processing_quality: 'unknown',
          deployment_readiness: 'needs_review',
          confidence_in_assessment: 0,
          key_takeaways: ['JSON 파싱 실패'],
          next_steps: ['응답 형식 검토 필요']
        },
        raw_response: content
      };
      
    } catch (error) {
      console.warn('GPT-4o 응답 파싱 실패:', error.message);
      
      return {
        revalidation_id: `gpt4o_${Date.now()}`,
        parsing_error: error.message,
        raw_response: response.choices[0].message.content,
        final_verdict: {
          processing_quality: 'unknown',
          deployment_readiness: 'needs_review',
          confidence_in_assessment: 0,
          key_takeaways: ['응답 파싱 중 오류 발생'],
          next_steps: ['오류 원인 분석 및 수정 필요']
        }
      };
    }
  }

  /**
   * 데이터 길이 제한
   * @param {string} data 원본 데이터
   * @param {number} maxLength 최대 길이
   * @returns {string} 제한된 데이터
   */
  truncateData(data, maxLength) {
    if (data.length <= maxLength) {
      return data;
    }
    
    const truncated = data.substring(0, maxLength);
    return truncated + '\n\n[데이터가 길어 일부만 표시됨]';
  }

  /**
   * 전체 프롬프트 성능 평가
   * @param {Array} revalidationResults 재검증 결과들
   * @param {Array} originalResults 원본 검증 결과들
   * @returns {Object} 전체 성능 평가
   */
  assessOverallPromptPerformance(revalidationResults, originalResults) {
    // 구현 예정: 전체적인 프롬프트 성능 분석
    return {
      improvement_needed: true,
      key_areas: ['accuracy', 'consistency', 'reliability'],
      overall_assessment: 'GPT-4o 재검증을 통해 개선 방향 도출 필요'
    };
  }

  /**
   * 모델별 개선사항 추출
   * @param {Array} revalidationResults 재검증 결과들
   * @param {string} model 모델명
   * @returns {Array} 모델별 개선사항들
   */
  extractModelSpecificImprovements(revalidationResults, model) {
    // 구현 예정: 모델별 특화된 개선사항 추출
    return [
      {
        area: 'prompt_clarity',
        description: `${model} 모델을 위한 프롬프트 명확성 개선`,
        priority: 'high'
      }
    ];
  }

  /**
   * 체계적 개선사항 도출
   * @param {Array} revalidationResults 재검증 결과들
   * @returns {Array} 체계적 개선사항들
   */
  deriveSystematicImprovements(revalidationResults) {
    // 구현 예정: 시스템 전체의 체계적 개선사항 도출
    return [
      {
        type: 'methodology',
        description: '검증 방법론 개선',
        impact: 'high'
      }
    ];
  }

  /**
   * 구현 계획 수립
   * @param {Object} improvements 개선사항들
   * @returns {Object} 구현 계획
   */
  createImplementationPlan(improvements) {
    // 구현 예정: 개선사항들의 구현 계획 수립
    return {
      phases: [
        {
          name: 'immediate_fixes',
          duration: '1-2 days',
          priority: 'high'
        }
      ]
    };
  }

  /**
   * 개선 실행 계획 우선순위화
   * @param {Object} improvements 개선사항들
   * @returns {Array} 우선순위 기반 실행 계획
   */
  prioritizeImprovementActions(improvements) {
    // 구현 예정: 개선 실행 계획의 우선순위 설정
    return [
      {
        priority: 1,
        action: '프롬프트 명확성 개선',
        timeline: 'immediate'
      }
    ];
  }

  /**
   * 재검증 결과 요약
   * @returns {Object} 재검증 결과 요약
   */
  getRevalidationSummary() {
    const successfulRevalidations = this.revalidationResults.filter(r => r.success);
    const failedRevalidations = this.revalidationResults.filter(r => !r.success);
    
    return {
      totalRevalidations: this.revalidationResults.length,
      successfulRevalidations: successfulRevalidations.length,
      failedRevalidations: failedRevalidations.length,
      successRate: this.revalidationResults.length > 0 ?
        (successfulRevalidations.length / this.revalidationResults.length * 100).toFixed(2) : 0,
      averageProcessingTime: successfulRevalidations.length > 0 ?
        Math.round(successfulRevalidations.reduce((sum, r) => sum + r.processingTime, 0) / successfulRevalidations.length) : 0,
      promptImprovements: this.promptImprovements.length,
      revalidationResults: this.revalidationResults
    };
  }
}

export default GPT4oRevalidationSystem;