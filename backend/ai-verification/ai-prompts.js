import OpenAI from 'openai';
import config from './config.js';
import { FileUtils, PerformanceUtils, RetryUtils } from './utils.js';

/**
 * AI 프롬프트 관리 시스템
 * GPT-4o-mini와 o1-mini 모델을 위한 검증 프롬프트 제공
 */
export class AIPromptManager {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    
    this.verificationResults = [];
    this.promptPerformance = {
      'gpt-4o-mini': {
        totalCalls: 0,
        successRate: 0,
        avgConfidence: 0,
        lastUpdated: new Date().toISOString()
      },
      'o1-mini': {
        totalCalls: 0,
        successRate: 0,
        avgConfidence: 0,
        lastUpdated: new Date().toISOString()
      }
    };
    
    this.promptTemplates = this.initializePromptTemplates();
  }

  /**
   * 프롬프트 템플릿 초기화
   */
  initializePromptTemplates() {
    return {
      'gpt-4o-mini': {
        systemPrompt: this.getGPT4oMiniSystemPrompt(),
        verificationPrompt: this.getGPT4oMiniVerificationPrompt(),
        actionablePrompt: this.getGPT4oMiniActionablePrompt()
      },
      'o1-mini': {
        systemPrompt: this.getO1MiniSystemPrompt(),
        verificationPrompt: this.getO1MiniVerificationPrompt(),
        actionablePrompt: this.getO1MiniActionablePrompt()
      }
    };
  }

  /**
   * GPT-4o-mini 시스템 프롬프트
   */
  getGPT4oMiniSystemPrompt() {
    return `당신은 의료 데이터 처리 시스템의 전문 검증 분석가입니다.

**핵심 역할:**
1. 의료 데이터 후처리 결과의 정확성과 완성도 평가
2. 하이브리드 방식과 순수 로직 기반 처리 방식의 비교 분석
3. 실행 가능한 개선 방안 제시
4. 정량적 평가 지표 제공

**품질 기준:**
- 의료 정보의 정확성과 완전성
- 데이터 구조화 수준
- 핵심 정보 추출 정도
- 임상적 유용성

**응답 특성:**
- JSON 형식으로 구조화된 응답
- 정량적 점수 (0-100점)
- 신뢰도 수준 (0-100%)
- 구체적이고 실행 가능한 개선 방안

응답은 반드시 유효한 JSON 형식이어야 합니다.`;
  }

  /**
   * GPT-4o-mini 검증 프롬프트
   */
  getGPT4oMiniVerificationPrompt() {
    return `다음 의료 데이터 후처리 결과를 종합적으로 검증해주세요.

**원본 데이터:**
{originalData}

**후처리 결과:**
{processedResult}

**검증 요구사항:**
1. 정보 정확성 평가 (0-100점)
2. 데이터 완성도 평가 (0-100점)
3. 구조화 품질 평가 (0-100점)
4. 임상적 유용성 평가 (0-100점)
5. 전체적 신뢰도 수준 (0-100%)

**응답 형식:**
\`\`\`json
{
  "verification_id": "unique_verification_id",
  "overall_score": 85,
  "detailed_scores": {
    "accuracy": 90,
    "completeness": 80,
    "structure_quality": 85,
    "clinical_utility": 85
  },
  "confidence_level": 88,
  "strengths": ["구체적 강점 1", "구체적 강점 2"],
  "weaknesses": ["구체적 약점 1", "구체적 약점 2"],
  "recommendations": [
    {
      "priority": "high",
      "action": "구체적 개선 방안",
      "expected_impact": "예상 효과",
      "implementation_time": "예상 소요 시간"
    }
  ],
  "risk_assessment": {
    "level": "medium",
    "factors": ["위험 요소 1", "위험 요소 2"]
  }
}
\`\`\`

정확하고 객관적인 평가를 제공해주세요.`;
  }

  /**
   * GPT-4o-mini 실행 가능한 프롬프트
   */
  getGPT4oMiniActionablePrompt() {
    return `검증 결과를 바탕으로 실행 가능한 개선 전략을 수립해주세요.

**검증 분석 결과:**
{verificationResult}

**시스템 현황:**
{systemStatus}

**제약 조건:**
{constraints}

**전략적 대응 방안 수립:**

1. **즉시 실행 가능한 최적화** (24-48시간 내)
2. **단기 구조적 개선** (2-4주 내)
3. **중기 시스템 고도화** (2-3개월 내)
4. **장기 전략적 발전** (6-12개월 내)

**응답 형식:**
\`\`\`json
{
  "strategy_id": "unique_strategy_id",
  "immediate_actions": [
    {
      "action": "구체적 실행 방안",
      "priority": "high",
      "resources_needed": ["필요 리소스"],
      "expected_outcome": "예상 결과",
      "success_metrics": ["성공 지표"]
    }
  ],
  "short_term_improvements": [
    {
      "improvement": "개선 방안",
      "timeline": "2-4주",
      "dependencies": ["의존성"],
      "risk_level": "low"
    }
  ],
  "long_term_optimization": [
    {
      "optimization": "최적화 방안",
      "timeline": "2-3개월",
      "investment_required": "필요 투자",
      "roi_estimate": "ROI 예상치"
    }
  ],
  "monitoring_recommendations": [
    {
      "metric": "모니터링 지표",
      "frequency": "측정 빈도",
      "threshold": "임계값",
      "action_trigger": "조치 트리거"
    }
  ],
  "implementation_priority": {
    "criteria": {
      "impact_score": "영향도 점수 (1-10)",
      "feasibility_score": "실행 가능성 점수 (1-10)",
      "resource_requirement": "리소스 요구도 (low/medium/high)",
      "timeline": "예상 완료 시간"
    }
  }
}
\`\`\`

응답은 JSON 형식으로 제공해주세요.`;
  }

  /**
   * o1-mini 시스템 프롬프트
   */
  getO1MiniSystemPrompt() {
    return `당신은 의료 데이터 처리 시스템의 고급 분석 전문가입니다.

**전문 영역:**
- 복합적 의료 데이터 분석
- 다차원적 품질 평가
- 전략적 시스템 최적화
- 위험 기반 의사결정

**분석 접근법:**
1. 심층적 데이터 품질 분석
2. 다각도 검증 방법론 적용
3. 통계적 신뢰성 평가
4. 임상적 타당성 검토

**품질 표준:**
- 의료 표준 준수 (HL7, FHIR 등)
- 데이터 무결성 보장
- 개인정보 보호 고려
- 임상 워크플로우 최적화

심층적이고 포괄적인 분석을 통해 최고 수준의 검증 결과를 제공하세요.`;
  }

  /**
   * o1-mini 검증 프롬프트
   */
  getO1MiniVerificationPrompt() {
    return `의료 데이터 후처리 결과에 대한 심층적이고 포괄적인 검증을 수행해주세요.

**분석 대상:**

**원본 데이터:**
{originalData}

**후처리 결과:**
{processedResult}

**심층 분석 요구사항:**

1. **데이터 품질 다차원 평가**
   - 정확성 (Accuracy): 정보의 정확도
   - 완전성 (Completeness): 누락 정보 분석
   - 일관성 (Consistency): 내부 논리적 일관성
   - 적시성 (Timeliness): 정보의 시의성
   - 유효성 (Validity): 의료 표준 준수도

2. **복합 검증 프로세스**
   - 구조적 무결성 검사
   - 의미론적 정확성 평가
   - 임상적 타당성 검토
   - 상호 참조 일관성 확인

3. **위험 평가 및 영향 분석**
   - 잠재적 오류 영향도
   - 임상적 위험 수준
   - 데이터 신뢰성 지수
   - 의사결정 지원 적합성

**응답 형식:**
\`\`\`json
{
  "verification_id": "comprehensive_verification_id",
  "overall_assessment": {
    "overall_score": 0,
    "confidence_level": 0,
    "reliability_index": 0,
    "clinical_readiness": "ready/conditional/not_ready"
  },
  "dimensional_analysis": {
    "accuracy": {
      "score": 0,
      "analysis": "상세 분석",
      "critical_issues": []
    },
    "completeness": {
      "score": 0,
      "missing_elements": [],
      "impact_assessment": "영향 평가"
    },
    "consistency": {
      "score": 0,
      "inconsistencies": [],
      "severity_level": "low/medium/high"
    },
    "validity": {
      "score": 0,
      "standard_compliance": [],
      "deviations": []
    }
  },
  "comprehensive_validation": {
    "structural_integrity": {
      "status": "pass/fail",
      "issues": [],
      "recommendations": []
    },
    "semantic_accuracy": {
      "status": "pass/fail",
      "semantic_errors": [],
      "context_appropriateness": "appropriate/questionable/inappropriate"
    },
    "clinical_validity": {
      "status": "pass/fail",
      "clinical_concerns": [],
      "workflow_compatibility": "compatible/needs_adjustment/incompatible"
    }
  },
  "risk_assessment": {
    "overall_risk_level": "low/medium/high/critical",
    "risk_factors": [
      {
        "factor": "위험 요소",
        "severity": "low/medium/high",
        "probability": "확률 (0-1)",
        "impact": "영향도 설명",
        "mitigation": "완화 방안"
      }
    ],
    "decision_support_readiness": "ready/conditional/not_ready"
  },
  "strategic_recommendations": [
    {
      "category": "immediate/short_term/long_term",
      "recommendation": "구체적 권고사항",
      "rationale": "근거",
      "expected_impact": "예상 효과",
      "implementation_complexity": "low/medium/high",
      "resource_requirements": ["필요 리소스"]
    }
  ],
  "quality_assurance_framework": {
    "monitoring_points": ["모니터링 지점"],
    "validation_checkpoints": ["검증 체크포인트"],
    "continuous_improvement_areas": ["지속 개선 영역"]
  }
}
\`\`\`

최고 수준의 의료 데이터 품질 기준에 따라 심층적이고 포괄적인 검증을 수행해주세요.`;
  }

  /**
   * o1-mini 실행 가능한 프롬프트
   */
  getO1MiniActionablePrompt() {
    return `심층 검증 결과를 바탕으로 전략적이고 실행 가능한 종합 개선 전략을 수립해주세요.

**검증 분석 결과:**
{verificationResult}

**시스템 현황:**
{systemStatus}

**제약 조건:**
{constraints}

**전략적 대응 방안 수립:**

**응답 형식:**
\`\`\`json
{
  "strategy_id": "comprehensive_strategy_id",
  "executive_summary": {
    "current_state_assessment": "현재 상태 평가",
    "strategic_direction": "전략적 방향성",
    "expected_outcomes": "예상 성과",
    "success_probability": "성공 확률 (0-1)"
  },
  "immediate_tactical_actions": [
    {
      "action_id": "unique_action_id",
      "action": "구체적 실행 방안",
      "priority": "critical/high/medium/low",
      "timeline": "24-48시간",
      "resources_needed": {
        "human_resources": ["필요 인력"],
        "technical_resources": ["필요 기술"],
        "financial_investment": "예상 비용"
      },
      "expected_outcome": "예상 결과",
      "success_metrics": [
        {
          "metric": "측정 지표",
          "target_value": "목표값",
          "measurement_method": "측정 방법"
        }
      ],
      "risk_mitigation": ["위험 완화 방안"]
    }
  ],
  "short_term_strategic_improvements": [
    {
      "improvement_id": "unique_improvement_id",
      "improvement": "개선 방안",
      "strategic_alignment": "전략적 정렬성",
      "timeline": "2-4주",
      "dependencies": [
        {
          "dependency": "의존성",
          "type": "technical/organizational/external",
          "criticality": "high/medium/low"
        }
      ],
      "risk_assessment": {
        "risk_level": "low/medium/high",
        "risk_factors": ["위험 요소"],
        "contingency_plans": ["비상 계획"]
      },
      "roi_analysis": {
        "investment_required": "필요 투자",
        "expected_return": "예상 수익",
        "payback_period": "투자 회수 기간"
      }
    }
  ],
  "long_term_strategic_development": [
    {
      "development_id": "unique_development_id",
      "strategic_initiative": "전략적 이니셔티브",
      "vision_alignment": "비전 정렬성",
      "timeline": "2-12개월",
      "transformation_scope": "변화 범위",
      "innovation_opportunities": ["혁신 기회"],
      "competitive_advantage": "경쟁 우위",
      "scalability_potential": "확장 가능성"
    }
  ],
  "risk_management_framework": {
    "risk_identification": ["위험 식별"],
    "risk_assessment_methodology": "위험 평가 방법론",
    "mitigation_strategies": [
      {
        "risk": "위험",
        "mitigation": "완화 전략",
        "monitoring": "모니터링 방법",
        "escalation_criteria": "에스컬레이션 기준"
      }
    ],
    "contingency_planning": ["비상 계획"]
  },
  "success_measurement_framework": {
    "kpi_framework": [
      {
        "kpi": "핵심 성과 지표",
        "measurement_frequency": "측정 빈도",
        "target_value": "목표값",
        "benchmark": "벤치마크",
        "improvement_threshold": "개선 임계값"
      }
    ],
    "monitoring_dashboard": ["모니터링 대시보드 요소"],
    "reporting_schedule": "보고 일정",
    "review_cycles": "검토 주기"
  },
  "implementation_governance": {
    "governance_structure": "거버넌스 구조",
    "decision_making_process": "의사결정 프로세스",
    "stakeholder_engagement": ["이해관계자 참여"],
    "change_management": "변화 관리 방안",
    "communication_strategy": "커뮤니케이션 전략"
  }
}
\`\`\`

전략적 사고와 실행 가능성을 모두 고려한 종합적인 개선 전략을 제공해주세요.`;
  }

  /**
   * 모델별 검증 실행
   */
  async executeVerification(model, testCase, processedResult) {
    console.log(`🔍 ${model} 모델로 케이스 ${testCase.id} 검증 시작...`);
    
    const startTime = Date.now();
    
    try {
      const promptTemplate = this.promptTemplates[model];
      
      // 검증 프롬프트 생성
      const verificationPrompt = promptTemplate.verificationPrompt
        .replace('{originalData}', this.truncateData(testCase.content, 2000))
        .replace('{processedResult}', JSON.stringify(processedResult, null, 2));
      
      // 모델별 API 호출 설정
      const apiConfig = this.getModelAPIConfig(model, promptTemplate.systemPrompt, verificationPrompt);
      
      // API 호출
      const response = await this.openai.chat.completions.create(apiConfig);
      
      const processingTime = Date.now() - startTime;
      
      // 응답 파싱
      const verificationResult = this.parseVerificationResponse(response, model);
      
      // 결과 기록
      const result = {
        verificationId: `${model}_${testCase.id}_${Date.now()}`,
        model,
        caseId: testCase.id,
        processingTime,
        success: true,
        verificationResult,
        apiUsage: response.usage,
        timestamp: new Date().toISOString()
      };
      
      this.verificationResults.push(result);
      this.updatePromptPerformance(model, true, verificationResult.confidence_level || 0);
      
      console.log(`  ✅ ${model} 검증 완료 (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`  ❌ ${model} 검증 실패:`, error.message);
      
      const result = {
        verificationId: `${model}_${testCase.id}_${Date.now()}`,
        model,
        caseId: testCase.id,
        processingTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.verificationResults.push(result);
      this.updatePromptPerformance(model, false, 0);
      
      return result;
    }
  }

  /**
   * 모델별 API 설정 생성
   */
  getModelAPIConfig(model, systemPrompt, userPrompt) {
    const baseConfig = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };
    
    if (model === 'gpt-4o-mini') {
      return {
        ...baseConfig,
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      };
    } else if (model === 'o1-mini') {
      return {
        ...baseConfig,
        model: 'o1-mini',
        max_completion_tokens: 8192
      };
    }
    
    throw new Error(`지원하지 않는 모델: ${model}`);
  }

  /**
   * 검증 응답 파싱
   */
  parseVerificationResponse(response, model) {
    try {
      const content = response.choices[0].message.content;
      
      if (model === 'gpt-4o-mini') {
        return JSON.parse(content);
      } else if (model === 'o1-mini') {
        // o1-mini는 JSON 블록을 추출해야 할 수 있음
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`${model} 응답 파싱 실패:`, error.message);
      return {
        verification_id: `parse_error_${Date.now()}`,
        overall_score: 0,
        confidence_level: 0,
        error: `응답 파싱 실패: ${error.message}`,
        raw_response: response.choices[0].message.content
      };
    }
  }

  /**
   * 프롬프트 성능 업데이트
   */
  updatePromptPerformance(model, success, confidence) {
    const perf = this.promptPerformance[model];
    perf.totalCalls++;
    
    if (success) {
      perf.successRate = ((perf.successRate * (perf.totalCalls - 1)) + 1) / perf.totalCalls;
      perf.avgConfidence = ((perf.avgConfidence * (perf.totalCalls - 1)) + confidence) / perf.totalCalls;
    } else {
      perf.successRate = (perf.successRate * (perf.totalCalls - 1)) / perf.totalCalls;
    }
  }

  /**
   * 데이터 자르기 (토큰 제한)
   */
  truncateData(data, maxLength) {
    if (typeof data === 'string' && data.length > maxLength) {
      return data.substring(0, maxLength) + '... (truncated)';
    }
    return data;
  }

  /**
   * 검증 결과 요약
   */
  getVerificationSummary() {
    const summary = {
      totalVerifications: this.verificationResults.length,
      successfulVerifications: this.verificationResults.filter(r => r.success).length,
      modelPerformance: this.promptPerformance,
      averageProcessingTime: this.verificationResults.reduce((sum, r) => sum + r.processingTime, 0) / this.verificationResults.length || 0
    };
    
    return summary;
  }

  /**
   * 검증 결과 저장
   */
  async saveResults(outputPath) {
    const results = {
      summary: this.getVerificationSummary(),
      detailedResults: this.verificationResults,
      promptPerformance: this.promptPerformance,
      timestamp: new Date().toISOString()
    };
    
    await FileUtils.writeJsonSafe(outputPath, results);
    console.log(`📊 검증 결과 저장 완료: ${outputPath}`);
  }
}

export default AIPromptManager;