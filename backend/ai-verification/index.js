/**
 * AI 검증 시스템 메인 모듈
 * 
 * 역할:
 * 1. GPT-4o-mini와 o1-mini 모델을 이용한 12개 케이스 완전 검증
 * 2. 하이브리드 방식 vs 순수 로직 기반 처리 방식 비교 평가
 * 3. 실행 가능한 검증 프롬프트 개발 및 관리
 * 4. 검증 결과 분석 및 성능 측정
 */

import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

class AIVerificationSystem {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // 지원 모델 확장 - OpenAI 모델들
    this.models = {
      'gpt-4o-mini': 'gpt-4o-mini',
      'o1-mini': 'o1-mini',
      'gpt-4o': 'gpt-4o',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-3.5-turbo': 'gpt-3.5-turbo'
    };
    
    // 모델별 최적 파라미터 설정
    this.modelConfigs = {
      'gpt-4o-mini': { temperature: 0.1, max_tokens: 4096, supports_system: true },
      'o1-mini': { temperature: 1, max_tokens: 65536, supports_system: false },
      'gpt-4o': { temperature: 0.2, max_tokens: 8192, supports_system: true },
      'gpt-4-turbo': { temperature: 0.1, max_tokens: 4096, supports_system: true },
      'gpt-3.5-turbo': { temperature: 0.1, max_tokens: 4096, supports_system: true }
    };
    
    this.verificationResults = {
      'gpt-4o-mini': [],
      'o1-mini': [],
      'gpt-4o': [],
      'gpt-4-turbo': [],
      'gpt-3.5-turbo': []
    };
    
    this.performanceMetrics = {
      accuracy: {},
      completeness: {},
      consistency: {},
      costEffectiveness: {}
    };
    
    // 재시도 설정
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2
    };
  }

  /**
   * 12개 케이스 완전 검증 실행
   * @param {string} model 사용할 모델 ('gpt-4o-mini' | 'o1-mini' | 'gpt-4o')
   * @param {Array} testCases 검증할 케이스 배열
   * @returns {Promise<Object>} 검증 결과
   */
  async performFullVerification(model, testCases) {
    console.log(`🔍 ${model} 모델로 ${testCases.length}개 케이스 완전 검증 시작...`);
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < testCases.length; i++) {
      const caseData = testCases[i];
      console.log(`\n=== 케이스 ${i + 1}/${testCases.length} 검증 중 ===`);
      
      try {
        const verificationResult = await this.verifySingleCase(model, caseData, i + 1);
        results.push({
          caseId: i + 1,
          success: true,
          result: verificationResult,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`케이스 ${i + 1} 검증 실패:`, error.message);
        results.push({
          caseId: i + 1,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // 결과 저장
    this.verificationResults[model] = results;
    
    return {
      model,
      totalCases: testCases.length,
      successfulCases: results.filter(r => r.success).length,
      failedCases: results.filter(r => !r.success).length,
      totalTime,
      averageTimePerCase: totalTime / testCases.length,
      results
    };
  }

  /**
   * 단일 케이스 검증 (재시도 로직 포함)
   * @param {string} model 사용할 모델
   * @param {Object} caseData 케이스 데이터
   * @param {number} caseId 케이스 ID
   * @returns {Promise<Object>} 검증 결과
   */
  async verifySingleCase(model, caseData, caseId) {
    const prompt = this.generateVerificationPrompt(model, caseData, caseId);
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.attemptVerification(model, prompt, caseId, attempt);
      } catch (error) {
        console.warn(`케이스 ${caseId} 검증 시도 ${attempt}/${this.retryConfig.maxRetries} 실패:`, error.message);
        
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }
        
        // 지수 백오프로 재시도 대기
        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 단일 검증 시도
   * @param {string} model 사용할 모델
   * @param {string} prompt 검증 프롬프트
   * @param {number} caseId 케이스 ID
   * @param {number} attempt 시도 횟수
   * @returns {Promise<Object>} 검증 결과
   */
  async attemptVerification(model, prompt, caseId, attempt) {
    if (!this.modelConfigs[model]) {
      throw new Error(`지원하지 않는 모델입니다: ${model}`);
    }
    
    const config = this.modelConfigs[model];
    
    // 모델별 메시지 구성
    let messages;
    if (!config.supports_system) {
      const systemContext = "당신은 의료 보고서 검증 전문가입니다. 주어진 의료 데이터를 정확하고 체계적으로 분석하여 실행 가능한 검증 결과를 제공해야 합니다.\n\n";
      messages = [
        {
          role: "user",
          content: systemContext + prompt
        }
      ];
    } else {
      messages = [
        {
          role: "system",
          content: "당신은 의료 보고서 검증 전문가입니다. 주어진 의료 데이터를 정확하고 체계적으로 분석하여 실행 가능한 검증 결과를 제공해야 합니다."
        },
        {
          role: "user",
          content: prompt
        }
      ];
    }
    
    const requestParams = {
      model: this.models[model],
      messages: messages,
      temperature: config.temperature
    };
    
    // o1 모델들은 max_completion_tokens를 사용
    if (model.startsWith('o1-')) {
      requestParams.max_completion_tokens = config.max_tokens;
    } else {
      requestParams.max_tokens = config.max_tokens;
    }
    
    const response = await this.openai.chat.completions.create(requestParams);
    
    return {
      prompt,
      response: response.choices[0].message.content,
      usage: response.usage,
      model,
      caseId,
      attempt
    };
  }

  /**
   * 모델별 검증 프롬프트 생성
   * @param {string} model 모델명
   * @param {Object} caseData 케이스 데이터
   * @param {number} caseId 케이스 ID
   * @returns {string} 생성된 프롬프트
   */
  generateVerificationPrompt(model, caseData, caseId) {
    const basePrompt = `
# 의료 보고서 AI 검증 - 케이스 ${caseId}

## 검증 대상 데이터:
\`\`\`
${caseData.content}
\`\`\`

## 검증 요구사항:
`;
    
    if (model === 'gpt-4o-mini') {
      return basePrompt + `
### GPT-4o-mini 전용 검증 프롬프트

**실행 가능한 대응 작업:**
1. **기본 정확성 검증**
   - 환자 정보 (이름, 생년월일, 성별) 정확성 확인
   - 진료 날짜 및 시간 정보 검증
   - 진단명 및 의료진 정보 확인

2. **데이터 완성도 평가**
   - 필수 의료 정보 누락 여부 확인
   - 불완전한 문장이나 데이터 식별
   - 추가 필요한 정보 목록 작성

3. **즉시 실행 가능한 개선 사항**
   - 발견된 오류에 대한 구체적 수정 방안
   - 데이터 품질 향상을 위한 실행 단계
   - 우선순위별 개선 작업 목록

**출력 형식:**
\`\`\`json
{
  "verification_summary": {
    "accuracy_score": 0-100,
    "completeness_score": 0-100,
    "critical_issues": [],
    "actionable_improvements": []
  },
  "immediate_actions": [
    {
      "priority": "high|medium|low",
      "action": "구체적 실행 작업",
      "expected_outcome": "예상 결과"
    }
  ]
}
\`\`\`
`;
    }
    
    if (model === 'o1-mini') {
      return basePrompt + `
### o1-mini 전용 심화 검증 프롬프트

**고도화된 분석 및 실행 전략:**

1. **논리적 일관성 검증**
   - 진료 기록 간 시간적 순서 논리성 확인
   - 진단과 처방 간 의학적 연관성 분석
   - 환자 상태 변화의 합리성 평가

2. **의료 규정 준수성 검증**
   - 의료법 및 보험 규정 준수 여부 확인
   - 필수 기재 사항 완성도 검증
   - 의료 윤리 및 개인정보 보호 준수성 평가

3. **복합적 품질 평가**
   - 다차원적 데이터 품질 지표 산출
   - 잠재적 위험 요소 식별 및 대응 방안
   - 장기적 데이터 관리 전략 수립

4. **실행 가능한 종합 대응 계획**
   - 단계별 품질 개선 로드맵
   - 리스크 기반 우선순위 매트릭스
   - 성과 측정 및 모니터링 방안

**출력 형식:**
\`\`\`json
{
  "comprehensive_analysis": {
    "logical_consistency": {
      "score": 0-100,
      "issues": [],
      "recommendations": []
    },
    "regulatory_compliance": {
      "score": 0-100,
      "violations": [],
      "corrective_actions": []
    },
    "quality_metrics": {
      "overall_score": 0-100,
      "dimension_scores": {},
      "risk_assessment": "low|medium|high"
    }
  },
  "strategic_action_plan": {
    "immediate_actions": [],
    "short_term_goals": [],
    "long_term_strategy": [],
    "success_metrics": []
  }
}
\`\`\`
`;
    }
    
    if (model === 'gpt-4o') {
      return basePrompt + `
### GPT-4o 최종 재검증 및 프롬프트 개선

**최고 수준의 검증 및 개선 전략:**

1. **이전 검증 결과 통합 분석**
   - GPT-4o-mini와 o1-mini 결과 비교 분석
   - 모델 간 일치도 및 차이점 식별
   - 검증 신뢰도 종합 평가

2. **프롬프트 최적화 방향 도출**
   - 효과적인 프롬프트 패턴 식별
   - 모델별 최적 프롬프트 구조 제안
   - 비용 효율성 개선 방안

3. **최종 품질 보증**
   - 최고 수준의 정확도 검증
   - 누락된 검증 항목 보완
   - 최종 실행 계획 완성

**출력 형식:**
\`\`\`json
{
  "final_verification": {
    "consolidated_score": 0-100,
    "model_comparison": {},
    "confidence_level": 0-100
  },
  "prompt_optimization": {
    "effective_patterns": [],
    "improvement_suggestions": [],
    "cost_efficiency_tips": []
  },
  "final_recommendations": {
    "immediate_actions": [],
    "quality_assurance_plan": [],
    "monitoring_strategy": []
  }
}
\`\`\`
`;
    }
    
    if (model === 'gpt-4-turbo') {
      return basePrompt + `
### GPT-4-Turbo 균형 검증 프롬프트

**효율적이고 정확한 검증 전략:**

1. **핵심 품질 지표 검증**
   - 의료 데이터 정확성 및 완성도 평가
   - 진료 기록의 논리적 일관성 확인
   - 필수 정보 누락 여부 점검

2. **실용적 개선 방안 도출**
   - 즉시 적용 가능한 수정 사항 식별
   - 비용 대비 효과적인 품질 개선 방안
   - 단계별 실행 계획 수립

3. **리스크 평가 및 대응**
   - 잠재적 의료 오류 위험 식별
   - 규정 준수 여부 확인
   - 예방적 조치 방안 제시

**출력 형식:**
\`\`\`json
{
  "balanced_verification": {
    "quality_score": 0-100,
    "risk_level": "low|medium|high",
    "compliance_status": "compliant|non_compliant|partial"
  },
  "practical_improvements": [
    {
      "category": "accuracy|completeness|consistency",
      "issue": "발견된 문제",
      "solution": "구체적 해결 방안",
      "priority": "high|medium|low"
    }
  ],
  "cost_benefit_analysis": {
    "high_impact_low_cost": [],
    "recommended_actions": []
  }
}
\`\`\`
`;
    }
    
    if (model === 'gpt-3.5-turbo') {
      return basePrompt + `
### GPT-3.5-Turbo 기본 검증 프롬프트

**효율적인 기본 검증 작업:**

1. **필수 정보 확인**
   - 환자 기본 정보 (이름, 생년월일, 성별) 검증
   - 진료 날짜 및 의료진 정보 확인
   - 주요 진단명 및 처방 내역 점검

2. **데이터 품질 평가**
   - 누락된 필수 정보 식별
   - 명백한 오류나 불일치 발견
   - 기본적인 완성도 평가

3. **간단한 개선 제안**
   - 즉시 수정 가능한 오류 목록
   - 기본적인 품질 향상 방안
   - 우선순위 기반 작업 목록

**출력 형식:**
\`\`\`json
{
  "basic_verification": {
    "completeness_score": 0-100,
    "error_count": 0,
    "missing_fields": []
  },
  "simple_fixes": [
    {
      "field": "필드명",
      "issue": "문제 설명",
      "fix": "수정 방안"
    }
  ],
  "priority_tasks": [
    "우선순위별 작업 목록"
  ]
}
\`\`\`
`;
    }
    
    // 기본 프롬프트 (알 수 없는 모델용)
    return basePrompt + `
### 기본 검증 프롬프트

**표준 의료 데이터 검증:**

1. **기본 정확성 확인**
2. **데이터 완성도 평가**
3. **개선 방안 제시**

**출력 형식:**
\`\`\`json
{
  "verification_result": {
    "score": 0-100,
    "issues": [],
    "recommendations": []
  }
}
\`\`\`
`;
  }

  /**
   * 하이브리드 vs 순수 로직 기반 처리 방식 비교
   * @param {Array} testCases 테스트 케이스
   * @returns {Promise<Object>} 비교 결과
   */
  async compareProcessingMethods(testCases) {
    console.log('🔄 하이브리드 vs 순수 로직 기반 처리 방식 비교 시작...');
    
    const results = {
      hybrid: [],
      pureLogic: [],
      comparison: {}
    };
    
    // 각 케이스에 대해 두 방식 모두 적용
    for (let i = 0; i < testCases.length; i++) {
      const caseData = testCases[i];
      console.log(`\n=== 케이스 ${i + 1} 처리 방식 비교 ===`);
      
      // 하이브리드 방식 (AI + 최소 로직)
      const hybridResult = await this.processWithHybridMethod(caseData, i + 1);
      results.hybrid.push(hybridResult);
      
      // 순수 로직 기반 방식
      const pureLogicResult = await this.processWithPureLogic(caseData, i + 1);
      results.pureLogic.push(pureLogicResult);
    }
    
    // 비교 분석
    results.comparison = this.analyzeMethodComparison(results.hybrid, results.pureLogic);
    
    return results;
  }

  /**
   * 하이브리드 방식 처리
   * @param {Object} caseData 케이스 데이터
   * @param {number} caseId 케이스 ID
   * @returns {Promise<Object>} 처리 결과
   */
  async processWithHybridMethod(caseData, caseId) {
    const startTime = Date.now();
    
    // 최소한의 무의미 데이터 제거
    const minimalCleanedData = this.performMinimalCleaning(caseData.content);
    
    // AI 기반 의료 데이터 분석
    const aiAnalysis = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: "system",
          content: "의료 데이터 분석 전문가로서 주어진 텍스트에서 핵심 의료 정보를 추출하고 구조화하세요."
        },
        {
          role: "user",
          content: `다음 의료 텍스트를 분석하여 핵심 정보를 추출하세요:\n\n${minimalCleanedData}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2048
    });
    
    const processingTime = Date.now() - startTime;
    
    return {
      caseId,
      method: 'hybrid',
      processingTime,
      inputSize: caseData.content.length,
      cleanedSize: minimalCleanedData.length,
      reductionRate: ((caseData.content.length - minimalCleanedData.length) / caseData.content.length * 100).toFixed(2),
      aiAnalysis: aiAnalysis.choices[0].message.content,
      usage: aiAnalysis.usage,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 순수 로직 기반 처리
   * @param {Object} caseData 케이스 데이터
   * @param {number} caseId 케이스 ID
   * @returns {Promise<Object>} 처리 결과
   */
  async processWithPureLogic(caseData, caseId) {
    const startTime = Date.now();
    
    // 기존 로직 기반 처리 시뮬레이션
    const logicResult = this.performLogicBasedProcessing(caseData.content);
    
    const processingTime = Date.now() - startTime;
    
    return {
      caseId,
      method: 'pureLogic',
      processingTime,
      inputSize: caseData.content.length,
      processedSize: logicResult.processedText.length,
      extractedEntities: logicResult.entities,
      structuredData: logicResult.structuredData,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 최소한의 데이터 정리
   * @param {string} text 원본 텍스트
   * @returns {string} 정리된 텍스트
   */
  performMinimalCleaning(text) {
    return text
      .replace(/\s+/g, ' ')  // 중복 공백 제거
      .replace(/[^\w\s가-힣.,:\-\/()]/g, '')  // 특수문자 제거 (의료용 기호 제외)
      .trim();
  }

  /**
   * 로직 기반 처리 시뮬레이션
   * @param {string} text 원본 텍스트
   * @returns {Object} 처리 결과
   */
  performLogicBasedProcessing(text) {
    // 기본적인 정규식 기반 엔티티 추출
    const entities = {
      dates: text.match(/\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}/g) || [],
      hospitals: text.match(/\w+병원|\w+의원|\w+클리닉/g) || [],
      diagnoses: text.match(/진단[:\s]*([^\n]+)/g) || [],
      doctors: text.match(/의사[:\s]*([^\n]+)/g) || []
    };
    
    const structuredData = {
      patientInfo: this.extractPatientInfo(text),
      medicalHistory: this.extractMedicalHistory(text),
      treatments: this.extractTreatments(text)
    };
    
    return {
      processedText: text.replace(/\s+/g, ' ').trim(),
      entities,
      structuredData
    };
  }

  /**
   * 환자 정보 추출
   * @param {string} text 텍스트
   * @returns {Object} 환자 정보
   */
  extractPatientInfo(text) {
    return {
      name: text.match(/이름[:\s]*([^\n]+)/)?.[1]?.trim() || '',
      birthDate: text.match(/생년월일[:\s]*(\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2})/)?.[1] || '',
      gender: text.match(/성별[:\s]*([남여])/)?.[1] || ''
    };
  }

  /**
   * 의료 이력 추출
   * @param {string} text 텍스트
   * @returns {Array} 의료 이력
   */
  extractMedicalHistory(text) {
    const historyPattern = /\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}[^\n]+/g;
    return text.match(historyPattern) || [];
  }

  /**
   * 치료 정보 추출
   * @param {string} text 텍스트
   * @returns {Array} 치료 정보
   */
  extractTreatments(text) {
    const treatmentPattern = /치료[:\s]*([^\n]+)/g;
    const matches = [];
    let match;
    while ((match = treatmentPattern.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  }

  /**
   * 처리 방식 비교 분석
   * @param {Array} hybridResults 하이브리드 결과
   * @param {Array} pureLogicResults 순수 로직 결과
   * @returns {Object} 비교 분석 결과
   */
  analyzeMethodComparison(hybridResults, pureLogicResults) {
    const hybridAvgTime = hybridResults.reduce((sum, r) => sum + r.processingTime, 0) / hybridResults.length;
    const logicAvgTime = pureLogicResults.reduce((sum, r) => sum + r.processingTime, 0) / pureLogicResults.length;
    
    const hybridTotalCost = hybridResults.reduce((sum, r) => {
      if (r.usage) {
        return sum + (r.usage.prompt_tokens * 0.00015 + r.usage.completion_tokens * 0.0006) / 1000;
      }
      return sum;
    }, 0);
    
    return {
      performance: {
        hybrid: {
          avgProcessingTime: hybridAvgTime,
          totalCost: hybridTotalCost,
          avgReductionRate: hybridResults.reduce((sum, r) => sum + parseFloat(r.reductionRate), 0) / hybridResults.length
        },
        pureLogic: {
          avgProcessingTime: logicAvgTime,
          totalCost: 0, // 로직 기반은 API 비용 없음
          avgProcessingEfficiency: 100 // 기준값
        }
      },
      recommendation: hybridAvgTime < logicAvgTime * 2 && hybridTotalCost < 0.1 ? 'hybrid' : 'pureLogic',
      analysis: {
        speedComparison: `하이브리드 방식이 ${((hybridAvgTime / logicAvgTime - 1) * 100).toFixed(1)}% ${hybridAvgTime > logicAvgTime ? '느림' : '빠름'}`,
        costEffectiveness: `하이브리드 방식 총 비용: $${hybridTotalCost.toFixed(4)}`,
        qualityAssessment: '정성적 평가 필요 - AI 분석의 정확도 vs 로직 기반의 일관성'
      }
    };
  }

  /**
   * 검증 결과 저장
   * @param {Object} results 검증 결과
   * @param {string} filename 파일명
   */
  async saveResults(results, filename) {
    const resultsDir = path.join(process.cwd(), 'backend', 'ai-verification', 'results');
    
    try {
      await fs.mkdir(resultsDir, { recursive: true });
      await fs.writeFile(
        path.join(resultsDir, filename),
        JSON.stringify(results, null, 2),
        'utf8'
      );
      console.log(`✅ 결과 저장 완료: ${filename}`);
    } catch (error) {
      console.error('❌ 결과 저장 실패:', error.message);
    }
  }

  /**
   * 성능 메트릭 계산
   * @param {Object} verificationResults 검증 결과
   * @returns {Object} 성능 메트릭
   */
  calculatePerformanceMetrics(verificationResults) {
    const metrics = {};
    
    for (const [model, results] of Object.entries(verificationResults)) {
      const successfulResults = results.filter(r => r.success);
      
      metrics[model] = {
        accuracy: (successfulResults.length / results.length * 100).toFixed(2),
        avgProcessingTime: successfulResults.reduce((sum, r) => {
          return sum + (r.result?.usage?.total_tokens || 0);
        }, 0) / successfulResults.length,
        totalCost: successfulResults.reduce((sum, r) => {
          if (r.result?.usage) {
            const usage = r.result.usage;
            return sum + (usage.prompt_tokens * 0.00015 + usage.completion_tokens * 0.0006) / 1000;
          }
          return sum;
        }, 0),
        completeness: this.assessCompleteness(successfulResults),
        consistency: this.assessConsistency(successfulResults)
      };
    }
    
    return metrics;
  }

  /**
   * 완성도 평가
   * @param {Array} results 결과 배열
   * @returns {number} 완성도 점수
   */
  assessCompleteness(results) {
    // 간단한 완성도 평가 로직
    const avgResponseLength = results.reduce((sum, r) => {
      return sum + (r.result?.response?.length || 0);
    }, 0) / results.length;
    
    return Math.min(100, (avgResponseLength / 1000) * 100);
  }

  /**
   * 일관성 평가
   * @param {Array} results 결과 배열
   * @returns {number} 일관성 점수
   */
  assessConsistency(results) {
    // 간단한 일관성 평가 로직
    if (results.length < 2) return 100;
    
    const responseLengths = results.map(r => r.result?.response?.length || 0);
    const avgLength = responseLengths.reduce((sum, len) => sum + len, 0) / responseLengths.length;
    const variance = responseLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / responseLengths.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - (stdDev / avgLength * 100));
  }
}

export default AIVerificationSystem;