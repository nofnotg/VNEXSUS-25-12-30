/**
 * GPT-4o Mini API Client
 * OpenAI GPT-4o Mini API와의 통신을 담당하는 클라이언트
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class GPT4oClient {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.model = 'gpt-4o-mini';
        
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
        }
    }

    /**
     * GPT-4o Mini API 연결 테스트
     */
    async testConnection() {
        try {
            console.log('🔌 GPT-4o Mini API 연결 테스트 중...');
            
            const response = await axios.post(this.apiUrl, {
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant. Please respond with 'Connection successful' to confirm the API is working."
                    },
                    {
                        role: "user",
                        content: "Test connection"
                    }
                ],
                max_tokens: 50,
                temperature: 0
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                console.log('✅ GPT-4o Mini API 연결 성공');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ GPT-4o Mini API 연결 실패:', error.message);
            return false;
        }
    }

    /**
     * 의료 텍스트 분석 요청
     */
    async analyzeMedicalText(medicalText, prompt = null) {
        try {
            const systemPrompt = prompt || this.getDefaultMedicalPrompt();
            
            console.log(`📤 GPT-4o Mini API 요청 (텍스트 길이: ${medicalText.length}자)`);
            
            const startTime = Date.now();
            
            const response = await axios.post(this.apiUrl, {
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: medicalText
                    }
                ],
                max_tokens: 4000,
                temperature: 0.1,
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000 // 2분 타임아웃
            });

            const processingTime = Date.now() - startTime;
            
            if (response.data && response.data.choices && response.data.choices[0]) {
                const result = response.data.choices[0].message.content;
                
                console.log(`📥 GPT-4o Mini API 응답 수신 (처리 시간: ${processingTime}ms)`);
                
                return {
                    success: true,
                    result: this.parseJSONResponse(result),
                    raw_response: result,
                    processing_time: processingTime,
                    model: this.model,
                    usage: response.data.usage
                };
            }
            
            throw new Error('응답 데이터가 올바르지 않습니다.');
            
        } catch (error) {
            console.error('❌ GPT-4o Mini API 분석 오류:', error.message);
            
            return {
                success: false,
                error: error.message,
                processing_time: 0,
                model: this.model
            };
        }
    }

    /**
     * 기본 의료 텍스트 분석 프롬프트
     */
    getDefaultMedicalPrompt() {
        return `당신은 의료 텍스트 분석 전문가입니다. 주어진 의료 텍스트에서 다음 정보를 추출하고 분석해주세요:

1. 환자 정보 (이름, 나이, 성별 등)
2. 진료 날짜 및 병원 정보
3. 주요 진단명 및 상병코드
4. 검사 결과 및 수치
5. 처방 약물 및 치료 내용
6. 특이사항 및 주의사항

응답은 반드시 다음 JSON 형식으로 제공해주세요:

{
    "patient_info": {
        "name": "환자명",
        "age": "나이",
        "gender": "성별"
    },
    "visit_info": {
        "date": "진료날짜",
        "hospital": "병원명",
        "department": "진료과"
    },
    "diagnosis": {
        "primary": "주진단명",
        "secondary": ["부진단명들"],
        "codes": ["상병코드들"]
    },
    "test_results": [
        {
            "test_name": "검사명",
            "result": "결과값",
            "unit": "단위",
            "reference_range": "정상범위"
        }
    ],
    "medications": [
        {
            "name": "약물명",
            "dosage": "용량",
            "frequency": "복용횟수"
        }
    ],
    "treatments": ["치료내용들"],
    "notes": "특이사항",
    "confidence": 0.95,
    "extracted_genes": []
}`;
    }

    /**
     * JSON 응답 파싱 (강화된 오류 처리)
     */
    parseJSONResponse(responseText) {
        try {
            // 1차: 직접 JSON 파싱 시도
            return JSON.parse(responseText);
        } catch (error1) {
            try {
                // 2차: 코드 블록 제거 후 파싱
                const cleanedText = responseText
                    .replace(/```json\s*/g, '')
                    .replace(/```\s*/g, '')
                    .trim();
                return JSON.parse(cleanedText);
            } catch (error2) {
                try {
                    // 3차: 첫 번째와 마지막 중괄호 사이 추출
                    const firstBrace = responseText.indexOf('{');
                    const lastBrace = responseText.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
                        const jsonPart = responseText.substring(firstBrace, lastBrace + 1);
                        return JSON.parse(jsonPart);
                    }
                    throw new Error('JSON 구조를 찾을 수 없습니다.');
                } catch (error3) {
                    // 4차: 기본 구조 반환
                    console.warn('⚠️ JSON 파싱 실패, 기본 구조 반환');
                    return {
                        error: 'JSON 파싱 실패',
                        raw_text: responseText,
                        confidence: 0,
                        extracted_genes: []
                    };
                }
            }
        }
    }

    /**
     * 배치 처리를 위한 다중 케이스 분석
     */
    async analyzeBatch(testCases, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 1; // GPT-4o Mini는 순차 처리 권장
        const delay = options.delay || 1000; // 1초 지연
        
        console.log(`🔄 GPT-4o Mini 배치 처리 시작 (${testCases.length}개 케이스)`);
        
        for (let i = 0; i < testCases.length; i += batchSize) {
            const batch = testCases.slice(i, i + batchSize);
            
            for (const testCase of batch) {
                console.log(`📊 Case ${testCase.case_number} 처리 중...`);
                
                const result = await this.analyzeMedicalText(testCase.original_text);
                
                results.push({
                    case_id: testCase.id,
                    case_number: testCase.case_number,
                    ...result
                });
                
                // API 레이트 리미트 방지를 위한 지연
                if (i + 1 < testCases.length) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        console.log(`✅ GPT-4o Mini 배치 처리 완료 (${results.length}개 결과)`);
        return results;
    }
}

export default GPT4oClient;