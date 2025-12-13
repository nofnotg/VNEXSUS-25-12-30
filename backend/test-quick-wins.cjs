/**
 * Quick Wins 모듈 테스트 스크립트
 * 
 * HybridExtractor를 사용하여 샘플 케이스의 정확도 개선을 검증합니다.
 */

const fs = require('fs');
const path = require('path');

// 개별 모듈 직접 로드 (ESM 충돌 방지)
const RegexPatterns = require('./utils/RegexPatterns');
const FuzzyMatcher = require('./utils/FuzzyMatcher');
const CrossValidator = require('./utils/CrossValidator');
const ConfidenceScorer = require('./utils/ConfidenceScorer');

// 간단한 통합 추출기
class SimpleHybridExtractor {
    constructor() {
        this.regex = new RegexPatterns();
        this.fuzzy = new FuzzyMatcher();
        this.validator = new CrossValidator();
        this.scorer = new ConfidenceScorer();
    }

    extract(text) {
        if (!text) return { success: false, error: 'No input' };

        const dates = this.regex.extractDates(text);
        const hospitals = this.regex.extractHospitals(text);
        const icdCodes = this.regex.extractICDCodes(text);
        const diagnoses = this.regex.extractDiagnoses(text);

        const validatedHospitals = hospitals.map(h => ({
            ...h,
            fuzzy: this.fuzzy.matchHospital(h.name),
            validation: this.validator.validateHospital(h.name)
        }));

        const validatedICD = icdCodes.map(c => ({
            ...c,
            validation: this.validator.validateICD(c.code)
        }));

        const validatedDates = dates.map(d => this.validator.validateDateRange(d.normalized));

        const scores = [];
        if (validatedHospitals.length) scores.push(validatedHospitals.reduce((s, h) => s + (h.validation?.confidence || 0), 0) / validatedHospitals.length);
        if (validatedICD.length) scores.push(validatedICD.reduce((s, c) => s + (c.validation?.confidence || 0), 0) / validatedICD.length);
        if (validatedDates.length) scores.push(validatedDates.reduce((s, d) => s + (d.confidence || 0), 0) / validatedDates.length);

        const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        return {
            success: true,
            summary: {
                totalDates: dates.length,
                validatedDates: validatedDates.filter(d => d.valid).length,
                totalHospitals: hospitals.length,
                validatedHospitals: validatedHospitals.filter(h => h.validation?.confidence >= 70).length,
                totalICDCodes: icdCodes.length,
                validatedICDCodes: validatedICD.filter(c => c.validation?.confidence >= 70).length,
                totalDiagnoses: diagnoses.length
            },
            confidence: {
                overall,
                level: this.scorer.getLevel(overall),
                requiresReview: overall < 80
            }
        };
    }
}

const extractor = new SimpleHybridExtractor();

// 테스트 케이스 디렉토리
const caseSampleDir = path.join(__dirname, '..', 'src', 'rag', 'case_sample');

async function runTest() {
    console.log('='.repeat(60));
    console.log('VNEXSUS Quick Wins 정확도 테스트');
    console.log('='.repeat(60));
    console.log(`테스트 시작: ${new Date().toISOString()}`);
    console.log('');

    const results = [];

    // 모든 CaseX.txt 파일 찾기
    const files = fs.readdirSync(caseSampleDir)
        .filter(f => /^Case\d+\.txt$/.test(f))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });

    console.log(`발견된 케이스: ${files.length}개`);
    console.log('');

    for (const file of files) {
        const caseName = file.replace('.txt', '');
        const sourceFile = path.join(caseSampleDir, file);
        const expectedFile = path.join(caseSampleDir, `${caseName}_report.txt`);

        try {
            // 소스 파일 읽기
            const sourceText = fs.readFileSync(sourceFile, 'utf-8');

            // HybridExtractor로 추출
            const extracted = extractor.extract(sourceText);

            // 기대 결과 파일 읽기 (있으면)
            let hasExpected = false;
            let expectedText = '';
            if (fs.existsSync(expectedFile)) {
                hasExpected = true;
                expectedText = fs.readFileSync(expectedFile, 'utf-8');
            }

            // 추출 결과 요약
            const summary = extracted.summary;
            const confidence = extracted.confidence;

            console.log(`[${caseName}]`);
            console.log(`  - 날짜: ${summary.totalDates}개 (검증됨: ${summary.validatedDates}개)`);
            console.log(`  - 병원: ${summary.totalHospitals}개 (검증됨: ${summary.validatedHospitals}개)`);
            console.log(`  - ICD: ${summary.totalICDCodes}개 (검증됨: ${summary.validatedICDCodes}개)`);
            console.log(`  - 진단: ${summary.totalDiagnoses}개`);
            console.log(`  - 신뢰도: ${confidence.overall}% (${confidence.level})`);
            console.log(`  - 검토 필요: ${confidence.requiresReview ? '예' : '아니오'}`);
            console.log('');

            results.push({
                case: caseName,
                dates: { total: summary.totalDates, validated: summary.validatedDates },
                hospitals: { total: summary.totalHospitals, validated: summary.validatedHospitals },
                icdCodes: { total: summary.totalICDCodes, validated: summary.validatedICDCodes },
                diagnoses: summary.totalDiagnoses,
                confidence: confidence.overall,
                level: confidence.level,
                requiresReview: confidence.requiresReview,
                hasExpected
            });

        } catch (error) {
            console.error(`[${caseName}] 오류: ${error.message}`);
            results.push({
                case: caseName,
                error: error.message
            });
        }
    }

    // 전체 통계
    console.log('='.repeat(60));
    console.log('전체 통계');
    console.log('='.repeat(60));

    const validResults = results.filter(r => !r.error);
    const avgConfidence = validResults.length > 0
        ? Math.round(validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length)
        : 0;

    const totalDates = validResults.reduce((sum, r) => sum + r.dates.total, 0);
    const validatedDates = validResults.reduce((sum, r) => sum + r.dates.validated, 0);
    const totalHospitals = validResults.reduce((sum, r) => sum + r.hospitals.total, 0);
    const validatedHospitals = validResults.reduce((sum, r) => sum + r.hospitals.validated, 0);
    const totalICDCodes = validResults.reduce((sum, r) => sum + r.icdCodes.total, 0);
    const validatedICDCodes = validResults.reduce((sum, r) => sum + r.icdCodes.validated, 0);

    console.log(`테스트 케이스: ${files.length}개`);
    console.log(`성공: ${validResults.length}개, 실패: ${results.length - validResults.length}개`);
    console.log('');
    console.log(`날짜 추출: ${totalDates}개 (검증됨: ${validatedDates}개, ${totalDates > 0 ? Math.round(validatedDates / totalDates * 100) : 0}%)`);
    console.log(`병원 추출: ${totalHospitals}개 (검증됨: ${validatedHospitals}개, ${totalHospitals > 0 ? Math.round(validatedHospitals / totalHospitals * 100) : 0}%)`);
    console.log(`ICD 추출: ${totalICDCodes}개 (검증됨: ${validatedICDCodes}개, ${totalICDCodes > 0 ? Math.round(validatedICDCodes / totalICDCodes * 100) : 0}%)`);
    console.log('');
    console.log(`평균 신뢰도: ${avgConfidence}%`);
    console.log('');

    // 결과 저장
    const outputPath = path.join(__dirname, 'quick-wins-test-result.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        testedAt: new Date().toISOString(),
        totalCases: files.length,
        successCases: validResults.length,
        averageConfidence: avgConfidence,
        summary: {
            dates: { total: totalDates, validated: validatedDates },
            hospitals: { total: totalHospitals, validated: validatedHospitals },
            icdCodes: { total: totalICDCodes, validated: validatedICDCodes }
        },
        results
    }, null, 2));

    console.log(`결과 저장: ${outputPath}`);
    console.log('='.repeat(60));
}

runTest().catch(console.error);
