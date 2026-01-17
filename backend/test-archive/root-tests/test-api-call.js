const fs = require('fs');
const path = require('path');

async function testICDProcessing() {
    try {
        // 테스트 문서 읽기
        const testDocument = fs.readFileSync(path.join(__dirname, 'test-icd-report.txt'), 'utf8');
        
        console.log('=== ICD 코드 처리 테스트 ===\n');
        console.log('입력 문서:');
        console.log(testDocument);
        console.log('\n' + '='.repeat(50) + '\n');
        
        // 백엔드 API 호출
        const response = await fetch('http://localhost:3000/api/process-medical-document', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: testDocument,
                options: {
                    processICD: true,
                    enhancedProcessing: true
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('API 응답:');
        console.log(JSON.stringify(result, null, 2));
        
        // ICD 코드 처리 결과 분석
        if (result.processedText) {
            console.log('\n' + '='.repeat(50));
            console.log('처리된 텍스트에서 ICD 코드 확인:');
            console.log('='.repeat(50));
            
            const icdMatches = result.processedText.match(/[EI][0-9]{2}\.?[0-9]*/g);
            if (icdMatches) {
                console.log('발견된 ICD 코드들:', icdMatches);
                
                // 각 ICD 코드가 어떻게 처리되었는지 확인
                icdMatches.forEach(code => {
                    const regex = new RegExp(`${code}[^\\n]*`, 'g');
                    const matches = result.processedText.match(regex);
                    if (matches) {
                        console.log(`${code} 처리 결과:`, matches);
                    }
                });
            } else {
                console.log('처리된 텍스트에서 ICD 코드를 찾을 수 없습니다.');
            }
        }
        
        // 구조화된 데이터에서 ICD 코드 확인
        if (result.structuredData && result.structuredData.diagnoses) {
            console.log('\n구조화된 진단 데이터:');
            result.structuredData.diagnoses.forEach((diagnosis, index) => {
                console.log(`${index + 1}. ${diagnosis}`);
            });
        }
        
    } catch (error) {
        console.error('테스트 실행 중 오류 발생:', error.message);
        
        // 백엔드 서버가 실행 중인지 확인
        try {
            const healthCheck = await fetch('http://localhost:3000/health');
            if (healthCheck.ok) {
                console.log('백엔드 서버는 실행 중입니다.');
            }
        } catch (healthError) {
            console.log('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        }
    }
}

// 테스트 실행
testICDProcessing();