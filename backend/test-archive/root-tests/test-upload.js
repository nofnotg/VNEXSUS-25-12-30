import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function testFileUpload() {
    try {
        console.log('파일 업로드 테스트 시작...');
        
        // FormData 생성
        const form = new FormData();
        const fileStream = fs.createReadStream('test-sample.txt');
        form.append('files', fileStream);
        
        // 업로드 요청
        const response = await fetch('http://localhost:3030/api/ocr/upload', {
            method: 'POST',
            body: form
        });
        
        const result = await response.text();
        
        console.log('응답 상태:', response.status);
        console.log('응답 내용:', result);
        
        if (response.ok) {
            console.log('✅ 파일 업로드 성공!');
        } else {
            console.log('❌ 파일 업로드 실패');
        }
        
    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.message);
    }
}

testFileUpload();