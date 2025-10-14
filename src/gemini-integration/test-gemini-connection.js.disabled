/**
 * Gemini API 연결 테스트 스크립트
 */

import GeminiClient from './geminiClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프로젝트 루트의 .env 파일 로드
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testGeminiConnection() {
    console.log('🔍 Gemini API 연결 테스트 시작...');
    
    const client = new GeminiClient();
    
    // API 키 설정 상태 확인
    console.log(`📋 API 키 설정 상태: ${client.apiKey && client.apiKey !== 'your-gemini-api-key' ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`🔑 API 키 길이: ${client.apiKey ? client.apiKey.length : 0} 문자`);
    console.log(`🔑 API 키 시작: ${client.apiKey ? client.apiKey.substring(0, 10) + '...' : 'N/A'}`);
    console.log(`🧪 테스트 모드: ${client.testMode ? '활성화' : '비활성화'}`);
    
    console.log('\n🚀 API 연결 테스트 중...');
    
    try {
        // 실제 API 호출 테스트
        if (!client.testMode) {
            const testText = "환자는 고혈압 진단을 받았습니다.";
            console.log(`📝 테스트 텍스트: ${testText}`);
            
            const result = await client.processMedicalText(testText);
            console.log('✅ Gemini API 연결 성공!');
            console.log('📊 처리 결과:', JSON.stringify(result, null, 2));
        } else {
            console.log('⚠️ 테스트 모드에서 실행 중입니다.');
        }
    } catch (error) {
        console.error('❌ Gemini API 연결 실패:', error.message);
        console.error('🔍 상세 오류:', error);
    }
}

testGeminiConnection().then(() => {
    console.log('\n🏁 테스트 완료');
}).catch(error => {
    console.error('💥 테스트 실행 오류:', error);
});