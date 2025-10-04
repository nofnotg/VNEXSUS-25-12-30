/**
 * VNEXSUS Gemini 2.5 Flash 검증 실행기
 * Case Sample 기반 검증-보완-개발 반복 시스템
 */

import CaseValidator from './caseValidator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ValidationRunner {
    constructor() {
        this.validator = new CaseValidator();
        this.outputDir = path.join(__dirname, '../../validation-results');
    }

    /**
     * 전체 검증 프로세스 실행
     */
    async runValidation() {
        console.log('🚀 VNEXSUS Gemini 2.5 Flash 검증 시작...\n');
        
        try {
            // 출력 디렉토리 생성
            await fs.promises.mkdir(this.outputDir, { recursive: true });
            
            // 검증 실행
            const validationResults = await this.validator.runFullValidation();
            
            // HTML 보고서 생성
            const htmlReport = await this.generateHTMLReport(validationResults);
            
            // 결과 출력
            this.printSummary(validationResults);
            
            return {
                success: true,
                results: validationResults,
                html_report: htmlReport
            };
            
        } catch (error) {
            console.error('❌ 검증 실행 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * HTML 보고서 생성
     */
    async generateHTMLReport(results) {
        const timestamp = new Date().toISOString();
        const reportDate = new Date().toLocaleDateString('ko-KR');
        
        const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VNEXSUS Gemini 2.5 Flash 검증 보고서</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 300;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        
        .header .meta {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .meta-item {
            background: rgba(255,255,255,0.1);
            padding: 10px 20px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 40px;
            background: #f8f9fa;
            border-radius: 10px;
            padding: 30px;
            border-left: 5px solid #3498db;
        }
        
        .section h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.8em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-success {
            background: #d4edda;
            color: #155724;
        }
        
        .status-warning {
            background: #fff3cd;
            color: #856404;
        }
        
        .status-error {
            background: #f8d7da;
            color: #721c24;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            text-align: center;
            border-top: 4px solid #3498db;
        }
        
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .metric-label {
            color: #7f8c8d;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .comparison-table th,
        .comparison-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .comparison-table th {
            background: #34495e;
            color: white;
            font-weight: 600;
        }
        
        .comparison-table tr:hover {
            background: #f8f9fa;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #ecf0f1;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            border-radius: 10px;
            transition: width 0.3s ease;
        }
        
        .recommendation {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .recommendation h3 {
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .next-steps {
            background: #e8f5e8;
            border: 1px solid #c3e6c3;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .next-steps ul {
            list-style: none;
            padding-left: 0;
        }
        
        .next-steps li {
            padding: 8px 0;
            border-bottom: 1px solid #d4edda;
        }
        
        .next-steps li:last-child {
            border-bottom: none;
        }
        
        .risk-assessment {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 30px;
        }
        
        .emoji {
            font-size: 1.2em;
            margin-right: 8px;
        }
        
        @media (max-width: 768px) {
            .header .meta {
                flex-direction: column;
                gap: 10px;
            }
            
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .comparison-table {
                font-size: 0.9em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧬 VNEXSUS Gemini 2.5 Flash 검증 보고서</h1>
            <div class="subtitle">Case Sample 기반 검증-보완-개발 시스템 결과</div>
            <div class="meta">
                <div class="meta-item">📅 생성일: ${reportDate}</div>
                <div class="meta-item">🧪 테스트 케이스: ${results.report_info?.total_test_cases || 0}개</div>
                <div class="meta-item">⚡ 모델: Gemini 2.0 Flash Exp</div>
            </div>
        </div>

        <div class="content">
            <!-- API 연결 테스트 결과 -->
            <div class="section">
                <h2>
                    <span class="emoji">🔌</span>
                    API 연결 테스트
                    <span class="status-badge ${results.connection_test?.success ? 'status-success' : 'status-error'}">
                        ${results.connection_test?.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                </h2>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${results.connection_test?.success ? '✅' : '❌'}</div>
                        <div class="metric-label">연결 상태</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.connection_test?.response_time || 0}ms</div>
                        <div class="metric-label">응답 시간</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.connection_test?.api_key_valid ? '유효' : '무효'}</div>
                        <div class="metric-label">API 키</div>
                    </div>
                </div>
            </div>

            <!-- Phase 1 결과 -->
            <div class="section">
                <h2>
                    <span class="emoji">🧪</span>
                    Phase 1: 기본 케이스 검증
                    <span class="status-badge ${results.phase1_results?.meets_threshold ? 'status-success' : 'status-warning'}">
                        ${results.phase1_results?.success_rate || 0}% 성공률
                    </span>
                </h2>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${Math.round((results.phase1_results?.average_accuracy || 0) * 100)}%</div>
                        <div class="metric-label">평균 정확도</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(results.phase1_results?.average_accuracy || 0) * 100}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${Math.round(results.phase1_results?.average_processing_time || 0)}ms</div>
                        <div class="metric-label">평균 처리 시간</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.phase1_results?.successful_cases || 0}/${results.phase1_results?.total_cases || 0}</div>
                        <div class="metric-label">성공 케이스</div>
                    </div>
                </div>
            </div>

            <!-- Phase 2 결과 -->
            <div class="section">
                <h2>
                    <span class="emoji">🔬</span>
                    Phase 2: 전체 케이스 검증
                    <span class="status-badge ${results.phase2_results?.meets_accuracy_threshold ? 'status-success' : 'status-warning'}">
                        ${results.phase2_results?.success_rate || 0}% 성공률
                    </span>
                </h2>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${Math.round((results.phase2_results?.average_accuracy || 0) * 100)}%</div>
                        <div class="metric-label">평균 정확도</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(results.phase2_results?.average_accuracy || 0) * 100}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${Math.round(results.phase2_results?.average_processing_time || 0)}ms</div>
                        <div class="metric-label">평균 처리 시간</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.phase2_results?.successful_cases || 0}/${results.phase2_results?.total_cases || 0}</div>
                        <div class="metric-label">성공 케이스</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.phase2_results?.meets_accuracy_threshold && results.phase2_results?.meets_time_threshold ? '✅' : '⚠️'}</div>
                        <div class="metric-label">임계값 달성</div>
                    </div>
                </div>
            </div>

            <!-- 성능 비교 분석 -->
            <div class="section">
                <h2><span class="emoji">⚖️</span>성능 비교 분석: 룰기반 vs Gemini 2.5 Flash</h2>
                
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>지표</th>
                            <th>룰기반 시스템</th>
                            <th>Gemini 2.5 Flash</th>
                            <th>개선도</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>평균 정확도</strong></td>
                            <td>${Math.round((results.comparison_analysis?.rule_based?.average_accuracy || 0) * 100)}%</td>
                            <td>${Math.round((results.comparison_analysis?.gemini_flash?.average_accuracy || 0) * 100)}%</td>
                            <td>${results.comparison_analysis?.comparison?.accuracy_difference > 0 ? '+' : ''}${Math.round((results.comparison_analysis?.comparison?.accuracy_difference || 0) * 100)}%</td>
                        </tr>
                        <tr>
                            <td><strong>평균 처리 시간</strong></td>
                            <td>${Math.round((results.comparison_analysis?.rule_based?.average_processing_time || 0) / 1000)}초</td>
                            <td>${Math.round((results.comparison_analysis?.gemini_flash?.average_processing_time || 0) / 1000)}초</td>
                            <td>${results.comparison_analysis?.comparison?.time_improvement > 0 ? '+' : ''}${Math.round(results.comparison_analysis?.comparison?.time_improvement || 0)}%</td>
                        </tr>
                        <tr>
                            <td><strong>성공률</strong></td>
                            <td>${results.comparison_analysis?.rule_based?.success_rate || 0}%</td>
                            <td>${results.comparison_analysis?.gemini_flash?.success_rate || 0}%</td>
                            <td>${results.comparison_analysis?.comparison?.success_rate_difference > 0 ? '+' : ''}${Math.round(results.comparison_analysis?.comparison?.success_rate_difference || 0)}%</td>
                        </tr>
                        <tr>
                            <td><strong>일관성 점수</strong></td>
                            <td>${Math.round((results.comparison_analysis?.rule_based?.consistency_score || 0) * 100)}%</td>
                            <td>${Math.round((results.comparison_analysis?.gemini_flash?.consistency_score || 0) * 100)}%</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 종합 평가 및 권장사항 -->
            <div class="section">
                <h2><span class="emoji">📊</span>종합 평가 및 권장사항</h2>
                
                <div class="recommendation">
                    <h3>🎯 전환 권장사항</h3>
                    <p>${results.comparison_analysis?.comparison?.recommendation || '추가 분석 필요'}</p>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${results.overall_assessment?.gemini_ready ? '✅' : '⚠️'}</div>
                        <div class="metric-label">Gemini 전환 준비도</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${Math.round((results.detailed_metrics?.accuracy_improvement || 0) * 100)}%</div>
                        <div class="metric-label">정확도 개선</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${Math.round(results.detailed_metrics?.time_improvement || 0)}%</div>
                        <div class="metric-label">시간 개선</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${Math.round(results.detailed_metrics?.success_rate || 0)}%</div>
                        <div class="metric-label">전체 성공률</div>
                    </div>
                </div>
            </div>

            <!-- 다음 단계 -->
            <div class="section">
                <h2><span class="emoji">🚀</span>다음 단계</h2>
                
                <div class="next-steps">
                    <h3>📋 실행 계획</h3>
                    <ul>
                        ${(results.overall_assessment?.next_steps || []).map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>

                <div class="risk-assessment">
                    <h3>⚠️ 리스크 평가</h3>
                    <ul>
                        ${(results.overall_assessment?.risk_assessment || []).map(risk => `<li>${risk}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- 상세 메트릭 -->
            <div class="section">
                <h2><span class="emoji">📈</span>상세 성능 메트릭</h2>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${Math.round((results.detailed_metrics?.consistency_score || 0) * 100)}%</div>
                        <div class="metric-label">일관성 점수</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(results.detailed_metrics?.consistency_score || 0) * 100}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.phase2_results?.total_cases || 0}</div>
                        <div class="metric-label">총 테스트 케이스</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${results.connection_test?.model || 'N/A'}</div>
                        <div class="metric-label">사용 모델</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${new Date(timestamp).toLocaleTimeString('ko-KR')}</div>
                        <div class="metric-label">검증 완료 시간</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🧬 VNEXSUS DNA 시퀀싱 엔진 - Gemini 2.5 Flash 전환 검증 시스템</p>
            <p>Generated on ${new Date(timestamp).toLocaleString('ko-KR')}</p>
        </div>
    </div>
</body>
</html>`;

        // HTML 파일 저장
        const htmlFileName = `gemini-validation-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
        const htmlFilePath = path.join(this.outputDir, htmlFileName);
        
        await fs.promises.writeFile(htmlFilePath, htmlContent, 'utf8');
        console.log(`📄 HTML 보고서 생성: ${htmlFilePath}`);
        
        return htmlFilePath;
    }

    /**
     * 검증 결과 요약 출력
     */
    printSummary(results) {
        console.log('\n' + '='.repeat(60));
        console.log('🧬 VNEXSUS Gemini 2.5 Flash 검증 결과 요약');
        console.log('='.repeat(60));
        
        // API 연결 상태
        console.log(`\n🔌 API 연결: ${results.connection_test?.success ? '✅ 성공' : '❌ 실패'}`);
        if (results.connection_test?.success) {
            console.log(`   응답 시간: ${results.connection_test.response_time}ms`);
        }
        
        // Phase 1 결과
        if (results.phase1_results) {
            console.log(`\n🧪 Phase 1 (기본 검증):`);
            console.log(`   성공률: ${results.phase1_results.success_rate}%`);
            console.log(`   평균 정확도: ${Math.round(results.phase1_results.average_accuracy * 100)}%`);
            console.log(`   평균 처리 시간: ${Math.round(results.phase1_results.average_processing_time)}ms`);
        }
        
        // Phase 2 결과
        if (results.phase2_results) {
            console.log(`\n🔬 Phase 2 (전체 검증):`);
            console.log(`   성공률: ${results.phase2_results.success_rate}%`);
            console.log(`   평균 정확도: ${Math.round(results.phase2_results.average_accuracy * 100)}%`);
            console.log(`   평균 처리 시간: ${Math.round(results.phase2_results.average_processing_time)}ms`);
            console.log(`   임계값 달성: ${results.phase2_results.meets_accuracy_threshold && results.phase2_results.meets_time_threshold ? '✅' : '⚠️'}`);
        }
        
        // 성능 비교
        if (results.comparison_analysis) {
            console.log(`\n⚖️ 성능 비교:`);
            console.log(`   정확도 개선: ${results.comparison_analysis.comparison?.accuracy_difference > 0 ? '+' : ''}${Math.round((results.comparison_analysis.comparison?.accuracy_difference || 0) * 100)}%`);
            console.log(`   시간 개선: ${Math.round(results.comparison_analysis.comparison?.time_improvement || 0)}%`);
        }
        
        // 최종 권장사항
        if (results.overall_assessment) {
            console.log(`\n🎯 최종 권장사항:`);
            console.log(`   ${results.overall_assessment.recommendation}`);
            console.log(`   전환 준비도: ${results.overall_assessment.gemini_ready ? '✅ 준비 완료' : '⚠️ 추가 작업 필요'}`);
        }
        
        console.log('\n' + '='.repeat(60));
    }
}

// 메인 실행 함수
async function main() {
    const runner = new ValidationRunner();
    
    try {
        const result = await runner.runValidation();
        
        if (result.success) {
            console.log('\n✅ 검증 완료! HTML 보고서가 생성되었습니다.');
            console.log(`📄 보고서 위치: ${result.html_report}`);
        } else {
            console.error('\n❌ 검증 실패:', result.error);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ 실행 오류:', error);
        return { success: false, error: error.message };
    }
}

// 직접 실행 시
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    main().then(result => {
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('실행 오류:', error);
        process.exit(1);
    });
}

export default ValidationRunner;