import fetch from 'node-fetch';

async function testAIReport() {
    try {
        console.log('AI 보고서 생성 기능 테스트 시작...');
        
        // 의료 텍스트 데이터 (OCR 결과와 유사한 형태)
        const medicalText = `환자명: 김철수
생년월일: 1980-05-15
진료일: 2024-01-15

진단명: 급성 위염
처방: 
- 위장약 1일 3회 복용
- 충분한 휴식

의사 소견:
환자가 복통을 호소하여 내원하였으며, 검사 결과 급성 위염으로 진단됨.
약물 치료와 함께 식이요법을 병행할 것을 권함.

추가 진료 기록:
2024-01-20: 재진료, 증상 호전됨
2024-01-25: 완치 판정`;

        // 1. Intelligence API 헬스 체크
        console.log('\n1. Intelligence 서비스 상태 확인...');
        try {
            const healthResponse = await fetch('http://localhost:3030/api/intelligence/health');
            console.log('Intelligence 헬스 체크 응답 코드:', healthResponse.status);
            
            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                console.log('Intelligence 헬스 체크 결과:', JSON.stringify(healthData, null, 2));
            }
        } catch (error) {
            console.log('Intelligence 헬스 체크 실패:', error.message);
        }

        // 2. Intelligence API로 AI 보고서 생성
        console.log('\n2. Intelligence API로 AI 보고서 생성...');
        const intelligenceResponse = await fetch('http://localhost:3030/api/intelligence/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: medicalText,
                mode: 'intelligence',
                outputFormat: 'timeline',
                costLimit: 1000,
                accuracyThreshold: 0.8,
                options: {
                    generateReport: true,
                    useAIExtraction: true,
                    patientInfo: {
                        name: '김철수',
                        birthDate: '1980-05-15'
                    }
                }
            })
        });

        console.log('Intelligence API 응답 코드:', intelligenceResponse.status);
        
        if (intelligenceResponse.ok) {
            const intelligenceData = await intelligenceResponse.json();
            console.log('Intelligence API 결과:', JSON.stringify(intelligenceData, null, 2));
            
            // Job ID가 있으면 결과 확인
            if (intelligenceData.jobId) {
                console.log('\n3. Intelligence 처리 결과 확인...');
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
                
                const resultResponse = await fetch(`http://localhost:3030/api/intelligence/result/${intelligenceData.jobId}`);
                if (resultResponse.ok) {
                    const resultData = await resultResponse.json();
                    console.log('Intelligence 처리 결과:', JSON.stringify(resultData, null, 2));
                }
            }
            
            console.log('✅ Intelligence API 성공!');
        } else {
            const errorData = await intelligenceResponse.text();
            console.log('❌ Intelligence API 실패:', errorData);
        }

        // 3. Enhanced Report API 테스트 (대안)
        console.log('\n4. Enhanced Report API 테스트...');
        try {
            const reportResponse = await fetch('http://localhost:3030/api/enhanced-report/generate-enhanced-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ocrText: medicalText,
                    patientInfo: {
                        name: '김철수',
                        birthDate: '1980-05-15'
                    },
                    options: {
                        reportType: 'comprehensive',
                        includeTimeline: true,
                        includeAnalysis: true
                    }
                })
            });

            console.log('Enhanced Report API 응답 코드:', reportResponse.status);
            
            if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                console.log('Enhanced Report 결과:', JSON.stringify(reportData, null, 2));
                console.log('✅ Enhanced Report API 성공!');
            } else {
                const errorData = await reportResponse.text();
                console.log('❌ Enhanced Report API 실패:', errorData);
            }
        } catch (error) {
            console.log('Enhanced Report API 오류:', error.message);
        }
        
    } catch (error) {
        console.error('AI 보고서 테스트 실패:', error.message);
    }
}

testAIReport();