import fetch from 'node-fetch';

async function checkOcrStatus() {
    try {
        console.log('OCR 상태 확인 시작...');
        
        // 업로드에서 받은 jobId 사용
        const jobId = 'bf13c7b2-3fe2-4d0c-a609-4636f136f61f';
        
        // 상태 확인
        const statusResponse = await fetch(`http://localhost:3030/api/ocr/status/${jobId}`);
        console.log('상태 응답 코드:', statusResponse.status);
        
        const statusData = await statusResponse.json();
        console.log('상태 응답 내용:', JSON.stringify(statusData, null, 2));
        
        // 결과가 완료되었다면 결과도 확인
        if (statusData.status === 'completed') {
            console.log('\n결과 확인 중...');
            const resultResponse = await fetch(`http://localhost:3030/api/ocr/result/${jobId}`);
            console.log('결과 응답 코드:', resultResponse.status);
            
            const resultData = await resultResponse.json();
            console.log('결과 응답 내용:', JSON.stringify(resultData, null, 2));
        }
        
    } catch (error) {
        console.error('OCR 상태 확인 실패:', error.message);
    }
}

checkOcrStatus();