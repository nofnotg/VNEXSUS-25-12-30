const ReportTemplateEngine = require('../backend/postprocess/reportTemplateEngine.cjs');

/**
 * 고지의무 분석 통합 테스트
 */
async function testDisclosureIntegration() {
  console.log('=== 고지의무 분석 통합 테스트 시작 ===\n');

  const engine = new ReportTemplateEngine();

  // 테스트 데이터 - 보험가입일 기준으로 다양한 기간의 진료 기록
  const testData = {
    patientInfo: {
      name: '김환자',
      age: 45,
      gender: '남성',
      patientId: 'P001'
    },
    insuranceInfo: {
      contractDate: '2024-06-01',
      policyNumber: 'POL-2024-001',
      insuranceType: '건강보험'
    },
    medicalRecords: [
      {
        date: '2024-05-15', // 가입 3개월 이내
        hospital: '서울대병원',
        diagnosis: '고혈압',
        reason: '정기검진',
        treatment: '혈압약 처방',
        testResults: [
          {
            name: '혈압측정',
            value: '150/90 mmHg',
            normal: false,
            date: '2024-05-15'
          }
        ]
      },
      {
        date: '2023-08-10', // 가입 2년 이내
        hospital: '강남세브란스병원',
        diagnosis: '당뇨병',
        reason: '혈당 이상',
        treatment: '당뇨약 처방',
        testResults: [
          {
            name: '공복혈당',
            value: '180 mg/dL',
            normal: false,
            date: '2023-08-10'
          }
        ]
      },
      {
        date: '2020-03-20', // 가입 5년 이내
        hospital: '삼성서울병원',
        diagnosis: '위염',
        reason: '복통',
        treatment: '위장약 처방',
        testResults: [
          {
            name: '위내시경',
            value: '만성위염 소견',
            normal: false,
            date: '2020-03-20'
          }
        ]
      },
      {
        date: '2018-01-15', // 가입 5년 이전
        hospital: '연세대병원',
        diagnosis: '감기',
        reason: '발열',
        treatment: '해열제 처방',
        testResults: []
      }
    ]
  };

  try {
    // 고지의무 분석이 포함된 향상된 보고서 생성
    const result = await engine.generateEnhancedReport(testData, {
      includeDisclosureReview: true,
      includeSummary: true,
      processTerms: true
    });

    console.log('✅ 보고서 생성 성공\n');

    // 고지의무 분석 결과 검증
    if (result.disclosureAnalysis) {
      console.log('📋 고지의무 분석 결과:');
      console.log(`계약일: ${result.disclosureAnalysis.contractDate}`);
      
      // 기본 분석 결과
      if (result.disclosureAnalysis.periods) {
        console.log('\n기본 분석 - 기간별 진료 기록:');
        Object.entries(result.disclosureAnalysis.periods).forEach(([key, period]) => {
          console.log(`${period.label}: ${period.recordCount}건 (${period.hasRelevantRecords ? '고지의무 대상' : '해당없음'})`);
        });
      }

      // 향상된 분석 결과
      if (result.disclosureAnalysis.enhancedAnalysis) {
        const enhanced = result.disclosureAnalysis.enhancedAnalysis;
        console.log('\n향상된 분석 결과:');
        console.log(`위험도 평가: ${enhanced.riskAssessment?.overallRisk || 'N/A'}`);
        console.log(`총 고지의무 대상 기록: ${enhanced.summary?.totalDisclosureRecords || 0}건`);
        
        if (enhanced.recommendations && enhanced.recommendations.length > 0) {
          console.log('\n권고사항:');
          enhanced.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
          });
        }

        if (enhanced.detailedReport) {
          console.log('\n상세 분석 보고서:');
          console.log(enhanced.detailedReport.substring(0, 200) + '...');
        }
      }
    }

    // 전체 보고서 미리보기
    if (result.fullReport) {
      console.log('\n📄 전체 보고서 미리보기:');
      console.log(result.fullReport.substring(0, 300) + '...\n');
    }

    // 요약 보고서 미리보기
    if (result.summaryReport) {
      console.log('📝 요약 보고서 미리보기:');
      console.log(result.summaryReport.substring(0, 200) + '...\n');
    }

    console.log('✅ 고지의무 분석 통합 테스트 완료!');
    
    // 검증 결과
    const validations = [
      { name: '고지의무 분석 결과 존재', passed: !!result.disclosureAnalysis },
      { name: '향상된 분석 엔진 결과 존재', passed: !!result.disclosureAnalysis?.enhancedAnalysis },
      { name: '위험도 평가 존재', passed: !!result.disclosureAnalysis?.riskAssessment },
      { name: '권고사항 존재', passed: !!result.disclosureAnalysis?.recommendations },
      { name: '상세 보고서 존재', passed: !!result.disclosureAnalysis?.detailedReport },
      { name: '전체 보고서 생성', passed: !!result.fullReport },
      { name: '요약 보고서 생성', passed: !!result.summaryReport }
    ];

    console.log('\n🔍 검증 결과:');
    validations.forEach(validation => {
      console.log(`${validation.passed ? '✅' : '❌'} ${validation.name}`);
    });

    const allPassed = validations.every(v => v.passed);
    console.log(`\n${allPassed ? '🎉 모든 검증 통과!' : '⚠️ 일부 검증 실패'}`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 테스트 실행
testDisclosureIntegration();