/**
 * Full Validation 실행 스크립트
 * CaseValidator의 runFullValidation을 직접 호출
 */

import CaseValidator from './src/gemini-integration/caseValidator.js';

async function runFullValidation() {
    console.log('🚀 Full Validation 시작...');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    try {
        const validator = new CaseValidator();
        
        console.log('📊 runFullValidation 호출 중...');
        const results = await validator.runFullValidation();
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log('\n' + '=' .repeat(60));
        console.log('📋 검증 결과:');
        console.log(JSON.stringify(results, null, 2));
        
        console.log('\n' + '=' .repeat(60));
        console.log(`⏱️ 총 실행 시간: ${(totalTime / 1000).toFixed(2)}초`);
        
        if (results.success !== false) {
            console.log('✅ 검증 성공!');
        } else {
            console.log('❌ 검증 실패:', results.error);
        }
        
    } catch (error) {
        console.error('\n❌ 실행 중 오류:');
        console.error(`💥 오류: ${error.message}`);
        console.error(`📍 스택: ${error.stack}`);
    }
}

runFullValidation();