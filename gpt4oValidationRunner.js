/**
 * GPT-4o Mini 검증 실행기
 * VNEXSUS GPT-4o Mini vs 룰기반 시스템 성능 비교 검증
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 동적 import 사용
const { default: GPT4oCaseValidator } = await import('./src/gpt4o-integration/gpt4oCaseValidator.js');

async function runGPT4oValidation() {
    console.log('🚀 VNEXSUS GPT-4o Mini 검증 시작...');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    
    try {
        // GPT-4o Mini 검증기 인스턴스 생성
        const validator = new GPT4oCaseValidator();
        
        // 전체 검증 실행
        const results = await validator.runFullValidation();
        
        const endTime = Date.now();
        const totalTime = Math.round((endTime - startTime) / 1000);
        
        console.log('\n' + '=' .repeat(60));
        console.log('🎉 GPT-4o Mini 검증 완료!');
        console.log(`⏱️  총 실행 시간: ${totalTime}초`);
        console.log(`📊 처리된 케이스: ${results.total_test_cases}개`);
        
        if (results.summary) {
            console.log(`✅ Phase 1 성공률: ${results.summary.phase1_success_rate}%`);
            console.log(`🎯 평균 정확도: ${results.summary.phase2_average_accuracy}%`);
            console.log(`📈 평균 유사도: ${results.summary.phase2_average_similarity}%`);
            console.log(`⚡ 평균 처리 시간: ${results.summary.average_processing_time}ms`);
            console.log(`🏆 전체 성능 점수: ${results.summary.overall_performance}`);
        }
        
        if (results.report_path) {
            console.log(`📄 상세 보고서: ${results.report_path}`);
        }
        
        if (results.html_report_path) {
            console.log(`🌐 HTML 보고서: ${results.html_report_path}`);
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ GPT-4o Mini 검증 오류:', error.message);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    }
}

// 검증 실행
runGPT4oValidation()
    .then(results => {
        console.log('\n✨ GPT-4o Mini 검증이 성공적으로 완료되었습니다!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 예상치 못한 오류:', error);
        process.exit(1);
    });

export default runGPT4oValidation;