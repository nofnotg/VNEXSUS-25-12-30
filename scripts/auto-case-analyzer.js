import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutoCaseAnalyzer {
    constructor() {
        this.baseURL = 'http://localhost:3031';
        this.caseSamplePath = path.join(__dirname, '../src/rag/case_sample');
        this.resultsPath = path.join(__dirname, '../temp/analysis-results');
        this.analysisResults = [];
        
        // 결과 저장 디렉토리 생성
        if (!fs.existsSync(this.resultsPath)) {
            fs.mkdirSync(this.resultsPath, { recursive: true });
        }
    }

    async analyzeCases() {
        console.log('🚀 자동 케이스 분석 시작...');
        
        // 케이스 파일 목록 가져오기 (Case4 제외 - report 파일 없음)
        const caseFiles = this.getCaseFiles();
        console.log(`📁 분석 대상: ${caseFiles.length}개 케이스`);
        
        for (const caseInfo of caseFiles) {
            console.log(`\n🔍 ${caseInfo.caseNumber} 분석 시작...`);
            
            try {
                // 1. Case 파일 내용 읽기
                const caseContent = fs.readFileSync(caseInfo.casePath, 'utf8');
                
                // 2. Case_report 파일 내용 읽기
                const expectedReport = fs.readFileSync(caseInfo.reportPath, 'utf8');
                
                // 3. AI 처리 실행
                const aiResult = await this.processWithAI(caseContent);
                
                // 4. 결과 비교 및 분석
                const comparison = this.compareResults(aiResult, expectedReport, caseInfo.caseNumber);
                
                // 5. 개별 결과 저장
                this.saveIndividualResult(caseInfo.caseNumber, {
                    caseContent: caseContent.substring(0, 500) + '...',
                    aiResult,
                    expectedReport: expectedReport.substring(0, 500) + '...',
                    comparison
                });
                
                this.analysisResults.push({
                    caseNumber: caseInfo.caseNumber,
                    ...comparison
                });
                
                console.log(`✅ ${caseInfo.caseNumber} 분석 완료`);
                
                // API 호출 간격 조절
                await this.delay(2000);
                
            } catch (error) {
                console.error(`❌ ${caseInfo.caseNumber} 분석 실패:`, error.message);
                this.analysisResults.push({
                    caseNumber: caseInfo.caseNumber,
                    error: error.message
                });
            }
        }
        
        // 종합 분석 수행
        await this.performComprehensiveAnalysis();
        
        console.log('🏁 자동 케이스 분석 완료!');
    }

    getCaseFiles() {
        const files = fs.readdirSync(this.caseSamplePath);
        const caseFiles = [];
        
        // Case1~Case12 중 report 파일이 있는 것만 (Case4 제외)
        for (let i = 1; i <= 12; i++) {
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

    async processWithAI(caseContent) {
        console.log('🤖 AI 처리 요청...');
        
        const response = await fetch(`${this.baseURL}/api/dev/studio/test-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                extractedText: caseContent,
                systemPrompt: await this.getSystemPrompt(),
                userPrompt: await this.getUserPrompt(caseContent)
            })
        });

        if (!response.ok) {
            throw new Error(`AI 처리 실패: ${response.status}`);
        }

        const result = await response.json();
        return result.success ? result.result.reportText : null;
    }

    async getSystemPrompt() {
        const response = await fetch(`${this.baseURL}/api/dev/studio/prompts`);
        const data = await response.json();
        return data.prompts.system;
    }

    async getUserPrompt(extractedText) {
        const response = await fetch(`${this.baseURL}/api/dev/studio/prompts`);
        const data = await response.json();
        return data.prompts.user.replace('{{EXTRACTED_TEXT}}', extractedText);
    }

    compareResults(aiResult, expectedReport, caseNumber) {
        console.log(`📊 ${caseNumber} 결과 비교 분석...`);
        
        const analysis = {
            caseNumber,
            timestamp: new Date().toISOString()
        };

        // 1. 기본 구조 비교
        analysis.structureComparison = this.analyzeStructure(aiResult, expectedReport);
        
        // 2. 시간축 데이터 비교
        analysis.timelineComparison = this.analyzeTimeline(aiResult, expectedReport);
        
        // 3. 보험 정보 비교
        analysis.insuranceComparison = this.analyzeInsurance(aiResult, expectedReport);
        
        // 4. 병원/통원 패턴 비교
        analysis.hospitalComparison = this.analyzeHospitalPatterns(aiResult, expectedReport);
        
        // 5. 핵심 누락 사항 식별
        analysis.missingElements = this.identifyMissingElements(aiResult, expectedReport);
        
        // 6. 전체 품질 점수 (1-10)
        analysis.qualityScore = this.calculateQualityScore(analysis);
        
        return analysis;
    }

    analyzeStructure(aiResult, expectedReport) {
        const aiSections = this.extractSections(aiResult);
        const expectedSections = this.extractSections(expectedReport);
        
        return {
            aiSections: aiSections.length,
            expectedSections: expectedSections.length,
            hasBasicInfo: aiResult.includes('피보험자') && aiResult.includes('생년월일'),
            hasInsuranceInfo: aiResult.includes('가입보험사'),
            hasTimelineEvents: aiResult.includes('[') && aiResult.includes(']'),
            structureMatch: aiSections.length >= expectedSections.length * 0.7
        };
    }

    analyzeTimeline(aiResult, expectedReport) {
        // 연도 추출
        const aiYears = this.extractYears(aiResult);
        const expectedYears = this.extractYears(expectedReport);
        
        // 날짜 추출
        const aiDates = this.extractDates(aiResult);
        const expectedDates = this.extractDates(expectedReport);
        
        return {
            aiYearRange: aiYears.length > 0 ? `${Math.min(...aiYears)}-${Math.max(...aiYears)}` : 'none',
            expectedYearRange: expectedYears.length > 0 ? `${Math.min(...expectedYears)}-${Math.max(...expectedYears)}` : 'none',
            aiDateCount: aiDates.length,
            expectedDateCount: expectedDates.length,
            yearsCovered: aiYears.length,
            expectedYearsCovered: expectedYears.length,
            timelineCoverage: aiYears.length >= expectedYears.length * 0.8
        };
    }

    analyzeInsurance(aiResult, expectedReport) {
        // 보험사 추출
        const aiInsurers = this.extractInsurers(aiResult);
        const expectedInsurers = this.extractInsurers(expectedReport);
        
        return {
            aiInsurers,
            expectedInsurers,
            insurerMatch: aiInsurers.length >= expectedInsurers.length,
            hasJoinDates: aiResult.includes('가입일') && /\d{4}-\d{2}-\d{2}/.test(aiResult),
            hasPeriodClassification: aiResult.includes('[') && (aiResult.includes('년 이내') || aiResult.includes('개월 이내'))
        };
    }

    analyzeHospitalPatterns(aiResult, expectedReport) {
        // 병원명 추출
        const aiHospitals = this.extractHospitals(aiResult);
        const expectedHospitals = this.extractHospitals(expectedReport);
        
        // 통원 횟수 패턴 확인
        const aiVisitCounts = (aiResult.match(/\d+회/g) || []).length;
        const expectedVisitCounts = (expectedReport.match(/\d+회/g) || []).length;
        
        return {
            aiHospitals,
            expectedHospitals,
            hospitalMatch: aiHospitals.length >= expectedHospitals.length * 0.7,
            hasVisitCounts: aiVisitCounts > 0,
            visitCountMatch: aiVisitCounts >= expectedVisitCounts * 0.5
        };
    }

    identifyMissingElements(aiResult, expectedReport) {
        const missing = [];
        
        // 기고지사항 확인
        if (expectedReport.includes('기고지사항') && !aiResult.includes('기고지사항')) {
            missing.push('기고지사항 표시 누락');
        }
        
        // 5년 이내, 1년 이내 분류 확인
        if (expectedReport.includes('년 이내') && !aiResult.includes('년 이내')) {
            missing.push('보험 가입 기간 분류 누락');
        }
        
        // 통원 기간 통계 확인
        if (expectedReport.includes('~') && expectedReport.includes('회') && 
            !aiResult.includes('~') && !aiResult.includes('회')) {
            missing.push('통원 기간 및 횟수 통계 누락');
        }
        
        return missing;
    }

    calculateQualityScore(analysis) {
        let score = 0;
        let maxScore = 0;
        
        // 구조 점수 (2점)
        maxScore += 2;
        if (analysis.structureComparison.hasBasicInfo) score += 0.5;
        if (analysis.structureComparison.hasInsuranceInfo) score += 0.5;
        if (analysis.structureComparison.hasTimelineEvents) score += 0.5;
        if (analysis.structureComparison.structureMatch) score += 0.5;
        
        // 시간축 점수 (3점)
        maxScore += 3;
        if (analysis.timelineComparison.timelineCoverage) score += 1.5;
        if (analysis.timelineComparison.aiDateCount >= analysis.timelineComparison.expectedDateCount * 0.5) score += 1.5;
        
        // 보험 정보 점수 (2점)
        maxScore += 2;
        if (analysis.insuranceComparison.insurerMatch) score += 1;
        if (analysis.insuranceComparison.hasPeriodClassification) score += 1;
        
        // 병원 패턴 점수 (2점)
        maxScore += 2;
        if (analysis.hospitalComparison.hospitalMatch) score += 1;
        if (analysis.hospitalComparison.hasVisitCounts) score += 1;
        
        // 누락 요소 감점 (1점)
        maxScore += 1;
        score += Math.max(0, 1 - analysis.missingElements.length * 0.2);
        
        return Math.round((score / maxScore) * 10);
    }

    // 유틸리티 함수들
    extractSections(text) {
        return text.split('\n').filter(line => line.trim().startsWith('#') || line.includes('[') && line.includes(']'));
    }

    extractYears(text) {
        const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
        return yearMatches ? [...new Set(yearMatches.map(y => parseInt(y)))].sort() : [];
    }

    extractDates(text) {
        const dateMatches = text.match(/\d{4}[.-]\d{2}[.-]\d{2}/g);
        return dateMatches ? [...new Set(dateMatches)] : [];
    }

    extractInsurers(text) {
        const insurerPatterns = ['AXA', '삼성화재', '흥국화재', 'MG손해보험', '현대해상', '동부화재', 'KB손해보험'];
        return insurerPatterns.filter(insurer => text.includes(insurer));
    }

    extractHospitals(text) {
        const hospitalMatches = text.match(/[가-힣]+(?:병원|의원|클리닉|센터)/g);
        return hospitalMatches ? [...new Set(hospitalMatches)] : [];
    }

    saveIndividualResult(caseNumber, data) {
        const filePath = path.join(this.resultsPath, `${caseNumber}_analysis.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async performComprehensiveAnalysis() {
        console.log('\n📈 종합 분석 수행 중...');
        
        const comprehensiveAnalysis = {
            timestamp: new Date().toISOString(),
            totalCases: this.analysisResults.length,
            overview: this.generateOverview(),
            patterns: this.identifyPatterns(),
            improvements: this.suggestImprovements(),
            priorities: this.rankPriorities(),
            technicalInsights: this.generateTechnicalInsights()
        };
        
        // 종합 분석 결과 저장
        const analysisPath = path.join(this.resultsPath, 'comprehensive_analysis.json');
        fs.writeFileSync(analysisPath, JSON.stringify(comprehensiveAnalysis, null, 2), 'utf8');
        
        // 요약 보고서 생성
        this.generateSummaryReport(comprehensiveAnalysis);
        
        console.log('📊 종합 분석 완료!');
        console.log(`결과 저장 위치: ${this.resultsPath}`);
    }

    generateOverview() {
        const validResults = this.analysisResults.filter(r => !r.error);
        const avgQuality = validResults.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / validResults.length;
        
        return {
            successfulAnalyses: validResults.length,
            failedAnalyses: this.analysisResults.filter(r => r.error).length,
            averageQualityScore: Math.round(avgQuality * 10) / 10,
            qualityDistribution: this.getQualityDistribution(validResults)
        };
    }

    identifyPatterns() {
        const validResults = this.analysisResults.filter(r => !r.error);
        
        const patterns = {
            commonIssues: [],
            timelineIssues: [],
            insuranceIssues: [],
            structuralIssues: []
        };
        
        // 공통 문제점 식별
        let structureIssues = 0;
        let timelineIssues = 0;
        let insuranceIssues = 0;
        
        validResults.forEach(result => {
            if (!result.structureComparison?.structureMatch) structureIssues++;
            if (!result.timelineComparison?.timelineCoverage) timelineIssues++;
            if (!result.insuranceComparison?.insurerMatch) insuranceIssues++;
        });
        
        if (structureIssues > validResults.length * 0.5) {
            patterns.commonIssues.push('보고서 구조 문제 (50% 이상 케이스)');
        }
        if (timelineIssues > validResults.length * 0.5) {
            patterns.commonIssues.push('시간축 커버리지 부족 (50% 이상 케이스)');
        }
        if (insuranceIssues > validResults.length * 0.5) {
            patterns.commonIssues.push('보험사 정보 추출 문제 (50% 이상 케이스)');
        }
        
        return patterns;
    }

    suggestImprovements() {
        return [
            {
                category: "프롬프트 개선",
                priority: "high",
                suggestions: [
                    "2000년대 초반 데이터 강화된 검색 키워드 추가",
                    "병원별 통원 횟수 집계 로직 강화",
                    "기고지사항 식별 패턴 개선"
                ]
            },
            {
                category: "데이터 전처리",
                priority: "medium", 
                suggestions: [
                    "의료기관명 정규화 단계 추가",
                    "날짜 형식 통일화 전처리",
                    "보험사명 변형 대응 로직"
                ]
            },
            {
                category: "아키텍처 개선",
                priority: "high",
                suggestions: [
                    "다단계 추출 파이프라인 구현",
                    "연도별 데이터 분리 처리",
                    "보험 기간 계산 전용 모듈"
                ]
            }
        ];
    }

    rankPriorities() {
        const validResults = this.analysisResults.filter(r => !r.error);
        const issues = {};
        
        validResults.forEach(result => {
            result.missingElements?.forEach(missing => {
                issues[missing] = (issues[missing] || 0) + 1;
            });
        });
        
        return Object.entries(issues)
            .sort(([,a], [,b]) => b - a)
            .map(([issue, count]) => ({
                issue,
                frequency: count,
                percentage: Math.round((count / validResults.length) * 100)
            }));
    }

    generateTechnicalInsights() {
        return {
            promptEngineering: [
                "현재 프롬프트는 2000년대 데이터 추출에 한계가 있음",
                "의료기관별 패턴 인식 로직 개선 필요",
                "보험 기간 분류 정확도 향상 요구"
            ],
            dataProcessing: [
                "OCR 후 전처리 단계에서 연도별 세그멘테이션 고려",
                "의료 약어 및 기관명 정규화 데이터베이스 필요",
                "날짜 추출 및 검증 로직 강화"
            ],
            architectureRecommendations: [
                "단일 프롬프트 대신 다단계 처리 파이프라인",
                "연도별/기관별 전문 추출기 개발",
                "결과 검증 및 보정 메커니즘 추가"
            ]
        };
    }

    getQualityDistribution(results) {
        const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
        
        results.forEach(result => {
            const score = result.qualityScore || 0;
            if (score >= 8) distribution.excellent++;
            else if (score >= 6) distribution.good++;
            else if (score >= 4) distribution.fair++;
            else distribution.poor++;
        });
        
        return distribution;
    }

    generateSummaryReport(analysis) {
        const reportPath = path.join(this.resultsPath, 'ANALYSIS_SUMMARY.md');
        
        const report = `
# 🧬 MediAI DNA 시퀀싱 파이프라인 종합 분석 보고서

## 📊 분석 개요
- **분석 일시**: ${new Date().toLocaleString('ko-KR')}
- **분석 케이스**: ${analysis.totalCases}개
- **성공률**: ${analysis.overview.successfulAnalyses}/${analysis.totalCases} (${Math.round((analysis.overview.successfulAnalyses/analysis.totalCases)*100)}%)
- **평균 품질점수**: ${analysis.overview.averageQualityScore}/10

## 🎯 품질 분포
- **우수 (8-10점)**: ${analysis.overview.qualityDistribution.excellent}개
- **양호 (6-7점)**: ${analysis.overview.qualityDistribution.good}개
- **보통 (4-5점)**: ${analysis.overview.qualityDistribution.fair}개
- **미흡 (0-3점)**: ${analysis.overview.qualityDistribution.poor}개

## 🔍 주요 발견사항
${analysis.patterns.commonIssues.map(issue => `- ${issue}`).join('\n')}

## 📈 우선 개선사항
${analysis.priorities.slice(0, 5).map((p, i) => `${i+1}. ${p.issue} (${p.percentage}% 케이스에서 발생)`).join('\n')}

## 💡 기술적 인사이트
### 프롬프트 엔지니어링
${analysis.technicalInsights.promptEngineering.map(insight => `- ${insight}`).join('\n')}

### 데이터 처리
${analysis.technicalInsights.dataProcessing.map(insight => `- ${insight}`).join('\n')}

### 아키텍처 권장사항
${analysis.technicalInsights.architectureRecommendations.map(insight => `- ${insight}`).join('\n')}

## 🚀 개선 로드맵
${analysis.improvements.map(imp => `
### ${imp.category} (우선순위: ${imp.priority})
${imp.suggestions.map(s => `- ${s}`).join('\n')}
`).join('\n')}

---
*이 보고서는 자동 생성되었습니다.*
        `;
        
        fs.writeFileSync(reportPath, report, 'utf8');
        console.log(`📄 요약 보고서 생성: ${reportPath}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 실행
const analyzer = new AutoCaseAnalyzer();
analyzer.analyzeCases().catch(console.error); 