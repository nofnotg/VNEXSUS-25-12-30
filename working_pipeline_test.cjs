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

// Case1.txt 파일 읽기
function readCase1() {
    try {
        const casePath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
        return fs.readFileSync(casePath, 'utf8');
    } catch (error) {
        console.log('Case1.txt 파일을 읽을 수 없습니다:', error.message);
        return null;
    }
}

// Case1_report.txt 파일 읽기
function readCase1Report() {
    try {
        const reportPath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1_report.txt');
        return fs.readFileSync(reportPath, 'utf8');
    } catch (error) {
        console.log('Case1_report.txt 파일을 읽을 수 없습니다:', error.message);
        return null;
    }
}

async function testWorkingPipeline() {
    console.log('=== 작동하는 파이프라인 테스트 시작 ===\n');
    
    const caseData = readCase1();
    const expectedReport = readCase1Report();
    
    if (!caseData) {
        console.log('❌ Case1.txt 파일을 읽을 수 없어 테스트를 중단합니다.');
        return;
    }
    
    const results = {
        tests: [],
        summary: {
            total: 0,
            success: 0,
            failed: 0
        }
    };
    
    // 1. API 상태 확인
    console.log('1. API 상태 확인');
    try {
        const statusResult = await testAPI('/api/status');
        console.log(`✅ API 상태: ${statusResult.status}`);
        console.log(`응답:`, statusResult.body);
        results.tests.push({
            name: 'API 상태',
            endpoint: '/api/status',
            success: statusResult.status === 200,
            result: statusResult
        });
    } catch (error) {
        console.log(`❌ API 상태 오류: ${error.message}`);
        results.tests.push({
            name: 'API 상태',
            endpoint: '/api/status',
            success: false,
            error: error.message
        });
    }
    console.log('---\n');
    
    // 2. 코어 엔진 테스트 (올바른 형식)
    console.log('2. 코어 엔진 테스트');
    try {
        const coreEngineData = {
            extractedText: caseData.substring(0, 2000) // 처음 2000자
        };
        const coreResult = await testAPI('/api/core-engine/analyze', 'POST', coreEngineData);
        console.log(`상태: ${coreResult.status}`);
        if (coreResult.body) {
            console.log(`응답 미리보기:`, JSON.stringify(coreResult.body).substring(0, 300) + '...');
        }
        results.tests.push({
            name: '코어 엔진 분석',
            endpoint: '/api/core-engine/analyze',
            success: coreResult.status >= 200 && coreResult.status < 300,
            result: coreResult
        });
    } catch (error) {
        console.log(`❌ 코어 엔진 오류: ${error.message}`);
        results.tests.push({
            name: '코어 엔진 분석',
            endpoint: '/api/core-engine/analyze',
            success: false,
            error: error.message
        });
    }
    console.log('---\n');
    
    // 3. 하이브리드 처리 테스트 (올바른 형식)
    console.log('3. 하이브리드 처리 테스트');
    try {
        const hybridData = {
            document: {
                text: caseData.substring(0, 1500)
            }
        };
        const hybridResult = await testAPI('/api/hybrid/process', 'POST', hybridData);
        console.log(`상태: ${hybridResult.status}`);
        if (hybridResult.body) {
            console.log(`응답 미리보기:`, JSON.stringify(hybridResult.body).substring(0, 300) + '...');
        }
        results.tests.push({
            name: '하이브리드 처리',
            endpoint: '/api/hybrid/process',
            success: hybridResult.status >= 200 && hybridResult.status < 300,
            result: hybridResult
        });
    } catch (error) {
        console.log(`❌ 하이브리드 처리 오류: ${error.message}`);
        results.tests.push({
            name: '하이브리드 처리',
            endpoint: '/api/hybrid/process',
            success: false,
            error: error.message
        });
    }
    console.log('---\n');
    
    // 4. 고급 날짜 분석 테스트
    console.log('4. 고급 날짜 분석 테스트');
    try {
        const dateData = {
            text: caseData.substring(0, 1000),
            analysisType: 'comprehensive'
        };
        const dateResult = await testAPI('/api/advanced-date/analyze', 'POST', dateData);
        console.log(`상태: ${dateResult.status}`);
        if (dateResult.body) {
            console.log(`응답 미리보기:`, JSON.stringify(dateResult.body).substring(0, 300) + '...');
        }
        results.tests.push({
            name: '고급 날짜 분석',
            endpoint: '/api/advanced-date/analyze',
            success: dateResult.status >= 200 && dateResult.status < 300,
            result: dateResult
        });
    } catch (error) {
        console.log(`❌ 고급 날짜 분석 오류: ${error.message}`);
        results.tests.push({
            name: '고급 날짜 분석',
            endpoint: '/api/advanced-date/analyze',
            success: false,
            error: error.message
        });
    }
    console.log('---\n');
    
    // 결과 요약
    results.summary.total = results.tests.length;
    results.summary.success = results.tests.filter(t => t.success).length;
    results.summary.failed = results.summary.total - results.summary.success;
    
    console.log('=== 테스트 결과 요약 ===');
    console.log(`총 테스트: ${results.summary.total}개`);
    console.log(`성공: ${results.summary.success}개`);
    console.log(`실패: ${results.summary.failed}개`);
    console.log(`성공률: ${((results.summary.success / results.summary.total) * 100).toFixed(1)}%`);
    
    // 성공한 테스트들
    const successfulTests = results.tests.filter(t => t.success);
    if (successfulTests.length > 0) {
        console.log('\n✅ 성공한 테스트:');
        successfulTests.forEach(test => {
            console.log(`  - ${test.name} (${test.endpoint})`);
        });
    }
    
    // 실패한 테스트들
    const failedTests = results.tests.filter(t => !t.success);
    if (failedTests.length > 0) {
        console.log('\n❌ 실패한 테스트:');
        failedTests.forEach(test => {
            console.log(`  - ${test.name} (${test.endpoint})`);
            if (test.error) {
                console.log(`    오류: ${test.error}`);
            }
        });
    }
    
    // 결과를 파일로 저장
    fs.writeFileSync('working_pipeline_results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 테스트 결과가 working_pipeline_results.json에 저장되었습니다.');
    
    return results;
}

testWorkingPipeline().catch(console.error);