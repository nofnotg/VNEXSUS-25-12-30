/**
 * 향상된 문맥 인식 프롬프트 빌더
 * GPT-4o Mini의 문맥 연관성 부족 문제를 해결하기 위한 고급 프롬프트 엔지니어링
 */

class EnhancedContextualPromptBuilder {
    constructor() {
        this.contextualPatterns = {
            // 시간적 문맥 패턴
            temporal: {
                sequential: ['이후', '다음', '그 후', '계속해서', '연속적으로'],
                causal: ['때문에', '으로 인해', '결과로', '영향으로'],
                comparative: ['이전과 달리', '변화하여', '개선되어', '악화되어']
            },
            
            // 의료적 문맥 패턴
            medical: {
                progression: ['경과', '진행', '발전', '변화', '추이'],
                relationship: ['관련하여', '연관되어', '동반하여', '합병하여'],
                causality: ['원인', '유발', '기인', '초래', '야기']
            },
            
            // 공간적 문맥 패턴
            spatial: {
                referral: ['의뢰', '전원', '소개', '추천'],
                continuation: ['지속', '계속', '연속', '이어서']
            }
        };

        this.contextualEnhancers = {
            // 문맥 강화 지시문
            narrative: "서술형 문맥 분석을 통해 의료 사건들 간의 자연스러운 연결고리를 파악하세요.",
            relationship: "각 의료 정보가 다른 정보와 어떤 관계를 맺고 있는지 상세히 분석하세요.",
            flow: "시간의 흐름에 따른 의료 상황의 변화와 발전 과정을 추적하세요.",
            causality: "원인과 결과의 연쇄 관계를 명확히 식별하고 설명하세요."
        };
    }

    /**
     * 문맥 강화 DNA 추출 프롬프트 생성
     */
    buildEnhancedDNAExtractionPrompt(rawText, options = {}) {
        const contextAnalysis = this._analyzeTextualContext(rawText);
        
        const systemPrompt = `
# 고급 의료문서 DNA 시퀀싱 전문가 (문맥 연관성 특화)

당신은 의료문서의 문맥적 연관성을 깊이 이해하는 DNA 시퀀싱 전문가입니다.
단순한 정보 추출을 넘어서, 의료 사건들 간의 **자연스러운 서술적 연결**을 파악해야 합니다.

## 핵심 원칙: 문맥적 서술 분석

### 1. 서술적 연결성 분석
- 각 의료 유전자는 독립적이면서도 다른 유전자와 **자연스러운 이야기의 흐름**을 형성해야 합니다
- 단순한 나열이 아닌, **"왜 이 순서로 일어났는가?"**를 설명할 수 있어야 합니다
- 의료진의 사고 과정과 환자의 경험을 **연속된 서사**로 이해하세요

### 2. 문맥적 앵커 강화
각 유전자는 다음 **문맥적 앵커**를 포함해야 합니다:

**시간적 앵커 (Temporal)**:
- 단순 날짜가 아닌 **시간적 관계성** ("초진 후 2주", "증상 발현 3일 후")
- 의료 사건의 **순서와 간격**이 갖는 의미
- 시간 경과에 따른 **변화의 패턴**

**공간적 앵커 (Spatial)**:
- 병원/과 이동의 **의료적 의미** ("응급실→내과: 응급상황 안정화")
- 의료진 간 **협진의 맥락**
- 검사실/병동 이동의 **진료 흐름**

**의학적 앵커 (Medical)**:
- 증상→진단→치료의 **논리적 연결**
- 의료진의 **임상적 판단 과정**
- 환자 상태의 **변화와 대응**

**인과적 앵커 (Causal)**:
- **"왜 이 검사를 했는가?"** - 의료진의 의도
- **"이 치료의 근거는?"** - 임상적 판단
- **"환자는 어떻게 반응했는가?"** - 치료 효과

### 3. 연관성 서술 방식
${this._buildContextualNarrativeGuidelines(contextAnalysis)}

## 추출 원칙 (문맥 강화)

### A. 서술적 완결성
- 각 유전자는 **완전한 의료 서사의 한 장면**이어야 합니다
- "무엇이 일어났는가"뿐만 아니라 **"왜, 어떻게 일어났는가"**를 포함
- 다른 유전자와의 **자연스러운 연결점**을 명시

### B. 문맥적 신뢰도
- 0.9-1.0: 완전한 서사적 맥락, 명확한 인과관계, 자연스러운 연결
- 0.7-0.9: 대부분의 맥락 파악, 일부 추론 필요
- 0.5-0.7: 기본 맥락 이해, 연결점 불분명
- 0.3-0.5: 단편적 정보, 맥락 부족

### C. 연결성 강화
각 유전자의 connections 필드에는:
- **직접적 연결**: 명확한 인과관계 ("gene_002로 인해 발생")
- **맥락적 연결**: 서사적 흐름 ("gene_003과 연속된 과정")
- **의미적 연결**: 의료적 관련성 ("gene_004와 동일 질환군")

반드시 JSON 형식으로만 응답하세요.
`;

        const userPrompt = this._buildEnhancedUserPrompt(rawText, contextAnalysis);

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
    }

    /**
     * 텍스트의 문맥적 특성 분석
     */
    _analyzeTextualContext(text) {
        const analysis = {
            hasTemporalSequence: false,
            hasCausalRelationships: false,
            hasProgressionIndicators: false,
            hasReferralPatterns: false,
            contextualComplexity: 'simple',
            dominantPatterns: []
        };

        // 시간적 순서 패턴 검출
        const temporalPatterns = this.contextualPatterns.temporal.sequential;
        analysis.hasTemporalSequence = temporalPatterns.some(pattern => 
            text.includes(pattern)
        );

        // 인과관계 패턴 검출
        const causalPatterns = this.contextualPatterns.temporal.causal;
        analysis.hasCausalRelationships = causalPatterns.some(pattern => 
            text.includes(pattern)
        );

        // 진행/경과 패턴 검출
        const progressionPatterns = this.contextualPatterns.medical.progression;
        analysis.hasProgressionIndicators = progressionPatterns.some(pattern => 
            text.includes(pattern)
        );

        // 의뢰/전원 패턴 검출
        const referralPatterns = this.contextualPatterns.spatial.referral;
        analysis.hasReferralPatterns = referralPatterns.some(pattern => 
            text.includes(pattern)
        );

        // 문맥적 복잡도 결정
        const complexityScore = [
            analysis.hasTemporalSequence,
            analysis.hasCausalRelationships,
            analysis.hasProgressionIndicators,
            analysis.hasReferralPatterns
        ].filter(Boolean).length;

        if (complexityScore >= 3) analysis.contextualComplexity = 'high';
        else if (complexityScore >= 2) analysis.contextualComplexity = 'medium';
        else analysis.contextualComplexity = 'simple';

        return analysis;
    }

    /**
     * 문맥적 서술 가이드라인 생성
     */
    _buildContextualNarrativeGuidelines(contextAnalysis) {
        let guidelines = `
**기본 서술 원칙:**
- 개조식 나열 금지: "증상: 두통, 진단: 편두통" ❌
- 서술형 연결: "지속적인 두통 증상으로 인해 편두통 진단을 받게 되었으며..." ✅

**문맥 연결 표현:**
- "이로 인해", "그 결과", "이에 따라", "연속적으로"
- "환자의 상태 변화에 따라", "의료진의 판단으로"
- "치료 경과를 관찰한 결과", "추가 검사를 통해 확인된"
`;

        if (contextAnalysis.hasTemporalSequence) {
            guidelines += `
**시간적 연속성 강조:**
- 각 의료 사건의 시간적 순서가 갖는 의미를 설명
- "초진에서 발견된 증상이 2주 후 검사에서 확진되었으며..."
`;
        }

        if (contextAnalysis.hasCausalRelationships) {
            guidelines += `
**인과관계 명시:**
- 원인과 결과의 연결고리를 명확히 서술
- "혈압 상승으로 인한 추가 검사에서 당뇨 합병증이 발견되어..."
`;
        }

        if (contextAnalysis.hasProgressionIndicators) {
            guidelines += `
**진행 과정 추적:**
- 질병의 발전 과정과 치료 반응을 연결하여 서술
- "초기 치료에 대한 반응이 미흡하여 치료법을 변경한 결과..."
`;
        }

        return guidelines;
    }

    /**
     * 향상된 사용자 프롬프트 생성
     */
    _buildEnhancedUserPrompt(rawText, contextAnalysis) {
        const contextualInstructions = this._generateContextualInstructions(contextAnalysis);
        
        return `
다음 의료 텍스트를 **문맥적 연관성을 중시하여** DNA 유전자로 분할하세요.

${contextualInstructions}

"""
${rawText}
"""

**중요: 응답 시 다음 사항을 반드시 준수하세요:**

1. **서술형 content**: 각 유전자의 content는 완전한 문장으로 작성
2. **연결성 설명**: connections에는 단순 ID가 아닌 연결 이유도 포함
3. **맥락적 앵커**: 각 앵커는 다른 유전자와의 관계를 고려하여 작성
4. **자연스러운 흐름**: 전체 유전자들이 하나의 연결된 이야기를 형성

다음 JSON 형식으로 정확히 응답해주세요:

{
  "genes": [
    {
      "id": "gene_001",
      "content": "환자는 2024년 1월 15일 지속적인 두통과 어지럼증을 주소로 내과에 내원하였으며, 이는 최근 2주간 악화되는 양상을 보였다.",
      "anchors": {
        "temporal": "2024-01-15 (증상 발현 2주 후 내원)",
        "spatial": "서울대병원 내과 (신경과 협진 예정)",
        "medical": "두통 및 어지럼증 주소 초진 (신경학적 검사 필요)",
        "causal": "2주간 지속 악화로 인한 의료진 상담 필요성 대두"
      },
      "confidence": 0.95,
      "type": "symptom",
      "connections": [
        {
          "target": "gene_002",
          "relationship": "직접적 연결",
          "description": "초진 증상에 대한 후속 검사 진행"
        }
      ],
      "narrative_context": "환자의 의료 여정의 시작점으로, 후속 진단 과정의 근거가 되는 핵심 증상 제시"
    }
  ],
  "extraction_summary": {
    "total_genes": 3,
    "average_confidence": 0.87,
    "narrative_coherence": 0.92,
    "contextual_depth": "high",
    "temporal_coverage": "2024-01-15 ~ 2024-03-20",
    "spatial_coverage": ["서울대병원 내과", "신경과"],
    "medical_events": ["초진", "진단", "치료"],
    "causal_chains": [
      {
        "sequence": ["gene_001", "gene_002", "gene_003"],
        "description": "증상 발현 → 진단 → 치료의 자연스러운 의료 과정"
      }
    ]
  }
}
`;
    }

    /**
     * 문맥별 특화 지시사항 생성
     */
    _generateContextualInstructions(contextAnalysis) {
        let instructions = "**문맥 분석 기반 특별 지시사항:**\n";

        if (contextAnalysis.contextualComplexity === 'high') {
            instructions += `
- 이 문서는 복잡한 의료 서사를 포함하고 있습니다
- 각 유전자 간의 연결고리를 특히 세밀하게 분석하세요
- 시간적 순서와 인과관계를 명확히 구분하여 서술하세요
`;
        }

        if (contextAnalysis.hasTemporalSequence) {
            instructions += `
- 시간적 순서가 중요한 문서입니다
- 각 사건의 시간적 위치와 그 의미를 연결하여 설명하세요
`;
        }

        if (contextAnalysis.hasCausalRelationships) {
            instructions += `
- 명확한 인과관계가 존재합니다
- 원인과 결과의 연결고리를 자세히 추적하여 서술하세요
`;
        }

        if (contextAnalysis.hasReferralPatterns) {
            instructions += `
- 의료기관 간 연계나 과 간 협진이 포함되어 있습니다
- 의뢰/전원의 의료적 맥락과 연속성을 강조하세요
`;
        }

        return instructions;
    }

    /**
     * 기존 프롬프트와의 호환성을 위한 래퍼 메서드
     */
    buildDNAExtractionPrompt(rawText, options = {}) {
        return this.buildEnhancedDNAExtractionPrompt(rawText, options);
    }
}

module.exports = EnhancedContextualPromptBuilder;