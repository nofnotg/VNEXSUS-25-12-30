const http = require('http');

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

// 테스트할 API 엔드포인트들
const endpoints = [
    '/api/status',
    '/api/ocr/process-text',
    '/api/postprocess',
    '/api/enhanced-report/generate-enhanced-report',
    '/api/rag',
    '/api/dev/studio',
    '/api/performance',
    '/api/cache'
];

async function runTests() {
    console.log('=== API 엔드포인트 테스트 시작 ===\n');
    
    for (const endpoint of endpoints) {
        try {
            console.log(`테스트 중: ${endpoint}`);
            const result = await testAPI(endpoint);
            console.log(`✅ 상태: ${result.status}`);
            if (result.body) {
                const bodyPreview = result.body.length > 200 ? 
                    result.body.substring(0, 200) + '...' : result.body;
                console.log(`응답: ${bodyPreview}`);
            }
        } catch (error) {
            console.log(`❌ 오류: ${error.message}`);
        }
        console.log('---');
    }
    
    console.log('\n=== 테스트 완료 ===');
}

runTests().catch(console.error);