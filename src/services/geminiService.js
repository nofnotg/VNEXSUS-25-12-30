/**
 * Gemini AI 서비스
 * VNEXSUS 시스템용 Gemini 2.5 Flash 통합 서비스
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.isEnabled = process.env.USE_GEMINI === 'true';
        
        if (!this.apiKey || this.apiKey === 'AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX') {
            console.warn('⚠️ Gemini API 키가 설정되지 않았습니다. OpenAI로 폴백합니다.');
            this.isEnabled = false;
            return;
        }
        
        if (this.isEnabled) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ 
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                }
            });
            console.log('✅ Gemini 2.5 Flash 서비스 초기화 완료');
        }
    }

    /**
     * 텍스트 생성 (OpenAI 호환 인터페이스)
     */
    async generateText(prompt, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Gemini 서비스가 비활성화되어 있습니다.');
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return {
                choices: [{
                    message: {
                        content: text,
                        role: 'assistant'
                    }
                }],
                usage: {
                    prompt_tokens: this.estimateTokens(prompt),
                    completion_tokens: this.estimateTokens(text),
                    total_tokens: this.estimateTokens(prompt) + this.estimateTokens(text)
                }
            };
        } catch (error) {
            console.error('Gemini API 오류:', error);
            throw new Error(`Gemini API 호출 실패: ${error.message}`);
        }
    }

    /**
     * 의료 보고서 분석 (특화 메서드)
     */
    async analyzeMedicalReport(reportData, options = {}) {
        if (!this.isEnabled) {
            throw new Error('Gemini 서비스가 비활성화되어 있습니다.');
        }

        const prompt = this.buildMedicalAnalysisPrompt(reportData);
        
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const analysis = response.text();
            
            return {
                analysis,
                confidence: this.calculateConfidence(analysis),
                model: 'gemini-2.0-flash-exp',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Gemini 의료 보고서 분석 오류:', error);
            throw error;
        }
    }

    /**
     * 의료 분석 프롬프트 구성
     */
    buildMedicalAnalysisPrompt(reportData) {
        return `
의료 보고서 분석을 수행해주세요.

보고서 데이터:
${JSON.stringify(reportData, null, 2)}

다음 항목들을 분석해주세요:
1. 환자 정보 추출 및 검증
2. 진단 내용 분석
3. 치료 계획 검토
4. 위험 요소 식별
5. 권장 사항 제시

분석 결과를 JSON 형식으로 제공해주세요:
{
  "patientInfo": {...},
  "diagnosis": {...},
  "treatment": {...},
  "riskFactors": [...],
  "recommendations": [...]
}
`;
    }

    /**
     * 신뢰도 계산
     */
    calculateConfidence(analysis) {
        // 간단한 신뢰도 계산 로직
        const length = analysis.length;
        const hasStructure = analysis.includes('{') && analysis.includes('}');
        const hasKeywords = ['환자', '진단', '치료'].some(keyword => 
            analysis.includes(keyword)
        );
        
        let confidence = 0.5;
        if (length > 100) confidence += 0.2;
        if (hasStructure) confidence += 0.2;
        if (hasKeywords) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 토큰 수 추정
     */
    estimateTokens(text) {
        // 간단한 토큰 추정 (실제로는 더 정확한 계산 필요)
        return Math.ceil(text.length / 4);
    }

    /**
     * 서비스 상태 확인
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            model: 'gemini-2.0-flash-exp',
            apiKeyConfigured: !!this.apiKey && this.apiKey !== 'AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        };
    }
}

export default GeminiService;