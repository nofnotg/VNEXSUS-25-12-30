import fs from 'fs';
import path from 'path';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';

// 12케이스 확장 테스트 스크립트
class ExtendedCaseValidator {
    constructor() {
        this.normalizer = new MedicalDocumentNormalizer();
        this.results = {
            totalCases: 0,
            successfulCases: 0,
            failedCases: [],
            detailedResults: {},
            performanceMetrics: {},
            validationSummary: {}
        };
        this.caseDirectory = 'C:\\MVP_v7_2AI\\src\\rag\\case_sample';
        this.outputDirectory = 'C:\\MVP_v7_2AI\\backend\\postprocess\\test_outputs';
    }

    // 사용 가능한 모든 케이스 파일 스캔
    async scanAvailableCases() {
        const files = fs.readdirSync(this.caseDirectory);
        const cases = new Set();
        
        files.forEach(file => {
            if (file.startsWith('Case') && file.endsWith('.txt') && !file.includes('_report')) {
                const caseNumber = file.match(/Case(\d+)\.txt/)?.[1];
                if (caseNumber) {
                    cases.add(parseInt(caseNumber));
                }
            }
        });
        
        return Array.from(cases).sort((a, b) => a - b);
    }

    // 케이스별 리포트 파일 존재 확인
    checkReportFileExists(caseNumber) {
        const reportPath = path.join(this.caseDirectory, `Case${caseNumber}_report.txt`);
        return fs.existsSync(reportPath);
    }

    // 개별 케이스 처리 및 검증
    async processCase(caseNumber) {
        const startTime = Date.now();
        console.log(`\n📄 Case${caseNumber} 처리 시작...`);
        
        try {
            const casePath = path.join(this.caseDirectory, `Case${caseNumber}.txt`);
            const reportPath = path.join(this.caseDirectory, `Case${caseNumber}_report.txt`);
            
            if (!fs.existsSync(casePath)) {
                throw new Error(`Case${caseNumber}.txt 파일이 존재하지 않습니다.`);
            }
            
            const hasReport = this.checkReportFileExists(caseNumber);
            const rawText = fs.readFileSync(casePath, 'utf-8');
            
            // 의료 문서 정규화 수행
            console.log(`📋 Case${caseNumber} 의료 문서 정규화 시작...`);
            const result = await this.normalizer.normalizeDocument(rawText);
            
            const processingTime = Date.now() - startTime;
            
            // 결과 검증
            const validation = this.validateResult(result, caseNumber);
            
            // 상세 결과 저장
            const detailedResult = {
                caseNumber,
                hasReportFile: hasReport,
                processingTime,
                success: result.success,
                validation,
                patientInfo: result.patientInfo || result.normalizedReport?.header,
                medicalRecordsCount: (result.medicalRecords || result.normalizedReport?.medicalRecords || []).length,
                insuranceInfoCount: (result.insuranceInfo || result.normalizedReport?.insuranceConditions || []).length,
                hospitalizationCount: (result.hospitalizationRecords || result.normalizedReport?.hospitalizationRecords || []).length,
                testResultsCount: (result.testResults || result.normalizedReport?.testResults || []).length,
                nanIssues: this.checkForNaNValues(result),
                memoryUsage: process.memoryUsage()
            };
            
            this.results.detailedResults[`Case${caseNumber}`] = detailedResult;
            
            // 개별 케이스 결과 저장
            await this.saveIndividualResult(caseNumber, result, detailedResult);
            
            console.log(`✅ Case${caseNumber} 처리 완료`);
            console.log(`  📊 의료기록: ${detailedResult.medicalRecordsCount}개`);
            console.log(`  🏥 보험정보: ${detailedResult.insuranceInfoCount}개`);
            console.log(`  ⏱️ 처리시간: ${processingTime}ms`);
            console.log(`  🔍 NaN 문제: ${detailedResult.nanIssues.hasNaN ? '❌ 발견됨' : '✅ 없음'}`);
            
            return detailedResult;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Case${caseNumber} 처리 실패:`, error.message);
            
            const errorResult = {
                caseNumber,
                success: false,
                error: error.message,
                processingTime
            };
            
            this.results.failedCases.push(errorResult);
            this.results.detailedResults[`Case${caseNumber}`] = errorResult;
            
            return errorResult;
        }
    }

    // 결과 검증
    validateResult(result, caseNumber) {
        const patientInfo = result.patientInfo || result.normalizedReport?.header;
        const medicalRecords = result.medicalRecords || result.normalizedReport?.medicalRecords || [];
        const insuranceInfo = result.insuranceInfo || result.normalizedReport?.insuranceConditions || [];
        
        const validation = {
            hasPatientInfo: !!patientInfo,
            hasValidName: patientInfo?.patientName && patientInfo.patientName !== 'Unknown',
            hasMedicalRecords: medicalRecords.length > 0,
            hasInsuranceInfo: insuranceInfo.length > 0,
            noNaNValues: !this.checkForNaNValues(result).hasNaN,
            processingSuccess: result.success === true
        };
        
        validation.overallScore = Object.values(validation).filter(v => v === true).length / Object.keys(validation).length;
        
        return validation;
    }

    // NaN 값 검사
    checkForNaNValues(obj, path = '') {
        const nanIssues = { hasNaN: false, locations: [] };
        
        const checkValue = (value, currentPath) => {
            if (typeof value === 'number' && isNaN(value)) {
                nanIssues.hasNaN = true;
                nanIssues.locations.push(currentPath);
            } else if (typeof value === 'string' && value.toLowerCase().includes('nan')) {
                nanIssues.hasNaN = true;
                nanIssues.locations.push(currentPath);
            } else if (typeof value === 'object' && value !== null) {
                Object.keys(value).forEach(key => {
                    checkValue(value[key], `${currentPath}.${key}`);
                });
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    checkValue(item, `${currentPath}[${index}]`);
                });
            }
        };
        
        checkValue(obj, path);
        return nanIssues;
    }

    // 개별 케이스 결과 저장
    async saveIndividualResult(caseNumber, result, detailedResult) {
        if (!fs.existsSync(this.outputDirectory)) {
            fs.mkdirSync(this.outputDirectory, { recursive: true });
        }
        
        const outputPath = path.join(this.outputDirectory, `case${caseNumber}_extended_result.json`);
        const output = {
            caseNumber,
            timestamp: new Date().toISOString(),
            detailedResult,
            fullResult: result
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    }

    // 성능 메트릭 계산
    calculatePerformanceMetrics() {
        const results = Object.values(this.results.detailedResults);
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length === 0) return {};
        
        const processingTimes = successfulResults.map(r => r.processingTime);
        const medicalRecordsCounts = successfulResults.map(r => r.medicalRecordsCount || 0);
        const memoryUsages = successfulResults.map(r => r.memoryUsage?.heapUsed || 0);
        
        return {
            averageProcessingTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
            minProcessingTime: Math.min(...processingTimes),
            maxProcessingTime: Math.max(...processingTimes),
            totalMedicalRecords: medicalRecordsCounts.reduce((a, b) => a + b, 0),
            averageMedicalRecords: medicalRecordsCounts.reduce((a, b) => a + b, 0) / medicalRecordsCounts.length,
            averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
            maxMemoryUsage: Math.max(...memoryUsages)
        };
    }

    // 종합 검증 요약
    generateValidationSummary() {
        const results = Object.values(this.results.detailedResults);
        const successfulResults = results.filter(r => r.success);
        
        const summary = {
            totalCasesProcessed: results.length,
            successfulCases: successfulResults.length,
            failedCases: results.length - successfulResults.length,
            successRate: (successfulResults.length / results.length) * 100,
            casesWithReports: results.filter(r => r.hasReportFile).length,
            casesWithoutNaN: successfulResults.filter(r => !r.nanIssues?.hasNaN).length,
            averageValidationScore: successfulResults.reduce((sum, r) => sum + (r.validation?.overallScore || 0), 0) / successfulResults.length,
            qualityMetrics: {
                casesWithPatientInfo: successfulResults.filter(r => r.validation?.hasPatientInfo).length,
                casesWithMedicalRecords: successfulResults.filter(r => r.validation?.hasMedicalRecords).length,
                casesWithInsuranceInfo: successfulResults.filter(r => r.validation?.hasInsuranceInfo).length
            }
        };
        
        return summary;
    }

    // 메인 실행 함수
    async runExtendedValidation() {
        console.log('🚀 12케이스 확장 AI 보고서 작성 로직 검증 시작\n');
        console.log('=' .repeat(60));
        
        try {
            // 사용 가능한 케이스 스캔
            const availableCases = await this.scanAvailableCases();
            console.log(`📋 발견된 케이스: ${availableCases.join(', ')}`);
            console.log(`📊 총 케이스 수: ${availableCases.length}개\n`);
            
            this.results.totalCases = availableCases.length;
            
            // 각 케이스 처리
            for (const caseNumber of availableCases) {
                const result = await this.processCase(caseNumber);
                if (result.success) {
                    this.results.successfulCases++;
                }
                
                // 메모리 정리
                if (global.gc) {
                    global.gc();
                }
            }
            
            // 성능 메트릭 계산
            this.results.performanceMetrics = this.calculatePerformanceMetrics();
            
            // 검증 요약 생성
            this.results.validationSummary = this.generateValidationSummary();
            
            // 최종 결과 출력
            this.printFinalResults();
            
            // 종합 결과 저장
            await this.saveFinalResults();
            
        } catch (error) {
            console.error('❌ 확장 검증 실행 중 오류:', error);
            throw error;
        }
    }

    // 최종 결과 출력
    printFinalResults() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 12케이스 확장 검증 최종 결과');
        console.log('=' .repeat(60));
        
        const summary = this.results.validationSummary;
        const metrics = this.results.performanceMetrics;
        
        console.log(`✅ 처리된 케이스: ${summary.totalCasesProcessed}/${this.results.totalCases}`);
        console.log(`🎯 성공률: ${summary.successRate.toFixed(1)}%`);
        console.log(`📄 리포트 파일 보유: ${summary.casesWithReports}개`);
        console.log(`🔍 NaN 없는 케이스: ${summary.casesWithoutNaN}개`);
        console.log(`📈 평균 검증 점수: ${(summary.averageValidationScore * 100).toFixed(1)}%`);
        
        console.log('\n📊 성능 메트릭:');
        console.log(`⏱️ 평균 처리시간: ${metrics.averageProcessingTime?.toFixed(0)}ms`);
        console.log(`📋 총 의료기록: ${metrics.totalMedicalRecords}개`);
        console.log(`💾 평균 메모리 사용: ${(metrics.averageMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
        
        console.log('\n🏥 품질 메트릭:');
        console.log(`👤 환자정보 추출: ${summary.qualityMetrics.casesWithPatientInfo}/${summary.successfulCases}`);
        console.log(`📋 의료기록 추출: ${summary.qualityMetrics.casesWithMedicalRecords}/${summary.successfulCases}`);
        console.log(`🏥 보험정보 추출: ${summary.qualityMetrics.casesWithInsuranceInfo}/${summary.successfulCases}`);
        
        if (this.results.failedCases.length > 0) {
            console.log('\n❌ 실패한 케이스:');
            this.results.failedCases.forEach(failed => {
                console.log(`  Case${failed.caseNumber}: ${failed.error}`);
            });
        }
    }

    // 최종 결과 저장
    async saveFinalResults() {
        if (!fs.existsSync(this.outputDirectory)) {
            fs.mkdirSync(this.outputDirectory, { recursive: true });
        }
        
        const finalResultPath = path.join(this.outputDirectory, 'extended_12cases_validation_results.json');
        const finalResult = {
            timestamp: new Date().toISOString(),
            summary: this.results.validationSummary,
            performanceMetrics: this.results.performanceMetrics,
            detailedResults: this.results.detailedResults,
            failedCases: this.results.failedCases,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage()
            }
        };
        
        fs.writeFileSync(finalResultPath, JSON.stringify(finalResult, null, 2), 'utf-8');
        console.log(`\n💾 종합 결과 저장: ${finalResultPath}`);
        
        // CSV 형태의 요약 보고서도 생성
        await this.generateCSVReport();
    }

    // CSV 보고서 생성
    async generateCSVReport() {
        const csvPath = path.join(this.outputDirectory, 'extended_12cases_summary.csv');
        const results = Object.values(this.results.detailedResults);
        
        const csvHeader = 'Case,Success,ProcessingTime(ms),MedicalRecords,InsuranceInfo,HasNaN,ValidationScore,HasReport\n';
        const csvRows = results.map(r => {
            return [
                r.caseNumber,
                r.success ? 'YES' : 'NO',
                r.processingTime || 0,
                r.medicalRecordsCount || 0,
                r.insuranceInfoCount || 0,
                r.nanIssues?.hasNaN ? 'YES' : 'NO',
                ((r.validation?.overallScore || 0) * 100).toFixed(1) + '%',
                r.hasReportFile ? 'YES' : 'NO'
            ].join(',');
        }).join('\n');
        
        fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');
        console.log(`📊 CSV 요약 보고서: ${csvPath}`);
    }
}

// 실행
const validator = new ExtendedCaseValidator();
validator.runExtendedValidation()
    .then(() => {
        console.log('\n🎉 12케이스 확장 검증 완료!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ 확장 검증 실패:', error);
        process.exit(1);
    });

export default ExtendedCaseValidator;