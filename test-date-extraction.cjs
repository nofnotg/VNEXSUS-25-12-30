/**
 * 날짜 추출 기능 검증 및 보고서 품질 확인 테스트
 * 하이브리드 파이프라인의 날짜 처리 능력을 종합적으로 검증
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3030';

// 다양한 날짜 패턴을 포함한 테스트 문서들
const testDocuments = [
  {
    name: '기본 날짜 패턴',
    text: `
환자명: 김철수
생년월일: 1985-03-15
진료일: 2024-01-15
입원일: 2024년 1월 10일
퇴원일: 2024/01/20
다음 진료일: 2024.02.15
    `.trim()
  },
  {
    name: '복합 날짜 패턴',
    text: `
환자명: 이영희
생년월일: 1990년 5월 3일
초진일: 2023-12-01
재진일: 2024년 1월 5일, 2024년 1월 19일
수술일: 2024/01/25 오전 9시
퇴원예정일: 2024.02.01
    `.trim()
  },
  {
    name: '상대적 날짜 표현',
    text: `
환자명: 박민수
오늘: 2024-01-15
어제 발생한 증상
3일 전부터 시작된 두통
1주일 후 재검사 예정
2주 후 수술 계획
한 달 전 검사 결과
    `.trim()
  },
  {
    name: '의료 특화 날짜',
    text: `
환자명: 최수진
진료일: 2024-01-15
발병일: 2023년 12월 중순
증상 지속기간: 3주간
투약 시작일: 2024년 1월 1일부터
투약 종료일: 2024년 1월 31일까지
경과 관찰 기간: 6개월
    `.trim()
  }
];

async function testDateExtraction() {
  console.log('📅 날짜 추출 기능 검증 및 보고서 품질 확인 테스트 시작');
  console.log('=' .repeat(70));

  const results = [];

  for (let i = 0; i < testDocuments.length; i++) {
    const doc = testDocuments[i];
    console.log(`\n📄 테스트 ${i + 1}: ${doc.name}`);
    console.log('-' .repeat(50));

    try {
      const processRequest = {
        files: [{
          filename: `test-${i + 1}.txt`,
          content: doc.text,
          text: doc.text,
          size: doc.text.length,
          mimetype: 'text/plain'
        }],
        config: {
          enableDetailedAnalysis: true,
          enablePerformanceMetrics: true,
          qualityThreshold: 0.8,
          enableFallback: true
        }
      };

      const startTime = Date.now();
      const response = await axios.post(
        `${API_BASE_URL}/api/hybrid/process`,
        processRequest,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      const processingTime = Date.now() - startTime;

      console.log(`✅ 처리 완료 (${processingTime}ms)`);
      
      const result = response.data.result;
      const testResult = {
        documentName: doc.name,
        processingTime,
        success: true,
        extractedDates: [],
        extractedEntities: {},
        qualityMetrics: {},
        errors: []
      };

      // 날짜 추출 결과 분석
      if (result && result.dates) {
        console.log(`📅 추출된 날짜: ${result.dates.length}개`);
        result.dates.forEach((date, index) => {
          console.log(`  ${index + 1}. "${date.original}" → ${date.normalized} (신뢰도: ${date.confidence || 'N/A'})`);
          testResult.extractedDates.push({
            original: date.original,
            normalized: date.normalized,
            confidence: date.confidence,
            type: date.type || 'unknown'
          });
        });
      } else {
        console.log('⚠️ 날짜 추출 결과 없음');
      }

      // 엔티티 추출 결과 분석
      if (result && result.entities) {
        console.log('👤 추출된 엔티티:');
        Object.keys(result.entities).forEach(key => {
          if (result.entities[key]) {
            console.log(`  - ${key}: ${result.entities[key]}`);
            testResult.extractedEntities[key] = result.entities[key];
          }
        });
      }

      // 품질 메트릭 분석
      if (response.data.hybrid) {
        const hybrid = response.data.hybrid;
        testResult.qualityMetrics = {
          qualityScore: hybrid.qualityScore,
          confidence: hybrid.confidence,
          processingMode: hybrid.processingMode
        };
        console.log('📊 품질 메트릭:');
        console.log(`  - 품질 점수: ${hybrid.qualityScore || 'N/A'}`);
        console.log(`  - 신뢰도: ${hybrid.confidence || 'N/A'}`);
        console.log(`  - 처리 모드: ${hybrid.processingMode || 'N/A'}`);
      }

      // 파이프라인 단계 분석
      if (response.data.hybrid && response.data.hybrid.pipelineStages) {
        console.log('🔄 파이프라인 단계:');
        response.data.hybrid.pipelineStages.forEach((stage, index) => {
          console.log(`  ${index + 1}. ${stage.name}: ${stage.status} (${stage.duration}ms)`);
        });
      }

      results.push(testResult);

    } catch (error) {
      console.error(`❌ 테스트 실패: ${error.message}`);
      results.push({
        documentName: doc.name,
        success: false,
        error: error.message,
        processingTime: 0,
        extractedDates: [],
        extractedEntities: {},
        qualityMetrics: {}
      });
    }
  }

  // 종합 결과 분석
  console.log('\n' + '=' .repeat(70));
  console.log('📊 종합 결과 분석');
  console.log('=' .repeat(70));

  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  console.log(`\n📈 전체 통계:`);
  console.log(`- 총 테스트: ${results.length}`);
  console.log(`- 성공: ${successfulTests.length}`);
  console.log(`- 실패: ${failedTests.length}`);
  console.log(`- 성공률: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`);

  if (successfulTests.length > 0) {
    const avgProcessingTime = successfulTests.reduce((sum, r) => sum + r.processingTime, 0) / successfulTests.length;
    const totalDatesExtracted = successfulTests.reduce((sum, r) => sum + r.extractedDates.length, 0);
    
    console.log(`\n⏱️ 성능 메트릭:`);
    console.log(`- 평균 처리 시간: ${avgProcessingTime.toFixed(0)}ms`);
    console.log(`- 총 추출된 날짜: ${totalDatesExtracted}개`);
    console.log(`- 테스트당 평균 날짜: ${(totalDatesExtracted / successfulTests.length).toFixed(1)}개`);

    // 날짜 패턴별 분석
    console.log(`\n📅 날짜 패턴 분석:`);
    successfulTests.forEach(test => {
      console.log(`- ${test.documentName}: ${test.extractedDates.length}개 날짜 추출`);
      test.extractedDates.forEach(date => {
        console.log(`  └ ${date.original} → ${date.normalized}`);
      });
    });

    // 품질 점수 분석
    const qualityScores = successfulTests
      .map(r => r.qualityMetrics.qualityScore)
      .filter(score => score !== undefined && score !== null);
    
    if (qualityScores.length > 0) {
      const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
      console.log(`\n🎯 품질 분석:`);
      console.log(`- 평균 품질 점수: ${avgQuality.toFixed(3)}`);
      console.log(`- 최고 품질 점수: ${Math.max(...qualityScores).toFixed(3)}`);
      console.log(`- 최저 품질 점수: ${Math.min(...qualityScores).toFixed(3)}`);
    }
  }

  if (failedTests.length > 0) {
    console.log(`\n❌ 실패한 테스트:`);
    failedTests.forEach(test => {
      console.log(`- ${test.documentName}: ${test.error}`);
    });
  }

  // 권장사항 제시
  console.log(`\n💡 권장사항:`);
  if (successfulTests.length === results.length) {
    console.log('✅ 모든 테스트가 성공적으로 완료되었습니다.');
  } else {
    console.log('⚠️ 일부 테스트가 실패했습니다. 오류 로그를 확인하세요.');
  }

  const avgDatesPerTest = successfulTests.length > 0 
    ? successfulTests.reduce((sum, r) => sum + r.extractedDates.length, 0) / successfulTests.length 
    : 0;

  if (avgDatesPerTest < 2) {
    console.log('📅 날짜 추출 성능이 낮습니다. 날짜 패턴 인식 로직을 개선하세요.');
  } else if (avgDatesPerTest >= 3) {
    console.log('📅 날짜 추출 성능이 우수합니다.');
  }

  console.log('\n' + '=' .repeat(70));
  console.log('🎉 날짜 추출 기능 검증 완료!');

  return {
    success: failedTests.length === 0,
    totalTests: results.length,
    successfulTests: successfulTests.length,
    failedTests: failedTests.length,
    results
  };
}

// 테스트 실행
if (require.main === module) {
  testDateExtraction()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 모든 날짜 추출 테스트 통과');
        process.exit(0);
      } else {
        console.log('\n❌ 일부 날짜 추출 테스트 실패');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('테스트 실행 중 오류:', error);
      process.exit(1);
    });
}

module.exports = { testDateExtraction };