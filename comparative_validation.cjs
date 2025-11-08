const http = require('http');
const fs = require('fs');
const path = require('path');

// API 테스트 함수
function testAPI(apiPath, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: apiPath,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsedBody
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// 파일 읽기 함수들
function readCase1() {
    try {
        const casePath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
        return fs.readFileSync(casePath, 'utf8');
    } catch (error) {
        console.log('Case1.txt 파일을 읽을 수 없습니다:', error.message);
        return null;
    }
}

function readCase1Report() {
    try {
        const reportPath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1_report.txt');
        return fs.readFileSync(reportPath, 'utf8');
    } catch (error) {
        console.log('Case1_report.txt 파일을 읽을 수 없습니다:', error.message);
        return null;
    }
}

// 텍스트 유사도 계산 (간단한 키워드 매칭)
function calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().match(/\b\w+\b/g) || [];
    const words2 = text2.toLowerCase().match(/\b\w+\b/g) || [];
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

// 날짜 추출 함수
function extractDates(text) {
    if (!text) return [];
    
    const datePatterns = [
        /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g,
        /\d{1,2}[-./]\d{1,2}[-./]\d{4}/g,
        /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g
    ];
    
    const dates = [];
    datePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            dates.push(...matches);
        }
    });
    
    return [...new Set(dates)]; // 중복 제거
}

// 의료 키워드 추출 함수
function extractMedicalKeywords(text) {
    if (!text) return [];
    
    const medicalKeywords = [
        '진료', '치료', '수술', '검사', '진단', '처방', '약물', '병원', '의원', '클리닉',
        '입원', '외래', '응급', '수술실', '병동', '중환자실', '검진', '상담', '재활',
        '혈압', '당뇨', '고혈압', '심장', '폐', '간', '신장', '뇌', '척추', '관절'
    ];
    
    const foundKeywords = [];
    medicalKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
            foundKeywords.push(keyword);
        }
    });
    
    return foundKeywords;
}

async function runComparativeValidation() {
    console.log('=== 비교 검증 시작 ===\n');
    
    const caseData = readCase1();
    const expectedReport = readCase1Report();
    
    if (!caseData || !expectedReport) {
        console.log('❌ 필요한 파일들을 읽을 수 없어 비교 검증을 중단합니다.');
        return null;
    }
    
    console.log('📄 원본 데이터 정보:');
    console.log(`- Case1.txt 길이: ${caseData.length}자`);
    console.log(`- Case1_report.txt 길이: ${expectedReport.length}자`);
    console.log('---\n');
    
    const validationResults = {
        inputData: {
            originalText: caseData.substring(0, 500) + '...',
            expectedReport: expectedReport.substring(0, 500) + '...',
            originalLength: caseData.length,
            expectedLength: expectedReport.length
        },
        systemOutputs: {},
        comparisons: {},
        summary: {
            totalTests: 0,
            successfulTests: 0,
            failedTests: 0,
            overallScore: 0
        }
    };
    
    // 1. 코어 엔진 분석 테스트
    console.log('1. 코어 엔진 분석 결과 비교');
    try {
        const coreEngineData = { extractedText: caseData };
        const coreResult = await testAPI('/api/core-engine/analyze', 'POST', coreEngineData);
        
        if (coreResult.status === 200) {
            console.log('✅ 코어 엔진 분석 성공');
            validationResults.systemOutputs.coreEngine = coreResult.body;
            
            // 결과 분석
            const coreOutput = JSON.stringify(coreResult.body);
            const similarity = calculateSimilarity(coreOutput, expectedReport);
            const extractedDates = extractDates(coreOutput);
            const expectedDates = extractDates(expectedReport);
            const medicalKeywords = extractMedicalKeywords(coreOutput);
            const expectedKeywords = extractMedicalKeywords(expectedReport);
            
            validationResults.comparisons.coreEngine = {
                similarity: similarity,
                extractedDates: extractedDates,
                expectedDates: expectedDates,
                dateMatchRate: extractedDates.length > 0 ? 
                    extractedDates.filter(d => expectedDates.some(ed => ed.includes(d.substring(0, 7)))).length / extractedDates.length : 0,
                medicalKeywords: medicalKeywords,
                expectedKeywords: expectedKeywords,
                keywordMatchRate: expectedKeywords.length > 0 ? 
                    medicalKeywords.filter(k => expectedKeywords.includes(k)).length / expectedKeywords.length : 0
            };
            
            console.log(`  - 텍스트 유사도: ${(similarity * 100).toFixed(1)}%`);
            console.log(`  - 추출된 날짜: ${extractedDates.length}개`);
            console.log(`  - 의료 키워드: ${medicalKeywords.length}개`);
            validationResults.summary.successfulTests++;
        } else {
            console.log(`❌ 코어 엔진 분석 실패: ${coreResult.status}`);
            validationResults.systemOutputs.coreEngine = { error: coreResult.body };
        }
        validationResults.summary.totalTests++;
    } catch (error) {
        console.log(`❌ 코어 엔진 오류: ${error.message}`);
        validationResults.systemOutputs.coreEngine = { error: error.message };
        validationResults.summary.totalTests++;
    }
    console.log('---\n');
    
    // 2. 하이브리드 처리 테스트
    console.log('2. 하이브리드 처리 결과 비교');
    try {
        const hybridData = { document: { text: caseData } };
        const hybridResult = await testAPI('/api/hybrid/process', 'POST', hybridData);
        
        if (hybridResult.status === 200) {
            console.log('✅ 하이브리드 처리 성공');
            validationResults.systemOutputs.hybrid = hybridResult.body;
            
            // 결과 분석
            const hybridOutput = JSON.stringify(hybridResult.body);
            const similarity = calculateSimilarity(hybridOutput, expectedReport);
            const extractedDates = hybridResult.body.result?.dates || [];
            const expectedDates = extractDates(expectedReport);
            
            validationResults.comparisons.hybrid = {
                similarity: similarity,
                extractedDates: extractedDates.map(d => d.date || d.originalDate),
                expectedDates: expectedDates,
                dateMatchRate: extractedDates.length > 0 ? 
                    extractedDates.filter(d => expectedDates.some(ed => ed.includes((d.date || d.originalDate).substring(0, 7)))).length / extractedDates.length : 0,
                processingTime: hybridResult.body.processingTime,
                entitiesFound: hybridResult.body.result?.entities?.length || 0
            };
            
            console.log(`  - 텍스트 유사도: ${(similarity * 100).toFixed(1)}%`);
            console.log(`  - 추출된 날짜: ${extractedDates.length}개`);
            console.log(`  - 처리 시간: ${hybridResult.body.processingTime}ms`);
            console.log(`  - 발견된 엔티티: ${hybridResult.body.result?.entities?.length || 0}개`);
            validationResults.summary.successfulTests++;
        } else {
            console.log(`❌ 하이브리드 처리 실패: ${hybridResult.status}`);
            validationResults.systemOutputs.hybrid = { error: hybridResult.body };
        }
        validationResults.summary.totalTests++;
    } catch (error) {
        console.log(`❌ 하이브리드 처리 오류: ${error.message}`);
        validationResults.systemOutputs.hybrid = { error: error.message };
        validationResults.summary.totalTests++;
    }
    console.log('---\n');
    
    // 전체 점수 계산
    validationResults.summary.failedTests = validationResults.summary.totalTests - validationResults.summary.successfulTests;
    validationResults.summary.overallScore = validationResults.summary.totalTests > 0 ? 
        (validationResults.summary.successfulTests / validationResults.summary.totalTests) * 100 : 0;
    
    // 품질 평가
    const qualityMetrics = {
        dataAccuracy: 0,
        contentRelevance: 0,
        formatConsistency: 0,
        contextualQuality: 0
    };
    
    // 코어 엔진 품질 평가
    if (validationResults.comparisons.coreEngine) {
        const ce = validationResults.comparisons.coreEngine;
        qualityMetrics.dataAccuracy += ce.dateMatchRate * 25;
        qualityMetrics.contentRelevance += ce.keywordMatchRate * 25;
        qualityMetrics.formatConsistency += (ce.similarity > 0.1 ? 25 : 0);
        qualityMetrics.contextualQuality += ce.similarity * 25;
    }
    
    // 하이브리드 처리 품질 평가
    if (validationResults.comparisons.hybrid) {
        const hy = validationResults.comparisons.hybrid;
        qualityMetrics.dataAccuracy += hy.dateMatchRate * 25;
        qualityMetrics.contentRelevance += (hy.entitiesFound > 0 ? 25 : 0);
        qualityMetrics.formatConsistency += (hy.processingTime < 5000 ? 25 : 0);
        qualityMetrics.contextualQuality += hy.similarity * 25;
    }
    
    validationResults.qualityMetrics = qualityMetrics;
    
    console.log('=== 비교 검증 결과 요약 ===');
    console.log(`총 테스트: ${validationResults.summary.totalTests}개`);
    console.log(`성공: ${validationResults.summary.successfulTests}개`);
    console.log(`실패: ${validationResults.summary.failedTests}개`);
    console.log(`전체 점수: ${validationResults.summary.overallScore.toFixed(1)}%`);
    console.log('\n품질 메트릭:');
    console.log(`- 데이터 정확도: ${qualityMetrics.dataAccuracy.toFixed(1)}%`);
    console.log(`- 내용 관련성: ${qualityMetrics.contentRelevance.toFixed(1)}%`);
    console.log(`- 형식 일관성: ${qualityMetrics.formatConsistency.toFixed(1)}%`);
    console.log(`- 문맥 품질: ${qualityMetrics.contextualQuality.toFixed(1)}%`);
    
    // 결과를 파일로 저장
    fs.writeFileSync('comparative_validation_results.json', JSON.stringify(validationResults, null, 2));
    console.log('\n📄 비교 검증 결과가 comparative_validation_results.json에 저장되었습니다.');
    
    return validationResults;
}

runComparativeValidation().catch(console.error);