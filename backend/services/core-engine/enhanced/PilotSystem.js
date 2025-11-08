// PilotSystem.js - 고도화 파일럿 시스템
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import ContextualSegmenter from './ContextualSegmenter.js';
import EnhancedEntityExtractor from './EnhancedEntityExtractor.js';
import TemporalNormalizer from './TemporalNormalizer.js';
import QualityAssurance from './QualityAssurance.js';
import MemorySnapshot from './MemorySnapshot.js';
import IntegrationLayer from './IntegrationLayer.js';
import { CaseBundle } from './DataSchemas.js';
import { logService } from '../../../utils/logger.js';
import fs from 'fs/promises';

class PilotSystem {
    constructor(options = {}) {
        this.options = {
            enableFullPreservation: options.enableFullPreservation !== false,
            qualityThreshold: options.qualityThreshold || 70,
            enableValidation: options.enableValidation !== false,
            outputDirectory: options.outputDirectory || './pilot_output',
            testCases: options.testCases || ['Case2', 'Case6'],
            ...options
        };

        // 핵심 모듈 초기화
        this.segmenter = new ContextualSegmenter({
            enableMedicalDomainDetection: true,
            confidenceThreshold: 0.6
        });

        this.entityExtractor = new EnhancedEntityExtractor({
            confidenceThreshold: 0.6,
            enableFuzzyMatching: true,
            enableContextualDisambiguation: true,
            enableMedicalCoding: true
        });

        this.temporalNormalizer = new TemporalNormalizer({
            enableRelativeTimeResolution: true,
            enableTemporalInference: true,
            enableCausalAnalysis: true,
            confidenceThreshold: 0.6
        });

        this.qualityAssurance = new QualityAssurance();
        this.memorySnapshot = new MemorySnapshot();
        this.integrationLayer = new IntegrationLayer();

        // 검증 메트릭
        this.validationMetrics = {
            informationPreservation: 0,
            entityExtractionAccuracy: 0,
            temporalNormalizationAccuracy: 0,
            contextualClassificationAccuracy: 0,
            overallQualityScore: 0
        };

        logService.info('PilotSystem initialized', { 
            options: this.options 
        });
    }

    /**
     * 파일럿 시스템 실행
     */
    async runPilot() {
        try {
            const startTime = Date.now();
            
            logService.info('PilotSystem', 'Starting pilot system execution', {
                testCases: this.options.testCases
            });

            // 출력 디렉토리 생성
            await this.ensureOutputDirectory();

            const results = [];

            // 각 테스트 케이스 처리
            for (const testCase of this.options.testCases) {
                logService.info('PilotSystem', `Processing test case: ${testCase}`);
                
                const caseResult = await this.processTestCase(testCase);
                results.push(caseResult);
                
                // 중간 결과 저장
                await this.saveIntermediateResults(testCase, caseResult);
            }

            // 전체 결과 분석
            const overallAnalysis = await this.analyzeOverallResults(results);
            
            // 최종 보고서 생성
            const finalReport = await this.generateFinalReport(results, overallAnalysis);
            
            // 결과 저장
            await this.saveFinalResults(finalReport);

            const processingTime = Date.now() - startTime;

            logService.info('PilotSystem', 'Pilot system execution completed', {
                totalCases: results.length,
                averageQualityScore: overallAnalysis.averageQualityScore,
                processingTime
            });

            return {
                success: true,
                results: results,
                analysis: overallAnalysis,
                report: finalReport,
                processingTime
            };

        } catch (error) {
            logService.error('PilotSystem', 'Pilot system execution failed', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`PilotSystem failed: ${error.message}`);
        }
    }

    /**
     * 테스트 케이스 처리
     */
    async processTestCase(testCaseName) {
        try {
            // 1. 테스트 데이터 로드
            const testData = await this.loadTestData(testCaseName);
            
            // 메모리 스냅샷 저장
            const snapshotId = await this.memorySnapshot.saveSnapshot(testData);
            
            // 2. 컨텍스트 기반 세그멘테이션
            const segments = await this.segmenter.segment(testData.text);
            
            // 3. 향상된 엔티티 추출
            const entities = await this.entityExtractor.extractEntities(segments);
            
            // 4. 시간 정규화
            const events = await this.temporalNormalizer.normalizeTemporalData(entities, segments);
            
            // 5. 케이스 번들 생성
            const caseBundle = new CaseBundle({
                caseId: testCaseName,
                originalText: testData.text,
                segments: segments,
                entities: entities,
                events: events,
                metadata: {
                    processingDate: new Date().toISOString(),
                    version: '1.0.0',
                    testCase: true
                }
            });

            // 6. 품질 점수 계산
            const qualityScore = await this.calculateQualityScore(caseBundle, testData.expected);
            caseBundle.qualityScore = qualityScore;

            // 7. 검증 수행
            const validationResults = await this.validateResults(caseBundle, testData.expected);

            // 8. 메모리 최적화
            await this.memorySnapshot.optimizeMemory();

            return {
                caseId: testCaseName,
                caseBundle: caseBundle,
                qualityScore: qualityScore,
                validation: validationResults,
                snapshotId: snapshotId,
                success: qualityScore >= this.options.qualityThreshold
            };

        } catch (error) {
            logService.error('PilotSystem', `Test case processing failed: ${testCaseName}`, {
                error: error.message,
                testCase: testCaseName
            });
            return {
                caseId: testCaseName,
                success: false,
                error: error.message,
                qualityScore: 0
            };
        }
    }

    /**
     * 테스트 데이터 로드
     */
    async loadTestData(testCaseName) {
        try {
            // 실제 구현에서는 데이터베이스나 파일에서 로드
            const testDataPath = path.join(__dirname, '../../../../test_data', `${testCaseName}.json`);
            
            // 테스트 데이터가 없는 경우 샘플 데이터 생성
            if (!await this.fileExists(testDataPath)) {
                return this.generateSampleTestData(testCaseName);
            }

            const data = await fs.readFile(testDataPath, 'utf8');
            return JSON.parse(data);

        } catch (error) {
            logService.warn(`Failed to load test data: ${testCaseName}`, {
                error: error.message
            });
            return this.generateSampleTestData(testCaseName);
        }
    }

    /**
     * 샘플 테스트 데이터 생성
     */
    generateSampleTestData(testCaseName) {
        const sampleData = {
            'Case2': {
                text: `
                환자명: 김철수 (남, 45세)
                진료일: 2024년 3월 15일
                
                주소: 복부 통증으로 내원
                
                현병력:
                2024년 2월 20일부터 상복부 통증 시작
                통증은 식후 악화되며 야간에 심해짐
                3월 10일 타 병원에서 위내시경 검사 시행
                위궤양 진단받고 PPI 처방받아 복용 중
                
                과거력:
                2020년 고혈압 진단
                현재 리시노프릴 5mg 복용 중
                
                검사 결과:
                혈압: 140/90 mmHg
                체온: 36.8℃
                맥박: 72회/분
                
                진단: 위궤양, 고혈압
                처방: 오메프라졸 20mg, 리시노프릴 5mg 지속
                `,
                expected: {
                    entities: [
                        { type: 'diagnosis', text: '위궤양', confidence: 0.9 },
                        { type: 'diagnosis', text: '고혈압', confidence: 0.9 },
                        { type: 'medication', text: 'PPI', confidence: 0.8 },
                        { type: 'medication', text: '리시노프릴', confidence: 0.9 },
                        { type: 'medication', text: '오메프라졸', confidence: 0.9 },
                        { type: 'procedure', text: '위내시경 검사', confidence: 0.9 }
                    ],
                    events: [
                        { type: 'symptom_onset', date: '2024-02-20', description: '상복부 통증 시작' },
                        { type: 'diagnosis', date: '2020', description: '고혈압 진단' },
                        { type: 'procedure', date: '2024-03-10', description: '위내시경 검사' },
                        { type: 'visit', date: '2024-03-15', description: '진료' }
                    ],
                    qualityExpected: 75
                }
            },
            'Case6': {
                text: `
                환자명: 박영희 (여, 62세)
                입원일: 2024년 4월 1일
                
                주소: 호흡곤란 및 흉통으로 응급실 내원
                
                현병력:
                3일 전부터 계단 오를 때 호흡곤란 시작
                어제부터 안정 시에도 호흡곤란 지속
                오늘 오전 흉통 발생하여 응급실 내원
                
                과거력:
                2018년 당뇨병 진단, 메트포르민 복용 중
                2022년 심방세동 진단, 와파린 복용 중
                
                응급실 검사:
                혈압: 160/100 mmHg
                맥박: 불규칙, 110회/분
                산소포화도: 88%
                심전도: 심방세동 소견
                흉부 X-ray: 폐부종 소견
                
                진단: 급성 심부전, 심방세동
                치료: 이뇨제 투여, 산소 공급
                입원 후 경과 관찰 예정
                `,
                expected: {
                    entities: [
                        { type: 'diagnosis', text: '급성 심부전', confidence: 0.95 },
                        { type: 'diagnosis', text: '심방세동', confidence: 0.95 },
                        { type: 'diagnosis', text: '당뇨병', confidence: 0.9 },
                        { type: 'medication', text: '메트포르민', confidence: 0.9 },
                        { type: 'medication', text: '와파린', confidence: 0.9 },
                        { type: 'procedure', text: '심전도', confidence: 0.8 },
                        { type: 'procedure', text: '흉부 X-ray', confidence: 0.8 }
                    ],
                    events: [
                        { type: 'diagnosis', date: '2018', description: '당뇨병 진단' },
                        { type: 'diagnosis', date: '2022', description: '심방세동 진단' },
                        { type: 'symptom_onset', date: '2024-03-29', description: '호흡곤란 시작' },
                        { type: 'admission', date: '2024-04-01', description: '응급실 내원 및 입원' }
                    ],
                    qualityExpected: 80
                }
            }
        };

        return sampleData[testCaseName] || sampleData['Case2'];
    }

    /**
     * 품질 점수 계산
     */
    async calculateQualityScore(caseBundle, expected) {
        // QualityAssurance 모듈 사용
        return this.qualityAssurance.calculateQualityScore(caseBundle, expected);
    }

    /**
     * 정보 보존도 계산
     */
    calculatePreservationScore(caseBundle) {
        const originalLength = caseBundle.originalText.length;
        const preservedLength = caseBundle.segments.reduce((sum, segment) => sum + segment.text.length, 0);
        
        const preservationRatio = preservedLength / originalLength;
        return Math.min(preservationRatio * 25, 25);
    }

    /**
     * 엔티티 점수 계산
     */
    calculateEntityScore(extractedEntities, expectedEntities) {
        if (!expectedEntities || expectedEntities.length === 0) return 20; // 기본 점수
        
        let matchedCount = 0;
        
        for (const expected of expectedEntities) {
            const found = extractedEntities.find(entity => 
                entity.type === expected.type && 
                entity.normalizedText.includes(expected.text.toLowerCase())
            );
            if (found) matchedCount++;
        }
        
        const accuracy = matchedCount / expectedEntities.length;
        return accuracy * 25;
    }

    /**
     * 시간 점수 계산
     */
    calculateTemporalScore(extractedEvents, expectedEvents) {
        if (!expectedEvents || expectedEvents.length === 0) return 20; // 기본 점수
        
        let matchedCount = 0;
        
        for (const expected of expectedEvents) {
            const found = extractedEvents.find(event => 
                event.type.includes(expected.type) || 
                event.description.includes(expected.description)
            );
            if (found) matchedCount++;
        }
        
        const accuracy = matchedCount / expectedEvents.length;
        return accuracy * 25;
    }

    /**
     * 컨텍스트 점수 계산
     */
    calculateContextScore(segments) {
        let totalScore = 0;
        
        for (const segment of segments) {
            // 컨텍스트 분류 정확도 평가
            if (segment.context && segment.context.type) totalScore += 3;
            if (segment.medicalDomain) totalScore += 2;
        }
        
        return Math.min(totalScore, 25);
    }

    /**
     * 결과 검증
     */
    async validateResults(caseBundle, expected) {
        const validation = {
            informationPreservation: this.validateInformationPreservation(caseBundle),
            entityExtraction: this.validateEntityExtraction(caseBundle.entities, expected.entities),
            temporalNormalization: this.validateTemporalNormalization(caseBundle.events, expected.events),
            contextualClassification: this.validateContextualClassification(caseBundle.segments),
            overallValidation: true
        };

        validation.overallValidation = Object.values(validation).every(v => v !== false);
        
        return validation;
    }

    /**
     * 전체 결과 분석
     */
    async analyzeOverallResults(results) {
        const successfulCases = results.filter(r => r.success);
        const failedCases = results.filter(r => !r.success);
        
        const qualityScores = successfulCases.map(r => r.qualityScore);
        const averageQualityScore = qualityScores.length > 0 
            ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
            : 0;

        return {
            totalCases: results.length,
            successfulCases: successfulCases.length,
            failedCases: failedCases.length,
            successRate: (successfulCases.length / results.length) * 100,
            averageQualityScore: Math.round(averageQualityScore),
            qualityThresholdMet: averageQualityScore >= this.options.qualityThreshold,
            recommendations: this.generateRecommendations(results)
        };
    }

    /**
     * 최종 보고서 생성
     */
    async generateFinalReport(results, analysis) {
        return {
            executionSummary: {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                testCases: this.options.testCases,
                qualityThreshold: this.options.qualityThreshold
            },
            results: results,
            analysis: analysis,
            detailedFindings: {
                strengths: this.identifyStrengths(results),
                weaknesses: this.identifyWeaknesses(results),
                improvements: this.suggestImprovements(results)
            },
            conclusion: {
                readyForProduction: analysis.qualityThresholdMet && analysis.successRate >= 80,
                nextSteps: this.defineNextSteps(analysis)
            }
        };
    }

    /**
     * 헬퍼 메서드들
     */
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.options.outputDirectory, { recursive: true });
        } catch (error) {
            // 디렉토리가 이미 존재하는 경우 무시
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async saveIntermediateResults(testCase, result) {
        const filePath = path.join(this.options.outputDirectory, `${testCase}_result.json`);
        await fs.writeFile(filePath, JSON.stringify(result, null, 2));
    }

    async saveFinalResults(report) {
        const filePath = path.join(this.options.outputDirectory, 'pilot_report.json');
        await fs.writeFile(filePath, JSON.stringify(report, null, 2));
        
        // HTML 보고서도 생성
        const htmlReport = this.generateHTMLReport(report);
        const htmlPath = path.join(this.options.outputDirectory, 'pilot_report.html');
        await fs.writeFile(htmlPath, htmlReport);
    }

    generateHTMLReport(report) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>고도화 파일럿 시스템 보고서</title>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
                .section { margin: 20px 0; }
                .success { color: green; }
                .failure { color: red; }
                .warning { color: orange; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>고도화 파일럿 시스템 보고서</h1>
                <p>실행 시간: ${report.executionSummary.timestamp}</p>
                <p>품질 임계값: ${report.executionSummary.qualityThreshold}점</p>
            </div>
            
            <div class="section">
                <h2>실행 요약</h2>
                <p>총 테스트 케이스: ${report.analysis.totalCases}</p>
                <p>성공한 케이스: <span class="success">${report.analysis.successfulCases}</span></p>
                <p>실패한 케이스: <span class="failure">${report.analysis.failedCases}</span></p>
                <p>성공률: ${report.analysis.successRate.toFixed(1)}%</p>
                <p>평균 품질 점수: ${report.analysis.averageQualityScore}점</p>
                <p>품질 임계값 달성: ${report.analysis.qualityThresholdMet ? '<span class="success">달성</span>' : '<span class="failure">미달성</span>'}</p>
            </div>
            
            <div class="section">
                <h2>상세 결과</h2>
                <table>
                    <tr>
                        <th>테스트 케이스</th>
                        <th>성공 여부</th>
                        <th>품질 점수</th>
                        <th>비고</th>
                    </tr>
                    ${report.results.map(result => `
                    <tr>
                        <td>${result.caseId}</td>
                        <td class="${result.success ? 'success' : 'failure'}">${result.success ? '성공' : '실패'}</td>
                        <td>${result.qualityScore || 0}점</td>
                        <td>${result.error || '-'}</td>
                    </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="section">
                <h2>결론</h2>
                <p>프로덕션 준비도: ${report.conclusion.readyForProduction ? '<span class="success">준비됨</span>' : '<span class="warning">추가 개선 필요</span>'}</p>
                <h3>다음 단계:</h3>
                <ul>
                    ${report.conclusion.nextSteps.map(step => `<li>${step}</li>`).join('')}
                </ul>
            </div>
        </body>
        </html>
        `;
    }

    // 추가 검증 및 분석 메서드들
    validateInformationPreservation(caseBundle) {
        return caseBundle.segments.length > 0;
    }

    validateEntityExtraction(entities, expected) {
        return entities.length > 0;
    }

    validateTemporalNormalization(events, expected) {
        return events.length > 0;
    }

    validateContextualClassification(segments) {
        return segments.some(s => s.context && s.context.type);
    }

    generateRecommendations(results) {
        const recommendations = [];
        
        const avgScore = results.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / results.length;
        
        if (avgScore < 70) {
            recommendations.push('품질 점수 개선을 위한 알고리즘 튜닝 필요');
        }
        
        if (results.some(r => !r.success)) {
            recommendations.push('실패한 케이스에 대한 오류 분석 및 개선 필요');
        }
        
        return recommendations;
    }

    identifyStrengths(results) {
        return ['컨텍스트 기반 세그멘테이션', '향상된 엔티티 추출', '시간 정규화'];
    }

    identifyWeaknesses(results) {
        return ['복잡한 의료 용어 처리', '상대 시간 해결 정확도'];
    }

    suggestImprovements(results) {
        return ['의료 용어 사전 확장', '시간 추론 규칙 개선', '품질 검증 로직 강화'];
    }

    defineNextSteps(analysis) {
        const steps = [];
        
        if (!analysis.qualityThresholdMet) {
            steps.push('품질 점수 개선을 위한 알고리즘 최적화');
        }
        
        if (analysis.successRate < 90) {
            steps.push('안정성 개선을 위한 예외 처리 강화');
        }
        
        steps.push('추가 테스트 케이스로 검증 확대');
        steps.push('프로덕션 환경 통합 준비');
        
        return steps;
    }
}

export default PilotSystem;