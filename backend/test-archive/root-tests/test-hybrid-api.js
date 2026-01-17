/**
 * 하이브리드 파이프라인 API 테스트 스크립트
 * /api/hybrid/process 엔드포인트 기능 검증
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3030';

// 테스트용 의료 문서 샘플
const testDocument = {
  text: `
환자명: 김철수
생년월일: 1985-03-15
진료일: 2024-01-15
진단: 고혈압, 당뇨병
처방: 
- 아모디핀 5mg 1일 1회
- 메트포르민 500mg 1일 2회
증상: 두통, 어지러움
검사결과:
- 혈압: 150/90 mmHg
- 혈당: 180 mg/dL
의사소견: 혈압 및 혈당 조절이 필요함
다음 진료일: 2024-02-15
  `.trim()
};

async function testHybridProcessing() {
  console.log('🚀 하이브리드 파이프라인 API 테스트 시작');
  console.log('=' .repeat(60));

  try {
    // 1. 서버 상태 확인
    console.log('\n📊 서버 상태 확인...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/status`);
    console.log('✅ 서버 상태:', statusResponse.data.message);

    // 2. 하이브리드 시스템 상태 확인
    console.log('\n🔍 하이브리드 시스템 상태 확인...');
    try {
      const hybridStatusResponse = await axios.get(`${API_BASE_URL}/api/hybrid/status`);
      console.log('✅ 하이브리드 시스템 상태:', hybridStatusResponse.data);
    } catch (error) {
      console.log('⚠️ 하이브리드 상태 엔드포인트 응답:', error.response?.status || error.message);
    }

    // 3. 하이브리드 파이프라인 문서 처리 테스트
    console.log('\n📄 하이브리드 파이프라인 문서 처리 테스트...');
    
    const processRequest = {
      document: testDocument,
      options: {
        enableDetailedAnalysis: true,
        enablePerformanceMetrics: true,
        qualityThreshold: 0.8,
        enableFallback: true
      }
    };

    console.log('📤 요청 데이터:', JSON.stringify(processRequest, null, 2));

    const startTime = Date.now();
    const processResponse = await axios.post(
      `${API_BASE_URL}/api/hybrid/process`,
      processRequest,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30초 타임아웃
      }
    );
    const processingTime = Date.now() - startTime;

    console.log('\n✅ 하이브리드 파이프라인 처리 완료!');
    console.log(`⏱️ 처리 시간: ${processingTime}ms`);
    console.log('📋 응답 구조:');
    console.log('- success:', processResponse.data.success);
    console.log('- requestId:', processResponse.data.requestId);
    console.log('- processingTime:', processResponse.data.processingTime);
    
    if (processResponse.data.result) {
      console.log('\n📊 처리 결과:');
      const result = processResponse.data.result;
      
      // 추출된 엔티티 확인
      if (result.entities) {
        console.log('👤 추출된 환자 정보:');
        console.log('- 환자명:', result.entities.patientName || '미추출');
        console.log('- 생년월일:', result.entities.birthDate || '미추출');
        console.log('- 진료일:', result.entities.visitDate || '미추출');
      }

      // 날짜 정보 확인
      if (result.dates) {
        console.log('\n📅 추출된 날짜 정보:');
        console.log('- 총 날짜 수:', result.dates.length || 0);
        result.dates?.forEach((date, index) => {
          console.log(`  ${index + 1}. ${date.original} → ${date.normalized} (신뢰도: ${date.confidence})`);
        });
      }

      // 진단 및 처방 정보 확인
      if (result.medical) {
        console.log('\n🏥 의료 정보:');
        console.log('- 진단:', result.medical.diagnosis || '미추출');
        console.log('- 처방:', result.medical.prescription || '미추출');
      }
    }

    // 하이브리드 시스템 메트릭 확인
    if (processResponse.data.hybrid) {
      console.log('\n🔄 하이브리드 시스템 메트릭:');
      const hybrid = processResponse.data.hybrid;
      console.log('- 처리 모드:', hybrid.processingMode);
      console.log('- 품질 점수:', hybrid.qualityScore);
      console.log('- 신뢰도:', hybrid.confidence);
      
      if (hybrid.pipelineStages) {
        console.log('- 파이프라인 단계:', hybrid.pipelineStages.length);
        hybrid.pipelineStages.forEach((stage, index) => {
          console.log(`  ${index + 1}. ${stage.name}: ${stage.status} (${stage.duration}ms)`);
        });
      }
    }

    // 성능 메트릭 확인
    if (processResponse.data.performance) {
      console.log('\n📈 성능 메트릭:');
      const perf = processResponse.data.performance;
      console.log('- 총 처리 시간:', perf.totalTime || '미측정');
      console.log('- 메모리 사용량:', perf.memoryUsage || '미측정');
      console.log('- CPU 사용률:', perf.cpuUsage || '미측정');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 하이브리드 파이프라인 API 테스트 성공!');
    
    return {
      success: true,
      processingTime,
      result: processResponse.data
    };

  } catch (error) {
    console.error('\n❌ 하이브리드 파이프라인 API 테스트 실패:');
    console.error('에러 메시지:', error.message);
    
    if (error.response) {
      console.error('HTTP 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    } else if (error.request) {
      console.error('요청 실패:', error.request);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 테스트 실행
if (require.main === module) {
  testHybridProcessing()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 모든 테스트 통과');
        process.exit(0);
      } else {
        console.log('\n❌ 테스트 실패');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('테스트 실행 중 오류:', error);
      process.exit(1);
    });
}

module.exports = { testHybridProcessing };