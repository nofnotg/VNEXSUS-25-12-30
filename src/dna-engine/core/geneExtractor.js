/**
 * 의료문서 DNA 시퀀싱: 유전자 추출기
 * 
 * OpenAI GPT-4o를 활용하여 의료 텍스트를 의미 있는 최소 단위인 
 * "의료 유전자"로 분할하고 앵커 정보를 추출합니다.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// 환경 변수 로드
dotenv.config();

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MedicalGeneExtractor {
  constructor() {
    // OpenAI API 설정
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o';
    this.maxTokens = 4096;
    
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
    console.log('🧬 DNA 유전자 추출 시작 (GPT-4o)...');
    const startTime = Date.now();
    
    try {
      // 입력 검증
      if (!rawText || rawText.trim().length === 0) {
        return { 
          genes: [], 
          message: '분석할 텍스트가 없습니다.',
          stats: this.getStats()
        };
      }

      // API 키 확인
      if (!this.apiKey) {
        throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
      }

      // DNA 추출 프롬프트 생성
      const prompt = this.buildDNAExtractionPrompt(rawText, options);
      
      // OpenAI API 호출
      const response = await this.callOpenAIApi(prompt);
      
      // 응답 파싱
      const result = this.parseGeneExtractionResponse(response);
      
      // 통계 업데이트
      const processingTime = Date.now() - startTime;
      this.updateStats(result.genes.length, processingTime, result.averageConfidence);
      
      console.log(`✅ ${result.genes.length}개 유전자 추출 완료 (${processingTime}ms)`);
      
      return {
        ...result,
        processingTime,
        stats: this.getStats()
      };
      
    } catch (error) {
      console.error('❌ DNA 유전자 추출 실패:', error);
      throw new Error(`DNA 유전자 추출 실패: ${error.message}`);
    }
  }

  /**
   * DNA 추출을 위한 고도화된 프롬프트를 생성합니다.
   * @param {string} rawText - 원본 텍스트
   * @param {Object} options - 추출 옵션
   * @returns {Array} 시스템 및 사용자 메시지
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
      } else if (error.response?.status === 400) {
        throw new Error(`API 요청 오류: ${error.response.data?.error?.message || error.message}`);
      } else {
        throw new Error(`OpenAI API 호출 실패: ${error.message}`);
      }
    }
  }

  /**
   * 유전자 추출 응답을 파싱합니다.
   * @param {string} response - API 응답
   * @returns {Object} 파싱된 결과
   */
  parseGeneExtractionResponse(response) {
    try {
      const parsed = JSON.parse(response);
      
      // 기본 구조 검증
      if (!parsed.genes || !Array.isArray(parsed.genes)) {
        throw new Error('genes 배열이 없습니다');
      }

      // 각 유전자 검증 및 ID 생성
      parsed.genes.forEach((gene, index) => {
        if (!gene.id) {
          gene.id = `gene_${String(index + 1).padStart(3, '0')}`;
        }
        gene.extracted_at = new Date().toISOString();
        
        // 앵커 검증
        if (!gene.anchors) {
          gene.anchors = {};
        }
        
        // 신뢰도 기본값
        if (typeof gene.confidence !== 'number') {
          gene.confidence = 0.5;
        }
      });

      // 요약 정보 생성
      if (!parsed.extraction_summary) {
        parsed.extraction_summary = this.generateExtractionSummary(parsed.genes);
      }

      // 평균 신뢰도 계산
      const averageConfidence = parsed.genes.length > 0 
        ? parsed.genes.reduce((sum, gene) => sum + gene.confidence, 0) / parsed.genes.length
        : 0;

      return {
        genes: parsed.genes,
        summary: parsed.extraction_summary,
        averageConfidence: averageConfidence
      };
      
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      console.error('원본 응답:', response);
      
      // 파싱 실패 시 기본 응답
      return {
        genes: [],
        summary: {
          total_genes: 0,
          average_confidence: 0,
          error: '응답 파싱 실패'
        },
        averageConfidence: 0
      };
    }
  }

  /**
   * 추출 요약 정보를 생성합니다.
   * @param {Array} genes - 유전자 배열
   * @returns {Object} 요약 정보
   */
  generateExtractionSummary(genes) {
    const temporalAnchors = genes
      .map(g => g.anchors?.temporal)
      .filter(Boolean);
    
    const spatialAnchors = genes
      .map(g => g.anchors?.spatial)
      .filter(Boolean);
    
    const medicalEvents = genes
      .map(g => g.type || g.anchors?.medical)
      .filter(Boolean);

    return {
      total_genes: genes.length,
      average_confidence: genes.length > 0 
        ? genes.reduce((sum, gene) => sum + gene.confidence, 0) / genes.length 
        : 0,
      temporal_coverage: temporalAnchors.length > 0 
        ? `${Math.min(...temporalAnchors)} ~ ${Math.max(...temporalAnchors)}`
        : null,
      spatial_coverage: [...new Set(spatialAnchors)],
      medical_events: [...new Set(medicalEvents)]
    };
  }

  /**
   * 통계를 업데이트합니다.
   * @param {number} geneCount - 추출된 유전자 수
   * @param {number} processingTime - 처리 시간
   * @param {number} averageConfidence - 평균 신뢰도
   */
  updateStats(geneCount, processingTime, averageConfidence) {
    this.stats.totalProcessed++;
    this.stats.totalGenes += geneCount;
    this.stats.processingTimes.push(processingTime);
    
    // 평균 신뢰도 계산
    this.stats.averageConfidence = (
      (this.stats.averageConfidence * (this.stats.totalProcessed - 1)) + averageConfidence
    ) / this.stats.totalProcessed;
  }

  /**
   * 현재 통계를 반환합니다.
   * @returns {Object} 통계 정보
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
      : 0;

    return {
      totalProcessed: this.stats.totalProcessed,
      totalGenes: this.stats.totalGenes,
      averageGenesPerDocument: this.stats.totalProcessed > 0 
        ? this.stats.totalGenes / this.stats.totalProcessed 
        : 0,
      averageConfidence: this.stats.averageConfidence,
      averageProcessingTime: avgProcessingTime
    };
  }

  /**
   * 간단한 테스트 메서드
   */
  async test() {
    const sampleText = `
2024-01-15 서울대병원 내과
환자: 김철수 (1985-03-10)
주증상: 당뇨 조절 불량으로 내원
현병력: 2023년 당뇨병 진단 후 메트포르민 복용 중
금일 검사: 공복혈당 180mg/dl, HbA1c 8.5%
진단: 제2형 당뇨병 (E11.9)
처방: 메트포르민 1000mg bid → 1500mg bid로 증량
추적관찰: 2주 후 재방문 예정

2024-01-29 재방문
혈당 수치 개선: 공복혈당 140mg/dl
처방 유지, 식이요법 교육 시행
`;

    console.log('🧪 DNA 유전자 추출기 테스트 시작');
    try {
      const result = await this.extractGenes(sampleText);
      console.log('📋 추출 결과:');
      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('테스트 실패:', error);
      throw error;
    }
  }
}

// 직접 실행 시 테스트
if (import.meta.url === `file://${process.argv[1]}`) {
  const extractor = new MedicalGeneExtractor();
  extractor.test().catch(console.error);
} 