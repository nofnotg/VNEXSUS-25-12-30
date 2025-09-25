const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testFileUpload() {
    try {
        const form = new FormData();
        const fileStream = fs.createReadStream('documents/fixtures/Case1_fulltext.txt');
        form.append('file', fileStream);
        
        console.log('파일 업로드 시작...');
        const response = await fetch('http://localhost:3030/api/intelligence/upload', {
            method: 'POST',
            body: form
        });
        
        const result = await response.json();
        console.log('업로드 결과:', JSON.stringify(result, null, 2));
        
        if (result.jobId) {
            console.log('\n작업 ID:', result.jobId);
            console.log('상태 확인 URL:', `http://localhost:3030/api/ocr/status/${result.jobId}`);
            
            // 잠시 대기 후 상태 확인
            setTimeout(async () => {
                try {
                    const statusResponse = await fetch(`http://localhost:3030/api/ocr/status/${result.jobId}`);
                    const statusResult = await statusResponse.json();
                    console.log('\n작업 상태:', JSON.stringify(statusResult, null, 2));
                } catch (error) {
                    console.error('상태 확인 오류:', error.message);
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('파일 업로드 오류:', error.message);
    }
}

testFileUpload();