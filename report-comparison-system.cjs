const fs = require('fs');
const path = require('path');

/**
 * 보고서 비교 및 품질 평가 시스템
 * 생성된 보고서와 기준 보고서(caseX_report.txt)를 비교하여 품질 점수를 산출
 */
class ReportComparisonSystem {
    constructor() {
        this.fixturesPath = path.join(__dirname, 'documents', 'fixtures');
        this.resultsPath = path.join(__dirname, 'results');
        this.reportsPath = path.join(__dirname, 'reports');
        
        // 결과 디렉토리 생성
        if (!fs.existsSync(this.resultsPath)) {
            fs.mkdirSync(this.resultsPath, { recursive: true });
        }
    }

    /**
     * 케이스 파일 목록 가져오기
     */
    getCaseFiles() {
        const caseFiles = [];
        
        for (let i = 1; i <= 12; i++) {
            const caseFile = `Case${i}_fulltext.txt`;
            const reportFile = `Case${i}_report.txt`;
            
            const casePath = path.join(this.fixturesPath, caseFile);
            const reportPath = path.join(this.fixturesPath, reportFile);
            
            if (fs.existsSync(casePath) && fs.existsSync(reportPath)) {
                caseFiles.push({
                    caseNumber: `Case${i}`,
                    casePath,
                    reportPath,
                    id: i
                });
            }
        }
        
        return caseFiles;
    }

    /**
     * 텍스트 유사도 계산 (Jaccard 유사도 기반)
     */
    calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * 핵심 키워드 추출 및 매칭
     */
    extractKeywords(text) {
        const medicalKeywords = [
            '진단', '치료', '병원', '의사', '환자', '증상', '검사', '수술', '입원', '통원',
            '보험', '청구', '사고', '질환', '질병', '처방', '약물', '치료비', '진료비'
        ];
        
        const keywords = [];
        const lowerText = text.toLowerCase();
        
        medicalKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        return keywords;
    }

    /**
     * 구조적 요소 분석
     */
    analyzeStructure(text) {
        const structure = {
            hasContractInfo: /계약|보험|피보험자/.test(text),
            hasClaimInfo: /청구|사고|진단/.test(text),
            hasInvestigationInfo: /조사|내용|사항/.test(text),
            hasMedicalHistory: /병력|과거력|기왕력/.test(text),
            hasTimeline: /\d{4}[.-]\d{1,2}[.-]\d{1,2}/.test(text),
            hasHospitalInfo: /병원|의원|클리닉/.test(text),
            hasDiagnosis: /진단|질환|질병/.test(text),
            hasTreatment: /치료|처방|수술/.test(text)
        };
        
        const completeness = Object.values(structure).filter(Boolean).length / Object.keys(structure).length;
        
        return {
            elements: structure,
            completeness: completeness * 100
        };
    }

    /**
     * 날짜 정보 추출 및 분석
     */
    analyzeDateInfo(text) {
        const datePattern = /\d{4}[.-]\d{1,2}[.-]\d{1,2}/g;
        const dates = text.match(datePattern) || [];
        
        return {
            dateCount: dates.length,
            dates: dates,
            hasChronology: dates.length > 1
        };
    }

    /**
     * 의료 전문성 평가
     */
    evaluateMedicalProfessionalism(text) {
        const medicalTerms = [
            'ICD', '진단코드', '질환명', '병명', '증상', '징후', '검사', '진료',
            '처방', '투약', '수술', '시술', '입원', '외래', '응급실'
        ];
        
        let termCount = 0;
        medicalTerms.forEach(term => {
            if (text.includes(term)) termCount++;
        });
        
        return (termCount / medicalTerms.length) * 100;
    }

    /**
     * 보고서 품질 점수 계산
     */
    calculateQualityScore(generatedReport, referenceReport) {
        const similarity = this.calculateSimilarity(generatedReport, referenceReport);
        const generatedStructure = this.analyzeStructure(generatedReport);
        const referenceStructure = this.analyzeStructure(referenceReport);
        const generatedDates = this.analyzeDateInfo(generatedReport);
        const referenceDates = this.analyzeDateInfo(referenceReport);
        const medicalProfessionalism = this.evaluateMedicalProfessionalism(generatedReport);
        
        // 가중치 적용 점수 계산
        const scores = {
            similarity: similarity * 100,
            structuralCompleteness: generatedStructure.completeness,
            dateAccuracy: Math.min((generatedDates.dateCount / Math.max(referenceDates.dateCount, 1)) * 100, 100),
            medicalProfessionalism: medicalProfessionalism,
            lengthRatio: Math.min((generatedReport.length / referenceReport.length) * 100, 100)
        };
        
        // 가중 평균 계산
        const weights = {
            similarity: 0.3,
            structuralCompleteness: 0.25,
            dateAccuracy: 0.2,
            medicalProfessionalism: 0.15,
            lengthRatio: 0.1
        };
        
        const totalScore = Object.keys(scores).reduce((total, key) => {
            return total + (scores[key] * weights[key]);
        }, 0);
        
        return {
            totalScore: Math.round(totalScore * 100) / 100,
            detailedScores: scores,
            weights: weights
        };
    }

    /**
     * 단일 케이스 비교 분석
     */
    async compareCase(caseNumber, generatedReportPath) {
        console.log(`📊 ${caseNumber} 보고서 비교 분석 시작...`);
        
        try {
            // 기준 보고서 로드
            const referenceReportPath = path.join(this.fixturesPath, `${caseNumber}_report.txt`);
            if (!fs.existsSync(referenceReportPath)) {
                throw new Error(`기준 보고서 파일이 없습니다: ${referenceReportPath}`);
            }
            
            const referenceReport = fs.readFileSync(referenceReportPath, 'utf-8');
            
            // 생성된 보고서 로드
            let generatedReport;
            if (fs.existsSync(generatedReportPath)) {
                let content = fs.readFileSync(generatedReportPath, 'utf-8');
                
                // BOM 제거
                if (content.charCodeAt(0) === 0xFEFF) {
                    content = content.slice(1);
                }
                
                // JSON 파일인 경우 텍스트 추출
                if (generatedReportPath.endsWith('.json')) {
                    try {
                        const jsonData = JSON.parse(content);
                        generatedReport = jsonData.report || jsonData.reportText || jsonData.result || jsonData.content || content;
                    } catch (parseError) {
                        console.warn(`JSON 파싱 오류 (${caseNumber}): ${parseError.message}`);
                        // JSON 파싱 실패시 원본 텍스트 사용
                        generatedReport = content;
                    }
                } else {
                    generatedReport = content;
                }
            } else {
                throw new Error(`생성된 보고서 파일이 없습니다: ${generatedReportPath}`);
            }
            
            // 품질 점수 계산
            const qualityScore = this.calculateQualityScore(generatedReport, referenceReport);
            
            // 상세 분석
            const analysis = {
                caseNumber,
                timestamp: new Date().toISOString(),
                qualityScore: qualityScore,
                referenceReport: {
                    length: referenceReport.length,
                    structure: this.analyzeStructure(referenceReport),
                    dates: this.analyzeDateInfo(referenceReport),
                    keywords: this.extractKeywords(referenceReport)
                },
                generatedReport: {
                    length: generatedReport.length,
                    structure: this.analyzeStructure(generatedReport),
                    dates: this.analyzeDateInfo(generatedReport),
                    keywords: this.extractKeywords(generatedReport)
                },
                recommendations: this.generateRecommendations(qualityScore)
            };
            
            // 결과 저장
            const resultPath = path.join(this.resultsPath, `${caseNumber}_comparison.json`);
            fs.writeFileSync(resultPath, JSON.stringify(analysis, null, 2));
            
            console.log(`✅ ${caseNumber} 분석 완료 - 품질 점수: ${qualityScore.totalScore}점`);
            
            return analysis;
            
        } catch (error) {
            console.error(`❌ ${caseNumber} 분석 실패:`, error.message);
            return null;
        }
    }

    /**
     * 개선 권장사항 생성
     */
    generateRecommendations(qualityScore) {
        const recommendations = [];
        const { detailedScores } = qualityScore;
        
        if (detailedScores.similarity < 70) {
            recommendations.push("내용 유사도가 낮습니다. 기준 보고서의 핵심 내용을 더 포함해야 합니다.");
        }
        
        if (detailedScores.structuralCompleteness < 80) {
            recommendations.push("보고서 구조가 불완전합니다. 계약정보, 청구사항, 조사내용 등을 모두 포함해야 합니다.");
        }
        
        if (detailedScores.dateAccuracy < 80) {
            recommendations.push("날짜 정보가 부족합니다. 시간순 정보를 더 정확히 포함해야 합니다.");
        }
        
        if (detailedScores.medicalProfessionalism < 70) {
            recommendations.push("의료 전문성이 부족합니다. 의료 용어와 진단 정보를 더 포함해야 합니다.");
        }
        
        return recommendations;
    }

    /**
     * 전체 케이스 비교 실행
     */
    async runComprehensiveComparison() {
        console.log('🚀 보고서 비교 시스템 시작');
        console.log('============================================================');
        
        const caseFiles = this.getCaseFiles();
        const results = [];
        let totalScore = 0;
        let successCount = 0;
        
        for (const caseFile of caseFiles) {
            // 생성된 보고서 파일 경로 추정
            const possiblePaths = [
                path.join(__dirname, `${caseFile.caseNumber.toLowerCase()}_core_engine_report.json`),
                path.join(this.resultsPath, `${caseFile.caseNumber}_result.json`),
                path.join(this.reportsPath, `${caseFile.caseNumber}_report.txt`)
            ];
            
            let generatedReportPath = null;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    generatedReportPath = possiblePath;
                    break;
                }
            }
            
            if (generatedReportPath) {
                const result = await this.compareCase(caseFile.caseNumber, generatedReportPath);
                if (result) {
                    results.push(result);
                    totalScore += result.qualityScore.totalScore;
                    successCount++;
                }
            } else {
                console.log(`⚠️ ${caseFile.caseNumber} 생성된 보고서를 찾을 수 없습니다.`);
            }
        }
        
        // 종합 결과
        const averageScore = successCount > 0 ? totalScore / successCount : 0;
        
        const summary = {
            timestamp: new Date().toISOString(),
            totalCases: caseFiles.length,
            analyzedCases: successCount,
            averageQualityScore: Math.round(averageScore * 100) / 100,
            results: results,
            recommendations: this.generateOverallRecommendations(averageScore, results)
        };
        
        // 종합 결과 저장
        const summaryPath = path.join(this.resultsPath, 'comparison_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log('\n📈 종합 결과:');
        console.log(`분석된 케이스: ${successCount}/${caseFiles.length}`);
        console.log(`평균 품질 점수: ${averageScore.toFixed(1)}점`);
        
        return summary;
    }

    /**
     * 전체 개선 권장사항 생성
     */
    generateOverallRecommendations(averageScore, results) {
        const recommendations = [];
        
        if (averageScore < 80) {
            recommendations.push("전체적인 품질 개선이 필요합니다. 목표 점수 80점 이상을 위해 시스템 최적화가 필요합니다.");
        }
        
        if (results.length < 10) {
            recommendations.push("더 많은 케이스에 대한 분석이 필요합니다. 전체 케이스를 대상으로 테스트해보세요.");
        }
        
        // 공통 문제점 식별
        const commonIssues = {};
        results.forEach(result => {
            result.recommendations.forEach(rec => {
                commonIssues[rec] = (commonIssues[rec] || 0) + 1;
            });
        });
        
        Object.entries(commonIssues).forEach(([issue, count]) => {
            if (count > results.length * 0.5) {
                recommendations.push(`공통 문제: ${issue} (${count}/${results.length} 케이스에서 발견)`);
            }
        });
        
        return recommendations;
    }

    /**
     * HTML 보고서 생성
     */
    generateHTMLReport(summary) {
        const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>보고서 품질 비교 분석</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2c3e50; margin-bottom: 10px; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .card h3 { margin: 0 0 10px 0; font-size: 1.2em; }
        .card .value { font-size: 2em; font-weight: bold; }
        .results-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .results-table th, .results-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .results-table th { background: #f8f9fa; font-weight: bold; }
        .score { font-weight: bold; padding: 5px 10px; border-radius: 5px; }
        .score.excellent { background: #d4edda; color: #155724; }
        .score.good { background: #d1ecf1; color: #0c5460; }
        .score.fair { background: #fff3cd; color: #856404; }
        .score.poor { background: #f8d7da; color: #721c24; }
        .recommendations { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px; }
        .recommendations h3 { color: #2c3e50; margin-bottom: 15px; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 보고서 품질 비교 분석 리포트</h1>
            <p>생성된 보고서와 기준 보고서 간의 품질 비교 분석 결과</p>
            <p><small>생성일시: ${new Date(summary.timestamp).toLocaleString('ko-KR')}</small></p>
        </div>

        <div class="summary-cards">
            <div class="card">
                <h3>📁 분석 케이스</h3>
                <div class="value">${summary.analyzedCases}/${summary.totalCases}</div>
            </div>
            <div class="card">
                <h3>📈 평균 품질 점수</h3>
                <div class="value">${summary.averageQualityScore}점</div>
            </div>
            <div class="card">
                <h3>🎯 목표 달성률</h3>
                <div class="value">${Math.round((summary.averageQualityScore / 80) * 100)}%</div>
            </div>
        </div>

        <h2>📋 케이스별 상세 결과</h2>
        <table class="results-table">
            <thead>
                <tr>
                    <th>케이스</th>
                    <th>총점</th>
                    <th>유사도</th>
                    <th>구조 완성도</th>
                    <th>날짜 정확도</th>
                    <th>의료 전문성</th>
                    <th>길이 비율</th>
                </tr>
            </thead>
            <tbody>
                ${summary.results.map(result => {
                    const getScoreClass = (score) => {
                        if (score >= 90) return 'excellent';
                        if (score >= 80) return 'good';
                        if (score >= 70) return 'fair';
                        return 'poor';
                    };
                    
                    return `
                    <tr>
                        <td><strong>${result.caseNumber}</strong></td>
                        <td><span class="score ${getScoreClass(result.qualityScore.totalScore)}">${result.qualityScore.totalScore}점</span></td>
                        <td>${result.qualityScore.detailedScores.similarity.toFixed(1)}점</td>
                        <td>${result.qualityScore.detailedScores.structuralCompleteness.toFixed(1)}점</td>
                        <td>${result.qualityScore.detailedScores.dateAccuracy.toFixed(1)}점</td>
                        <td>${result.qualityScore.detailedScores.medicalProfessionalism.toFixed(1)}점</td>
                        <td>${result.qualityScore.detailedScores.lengthRatio.toFixed(1)}점</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div class="recommendations">
            <h3>🎯 개선 권장사항</h3>
            <ul>
                ${summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>
        `;
        
        const htmlPath = path.join(this.resultsPath, 'quality_comparison_report.html');
        fs.writeFileSync(htmlPath, htmlContent);
        
        console.log(`📄 HTML 보고서 생성 완료: ${htmlPath}`);
        return htmlPath;
    }
}

// 실행 함수
async function main() {
    const comparisonSystem = new ReportComparisonSystem();
    
    try {
        const summary = await comparisonSystem.runComprehensiveComparison();
        const htmlReportPath = comparisonSystem.generateHTMLReport(summary);
        
        console.log('\n✨ 보고서 비교 분석 완료!');
        console.log(`📊 결과 요약: ${path.join(__dirname, 'results', 'comparison_summary.json')}`);
        console.log(`📄 HTML 보고서: ${htmlReportPath}`);
        
        return summary;
        
    } catch (error) {
        console.error('❌ 분석 실행 중 오류:', error);
        process.exit(1);
    }
}

// 모듈로 사용할 경우
if (require.main === module) {
    main();
}

module.exports = ReportComparisonSystem;