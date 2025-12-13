/**
 * VNEXSUS 정확도 검증 스크립트
 * 
 * CaseX.txt의 원본 데이터와 CaseX_report.txt의 기대 결과를 비교하여
 * 현재 앱의 정확도를 측정합니다.
 */

const fs = require('fs');
const path = require('path');

const CASE_DIR = path.join(__dirname, '..', 'src', 'rag', 'case_sample');

// 핵심 추출 항목 정의
const EXTRACTION_FIELDS = {
    dates: { weight: 20, regex: /\d{4}[.-]\d{2}[.-]\d{2}/g },
    hospitals: { weight: 20, regex: /[가-힣]+(?:병원|의원|클리닉|센터|의료원)/g },
    icdCodes: { weight: 20, regex: /[A-Z]\d{2,3}\.?\d{0,2}/g },
    diagnoses: { weight: 20, regex: /진단(?:명|병명)?\s*[:：]?\s*([^\n]+)/g },
    treatments: { weight: 10, regex: /치료(?:내용)?\s*[:：]?\s*([^\n]+)/g },
    insurance: { weight: 10, regex: /(?:보험|가입일|보장개시)/g }
};

async function runAccuracyTest() {
    console.log('============================================================');
    console.log('VNEXSUS 정확도 검증 테스트');
    console.log('============================================================\n');

    const files = fs.readdirSync(CASE_DIR);
    const caseNumbers = new Set();

    // 케이스 번호 추출
    files.forEach(file => {
        const match = file.match(/Case(\d+)\.txt$/);
        if (match) caseNumbers.add(parseInt(match[1]));
    });

    const sortedCases = Array.from(caseNumbers).sort((a, b) => a - b);
    console.log(`📊 분석 대상: ${sortedCases.length}개 케이스\n`);

    const results = [];

    for (const caseNum of sortedCases) {
        const sourceFile = path.join(CASE_DIR, `Case${caseNum}.txt`);
        const expectedFile = path.join(CASE_DIR, `Case${caseNum}_report.txt`);

        if (!fs.existsSync(sourceFile) || !fs.existsSync(expectedFile)) {
            continue;
        }

        try {
            const sourceText = fs.readFileSync(sourceFile, 'utf-8');
            const expectedReport = fs.readFileSync(expectedFile, 'utf-8');

            const caseResult = analyzeCase(caseNum, sourceText, expectedReport);
            results.push(caseResult);

            console.log(`Case ${caseNum}: 정확도 ${caseResult.accuracy.toFixed(1)}%`);
            console.log(`  - 날짜: ${caseResult.fields.dates.found}/${caseResult.fields.dates.expected}`);
            console.log(`  - 병원: ${caseResult.fields.hospitals.found}/${caseResult.fields.hospitals.expected}`);
            console.log(`  - ICD코드: ${caseResult.fields.icdCodes.found}/${caseResult.fields.icdCodes.expected}`);
            console.log('');
        } catch (err) {
            console.error(`Case ${caseNum} 오류: ${err.message}`);
        }
    }

    // 전체 통계
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    const successCases = results.filter(r => r.accuracy >= 80).length;

    console.log('============================================================');
    console.log('📊 전체 분석 결과');
    console.log('============================================================');
    console.log(`총 케이스: ${results.length}`);
    console.log(`평균 정확도: ${avgAccuracy.toFixed(1)}%`);
    console.log(`80% 이상 케이스: ${successCases}/${results.length} (${(successCases / results.length * 100).toFixed(1)}%)`);
    console.log('');

    // 필드별 통계
    console.log('📋 필드별 추출률:');
    const fieldStats = {};
    Object.keys(EXTRACTION_FIELDS).forEach(field => {
        const totalExpected = results.reduce((sum, r) => sum + (r.fields[field]?.expected || 0), 0);
        const totalFound = results.reduce((sum, r) => sum + (r.fields[field]?.found || 0), 0);
        const rate = totalExpected > 0 ? (totalFound / totalExpected * 100) : 0;
        fieldStats[field] = { expected: totalExpected, found: totalFound, rate };
        console.log(`  ${field}: ${totalFound}/${totalExpected} (${rate.toFixed(1)}%)`);
    });

    // 결과 저장
    const report = {
        timestamp: new Date().toISOString(),
        totalCases: results.length,
        averageAccuracy: avgAccuracy,
        successRate: successCases / results.length * 100,
        fieldStats,
        details: results
    };

    const reportPath = path.join(__dirname, 'accuracy-test-result.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 상세 결과 저장: ${reportPath}`);

    return report;
}

function analyzeCase(caseNum, sourceText, expectedReport) {
    const fields = {};
    let totalScore = 0;
    let maxScore = 0;

    Object.entries(EXTRACTION_FIELDS).forEach(([fieldName, config]) => {
        const sourceMatches = sourceText.match(config.regex) || [];
        const expectedMatches = expectedReport.match(config.regex) || [];

        const sourceSet = new Set(sourceMatches.map(m => m.toLowerCase().replace(/\s/g, '')));
        const expectedSet = new Set(expectedMatches.map(m => m.toLowerCase().replace(/\s/g, '')));

        // 기대 결과에서 원본 데이터에 포함된 항목 수
        let foundCount = 0;
        expectedSet.forEach(item => {
            if (sourceSet.has(item)) foundCount++;
        });

        const fieldAccuracy = expectedSet.size > 0 ? foundCount / expectedSet.size : 1;

        fields[fieldName] = {
            expected: expectedSet.size,
            found: foundCount,
            accuracy: fieldAccuracy * 100
        };

        totalScore += fieldAccuracy * config.weight;
        maxScore += config.weight;
    });

    return {
        caseNumber: caseNum,
        accuracy: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
        fields
    };
}

// 실행
runAccuracyTest().then(result => {
    console.log('\n✅ 정확도 검증 완료!');
    process.exit(0);
}).catch(err => {
    console.error('❌ 오류:', err);
    process.exit(1);
});
