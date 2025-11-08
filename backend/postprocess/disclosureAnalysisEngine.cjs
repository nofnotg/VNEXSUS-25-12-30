/**
 * Disclosure Analysis Engine Module
 * 
 * 역할:
 * 1. 보험가입일 기준 3개월/2년/5년 구간별 고지의무 검토
 * 2. 의료기록 날짜 분석 및 고지의무 대상 진료 자동 분류
 * 3. 고지의무 위반 가능성 분석 및 보고서 생성
 * 4. 질병별 고지의무 기준 적용
 */

class DisclosureAnalysisEngine {
  constructor() {
    // 고지의무 기준 설정 (일 단위)
    this.disclosurePeriods = {
      threeMonths: 90,    // 3개월 = 90일
      twoYears: 730,      // 2년 = 730일
      fiveYears: 1825     // 5년 = 1825일
    };

    // 고지의무 대상 키워드
    this.disclosureKeywords = {
      threeMonths: [
        '의심', '진단', '확정', '새로운', '질병', '입원', '필요', '소견',
        '수술', '추가검사', '재검사', '정밀검사', '조직검사'
      ],
      twoYears: [
        '입원', '수술', '상해', '질병', '치료', '시술', '처치'
      ],
      fiveYears: [
        '암', '협심증', '급성심근경색', '심근경색', '간경화', '뇌경색',
        '뇌출혈', '뇌혈관', '중대질병', '악성종양', 'cancer', 'carcinoma'
      ]
    };

    // 질병별 고지의무 기준
    this.diseaseDisclosureRules = {
      cancer: {
        periods: ['fiveYears'],
        keywords: ['암', 'cancer', 'carcinoma', '악성종양', '종양', '악성신생물'],
        severity: 'critical'
      },
      cardiovascular: {
        periods: ['fiveYears'],
        keywords: ['협심증', '심근경색', '급성심근경색', 'angina', 'myocardial infarction'],
        severity: 'critical'
      },
      cerebrovascular: {
        periods: ['fiveYears'],
        keywords: ['뇌경색', '뇌출혈', '뇌혈관', 'stroke', 'cerebral'],
        severity: 'critical'
      },
      liver: {
        periods: ['fiveYears'],
        keywords: ['간경화', 'cirrhosis', '간암', 'hepatocellular'],
        severity: 'critical'
      },
      general: {
        periods: ['threeMonths', 'twoYears'],
        keywords: ['진단', '의심', '입원', '수술'],
        severity: 'moderate'
      }
    };
  }

  /**
   * 날짜 차이 계산 (일 단위)
   * @param {string} contractDate - 보험가입일 (YYYY-MM-DD)
   * @param {string} recordDate - 진료일 (YYYY-MM-DD)
   * @returns {number} 날짜 차이 (일)
   */
  calculateDateDifference(contractDate, recordDate) {
    const contract = new Date(contractDate);
    const record = new Date(recordDate);
    const diffTime = contract.getTime() - record.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * 진료 기록을 고지의무 구간별로 분류
   * @param {string} contractDate - 보험가입일
   * @param {Array} medicalRecords - 의료기록 배열
   * @param {string} productType - 상품 유형 (예: "3.2.5")
   * @returns {Object} 구간별 분류된 진료 기록
   */
  classifyRecordsByDisclosurePeriod(contractDate, medicalRecords, productType = "3.2.5") {
    const classification = {
      threeMonths: [],
      twoYears: [],
      fiveYears: [],
      beforeContract: [],
      afterContract: []
    };

    // 상품 유형에 따른 기간 설정 파싱
    const periods = this.parseProductType(productType);

    medicalRecords.forEach(record => {
      const daysDiff = this.calculateDateDifference(contractDate, record.date);
      
      // 가입 후 진료
      if (daysDiff < 0) {
        classification.afterContract.push({
          ...record,
          daysDiff: Math.abs(daysDiff),
          period: 'after_contract'
        });
        return;
      }

      // 가입 전 진료 - 구간별 분류
      if (periods.threeMonths && daysDiff <= this.disclosurePeriods.threeMonths) {
        classification.threeMonths.push({
          ...record,
          daysDiff,
          period: 'three_months',
          disclosureRequired: this.checkDisclosureRequired(record, 'threeMonths')
        });
      } else if (periods.twoYears && daysDiff <= this.disclosurePeriods.twoYears) {
        classification.twoYears.push({
          ...record,
          daysDiff,
          period: 'two_years',
          disclosureRequired: this.checkDisclosureRequired(record, 'twoYears')
        });
      } else if (periods.fiveYears && daysDiff <= this.disclosurePeriods.fiveYears) {
        classification.fiveYears.push({
          ...record,
          daysDiff,
          period: 'five_years',
          disclosureRequired: this.checkDisclosureRequired(record, 'fiveYears')
        });
      } else {
        classification.beforeContract.push({
          ...record,
          daysDiff,
          period: 'before_contract'
        });
      }
    });

    return classification;
  }

  /**
   * 상품 유형 파싱 (예: "3.2.5" -> {threeMonths: true, twoYears: true, fiveYears: true})
   * @param {string} productType - 상품 유형
   * @returns {Object} 기간별 적용 여부
   */
  parseProductType(productType) {
    const periods = {
      threeMonths: false,
      twoYears: false,
      fiveYears: false
    };

    if (productType.includes('3')) periods.threeMonths = true;
    if (productType.includes('2')) periods.twoYears = true;
    if (productType.includes('5')) periods.fiveYears = true;

    return periods;
  }

  /**
   * 고지의무 대상 여부 확인
   * @param {Object} record - 의료기록
   * @param {string} period - 기간 구분
   * @returns {boolean} 고지의무 대상 여부
   */
  checkDisclosureRequired(record, period) {
    const keywords = this.disclosureKeywords[period] || [];
    const recordText = (record.diagnosis + ' ' + record.treatment + ' ' + record.notes).toLowerCase();
    
    return keywords.some(keyword => 
      recordText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 질병별 고지의무 분석
   * @param {Object} record - 의료기록
   * @returns {Object} 질병별 분석 결과
   */
  analyzeDiseaseSpecificDisclosure(record) {
    const analysis = {
      diseaseType: 'general',
      severity: 'moderate',
      applicablePeriods: [],
      riskLevel: 'low'
    };

    const recordText = (record.diagnosis + ' ' + record.treatment + ' ' + record.notes).toLowerCase();

    // 질병별 규칙 적용
    for (const [diseaseType, rules] of Object.entries(this.diseaseDisclosureRules)) {
      const hasKeyword = rules.keywords.some(keyword => 
        recordText.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        analysis.diseaseType = diseaseType;
        analysis.severity = rules.severity;
        analysis.applicablePeriods = rules.periods;
        analysis.riskLevel = rules.severity === 'critical' ? 'high' : 'moderate';
        break;
      }
    }

    return analysis;
  }

  /**
   * 고지의무 위반 위험도 평가
   * @param {Object} classifiedRecords - 분류된 진료 기록
   * @returns {Object} 위험도 평가 결과
   */
  assessDisclosureRisk(classifiedRecords) {
    const riskAssessment = {
      overallRisk: 'low',
      riskFactors: [],
      recommendations: [],
      summary: {
        threeMonthsCount: 0,
        twoYearsCount: 0,
        fiveYearsCount: 0,
        criticalFindings: 0
      }
    };

    // 각 구간별 위험 요소 분석
    ['threeMonths', 'twoYears', 'fiveYears'].forEach(period => {
      const records = classifiedRecords[period] || [];
      const disclosureRequired = records.filter(r => r.disclosureRequired);
      
      riskAssessment.summary[`${period}Count`] = disclosureRequired.length;

      if (disclosureRequired.length > 0) {
        riskAssessment.riskFactors.push({
          period,
          count: disclosureRequired.length,
          records: disclosureRequired.map(r => ({
            date: r.date,
            hospital: r.hospital,
            diagnosis: r.diagnosis,
            severity: this.analyzeDiseaseSpecificDisclosure(r).severity
          }))
        });

        // 중대 질병 확인
        const criticalCases = disclosureRequired.filter(r => 
          this.analyzeDiseaseSpecificDisclosure(r).severity === 'critical'
        );
        riskAssessment.summary.criticalFindings += criticalCases.length;
      }
    });

    // 전체 위험도 결정
    if (riskAssessment.summary.criticalFindings > 0) {
      riskAssessment.overallRisk = 'high';
      riskAssessment.recommendations.push('중대 질병 관련 고지의무 위반 가능성이 높습니다.');
    } else if (riskAssessment.summary.threeMonthsCount + riskAssessment.summary.twoYearsCount > 3) {
      riskAssessment.overallRisk = 'medium';
      riskAssessment.recommendations.push('다수의 고지의무 대상 진료가 확인됩니다.');
    }

    return riskAssessment;
  }

  /**
   * 고지의무 분석 보고서 생성
   * @param {string} contractDate - 보험가입일
   * @param {Array} medicalRecords - 의료기록
   * @param {string} productType - 상품 유형
   * @returns {Object} 고지의무 분석 보고서
   */
  generateDisclosureAnalysisReport(contractDate, medicalRecords, productType = "3.2.5") {
    // 1. 기록 분류
    const classifiedRecords = this.classifyRecordsByDisclosurePeriod(
      contractDate, medicalRecords, productType
    );

    // 2. 위험도 평가
    const riskAssessment = this.assessDisclosureRisk(classifiedRecords);

    // 3. 상세 분석
    const detailedAnalysis = this.generateDetailedAnalysis(classifiedRecords, contractDate);

    // 4. 보고서 구성
    const report = {
      metadata: {
        contractDate,
        productType,
        analysisDate: new Date().toISOString(),
        totalRecords: medicalRecords.length
      },
      classification: classifiedRecords,
      riskAssessment,
      detailedAnalysis,
      recommendations: this.generateRecommendations(riskAssessment, classifiedRecords)
    };

    return report;
  }

  /**
   * 상세 분석 생성
   * @param {Object} classifiedRecords - 분류된 기록
   * @param {string} contractDate - 계약일
   * @returns {Object} 상세 분석 결과
   */
  generateDetailedAnalysis(classifiedRecords, contractDate) {
    const analysis = {
      periodAnalysis: {},
      timelineAnalysis: [],
      diseasePatterns: {}
    };

    // 기간별 분석
    ['threeMonths', 'twoYears', 'fiveYears'].forEach(period => {
      const records = classifiedRecords[period] || [];
      analysis.periodAnalysis[period] = {
        totalRecords: records.length,
        disclosureRequired: records.filter(r => r.disclosureRequired).length,
        hospitals: [...new Set(records.map(r => r.hospital))],
        diagnoses: [...new Set(records.map(r => r.diagnosis))],
        dateRange: records.length > 0 ? {
          earliest: Math.min(...records.map(r => new Date(r.date).getTime())),
          latest: Math.max(...records.map(r => new Date(r.date).getTime()))
        } : null
      };
    });

    // 타임라인 분석
    const allRecords = [
      ...classifiedRecords.threeMonths,
      ...classifiedRecords.twoYears,
      ...classifiedRecords.fiveYears
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    analysis.timelineAnalysis = allRecords.map(record => ({
      date: record.date,
      hospital: record.hospital,
      diagnosis: record.diagnosis,
      period: record.period,
      disclosureRequired: record.disclosureRequired,
      daysBefore: record.daysDiff,
      periodLabel: this.getPeriodLabel(record.period, contractDate, record.date)
    }));

    return analysis;
  }

  /**
   * 기간 라벨 생성
   * @param {string} period - 기간 구분
   * @param {string} contractDate - 계약일
   * @param {string} recordDate - 진료일
   * @returns {string} 기간 라벨
   */
  getPeriodLabel(period, contractDate, recordDate) {
    const labels = {
      'three_months': '보험가입 3개월 이내',
      'two_years': '보험가입 2년 이내',
      'five_years': '보험가입 5년 이내'
    };
    return labels[period] || '기타';
  }

  /**
   * 권고사항 생성
   * @param {Object} riskAssessment - 위험도 평가
   * @param {Object} classifiedRecords - 분류된 기록
   * @returns {Array} 권고사항 목록
   */
  generateRecommendations(riskAssessment, classifiedRecords) {
    const recommendations = [];

    if (riskAssessment.overallRisk === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'disclosure_violation',
        message: '중대 질병 관련 고지의무 위반 가능성이 높아 추가 검토가 필요합니다.',
        action: '보험사 고지의무 위반 조사 대비 자료 준비'
      });
    }

    if (riskAssessment.summary.threeMonthsCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'recent_medical_history',
        message: '가입 3개월 이내 진료 이력이 확인되어 고지의무 검토가 필요합니다.',
        action: '해당 진료의 고지 여부 확인'
      });
    }

    if (classifiedRecords.afterContract.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'post_contract_care',
        message: '가입 후 진료 이력이 확인됩니다.',
        action: '청구 관련 진료와의 연관성 검토'
      });
    }

    return recommendations;
  }

  /**
   * 고지의무 분석 결과를 텍스트 형태로 포맷팅
   * @param {Object} analysisReport - 분석 보고서
   * @returns {string} 포맷팅된 텍스트
   */
  formatDisclosureAnalysisText(analysisReport) {
    let text = '';
    
    text += '■ 고지의무 분석 결과\n';
    text += `- 보험가입일: ${analysisReport.metadata.contractDate}\n`;
    text += `- 상품유형: ${analysisReport.metadata.productType}\n`;
    text += `- 전체 위험도: ${analysisReport.riskAssessment.overallRisk.toUpperCase()}\n\n`;

    // 기간별 분석
    const periods = [
      { key: 'threeMonths', label: '3개월 이내' },
      { key: 'twoYears', label: '2년 이내' },
      { key: 'fiveYears', label: '5년 이내' }
    ];

    periods.forEach(({ key, label }) => {
      const records = analysisReport.classification[key] || [];
      const disclosureRequired = records.filter(r => r.disclosureRequired);
      
      if (disclosureRequired.length > 0) {
        text += `▶ 보험가입 ${label} 진료 (${disclosureRequired.length}건)\n`;
        disclosureRequired.forEach(record => {
          text += `  ${record.date} ${record.hospital} - ${record.diagnosis}\n`;
        });
        text += '\n';
      }
    });

    // 권고사항
    if (analysisReport.recommendations.length > 0) {
      text += '■ 권고사항\n';
      analysisReport.recommendations.forEach((rec, index) => {
        text += `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}\n`;
      });
    }

    return text;
  }
}

module.exports = DisclosureAnalysisEngine;