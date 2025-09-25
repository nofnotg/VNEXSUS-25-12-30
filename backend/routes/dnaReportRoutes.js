// Enhanced DNA Report Generation Routes with Real GPT-4o Integration
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMedicalDnaPrompt, loadMedicalKnowledgeBase } from '../config/promptBuilder.js';
import { buildEnhancedMedicalDnaPrompt, loadEnhancedMedicalKnowledgeBase } from '../config/enhancedPromptBuilder.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI 클라이언트 지연 초기화 함수
function getOpenAIClient() {
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
        project: process.env.OPENAI_PROJECT_ID
    });
}

// DNA 시퀀싱 기반 보고서 생성 엔드포인트
router.post('/generate', async (req, res) => {
    try {
        console.log('🧬 Enhanced DNA 시퀀싱 파이프라인 시작');
        const { extractedText, patientInfo } = req.body;
        
        if (!extractedText) {
            return res.status(400).json({ 
                success: false, 
                error: '추출된 텍스트가 필요합니다' 
            });
        }

        // 1. 강화된 의료 지식 베이스 로드 (12케이스 분석 반영)
        console.log('📚 강화된 의료 지식 베이스 로드 중...');
        const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();
        
        // 2. DNA 시퀀싱 v2.0 프롬프트 구성 (개선된 버전)
        console.log('🧬 DNA 시퀀싱 v2.0 프롬프트 구성 (12케이스 개선 반영)...');
        const { systemPrompt, userPrompt } = buildEnhancedMedicalDnaPrompt(extractedText, knowledgeBase, patientInfo?.insuranceJoinDate);
        
        // 3. OpenAI GPT-4o 호출
        console.log('🤖 OpenAI GPT-4o 호출 중...');
        const startTime = Date.now();
        
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 4000
            // JSON 형식 제거 - 텍스트 형식으로 Report_Sample.txt 양식 출력
        });

        const processingTime = Date.now() - startTime;
        console.log(`✅ GPT-4o 처리 완료 (${processingTime}ms)`);
        
        // 텍스트 응답 처리 (JSON 파싱 불필요)
        const reportText = completion.choices[0].message.content;
        
        console.log('📋 Report_Sample.txt 양식 보고서 생성 완료');
        
        return res.json({
            success: true,
            message: 'Report_Sample.txt 양식 보고서 생성 완료',
            pipeline: 'Enhanced DNA Sequencing + Timeline Analysis',
            report: reportText, // script.js 호환성을 위해 report 필드 사용
            reportText: reportText, // Developer Studio 호환성을 위해 reportText도 유지
            processingTime: `${processingTime}ms`,
            model: 'gpt-4o',
            timestamp: new Date().toISOString(),
            sessionId: `dna_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // 세션 ID 추가
        });

    } catch (error) {
        console.error('❌ Enhanced DNA 시퀀싱 오류:', error);
        
        // 상세 에러 정보
        const errorResponse = {
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            timestamp: new Date().toISOString(),
            fallbackReport: {
                "피보험자_기본정보": "시스템 오류로 인한 추출 실패",
                "사고_발생_경위": "시스템 오류로 인한 추출 실패",
                "초기_증상_및_진료": "시스템 오류로 인한 추출 실패",
                "진단_및_검사결과": "시스템 오류로 인한 추출 실패", 
                "치료_경과": "시스템 오류로 인한 추출 실패",
                "현재_상태": "시스템 오류로 인한 추출 실패",
                "의료비_지출현황": "시스템 오류로 인한 추출 실패",
                "향후_치료계획": "시스템 오류로 인한 추출 실패",
                "종합의견": `Enhanced DNA 시퀀싱 처리 중 오류 발생: ${error.message}`
            }
        };

        // OpenAI API 오류 세분화
        if (error.message.includes('429')) {
            errorResponse.rateLimitExceeded = true;
            errorResponse.suggestion = "API 사용량 한도 초과. 잠시 후 다시 시도하세요.";
        } else if (error.message.includes('401')) {
            errorResponse.authenticationError = true;
            errorResponse.suggestion = "API 키 인증 실패. 환경 변수를 확인하세요.";
        } else if (error.message.includes('timeout')) {
            errorResponse.timeoutError = true;
            errorResponse.suggestion = "처리 시간 초과. 텍스트 길이를 줄이거나 다시 시도하세요.";
        }

        res.status(500).json(errorResponse);
    }
});

export default router;