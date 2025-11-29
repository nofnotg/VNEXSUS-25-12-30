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
    // ICD 코드 매핑 데이터베이스 (KCD-10 기준) - 확장된 버전
    this.icdMappings = {
      // 당뇨병 관련 (E10-E14)
      'E10': { korean: '제1형 당뇨병', english: 'Type 1 diabetes mellitus' },
      'E10.9': { korean: '제1형 당뇨병, 합병증 없는', english: 'Type 1 diabetes mellitus without complications' },
      'E11': { korean: '제2형 당뇨병', english: 'Type 2 diabetes mellitus' },
      'E11.9': { korean: '제2형 당뇨병, 합병증 없는', english: 'Type 2 diabetes mellitus without complications' },
      'E11.68': { korean: '제2형 당뇨병, 기타 명시된 합병증을 동반한', english: 'Type 2 diabetes mellitus with other specified complications' },
      'E11.78': { korean: '제2형 당뇨병, 다발성 합병증을 동반한', english: 'Type 2 diabetes mellitus with multiple complications' },
      'E14': { korean: '상세불명의 당뇨병', english: 'Unspecified diabetes mellitus' },
      'E14.9': { korean: '상세불명의 당뇨병, 합병증 없는', english: 'Unspecified diabetes mellitus without complications' },

      // 고혈압 관련 (I10-I15)
      'I10': { korean: '본태성 고혈압', english: 'Essential hypertension' },
      'I11': { korean: '고혈압성 심장질환', english: 'Hypertensive heart disease' },
      'I11.9': { korean: '고혈압성 심장질환, 심부전 없는', english: 'Hypertensive heart disease without heart failure' },
      'I12': { korean: '고혈압성 신장질환', english: 'Hypertensive renal disease' },
      'I13': { korean: '고혈압성 심장 및 신장질환', english: 'Hypertensive heart and renal disease' },

      // 허혈성 심장질환 (I20-I25)
      'I20': { korean: '협심증', english: 'Angina pectoris' },
      'I20.0': { korean: '불안정 협심증', english: 'Unstable angina' },
      'I20.9': { korean: '협심증, 상세불명', english: 'Angina pectoris, unspecified' },
      'I21': { korean: '급성 심근경색증', english: 'Acute myocardial infarction' },
      'I21.9': { korean: '급성 심근경색증, 상세불명', english: 'Acute myocardial infarction, unspecified' },
      'I22': { korean: '후속 심근경색증', english: 'Subsequent myocardial infarction' },
      'I25': { korean: '만성 허혈성 심장질환', english: 'Chronic ischaemic heart disease' },
      'I25.10': { korean: '관상동맥의 죽상경화성 심장질환', english: 'Atherosclerotic heart disease of native coronary artery' },
      'I25.9': { korean: '만성 허혈성 심장질환, 상세불명', english: 'Chronic ischaemic heart disease, unspecified' },

      // 뇌혈관질환 (I60-I69)
      'I60': { korean: '지주막하 출혈', english: 'Subarachnoid haemorrhage' },
      'I61': { korean: '뇌내출혈', english: 'Intracerebral haemorrhage' },
      'I62': { korean: '기타 비외상성 두개내 출혈', english: 'Other nontraumatic intracranial haemorrhage' },
      'I62.9': { korean: '두개내 출혈, 상세불명', english: 'Intracranial haemorrhage, unspecified' },
      'I63': { korean: '뇌경색증', english: 'Cerebral infarction' },
      'I63.9': { korean: '뇌경색증, 상세불명', english: 'Cerebral infarction, unspecified' },
      'I64': { korean: '출혈 또는 경색으로 명시되지 않은 뇌졸중', english: 'Stroke, not specified as haemorrhage or infarction' },
      'I66.8': { korean: '기타 뇌동맥의 폐색 및 협착', english: 'Occlusion and stenosis of other cerebral arteries' },
      'I67.8': { korean: '기타 명시된 뇌혈관질환', english: 'Other specified cerebrovascular diseases' },

      // 악성 신생물 (C00-C97)
      'C16': { korean: '위의 악성 신생물', english: 'Malignant neoplasm of stomach' },
      'C18': { korean: '결장의 악성 신생물', english: 'Malignant neoplasm of colon' },
      'C20': { korean: '직장의 악성 신생물', english: 'Malignant neoplasm of rectum' },
      'C25': { korean: '췌장의 악성 신생물', english: 'Malignant neoplasm of pancreas' },
      'C34': { korean: '기관지 및 폐의 악성 신생물', english: 'Malignant neoplasm of bronchus and lung' },
      'C50': { korean: '유방의 악성 신생물', english: 'Malignant neoplasm of breast' },
      'C53': { korean: '자궁경부의 악성 신생물', english: 'Malignant neoplasm of cervix uteri' },
      'C56': { korean: '난소의 악성 신생물', english: 'Malignant neoplasm of ovary' },
      'C61': { korean: '전립선의 악성 신생물', english: 'Malignant neoplasm of prostate' },
      'C67': { korean: '방광의 악성 신생물', english: 'Malignant neoplasm of bladder' },
      'C78': { korean: '호흡기 및 소화기관의 속발성 악성 신생물', english: 'Secondary malignant neoplasm of respiratory and digestive organs' },
      'C80': { korean: '부위 명시되지 않은 악성 신생물', english: 'Malignant neoplasm without specification of site' },

      // 호흡기 질환 (J00-J99)
      'J04.0': { korean: '급성 후두염', english: 'Acute laryngitis' },
      'J06.9': { korean: '급성 상기도감염, 상세불명', english: 'Acute upper respiratory infection, unspecified' },
      'J18.9': { korean: '폐렴, 상세불명', english: 'Pneumonia, unspecified' },
      'J30.4': { korean: '알레르기성 비염, 상세불명', english: 'Allergic rhinitis, unspecified' },
      'J44': { korean: '기타 만성 폐쇄성 폐질환', english: 'Other chronic obstructive pulmonary disease' },
      'J44.0': { korean: '급성 하기도감염을 동반한 만성 폐쇄성 폐질환', english: 'Chronic obstructive pulmonary disease with acute lower respiratory infection' },
      'J44.1': { korean: '급성 악화를 동반한 만성 폐쇄성 폐질환', english: 'Chronic obstructive pulmonary disease with acute exacerbation' },
      'J45': { korean: '천식', english: 'Asthma' },
      'J45.9': { korean: '천식, 상세불명', english: 'Asthma, unspecified' },

      // 소화기 질환 (K00-K93)
      'K25': { korean: '위궤양', english: 'Gastric ulcer' },
      'K25.9': { korean: '위궤양, 출혈이나 천공 없는, 상세불명', english: 'Gastric ulcer, unspecified as acute or chronic, without haemorrhage or perforation' },
      'K26': { korean: '십이지장궤양', english: 'Duodenal ulcer' },
      'K29.7': { korean: '위염, 상세불명', english: 'Gastritis, unspecified' },
      'K35': { korean: '급성 충수염', english: 'Acute appendicitis' },
      'K35.9': { korean: '급성 충수염, 상세불명', english: 'Acute appendicitis, unspecified' },
      'K40': { korean: '서혜헤르니아', english: 'Inguinal hernia' },
      'K57': { korean: '장의 게실질환', english: 'Diverticular disease of intestine' },
      'K80': { korean: '담석증', english: 'Cholelithiasis' },
      'K80.2': { korean: '합병증 없는 담낭결석', english: 'Calculus of gallbladder without cholangitis or cholecystitis' },

      // 근골격계 질환 (M00-M99)
      'M06.9': { korean: '류마티스 관절염, 상세불명', english: 'Rheumatoid arthritis, unspecified' },
      'M15.9': { korean: '다발성 관절증, 상세불명', english: 'Polyarthrosis, unspecified' },
      'M17': { korean: '무릎관절증', english: 'Gonarthrosis' },
      'M17.9': { korean: '무릎관절증, 상세불명', english: 'Gonarthrosis, unspecified' },
      'M19.9': { korean: '관절증, 상세불명', english: 'Arthrosis, unspecified' },
      'M25.5': { korean: '관절통', english: 'Pain in joint' },
      'M54.5': { korean: '요통', english: 'Low back pain' },
      'M79.3': { korean: '판막염, 달리 분류되지 않은', english: 'Panniculitis, unspecified' },

      // 신경계 질환 (G00-G99)
      'G40': { korean: '뇌전증', english: 'Epilepsy' },
      'G40.9': { korean: '뇌전증, 상세불명', english: 'Epilepsy, unspecified' },
      'G43': { korean: '편두통', english: 'Migraine' },
      'G43.9': { korean: '편두통, 상세불명', english: 'Migraine, unspecified' },
      'G47.0': { korean: '수면개시 및 수면유지 장애', english: 'Disorders of initiating and maintaining sleep' },

      // 안과 질환 (H00-H59)
      'H10.3': { korean: '급성 결막염, 상세불명', english: 'Acute conjunctivitis, unspecified' },
      'H25.9': { korean: '노인성 백내장, 상세불명', english: 'Age-related cataract, unspecified' },
      'H40.9': { korean: '녹내장, 상세불명', english: 'Glaucoma, unspecified' },
      'H52.1': { korean: '근시', english: 'Myopia' },

      // 증상 및 징후 (R00-R99)
      'R05': { korean: '기침', english: 'Cough' },
      'R06.0': { korean: '호흡곤란', english: 'Dyspnoea' },
      'R07.4': { korean: '흉통, 상세불명', english: 'Chest pain, unspecified' },
      'R10.4': { korean: '기타 및 상세불명의 복통', english: 'Other and unspecified abdominal pain' },
      'R50.9': { korean: '발열, 상세불명', english: 'Fever, unspecified' },
      'R51': { korean: '두통', english: 'Headache' },
      'R53': { korean: '권태감 및 피로', english: 'Malaise and fatigue' },

      // 외상 및 중독 (S00-T98)
      'S06.0': { korean: '뇌진탕', english: 'Concussion' },
      'S72.0': { korean: '대퇴골 경부 골절', english: 'Fracture of neck of femur' },
      'S82.6': { korean: '발목 골절', english: 'Fracture of lateral malleolus' },
      'T14.9': { korean: '손상, 상세불명', english: 'Injury, unspecified' }
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
    } catch (_) {}

    // 손해사정 관련 제외 키워드 (보험사가 아닌 손해사정조사회사 구분)
    this.excludeInsuranceCompanyKeywords = [
      '손해사정', '사정조사', '조사회사', '사정회사', '손사', '해오름손해사정'
    ];
  }

  /**
   * ICD 코드 처리 (코드 한글명(영어명) 형식으로 통일)
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
      
      // 상위 코드로도 확인 (예: E11.78 -> E11)
      if (!mapping && icdCode.includes('.')) {
        const parentCode = icdCode.split('.')[0];
        mapping = this.icdMappings[parentCode];
      }
      
      if (mapping) {
        // '코드 한글명(영어명)' 형식으로 통일
        return `${icdCode} ${mapping.korean}(${mapping.english})`;
      }
      
      // 매핑이 없는 경우에도 일관된 형식으로 표시
      console.warn(`ICD 코드 매핑 없음: ${icdCode}`);
      return `${icdCode} (매핑 정보 없음)`;
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
