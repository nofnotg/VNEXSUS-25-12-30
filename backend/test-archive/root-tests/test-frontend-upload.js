import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testFrontendUpload() {
    console.log('=== 프론트엔드 파일 업로드 테스트 ===');
    
    try {
        // 테스트 파일 읽기
        const filePath = './test-sample-upload.txt';
        const fileBuffer = fs.readFileSync(filePath);
        
        console.log(`📁 테스트 파일: ${filePath}`);
        console.log(`📄 파일 크기: ${fileBuffer.length} bytes`);
        
        // FormData 생성 (프론트엔드와 동일한 방식)
        const formData = new FormData();
        formData.append('files', fileBuffer, {
            filename: 'test-sample-upload.txt',
            contentType: 'text/plain'
        });
        
        // 프론트엔드에서 사용하는 것과 동일한 URL
        const url = 'http://localhost:3030/api/ocr/upload';
        console.log(`🚀 API 요청: ${url}`);
        
        // fetch 요청 (프론트엔드와 동일한 방식)
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                // CORS 헤더 추가
                'Origin': 'http://localhost:8080'
            }
        });
        
        console.log(`📡 응답 상태: ${response.status} ${response.statusText}`);
        console.log('📋 응답 헤더:');
        response.headers.forEach((value, key) => {
            console.log(`  ${key}: ${value}`);
        });
        
        const responseText = await response.text();
        console.log(`📄 응답 내용: ${responseText}`);
        
        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log(`✅ 업로드 성공!`);
            console.log(`🆔 Job ID: ${data.jobId}`);
            console.log(`📊 상태: ${data.status}`);
            console.log(`🔗 상태 URL: ${data.statusUrl}`);
            console.log(`🔗 결과 URL: ${data.resultUrl}`);
        } else {
            console.log(`❌ 업로드 실패: ${responseText}`);
        }
        
    } catch (error) {
        console.error('💥 오류 발생:', error.message);
        console.error('📚 오류 스택:', error.stack);
    }
}

// 테스트 실행
testFrontendUpload();