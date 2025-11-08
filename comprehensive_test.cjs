const http = require('http');
const fs = require('fs');
const path = require('path');

// API 테스트 함수
function testAPI(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: path,
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
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body
                });
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

// 실제 등록된 API 엔드포인트들
const endpoints = [
    { path: '/api/status', method: 'GET', name: 'API 상태' },
    { path: '/api/enhanced-ocr', method: 'GET', name: '향상된 OCR' },
    { path: '/api/chat', method: 'GET', name: '채팅' },
    { path: '/api/postprocess', method: 'GET', name: '후처리' },
    { path: '/api/core-engine', method: 'GET', name: '코어 엔진' },
    { path: '/api/enhanced-core', method: 'GET', name: '향상된 코어' },
    { path: '/api/dev/studio', method: 'GET', name: '개발 스튜디오' },
    { path: '/api/advanced-date', method: 'GET', name: '고급 날짜 분석' },
    { path: '/api/hybrid', method: 'GET', name: '하이브리드' },
    { path: '/api/rag', method: 'GET', name: 'RAG' },
    { path: '/api/enhanced-report', method: 'GET', name: '향상된 보고서' }
];

// POST 테스트용 엔드포인트들 (텍스트 데이터 포함)
const postEndpoints = [
    { path: '/api/enhanced-ocr/process', method: 'POST', name: '향상된 OCR 처리' },
    { path: '/api/postprocess/analyze', method: 'POST', name: '후처리 분석' },
    { path: '/api/core-engine/analyze', method: 'POST', name: '코어 엔진 분석' },
    { path: '/api/enhanced-core/process', method: 'POST', name: '향상된 코어 처리' },
    { path: '/api/advanced-date/analyze', method: 'POST', name: '고급 날짜 분석' },
    { path: '/api/hybrid/process', method: 'POST', name: '하이브리드 처리' },
    { path: '/api/rag/process', method: 'POST', name: 'RAG 처리' },
    { path: '/api/enhanced-report/generate', method: 'POST', name: '향상된 보고서 생성' }
];

async function runComprehensiveTest() {
    console.log('=== 포괄적 API 엔드포인트 테스트 시작 ===\n');
    
    const results = {
        working: [],
        notFound: [],
        errors: [],
        postTests: []
    };
    
    // GET 엔드포인트 테스트
    console.log('1. GET 엔드포인트 테스트\n');
    for (const endpoint of endpoints) {
        try {
            console.log(`테스트 중: ${endpoint.name} (${endpoint.path})`);
            const result = await testAPI(endpoint.path, endpoint.method);
            
            if (result.status === 200) {
                console.log(`✅ 성공: ${result.status}`);
                results.working.push(endpoint);
            } else if (result.status === 404) {
                console.log(`❌ 404: 엔드포인트 없음`);
                results.notFound.push(endpoint);
            } else {
                console.log(`⚠️  상태: ${result.status}`);
                results.working.push({...endpoint, status: result.status});
            }
            
            if (result.body && result.body.length < 500) {
                console.log(`응답: ${result.body}`);
            }
        } catch (error) {
            console.log(`❌ 오류: ${error.message}`);
            results.errors.push({...endpoint, error: error.message});
        }
        console.log('---');
    }
    
    // POST 엔드포인트 테스트 (Case1.txt 데이터 사용)
    console.log('\n2. POST 엔드포인트 테스트 (Case1.txt 데이터 사용)\n');
    const caseData = readCase1();
    
    if (caseData) {
        for (const endpoint of postEndpoints) {
            try {
                console.log(`테스트 중: ${endpoint.name} (${endpoint.path})`);
                const testData = { text: caseData.substring(0, 1000) }; // 처음 1000자만 사용
                const result = await testAPI(endpoint.path, endpoint.method, testData);
                
                console.log(`상태: ${result.status}`);
                if (result.body && result.body.length < 500) {
                    console.log(`응답: ${result.body}`);
                }
                
                results.postTests.push({
                    ...endpoint,
                    status: result.status,
                    success: result.status >= 200 && result.status < 300
                });
            } catch (error) {
                console.log(`❌ 오류: ${error.message}`);
                results.postTests.push({
                    ...endpoint,
                    error: error.message,
                    success: false
                });
            }
            console.log('---');
        }
    } else {
        console.log('Case1.txt 파일을 찾을 수 없어 POST 테스트를 건너뜁니다.');
    }
    
    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===');
    console.log(`✅ 작동하는 엔드포인트: ${results.working.length}개`);
    console.log(`❌ 404 엔드포인트: ${results.notFound.length}개`);
    console.log(`⚠️  오류 엔드포인트: ${results.errors.length}개`);
    console.log(`📝 POST 테스트: ${results.postTests.length}개`);
    
    // 결과를 파일로 저장
    fs.writeFileSync('comprehensive_test_results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 전체 테스트 결과가 comprehensive_test_results.json에 저장되었습니다.');
    
    return results;
}

runComprehensiveTest().catch(console.error);