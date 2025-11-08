import fetch from 'node-fetch';

async function testPostProcess() {
    try {
        console.log('후처리 파이프라인 테스트 시작...');
        
        // OCR에서 추출된 의료 텍스트 사용
        const medicalText = `환자명: 김철수
생년월일: 1980-05-15
진료일: 2024-01-15

진단명: 급성 위염
처방: 
- 위장약 1일 3회 복용
- 충분한 휴식

의사 소견:
환자가 복통을 호소하여 내원하였으며, 검사 결과 급성 위염으로 진단됨.
약물 치료와 함께 식이요법을 병행할 것을 권함.`;

        // 1. 후처리 헬스 체크
        console.log('\n1. 후처리 서비스 상태 확인...');
        const healthResponse = await fetch('http://localhost:3030/api/postprocess/health');
        console.log('헬스 체크 응답 코드:', healthResponse.status);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('헬스 체크 결과:', JSON.stringify(healthData, null, 2));
        }

        // 2. 후처리 파이프라인 실행
        console.log('\n2. 후처리 파이프라인 실행...');
        const processResponse = await fetch('http://localhost:3030/api/postprocess/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ocrText: medicalText,
                options: {
                    useAIExtraction: true,
                    generateReport: true
                }
            })
        });

        console.log('후처리 응답 코드:', processResponse.status);
        
        if (processResponse.ok) {
            const processData = await processResponse.json();
            console.log('후처리 결과:', JSON.stringify(processData, null, 2));
            console.log('✅ 후처리 파이프라인 성공!');
        } else {
            const errorData = await processResponse.text();
            console.log('❌ 후처리 실패:', errorData);
        }
        
    } catch (error) {
        console.error('후처리 테스트 실패:', error.message);
    }
}

testPostProcess();