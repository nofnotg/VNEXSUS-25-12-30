import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 포괄적 검증 및 자가 학습 시스템
 * - 비정형 의료문서에서 모든 날짜별 데이터 추출
 * - 룰기반과 AI기반 결과 비교 분석
 * - 중립적 객관적 데이터 정리
 * - MCP를 활용한 자가 학습 메커니즘
 */
class ComprehensiveValidationSystem {
    constructor() {
        this.baseURL = 'http://localhost:3030';
        this.caseSamplePath = path.join(__dirname, '../src/rag/case_sample');
        this.resultsPath = path.join(__dirname, '../temp/comprehensive-validation');
        this.learningPath = path.join(__dirname, '../temp/learning-data');
        
        // 결과 저장 디렉토리 생성
        this.ensureDirectories();
        
        // 학습 데이터 초기화
        this.learningData = {
            patterns: new Map(),
            improvements: [],
            ruleBasedPerformance: [],
            aiBasedPerformance: [],
            hybridResults: []
        };
    }
    
    ensureDirectories() {
        const dirs = [
            this.resultsPath,
            this.learningPath,
            path.join(this.resultsPath, 'rule-based'),
            path.join(this.resultsPath, 'ai-based'),
            path.join(this.resultsPath, 'hybrid'),
            path.join(this.resultsPath, 'comparisons'),
            path.join(this.learningPath, 'patterns'),
            path.join(this.learningPath, 'improvements')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    /**
     * 전체 검증 프로세스 실행
     */
    async runComprehensiveValidation() {
        console.log('🚀 포괄적 검증 및 자가 학습 시스템 시작');
        console.log('=' .repeat(60));
        
        const startTime = Date.now();
        const caseFiles = this.getCaseFiles();
        
        console.log(`📋 분석 대상: ${caseFiles.length}개 케이스`);
        
        const results = {
            timestamp: new Date().toISOString(),
            totalCases: caseFiles.length,
            ruleBasedResults: [],
            aiBasedResults: [],
            hybridResults: [],
            comparisons: [],
            learningInsights: {},
            recommendations: []
        };
        
        // 각 케이스별 분석
        for (const caseFile of caseFiles) {
            console.log(`\n🔍 ${caseFile.caseNumber} 분석 중...`);
            
            try {
                // 1. 룰기반 처리
                const ruleBasedResult = await this.processRuleBased(caseFile);
                results.ruleBasedResults.push(ruleBasedResult);
                
                // 2. AI기반 처리
                const aiBasedResult = await this.processAIBased(caseFile);
                results.aiBasedResults.push(aiBasedResult);
                
                // 3. 하이브리드 처리 (룰기반 + AI기반)
                const hybridResult = await this.processHybrid(ruleBasedResult, aiBasedResult, caseFile);
                results.hybridResults.push(hybridResult);
                
                // 4. 정답지와 비교 분석
                const comparison = await this.compareWithGroundTruth(hybridResult, caseFile);
                results.comparisons.push(comparison);
                
                // 5. 학습 데이터 수집
                await this.collectLearningData(comparison, caseFile);
                
                console.log(`   ✅ ${caseFile.caseNumber} 완료`);
                
            } catch (error) {
                console.error(`   ❌ ${caseFile.caseNumber} 실패:`, error.message);
                results.comparisons.push({
                    caseNumber: caseFile.caseNumber,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // 6. 학습 인사이트 생성
        results.learningInsights = await this.generateLearningInsights();
        
        // 7. 개선 권장사항 생성
        results.recommendations = await this.generateRecommendations(results);
        
        // 8. 결과 저장
        await this.saveResults(results);
        
        const totalTime = Date.now() - startTime;
        console.log(`\n🎉 전체 검증 완료 (${(totalTime / 1000).toFixed(2)}초)`);
        
        return results;
    }
    
    /**
     * 룰기반 처리 (기존 로직)
     */
    async processRuleBased(caseFile) {
        const startTime = Date.now();
        
        // 기존 룰기반 로직 호출
        const response = await fetch(`${this.baseURL}/api/enhanced-dna-validation/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: fs.readFileSync(caseFile.casePath, 'utf-8'),
                mode: 'rule-based'
            })
        });
        
        if (!response.ok) {
            throw new Error(`룰기반 처리 실패: ${response.statusText}`);
        }
        
        const result = await response.json();
        const processingTime = Date.now() - startTime;
        
        return {
            caseNumber: caseFile.caseNumber,
            method: 'rule-based',
            processingTime,
            result,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * AI기반 처리 (강화된 프롬프트)
     */
    async processAIBased(caseFile) {
        const startTime = Date.now();
        
        const enhancedPrompt = this.buildEnhancedPrompt();
        
        const response = await fetch(`${this.baseURL}/api/enhanced-dna-validation/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: fs.readFileSync(caseFile.casePath, 'utf-8'),
                mode: 'ai-enhanced',
                prompt: enhancedPrompt
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI기반 처리 실패: ${response.statusText}`);
        }
        
        const result = await response.json();
        const processingTime = Date.now() - startTime;
        
        return {
            caseNumber: caseFile.caseNumber,
            method: 'ai-based',
            processingTime,
            result,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 강화된 AI 프롬프트 생성
     */
    buildEnhancedPrompt() {
        return `
당신은 비정형 의료문서 전문 분석가입니다. 다음 원칙에 따라 분석해주세요:

## 핵심 원칙
1. **포괄적 데이터 추출**: 문서의 모든 날짜별 데이터를 누락 없이 추출
2. **중립적 객관성**: 판단하지 말고 객관적 사실만 정리
3. **문맥 이해**: 레이아웃과 구조를 고려한 의미 파악
4. **가중치 적용**: 의료적 중요도에 따른 데이터 우선순위
5. **연관성 분석**: 시간축 기반 이벤트 간 연관성 파악

## 추출 대상
- 모든 날짜 정보 (절대날짜, 상대날짜, 기간)
- 의료기관 정보 (병원명, 진료과, 의료진)
- 진단 정보 (질병명, ICD코드, 중증도)
- 치료 정보 (처방, 수술, 검사)
- 보험 정보 (가입일, 청구일, 지급내역)
- 환자 정보 (기본정보, 증상, 경과)

## 출력 형식
### 1. 환자 기본정보
### 2. 시간축 의료 이벤트 (날짜순 정렬)
### 3. 보험 관련 정보
### 4. 의료기관별 요약
### 5. 진단별 요약
### 6. 데이터 품질 평가

모든 데이터는 객관적 사실만 기록하고, 추측이나 판단은 배제하세요.
`;
    }
    
    /**
     * 하이브리드 처리 (룰기반 + AI기반 결합)
     */
    async processHybrid(ruleBasedResult, aiBasedResult, caseFile) {
        const startTime = Date.now();
        
        // 룰기반과 AI기반 결과를 결합하여 최적화된 결과 생성
        const hybridResult = {
            caseNumber: caseFile.caseNumber,
            method: 'hybrid',
            ruleBasedData: this.extractStructuredData(ruleBasedResult.result),
            aiBasedData: this.extractStructuredData(aiBasedResult.result),
            combinedData: {},
            confidence: {},
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
        
        // 데이터 결합 로직
        hybridResult.combinedData = this.combineResults(
            hybridResult.ruleBasedData,
            hybridResult.aiBasedData
        );
        
        // 신뢰도 계산
        hybridResult.confidence = this.calculateConfidence(
            hybridResult.ruleBasedData,
            hybridResult.aiBasedData,
            hybridResult.combinedData
        );
        
        return hybridResult;
    }
    
    /**
     * 구조화된 데이터 추출
     */
    extractStructuredData(rawResult) {
        // 원시 결과에서 구조화된 데이터 추출
        return {
            dates: this.extractDates(rawResult),
            hospitals: this.extractHospitals(rawResult),
            diagnoses: this.extractDiagnoses(rawResult),
            treatments: this.extractTreatments(rawResult),
            insurance: this.extractInsurance(rawResult),
            timeline: this.extractTimeline(rawResult)
        };
    }
    
    /**
     * 결과 결합 로직
     */
    combineResults(ruleBasedData, aiBasedData) {
        const combined = {
            dates: [...new Set([...ruleBasedData.dates, ...aiBasedData.dates])],
            hospitals: this.mergeHospitals(ruleBasedData.hospitals, aiBasedData.hospitals),
            diagnoses: this.mergeDiagnoses(ruleBasedData.diagnoses, aiBasedData.diagnoses),
            treatments: this.mergeTreatments(ruleBasedData.treatments, aiBasedData.treatments),
            insurance: this.mergeInsurance(ruleBasedData.insurance, aiBasedData.insurance),
            timeline: this.mergeTimeline(ruleBasedData.timeline, aiBasedData.timeline)
        };
        
        return combined;
    }
    
    /**
     * 정답지와 비교 분석
     */
    async compareWithGroundTruth(hybridResult, caseFile) {
        const groundTruth = fs.readFileSync(caseFile.reportPath, 'utf-8');
        const groundTruthData = this.parseGroundTruth(groundTruth);
        
        const comparison = {
            caseNumber: caseFile.caseNumber,
            timestamp: new Date().toISOString(),
            accuracy: {
                dates: this.calculateDateAccuracy(hybridResult.combinedData.dates, groundTruthData.dates),
                hospitals: this.calculateHospitalAccuracy(hybridResult.combinedData.hospitals, groundTruthData.hospitals),
                diagnoses: this.calculateDiagnosisAccuracy(hybridResult.combinedData.diagnoses, groundTruthData.diagnoses),
                overall: 0
            },
            coverage: {
                dates: this.calculateDateCoverage(hybridResult.combinedData.dates, groundTruthData.dates),
                hospitals: this.calculateHospitalCoverage(hybridResult.combinedData.hospitals, groundTruthData.hospitals),
                diagnoses: this.calculateDiagnosisCoverage(hybridResult.combinedData.diagnoses, groundTruthData.diagnoses),
                overall: 0
            },
            precision: {
                dates: this.calculateDatePrecision(hybridResult.combinedData.dates, groundTruthData.dates),
                hospitals: this.calculateHospitalPrecision(hybridResult.combinedData.hospitals, groundTruthData.hospitals),
                diagnoses: this.calculateDiagnosisPrecision(hybridResult.combinedData.diagnoses, groundTruthData.diagnoses),
                overall: 0
            },
            missingElements: this.findMissingElements(hybridResult.combinedData, groundTruthData),
            extraElements: this.findExtraElements(hybridResult.combinedData, groundTruthData),
            qualityScore: 0
        };
        
        // 전체 점수 계산
        comparison.accuracy.overall = this.calculateOverallScore(comparison.accuracy);
        comparison.coverage.overall = this.calculateOverallScore(comparison.coverage);
        comparison.precision.overall = this.calculateOverallScore(comparison.precision);
        comparison.qualityScore = (comparison.accuracy.overall + comparison.coverage.overall + comparison.precision.overall) / 3;
        
        return comparison;
    }
    
    /**
     * 학습 데이터 수집
     */
    async collectLearningData(comparison, caseFile) {
        // 패턴 학습
        const patterns = this.identifyPatterns(comparison, caseFile);
        patterns.forEach(pattern => {
            const key = pattern.type + '_' + pattern.context;
            if (!this.learningData.patterns.has(key)) {
                this.learningData.patterns.set(key, []);
            }
            this.learningData.patterns.get(key).push(pattern);
        });
        
        // 개선점 수집
        const improvements = this.identifyImprovements(comparison);
        this.learningData.improvements.push(...improvements);
        
        // 성능 데이터 수집
        this.learningData.ruleBasedPerformance.push({
            caseNumber: caseFile.caseNumber,
            score: comparison.qualityScore,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 학습 인사이트 생성
     */
    async generateLearningInsights() {
        const insights = {
            patternAnalysis: this.analyzePatterns(),
            performanceTrends: this.analyzePerformanceTrends(),
            commonFailures: this.analyzeCommonFailures(),
            improvementOpportunities: this.analyzeImprovementOpportunities(),
            adaptiveRecommendations: this.generateAdaptiveRecommendations()
        };
        
        // 학습 데이터 저장
        await this.saveLearningData(insights);
        
        return insights;
    }
    
    /**
     * 개선 권장사항 생성
     */
    async generateRecommendations(results) {
        const recommendations = {
            immediate: [],
            shortTerm: [],
            longTerm: [],
            architectural: []
        };
        
        // 즉시 개선 가능한 항목
        recommendations.immediate = this.generateImmediateRecommendations(results);
        
        // 단기 개선 항목
        recommendations.shortTerm = this.generateShortTermRecommendations(results);
        
        // 장기 개선 항목
        recommendations.longTerm = this.generateLongTermRecommendations(results);
        
        // 아키텍처 개선 항목
        recommendations.architectural = this.generateArchitecturalRecommendations(results);
        
        return recommendations;
    }
    
    /**
     * 결과 저장
     */
    async saveResults(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // 전체 결과 저장
        fs.writeFileSync(
            path.join(this.resultsPath, `comprehensive_validation_${timestamp}.json`),
            JSON.stringify(results, null, 2),
            'utf-8'
        );
        
        // 요약 보고서 생성
        const summary = this.generateSummaryReport(results);
        fs.writeFileSync(
            path.join(this.resultsPath, `validation_summary_${timestamp}.md`),
            summary,
            'utf-8'
        );
        
        console.log(`\n💾 결과 저장 완료:`);
        console.log(`   - 상세 결과: comprehensive_validation_${timestamp}.json`);
        console.log(`   - 요약 보고서: validation_summary_${timestamp}.md`);
    }
    
    /**
     * 케이스 파일 목록 가져오기
     */
    getCaseFiles() {
        const files = fs.readdirSync(this.caseSamplePath);
        const caseFiles = [];
        
        for (let i = 1; i <= 13; i++) {
            if (i === 4) continue; // Case4는 report 파일 없음
            
            const caseFile = `Case${i}.txt`;
            const reportFile = `Case${i}_report.txt`;
            
            const casePath = path.join(this.caseSamplePath, caseFile);
            const reportPath = path.join(this.caseSamplePath, reportFile);
            
            if (fs.existsSync(casePath) && fs.existsSync(reportPath)) {
                caseFiles.push({
                    caseNumber: `Case${i}`,
                    casePath,
                    reportPath
                });
            }
        }
        
        return caseFiles;
    }
    
    // 헬퍼 메서드들 (실제 구현 필요)
    extractDates(result) { return []; }
    extractHospitals(result) { return []; }
    extractDiagnoses(result) { return []; }
    extractTreatments(result) { return []; }
    extractInsurance(result) { return []; }
    extractTimeline(result) { return []; }
    
    mergeHospitals(rule, ai) { return [...rule, ...ai]; }
    mergeDiagnoses(rule, ai) { return [...rule, ...ai]; }
    mergeTreatments(rule, ai) { return [...rule, ...ai]; }
    mergeInsurance(rule, ai) { return [...rule, ...ai]; }
    mergeTimeline(rule, ai) { return [...rule, ...ai]; }
    
    calculateDateAccuracy(extracted, truth) { return 0.8; }
    calculateHospitalAccuracy(extracted, truth) { return 0.8; }
    calculateDiagnosisAccuracy(extracted, truth) { return 0.8; }
    
    calculateDateCoverage(extracted, truth) { return 0.8; }
    calculateHospitalCoverage(extracted, truth) { return 0.8; }
    calculateDiagnosisCoverage(extracted, truth) { return 0.8; }
    
    calculateDatePrecision(extracted, truth) { return 0.8; }
    calculateHospitalPrecision(extracted, truth) { return 0.8; }
    calculateDiagnosisPrecision(extracted, truth) { return 0.8; }
    
    calculateOverallScore(scores) {
        const values = Object.values(scores).filter(v => typeof v === 'number');
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    calculateConfidence(rule, ai, combined) { return { overall: 0.8 }; }
    parseGroundTruth(text) { return { dates: [], hospitals: [], diagnoses: [] }; }
    findMissingElements(extracted, truth) { return []; }
    findExtraElements(extracted, truth) { return []; }
    identifyPatterns(comparison, caseFile) { return []; }
    identifyImprovements(comparison) { return []; }
    analyzePatterns() { return {}; }
    analyzePerformanceTrends() { return {}; }
    analyzeCommonFailures() { return {}; }
    analyzeImprovementOpportunities() { return {}; }
    generateAdaptiveRecommendations() { return {}; }
    generateImmediateRecommendations(results) { return []; }
    generateShortTermRecommendations(results) { return []; }
    generateLongTermRecommendations(results) { return []; }
    generateArchitecturalRecommendations(results) { return []; }
    
    async saveLearningData(insights) {
        fs.writeFileSync(
            path.join(this.learningPath, `learning_insights_${Date.now()}.json`),
            JSON.stringify(insights, null, 2),
            'utf-8'
        );
    }
    
    generateSummaryReport(results) {
        return `
# 포괄적 검증 시스템 결과 보고서

## 개요
- 분석 일시: ${results.timestamp}
- 총 케이스: ${results.totalCases}개
- 성공률: ${results.comparisons.filter(c => !c.error).length}/${results.totalCases}

## 주요 결과
- 평균 품질 점수: ${results.comparisons.filter(c => c.qualityScore).reduce((sum, c) => sum + c.qualityScore, 0) / results.comparisons.filter(c => c.qualityScore).length || 0}

## 개선 권장사항
${results.recommendations.immediate.map(r => `- ${r}`).join('\n')}
`;
    }
}

// 실행 함수
async function runComprehensiveValidation() {
    try {
        const validator = new ComprehensiveValidationSystem();
        const results = await validator.runComprehensiveValidation();
        
        console.log('\n🎉 포괄적 검증 완료!');
        console.log(`📊 평균 품질 점수: ${results.comparisons.filter(c => c.qualityScore).reduce((sum, c) => sum + c.qualityScore, 0) / results.comparisons.filter(c => c.qualityScore).length || 0}`);
        
        return results;
    } catch (error) {
        console.error('💥 검증 실패:', error);
        throw error;
    }
}

// 모듈로 실행될 때
if (import.meta.url === `file://${process.argv[1]}`) {
    runComprehensiveValidation().catch(console.error);
}

export { ComprehensiveValidationSystem, runComprehensiveValidation };