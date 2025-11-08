/**
 * 고도화된 코어 엔진 파일럿 시스템 실행 스크립트
 * Case2, Case6를 사용하여 새로운 아키텍처 검증
 */

import PilotSystem from './PilotSystem.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PilotRunner {
    constructor() {
        this.pilotSystem = new PilotSystem();
        this.outputDir = path.join(__dirname, 'output');
    }

    async initialize() {
        try {
            // 출력 디렉토리 생성
            await fs.mkdir(this.outputDir, { recursive: true });
            console.log('✅ 파일럿 시스템 초기화 완료');
        } catch (error) {
            console.error('❌ 초기화 실패:', error.message);
            throw error;
        }
    }

    async runFullPilot() {
        console.log('\n🚀 고도화된 코어 엔진 파일럿 시스템 시작');
        console.log('=' .repeat(60));

        try {
            // 파일럿 실행
            const results = await this.pilotSystem.runPilot(['Case2', 'Case6']);
            
            // 결과 분석 및 출력
            const analysis = this.analyzeResults(results);
            
            // 보고서 생성
            await this.generateReports(analysis);
            
            console.log('\n✅ 파일럿 시스템 실행 완료');
            return analysis;
            
        } catch (error) {
            console.error('\n❌ 파일럿 실행 실패:', error.message);
            throw error;
        }
    }

    async analyzeResults(results) {
        console.log('\n📊 결과 분석');
        console.log('-'.repeat(40));
        
        const summary = results.summary;
        
        console.log(`총 테스트 케이스: ${summary.totalCases}`);
        console.log(`성공한 케이스: ${summary.successfulCases}`);
        console.log(`실패한 케이스: ${summary.failedCases}`);
        console.log(`평균 품질 점수: ${summary.averageQualityScore.toFixed(2)}`);
        console.log(`목표 달성 여부: ${summary.overallSuccess ? '✅ 성공' : '❌ 실패'}`);
        
        console.log('\n📈 개별 케이스 결과:');
        results.results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} ${result.caseId}: ${result.qualityScore.overallScore}점`);
            
            if (result.qualityScore.details) {
                console.log(`    - 정보 보존: ${result.qualityScore.details.informationPreservation}%`);
                console.log(`    - 엔티티 추출: ${result.qualityScore.details.entityExtraction}%`);
                console.log(`    - 시간 정규화: ${result.qualityScore.details.temporalNormalization}%`);
                console.log(`    - 컨텍스트 분류: ${result.qualityScore.details.contextualClassification}%`);
            }
        });
    }

    async generateReports(results) {
        console.log('\n📄 보고서 생성 중...');
        
        try {
            // JSON 보고서
            const jsonReport = {
                timestamp: new Date().toISOString(),
                pilotVersion: '1.0.0',
                results: results,
                systemInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch
                }
            };
            
            const jsonPath = path.join(this.outputDir, 'pilot-report.json');
            await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
            console.log(`📁 JSON 보고서: ${jsonPath}`);
            
            // HTML 보고서
            const htmlReport = this.generateHtmlReport(results);
            const htmlPath = path.join(this.outputDir, 'pilot-report.html');
            await fs.writeFile(htmlPath, htmlReport);
            console.log(`📁 HTML 보고서: ${htmlPath}`);
            
            // 요약 보고서
            const summaryReport = this.generateSummaryReport(results);
            const summaryPath = path.join(this.outputDir, 'pilot-summary.txt');
            await fs.writeFile(summaryPath, summaryReport);
            console.log(`📁 요약 보고서: ${summaryPath}`);
            
        } catch (error) {
            console.error('❌ 보고서 생성 실패:', error.message);
        }
    }

    generateHtmlReport(results) {
        const summary = results.summary;
        
        return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>고도화된 코어 엔진 파일럿 보고서</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }
        .summary { background: #ecf0f1; padding: 15px; margin: 20px 0; border-radius: 8px; }
        .case-result { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .success { border-left: 5px solid #27ae60; }
        .failure { border-left: 5px solid #e74c3c; }
        .metric { display: inline-block; margin: 5px 10px; padding: 5px 10px; background: #3498db; color: white; border-radius: 4px; }
        .score { font-size: 1.2em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 고도화된 코어 엔진 파일럿 보고서</h1>
        <p>생성 시간: ${new Date().toLocaleString('ko-KR')}</p>
    </div>
    
    <div class="summary">
        <h2>📊 전체 요약</h2>
        <p><strong>총 테스트 케이스:</strong> ${summary.totalCases}</p>
        <p><strong>성공한 케이스:</strong> ${summary.successfulCases}</p>
        <p><strong>실패한 케이스:</strong> ${summary.failedCases}</p>
        <p><strong>평균 품질 점수:</strong> <span class="score">${summary.averageQualityScore.toFixed(2)}점</span></p>
        <p><strong>목표 달성:</strong> ${summary.overallSuccess ? '✅ 성공' : '❌ 실패'}</p>
    </div>
    
    <h2>📈 개별 케이스 결과</h2>
    ${results.results.map(result => `
        <div class="case-result ${result.success ? 'success' : 'failure'}">
            <h3>${result.caseId} ${result.success ? '✅' : '❌'}</h3>
            <p><strong>품질 점수:</strong> <span class="score">${result.qualityScore.overallScore}점</span></p>
            ${result.qualityScore.details ? `
                <div>
                    <span class="metric">정보 보존: ${result.qualityScore.details.informationPreservation}%</span>
                    <span class="metric">엔티티 추출: ${result.qualityScore.details.entityExtraction}%</span>
                    <span class="metric">시간 정규화: ${result.qualityScore.details.temporalNormalization}%</span>
                    <span class="metric">컨텍스트 분류: ${result.qualityScore.details.contextualClassification}%</span>
                </div>
            ` : ''}
        </div>
    `).join('')}
    
    <div class="summary">
        <h2>🎯 결론</h2>
        <p>${summary.overallSuccess ? 
            '고도화된 코어 엔진이 목표 품질 점수(70점)를 달성했습니다. 프로덕션 환경으로의 전환을 고려할 수 있습니다.' :
            '일부 케이스에서 목표 품질 점수에 미달했습니다. 추가 개선이 필요합니다.'
        }</p>
    </div>
</body>
</html>`;
    }

    analyzeResults(results) {
        // results가 배열이 아닌 경우 처리
        if (!Array.isArray(results)) {
            console.warn('Results is not an array, attempting to extract results array');
            if (results && results.results && Array.isArray(results.results)) {
                results = results.results;
            } else {
                console.error('Cannot process results - not an array and no results property found');
                return {
                    results: [],
                    summary: {
                        totalCases: 0,
                        successfulCases: 0,
                        failedCases: 0,
                        averageQualityScore: 0,
                        successRate: 0,
                        qualityThresholdMet: false,
                        overallSuccess: false
                    }
                };
            }
        }

        const totalCases = results.length;
        const successfulCases = results.filter(r => r.success).length;
        const failedCases = totalCases - successfulCases;
        
        const qualityScores = results
            .filter(r => r.qualityScore && r.qualityScore.overallScore)
            .map(r => r.qualityScore.overallScore);
        
        const averageQualityScore = qualityScores.length > 0 
            ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
            : 0;
        
        const successRate = totalCases > 0 ? (successfulCases / totalCases) * 100 : 0;
        const qualityThresholdMet = averageQualityScore >= 75;
        const overallSuccess = successRate >= 80 && qualityThresholdMet;
        
        return {
            results,
            summary: {
                totalCases,
                successfulCases,
                failedCases,
                averageQualityScore,
                successRate,
                qualityThresholdMet,
                overallSuccess
            }
        };
    }

    generateSummaryReport(results) {
        const summary = results.summary;
        
        return `
고도화된 코어 엔진 파일럿 시스템 요약 보고서
=============================================

실행 시간: ${new Date().toLocaleString('ko-KR')}

전체 요약:
- 총 테스트 케이스: ${summary.totalCases}
- 성공한 케이스: ${summary.successfulCases}
- 실패한 케이스: ${summary.failedCases}
- 평균 품질 점수: ${summary.averageQualityScore.toFixed(2)}점
- 목표 달성 여부: ${summary.overallSuccess ? '성공' : '실패'}

개별 케이스 결과:
${results.results.map(result => 
    `- ${result.caseId}: ${result.qualityScore.overallScore}점 (${result.success ? '성공' : '실패'})`
).join('\n')}

권장사항:
${summary.overallSuccess ? 
    '✅ 목표 달성: 프로덕션 환경 전환 고려' :
    '❌ 목표 미달성: 추가 개선 필요'
}
`;
    }
}

// 메인 실행 함수
async function main() {
    const runner = new PilotRunner();
    
    try {
        await runner.initialize();
        const results = await runner.runFullPilot();
        
        console.log('\n🎉 파일럿 시스템 실행이 성공적으로 완료되었습니다!');
        console.log(`📁 결과는 ${runner.outputDir} 디렉토리에서 확인할 수 있습니다.`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 파일럿 시스템 실행 중 오류 발생:', error);
        process.exit(1);
    }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    main();
}

export default PilotRunner;