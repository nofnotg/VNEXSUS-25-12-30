/**
 * Gemini 2.5 Flash Service
 *
 * PM 피드백 #2: 비용 절감을 위한 Gemini Flash 통합
 * - 간단한 케이스: Gemini Flash (저렴, 빠름)
 * - 복잡한 케이스: GPT-4o Mini (정확, 고품질)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiFlashService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    this.config = {
      modelName: 'gemini-2.0-flash-exp',
      enableCaching: options.enableCaching ?? true,
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      ...options
    };

    console.log('✅ Gemini Flash Service 초기화 완료');
    console.log(`  - 모델: ${this.config.modelName}`);
    console.log(`  - 캐싱: ${this.config.enableCaching ? '활성화' : '비활성화'}`);
  }

  /**
   * 의료 이벤트 복잡도 분석
   * @param {Object} inputData - 의료 이벤트 데이터
   * @returns {Object} { complexity: 'simple'|'medium'|'complex', score: number, reasons: [] }
   */
  analyzeComplexity(inputData) {
    const { medicalEvents = [], rawText = '' } = inputData;

    let complexityScore = 0;
    const reasons = [];

    // 1. 이벤트 개수 (0-30점)
    const eventCount = medicalEvents.length;
    if (eventCount > 50) {
      complexityScore += 30;
      reasons.push(`이벤트 개수 많음 (${eventCount}개)`);
    } else if (eventCount > 20) {
      complexityScore += 20;
      reasons.push(`이벤트 개수 보통 (${eventCount}개)`);
    } else {
      complexityScore += 10;
      reasons.push(`이벤트 개수 적음 (${eventCount}개)`);
    }

    // 2. 병원 개수 (0-20점)
    const uniqueHospitals = new Set(medicalEvents.map(e => e.hospital).filter(Boolean)).size;
    if (uniqueHospitals > 5) {
      complexityScore += 20;
      reasons.push(`다수 병원 (${uniqueHospitals}개)`);
    } else if (uniqueHospitals > 2) {
      complexityScore += 10;
    }

    // 3. 날짜 범위 (0-15점)
    const dates = medicalEvents.map(e => e.date).filter(Boolean);
    if (dates.length > 0) {
      const dateRange = this.calculateDateRange(dates);
      if (dateRange > 365 * 3) {
        complexityScore += 15;
        reasons.push(`긴 병력 기간 (${Math.floor(dateRange / 365)}년)`);
      } else if (dateRange > 365) {
        complexityScore += 8;
      }
    }

    // 4. 텍스트 길이 (0-15점)
    const textLength = rawText.length;
    if (textLength > 10000) {
      complexityScore += 15;
      reasons.push(`긴 텍스트 (${Math.floor(textLength / 1000)}KB)`);
    } else if (textLength > 5000) {
      complexityScore += 8;
    }

    // 5. 불확실성 플래그 (0-20점)
    const uncertainEvents = medicalEvents.filter(e =>
      e.spatialUncertain || e.temporalUncertain || e.uncertaintyScore > 0.3
    );
    if (uncertainEvents.length > 10) {
      complexityScore += 20;
      reasons.push(`높은 불확실성 (${uncertainEvents.length}개 이벤트)`);
    } else if (uncertainEvents.length > 5) {
      complexityScore += 10;
    }

    // 복잡도 판정
    let complexity;
    if (complexityScore < 30) {
      complexity = 'simple';
    } else if (complexityScore < 60) {
      complexity = 'medium';
    } else {
      complexity = 'complex';
    }

    return {
      complexity,
      score: complexityScore,
      maxScore: 100,
      reasons,
      metrics: {
        eventCount,
        uniqueHospitals,
        textLength,
        uncertainEvents: uncertainEvents.length
      }
    };
  }

  /**
   * 날짜 범위 계산 (일 단위)
   */
  calculateDateRange(dates) {
    const validDates = dates.map(d => new Date(d)).filter(d => !isNaN(d));
    if (validDates.length === 0) return 0;

    const earliest = Math.min(...validDates);
    const latest = Math.max(...validDates);
    return (latest - earliest) / (1000 * 60 * 60 * 24); // 일 단위
  }

  /**
   * 의료 보고서 생성 (Gemini Flash 사용)
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 생성 옵션
   * @returns {Promise<Object>} 생성된 보고서
   */
  async generateMedicalReport(inputData, options = {}) {
    const startTime = Date.now();

    try {
      // 복잡도 분석
      const complexityAnalysis = this.analyzeComplexity(inputData);

      console.log(`🧠 복잡도 분석: ${complexityAnalysis.complexity.toUpperCase()} (${complexityAnalysis.score}/100)`);
      console.log(`  - 이유: ${complexityAnalysis.reasons.join(', ')}`);

      // 프롬프트 생성
      const prompt = this.buildPrompt(inputData, options, complexityAnalysis);

      // Gemini API 호출
      const result = await this.generateWithRetry(prompt);

      const duration = Date.now() - startTime;

      return {
        success: true,
        report: result.text,
        service: 'gemini-flash',
        model: this.config.modelName,
        complexityAnalysis,
        metadata: {
          inputTokens: result.usageMetadata?.promptTokenCount || 0,
          outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata?.totalTokenCount || 0,
          duration,
          finishReason: result.finishReason
        }
      };

    } catch (error) {
      console.error('❌ Gemini Flash 보고서 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 프롬프트 생성
   */
  buildPrompt(inputData, options, complexityAnalysis) {
    const { medicalEvents = [], patientInfo = {}, insuranceRecords = [] } = inputData;

    // 의료 이벤트를 시간순 정렬
    const sortedEvents = [...medicalEvents].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    // 이벤트 요약
    const eventsText = sortedEvents.map((event, index) => {
      return `${index + 1}. [${event.date || '날짜불명'}] ${event.hospital || '병원불명'}
   - 진단: ${event.diagnosis || '미기재'}
   - 치료: ${event.treatment || '미기재'}
   - 검사: ${event.exam || '미기재'}
   ${event.spatialUncertain ? '   ⚠️ 공간적 불확실성' : ''}
   ${event.temporalUncertain ? '   ⚠️ 시간적 불확실성' : ''}`;
    }).join('\n\n');

    // 보험 정보
    const insuranceText = insuranceRecords.map((rec, i) =>
      `${i + 1}. ${rec.company} - ${rec.product} (가입일: ${rec.enrollmentDate})`
    ).join('\n');

    return `당신은 의료 문서 분석 전문가입니다. 다음 의료 이벤트를 분석하여 손해사정 보고서를 작성해주세요.

# 환자 정보
- 이름: ${patientInfo.name || '미기재'}
- 추가사항: ${patientInfo.memo || '없음'}

# 보험 정보
${insuranceText || '보험 정보 없음'}

# 의료 이벤트 (총 ${sortedEvents.length}건)
${eventsText}

# 복잡도 분석
- 복잡도: ${complexityAnalysis.complexity.toUpperCase()}
- 점수: ${complexityAnalysis.score}/100
- 특이사항: ${complexityAnalysis.reasons.join(', ')}

# 작성 지침
1. **시간순 요약**: 의료 이벤트를 시간 순서대로 간결하게 요약
2. **주요 진단**: 반복되거나 중요한 진단명 식별
3. **치료 패턴**: 치료 방법의 변화나 지속성 파악
4. **보험 관련성**: 보험 가입일 기준 3개월/5년 이내 이벤트 강조
5. **불확실성 표시**: 불확실한 정보는 명시적으로 언급
6. **간결성**: 복잡도가 낮은 경우 더 간결하게 작성

보고서를 작성해주세요.`;
  }

  /**
   * 재시도 로직이 포함된 Gemini 생성
   */
  async generateWithRetry(prompt, retries = 0) {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      return {
        text: response.text(),
        usageMetadata: response.usageMetadata,
        finishReason: response.candidates?.[0]?.finishReason || 'STOP'
      };

    } catch (error) {
      if (retries < this.config.maxRetries) {
        console.warn(`⚠️ Gemini API 재시도 (${retries + 1}/${this.config.maxRetries})`);
        await this.delay(this.config.retryDelay * (retries + 1));
        return this.generateWithRetry(prompt, retries + 1);
      }

      throw error;
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 서비스 헬스 체크
   */
  async healthCheck() {
    try {
      const testResult = await this.model.generateContent('Test');
      return {
        status: 'healthy',
        model: this.config.modelName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 편의 함수
export async function createGeminiFlashService(options) {
  return new GeminiFlashService(options);
}

export default GeminiFlashService;
