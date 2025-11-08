const http = require('http');

console.log('🔍 프론트엔드 서버 상태 확인 중...');

// 프론트엔드 페이지 요청
const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/frontend/index.html',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ 응답 상태: ${res.statusCode}`);
  console.log(`📋 응답 헤더:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 응답 크기: ${data.length} bytes`);
    
    // HTML 내용 분석
    const hasScript = data.includes('script.js');
    const hasDebugLog = data.includes('debugLog');
    const hasFileInput = data.includes('fileInput');
    const hasUploadBtn = data.includes('uploadBtn');
    
    console.log('\n📊 HTML 내용 분석:');
    console.log(`- script.js 포함: ${hasScript ? '✅' : '❌'}`);
    console.log(`- debugLog 함수: ${hasDebugLog ? '✅' : '❌'}`);
    console.log(`- fileInput 요소: ${hasFileInput ? '✅' : '❌'}`);
    console.log(`- uploadBtn 요소: ${hasUploadBtn ? '✅' : '❌'}`);
    
    // script.js 파일도 확인
    checkScriptFile();
  });
});

req.on('error', (err) => {
  console.error('❌ 요청 오류:', err.message);
});

req.end();

function checkScriptFile() {
  console.log('\n🔍 script.js 파일 확인 중...');
  
  const scriptOptions = {
    hostname: 'localhost',
    port: 8080,
    path: '/frontend/script.js',
    method: 'GET'
  };
  
  const scriptReq = http.request(scriptOptions, (res) => {
    console.log(`✅ script.js 응답 상태: ${res.statusCode}`);
    
    let scriptData = '';
    res.on('data', (chunk) => {
      scriptData += chunk;
    });
    
    res.on('end', () => {
      console.log(`📄 script.js 크기: ${scriptData.length} bytes`);
      
      // 스크립트 내용 분석
      const hasDebugLogFunction = scriptData.includes('function debugLog');
      const hasHandleFileSelect = scriptData.includes('function handleFileSelect');
      const hasUploadFiles = scriptData.includes('function uploadFiles');
      const hasAddFiles = scriptData.includes('function addFiles');
      const hasUpdateFileList = scriptData.includes('function updateFileList');
      const hasUpdateUploadButton = scriptData.includes('function updateUploadButton');
      
      console.log('\n📊 script.js 내용 분석:');
      console.log(`- debugLog 함수: ${hasDebugLogFunction ? '✅' : '❌'}`);
      console.log(`- handleFileSelect 함수: ${hasHandleFileSelect ? '✅' : '❌'}`);
      console.log(`- uploadFiles 함수: ${hasUploadFiles ? '✅' : '❌'}`);
      console.log(`- addFiles 함수: ${hasAddFiles ? '✅' : '❌'}`);
      console.log(`- updateFileList 함수: ${hasUpdateFileList ? '✅' : '❌'}`);
      console.log(`- updateUploadButton 함수: ${hasUpdateUploadButton ? '✅' : '❌'}`);
      
      // 디버그 로그 호출 횟수 확인
      const debugLogCalls = (scriptData.match(/debugLog\(/g) || []).length;
      console.log(`- debugLog 호출 횟수: ${debugLogCalls}개`);
      
      console.log('\n✅ 프론트엔드 상태 확인 완료');
    });
  });
  
  scriptReq.on('error', (err) => {
    console.error('❌ script.js 요청 오류:', err.message);
  });
  
  scriptReq.end();
}