/**
 * 의료문서 DNA 시퀀싱: 유전자 추출기
 * 
 * OpenAI GPT-4o를 활용하여 의료 텍스트를 의미 있는 최소 단위인 
 * "의료 유전자"로 분할하고 앵커 정보를 추출합니다.
 */

const axios = require('axios');
const fs = require('fs').promises;
const EnhancedContextualPromptBuilder = require('./enhancedContextualPromptBuilder.cjs');
require('dotenv').config();

class MedicalGeneExtractor {
  constructor() {
    // OpenAI API 설정
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o-mini'; // GPT-4o Mini로 변경
    this.maxTokens = 4096;
    
    // 향상된 문맥 인식 프롬프트 빌더 초기화
    this.contextualPromptBuilder = new EnhancedContextualPromptBuilder();
    
    // DNA 추출 통계
    this.stats = {
      totalProcessed: 0,
      totalGenes: 0,
      averageConfidence: 0,
      processingTimes: []
    };
  }

  /**
   * 의료 텍스트에서 DNA 유전자를 추출합니다.
   * @param {string} rawText - 원본 의료 텍스트
   * @param {Object} options - 추출 옵션
   * @returns {Promise<Object>} 추출된 유전자 정보
   */
  async extractGenes(rawText, options = {}) {
    console.log('🧬 DNA 유전자 추출 시작 (GPT-4o-mini + 향상된 문맥 인식)...');
    const startTime = Date.now();
    
    try {
      // 입력 검증
      if (!rawText || rawText.trim().length === 0) {
        return { 
          genes: [], 
          extraction_summary: {
            total_genes: 0,
            average_confidence: 0,
            error: '입력 텍스트가 비어있습니다'
          }
        };
      }

      // 프롬프트 생성 (향상된 문맥 인식 버전 사용)
      const prompt = this.contextualPromptBuilder.buildEnhancedDNAExtractionPrompt(rawText, options);
      
      // OpenAI API 호출
      const apiResponse = await this.callOpenAIApi(prompt);
      
      // 응답 파싱
      const result = this.parseGeneExtractionResponse(apiResponse);
      
      // 통계 업데이트
      const processingTime = Date.now() - startTime;
      this.updateStats(result, processingTime);
      
      console.log(`✅ DNA 추출 완료: ${result.genes?.length || 0}개 유전자, ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ DNA 추출 실패:', error.message);
      return {
        genes: [],
        extraction_summary: {
          total_genes: 0,
          average_confidence: 0,
          error: error.message
        }
      };
    }
  }

  /**
   * DNA 추출 프롬프트를 생성합니다.
   * @param {string} rawText - 원본 텍스트
   * @param {Object} options - 옵션
   * @returns {Array} 프롬프트 메시지 배열
   */
  buildDNAExtractionPrompt(rawText, options = {}) {
    const systemPrompt = `
# 의료문서 DNA 시퀀싱 전문가

당신은 의료문서를 분자 수준으로 분석하는 DNA 시퀀싱 전문가입니다.
주어진 의료 텍스트를 의미 있는 최소 단위인 "의료 유전자"로 분할해야 합니다.

## 의료 유전자 정의
각 유전자는 다음 요소를 포함해야 합니다:
1. **시간적 앵커**: 언제 발생했는지 (날짜, 시간)
2. **공간적 앵커**: 어디서 발생했는지 (병원, 과, 검사실)
3. **의학적 앵커**: 무엇이 발생했는지 (증상, 진단, 치료, 검사)
4. **인과적 앵커**: 왜/어떻게 발생했는지 (원인, 경과, 결과)

## 추출 원칙
- 독립적으로 의미를 가지는 최소 단위
- 다른 유전자와 연결 가능한 앵커 포인트 포함
- 완전한 의료 정보 (최소 2개 이상의 앵커 필요)
- 중복 없는 고유한 정보

## 신뢰도 점수 기준
- 0.9-1.0: 명확한 4개 앵커 모두 존재
- 0.7-0.9: 3개 앵커 존재, 1개 추론 가능
- 0.5-0.7: 2개 앵커 존재, 나머지 추론
- 0.3-0.5: 1개 앵커만 명확, 나머지 불확실

반드시 JSON 형식으로만 응답하세요.
`;

    const userPrompt = `
다음 의료 텍스트를 DNA 유전자로 분할하여 분석해주세요:

"""
${rawText}
"""

다음 JSON 형식으로 정확히 응답해주세요:

{
  "genes": [
    {
      "id": "gene_001",
      "content": "추출된 원문 텍스트",
      "anchors": {
        "temporal": "2024-01-15 또는 추론된 시간",
        "spatial": "서울대병원 내과 또는 추론된 장소",
        "medical": "당뇨병 진단 또는 의학적 사건",
        "causal": "정기검진에서 발견 또는 인과관계"
      },
      "confidence": 0.95,
      "type": "diagnosis|treatment|examination|symptom|prescription",
      "connections": ["gene_002", "gene_003"]
    }
  ],
  "extraction_summary": {
    "total_genes": 3,
    "average_confidence": 0.87,
    "temporal_coverage": "2024-01-15 ~ 2024-03-20",
    "spatial_coverage": ["서울대병원", "연세세브란스"],
    "medical_events": ["진단", "치료", "검사"]
  }
}
`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  /**
   * OpenAI API를 호출합니다.
   * @param {Array} messages - 메시지 배열
   * @returns {Promise<string>} API 응답
   */
  async callOpenAIApi(messages) {
    try {
      console.log(`📤 OpenAI API 호출 중... (모델: ${this.model})`);
      
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: messages,
          max_tokens: this.maxTokens,
          temperature: 0.1, // 일관성을 위해 낮은 temperature
          response_format: { type: "json_object" } // JSON 응답 강제
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60초 타임아웃
        }
      );
      
      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('API 응답에 예상한 콘텐츠가 없습니다');
      }
      
      console.log('📥 OpenAI API 응답 수신 완료');
      return response.data.choices[0].message.content;
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('OpenAI API 키가 유효하지 않습니다');
      } else if (error.response?.status === 429) {
        throw new Error('API 요청 한도를 초과했습니다');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('API 요청 시간이 초과되었습니다');
      } else {
        throw new Error(`API 호출 실패: ${error.message}`);
      }
    }
  }

  /**
   * API 응답을 파싱하여 유전자 정보를 추출합니다.
   * @param {string} apiResponse - API 응답 JSON 문자열
   * @returns {Object} 파싱된 유전자 정보
   */
  parseGeneExtractionResponse(apiResponse) {
    try {
      const parsed = JSON.parse(apiResponse);
      
      // 기본 구조 검증
      if (!parsed.genes || !Array.isArray(parsed.genes)) {
        throw new Error('응답에 genes 배열이 없습니다');
      }
      
      // 각 유전자에 기본 정보 추가
      parsed.genes.forEach((gene, index) => {
        if (!gene.id) {
          gene.id = `gene_${String(index + 1).padStart(3, '0')}`;
        }
        
        if (!gene.extracted_at) {
          gene.extracted_at = new Date().toISOString();
        }
        
        if (!gene.anchors) {
          gene.anchors = {};
        }
        
        if (typeof gene.confidence !== 'number') {
          gene.confidence = 0.5; // 기본값
        }
      });
      
      // 추출 요약 정보 생성
      if (!parsed.extraction_summary) {
        parsed.extraction_summary = this.generateExtractionSummary(parsed.genes);
      }
      
      return parsed;
      
    } catch (error) {
      console.error('응답 파싱 실패:', error.message);
      return {
        genes: [],
        extraction_summary: {
          total_genes: 0,
          average_confidence: 0,
          error: `파싱 실패: ${error.message}`
        }
      };
    }
  }

  /**
   * 유전자 배열로부터 추출 요약을 생성합니다.
   * @param {Array} genes - 유전자 배열
   * @returns {Object} 추출 요약
   */
  generateExtractionSummary(genes) {
    const summary = {
      total_genes: genes.length,
      average_confidence: 0,
      temporal_coverage: null,
      spatial_coverage: [],
      medical_events: []
    };
    
    if (genes.length === 0) {
      return summary;
    }
    
    // 평균 신뢰도 계산
    const confidenceSum = genes.reduce((sum, gene) => sum + (gene.confidence || 0), 0);
    summary.average_confidence = Math.round((confidenceSum / genes.length) * 100) / 100;
    
    // 시간적 범위 추출
    const temporalAnchors = genes
      .map(gene => gene.anchors?.temporal)
      .filter(temporal => temporal && temporal.includes('-'))
      .sort();
    
    if (temporalAnchors.length > 0) {
      const firstDate = temporalAnchors[0].split(' ')[0];
      const lastDate = temporalAnchors[temporalAnchors.length - 1].split(' ')[0];
      summary.temporal_coverage = firstDate === lastDate ? firstDate : `${firstDate} ~ ${lastDate}`;
    }
    
    // 공간적 범위 추출
    const spatialAnchors = genes
      .map(gene => gene.anchors?.spatial)
      .filter(spatial => spatial)
      .map(spatial => spatial.split(' ')[0]) // 첫 번째 단어만 (병원명)
      .filter((value, index, self) => self.indexOf(value) === index); // 중복 제거
    
    summary.spatial_coverage = spatialAnchors;
    
    // 의료 이벤트 추출
    const medicalEvents = genes
      .map(gene => gene.type)
      .filter(type => type)
      .filter((value, index, self) => self.indexOf(value) === index); // 중복 제거
    
    summary.medical_events = medicalEvents;
    
    return summary;
  }

  /**
   * 통계 정보를 업데이트합니다.
   * @param {Object} result - 추출 결과
   * @param {number} processingTime - 처리 시간 (ms)
   */
  updateStats(result, processingTime) {
    this.stats.totalProcessed++;
    this.stats.totalGenes += result.genes?.length || 0;
    this.stats.processingTimes.push(processingTime);
    
    // 평균 신뢰도 업데이트
    if (result.extraction_summary?.average_confidence) {
      const totalConfidence = this.stats.averageConfidence * (this.stats.totalProcessed - 1) + 
                             result.extraction_summary.average_confidence;
      this.stats.averageConfidence = Math.round((totalConfidence / this.stats.totalProcessed) * 100) / 100;
    }
  }

  /**
   * 현재 통계 정보를 반환합니다.
   * @returns {Object} 통계 정보
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTimes.length > 0 
      ? Math.round(this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length)
      : 0;
    
    return {
      ...this.stats,
      averageProcessingTime: avgProcessingTime,
      genesPerDocument: this.stats.totalProcessed > 0 
        ? Math.round((this.stats.totalGenes / this.stats.totalProcessed) * 100) / 100 
        : 0
    };
  }

  /**
   * 테스트 함수
   */
  async test() {
    console.log('🧪 MedicalGeneExtractor 테스트 시작...');
    
    const sampleText = `
2024년 3월 24일 의무기록 사본 증명서

환자: 김명희 (여, 1965년생)
진료의뢰서

주증상: 어지럼증
2025년 2월 17일 외래 진료
이기섭의원에서 강남성심병원으로 전원 소견
`;
    
    try {
      const result = await this.extractGenes(sampleText);
      console.log('✅ 테스트 성공');
      console.log('추출된 유전자 수:', result.genes?.length || 0);
      console.log('평균 신뢰도:', result.extraction_summary?.average_confidence || 'N/A');
      
      return result;
    } catch (error) {
      console.error('❌ 테스트 실패:', error.message);
      throw error;
    }
  }
}

module.exports = MedicalGeneExtractor;

// 직접 실행 시 테스트
if (require.main === module) {
  const extractor = new MedicalGeneExtractor();
  extractor.test().catch(console.error);
}