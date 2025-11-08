/**
 * Enhanced Report Template Engine
 * 
 * 역할:
 * 1. Report_Sample.txt 형식 유지하면서 RAG 문서 요구사항 통합
 * 2. 고지의무 검토 자동화 (3개월/2년/5년 기준)
 * 3. 질환별 검사결과 적용 규칙 구현
 * 4. 최종 결재용 요약 보고서 자동 생성
 * 5. 의료용어 영어/한글 병기 시스템 통합
 */

const EnhancedMedicalTermProcessor = require('./enhancedMedicalTermProcessor.cjs');
const DisclosureAnalysisEngine = require('./disclosureAnalysisEngine.cjs');

class EnhancedReportTemplateEngine {
  constructor() {
    this.medicalTermProcessor = new EnhancedMedicalTermProcessor();
    this.disclosureAnalysisEngine = new DisclosureAnalysisEngine();
    
    // 고지의무 기준 설정 (기본값: 3개월, 2년, 5년)
    this.disclosureWindows = {
      '3m': { months: 3, label: '3개월 이내' },
      '2y': { months: 24, label: '2년 이내' },
      '5y': { months: 60, label: '5년 이내' }
    };

    // 질환별 검사결과 적용 규칙
    this.diseaseSpecificRules = {
      '협심증': {
        requiredTests: ['흉부 CT', 'Cardiac MRI', 'Coronary CT Angiography', 'MRA', 'Coronary angiography'],
        additionalInfo: ['관상동맥 협착 부위', '협착률(%)', 'TIMI flow']
      },
      '급성심근경색': {
        requiredTests: ['흉부 CT', 'MRI', 'CT-Angio', 'MRA', '심혈관조영술', 'Troponin', 'CK-MB', 'EKG'],
        additionalInfo: ['ST분절 상승', 'PCI', 'stenting', 'TIMI flow']
      },
      '부정맥': {
        requiredTests: ['EKG', '24시간 홀터검사'],
        additionalInfo: ['리듬 형태', '부정맥 종류', '발생빈도', '평균/최대/최소 심박수']
      },
      '뇌혈관질환': {
        requiredTests: ['Brain CT', 'CTA', 'MRI', 'MRA', '뇌혈관조영술'],
        additionalInfo: ['병변 위치', '뇌손상 부위', '범위', '허혈/출혈/혈관폐색']
      },
      '암': {
        requiredTests: ['조직검사', 'Biopsy', 'Pathology'],
        additionalInfo: ['검사일', '보고일', '진단명', '조직검사 소견', 'TNM 병기', '원발/전이 구분']
      }
    };

    // 보고서 템플릿 구조 (Report_Sample.txt 기반)
    this.templateStructure = {
      patientInfo: {
        name: '환자명',
        birthDate: '생년월일',
        gender: '성별',
        address: '주소',
        phone: '연락처'
      },
      insuranceInfo: {
        contractDate: '보험가입일',
        productName: '보험상품명',
        insurer: '보험회사',
        disclosureStandard: '고지의무 기준'
      },
      medicalHistory: {
        visitDate: '내원일시',
        visitReason: '내원경위',
        diagnosis: '진단병명',
        testResults: '검사결과',
        surgicalResults: '수술 후 조직검사 결과',
        treatment: '치료내용',
        treatmentPeriod: '치료기간',
        pastHistory: '과거병력',
        doctorOpinion: '의사소견'
      },
      disclosureReview: {
        within3Months: '3개월 이내 해당사항',
        within2Years: '2년 이내 해당사항',
        within5Years: '5년 이내 해당사항'
      },
      comprehensiveOpinion: {
        summary: '종합 소견',
        recommendation: '권장사항'
      }
    };
  }

  /**
   * 향상된 보고서 생성
   * @param {Object} normalizedData 정규화된 의료 데이터
   * @param {Object} options 생성 옵션
   * @returns {Object} 생성된 보고서
   */
  async generateEnhancedReport(normalizedData, options = {}) {
    const {
      format = 'text',
      includeDisclosureReview = true,
      includeSummary = true,
      processTerms = true,
      customDisclosureWindows = null
    } = options;

    try {
      // 1. 고지의무 기준 설정
      if (customDisclosureWindows) {
        this.disclosureWindows = customDisclosureWindows;
      }

      // 2. 의료용어 처리
      let processedData = normalizedData;
      if (processTerms) {
        processedData = await this.processMedicalTerms(normalizedData);
      }

      // 3. 고지의무 검토 (향상된 분석 엔진 사용)
      let disclosureAnalysis = null;
      if (includeDisclosureReview) {
        // 기존 분석과 향상된 분석 엔진 결과를 결합
        const basicAnalysis = this.analyzeDisclosureObligation(processedData);
        const enhancedAnalysis = this.disclosureAnalysisEngine.generateDisclosureAnalysisReport(
          processedData.insuranceInfo?.contractDate,
          processedData.medicalRecords || [],
          processedData.insuranceInfo?.productType || "3.2.5"
        );
        
        disclosureAnalysis = {
          ...basicAnalysis,
          enhancedAnalysis,
          riskAssessment: enhancedAnalysis.riskAssessment,
          recommendations: enhancedAnalysis.recommendations,
          detailedReport: this.disclosureAnalysisEngine.formatDisclosureAnalysisText(enhancedAnalysis)
        };
      }

      // 4. 질환별 검사결과 적용
      const enhancedTestResults = this.applyDiseaseSpecificRules(processedData);

      // 5. 보고서 데이터 구성
      const reportData = this.buildReportData(processedData, enhancedTestResults, disclosureAnalysis);

      // 6. 보고서 생성
      const fullReport = this.buildFullReport(reportData, format);

      // 7. 최종 요약 보고서 생성
      let summaryReport = null;
      if (includeSummary) {
        summaryReport = this.buildSummaryReport(reportData);
      }

      return {
        fullReport,
        summaryReport,
        disclosureAnalysis,
        enhancedTestResults,
        processingLog: this.generateProcessingLog(processedData, reportData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Enhanced report generation failed:', error);
      throw new Error(`보고서 생성 실패: ${error.message}`);
    }
  }

  /**
   * 의료용어 처리
   * @param {Object} data 의료 데이터
   * @returns {Object} 처리된 데이터
   */
  async processMedicalTerms(data) {
    const processedData = JSON.parse(JSON.stringify(data)); // Deep copy

    // 진료 기록 처리
    if (processedData.medicalRecords) {
      processedData.medicalRecords = processedData.medicalRecords.map(record => {
        const processedRecord = { ...record };
        
        // 진단명 처리
        if (record.diagnosis) {
          const result = this.medicalTermProcessor.processComprehensive(record.diagnosis);
          processedRecord.diagnosis = result.processedText;
        }

        // 치료 내용 처리
        if (record.treatment) {
          const result = this.medicalTermProcessor.processComprehensive(record.treatment);
          processedRecord.treatment = result.processedText;
        }

        // 검사 결과 처리
        if (record.testResults) {
          processedRecord.testResults = record.testResults.map(test => {
            const processedTest = { ...test };
            if (test.result) {
              const result = this.medicalTermProcessor.processComprehensive(test.result);
              processedTest.result = result.processedText;
            }
            return processedTest;
          });
        }

        return processedRecord;
      });
    }

    return processedData;
  }

  /**
   * 고지의무 검토 분석
   * @param {Object} data 의료 데이터
   * @returns {Object} 고지의무 분석 결과
   */
  analyzeDisclosureObligation(data) {
    const contractDate = new Date(data.insuranceInfo?.contractDate);
    const analysis = {
      contractDate: data.insuranceInfo?.contractDate,
      disclosureStandard: this.getDisclosureStandardLabel(),
      periods: {}
    };

    // 각 기간별 분석
    Object.entries(this.disclosureWindows).forEach(([key, window]) => {
      const startDate = new Date(contractDate);
      startDate.setMonth(startDate.getMonth() - window.months);

      const relevantRecords = this.findRecordsInPeriod(data.medicalRecords, startDate, contractDate);
      
      analysis.periods[key] = {
        label: window.label,
        startDate: startDate.toISOString().split('T')[0],
        endDate: contractDate.toISOString().split('T')[0],
        hasRelevantRecords: relevantRecords.length > 0,
        recordCount: relevantRecords.length,
        records: relevantRecords.map(record => ({
          date: record.date,
          hospital: record.hospital,
          diagnosis: record.diagnosis,
          significance: this.assessDisclosureSignificance(record)
        }))
      };
    });

    return analysis;
  }

  /**
   * 기간 내 의료 기록 찾기
   * @param {Array} records 의료 기록 배열
   * @param {Date} startDate 시작일
   * @param {Date} endDate 종료일
   * @returns {Array} 해당 기간 의료 기록
   */
  findRecordsInPeriod(records, startDate, endDate) {
    if (!records) return [];

    return records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  /**
   * 고지의무 중요도 평가
   * @param {Object} record 의료 기록
   * @returns {string} 중요도 ('high', 'medium', 'low')
   */
  assessDisclosureSignificance(record) {
    const highSignificanceKeywords = ['암', '심근경색', '뇌졸중', '수술', '입원'];
    const mediumSignificanceKeywords = ['협심증', '당뇨', '고혈압', '검사'];

    const text = `${record.diagnosis} ${record.treatment}`.toLowerCase();

    if (highSignificanceKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    } else if (mediumSignificanceKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 질환별 검사결과 적용 규칙
   * @param {Object} data 의료 데이터
   * @returns {Object} 향상된 검사 결과
   */
  applyDiseaseSpecificRules(data) {
    const enhancedResults = {};

    if (!data.medicalRecords) return enhancedResults;

    data.medicalRecords.forEach((record, index) => {
      const diagnosis = record.diagnosis?.toLowerCase() || '';
      let applicableRule = null;

      // 질환별 규칙 매칭
      Object.entries(this.diseaseSpecificRules).forEach(([disease, rule]) => {
        if (diagnosis.includes(disease.toLowerCase()) || 
            diagnosis.includes(disease)) {
          applicableRule = { disease, ...rule };
        }
      });

      if (applicableRule) {
        enhancedResults[`record_${index}`] = {
          originalRecord: record,
          applicableDisease: applicableRule.disease,
          requiredTests: applicableRule.requiredTests,
          additionalInfo: applicableRule.additionalInfo,
          enhancedTestResults: this.enhanceTestResults(record.testResults, applicableRule)
        };
      }
    });

    return enhancedResults;
  }

  /**
   * 검사 결과 향상
   * @param {Array} testResults 원본 검사 결과
   * @param {Object} rule 적용 규칙
   * @returns {Array} 향상된 검사 결과
   */
  enhanceTestResults(testResults, rule) {
    if (!testResults) return [];

    return testResults.map(test => {
      const enhancedTest = { ...test };

      // 필수 검사 여부 확인
      const isRequiredTest = rule.requiredTests.some(required => 
        test.name?.toLowerCase().includes(required.toLowerCase())
      );

      if (isRequiredTest) {
        enhancedTest.isRequired = true;
        enhancedTest.diseaseRelevance = rule.disease;
      }

      // 추가 정보 필요 여부 확인
      enhancedTest.additionalInfoNeeded = rule.additionalInfo.filter(info => 
        !test.result?.toLowerCase().includes(info.toLowerCase())
      );

      return enhancedTest;
    });
  }

  /**
   * 보고서 데이터 구성
   * @param {Object} processedData 처리된 데이터
   * @param {Object} enhancedTestResults 향상된 검사 결과
   * @param {Object} disclosureAnalysis 고지의무 분석
   * @returns {Object} 보고서 데이터
   */
  buildReportData(processedData, enhancedTestResults, disclosureAnalysis) {
    return {
      patientInfo: processedData.patientInfo || {},
      insuranceInfo: processedData.insuranceInfo || {},
      medicalHistory: this.buildMedicalHistory(processedData, enhancedTestResults),
      disclosureReview: disclosureAnalysis,
      comprehensiveOpinion: this.buildComprehensiveOpinion(processedData, enhancedTestResults, disclosureAnalysis)
    };
  }

  /**
   * 의료 이력 구성
   * @param {Object} data 처리된 데이터
   * @param {Object} enhancedResults 향상된 검사 결과
   * @returns {Object} 의료 이력
   */
  buildMedicalHistory(data, enhancedResults) {
    const medicalHistory = {};

    if (data.medicalRecords && data.medicalRecords.length > 0) {
      const primaryRecord = data.medicalRecords[0];

      medicalHistory.visitDate = primaryRecord.date;
      medicalHistory.visitReason = primaryRecord.reason || '진료';
      medicalHistory.diagnosis = primaryRecord.diagnosis;
      medicalHistory.testResults = this.formatTestResults(primaryRecord.testResults, enhancedResults);
      medicalHistory.treatment = primaryRecord.treatment;
      medicalHistory.treatmentPeriod = this.calculateTreatmentPeriod(data.medicalRecords);
      medicalHistory.pastHistory = this.extractPastHistory(data.medicalRecords);
      medicalHistory.doctorOpinion = primaryRecord.doctorOpinion || '';

      // 암의 경우 수술 후 조직검사 결과 추가
      if (this.isCancerCase(primaryRecord.diagnosis)) {
        medicalHistory.surgicalResults = this.formatSurgicalResults(primaryRecord.testResults);
      }
    }

    return medicalHistory;
  }

  /**
   * 검사 결과 포맷팅
   * @param {Array} testResults 검사 결과
   * @param {Object} enhancedResults 향상된 결과
   * @returns {string} 포맷된 검사 결과
   */
  formatTestResults(testResults, enhancedResults) {
    if (!testResults) return '';

    return testResults.map(test => {
      let formatted = `${test.name}`;
      if (test.date) formatted += `, ${test.date}`;
      if (test.reportDate) formatted += ` (보고일: ${test.reportDate})`;
      if (test.result) formatted += `, ${test.result}`;
      
      return formatted;
    }).join('\n');
  }

  /**
   * 수술 후 조직검사 결과 포맷팅 (암의 경우)
   * @param {Array} testResults 검사 결과
   * @returns {string} 포맷된 수술 후 조직검사 결과
   */
  formatSurgicalResults(testResults) {
    if (!testResults) return '';

    const surgicalTests = testResults.filter(test => 
      test.name?.toLowerCase().includes('조직검사') ||
      test.name?.toLowerCase().includes('biopsy') ||
      test.name?.toLowerCase().includes('pathology')
    );

    return surgicalTests.map(test => {
      let formatted = `${test.name}`;
      if (test.date) formatted += `, 검사일: ${test.date}`;
      if (test.reportDate) formatted += `, 보고일: ${test.reportDate}`;
      if (test.pathologyFindings) formatted += `, 조직검사 소견: ${test.pathologyFindings}`;
      if (test.tnmStage) formatted += `, 병기: ${test.tnmStage}`;
      
      return formatted;
    }).join('\n');
  }

  /**
   * 암 케이스 여부 확인
   * @param {string} diagnosis 진단명
   * @returns {boolean} 암 케이스 여부
   */
  isCancerCase(diagnosis) {
    if (!diagnosis) return false;
    const cancerKeywords = ['암', 'cancer', 'carcinoma', 'malignant', 'neoplasm'];
    return cancerKeywords.some(keyword => 
      diagnosis.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * 치료 기간 계산
   * @param {Array} records 의료 기록
   * @returns {string} 치료 기간
   */
  calculateTreatmentPeriod(records) {
    if (!records || records.length === 0) return '';

    const dates = records.map(record => new Date(record.date)).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    if (startStr === endStr) {
      return `${startStr} / 1회 통원`;
    } else {
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      return `${startStr} ~ ${endStr} / ${records.length}회 통원 (${daysDiff}일간)`;
    }
  }

  /**
   * 과거 병력 추출
   * @param {Array} records 의료 기록
   * @returns {string} 과거 병력
   */
  extractPastHistory(records) {
    if (!records) return '';

    const pastHistoryKeywords = ['과거력', '기왕력', 'past history', 'previous'];
    const pastHistory = [];

    records.forEach(record => {
      if (record.pastHistory) {
        pastHistory.push(record.pastHistory);
      }
      
      // 진단명에서 과거 병력 추출
      if (record.diagnosis) {
        pastHistoryKeywords.forEach(keyword => {
          if (record.diagnosis.toLowerCase().includes(keyword)) {
            pastHistory.push(record.diagnosis);
          }
        });
      }
    });

    return [...new Set(pastHistory)].join(', ');
  }

  /**
   * 종합 소견 구성
   * @param {Object} data 처리된 데이터
   * @param {Object} enhancedResults 향상된 검사 결과
   * @param {Object} disclosureAnalysis 고지의무 분석
   * @returns {Object} 종합 소견
   */
  buildComprehensiveOpinion(data, enhancedResults, disclosureAnalysis) {
    const opinion = {
      summary: '',
      recommendation: ''
    };

    // 종합 소견 생성
    const summaryParts = [];
    
    if (data.medicalRecords && data.medicalRecords.length > 0) {
      const primaryDiagnosis = data.medicalRecords[0].diagnosis;
      summaryParts.push(`주 진단: ${primaryDiagnosis}`);
    }

    if (disclosureAnalysis) {
      const hasHighSignificance = Object.values(disclosureAnalysis.periods).some(period => 
        period.records.some(record => record.significance === 'high')
      );
      
      if (hasHighSignificance) {
        summaryParts.push('고지의무 검토 필요 사항 존재');
      }
    }

    opinion.summary = summaryParts.join('. ');

    // 권장사항 생성
    const recommendations = [];
    
    if (Object.keys(enhancedResults).length > 0) {
      recommendations.push('질환별 검사결과 규칙에 따른 추가 검토 권장');
    }

    if (disclosureAnalysis?.periods['3m']?.hasRelevantRecords) {
      recommendations.push('보험 가입 3개월 이내 진료 내역에 대한 고지의무 검토 필요');
    }

    opinion.recommendation = recommendations.join('. ');

    return opinion;
  }

  /**
   * 전체 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @param {string} format 출력 형식
   * @returns {string} 전체 보고서
   */
  buildFullReport(reportData, format = 'text') {
    switch (format) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
      case 'html':
        return this.buildHtmlReport(reportData);
      default:
        return this.buildTextReport(reportData);
    }
  }

  /**
   * 텍스트 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @returns {string} 텍스트 보고서
   */
  buildTextReport(reportData) {
    const sections = [];

    // 헤더
    sections.push('='.repeat(60));
    sections.push('손해사정 보고서 (확장형)');
    sections.push('='.repeat(60));
    sections.push('');

    // 환자 정보
    if (reportData.patientInfo) {
      sections.push('[환자 정보]');
      Object.entries(reportData.patientInfo).forEach(([key, value]) => {
        if (value) sections.push(`${key}: ${value}`);
      });
      sections.push('');
    }

    // 보험 정보
    if (reportData.insuranceInfo) {
      sections.push('[보험 정보]');
      Object.entries(reportData.insuranceInfo).forEach(([key, value]) => {
        if (value) sections.push(`${key}: ${value}`);
      });
      sections.push('');
    }

    // 의료 이력
    if (reportData.medicalHistory) {
      sections.push('[의료 이력]');
      const history = reportData.medicalHistory;
      
      if (history.visitDate) sections.push(`내원일시: ${history.visitDate}`);
      if (history.visitReason) sections.push(`내원경위: ${history.visitReason}`);
      if (history.diagnosis) sections.push(`진단병명: ${history.diagnosis}`);
      if (history.testResults) sections.push(`검사결과:\n${history.testResults}`);
      if (history.surgicalResults) sections.push(`수술 후 조직검사 결과:\n${history.surgicalResults}`);
      if (history.treatment) sections.push(`치료내용: ${history.treatment}`);
      if (history.treatmentPeriod) sections.push(`치료기간: ${history.treatmentPeriod}`);
      if (history.pastHistory) sections.push(`과거병력: ${history.pastHistory}`);
      if (history.doctorOpinion) sections.push(`의사소견: ${history.doctorOpinion}`);
      sections.push('');
    }

    // 고지의무 검토
    if (reportData.disclosureReview) {
      sections.push('[고지의무 검토]');
      sections.push(`보험가입일: ${reportData.disclosureReview.contractDate}`);
      sections.push(`고지의무 기준: ${reportData.disclosureReview.disclosureStandard}`);
      sections.push('');

      Object.entries(reportData.disclosureReview.periods).forEach(([key, period]) => {
        sections.push(`${period.label} (${period.startDate} ~ ${period.endDate}):`);
        if (period.hasRelevantRecords) {
          sections.push(`  해당 있음 (${period.recordCount}건)`);
          period.records.forEach(record => {
            sections.push(`  - ${record.date}: ${record.diagnosis} (${record.significance})`);
          });
        } else {
          sections.push('  해당 없음');
        }
        sections.push('');
      });
    }

    // 종합 소견
    if (reportData.comprehensiveOpinion) {
      sections.push('[종합 소견]');
      if (reportData.comprehensiveOpinion.summary) {
        sections.push(`요약: ${reportData.comprehensiveOpinion.summary}`);
      }
      if (reportData.comprehensiveOpinion.recommendation) {
        sections.push(`권장사항: ${reportData.comprehensiveOpinion.recommendation}`);
      }
      sections.push('');
    }

    sections.push('='.repeat(60));
    sections.push(`보고서 생성일시: ${new Date().toLocaleString('ko-KR')}`);
    sections.push('='.repeat(60));

    return sections.join('\n');
  }

  /**
   * 최종 요약 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @returns {string} 요약 보고서
   */
  buildSummaryReport(reportData) {
    const sections = [];

    sections.push('📑 손해사정 보고서 (결재용 요약본)');
    sections.push('');

    const history = reportData.medicalHistory || {};

    sections.push(`- 내원일시: ${history.visitDate || ''}`);
    sections.push(`- 내원경위: ${history.visitReason || ''}`);
    sections.push(`- 진단병명: ${history.diagnosis || ''}`);
    sections.push(`- 검사결과: ${this.summarizeTestResults(history.testResults)}`);
    
    if (history.surgicalResults) {
      sections.push(`- 수술 후 조직검사 결과 (암의 경우만): ${this.summarizeSurgicalResults(history.surgicalResults)}`);
    }
    
    sections.push(`- 치료내용: ${history.treatment || ''}`);
    sections.push(`- 통원기간: ${history.treatmentPeriod || ''}`);
    sections.push(`- 입원기간: ${this.extractHospitalizationPeriod(history.treatmentPeriod)}`);
    sections.push(`- 과거병력: ${history.pastHistory || ''}`);
    sections.push(`- 의사소견: ${history.doctorOpinion || ''}`);

    return sections.join('\n');
  }

  /**
   * 검사 결과 요약
   * @param {string} testResults 검사 결과
   * @returns {string} 요약된 검사 결과
   */
  summarizeTestResults(testResults) {
    if (!testResults) return '';
    
    const lines = testResults.split('\n').filter(line => line.trim());
    if (lines.length <= 2) return testResults;
    
    return lines.slice(0, 2).join(', ') + (lines.length > 2 ? ' 외' : '');
  }

  /**
   * 수술 후 조직검사 결과 요약
   * @param {string} surgicalResults 수술 후 조직검사 결과
   * @returns {string} 요약된 결과
   */
  summarizeSurgicalResults(surgicalResults) {
    if (!surgicalResults) return '';
    
    const lines = surgicalResults.split('\n').filter(line => line.trim());
    return lines[0] || '';
  }

  /**
   * 입원 기간 추출
   * @param {string} treatmentPeriod 치료 기간
   * @returns {string} 입원 기간
   */
  extractHospitalizationPeriod(treatmentPeriod) {
    if (!treatmentPeriod) return '';
    
    if (treatmentPeriod.includes('입원')) {
      return treatmentPeriod;
    }
    return '';
  }

  /**
   * 고지의무 기준 라벨 생성
   * @returns {string} 고지의무 기준 라벨
   */
  getDisclosureStandardLabel() {
    const labels = Object.values(this.disclosureWindows).map(window => window.label);
    return labels.join('·');
  }

  /**
   * 처리 로그 생성
   * @param {Object} originalData 원본 데이터
   * @param {Object} reportData 보고서 데이터
   * @returns {Array} 처리 로그
   */
  generateProcessingLog(originalData, reportData) {
    const log = [];
    
    log.push(`원본 의료 기록 수: ${originalData.medicalRecords?.length || 0}`);
    log.push(`의료용어 처리 완료`);
    log.push(`고지의무 검토 완료`);
    log.push(`질환별 검사결과 규칙 적용 완료`);
    log.push(`보고서 생성 완료`);
    
    return log;
  }

  /**
   * HTML 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @returns {string} HTML 보고서
   */
  buildHtmlReport(reportData) {
    // HTML 보고서 생성 로직 (필요시 구현)
    return `<html><body><h1>손해사정 보고서</h1><pre>${this.buildTextReport(reportData)}</pre></body></html>`;
  }
}

module.exports = EnhancedReportTemplateEngine;