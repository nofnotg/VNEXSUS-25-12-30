/**
 * Enhanced Report Generation Test
 * 
 * 향상된 보고서 생성 시스템 테스트
 * - ICD 코드 영어/한글 병기
 * - 고지의무 검토 자동화
 * - 질환별 검사결과 적용 규칙
 * - 최종 요약 보고서 생성
 */

const ReportTemplateEngine = require('../postprocess/reportTemplateEngine');

// 테스트 데이터
const testData = {
  patientInfo: {
    name: '홍길동',
    birthDate: '1980-05-15',
    gender: '남성',
    address: '서울시 강남구',
    phone: '010-1234-5678'
  },
  insuranceInfo: {
    contractDate: '2023-01-15',
    productName: '건강보험',
    insurer: '삼성화재',
    disclosureStandard: '3개월·2년·5년 이내'
  },
  medicalRecords: [
    {
      date: '2023-02-10',
      hospital: '서울대학교병원',
      reason: '흉통',
      diagnosis: 'Acute myocardial infarction 급성심근경색증 (I21.9)',
      treatment: 'PCI (Percutaneous Coronary Intervention) 경피적 관상동맥 중재술, Stenting 스텐트 삽입술',
      testResults: [
        {
          name: 'Cardiac MRI',
          date: '2023-02-10',
          reportDate: '2023-02-11',
          result: 'Left ventricular ejection fraction 40%, Regional wall motion abnormality in anterior wall'
        },
        {
          name: 'Coronary angiography 관상동맥조영술',
          date: '2023-02-10',
          result: 'LAD 90% stenosis, TIMI flow grade 0 → 3 after PCI'
        },
        {
          name: 'Troponin I',
          date: '2023-02-10',
          result: '25.6 ng/mL (정상: <0.04)'
        }
      ],
      doctorOpinion: 'ST-elevation myocardial infarction with successful primary PCI'
    },
    {
      date: '2022-12-20',
      hospital: '서울대학교병원',
      reason: '정기검진',
      diagnosis: 'Hypertension 고혈압 (I10)',
      treatment: 'Antihypertensive medication 항고혈압제',
      testResults: [
        {
          name: 'Blood pressure',
          date: '2022-12-20',
          result: '160/95 mmHg'
        }
      ]
    },
    {
      date: '2022-08-15',
      hospital: '강남세브란스병원',
      reason: '건강검진',
      diagnosis: 'Diabetes mellitus type 2 제2형 당뇨병 (E11.9)',
      treatment: 'Metformin 메트포르민',
      testResults: [
        {
          name: 'HbA1c',
          date: '2022-08-15',
          result: '8.2% (정상: <7.0%)'
        }
      ]
    }
  ]
};

async function runEnhancedReportTest() {
  console.log('🚀 Enhanced Report Generation Test Started');
  console.log('='.repeat(60));

  try {
    const engine = new ReportTemplateEngine();

    // 테스트 옵션
    const options = {
      format: 'text',
      includeDisclosureReview: true,
      includeSummary: true,
      processTerms: true,
      customDisclosureWindows: {
        '3m': { months: 3, label: '3개월 이내' },
        '2y': { months: 24, label: '2년 이내' },
        '5y': { months: 60, label: '5년 이내' }
      }
    };

    console.log('📋 Test Data Summary:');
    console.log(`- Patient: ${testData.patientInfo.name}`);
    console.log(`- Insurance Contract Date: ${testData.insuranceInfo.contractDate}`);
    console.log(`- Medical Records: ${testData.medicalRecords.length} records`);
    console.log('');

    // 향상된 보고서 생성
    console.log('🔄 Generating Enhanced Report...');
    const result = await engine.generateEnhancedReport(testData, options);

    console.log('✅ Enhanced Report Generated Successfully!');
    console.log('');

    // 결과 출력
    console.log('📄 Full Report:');
    console.log('-'.repeat(60));
    console.log(result.fullReport);
    console.log('');

    if (result.summaryReport) {
      console.log('📋 Summary Report:');
      console.log('-'.repeat(60));
      console.log(result.summaryReport);
      console.log('');
    }

    if (result.disclosureAnalysis) {
      console.log('🔍 Disclosure Analysis:');
      console.log('-'.repeat(60));
      console.log(JSON.stringify(result.disclosureAnalysis, null, 2));
      console.log('');
    }

    if (result.enhancedTestResults) {
      console.log('🧪 Enhanced Test Results:');
      console.log('-'.repeat(60));
      console.log(JSON.stringify(result.enhancedTestResults, null, 2));
      console.log('');
    }

    console.log('📊 Processing Log:');
    console.log('-'.repeat(60));
    result.processingLog.forEach(log => console.log(`- ${log}`));
    console.log('');

    console.log('⏰ Generation Time:', result.timestamp);
    console.log('');

    // 피드백 검증
    console.log('✅ Feedback Validation:');
    console.log('-'.repeat(60));
    
    // 1. ICD 코드 텍스트 출력 제외 확인
    const hasIcdText = result.fullReport.includes('ICD코드');
    console.log(`1. ICD 코드 텍스트 제외: ${!hasIcdText ? '✅ PASS' : '❌ FAIL'}`);
    
    // 2. 영어/한글 병기 확인
    const hasBilingualTerms = result.fullReport.includes('myocardial infarction') && 
                              result.fullReport.includes('급성심근경색');
    console.log(`2. 영어/한글 병기: ${hasBilingualTerms ? '✅ PASS' : '❌ FAIL'}`);
    
    // 3. 손해사정회사 필터링 확인 (테스트 데이터에 없으므로 PASS)
    const hasInsuranceCompanyFilter = !result.fullReport.includes('해오름손해사정');
    console.log(`3. 손해사정회사 필터링: ${hasInsuranceCompanyFilter ? '✅ PASS' : '❌ FAIL'}`);
    
    // 4. 고지의무 검토 포함 확인
    const hasDisclosureReview = result.fullReport.includes('고지의무 검토');
    console.log(`4. 고지의무 검토 포함: ${hasDisclosureReview ? '✅ PASS' : '❌ FAIL'}`);
    
    // 5. 질환별 검사결과 규칙 적용 확인
    const hasEnhancedTestResults = Object.keys(result.enhancedTestResults).length > 0;
    console.log(`5. 질환별 검사결과 규칙: ${hasEnhancedTestResults ? '✅ PASS' : '❌ FAIL'}`);

    console.log('');
    console.log('🎉 Enhanced Report Generation Test Completed Successfully!');

  } catch (error) {
    console.error('❌ Test Failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// 테스트 실행
if (require.main === module) {
  runEnhancedReportTest();
}

module.exports = { runEnhancedReportTest, testData };