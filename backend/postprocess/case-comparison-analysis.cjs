/**
 * 케이스 샘플 비교 분석 스크립트
 * 
 * 현재 파이프라인 출력과 expected report를 비교하여 
 * 품질 개선 인사이트를 도출합니다.
 */

const fs = require('fs');
const path = require('path');

const CASE_SAMPLE_DIR = path.join(__dirname, '../../src/rag/case_sample');
const TEST_OUTPUT_DIR = path.join(__dirname, 'test_outputs');

/**
 * Expected Report 파싱
 */
function parseExpectedReport(content) {
    const result = {
        events: [],
        hospitals: new Set(),
        diagnoses: [],
        dates: [],
        insuranceInfo: [],
        disclosureInfo: []
    };

    const lines = content.split('\n');
    let currentEvent = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 날짜 패턴 찾기 (YYYY.MM.DD 또는 YYYY-MM-DD)
        const dateMatch = trimmed.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
        if (dateMatch) {
            const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
            result.dates.push(date);

            // 새 이벤트 시작
            if (currentEvent) {
                result.events.push(currentEvent);
            }
            currentEvent = { date, content: trimmed };
        }

        // ICD 코드 패턴 찾기
        const icdMatches = trimmed.matchAll(/([A-Z]\d{2}(?:\.\d{1,2})?)/g);
        for (const match of icdMatches) {
            result.diagnoses.push(match[1]);
        }

        // 병원명 패턴 찾기
        const hospitalPatterns = [
            /(\S+병원)/g,
            /(\S+의원)/g,
            /(\S+센터)/g,
            /(\S+클리닉)/g
        ];

        for (const pattern of hospitalPatterns) {
            const matches = trimmed.matchAll(pattern);
            for (const match of matches) {
                if (match[1].length > 2 && match[1].length < 20) {
                    result.hospitals.add(match[1]);
                }
            }
        }

        // 고지의무 관련 키워드
        if (/고지|알릴의무|위반/.test(trimmed)) {
            result.disclosureInfo.push(trimmed);
        }

        // 보험 가입 정보
        if (/가입|보험|개월 이내|년 이내/.test(trimmed)) {
            result.insuranceInfo.push(trimmed);
        }
    }

    if (currentEvent) {
        result.events.push(currentEvent);
    }

    result.hospitals = Array.from(result.hospitals);

    return result;
}

/**
 * 현재 출력 결과 분석
 */
function analyzeCurrentOutput(resultData) {
    const analysis = {
        patientName: resultData?.normalizedReport?.header?.patientName || 'N/A',
        medicalRecords: [],
        hospitals: new Set(),
        dates: [],
        diagnoses: [],
        issues: []
    };

    const records = resultData?.normalizedReport?.medicalRecords || [];

    for (const record of records) {
        // 날짜 추출
        if (record.date && record.date !== '' && record.date !== 'yyyy-mm-dd') {
            analysis.dates.push(record.date);
        }

        // 병원명 분석
        if (record.hospital) {
            // OCR 노이즈 탐지
            if (record.hospital.length > 50 || /\d{5,}/.test(record.hospital)) {
                analysis.issues.push({
                    type: 'noisy_hospital',
                    value: record.hospital.substring(0, 100)
                });
            } else if (record.hospital.length > 2) {
                analysis.hospitals.add(record.hospital);
            }
        }

        // 진단명 분석
        if (record.diagnosis && record.diagnosis !== '미확인') {
            analysis.diagnoses.push(record.diagnosis);
        }

        analysis.medicalRecords.push(record);
    }

    analysis.hospitals = Array.from(analysis.hospitals);

    return analysis;
}

/**
 * 비교 분석 수행
 */
function compareResults(expected, current) {
    const comparison = {
        dateMatch: { expected: expected.dates.length, found: current.dates.length, missing: [] },
        hospitalMatch: { expected: expected.hospitals.length, found: current.hospitals.length, missing: [] },
        diagnosisMatch: { expected: expected.diagnoses.length, found: current.diagnoses.length, missing: [] },
        issues: current.issues,
        insights: []
    };

    // 날짜 비교
    const expectedDatesSet = new Set(expected.dates);
    const currentDatesSet = new Set(current.dates);
    for (const date of expected.dates) {
        if (!currentDatesSet.has(date)) {
            comparison.dateMatch.missing.push(date);
        }
    }

    // 병원 비교
    const currentHospitalsLower = new Set(current.hospitals.map(h => h.toLowerCase()));
    for (const hospital of expected.hospitals) {
        const found = current.hospitals.some(h =>
            h.includes(hospital) || hospital.includes(h) ||
            h.toLowerCase().includes(hospital.toLowerCase())
        );
        if (!found) {
            comparison.hospitalMatch.missing.push(hospital);
        }
    }

    // 진단 비교
    const currentDiagSet = new Set(current.diagnoses);
    for (const diag of expected.diagnoses) {
        if (!currentDiagSet.has(diag) && !current.diagnoses.some(d => d.includes(diag))) {
            comparison.diagnosisMatch.missing.push(diag);
        }
    }

    // 인사이트 생성
    if (comparison.dateMatch.missing.length > 0) {
        comparison.insights.push({
            category: 'DATE_EXTRACTION',
            severity: 'HIGH',
            description: `${comparison.dateMatch.missing.length}개 날짜 누락`,
            recommendation: '날짜 패턴 인식 강화 필요 (YYYY.MM.DD, YYYY-MM-DD 등 다양한 형식)'
        });
    }

    if (comparison.hospitalMatch.missing.length > 0) {
        comparison.insights.push({
            category: 'HOSPITAL_EXTRACTION',
            severity: 'HIGH',
            description: `${comparison.hospitalMatch.missing.length}개 병원명 누락: ${comparison.hospitalMatch.missing.join(', ')}`,
            recommendation: 'OCR 노이즈 필터링 및 병원명 패턴 매칭 강화'
        });
    }

    if (comparison.diagnosisMatch.missing.length > 0) {
        comparison.insights.push({
            category: 'DIAGNOSIS_EXTRACTION',
            severity: 'HIGH',
            description: `${comparison.diagnosisMatch.missing.length}개 진단(ICD 코드) 누락`,
            recommendation: 'ICD 코드 패턴 인식 및 한글 진단명 매핑 강화'
        });
    }

    if (comparison.issues.length > 0) {
        comparison.insights.push({
            category: 'DATA_QUALITY',
            severity: 'MEDIUM',
            description: `${comparison.issues.length}개 노이즈 데이터 발견`,
            recommendation: 'OCR 노이즈 필터링 및 데이터 정제 로직 강화'
        });
    }

    return comparison;
}

/**
 * 메인 분석 실행
 */
async function main() {
    console.log('='.repeat(60));
    console.log('케이스 샘플 비교 분석 (전체)');
    console.log('='.repeat(60));

    // 모든 케이스 번호 동적 탐지
    const files = fs.readdirSync(CASE_SAMPLE_DIR);
    const casesToAnalyze = [...new Set(
        files
            .filter(f => f.match(/^Case(\d+)_report\.txt$/i))
            .map(f => parseInt(f.match(/^Case(\d+)_report\.txt$/i)[1]))
    )].sort((a, b) => a - b);

    console.log(`\n총 ${casesToAnalyze.length}개 케이스 분석 시작...\n`);

    const allInsights = [];

    for (const caseNum of casesToAnalyze) {
        console.log(`\n--- Case ${caseNum} 분석 ---`);

        // Expected report 로드
        const reportPath = path.join(CASE_SAMPLE_DIR, `Case${caseNum}_report.txt`);
        if (!fs.existsSync(reportPath)) {
            console.log(`  ⚠️ Case${caseNum}_report.txt 없음`);
            continue;
        }

        const expectedContent = fs.readFileSync(reportPath, 'utf-8');
        const expected = parseExpectedReport(expectedContent);

        // Current result 로드  
        const resultPath = path.join(TEST_OUTPUT_DIR, `case${caseNum}_extended_result.json`);
        if (!fs.existsSync(resultPath)) {
            console.log(`  ⚠️ case${caseNum}_extended_result.json 없음`);
            continue;
        }

        const resultData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
        const current = analyzeCurrentOutput(resultData.fullResult);

        // 비교
        const comparison = compareResults(expected, current);

        console.log(`  📅 날짜: expected=${expected.dates.length}, found=${current.dates.length}, missing=${comparison.dateMatch.missing.length}`);
        console.log(`  🏥 병원: expected=${expected.hospitals.length}, found=${current.hospitals.length}, missing=${comparison.hospitalMatch.missing.length}`);
        console.log(`  🩺 진단: expected=${expected.diagnoses.length}, found=${current.diagnoses.length}, missing=${comparison.diagnosisMatch.missing.length}`);
        console.log(`  ⚠️ 노이즈 이슈: ${comparison.issues.length}건`);

        allInsights.push({
            caseNumber: caseNum,
            comparison,
            expected: {
                dates: expected.dates,
                hospitals: expected.hospitals,
                diagnoses: expected.diagnoses
            },
            current: {
                dates: current.dates.slice(0, 10),
                hospitals: current.hospitals.slice(0, 10),
                diagnoses: current.diagnoses.slice(0, 10)
            }
        });
    }

    // 종합 인사이트 생성
    console.log('\n' + '='.repeat(60));
    console.log('종합 인사이트');
    console.log('='.repeat(60));

    const insightSummary = {
        dateExtraction: { issues: 0, recommendations: [] },
        hospitalExtraction: { issues: 0, recommendations: [] },
        diagnosisExtraction: { issues: 0, recommendations: [] },
        dataQuality: { issues: 0, recommendations: [] }
    };

    for (const caseResult of allInsights) {
        for (const insight of caseResult.comparison.insights) {
            switch (insight.category) {
                case 'DATE_EXTRACTION':
                    insightSummary.dateExtraction.issues++;
                    if (!insightSummary.dateExtraction.recommendations.includes(insight.recommendation)) {
                        insightSummary.dateExtraction.recommendations.push(insight.recommendation);
                    }
                    break;
                case 'HOSPITAL_EXTRACTION':
                    insightSummary.hospitalExtraction.issues++;
                    if (!insightSummary.hospitalExtraction.recommendations.includes(insight.recommendation)) {
                        insightSummary.hospitalExtraction.recommendations.push(insight.recommendation);
                    }
                    break;
                case 'DIAGNOSIS_EXTRACTION':
                    insightSummary.diagnosisExtraction.issues++;
                    if (!insightSummary.diagnosisExtraction.recommendations.includes(insight.recommendation)) {
                        insightSummary.diagnosisExtraction.recommendations.push(insight.recommendation);
                    }
                    break;
                case 'DATA_QUALITY':
                    insightSummary.dataQuality.issues++;
                    if (!insightSummary.dataQuality.recommendations.includes(insight.recommendation)) {
                        insightSummary.dataQuality.recommendations.push(insight.recommendation);
                    }
                    break;
            }
        }
    }

    console.log('\n📊 분석 결과:');
    console.log(`  1. 날짜 추출: ${insightSummary.dateExtraction.issues}건 이슈`);
    console.log(`  2. 병원 추출: ${insightSummary.hospitalExtraction.issues}건 이슈`);
    console.log(`  3. 진단 추출: ${insightSummary.diagnosisExtraction.issues}건 이슈`);
    console.log(`  4. 데이터 품질: ${insightSummary.dataQuality.issues}건 이슈`);

    console.log('\n💡 개선 권장사항:');
    for (const [category, data] of Object.entries(insightSummary)) {
        if (data.recommendations.length > 0) {
            console.log(`\n  [${category}]`);
            data.recommendations.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        }
    }

    // 결과 저장
    const outputPath = path.join(__dirname, 'case_comparison_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        casesAnalyzed: casesToAnalyze,
        results: allInsights,
        summary: insightSummary
    }, null, 2));

    console.log(`\n✅ 분석 결과 저장: ${outputPath}`);
}

main().catch(console.error);
