/**
 * Report Template Engine Module
 * 
 * 역할:
 * 1. Report_Sample.txt 형식의 경과보고서 템플릿 생성
 * 2. 추출된 의료 데이터를 구조화된 리포트로 변환
 * 3. 다양한 출력 형식 지원 (텍스트, JSON, HTML)
 * 4. 템플릿 커스터마이징 및 동적 생성
 */

const path = require('path');

class ReportTemplateEngine {
  constructor() {
    this.templatePath = path.join(__dirname, '..', 'templates');
    this.outputPath = path.join(__dirname, '..', 'output');
    
    // 템플릿 캐시
    this.templateCache = new Map();
    
    // 향상된 보고서 엔진 통합
    const EnhancedReportTemplateEngine = require('./enhancedReportTemplateEngine.cjs');
    this.enhancedEngine = new EnhancedReportTemplateEngine();
    
    // 보고서 형식 설정
    this.formats = {
      text: 'txt',
      json: 'json',
      html: 'html',
      markdown: 'md'
    };
    
    // 리포트 템플릿 구조
    this.templateStructure = {
      header: {
        title: '의료 경과보고서',
        subtitle: 'Medical Progress Report',
        generatedDate: null
      },
      
      patientInfo: {
        name: null,
        birthDate: null,
        registrationNumber: null,
        gender: null,
        age: null
      },
      
      insuranceConditions: [],
      insuranceHistory: [],
      medicalRecords: [],
      hospitalizationRecords: [],
      surgeryRecords: [],
      testResults: [],
      insuranceClaims: [],
      
      summary: {
        totalRecords: 0,
        dateRange: null,
        majorDiagnoses: [],
        keyFindings: []
      }
    };
    
    // 섹션 제목 매핑
    this.sectionTitles = {
      patientInfo: '■ 환자 정보 (Patient Information)',
      insuranceConditions: '■ 보험 가입 조건 (Insurance Conditions)',
      insuranceHistory: '■ 보험 가입 이력 (Insurance History)',
      medicalRecords: '■ 진료 기록 (Medical Records)',
      hospitalizationRecords: '■ 입원 기록 (Hospitalization Records)',
      surgeryRecords: '■ 수술 기록 (Surgery Records)',
      testResults: '■ 검사 결과 (Test Results)',
      insuranceClaims: '■ 보험 청구 이력 (Insurance Claims)',
      summary: '■ 종합 소견 (Summary)'
    };
    
    // 날짜 형식 옵션
    this.dateFormats = {
      korean: 'YYYY년 MM월 DD일',
      standard: 'YYYY-MM-DD',
      display: 'YYYY.MM.DD'
    };
    
    // 출력 형식 옵션
    this.outputFormats = ['text', 'json', 'html', 'markdown'];
  }

  /**
   * 향상된 보고서 생성 (새로운 메인 메서드)
   * @param {Object} normalizedData 정규화된 의료 데이터
   * @param {Object} options 생성 옵션
   * @returns {Object} 생성된 보고서
   */
  async generateEnhancedReport(normalizedData, options = {}) {
    try {
      console.log('Enhanced report generation started...');
      
      // 향상된 엔진으로 보고서 생성
      const result = await this.enhancedEngine.generateEnhancedReport(normalizedData, options);
      
      console.log('Enhanced report generation completed successfully');
      return result;
      
    } catch (error) {
      console.error('Enhanced report generation failed:', error);
      throw error;
    }
  }

  /**
   * 기존 호환성을 위한 레거시 메서드 (향상된 기능으로 리다이렉트)
   * @param {Object} normalizedData 정규화된 의료 데이터
   * @param {Object} options 템플릿 옵션
   * @returns {Promise<Object>} 생성된 리포트
   */
  async generateReport(normalizedData, options = {}) {
    console.log('Legacy generateReport called - redirecting to enhanced version');
    return this.generateEnhancedReport(normalizedData, options);
  }

  /**
   * 템플릿 데이터 준비
   * @param {Object} normalizedData 정규화된 데이터
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 템플릿 데이터
   * @private
   */
  async _prepareTemplateData(normalizedData, options) {
    const templateData = JSON.parse(JSON.stringify(this.templateStructure));
    
    // 헤더 정보 설정
    templateData.header.generatedDate = this._formatDate(new Date(), options.dateFormat);
    
    // 환자 정보 설정
    if (normalizedData.normalizedReport?.header) {
      const header = normalizedData.normalizedReport.header;
      templateData.patientInfo = {
        name: header.patientName || '미확인',
        birthDate: this._formatDate(header.birthDate, options.dateFormat),
        registrationNumber: header.registrationNumber || '미확인',
        gender: this._inferGender(header.patientName),
        age: this._calculateAge(header.birthDate)
      };
    }
    
    // 보험 정보 설정
    if (normalizedData.normalizedReport?.insuranceConditions) {
      templateData.insuranceConditions = normalizedData.normalizedReport.insuranceConditions.map(condition => ({
        conditionNumber: condition.conditionNumber,
        company: condition.company || '미확인 보험사',
        joinDate: this._formatDate(condition.joinDate, options.dateFormat),
        productName: condition.productName || '미확인 상품',
        coverage: condition.coverage || '미확인 담보',
        status: '유효'
      }));
    }
    
    // 보험 가입 이력 설정
    if (normalizedData.normalizedReport?.insuranceHistory) {
      templateData.insuranceHistory = normalizedData.normalizedReport.insuranceHistory.map(history => ({
        period: history.period || '[기간 미확인]',
        date: this._formatDate(history.date, options.dateFormat),
        company: history.company || '미확인 보험사',
        joinDate: this._formatDate(history.joinDate, options.dateFormat),
        status: '가입 완료'
      }));
    }
    
    // 진료 기록 설정
    if (normalizedData.normalizedReport?.medicalRecords) {
      templateData.medicalRecords = normalizedData.normalizedReport.medicalRecords.map(record => ({
        date: this._formatDate(record.date, options.dateFormat),
        hospital: record.hospital || '미확인 의료기관',
        visitDate: this._formatDate(record.visitDate, options.dateFormat),
        reason: record.reason || '정기 진료',
        diagnosis: record.diagnosis || '미확인',
        icdCode: record.icdCode || '',
        prescription: record.prescription || '처방 없음',
        notes: record.notes || '',
        severity: this._assessSeverity(record.diagnosis)
      }));
    }
    
    // 입원 기록 설정
    if (normalizedData.normalizedReport?.hospitalizationRecords) {
      templateData.hospitalizationRecords = normalizedData.normalizedReport.hospitalizationRecords.map(record => ({
        date: this._formatDate(record.date, options.dateFormat),
        hospital: record.hospital || '미확인 의료기관',
        visitDate: this._formatDate(record.visitDate, options.dateFormat),
        reason: record.reason || '응급실 내원',
        diagnosis: record.diagnosis || '미확인',
        admissionPeriod: record.admissionPeriod || '기간 미확인',
        surgeryInfo: record.surgeryInfo,
        notes: record.notes || '',
        duration: this._calculateHospitalizationDuration(record.admissionPeriod)
      }));
    }
    
    // 수술 기록 분리 설정
    templateData.surgeryRecords = this._extractSurgeryRecords(templateData.hospitalizationRecords);
    
    // 보험 청구 이력 설정
    if (normalizedData.normalizedReport?.insuranceClaims) {
      templateData.insuranceClaims = normalizedData.normalizedReport.insuranceClaims.map(claim => ({
        date: this._formatDate(claim.date, options.dateFormat),
        company: claim.company || '미확인 보험사',
        claimDate: this._formatDate(claim.claimDate, options.dateFormat),
        diagnosis: claim.diagnosis || '미확인',
        paymentDate: this._formatDate(claim.paymentDate, options.dateFormat),
        amount: this._formatAmount(claim.amount),
        notes: claim.notes || '',
        status: claim.paymentDate ? '지급 완료' : '처리 중'
      }));
    }
    
    // 종합 소견 생성
    if (options.includeSummary) {
      templateData.summary = this._generateSummary(templateData);
    }
    
    return templateData;
  }

  /**
   * 리포트 빌드
   * @param {Object} templateData 템플릿 데이터
   * @param {Object} options 옵션
   * @returns {Promise<string>} 생성된 리포트
   * @private
   */
  async _buildReport(templateData, options) {
    switch (options.format) {
      case 'json':
        return this._buildJsonReport(templateData, options);
      case 'html':
        return this._buildHtmlReport(templateData, options);
      case 'markdown':
        return this._buildMarkdownReport(templateData, options);
      case 'text':
      default:
        return this._buildTextReport(templateData, options);
    }
  }

  /**
   * 텍스트 형식 리포트 생성
   * @param {Object} templateData 템플릿 데이터
   * @param {Object} options 옵션
   * @returns {string} 텍스트 리포트
   * @private
   */
  _buildTextReport(templateData, options) {
    let report = [];
    
    // 헤더
    report.push('='.repeat(80));
    report.push(`${templateData.header.title}`);
    report.push(`${templateData.header.subtitle}`);
    report.push(`생성일: ${templateData.header.generatedDate}`);
    report.push('='.repeat(80));
    report.push('');
    
    // 환자 정보
    report.push(this.sectionTitles.patientInfo);
    report.push('-'.repeat(60));
    report.push(`환자명: ${templateData.patientInfo.name}`);
    const formattedBirthDate = this._formatDate(templateData.patientInfo.birthDate, options.dateFormat);
    const calculatedAge = this._calculateAge(templateData.patientInfo.birthDate);
    report.push(`생년월일: ${formattedBirthDate} (만 ${calculatedAge}세)`);
    report.push(`등록번호: ${templateData.patientInfo.registrationNumber}`);
    if (templateData.patientInfo.gender) {
      report.push(`성별: ${templateData.patientInfo.gender}`);
    }
    report.push('');
    
    // 보험 가입 조건
    if (templateData.insuranceConditions.length > 0) {
      report.push(this.sectionTitles.insuranceConditions);
      report.push('-'.repeat(60));
      templateData.insuranceConditions.forEach((condition, index) => {
        report.push(`${index + 1}. ${condition.company}`);
        report.push(`   가입일: ${condition.joinDate}`);
        report.push(`   상품명: ${condition.productName}`);
        report.push(`   담보내용: ${condition.coverage}`);
        report.push(`   상태: ${condition.status}`);
        report.push('');
      });
    }
    
    // 보험 가입 이력
    if (templateData.insuranceHistory.length > 0) {
      report.push(this.sectionTitles.insuranceHistory);
      report.push('-'.repeat(60));
      templateData.insuranceHistory.forEach(history => {
        report.push(`${history.period}`);
        report.push(`${history.date} ${history.company} 가입 (${history.joinDate})`);
        report.push('');
      });
    }
    
    // 진료 기록
    if (templateData.medicalRecords.length > 0) {
      report.push(this.sectionTitles.medicalRecords);
      report.push('-'.repeat(60));
      templateData.medicalRecords.forEach(record => {
        report.push(`[${record.date}] ${record.hospital}`);
        report.push(`내원일: ${record.visitDate}`);
        report.push(`내원사유: ${record.reason}`);
        report.push(`진단명: ${record.diagnosis}${record.icdCode ? ` (${record.icdCode})` : ''}`);
        if (record.prescription && record.prescription !== '처방 없음') {
          report.push(`처방: ${record.prescription}`);
        }
        if (record.notes) {
          report.push(`특이사항: ${record.notes}`);
        }
        if (record.severity) {
          report.push(`중증도: ${record.severity}`);
        }
        report.push('');
      });
    }
    
    // 입원 기록
    if (templateData.hospitalizationRecords.length > 0) {
      report.push(this.sectionTitles.hospitalizationRecords);
      report.push('-'.repeat(60));
      templateData.hospitalizationRecords.forEach(record => {
        report.push(`[${record.date}] ${record.hospital}`);
        report.push(`내원일: ${record.visitDate}`);
        report.push(`내원사유: ${record.reason}`);
        report.push(`진단명: ${record.diagnosis}`);
        report.push(`입원기간: ${record.admissionPeriod}${record.duration ? ` (${record.duration})` : ''}`);
        if (record.surgeryInfo) {
          report.push(`수술정보: ${record.surgeryInfo.name} (${record.surgeryInfo.date})`);
          if (record.surgeryInfo.code) {
            report.push(`수술코드: ${record.surgeryInfo.code}`);
          }
        }
        if (record.notes) {
          report.push(`특이사항: ${record.notes}`);
        }
        report.push('');
      });
    }
    
    // 수술 기록
    if (templateData.surgeryRecords.length > 0) {
      report.push(this.sectionTitles.surgeryRecords);
      report.push('-'.repeat(60));
      templateData.surgeryRecords.forEach(surgery => {
        report.push(`[${surgery.date}] ${surgery.hospital}`);
        report.push(`수술명: ${surgery.name}`);
        report.push(`수술일: ${surgery.surgeryDate}`);
        if (surgery.code) {
          report.push(`수술코드: ${surgery.code}`);
        }
        if (surgery.notes) {
          report.push(`특이사항: ${surgery.notes}`);
        }
        report.push('');
      });
    }
    
    // 보험 청구 이력
    if (templateData.insuranceClaims.length > 0) {
      report.push(this.sectionTitles.insuranceClaims);
      report.push('-'.repeat(60));
      templateData.insuranceClaims.forEach(claim => {
        report.push(`[${claim.date}] ${claim.company}`);
        report.push(`청구일: ${claim.claimDate}`);
        report.push(`진단명: ${claim.diagnosis}`);
        if (claim.paymentDate) {
          report.push(`지급일: ${claim.paymentDate}`);
        }
        if (claim.amount) {
          report.push(`지급금액: ${claim.amount}`);
        }
        report.push(`상태: ${claim.status}`);
        if (claim.notes) {
          report.push(`특이사항: ${claim.notes}`);
        }
        report.push('');
      });
    }
    
    // 종합 소견
    if (templateData.summary && options.includeSummary) {
      report.push(this.sectionTitles.summary);
      report.push('-'.repeat(60));
      report.push(`총 진료 기록: ${templateData.summary.totalRecords}건`);
      if (templateData.summary.dateRange) {
        report.push(`진료 기간: ${templateData.summary.dateRange}`);
      }
      if (templateData.summary.majorDiagnoses.length > 0) {
        report.push(`주요 진단명: ${templateData.summary.majorDiagnoses.join(', ')}`);
      }
      if (templateData.summary.keyFindings.length > 0) {
        report.push('주요 소견:');
        templateData.summary.keyFindings.forEach(finding => {
          report.push(`  - ${finding}`);
        });
      }
      report.push('');
    }
    
    // 푸터
    report.push('='.repeat(80));
    report.push(`보고서 생성 완료 - ${new Date().toLocaleString('ko-KR')}`);
    report.push('='.repeat(80));
    
    return report.join('\n');
  }

  /**
   * JSON 형식 리포트 생성
   * @param {Object} templateData 템플릿 데이터
   * @param {Object} options 옵션
   * @returns {string} JSON 리포트
   * @private
   */
  _buildJsonReport(templateData, options) {
    return JSON.stringify(templateData, null, 2);
  }

  /**
   * HTML 형식 리포트 생성
   * @param {Object} templateData 템플릿 데이터
   * @param {Object} options 옵션
   * @returns {string} HTML 리포트
   * @private
   */
  _buildHtmlReport(templateData, options) {
    let html = [];
    
    html.push('<!DOCTYPE html>');
    html.push('<html lang="ko">');
    html.push('<head>');
    html.push('<meta charset="UTF-8">');
    html.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push(`<title>${templateData.header.title}</title>`);
    html.push('<style>');
    html.push(this._getHtmlStyles());
    html.push('</style>');
    html.push('</head>');
    html.push('<body>');
    
    // 헤더
    html.push('<div class="header">');
    html.push(`<h1>${templateData.header.title}</h1>`);
    html.push(`<h2>${templateData.header.subtitle}</h2>`);
    html.push(`<p class="generated-date">생성일: ${templateData.header.generatedDate}</p>`);
    html.push('</div>');
    
    // 환자 정보
    html.push('<section class="patient-info">');
    html.push(`<h3>${this.sectionTitles.patientInfo}</h3>`);
    html.push('<table>');
    html.push(`<tr><td>환자명</td><td>${templateData.patientInfo.name}</td></tr>`);
    const formattedBirthDateHtml = this._formatDate(templateData.patientInfo.birthDate, options.dateFormat);
    const calculatedAgeHtml = this._calculateAge(templateData.patientInfo.birthDate);
    html.push(`<tr><td>생년월일</td><td>${formattedBirthDateHtml} (만 ${calculatedAgeHtml}세)</td></tr>`);
    html.push(`<tr><td>등록번호</td><td>${templateData.patientInfo.registrationNumber}</td></tr>`);
    if (templateData.patientInfo.gender) {
      html.push(`<tr><td>성별</td><td>${templateData.patientInfo.gender}</td></tr>`);
    }
    html.push('</table>');
    html.push('</section>');
    
    // 진료 기록
    if (templateData.medicalRecords.length > 0) {
      html.push('<section class="medical-records">');
      html.push(`<h3>${this.sectionTitles.medicalRecords}</h3>`);
      templateData.medicalRecords.forEach(record => {
        html.push('<div class="record">');
        html.push(`<h4>[${record.date}] ${record.hospital}</h4>`);
        html.push(`<p><strong>내원일:</strong> ${record.visitDate}</p>`);
        html.push(`<p><strong>내원사유:</strong> ${record.reason}</p>`);
        html.push(`<p><strong>진단명:</strong> ${record.diagnosis}${record.icdCode ? ` (${record.icdCode})` : ''}</p>`);
        if (record.prescription && record.prescription !== '처방 없음') {
          html.push(`<p><strong>처방:</strong> ${record.prescription}</p>`);
        }
        if (record.notes) {
          html.push(`<p><strong>특이사항:</strong> ${record.notes}</p>`);
        }
        html.push('</div>');
      });
      html.push('</section>');
    }
    
    html.push('</body>');
    html.push('</html>');
    
    return html.join('\n');
  }

  /**
   * Markdown 형식 리포트 생성
   * @param {Object} templateData 템플릿 데이터
   * @param {Object} options 옵션
   * @returns {string} Markdown 리포트
   * @private
   */
  _buildMarkdownReport(templateData, options) {
    let md = [];
    
    // 헤더
    md.push(`# ${templateData.header.title}`);
    md.push(`## ${templateData.header.subtitle}`);
    md.push(`**생성일:** ${templateData.header.generatedDate}`);
    md.push('');
    
    // 환자 정보
    md.push(`## ${this.sectionTitles.patientInfo}`);
    md.push('| 항목 | 내용 |');
    md.push('|------|------|');
    md.push(`| 환자명 | ${templateData.patientInfo.name} |`);
    const formattedBirthDateMd = this._formatDate(templateData.patientInfo.birthDate, options.dateFormat);
    const calculatedAgeMd = this._calculateAge(templateData.patientInfo.birthDate);
    md.push(`| 생년월일 | ${formattedBirthDateMd} (만 ${calculatedAgeMd}세) |`);
    md.push(`| 등록번호 | ${templateData.patientInfo.registrationNumber} |`);
    if (templateData.patientInfo.gender) {
      md.push(`| 성별 | ${templateData.patientInfo.gender} |`);
    }
    md.push('');
    
    // 진료 기록
    if (templateData.medicalRecords.length > 0) {
      md.push(`## ${this.sectionTitles.medicalRecords}`);
      templateData.medicalRecords.forEach(record => {
        md.push(`### [${record.date}] ${record.hospital}`);
        md.push(`- **내원일:** ${record.visitDate}`);
        md.push(`- **내원사유:** ${record.reason}`);
        md.push(`- **진단명:** ${record.diagnosis}${record.icdCode ? ` (${record.icdCode})` : ''}`);
        if (record.prescription && record.prescription !== '처방 없음') {
          md.push(`- **처방:** ${record.prescription}`);
        }
        if (record.notes) {
          md.push(`- **특이사항:** ${record.notes}`);
        }
        md.push('');
      });
    }
    
    return md.join('\n');
  }

  /**
   * HTML 스타일 반환
   * @returns {string} CSS 스타일
   * @private
   */
  _getHtmlStyles() {
    return `
      body {
        font-family: 'Malgun Gothic', sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
        background-color: #f5f5f5;
      }
      .header {
        text-align: center;
        background-color: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 30px;
      }
      .header h1 {
        color: #2c3e50;
        margin: 0;
        font-size: 2.5em;
      }
      .header h2 {
        color: #7f8c8d;
        margin: 10px 0;
        font-weight: normal;
      }
      .generated-date {
        color: #95a5a6;
        font-size: 0.9em;
      }
      section {
        background-color: white;
        margin-bottom: 30px;
        padding: 25px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      section h3 {
        color: #2c3e50;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
        margin-top: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      table td {
        padding: 12px;
        border-bottom: 1px solid #ecf0f1;
      }
      table td:first-child {
        background-color: #f8f9fa;
        font-weight: bold;
        width: 150px;
      }
      .record {
        border-left: 4px solid #3498db;
        padding-left: 20px;
        margin-bottom: 25px;
      }
      .record h4 {
        color: #2c3e50;
        margin: 0 0 15px 0;
      }
      .record p {
        margin: 8px 0;
        color: #34495e;
      }
    `;
  }

  /**
   * 날짜 포맷팅
   * @param {string|Date} date 날짜
   * @param {string} format 포맷
   * @returns {string} 포맷된 날짜
   * @private
   */
  _formatDate(date, format = 'display') {
    if (!date || date === '미확인') return '미확인';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // 유효하지 않은 날짜인 경우
      if (isNaN(dateObj.getTime())) {
        return '미확인';
      }
      
      switch (format) {
        case 'korean':
          return `${dateObj.getFullYear()}년 ${(dateObj.getMonth() + 1).toString().padStart(2, '0')}월 ${dateObj.getDate().toString().padStart(2, '0')}일`;
        case 'standard':
          return dateObj.toISOString().split('T')[0];
        case 'display':
        default:
          return `${dateObj.getFullYear()}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getDate().toString().padStart(2, '0')}`;
      }
    } catch (error) {
      return '미확인';
    }
  }

  /**
   * 나이 계산
   * @param {string} birthDate 생년월일
   * @returns {number|string} 나이 또는 '미확인'
   * @private
   */
  _calculateAge(birthDate) {
    if (!birthDate || birthDate === '미확인') return '미확인';
    
    try {
      const birth = new Date(birthDate);
      
      // 유효하지 않은 날짜인 경우
      if (isNaN(birth.getTime())) {
        return '미확인';
      }
      
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      
      // 음수이거나 비정상적으로 큰 나이인 경우
      if (age < 0 || age > 150) {
        return '미확인';
      }
      
      return age;
    } catch (error) {
      return '미확인';
    }
  }

  /**
   * 성별 추정
   * @param {string} name 이름
   * @returns {string|null} 성별
   * @private
   */
  _inferGender(name) {
    // 간단한 성별 추정 로직 (실제로는 더 정교한 로직 필요)
    if (!name || name === '미확인') return null;
    
    const maleEndings = ['호', '수', '민', '준', '현', '석', '철', '용', '진', '우'];
    const femaleEndings = ['영', '희', '미', '은', '정', '아', '나', '라', '연', '주'];
    
    const lastChar = name.charAt(name.length - 1);
    
    if (maleEndings.includes(lastChar)) return '남성';
    if (femaleEndings.includes(lastChar)) return '여성';
    
    return null;
  }

  /**
   * 중증도 평가
   * @param {string} diagnosis 진단명
   * @returns {string} 중증도
   * @private
   */
  _assessSeverity(diagnosis) {
    if (!diagnosis) return null;
    
    const criticalKeywords = ['암', '심근경색', '뇌졸중', '응급', '중환자'];
    const severeKeywords = ['골절', '수술', '입원', '중증'];
    const moderateKeywords = ['염증', '감염', '통증'];
    
    const lowerDiagnosis = diagnosis.toLowerCase();
    
    if (criticalKeywords.some(keyword => lowerDiagnosis.includes(keyword))) {
      return '위중';
    }
    if (severeKeywords.some(keyword => lowerDiagnosis.includes(keyword))) {
      return '심각';
    }
    if (moderateKeywords.some(keyword => lowerDiagnosis.includes(keyword))) {
      return '보통';
    }
    
    return '경미';
  }

  /**
   * 입원 기간 계산
   * @param {string} admissionPeriod 입원 기간
   * @returns {string|null} 계산된 기간
   * @private
   */
  _calculateHospitalizationDuration(admissionPeriod) {
    if (!admissionPeriod || admissionPeriod === '기간 미확인') return null;
    
    try {
      const dates = admissionPeriod.match(/\d{4}[-\/.](\d{1,2})[-\/.](\d{1,2})/g);
      if (dates && dates.length === 2) {
        const startDate = new Date(dates[0]);
        const endDate = new Date(dates[1]);
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return `${diffDays}일`;
      }
    } catch (error) {
      // 계산 실패 시 null 반환
    }
    
    return null;
  }

  /**
   * 수술 기록 추출
   * @param {Array} hospitalizationRecords 입원 기록
   * @returns {Array} 수술 기록
   * @private
   */
  _extractSurgeryRecords(hospitalizationRecords) {
    const surgeryRecords = [];
    
    hospitalizationRecords.forEach(record => {
      if (record.surgeryInfo) {
        surgeryRecords.push({
          date: record.date,
          hospital: record.hospital,
          name: record.surgeryInfo.name,
          surgeryDate: record.surgeryInfo.date,
          code: record.surgeryInfo.code,
          notes: record.notes
        });
      }
    });
    
    return surgeryRecords;
  }

  /**
   * 금액 포맷팅
   * @param {string|number} amount 금액
   * @returns {string} 포맷된 금액
   * @private
   */
  _formatAmount(amount) {
    if (!amount) return null;
    
    try {
      const numAmount = typeof amount === 'string' ? parseInt(amount.replace(/[^\d]/g, '')) : amount;
      return numAmount.toLocaleString('ko-KR') + '원';
    } catch (error) {
      return amount.toString();
    }
  }

  /**
   * 종합 소견 생성
   * @param {Object} templateData 템플릿 데이터
   * @returns {Object} 종합 소견
   * @private
   */
  _generateSummary(templateData) {
    const summary = {
      totalRecords: 0,
      dateRange: null,
      majorDiagnoses: [],
      keyFindings: []
    };
    
    // 총 기록 수 계산
    summary.totalRecords = templateData.medicalRecords.length + 
                          templateData.hospitalizationRecords.length + 
                          templateData.surgeryRecords.length;
    
    // 날짜 범위 계산
    const allDates = [];
    templateData.medicalRecords.forEach(record => {
      if (record.date) allDates.push(new Date(record.date));
    });
    templateData.hospitalizationRecords.forEach(record => {
      if (record.date) allDates.push(new Date(record.date));
    });
    
    if (allDates.length > 0) {
      allDates.sort((a, b) => a - b);
      const startDate = this._formatDate(allDates[0], 'display');
      const endDate = this._formatDate(allDates[allDates.length - 1], 'display');
      summary.dateRange = `${startDate} ~ ${endDate}`;
    }
    
    // 주요 진단명 추출
    const diagnoses = new Set();
    templateData.medicalRecords.forEach(record => {
      if (record.diagnosis && record.diagnosis !== '미확인') {
        diagnoses.add(record.diagnosis);
      }
    });
    templateData.hospitalizationRecords.forEach(record => {
      if (record.diagnosis && record.diagnosis !== '미확인') {
        diagnoses.add(record.diagnosis);
      }
    });
    summary.majorDiagnoses = Array.from(diagnoses).slice(0, 5);
    
    // 주요 소견 생성
    if (templateData.hospitalizationRecords.length > 0) {
      summary.keyFindings.push(`총 ${templateData.hospitalizationRecords.length}회 입원 이력`);
    }
    if (templateData.surgeryRecords.length > 0) {
      summary.keyFindings.push(`총 ${templateData.surgeryRecords.length}회 수술 이력`);
    }
    if (templateData.insuranceClaims.length > 0) {
      summary.keyFindings.push(`총 ${templateData.insuranceClaims.length}건 보험 청구 이력`);
    }
    
    return summary;
  }

  /**
   * 총 기록 수 계산
   * @param {Object} templateData 템플릿 데이터
   * @returns {number} 총 기록 수
   * @private
   */
  _countTotalRecords(templateData) {
    return Object.values(templateData)
      .filter(value => Array.isArray(value))
      .reduce((total, array) => total + array.length, 0);
  }
}

module.exports = ReportTemplateEngine;