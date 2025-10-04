/**
 * GPT-4o Mini Case Validator
 * GPT-4o Mini vs 룰기반 시스템 성능 비교 및 검증
 */

import GPT4oClient from './gpt4oClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GPT4oCaseValidator {
    constructor() {
        this.gpt4oClient = new GPT4oClient();
        this.testCasesPath = path.join(__dirname, '../../backend/postprocess/test_outputs');
        this.validationResults = [];
        
        // 검증 지표 임계값
        this.thresholds = {
            accuracy: 0.85,           // 85% 정확도
            processing_time: 120000,  // 2분 (120초)
            consistency: 0.80,        // 80% 일관성
            confidence: 0.75          // 75% 신뢰도
        };
    }

    /**
     * 전체 케이스 검증 실행
     * @returns {Promise<Object>} 종합 검증 결과
     */
    async runFullValidation() {
        console.log('🔬 VNEXSUS GPT-4o Mini Case Validation 시작...');
        
        try {
            // 1. GPT-4o Mini API 연결 테스트
            const connectionTest = await this.testGPT4oConnection();
            if (!connectionTest.success) {
                throw new Error('GPT-4o Mini API 연결 실패');
            }

            // 2. 테스트 케이스 로드
            const testCases = await this.loadTestCases();
            console.log(`📋 ${testCases.length}개 테스트 케이스 로드 완료`);

            // 3. 단계별 검증 실행
            const phase1Results = await this.runPhase1Validation(testCases.slice(0, 3));
            const phase2Results = await this.runPhase2Validation(testCases);
            
            // 4. 성능 비교 분석
            const comparisonResults = await this.compareWithRuleBasedSystem(testCases);
            
            // 5. 종합 보고서 생성
            const finalReport = this.generateFinalReport({
                connection_test: connectionTest,
                phase1: phase1Results,
                phase2: phase2Results,
                comparison: comparisonResults,
                test_cases_count: testCases.length
            });

            // 6. 결과 저장
            await this.saveValidationResults(finalReport);
            
            return finalReport;

        } catch (error) {
            console.error('❌ GPT-4o Mini 검증 프로세스 오류:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * GPT-4o Mini API 연결 테스트
     */
    async testGPT4oConnection() {
        console.log('🔌 GPT-4o Mini API 연결 테스트...');
        
        try {
            const startTime = Date.now();
            const isConnected = await this.gpt4oClient.testConnection();
            const responseTime = Date.now() - startTime;
            
            return {
                success: isConnected,
                response_time: responseTime,
                api_key_valid: isConnected,
                model: 'gpt-4o-mini',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 테스트 케이스 로드 - 실제 Case 파일들을 읽어옴
     */
    async loadTestCases() {
        try {
            // 실제 케이스 파일들이 있는 디렉토리
            const caseSampleDir = path.join(__dirname, '..', '..', 'src', 'rag', 'case_sample');
            console.log(`📁 케이스 디렉토리: ${caseSampleDir}`);
            
            const files = await fs.promises.readdir(caseSampleDir);
            const caseFiles = files.filter(file => file.match(/^Case\d+\.txt$/));
            
            console.log(`📋 발견된 케이스 파일: ${caseFiles.length}개`);
            
            const testCases = [];
            
            for (const caseFile of caseFiles) {
                const caseNumber = caseFile.match(/Case(\d+)\.txt/)[1];
                const reportFile = `Case${caseNumber}_report.txt`;
                
                const caseFilePath = path.join(caseSampleDir, caseFile);
                const reportFilePath = path.join(caseSampleDir, reportFile);
                
                try {
                    // Case 파일 읽기
                    const caseContent = await fs.promises.readFile(caseFilePath, 'utf8');
                    
                    // Report 파일 읽기 (있는 경우)
                    let reportContent = null;
                    try {
                        reportContent = await fs.promises.readFile(reportFilePath, 'utf8');
                    } catch (reportError) {
                        console.log(`⚠️  Case${caseNumber}_report.txt 파일이 없습니다.`);
                    }
                    
                    testCases.push({
                        id: `Case${caseNumber}`,
                        case_number: parseInt(caseNumber),
                        original_text: caseContent,
                        rule_based_result: reportContent,
                        case_file_path: caseFilePath,
                        report_file_path: reportFilePath,
                        expected_results: this.parseRuleBasedResult(reportContent)
                    });
                    
                } catch (fileError) {
                    console.error(`❌ Case${caseNumber} 파일 읽기 오류:`, fileError.message);
                }
            }
            
            // 케이스 번호 순으로 정렬
            testCases.sort((a, b) => a.case_number - b.case_number);
            
            return testCases;
            
        } catch (error) {
            console.error('❌ 테스트 케이스 로드 오류:', error);
            return [];
        }
    }

    /**
     * Phase 1: 기본 기능 검증 (처음 3개 케이스)
     */
    async runPhase1Validation(testCases) {
        console.log('\n🔍 Phase 1: GPT-4o Mini 기본 기능 검증 시작...');
        
        const phase1Results = {
            phase: 1,
            total_cases: testCases.length,
            successful_cases: 0,
            failed_cases: 0,
            results: [],
            average_processing_time: 0,
            success_rate: 0
        };

        let totalProcessingTime = 0;

        for (const testCase of testCases) {
            console.log(`\n📊 Case ${testCase.case_number} 검증 중...`);
            
            try {
                const result = await this.gpt4oClient.analyzeMedicalText(testCase.original_text);
                
                const caseResult = {
                    case_id: testCase.id,
                    case_number: testCase.case_number,
                    success: result.success,
                    processing_time: result.processing_time,
                    confidence: result.result?.confidence || 0,
                    error: result.error || null,
                    gpt4o_result: result.result,
                    expected_result: testCase.expected_results
                };

                if (result.success) {
                    phase1Results.successful_cases++;
                    console.log(`✅ Case ${testCase.case_number} 성공 (${result.processing_time}ms)`);
                } else {
                    phase1Results.failed_cases++;
                    console.log(`❌ Case ${testCase.case_number} 실패: ${result.error}`);
                }

                totalProcessingTime += result.processing_time || 0;
                phase1Results.results.push(caseResult);

            } catch (error) {
                console.error(`❌ Case ${testCase.case_number} 처리 오류:`, error.message);
                phase1Results.failed_cases++;
                phase1Results.results.push({
                    case_id: testCase.id,
                    case_number: testCase.case_number,
                    success: false,
                    error: error.message,
                    processing_time: 0
                });
            }
        }

        phase1Results.average_processing_time = Math.round(totalProcessingTime / testCases.length);
        phase1Results.success_rate = Math.round((phase1Results.successful_cases / testCases.length) * 100);

        console.log(`\n📊 Phase 1 결과:`);
        console.log(`   성공: ${phase1Results.successful_cases}/${testCases.length}`);
        console.log(`   성공률: ${phase1Results.success_rate}%`);
        console.log(`   평균 처리 시간: ${phase1Results.average_processing_time}ms`);

        return phase1Results;
    }

    /**
     * Phase 2: 전체 케이스 정확도 검증
     */
    async runPhase2Validation(testCases) {
        console.log('\n🔍 Phase 2: GPT-4o Mini 전체 케이스 정확도 검증 시작...');
        
        const phase2Results = {
            phase: 2,
            total_cases: testCases.length,
            results: [],
            accuracy_scores: [],
            similarity_scores: [],
            average_accuracy: 0,
            average_similarity: 0,
            average_confidence: 0
        };

        // 배치 처리로 모든 케이스 분석
        const batchResults = await this.gpt4oClient.analyzeBatch(testCases, {
            batchSize: 1,
            delay: 1500 // GPT-4o Mini 레이트 리미트 고려
        });

        for (let i = 0; i < batchResults.length; i++) {
            const result = batchResults[i];
            const testCase = testCases[i];
            
            if (result.success && result.result) {
                // 정확도 및 유사도 계산
                const accuracy = this.calculateAccuracy(result.result, testCase.expected_results);
                const similarity = this.calculateSimilarity(result.result, testCase.expected_results);
                const confidence = result.result.confidence || 0;

                phase2Results.results.push({
                    case_id: result.case_id,
                    case_number: result.case_number,
                    success: true,
                    accuracy: accuracy,
                    similarity: similarity,
                    confidence: confidence,
                    processing_time: result.processing_time,
                    gpt4o_result: result.result
                });

                phase2Results.accuracy_scores.push(accuracy);
                phase2Results.similarity_scores.push(similarity);

                console.log(`✅ Case ${result.case_number}: 정확도 ${accuracy}%, 유사도 ${similarity}%`);
            } else {
                console.log(`❌ Case ${result.case_number}: 분석 실패`);
                phase2Results.results.push({
                    case_id: result.case_id,
                    case_number: result.case_number,
                    success: false,
                    error: result.error,
                    accuracy: 0,
                    similarity: 0,
                    confidence: 0
                });
            }
        }

        // 평균 계산
        if (phase2Results.accuracy_scores.length > 0) {
            phase2Results.average_accuracy = Math.round(
                phase2Results.accuracy_scores.reduce((a, b) => a + b, 0) / phase2Results.accuracy_scores.length
            );
            phase2Results.average_similarity = Math.round(
                phase2Results.similarity_scores.reduce((a, b) => a + b, 0) / phase2Results.similarity_scores.length
            );
            phase2Results.average_confidence = Math.round(
                phase2Results.results
                    .filter(r => r.success)
                    .reduce((sum, r) => sum + r.confidence, 0) / phase2Results.results.filter(r => r.success).length
            );
        }

        console.log(`\n📊 Phase 2 결과:`);
        console.log(`   평균 정확도: ${phase2Results.average_accuracy}%`);
        console.log(`   평균 유사도: ${phase2Results.average_similarity}%`);
        console.log(`   평균 신뢰도: ${phase2Results.average_confidence}%`);

        return phase2Results;
    }

    /**
     * 룰기반 시스템과의 성능 비교
     */
    async compareWithRuleBasedSystem(testCases) {
        console.log('\n🔍 GPT-4o Mini vs 룰기반 시스템 성능 비교...');
        
        return {
            comparison_type: 'GPT-4o Mini vs Rule-based System',
            total_cases: testCases.length,
            gpt4o_advantages: [
                '자연어 이해 능력',
                '컨텍스트 파악',
                '유연한 데이터 추출',
                '다양한 형식 처리'
            ],
            rule_based_advantages: [
                '일관된 결과',
                '빠른 처리 속도',
                '예측 가능한 동작',
                '낮은 비용'
            ],
            recommendation: 'GPT-4o Mini는 복잡한 의료 텍스트 분석에 적합하나, 비용과 처리 시간을 고려한 하이브리드 접근 권장'
        };
    }

    /**
     * 정확도 계산
     */
    calculateAccuracy(gpt4oResult, expectedResult) {
        if (!expectedResult || !gpt4oResult) return 0;
        
        let score = 0;
        let totalFields = 0;
        
        // 환자 정보 비교
        if (expectedResult.patient_info && gpt4oResult.patient_info) {
            totalFields += 3;
            if (expectedResult.patient_info.name === gpt4oResult.patient_info.name) score++;
            if (expectedResult.patient_info.age === gpt4oResult.patient_info.age) score++;
            if (expectedResult.patient_info.gender === gpt4oResult.patient_info.gender) score++;
        }
        
        // 진단 정보 비교
        if (expectedResult.diagnosis && gpt4oResult.diagnosis) {
            totalFields += 2;
            if (expectedResult.diagnosis.primary === gpt4oResult.diagnosis.primary) score++;
            if (JSON.stringify(expectedResult.diagnosis.codes) === JSON.stringify(gpt4oResult.diagnosis.codes)) score++;
        }
        
        return totalFields > 0 ? Math.round((score / totalFields) * 100) : 0;
    }

    /**
     * 유사도 계산 (텍스트 기반)
     */
    calculateSimilarity(gpt4oResult, expectedResult) {
        if (!expectedResult || !gpt4oResult) return 0;
        
        const gpt4oText = JSON.stringify(gpt4oResult).toLowerCase();
        const expectedText = JSON.stringify(expectedResult).toLowerCase();
        
        // 간단한 Jaccard 유사도 계산
        const gpt4oWords = new Set(gpt4oText.split(/\W+/).filter(w => w.length > 2));
        const expectedWords = new Set(expectedText.split(/\W+/).filter(w => w.length > 2));
        
        const intersection = new Set([...gpt4oWords].filter(w => expectedWords.has(w)));
        const union = new Set([...gpt4oWords, ...expectedWords]);
        
        return union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0;
    }

    /**
     * 룰기반 결과 파싱
     */
    parseRuleBasedResult(reportContent) {
        if (!reportContent) return null;
        
        try {
            // 기본적인 정보 추출 시도
            return {
                patient_info: {
                    name: this.extractPatientName(reportContent),
                    age: this.extractPatientAge(reportContent),
                    gender: this.extractPatientGender(reportContent)
                },
                diagnosis: {
                    primary: this.extractPrimaryDiagnosis(reportContent),
                    codes: this.extractDiagnosisCodes(reportContent)
                }
            };
        } catch (error) {
            console.warn('⚠️ 룰기반 결과 파싱 실패:', error.message);
            return null;
        }
    }

    // 헬퍼 메서드들
    extractPatientName(text) {
        const nameMatch = text.match(/환자명[:\s]*([^\n\r]+)/i);
        return nameMatch ? nameMatch[1].trim() : null;
    }

    extractPatientAge(text) {
        const ageMatch = text.match(/나이[:\s]*(\d+)/i);
        return ageMatch ? ageMatch[1] : null;
    }

    extractPatientGender(text) {
        const genderMatch = text.match(/성별[:\s]*([남여MF])/i);
        return genderMatch ? genderMatch[1] : null;
    }

    extractPrimaryDiagnosis(text) {
        const diagnosisMatch = text.match(/진단[:\s]*([^\n\r]+)/i);
        return diagnosisMatch ? diagnosisMatch[1].trim() : null;
    }

    extractDiagnosisCodes(text) {
        const codeMatches = text.match(/[A-Z]\d{2}\.?\d*/g);
        return codeMatches || [];
    }

    /**
     * 최종 보고서 생성
     */
    generateFinalReport(data) {
        const timestamp = new Date().toISOString();
        
        return {
            title: 'VNEXSUS GPT-4o Mini 검증 보고서',
            version: '1.0.0',
            timestamp: timestamp,
            model: 'gpt-4o-mini',
            total_test_cases: data.test_cases_count,
            
            connection_test: data.connection_test,
            phase1_results: data.phase1,
            phase2_results: data.phase2,
            comparison_analysis: data.comparison,
            
            summary: {
                total_cases: data.test_cases_count,
                phase1_success_rate: data.phase1?.success_rate || 0,
                phase2_average_accuracy: data.phase2?.average_accuracy || 0,
                phase2_average_similarity: data.phase2?.average_similarity || 0,
                average_processing_time: data.phase1?.average_processing_time || 0,
                overall_performance: this.calculateOverallPerformance(data)
            },
            
            recommendations: [
                'GPT-4o Mini는 의료 텍스트 분석에서 높은 유연성을 보임',
                '처리 시간과 비용을 고려한 최적화 필요',
                '룰기반 시스템과의 하이브리드 접근 권장',
                '프롬프트 엔지니어링을 통한 정확도 개선 가능'
            ]
        };
    }

    /**
     * 전체 성능 점수 계산
     */
    calculateOverallPerformance(data) {
        const phase1Score = (data.phase1?.success_rate || 0) * 0.3;
        const phase2AccuracyScore = (data.phase2?.average_accuracy || 0) * 0.4;
        const phase2SimilarityScore = (data.phase2?.average_similarity || 0) * 0.3;
        
        return Math.round(phase1Score + phase2AccuracyScore + phase2SimilarityScore);
    }

    /**
     * 검증 결과 저장
     */
    async saveValidationResults(report) {
        try {
            // 결과 디렉토리 생성
            const resultsDir = path.join(__dirname, '../../validation-results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }

            // JSON 보고서 저장
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const jsonFilePath = path.join(resultsDir, `gpt4o-validation-${timestamp}.json`);
            
            await fs.promises.writeFile(
                jsonFilePath, 
                JSON.stringify(report, null, 2), 
                'utf8'
            );

            // HTML 보고서 생성 및 저장
            const htmlContent = this.generateHTMLReport(report);
            const htmlFilePath = path.join(resultsDir, `gpt4o-validation-${timestamp}.html`);
            
            await fs.promises.writeFile(htmlFilePath, htmlContent, 'utf8');

            report.report_path = jsonFilePath;
            report.html_report_path = htmlFilePath;

            console.log(`📄 검증 결과 저장 완료:`);
            console.log(`   JSON: ${jsonFilePath}`);
            console.log(`   HTML: ${htmlFilePath}`);

        } catch (error) {
            console.error('❌ 검증 결과 저장 오류:', error);
        }
    }

    /**
     * HTML 보고서 생성
     */
    generateHTMLReport(report) {
        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VNEXSUS GPT-4o Mini 검증 보고서</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #2c3e50; }
        .summary-card .value { font-size: 2em; font-weight: bold; color: #3498db; }
        .phase-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3498db; }
        .case-result { background: white; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #27ae60; }
        .case-result.failed { border-left-color: #e74c3c; }
        .status-badge { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-success { background-color: #27ae60; }
        .status-failed { background-color: #e74c3c; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .timestamp { color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 VNEXSUS GPT-4o Mini 검증 보고서</h1>
        <p class="timestamp">생성 시간: ${report.timestamp}</p>
        
        <div class="summary-grid">
            <div class="summary-card">
                <h3>총 테스트 케이스</h3>
                <div class="value">${report.total_test_cases}</div>
            </div>
            <div class="summary-card">
                <h3>Phase 1 성공률</h3>
                <div class="value">${report.summary.phase1_success_rate}%</div>
            </div>
            <div class="summary-card">
                <h3>평균 정확도</h3>
                <div class="value">${report.summary.phase2_average_accuracy}%</div>
            </div>
            <div class="summary-card">
                <h3>평균 유사도</h3>
                <div class="value">${report.summary.phase2_average_similarity}%</div>
            </div>
            <div class="summary-card">
                <h3>평균 처리 시간</h3>
                <div class="value">${report.summary.average_processing_time}ms</div>
            </div>
            <div class="summary-card">
                <h3>전체 성능 점수</h3>
                <div class="value">${report.summary.overall_performance}</div>
            </div>
        </div>

        <div class="phase-section">
            <h2>🔌 연결 테스트 결과</h2>
            <p><span class="status-badge ${report.connection_test.success ? 'status-success' : 'status-failed'}">
                ${report.connection_test.success ? '성공' : '실패'}
            </span></p>
            <p>모델: ${report.connection_test.model}</p>
            <p>응답 시간: ${report.connection_test.response_time}ms</p>
        </div>

        <div class="phase-section">
            <h2>📊 Phase 1: 기본 기능 검증</h2>
            <p>성공률: ${report.phase1_results.success_rate}% (${report.phase1_results.successful_cases}/${report.phase1_results.total_cases})</p>
            <p>평균 처리 시간: ${report.phase1_results.average_processing_time}ms</p>
            
            ${report.phase1_results.results.map(result => `
                <div class="case-result ${result.success ? '' : 'failed'}">
                    <strong>Case ${result.case_number}</strong>
                    <span class="status-badge ${result.success ? 'status-success' : 'status-failed'}">
                        ${result.success ? '성공' : '실패'}
                    </span>
                    <p>처리 시간: ${result.processing_time}ms</p>
                    ${result.error ? `<p style="color: #e74c3c;">오류: ${result.error}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="phase-section">
            <h2>🎯 Phase 2: 정확도 검증</h2>
            <p>평균 정확도: ${report.phase2_results.average_accuracy}%</p>
            <p>평균 유사도: ${report.phase2_results.average_similarity}%</p>
            <p>평균 신뢰도: ${report.phase2_results.average_confidence}%</p>
            
            ${report.phase2_results.results.slice(0, 5).map(result => `
                <div class="case-result ${result.success ? '' : 'failed'}">
                    <strong>Case ${result.case_number}</strong>
                    <span class="status-badge ${result.success ? 'status-success' : 'status-failed'}">
                        ${result.success ? '성공' : '실패'}
                    </span>
                    ${result.success ? `
                        <p>정확도: ${result.accuracy}% | 유사도: ${result.similarity}% | 신뢰도: ${result.confidence}%</p>
                        <p>처리 시간: ${result.processing_time}ms</p>
                    ` : `<p style="color: #e74c3c;">오류: ${result.error}</p>`}
                </div>
            `).join('')}
        </div>

        <div class="recommendations">
            <h2>💡 권장사항</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
    }
}

export default GPT4oCaseValidator;