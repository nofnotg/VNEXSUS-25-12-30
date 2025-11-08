import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

async function testUpload() {
  try {
    console.log('=== 파일 업로드 테스트 시작 ===');
    
    // 테스트 파일 생성
    const testContent = '환자명: 홍길동\n진단명: 감기\n처방: 해열제';
    fs.writeFileSync('test-upload-file.txt', testContent);
    
    // FormData 생성
    const formData = new FormData();
    formData.append('files', fs.createReadStream('test-upload-file.txt'));
    
    console.log('API 요청 URL:', 'http://localhost:3030/api/ocr/upload');
    
    // API 요청
    const response = await fetch('http://localhost:3030/api/ocr/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    console.log('응답 상태:', response.status, response.statusText);
    console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('응답 내용:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('업로드 성공! Job ID:', data.jobId);
    } else {
      console.error('업로드 실패:', responseText);
    }
    
  } catch (error) {
    console.error('테스트 오류:', error);
  } finally {
    // 테스트 파일 정리
    if (fs.existsSync('test-upload-file.txt')) {
      fs.unlinkSync('test-upload-file.txt');
    }
  }
}

testUpload();