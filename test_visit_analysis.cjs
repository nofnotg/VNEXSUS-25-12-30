const fs = require('fs');
const path = require('path');

// enhanced-report API 테스트
async function testEnhancedReport() {
    try {
        console.log('=== Enhanced Report API 테스트 시작 ===');
        
        // case5_test.json 파일 읽기
        const testFilePath = path.join(__dirname, 'results', 'case5_test.json');
        const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
        
        console.log('테스트 데이터 로드 완료:', {
            jobId: testData.jobId,
            totalFiles: testData.metadata?.totalFiles,
            hasResults: !!testData.results
        });
        
        // API 호출
        const response = await fetch('http://localhost:3030/api/enhanced-report/generate-enhanced-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('API 응답 상태:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 오류:', errorText);
            return;
        }
        
        const result = await response.json();
        console.log('=== 전체 API 응답 ===');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n=== API 응답 결과 ===');
        console.log('성공:', result.success);
        console.log('jobId:', result.jobId);
        
        if (result.enhancedReport) {
            console.log('\n=== 향상된 보고서 분석 ===');
            console.log('의료 기록 수:', result.enhancedReport.medicalRecords?.length || 0);
            console.log('방문 분석 존재:', !!result.enhancedReport.visitAnalysis);
            
            if (result.enhancedReport.visitAnalysis) {
                console.log('\n=== 방문 분석 상세 ===');
                console.log('방문 분석 타입:', typeof result.enhancedReport.visitAnalysis);
                console.log('방문 분석 내용:', JSON.stringify(result.enhancedReport.visitAnalysis, null, 2));
            } else {
                console.log('\n⚠️ 방문 분석이 null입니다!');
                
                // 의료 기록 확인
                if (result.enhancedReport.medicalRecords) {
                    console.log('\n=== 의료 기록 확인 ===');
                    result.enhancedReport.medicalRecords.forEach((record, index) => {
                        console.log(`기록 ${index + 1}:`, {
                            date: record.date,
                            hospital: record.hospital,
                            diagnosis: record.diagnosis
                        });
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('테스트 실행 중 오류:', error);
    }
}

// 테스트 실행
testEnhancedReport();