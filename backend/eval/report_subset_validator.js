/**
 * Report Subset Validator
 * 
 * 목적: "report ⊆ vnexsus" 자동 검증
 * - Report에 있는 핵심 정보(날짜/ICD/병원)가 VNEXSUS 결과에 포함되는지 확인
 * - 누락 항목 리포트 생성
 * - 베이스라인 메트릭 측정
 */

const fs = require('fs');
const path = require('path');

class ReportSubsetValidator {
    constructor(options = {}) {
        this.options = {
            dateMatchThreshold: options.dateMatchThreshold || 0.95,
            icdMatchThreshold: options.icdMatchThreshold || 0.95,
            hospitalMatchThreshold: options.hospitalMatchThreshold || 0.80,
            ...options
        };

        this.results = {
            totalCases: 0,
            casesWithBoth: 0,
            dateMatchRate: 0,
            icdMatchRate: 0,
            hospitalMatchRate: 0,
            missingEvents: [],
            summary: {}
        };
    }

    /**
     * 날짜 추출 (YYYY-MM-DD 형식)
     */
    extractDates(text) {
        if (!text) return [];

        const datePatterns = [
            /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/g,  // 2024-04-09, 2024.04.09
            /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g  // 2024년 4월 9일
        ];

        const dates = new Set();

        datePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const year = match[1];
                const month = match[2].padStart(2, '0');
                const day = match[3].padStart(2, '0');
                dates.add(`${year}-${month}-${day}`);
            }
        });

        return Array.from(dates).sort();
    }

    /**
     * ICD/KCD 코드 추출
     */
    extractICDCodes(text) {
        if (!text) return [];

        const icdPattern = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\b/g;
        const codes = new Set();

        let match;
        while ((match = icdPattern.exec(text)) !== null) {
            codes.add(match[1]);
        }

        return Array.from(codes).sort();
    }

    /**
     * 병원명 추출 및 정규화
     */
    extractHospitals(text) {
        if (!text) return [];

        const hospitalKeywords = [
            '병원', '의원', '클리닉', '센터', '한의원', '치과'
        ];

        const hospitals = new Set();
        const lines = text.split('\n');

        lines.forEach(line => {
            hospitalKeywords.forEach(keyword => {
                if (line.includes(keyword)) {
                    // 병원명 추출 (간단한 휴리스틱)
                    const match = line.match(/([가-힣a-zA-Z0-9\s]+(?:병원|의원|클리닉|센터|한의원|치과))/);
                    if (match) {
                        const hospitalName = this.normalizeHospitalName(match[1]);
                        if (hospitalName) {
                            hospitals.add(hospitalName);
                        }
                    }
                }
            });
        });

        return Array.from(hospitals).sort();
    }

    /**
     * 병원명 정규화
     */
    normalizeHospitalName(name) {
        if (!name) return '';

        return name
            .trim()
            .replace(/\s+/g, '')  // 공백 제거
            .replace(/의료재단|재단법인|학교법인/g, '')  // 불필요한 접두어 제거
            .toLowerCase();
    }

    /**
     * 날짜 매칭
     */
    matchDates(reportDates, vnexsusDates) {
        const matched = [];
        const missing = [];

        reportDates.forEach(reportDate => {
            if (vnexsusDates.includes(reportDate)) {
                matched.push(reportDate);
            } else {
                missing.push(reportDate);
            }
        });

        const matchRate = reportDates.length > 0
            ? matched.length / reportDates.length
            : 1.0;

        return { matched, missing, matchRate };
    }

    /**
     * ICD 코드 매칭 (prefix 매칭 포함)
     */
    matchICDCodes(reportCodes, vnexsusCodes) {
        const matched = [];
        const missing = [];

        reportCodes.forEach(reportCode => {
            // Exact match
            if (vnexsusCodes.includes(reportCode)) {
                matched.push(reportCode);
                return;
            }

            // Prefix match (예: I20.1 vs I20)
            const hasPrefix = vnexsusCodes.some(vnexsusCode =>
                reportCode.startsWith(vnexsusCode) || vnexsusCode.startsWith(reportCode)
            );

            if (hasPrefix) {
                matched.push(reportCode);
            } else {
                missing.push(reportCode);
            }
        });

        const matchRate = reportCodes.length > 0
            ? matched.length / reportCodes.length
            : 1.0;

        return { matched, missing, matchRate };
    }

    /**
     * 병원 매칭
     */
    matchHospitals(reportHospitals, vnexsusHospitals) {
        const matched = [];
        const missing = [];

        const normalizedVnexsus = vnexsusHospitals.map(h => this.normalizeHospitalName(h));

        reportHospitals.forEach(reportHospital => {
            const normalized = this.normalizeHospitalName(reportHospital);

            if (normalizedVnexsus.includes(normalized)) {
                matched.push(reportHospital);
            } else {
                missing.push(reportHospital);
            }
        });

        const matchRate = reportHospitals.length > 0
            ? matched.length / reportHospitals.length
            : 1.0;

        return { matched, missing, matchRate };
    }

    /**
     * 단일 케이스 검증
     */
    validateCase(caseId, reportText, vnexsusText) {
        // 데이터 추출
        const reportDates = this.extractDates(reportText);
        const reportICDs = this.extractICDCodes(reportText);
        const reportHospitals = this.extractHospitals(reportText);

        const vnexsusDates = this.extractDates(vnexsusText);
        const vnexsusICDs = this.extractICDCodes(vnexsusText);
        const vnexsusHospitals = this.extractHospitals(vnexsusText);

        // 매칭
        const dateMatch = this.matchDates(reportDates, vnexsusDates);
        const icdMatch = this.matchICDCodes(reportICDs, vnexsusICDs);
        const hospitalMatch = this.matchHospitals(reportHospitals, vnexsusHospitals);

        const result = {
            caseId,
            report: {
                dates: reportDates,
                icds: reportICDs,
                hospitals: reportHospitals
            },
            vnexsus: {
                dates: vnexsusDates,
                icds: vnexsusICDs,
                hospitals: vnexsusHospitals
            },
            matching: {
                dates: dateMatch,
                icds: icdMatch,
                hospitals: hospitalMatch
            },
            hasMissing: dateMatch.missing.length > 0 ||
                icdMatch.missing.length > 0 ||
                hospitalMatch.missing.length > 0
        };

        return result;
    }

    /**
     * 전체 케이스 검증
     */
    async validateAll(casesDir) {
        console.log('🔍 Report Subset Validator 시작...\n');

        if (!fs.existsSync(casesDir)) {
            throw new Error(`케이스 디렉토리를 찾을 수 없습니다: ${casesDir}`);
        }

        const cases = fs.readdirSync(casesDir)
            .filter(name => fs.statSync(path.join(casesDir, name)).isDirectory());

        console.log(`📁 총 ${cases.length}개 케이스 발견\n`);

        const validationResults = [];
        let totalDateMatchRate = 0;
        let totalICDMatchRate = 0;
        let totalHospitalMatchRate = 0;
        let casesWithBoth = 0;

        for (const caseId of cases) {
            const caseDir = path.join(casesDir, caseId);
            const reportPath = path.join(caseDir, 'report.txt');
            const vnexsusPath = path.join(caseDir, 'vnexsus.txt');

            // Report와 VNEXSUS 파일이 모두 있는 케이스만 검증
            if (!fs.existsSync(reportPath) || !fs.existsSync(vnexsusPath)) {
                console.log(`⏭️  ${caseId}: report 또는 vnexsus 파일 없음 (건너뜀)`);
                continue;
            }

            casesWithBoth++;

            const reportText = fs.readFileSync(reportPath, 'utf-8');
            const vnexsusText = fs.readFileSync(vnexsusPath, 'utf-8');

            const result = this.validateCase(caseId, reportText, vnexsusText);
            validationResults.push(result);

            totalDateMatchRate += result.matching.dates.matchRate;
            totalICDMatchRate += result.matching.icds.matchRate;
            totalHospitalMatchRate += result.matching.hospitals.matchRate;

            // 결과 출력
            const status = result.hasMissing ? '❌' : '✅';
            console.log(`${status} ${caseId}:`);
            console.log(`   날짜: ${result.matching.dates.matched.length}/${result.report.dates.length} (${(result.matching.dates.matchRate * 100).toFixed(1)}%)`);
            console.log(`   ICD: ${result.matching.icds.matched.length}/${result.report.icds.length} (${(result.matching.icds.matchRate * 100).toFixed(1)}%)`);
            console.log(`   병원: ${result.matching.hospitals.matched.length}/${result.report.hospitals.length} (${(result.matching.hospitals.matchRate * 100).toFixed(1)}%)`);

            if (result.hasMissing) {
                if (result.matching.dates.missing.length > 0) {
                    console.log(`   누락 날짜: ${result.matching.dates.missing.join(', ')}`);
                }
                if (result.matching.icds.missing.length > 0) {
                    console.log(`   누락 ICD: ${result.matching.icds.missing.join(', ')}`);
                }
                if (result.matching.hospitals.missing.length > 0) {
                    console.log(`   누락 병원: ${result.matching.hospitals.missing.join(', ')}`);
                }
            }
            console.log('');
        }

        // 전체 통계
        this.results = {
            totalCases: cases.length,
            casesWithBoth,
            dateMatchRate: casesWithBoth > 0 ? totalDateMatchRate / casesWithBoth : 0,
            icdMatchRate: casesWithBoth > 0 ? totalICDMatchRate / casesWithBoth : 0,
            hospitalMatchRate: casesWithBoth > 0 ? totalHospitalMatchRate / casesWithBoth : 0,
            validationResults,
            missingEvents: validationResults.filter(r => r.hasMissing),
            timestamp: new Date().toISOString()
        };

        return this.results;
    }

    /**
     * 결과 저장
     */
    saveResults(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2), 'utf-8');
        console.log(`\n💾 결과 저장: ${outputPath}`);
    }

    /**
     * 요약 리포트 출력
     */
    printSummary() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Report Subset Validation 요약');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`총 케이스: ${this.results.totalCases}`);
        console.log(`검증 케이스 (report + vnexsus 모두 존재): ${this.results.casesWithBoth}\n`);

        console.log(`평균 날짜 매칭률: ${(this.results.dateMatchRate * 100).toFixed(1)}%`);
        console.log(`평균 ICD 매칭률: ${(this.results.icdMatchRate * 100).toFixed(1)}%`);
        console.log(`평균 병원 매칭률: ${(this.results.hospitalMatchRate * 100).toFixed(1)}%\n`);

        const failedCases = this.results.missingEvents.length;
        const passRate = this.results.casesWithBoth > 0
            ? ((this.results.casesWithBoth - failedCases) / this.results.casesWithBoth * 100).toFixed(1)
            : 0;

        console.log(`누락 있는 케이스: ${failedCases}/${this.results.casesWithBoth} (통과율: ${passRate}%)\n`);

        // 목표 대비 현황
        console.log('🎯 목표 대비 현황:');
        console.log(`   날짜: ${(this.results.dateMatchRate * 100).toFixed(1)}% / 95% ${this.results.dateMatchRate >= 0.95 ? '✅' : '❌'}`);
        console.log(`   ICD: ${(this.results.icdMatchRate * 100).toFixed(1)}% / 95% ${this.results.icdMatchRate >= 0.95 ? '✅' : '❌'}`);
        console.log(`   병원: ${(this.results.hospitalMatchRate * 100).toFixed(1)}% / 80% ${this.results.hospitalMatchRate >= 0.80 ? '✅' : '❌'}`);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}

// CLI 실행
if (require.main === module) {
    const validator = new ReportSubsetValidator();

    // 케이스 디렉토리 경로 (실제 경로로 수정 필요)
    const casesDir = process.argv[2] || path.join(__dirname, '../../case_sample');
    const outputPath = path.join(__dirname, 'output/baseline_metrics.json');

    validator.validateAll(casesDir)
        .then(results => {
            validator.printSummary();
            validator.saveResults(outputPath);

            // 베이스라인 메트릭 별도 저장
            const baselineMetrics = {
                timestamp: results.timestamp,
                casesWithBoth: results.casesWithBoth,
                dateMatchRate: results.dateMatchRate,
                icdMatchRate: results.icdMatchRate,
                hospitalMatchRate: results.hospitalMatchRate,
                missingCasesCount: results.missingEvents.length
            };

            const baselinePath = path.join(__dirname, '../..', 'VNEXSUS_dev_plan_tasks/baseline_metrics.json');
            fs.writeFileSync(baselinePath, JSON.stringify(baselineMetrics, null, 2), 'utf-8');
            console.log(`📊 베이스라인 메트릭 저장: ${baselinePath}\n`);
        })
        .catch(error => {
            console.error('❌ 검증 실패:', error.message);
            process.exit(1);
        });
}

module.exports = ReportSubsetValidator;
