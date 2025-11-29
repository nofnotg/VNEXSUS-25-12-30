/**
 * Enhanced Medical Term Processor
 * 
 * 역할:
 * 1. ICD 코드 영어/한글 병기 처리 (ICD코드 텍스트 출력 제외)
 * 2. 의료용어 영어/한글 상호 보완 시스템
 * 3. 문맥 기반 의료용어 정확성 향상
 * 4. 손해사정 보고서 특화 의료용어 처리
 */

class EnhancedMedicalTermProcessor {
  constructor() {
    // ICD 코드 매핑 데이터베이스 (KCD-10 기준)
    this.icdMappings = {
      'E11': { korean: '제2형 당뇨병', english: 'Type 2 diabetes mellitus' },
      'E11.9': { korean: '제2형 당뇨병, 합병증 없는', english: 'Type 2 diabetes mellitus without complications' },
      'E11.68': { korean: '제2형 당뇨병, 기타 명시된 합병증을 동반한', english: 'Type 2 diabetes mellitus with other specified complications' },
      'E11.78': { korean: '제2형 당뇨병, 다발성 합병증을 동반한', english: 'Type 2 diabetes mellitus with multiple complications' },
      'I20.9': { korean: '협심증, 상세불명', english: 'Angina pectoris, unspecified' },
      'I25': { korean: '만성 허혈성 심장질환', english: 'Chronic ischaemic heart disease' },
      'I25.10': { korean: '관상동맥의 죽상경화성 심장질환', english: 'Atherosclerotic heart disease of native coronary artery' },
      'I25.9': { korean: '만성 허혈성 심장질환, 상세불명', english: 'Chronic ischaemic heart disease, unspecified' },
      'I67.8': { korean: '기타 명시된 뇌혈관질환', english: 'Other specified cerebrovascular diseases' },
      'I62.9': { korean: '두개내 출혈, 상세불명', english: 'Intracranial haemorrhage, unspecified' },
      'I66.8': { korean: '기타 뇌동맥의 폐색 및 협착', english: 'Occlusion and stenosis of other cerebral arteries' },
      'J04.0': { korean: '급성 후두염', english: 'Acute laryngitis' },
      'K29.7': { korean: '위염, 상세불명', english: 'Gastritis, unspecified' },
      'J30.4': { korean: '알레르기성 비염, 상세불명', english: 'Allergic rhinitis, unspecified' },
      'H10.3': { korean: '급성 결막염, 상세불명', english: 'Acute conjunctivitis, unspecified' },
      'R07.4': { korean: '흉통, 상세불명', english: 'Chest pain, unspecified' },
      'C78': { korean: '호흡기 및 소화기관의 속발성 악성 신생물', english: 'Secondary malignant neoplasm of respiratory and digestive organs' },
      'C50': { korean: '유방의 악성 신생물', english: 'Malignant neoplasm of breast' },
      'C16': { korean: '위의 악성 신생물', english: 'Malignant neoplasm of stomach' }
    };

    // 의료용어 영어-한글 매핑
    this.medicalTermMappings = {
      // 진단 관련
      'Hypertension': '고혈압',
      'Diabetes Mellitus': '당뇨병',
      'Type 2 DM': '제2형 당뇨병',
      'Coronary Artery Disease': '관상동맥질환',
      'Myocardial Infarction': '심근경색',
      'Cerebrovascular Disease': '뇌혈관질환',
      'Stroke': '뇌졸중',
      'Acute Laryngitis': '급성 후두염',
      'Gastritis': '위염',
      'Allergic Rhinitis': '알레르기성 비염',
      'Conjunctivitis': '결막염',
      'Thyroiditis': '갑상선염',
      'Thyroid Nodule': '갑상선 결절',

      // 검사 관련
      'CT': '컴퓨터 단층촬영',
      'MRI': '자기공명영상',
      'Ultrasound': '초음파',
      'Thyroid Sono': '갑상선 초음파',
      'Fine Needle Aspiration': '세침흡인검사',
      'FNA': '세침흡인검사',
      'Biopsy': '조직검사',
      'Pathology': '병리검사',
      'Cytology': '세포검사',
      'Blood Test': '혈액검사',
      'Urine Test': '소변검사',
      'X-ray': '엑스레이',
      'Echocardiography': '심장초음파',
      'ECG': '심전도',
      'EKG': '심전도',

      // 치료 관련
      'Medication': '약물치료',
      'Surgery': '수술',
      'Operation': '수술',
      'Conservative Treatment': '보존적 치료',
      'Chemotherapy': '화학요법',
      'Radiotherapy': '방사선치료',
      'Physical Therapy': '물리치료',
      'Rehabilitation': '재활치료',

      // 의료기관 관련
      'Hospital': '병원',
      'Clinic': '의원',
      'Emergency Room': '응급실',
      'Outpatient': '외래',
      'Inpatient': '입원',
      'ICU': '중환자실',
      'OR': '수술실',

      // 의료진 관련
      'Doctor': '의사',
      'Physician': '의사',
      'Surgeon': '외과의사',
      'Specialist': '전문의',
      'Nurse': '간호사',
      'Radiologist': '영상의학과 의사',
      'Pathologist': '병리과 의사',
      'Cardiologist': '심장내과 의사',
      'Endocrinologist': '내분비내과 의사',
      'Oncologist': '종양내과 의사'
    };

    // 한글-영어 역매핑
    this.koreanToEnglishMappings = {};
    Object.entries(this.medicalTermMappings).forEach(([english, korean]) => {
      this.koreanToEnglishMappings[korean] = english;
    });

    // 의료 약어 확장
    this.medicalAbbreviations = {
      'HTN': 'Hypertension',
      'DM': 'Diabetes Mellitus',
      'CAD': 'Coronary Artery Disease',
      'MI': 'Myocardial Infarction',
      'CVA': 'Cerebrovascular Accident',
      'COPD': 'Chronic Obstructive Pulmonary Disease',
      'CHF': 'Congestive Heart Failure',
      'CKD': 'Chronic Kidney Disease',
      'GERD': 'Gastroesophageal Reflux Disease',
      'UTI': 'Urinary Tract Infection',
      'URI': 'Upper Respiratory Infection',
      'URTI': 'Upper Respiratory Tract Infection',
      'LRTI': 'Lower Respiratory Tract Infection',
      'TB': 'Tuberculosis',
      'HIV': 'Human Immunodeficiency Virus',
      'AIDS': 'Acquired Immunodeficiency Syndrome',
      'HBV': 'Hepatitis B Virus',
      'HCV': 'Hepatitis C Virus'
    };

    try {
      const fs = require('fs');
      const path = require('path');
      const abbrDir = path.resolve(process.cwd(), '..', 'src', 'rag', 'abbr');
      if (fs.existsSync(abbrDir)) {
        const files = fs.readdirSync(abbrDir).filter((f) => f.endsWith('.json'));
        for (const f of files) {
          const p = path.join(abbrDir, f);
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const entry of data) {
            const ab = String(entry.abbr || '').trim();
            const eng = String(entry.eng || entry.full || '').trim();
            const kor = typeof entry.kor === 'string' ? entry.kor.trim() : null;
            if (ab && eng && !this.medicalAbbreviations[ab]) this.medicalAbbreviations[ab] = eng;
            if (eng && kor && !this.medicalTermMappings[eng]) this.medicalTermMappings[eng] = kor;
            if (kor && eng && !this.koreanToEnglishMappings[kor]) this.koreanToEnglishMappings[kor] = eng;
          }
        }
      }
    } catch (_) { }

    // 손해사정 관련 제외 키워드 (보험사가 아닌 손해사정조사회사 구분)
    this.excludeInsuranceCompanyKeywords = [
      '손해사정', '사정조사', '조사회사', '사정회사', '손사', '해오름손해사정'
    ];
  }

  /**
   * ICD 코드 처리 ([ICD코드/한글-영어] 형식으로 통일)
   * @param {string} text 처리할 텍스트
   * @returns {string} 처리된 텍스트
   */
  processICDCodes(text) {
    // ICD 코드 패턴 매칭 (예: E11.78, I25.9, R074 등)
    const icdPattern = /([A-Z]\d{2,3}(?:\.\d{1,2})?)/g;

    return text.replace(icdPattern, (match, icdCode) => {
      // R074 -> R07.4 형식으로 정규화
      let normalizedCode = icdCode;
      if (/^[A-Z]\d{3}$/.test(icdCode)) {
        // 3자리 숫자인 경우 점 추가 (R074 -> R07.4)
        normalizedCode = icdCode.slice(0, 3) + '.' + icdCode.slice(3);
      }

      // 정규화된 코드로 매핑 확인
      let mapping = this.icdMappings[normalizedCode];
      if (!mapping) {
        // 원본 코드로도 확인
        mapping = this.icdMappings[icdCode];
      }

      if (mapping) {
        // '[ICD코드/한글-영어]' 형식으로 통일
        return `[${icdCode}/${mapping.korean}-${mapping.english}]`;
      }

      // 매핑이 없는 경우 원본 반환
      return match;
    });
  }

  /**
   * 의료용어 영어/한글 상호 보완
   * @param {string} text 처리할 텍스트
   * @returns {Object} 처리 결과
   */
  enhanceMedicalTerms(text) {
    let enhancedText = text;
    const addedTerms = [];

    // 영어 의료용어에 한글 병기 추가
    Object.entries(this.medicalTermMappings).forEach(([english, korean]) => {
      const englishPattern = new RegExp(`\\b${english}\\b`, 'gi');
      if (englishPattern.test(enhancedText)) {
        // 이미 한글이 병기되어 있지 않은 경우에만 추가
        const alreadyPairedPattern = new RegExp(`${english}\\s*\\([^)]*${korean}[^)]*\\)`, 'gi');
        if (!alreadyPairedPattern.test(enhancedText)) {
          enhancedText = enhancedText.replace(englishPattern, `${english} (${korean})`);
          addedTerms.push(`${english} → ${korean}`);
        }
      }
    });

    // 한글 의료용어에 영어 병기 추가
    Object.entries(this.koreanToEnglishMappings).forEach(([korean, english]) => {
      const koreanPattern = new RegExp(`\\b${korean}\\b`, 'g');
      if (koreanPattern.test(enhancedText)) {
        // 이미 영어가 병기되어 있지 않은 경우에만 추가
        const alreadyPairedPattern = new RegExp(`${korean}\\s*\\([^)]*${english}[^)]*\\)`, 'gi');
        if (!alreadyPairedPattern.test(enhancedText)) {
          enhancedText = enhancedText.replace(koreanPattern, `${korean} (${english})`);
          addedTerms.push(`${korean} → ${english}`);
        }
      }
    });

    // 의료 약어 확장
    Object.entries(this.medicalAbbreviations).forEach(([abbr, fullForm]) => {
      const abbrPattern = new RegExp(`\\b${abbr}\\b`, 'g');
      if (abbrPattern.test(enhancedText)) {
        const korean = this.medicalTermMappings[fullForm];
        if (korean) {
          enhancedText = enhancedText.replace(abbrPattern, `${abbr} (${fullForm}, ${korean})`);
          addedTerms.push(`${abbr} → ${fullForm}, ${korean}`);
        } else {
          enhancedText = enhancedText.replace(abbrPattern, `${abbr} (${fullForm})`);
          addedTerms.push(`${abbr} → ${fullForm}`);
        }
      }
    });

    return {
      enhancedText,
      addedTerms
    };
  }

  /**
   * 손해사정 문맥 필터링 (보험사와 손해사정조사회사 구분)
   * @param {string} text 처리할 텍스트
   * @returns {Object} 필터링 결과
   */
  filterInsuranceContext(text) {
    const filteredSections = [];
    const excludedSections = [];

    // 텍스트를 문장 단위로 분리
    const sentences = text.split(/[.!?]\s+/);

    sentences.forEach(sentence => {
      let isExcluded = false;

      // 손해사정 관련 키워드 체크
      for (const keyword of this.excludeInsuranceCompanyKeywords) {
        if (sentence.includes(keyword)) {
          isExcluded = true;
          excludedSections.push({
            sentence,
            reason: `손해사정조사회사 관련 내용: "${keyword}"`
          });
          break;
        }
      }

      if (!isExcluded) {
        filteredSections.push(sentence);
      }
    });

    return {
      filteredText: filteredSections.join('. '),
      excludedSections,
      originalLength: sentences.length,
      filteredLength: filteredSections.length
    };
  }

  /**
   * 종합 의료용어 처리
   * @param {string} text 처리할 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Object} 종합 처리 결과
   */
  processComprehensive(text, options = {}) {
    const {
      processICD = true,
      enhanceTerms = true,
      filterContext = true,
      includeStatistics = true
    } = options;

    let processedText = text;
    const processingLog = [];

    // 1. 손해사정 문맥 필터링
    let contextResult = null;
    if (filterContext) {
      contextResult = this.filterInsuranceContext(processedText);
      processedText = contextResult.filteredText;
      processingLog.push(`문맥 필터링: ${contextResult.excludedSections.length}개 섹션 제외`);
    }

    // 2. ICD 코드 처리
    if (processICD) {
      const beforeICD = processedText;
      processedText = this.processICDCodes(processedText);
      const icdChanges = (processedText.match(/[A-Z]\d{2}(?:\.\d{1,2})?\s*\([^)]+\)/g) || []).length;
      processingLog.push(`ICD 코드 처리: ${icdChanges}개 코드 병기 추가`);
    }

    // 3. 의료용어 영어/한글 상호 보완
    let termResult = null;
    if (enhanceTerms) {
      termResult = this.enhanceMedicalTerms(processedText);
      processedText = termResult.enhancedText;
      processingLog.push(`의료용어 보완: ${termResult.addedTerms.length}개 용어 병기 추가`);
    }

    // 4. 통계 정보 생성
    const statistics = includeStatistics ? this.generateStatistics(text, processedText) : null;

    return {
      originalText: text,
      processedText,
      contextFiltering: contextResult,
      termEnhancement: termResult,
      statistics,
      processingLog,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 처리 통계 생성
   * @param {string} originalText 원본 텍스트
   * @param {string} processedText 처리된 텍스트
   * @returns {Object} 통계 정보
   */
  generateStatistics(originalText, processedText) {
    const originalLength = originalText.length;
    const processedLength = processedText.length;
    const lengthIncrease = processedLength - originalLength;
    const increasePercentage = ((lengthIncrease / originalLength) * 100).toFixed(2);

    // 병기된 용어 개수 계산
    const pairedTermsCount = (processedText.match(/\([^)]+\)/g) || []).length;

    // ICD 코드 개수 계산
    const icdCodesCount = (processedText.match(/[A-Z]\d{2}(?:\.\d{1,2})?/g) || []).length;

    return {
      originalLength,
      processedLength,
      lengthIncrease,
      increasePercentage: `${increasePercentage}%`,
      pairedTermsCount,
      icdCodesCount,
      processingDate: new Date().toLocaleString('ko-KR')
    };
  }

  /**
   * 의료용어 매핑 추가
   * @param {Object} newMappings 새로운 매핑 데이터
   */
  addMedicalTermMappings(newMappings) {
    Object.assign(this.medicalTermMappings, newMappings);

    // 한글-영어 역매핑 업데이트
    Object.entries(newMappings).forEach(([english, korean]) => {
      this.koreanToEnglishMappings[korean] = english;
    });
  }

  /**
   * ICD 코드 매핑 추가
   * @param {Object} newICDMappings 새로운 ICD 매핑 데이터
   */
  addICDMappings(newICDMappings) {
    Object.assign(this.icdMappings, newICDMappings);
  }
}

module.exports = EnhancedMedicalTermProcessor;
