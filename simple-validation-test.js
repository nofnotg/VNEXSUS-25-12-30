/**
 * 간단한 CaseValidator 테스트 스크립트
 * 각 단계를 개별적으로 테스트하여 문제점 파악
 */

import CaseValidator from './src/gemini-integration/caseValidator.js';

async function simpleTest() {
    console.log('🧪 CaseValidator 간단 테스트 시작...');
    
    try {
        console.log('1️⃣ CaseValidator 인스턴스 생성...');
        const validator = new CaseValidator();
        console.log('✅ CaseValidator 생성 완료');
        
        console.log('\n2️⃣ Gemini API 연결 테스트...');
        const connectionTest = await validator.testGeminiConnection();
        console.log('📊 연결 테스트 결과:', connectionTest);
        
        console.log('\n3️⃣ 테스트 케이스 로드 시도...');
        const testCases = await validator.loadTestCases();
        console.log(`📋 로드된 케이스 수: ${testCases.length}`);
        
        if (testCases.length > 0) {
            console.log('📄 첫 번째 케이스 샘플:', testCases[0]);
        }
        
        console.log('\n✅ 모든 기본 테스트 완료!');
        
    } catch (error) {
        console.error('\n❌ 테스트 중 오류 발생:');
        console.error(`💥 오류 메시지: ${error.message}`);
        console.error(`📍 스택 트레이스: ${error.stack}`);
    }
}

simpleTest();