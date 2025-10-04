/**
 * Validation Runner - Gemini vs 룰기반 시스템 검증 실행기
 * 실제 API 키를 사용한 전체 배치 검증 수행
 */

import CaseValidator from './src/gemini-integration/caseValidator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runValidation() {
    console.log('🚀 VNEXSUS Gemini 검증 시스템 시작...');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    try {
        // CaseValidator 인스턴스 생성
        console.log('📦 CaseValidator 인스턴스 생성 중...');
        const validator = new CaseValidator();
        
        // 전체 검증 실행
        console.log('📊 전체 케이스 검증 실행 중...');
        const results = await validator.runFullValidation();
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ 검증 완료!');
        console.log(`⏱️ 총 실행 시간: ${(totalTime / 1000).toFixed(2)}초`);
        console.log(`📋 처리된 케이스 수: ${results.summary?.total_cases || 0}`);
        console.log(`🎯 평균 정확도: ${results.summary?.average_accuracy || 0}%`);
        console.log(`📈 평균 유사도: ${results.summary?.average_similarity || 0}%`);
        
        if (results.report_path) {
            console.log(`📄 상세 보고서: ${results.report_path}`);
        }
        
        if (results.html_report_path) {
            console.log(`🌐 HTML 보고서: ${results.html_report_path}`);
        }
        
        console.log('=' .repeat(60));
        
        return results;
        
    } catch (error) {
        console.error('\n❌ 검증 실행 중 오류 발생:');
        console.error(`💥 오류 메시지: ${error.message}`);
        console.error(`📍 스택 트레이스: ${error.stack}`);
        
        process.exit(1);
    }
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
    runValidation()
        .then((results) => {
            console.log('\n🎉 검증 프로세스가 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 검증 프로세스 실행 실패:', error);
            process.exit(1);
        });
}

export default runValidation;