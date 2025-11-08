/**
 * 통합 시스템 검증 실행 스크립트
 * 모든 개선된 모듈들의 통합 테스트 및 검증을 수행합니다.
 */

import IntegratedSystemValidator from './IntegratedSystemValidator.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIntegratedValidation() {
    console.log('🚀 VNEXSUS 통합 시스템 검증을 시작합니다...\n');
    
    try {
        // 검증기 초기화
        const validator = new IntegratedSystemValidator({
            testDataSize: 100,
            performanceThreshold: 1000,
            stressTestDuration: 30000,
            reportFormat: 'html',
            outputDir: path.join(__dirname, 'validation-reports')
        });

        console.log('📋 검증 단계:');
        console.log('1. 모듈 초기화 및 기본 기능 테스트');
        console.log('2. 모듈 간 통합 테스트');
        console.log('3. 성능 및 스트레스 테스트');
        console.log('4. 종단간 테스트');
        console.log('5. 결과 분석 및 보고서 생성\n');

        // 전체 검증 실행
        const startTime = Date.now();
        const report = await validator.startIntegratedValidation();
        const endTime = Date.now();

        console.log('\n✅ 통합 시스템 검증이 완료되었습니다!');
        console.log(`⏱️  총 소요 시간: ${((endTime - startTime) / 1000).toFixed(2)}초`);
        console.log(`📊 전체 성공률: ${(report.overallSuccessRate * 100).toFixed(1)}%`);
        console.log(`🚀 배포 준비 상태: ${report.deploymentReady ? '✅ 준비 완료' : '❌ 준비 미완료'}`);

        // 보고서 파일 경로 출력
        if (report.reportPath) {
            console.log(`📄 상세 보고서: ${report.reportPath}`);
        }

        // 주요 결과 요약
        console.log('\n📈 주요 개선 사항:');
        const improvements = report.results?.qualityImprovements || {};
        for (const [module, improvement] of Object.entries(improvements)) {
            const status = improvement.status === 'achieved' ? '✅' : 
                          improvement.status === 'near_target' ? '🟡' : '🔄';
            console.log(`${status} ${module}: ${(improvement.baseline * 100).toFixed(1)}% → ${(improvement.current * 100).toFixed(1)}% (목표: ${(improvement.target * 100).toFixed(1)}%)`);
        }

        // 권장사항 출력
        if (report.recommendations && report.recommendations.length > 0) {
            console.log('\n💡 권장사항:');
            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
                console.log(`   ${rec.description}`);
            });
        }

        // 다음 단계 안내
        if (report.results?.nextSteps && report.results.nextSteps.length > 0) {
            console.log('\n🚀 다음 단계:');
            report.results.nextSteps.forEach(step => {
                console.log(`${step.step}. ${step.title}`);
                console.log(`   ${step.description}`);
            });
        }

        return report;

    } catch (error) {
        console.error('❌ 통합 시스템 검증 중 오류가 발생했습니다:', error.message);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    }
}

// 스크립트가 직접 실행될 때만 검증 실행
console.log('🚀 스크립트 시작...');
runIntegratedValidation()
    .then(report => {
        console.log('\n🎉 검증 완료! 시스템이 성공적으로 검증되었습니다.');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ 검증 실패:', error.message);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    });

export { runIntegratedValidation };