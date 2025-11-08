const axios = require('axios');

// 실제 의료 기록 데이터가 있는 테스트 케이스
const testData = {
  jobId: "visit_analysis_test",
  options: {
    enableVisitAnalysis: true,
    enableDetailedAnalysis: true
  }
};

async function testVisitAnalysis() {
  try {
    console.log('=== 의료 기록 데이터가 있는 방문 분석 테스트 ===');
    
    const response = await axios.post('http://localhost:3030/api/enhanced-report/generate-enhanced-report', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('응답 상태:', response.status);
    console.log('응답 데이터 구조:');
    console.log('- success:', response.data.success);
    console.log('- jobId:', response.data.jobId);
    console.log('- results 존재:', !!response.data.results);
    
    if (response.data.results && response.data.results.normalizedReport) {
      const normalizedReport = response.data.results.normalizedReport;
      console.log('- normalizedReport 존재:', !!normalizedReport);
      console.log('- medicalRecords 존재:', !!normalizedReport.medicalRecords);
      console.log('- medicalRecords 길이:', normalizedReport.medicalRecords?.length || 0);
      console.log('- visitAnalysis 존재:', !!normalizedReport.visitAnalysis);
      console.log('- visitAnalysis 값:', normalizedReport.visitAnalysis);
      
      if (normalizedReport.medicalRecords && normalizedReport.medicalRecords.length > 0) {
        console.log('- 첫 번째 의료 기록:', JSON.stringify(normalizedReport.medicalRecords[0], null, 2));
      }
    }

  } catch (error) {
    console.error('테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

testVisitAnalysis();