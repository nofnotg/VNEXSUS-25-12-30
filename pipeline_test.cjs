const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 테스트 케이스 파일 읽기
const case1Path = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
const case1ReportPath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1_report.txt');

console.log('=== 파이프라인 통합 검증 시작 ===');

// 파일 존재 확인
if (!fs.existsSync(case1Path)) {
    console.error('❌ Case1.txt 파일을 찾을 수 없습니다:', case1Path);
    process.exit(1);
}

if (!fs.existsSync(case1ReportPath)) {
    console.error('❌ Case1_report.txt 파일을 찾을 수 없습니다:', case1ReportPath);
    process.exit(1);
}

const case1Content = fs.readFileSync(case1Path, 'utf8');
const case1ExpectedReport = fs.readFileSync(case1ReportPath, 'utf8');

console.log('✅ 테스트 케이스 파일 로드 완료');
console.log(`- Case1.txt 크기: ${case1Content.length} 문자`);
console.log(`- Case1_report.txt 크기: ${case1ExpectedReport.length} 문자`);

// HTTP 요청 함수
function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const protocol = options.port === 443 ? https : http;
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonBody = JSON.parse(body);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: jsonBody
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
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

// 테스트 함수들
async function testAPIStatus() {
    console.log('\n1. API 상태 확인 중...');
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/status',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const response = await makeRequest(options);
        console.log(`✅ API 상태: ${response.statusCode}`);
        console.log('응답:', response.body);
        return response.statusCode === 200;
    } catch (error) {
        console.error('❌ API 상태 확인 실패:', error.message);
        return false;
    }
}

async function testOCRProcessing() {
    console.log('\n2. OCR 처리 테스트 중...');
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/ocr/process-text',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = {
            text: case1Content,
            options: {
                enablePreprocessing: true,
                enablePostprocessing: true
            }
        };

        const response = await makeRequest(options, data);
        console.log(`✅ OCR 처리: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            fs.writeFileSync('ocr_result.json', JSON.stringify(response.body, null, 2));
            console.log('OCR 결과가 ocr_result.json에 저장되었습니다.');
            return response.body;
        } else {
            console.log('응답:', response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ OCR 처리 실패:', error.message);
        return null;
    }
}

async function testPostProcessing() {
    console.log('\n3. 후처리 파이프라인 테스트 중...');
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/postprocess',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = {
            ocrResults: case1Content,
            patientInfo: {
                name: "테스트 환자"
            },
            options: {
                enableAI: true,
                generateReport: true
            }
        };

        const response = await makeRequest(options, data);
        console.log(`✅ 후처리: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            fs.writeFileSync('postprocess_result.json', JSON.stringify(response.body, null, 2));
            console.log('후처리 결과가 postprocess_result.json에 저장되었습니다.');
            return response.body;
        } else {
            console.log('응답:', response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ 후처리 실패:', error.message);
        return null;
    }
}

async function testAdvancedDateAnalysis() {
    console.log('\n4. 고급 날짜 분석 테스트 중...');
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/advanced-date/analyze',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = {
            documentText: case1Content,
            options: {
                minimumConfidence: 0.7,
                groupByRole: true,
                enableAI: true,
                aiProvider: "claude"
            }
        };

        const response = await makeRequest(options, data);
        console.log(`✅ 고급 날짜 분석: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            fs.writeFileSync('date_analysis_result.json', JSON.stringify(response.body, null, 2));
            console.log('날짜 분석 결과가 date_analysis_result.json에 저장되었습니다.');
            return response.body;
        } else {
            console.log('응답:', response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ 고급 날짜 분석 실패:', error.message);
        return null;
    }
}

async function testEnhancedReport() {
    console.log('\n5. 개선된 보고서 생성 테스트 중...');
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/enhanced-report/generate-enhanced-report',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const data = {
            jobId: 'test_case1_' + Date.now(),
            options: {
                enableAI: true,
                includeTimeline: true,
                format: 'detailed'
            }
        };

        const response = await makeRequest(options, data);
        console.log(`✅ 개선된 보고서 생성: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
            fs.writeFileSync('enhanced_report_result.json', JSON.stringify(response.body, null, 2));
            console.log('개선된 보고서 결과가 enhanced_report_result.json에 저장되었습니다.');
            return response.body;
        } else {
            console.log('응답:', response.body);
            return null;
        }
    } catch (error) {
        console.error('❌ 개선된 보고서 생성 실패:', error.message);
        return null;
    }
}

// 결과 비교 함수
function compareResults(generatedReport, expectedReport) {
    console.log('\n=== 결과 비교 분석 ===');
    
    const analysis = {
        formatMatch: false,
        contentMatch: false,
        keywordMatches: [],
        missingKeywords: [],
        additionalContent: [],
        qualityScore: 0
    };

    // 기본 키워드 추출
    const expectedKeywords = expectedReport.match(/\b\w{3,}\b/g) || [];
    const generatedKeywords = generatedReport ? (JSON.stringify(generatedReport).match(/\b\w{3,}\b/g) || []) : [];
    
    // 키워드 매칭 분석
    const uniqueExpected = [...new Set(expectedKeywords.map(k => k.toLowerCase()))];
    const uniqueGenerated = [...new Set(generatedKeywords.map(k => k.toLowerCase()))];
    
    uniqueExpected.forEach(keyword => {
        if (uniqueGenerated.includes(keyword)) {
            analysis.keywordMatches.push(keyword);
        } else {
            analysis.missingKeywords.push(keyword);
        }
    });
    
    // 품질 점수 계산
    analysis.qualityScore = analysis.keywordMatches.length / Math.max(uniqueExpected.length, 1) * 100;
    
    console.log(`키워드 매칭률: ${analysis.qualityScore.toFixed(2)}%`);
    console.log(`매칭된 키워드 수: ${analysis.keywordMatches.length}`);
    console.log(`누락된 키워드 수: ${analysis.missingKeywords.length}`);
    
    return analysis;
}

// 메인 테스트 실행
async function runPipelineTest() {
    console.log('파이프라인 통합 검증을 시작합니다...\n');
    
    const results = {
        apiStatus: false,
        ocrProcessing: null,
        postProcessing: null,
        dateAnalysis: null,
        enhancedReport: null,
        comparison: null
    };

    // 1. API 상태 확인
    results.apiStatus = await testAPIStatus();
    
    if (!results.apiStatus) {
        console.error('❌ API 서버가 응답하지 않습니다. 테스트를 중단합니다.');
        return results;
    }

    // 2. OCR 처리 테스트
    results.ocrProcessing = await testOCRProcessing();
    
    // 3. 후처리 파이프라인 테스트
    results.postProcessing = await testPostProcessing();
    
    // 4. 고급 날짜 분석 테스트
    results.dateAnalysis = await testAdvancedDateAnalysis();
    
    // 5. 개선된 보고서 생성 테스트
    results.enhancedReport = await testEnhancedReport();
    
    // 6. 결과 비교
    if (results.postProcessing || results.enhancedReport) {
        const reportToCompare = results.enhancedReport || results.postProcessing;
        results.comparison = compareResults(reportToCompare, case1ExpectedReport);
    }

    // 최종 결과 요약
    console.log('\n=== 파이프라인 검증 결과 요약 ===');
    console.log(`✅ API 상태: ${results.apiStatus ? '정상' : '실패'}`);
    console.log(`${results.ocrProcessing ? '✅' : '❌'} OCR 처리: ${results.ocrProcessing ? '성공' : '실패'}`);
    console.log(`${results.postProcessing ? '✅' : '❌'} 후처리: ${results.postProcessing ? '성공' : '실패'}`);
    console.log(`${results.dateAnalysis ? '✅' : '❌'} 날짜 분석: ${results.dateAnalysis ? '성공' : '실패'}`);
    console.log(`${results.enhancedReport ? '✅' : '❌'} 개선된 보고서: ${results.enhancedReport ? '성공' : '실패'}`);
    
    if (results.comparison) {
        console.log(`📊 품질 점수: ${results.comparison.qualityScore.toFixed(2)}%`);
    }

    // 결과를 JSON 파일로 저장
    fs.writeFileSync('pipeline_test_results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 전체 테스트 결과가 pipeline_test_results.json에 저장되었습니다.');
    
    return results;
}

// 테스트 실행
runPipelineTest().catch(console.error);