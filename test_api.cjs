const http = require('http');

const data = JSON.stringify({
    jobId: "case5_test",
    options: {
        enableAIFiltering: true,
        enableVisualization: true
    }
});

const options = {
    hostname: 'localhost',
    port: 3030,
    path: '/api/enhanced-report/generate-enhanced-report',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`상태 코드: ${res.statusCode}`);
    console.log(`헤더: ${JSON.stringify(res.headers)}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    
    res.on('end', () => {
        console.log('응답 완료');
        console.log('응답 데이터:', responseData);
    });
});

req.on('error', (e) => {
    console.error(`요청 오류: ${e.message}`);
});

req.write(data);
req.end();