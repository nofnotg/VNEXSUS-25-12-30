const http = require('http');

// 프론트엔드 페이지 요청
const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/frontend/',
  method: 'GET'
};

console.log('프론트엔드 페이지 요청 중...');

const req = http.request(options, (res) => {
  console.log(`상태 코드: ${res.statusCode}`);
  console.log(`헤더:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('응답 받음');
    console.log('HTML 길이:', data.length);
    
    // HTML에서 script.js가 포함되어 있는지 확인
    if (data.includes('script.js')) {
      console.log('✅ script.js 파일이 포함되어 있음');
    } else {
      console.log('❌ script.js 파일이 포함되어 있지 않음');
    }
    
    // debugLog 함수가 포함되어 있는지 확인
    if (data.includes('debugLog')) {
      console.log('✅ debugLog 함수가 포함되어 있음');
    } else {
      console.log('❌ debugLog 함수가 포함되어 있지 않음');
    }
  });
});

req.on('error', (e) => {
  console.error(`요청 오류: ${e.message}`);
});

req.end();