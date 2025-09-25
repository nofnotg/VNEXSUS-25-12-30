/**
 * 의료 문서 정규화 클래스
 * 의료 문서에서 환자 정보, 보험 정보, 의료 기록 등을 추출하고 정규화
 */
class MedicalDocumentNormalizer {
  constructor() {
    // 날짜 패턴 정의
    this.datePatterns = {
      // 짧은 형식: 2024.1.15, 2024/1/15, 2024-1-15
      short: /\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/g,
      // 컴팩트 형식: 20240115
      compact: /\b\d{8}\b/g,
      // 시간 포함: 2024-01-15 14:30
      withTime: /\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}\s+\d{1,2}:\d{2}/g,
      // 한국어 형식: 2024년 1월 15일
      korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      // 의료용 형식: [2024-01-15]
      medical: /\[\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}\]/g,
      // 표준 형식
      standard: /\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/g
    };

    // 섹션 패턴 정의
    this.sectionPatterns = {
      // 환자 정보 패턴
      patientInfo: {
        name: /(?:환자명|성명|이름)\s*[:：]?\s*([가-힣]{2,4})/,
        birthDate: /(?:생년월일|생일)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}|\d{6}[-]?[1-4])/,
        gender: /(?:성별)\s*[:：]?\s*(남|여|남성|여성)/,
        address: /(?:주소|거주지)\s*[:：]?\s*([^\n]+)/
      },
      // 보험 정보 패턴
      insuranceInfo: {
        company: /(?:보험사|보험회사)\s*[:：]?\s*([^\n]+)/,
        policyNumber: /(?:증권번호|보험번호)\s*[:：]?\s*([A-Za-z0-9\-]+)/,
        joinDate: /(?:가입일|계약일)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/
      },
      // 의료 기록 패턴
      medicalRecord: {
        visitDate: /(?:진료일|방문일|내원일)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/,
        hospital: /(?:병원명|의료기관|병원)\s*[:：]?\s*([^\n]+)/,
        diagnosis: /(?:진단명|진단|병명)\s*[:：]?\s*([^\n]+)/,
        prescription: /(?:처방|약물|투약)\s*[:：]?\s*([^\n]+)/,
        symptoms: /(?:증상|주호소|호소사항)\s*[:：]?\s*([^\n]+)/,
        treatment: /(?:치료|처치|시술)\s*[:：]?\s*([^\n]+)/
      },
      // 입원 기록 패턴
      hospitalizationRecord: {
        period: /(?:입원기간)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})\s*[~-]\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/,
        surgery: /(?:수술|시술)\s*[:：]?\s*([^\n]+)/,
        surgeryDate: /(?:수술일|시술일)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/
      },
      // 검사 결과 패턴
      testResult: {
        testName: /(?:검사명|검사항목)\s*[:：]?\s*([^\n]+)/,
        testDate: /(?:검사일)\s*[:：]?\s*(\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})/,
        result: /(?:결과|수치)\s*[:：]?\s*([^\n]+)/
      }
    };

    // 의료 코드 패턴
    this.medicalCodes = {
      icd10: /[A-Z]\d{2}(\.\d{1,2})?/g,
      surgeryCode: /[A-Z]\d{4,6}/g,
      medicineCode: /\d{8,12}/g
    };

    // 날짜 정규화 패턴
    this.dateNormalization = {
      korean: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
      compact: /^(\d{8})$/,
      standard: /\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/
    };
  }

  /**
   * 의료 문서 정규화 메인 함수
   * @param {string} rawText 원본 텍스트
   * @returns {Object} 정규화된 의료 문서 객체
   */
  normalizeDocument(rawText) {
    try {
      // 1. 텍스트 전처리
      const preprocessedText = this._preprocessText(rawText);
      
      // 2. 환자 정보 추출
      const patientInfo = this._extractPatientInfo(preprocessedText);
      
      // 3. 보험 정보 추출
      const insuranceInfo = this._extractInsuranceInfo(preprocessedText);
      
      // 4. 의료 기록 추출
      const medicalRecords = this._extractMedicalRecords(preprocessedText);
      
      // 5. 시계열 데이터 생성
      const timeline = this._createTimeline(medicalRecords);
      
      // 6. 리포트 구조로 포맷팅
      return this._formatToReportStructure({
        patientInfo,
        insuranceInfo,
        medicalRecords,
        timeline
      });
      
    } catch (error) {
      console.error('문서 정규화 중 오류 발생:', error);
      return {
        success: false,
        error: error.message,
        patientInfo: null,
        insuranceInfo: null,
        medicalRecords: [],
        timeline: []
      };
    }
  }

  /**
   * 텍스트 전처리
   * @param {string} text 원본 텍스트
   * @returns {string} 전처리된 텍스트
   * @private
   */
  _preprocessText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 환자 정보 추출
   * @param {string} text 전처리된 텍스트
   * @returns {Object} 환자 정보 객체
   * @private
   */
  _extractPatientInfo(text) {
    const patientInfo = {};
    
    // 이름 추출
    const nameMatch = text.match(this.sectionPatterns.patientInfo.name);
    if (nameMatch) {
      patientInfo.name = nameMatch[1].trim();
    }
    
    // 생년월일 추출
    const birthMatch = text.match(this.sectionPatterns.patientInfo.birthDate);
    if (birthMatch) {
      patientInfo.birthDate = this._normalizeBirthDate(birthMatch[1]);
    }
    
    // 성별 추출
    const genderMatch = text.match(this.sectionPatterns.patientInfo.gender);
    if (genderMatch) {
      patientInfo.gender = genderMatch[1] === '남' || genderMatch[1] === '남성' ? 'M' : 'F';
    }
    
    // 주소 추출
    const addressMatch = text.match(this.sectionPatterns.patientInfo.address);
    if (addressMatch) {
      patientInfo.address = addressMatch[1].trim();
    }
    
    return Object.keys(patientInfo).length > 0 ? patientInfo : null;
  }

  /**
   * 보험 정보 추출
   * @param {string} text 전처리된 텍스트
   * @returns {Object} 보험 정보 객체
   * @private
   */
  _extractInsuranceInfo(text) {
    const insurance = {};
    
    // 보험사명 추출
    const companyMatch = text.match(this.sectionPatterns.insuranceInfo.company);
    if (companyMatch) {
      insurance.company = companyMatch[1].trim();
    } else {
      // 텍스트에서 보험사명 추출 시도
      insurance.company = this._extractInsuranceCompanyFromText(text);
    }
    
    // 증권번호 추출
    const policyMatch = text.match(this.sectionPatterns.insuranceInfo.policyNumber);
    if (policyMatch) {
      insurance.policyNumber = policyMatch[1].trim();
    }
    
    // 가입일 추출
    const joinMatch = text.match(this.sectionPatterns.insuranceInfo.joinDate);
    if (joinMatch) {
      insurance.joinDate = this._normalizeDate(joinMatch[0]);
    }
    
    return Object.keys(insurance).length > 0 ? insurance : null;
  }

  /**
   * 의료 기록 추출
   * @param {string} text 전처리된 텍스트
   * @returns {Array} 의료 기록 배열
   * @private
   */
  _extractMedicalRecords(text) {
    const records = [];
    
    // 날짜 패턴으로 섹션 분할
    const dateSections = this._splitByDateSections(text);
    
    dateSections.forEach(section => {
      const record = this._parseRecordSection(section);
      // 날짜가 있거나, 병원명/진단명/처방 중 하나라도 있으면 유효한 의료기록으로 간주
      if (record && (record.date || record.hospital || record.diagnosis || record.prescription)) {
        records.push(record);
      }
    });
    
    // 날짜순 정렬
    return records.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * 날짜 기준으로 텍스트 섹션 분할
   * @param {string} text 텍스트
   * @returns {Array} 섹션 배열
   * @private
   */
  _splitByDateSections(text) {
    const sections = [];
    const dateMatches = [];
    
    // 모든 날짜 패턴 찾기
    Object.values(this.datePatterns).forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dateMatches.push({
          date: match[0],
          index: match.index
        });
      }
    });
    
    // 날짜 위치순 정렬
    dateMatches.sort((a, b) => a.index - b.index);
    
    // 날짜 기준으로 섹션 분할
    for (let i = 0; i < dateMatches.length; i++) {
      const start = dateMatches[i].index;
      const end = i < dateMatches.length - 1 ? dateMatches[i + 1].index : text.length;
      const sectionText = text.substring(start, end);
      
      if (sectionText.trim().length > 10) { // 최소 길이 체크
        sections.push(sectionText.trim());
      }
    }
    
    return sections;
  }

  /**
   * 섹션에서 의료 기록 파싱
   * @param {string} section 섹션 텍스트
   * @returns {Object} 의료 기록 객체
   * @private
   */
  _parseRecordSection(section) {
    const record = {
      type: 'medical_record',
      rawText: section
    };
    
    // 날짜 추출 - 여러 패턴 시도
    let extractedDate = null;
    
    // 1. 표준 날짜 패턴
    const standardMatch = section.match(this.datePatterns.standard);
    if (standardMatch) {
      extractedDate = this._normalizeDate(standardMatch[0]);
    }
    
    // 2. 한국어 날짜 패턴
    if (!extractedDate) {
      const koreanMatch = section.match(this.datePatterns.korean);
      if (koreanMatch) {
        extractedDate = this._normalizeDate(koreanMatch[0]);
      }
    }
    
    // 3. 컴팩트 날짜 패턴
    if (!extractedDate) {
      const compactMatch = section.match(this.datePatterns.compact);
      if (compactMatch) {
        extractedDate = this._normalizeDate(compactMatch[0]);
      }
    }
    
    // 4. 의료용 날짜 패턴
    if (!extractedDate) {
      const medicalMatch = section.match(this.datePatterns.medical);
      if (medicalMatch) {
        extractedDate = this._normalizeDate(medicalMatch[0]);
      }
    }
    
    // 유효한 날짜가 추출된 경우에만 설정
    if (extractedDate) {
      record.date = extractedDate;
    }
    
    // 병원명 추출
    const hospitalMatch = section.match(this.sectionPatterns.medicalRecord.hospital);
    if (hospitalMatch) {
      record.hospital = hospitalMatch[0].replace(/(?:병원|의원|클리닉|센터)\s*[:：]?\s*/, '').trim();
    }
    
    // 진단명 추출
    const diagnosisMatch = section.match(this.sectionPatterns.medicalRecord.diagnosis);
    if (diagnosisMatch) {
      record.diagnosis = diagnosisMatch[0].replace(/(?:진단명|진단)\s*[:：]?\s*/, '').trim();
      
      // ICD-10 코드 추출
      const icdMatch = record.diagnosis.match(this.medicalCodes.icd10);
      if (icdMatch) {
        record.icdCode = icdMatch[0];
      }
    }
    
    // 처방 추출
    const prescriptionMatch = section.match(this.sectionPatterns.medicalRecord.prescription);
    if (prescriptionMatch) {
      record.prescription = prescriptionMatch[0].replace(/(?:처방|약물|투약)\s*[:：]?\s*/, '').trim();
    }
    
    // 증상 추출
    const symptomsMatch = section.match(this.sectionPatterns.medicalRecord.symptoms);
    if (symptomsMatch) {
      record.symptoms = symptomsMatch[0].replace(/(?:증상|주호소|호소사항)\s*[:：]?\s*/, '').trim();
    }
    
    // 치료 정보 추출
    const treatmentMatch = section.match(this.sectionPatterns.medicalRecord.treatment);
    if (treatmentMatch) {
      record.treatment = treatmentMatch[0].replace(/(?:치료|처치|시술)\s*[:：]?\s*/, '').trim();
    }
    
    // 입원 정보 추출
    this._extractHospitalizationInfo(section, record);
    
    // 수술 정보 추출
    this._extractSurgeryInfo(section, record);
    
    return record;
  }

  /**
   * 입원 정보 추출
   * @param {string} section 섹션 텍스트
   * @param {Object} record 기록 객체
   * @private
   */
  _extractHospitalizationInfo(section, record) {
    // 입원 기간 추출
    const periodMatch = section.match(this.sectionPatterns.hospitalizationRecord.period);
    if (periodMatch) {
      record.admissionDate = this._normalizeDate(periodMatch[1]);
      record.dischargeDate = this._normalizeDate(periodMatch[2]);
    }
  }

  /**
   * 수술 정보 추출
   * @param {string} section 섹션 텍스트
   * @param {Object} record 기록 객체
   * @private
   */
  _extractSurgeryInfo(section, record) {
    // 수술명 추출
    const surgeryMatch = section.match(this.sectionPatterns.hospitalizationRecord.surgery);
    if (surgeryMatch) {
      record.surgeryName = surgeryMatch[0].replace(/(?:수술|시술)\s*[:：]?\s*/, '').trim();
      
      // 수술 코드 추출
      const codeMatch = record.surgeryName.match(this.medicalCodes.surgeryCode);
      if (codeMatch) {
        record.surgeryCode = codeMatch[0];
      }
    }
    
    // 수술일 추출
    const surgeryDateMatch = section.match(this.sectionPatterns.hospitalizationRecord.surgeryDate);
    if (surgeryDateMatch) {
      record.surgeryDate = this._normalizeDate(surgeryDateMatch[0]);
    }
  }

  /**
   * 시계열 데이터 생성
   * @param {Array} records 의료 기록 배열
   * @returns {Array} 시계열 정렬된 데이터
   * @private
   */
  _createTimeline(records) {
    return records
      .filter(record => record.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(record => ({
        date: record.date,
        type: record.type,
        hospital: record.hospital,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        prescription: record.prescription
      }));
  }

  /**
   * 리포트 구조로 포맷팅
   * @param {Object} data 추출된 데이터
   * @returns {Object} 리포트 구조 객체
   * @private
   */
  _formatToReportStructure(data) {
    return {
      success: true,
      patientInfo: data.patientInfo,
      insuranceInfo: data.insuranceInfo,
      medicalRecords: data.medicalRecords || [],
      hospitalizationRecords: this._extractHospitalizationRecords(data.medicalRecords || []),
      testResults: this._extractTestResults(data.medicalRecords || []),
      timeline: data.timeline || [],
      summary: {
        totalRecords: data.medicalRecords ? data.medicalRecords.length : 0,
        dateRange: this._getDateRange(data.medicalRecords || []),
        hospitals: this._getUniqueHospitals(data.medicalRecords || []),
        diagnoses: this._getUniqueDiagnoses(data.medicalRecords || [])
      }
    };
  }

  /**
   * 입원 기록 추출
   * @param {Array} records 의료 기록 배열
   * @returns {Array} 입원 기록 배열
   * @private
   */
  _extractHospitalizationRecords(records) {
    return records.filter(record => 
      record.admissionDate || record.dischargeDate || record.surgeryName
    );
  }

  /**
   * 검사 결과 추출
   * @param {Array} records 의료 기록 배열
   * @returns {Array} 검사 결과 배열
   * @private
   */
  _extractTestResults(records) {
    // 검사 관련 키워드가 포함된 기록 필터링
    const testKeywords = ['검사', '촬영', 'CT', 'MRI', 'X-ray', '혈액검사', '소변검사'];
    
    return records.filter(record => {
      const text = (record.diagnosis || '') + ' ' + (record.treatment || '') + ' ' + (record.rawText || '');
      return testKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * 날짜 범위 계산
   * @param {Array} records 의료 기록 배열
   * @returns {Object} 날짜 범위 객체
   * @private
   */
  _getDateRange(records) {
    const dates = records
      .map(record => record.date)
      .filter(date => date)
      .sort();
    
    return {
      start: dates[0] || null,
      end: dates[dates.length - 1] || null
    };
  }

  /**
   * 고유 병원 목록 추출
   * @param {Array} records 의료 기록 배열
   * @returns {Array} 고유 병원 목록
   * @private
   */
  _getUniqueHospitals(records) {
    const hospitals = records
      .map(record => record.hospital)
      .filter(hospital => hospital);
    
    return [...new Set(hospitals)];
  }

  /**
   * 고유 진단명 목록 추출
   * @param {Array} records 의료 기록 배열
   * @returns {Array} 고유 진단명 목록
   * @private
   */
  _getUniqueDiagnoses(records) {
    const diagnoses = records
      .map(record => record.diagnosis)
      .filter(diagnosis => diagnosis);
    
    return [...new Set(diagnoses)];
  }

  /**
   * 날짜 정규화
   * @param {string} dateStr 날짜 문자열
   * @returns {string} 정규화된 날짜 (YYYY-MM-DD)
   * @private
   */
  _normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    // 대괄호 제거
    const cleanStr = dateStr.replace(/[\[\]]/g, '').trim();
    
    // YYYYMMDD 형식 (8자리 숫자) - 유효한 날짜 범위만 허용
    const compactMatch = cleanStr.match(/^(\d{8})$/);
    if (compactMatch) {
      const dateStr = compactMatch[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      
      // 유효한 날짜 범위 체크 (1900-2100년, 1-12월, 1-31일)
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
      return null; // 유효하지 않은 날짜는 null 반환
    }
    
    // 시간 포함 형식에서 날짜 부분만 추출
    const withTimeMatch = cleanStr.match(/(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/);
    if (withTimeMatch) {
      return withTimeMatch[1].replace(/[\/.]/g, '-');
    }
    
    // 기존 표준 형식인 경우
    const standardMatch = cleanStr.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
    if (standardMatch) {
      return standardMatch[0].replace(/[\/.]/g, '-');
    }
    
    // 한국어 형식인 경우
    const koreanMatch = cleanStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanMatch) {
      const [, year, month, day] = koreanMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return cleanStr;
  }

  /**
   * 생년월일 정규화
   * @param {string} birthStr 생년월일 문자열
   * @returns {string} 정규화된 생년월일
   * @private
   */
  _normalizeBirthDate(birthStr) {
    if (!birthStr) return null;
    
    // 주민등록번호 형식 (YYMMDD-X)
    const rrnMatch = birthStr.match(/(\d{6})[-]?[1-4]/);
    if (rrnMatch) {
      const yymmdd = rrnMatch[1];
      const yy = parseInt(yymmdd.substring(0, 2));
      const mm = yymmdd.substring(2, 4);
      const dd = yymmdd.substring(4, 6);
      
      // 1900년대 또는 2000년대 판단
      const yyyy = yy > 50 ? `19${yy}` : `20${yy}`;
      return `${yyyy}-${mm}-${dd}`;
    }
    
    // 일반 날짜 형식
    return this._normalizeDate(birthStr);
  }

  /**
   * 텍스트에서 특별 노트 추출
   * @param {string} text 텍스트
   * @returns {string} 특별 노트
   * @private
   */
  _extractSpecialNotes(text) {
    const notes = [];
    const notePatterns = [
      /(?:특이사항|주의사항|비고)\s*[:：]?\s*([^\n]+)/g,
      /\*\s*([^\n]+)/g,
      /※\s*([^\n]+)/g
    ];
    
    notePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        notes.push(match[1].trim());
      }
    });
    
    return notes.join('; ');
  }

  /**
   * 텍스트에서 보험회사명 추출
   * @param {string} text 텍스트
   * @returns {string} 보험회사명
   * @private
   */
  _extractInsuranceCompanyFromText(text) {
    const companies = ['MG손해보험', '삼성화재', 'AXA', '현대해상', 'DB손해보험', '메리츠화재'];
    
    for (const company of companies) {
      if (text.includes(company)) {
        return company;
      }
    }
    
    return '미확인 보험사';
  }

  /**
   * 지급일 추출
   * @param {string} text 텍스트
   * @returns {string} 지급일
   * @private
   */
  _extractPaymentDate(text) {
    const paymentMatch = text.match(/(?:지급일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/);
    return paymentMatch ? this._normalizeDate(paymentMatch[1]) : null;
  }

  /**
   * 지급금액 추출
   * @param {string} text 텍스트
   * @returns {string} 지급금액
   * @private
   */
  _extractPaymentAmount(text) {
    const amountMatch = text.match(/(?:지급금액|금액)\s*[:：]?\s*([\d,]+)\s*원/);
    return amountMatch ? amountMatch[1] : null;
  }
}

module.exports = MedicalDocumentNormalizer;