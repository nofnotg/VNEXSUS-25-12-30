/**
 * Medical Entity Extractor Module
 * 
 * 역할:
 * 1. 의료 문서에서 핵심 엔티티 추출 (질병명, 약물명, 검사명 등)
 * 2. 의료 용어 표준화 및 코드 매핑
 * 3. AI 기반 엔티티 인식 및 분류
 * 4. 의료 데이터 품질 검증
 */

class MedicalEntityExtractor {
  constructor() {
    // 의료 엔티티 사전
    this.medicalDictionary = {
      // 질병명 사전
      diseases: {
        '고혈압': { icd10: 'I10', category: 'cardiovascular', severity: 'chronic' },
        '당뇨병': { icd10: 'E11', category: 'endocrine', severity: 'chronic' },
        '심근경색': { icd10: 'I21', category: 'cardiovascular', severity: 'acute' },
        '뇌졸중': { icd10: 'I64', category: 'neurological', severity: 'acute' },
        '폐렴': { icd10: 'J18', category: 'respiratory', severity: 'acute' },
        '골절': { icd10: 'S72', category: 'orthopedic', severity: 'trauma' },
        '암': { icd10: 'C80', category: 'oncology', severity: 'critical' },
        '위염': { icd10: 'K29', category: 'gastroenterology', severity: 'mild' },
        '천식': { icd10: 'J45', category: 'respiratory', severity: 'chronic' },
        '우울증': { icd10: 'F32', category: 'psychiatric', severity: 'moderate' }
      },
      
      // 약물명 사전
      medications: {
        '아스피린': { category: 'analgesic', type: 'NSAID', dosage: '100mg' },
        '메트포르민': { category: 'antidiabetic', type: 'biguanide', dosage: '500mg' },
        '리시노프릴': { category: 'antihypertensive', type: 'ACE_inhibitor', dosage: '10mg' },
        '아토르바스타틴': { category: 'statin', type: 'cholesterol_lowering', dosage: '20mg' },
        '오메프라졸': { category: 'PPI', type: 'gastric_acid_reducer', dosage: '20mg' },
        '레보티록신': { category: 'thyroid_hormone', type: 'hormone_replacement', dosage: '50mcg' },
        '암로디핀': { category: 'antihypertensive', type: 'calcium_channel_blocker', dosage: '5mg' },
        '심바스타틴': { category: 'statin', type: 'cholesterol_lowering', dosage: '20mg' }
      },
      
      // 검사명 사전
      tests: {
        'CT': { fullName: 'Computed Tomography', category: 'imaging', radiation: true },
        'MRI': { fullName: 'Magnetic Resonance Imaging', category: 'imaging', radiation: false },
        'X-ray': { fullName: 'X-ray', category: 'imaging', radiation: true },
        '혈액검사': { fullName: 'Blood Test', category: 'laboratory', radiation: false },
        '심전도': { fullName: 'Electrocardiogram', category: 'cardiac', radiation: false },
        '초음파': { fullName: 'Ultrasound', category: 'imaging', radiation: false },
        '내시경': { fullName: 'Endoscopy', category: 'procedure', radiation: false },
        '조직검사': { fullName: 'Biopsy', category: 'pathology', radiation: false }
      },
      
      // 의료기관 유형
      facilityTypes: {
        '종합병원': { level: 'tertiary', capacity: 'large' },
        '대학병원': { level: 'tertiary', capacity: 'large' },
        '병원': { level: 'secondary', capacity: 'medium' },
        '의원': { level: 'primary', capacity: 'small' },
        '클리닉': { level: 'primary', capacity: 'small' },
        '보건소': { level: 'public', capacity: 'small' },
        '응급실': { level: 'emergency', capacity: 'variable' }
      }
    };
    
    // 의료 엔티티 패턴
    this.entityPatterns = {
      // 질병명 패턴
      disease: {
        direct: /(?:진단|병명|질환)\s*[:：]?\s*([가-힣\w\s]+)/gi,
        icd: /([A-Z]\d{2}(?:\.\d{1,2})?)\s*([가-힣\w\s]+)/gi,
        symptom: /(?:증상|호소|주소)\s*[:：]?\s*([가-힣\w\s,]+)/gi
      },
      
      // 약물명 패턴
      medication: {
        prescription: /(?:처방|투약|복용)\s*[:：]?\s*([가-힣\w\s,]+)/gi,
        dosage: /([가-힣\w]+)\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|정|캡슐)/gi,
        frequency: /(\d+)\s*(?:회|번)\s*\/\s*(?:일|하루)/gi
      },
      
      // 검사명 패턴
      test: {
        imaging: /(CT|MRI|X-ray|초음파|촬영)/gi,
        laboratory: /(?:혈액|소변|검사)\s*(?:검사)?/gi,
        procedure: /(?:내시경|조직검사|생검)/gi
      },
      
      // 의료진 패턴
      staff: {
        doctor: /(?:의사|전문의|주치의)\s*[:：]?\s*([가-힣]{2,4})/gi,
        nurse: /(?:간호사)\s*[:：]?\s*([가-힣]{2,4})/gi
      },
      
      // 의료기관 패턴
      facility: {
        hospital: /([가-힣\w\s]+)(?:종합병원|대학병원|병원|의원|클리닉)/gi,
        department: /([가-힣\w]+)과/gi
      }
    };
    
    // 의료 약어 사전
    this.medicalAbbreviations = {
      'HTN': '고혈압',
      'DM': '당뇨병',
      'MI': '심근경색',
      'CVA': '뇌졸중',
      'COPD': '만성폐쇄성폐질환',
      'CHF': '울혈성심부전',
      'CAD': '관상동맥질환',
      'CKD': '만성신장질환',
      'GERD': '위식도역류질환',
      'UTI': '요로감염'
    };
    
    // 의료 단위 정규화
    this.medicalUnits = {
      weight: ['kg', 'g', 'mg', 'mcg'],
      volume: ['L', 'ml', 'cc'],
      pressure: ['mmHg', 'kPa'],
      temperature: ['°C', '°F'],
      frequency: ['회/일', '번/일', 'times/day']
    };
  }

  /**
   * 의료 문서에서 모든 엔티티 추출
   * @param {string} text 의료 문서 텍스트
   * @param {Object} options 추출 옵션
   * @returns {Promise<Object>} 추출된 엔티티 정보
   */
  async extractAllEntities(text, options = {}) {
    try {
      console.log('🔍 의료 엔티티 추출 시작...');
      
      const entities = {
        diseases: await this.extractDiseases(text),
        medications: await this.extractMedications(text),
        tests: await this.extractTests(text),
        facilities: await this.extractFacilities(text),
        staff: await this.extractMedicalStaff(text),
        vitals: await this.extractVitalSigns(text),
        dates: await this.extractMedicalDates(text)
      };
      
      // 엔티티 품질 검증
      const validatedEntities = this._validateEntities(entities);
      
      // 엔티티 표준화
      const standardizedEntities = this._standardizeEntities(validatedEntities);
      
      console.log('✅ 의료 엔티티 추출 완료');
      return {
        success: true,
        entities: standardizedEntities,
        statistics: this._generateEntityStatistics(standardizedEntities),
        confidence: this._calculateConfidenceScore(standardizedEntities)
      };
      
    } catch (error) {
      console.error('❌ 의료 엔티티 추출 중 오류:', error);
      throw new Error(`의료 엔티티 추출 실패: ${error.message}`);
    }
  }

  /**
   * 질병명 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 질병 정보 배열
   */
  async extractDiseases(text) {
    const diseases = [];
    
    // 직접 진단명 추출
    const directMatches = this._extractByPattern(text, this.entityPatterns.disease.direct);
    directMatches.forEach(match => {
      const diseaseName = this._cleanEntityText(match.value);
      const standardized = this._standardizeDiseaseName(diseaseName);
      
      if (standardized) {
        diseases.push({
          name: standardized.name,
          originalText: match.value,
          icd10: standardized.icd10,
          category: standardized.category,
          severity: standardized.severity,
          confidence: this._calculateEntityConfidence(match.value, 'disease'),
          position: match.index
        });
      }
    });
    
    // ICD 코드와 함께 추출
    const icdMatches = this._extractByPattern(text, this.entityPatterns.disease.icd);
    icdMatches.forEach(match => {
      const parts = match.value.split(/\s+/);
      const icdCode = parts[0];
      const diseaseName = parts.slice(1).join(' ');
      
      diseases.push({
        name: this._cleanEntityText(diseaseName),
        originalText: match.value,
        icd10: icdCode,
        category: this._getCategoryByICD(icdCode),
        confidence: 0.9, // ICD 코드가 있으면 높은 신뢰도
        position: match.index
      });
    });
    
    return this._deduplicateEntities(diseases, 'name');
  }

  /**
   * 약물명 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 약물 정보 배열
   */
  async extractMedications(text) {
    const medications = [];
    
    // 처방 정보 추출
    const prescriptionMatches = this._extractByPattern(text, this.entityPatterns.medication.prescription);
    prescriptionMatches.forEach(match => {
      const medicationText = this._cleanEntityText(match.value);
      const medicationList = medicationText.split(/[,，;；]/);
      
      medicationList.forEach(med => {
        const cleanMed = med.trim();
        if (cleanMed.length > 1) {
          const standardized = this._standardizeMedicationName(cleanMed);
          
          medications.push({
            name: standardized ? standardized.name : cleanMed,
            originalText: cleanMed,
            category: standardized?.category,
            type: standardized?.type,
            dosage: this._extractDosageFromText(match.context),
            frequency: this._extractFrequencyFromText(match.context),
            confidence: this._calculateEntityConfidence(cleanMed, 'medication'),
            position: match.index
          });
        }
      });
    });
    
    return this._deduplicateEntities(medications, 'name');
  }

  /**
   * 검사명 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 검사 정보 배열
   */
  async extractTests(text) {
    const tests = [];
    
    // 영상 검사 추출
    const imagingMatches = this._extractByPattern(text, this.entityPatterns.test.imaging);
    imagingMatches.forEach(match => {
      const testName = this._cleanEntityText(match.value);
      const standardized = this._standardizeTestName(testName);
      
      tests.push({
        name: standardized ? standardized.fullName : testName,
        originalText: match.value,
        category: standardized?.category || 'imaging',
        radiation: standardized?.radiation,
        confidence: this._calculateEntityConfidence(match.value, 'test'),
        position: match.index
      });
    });
    
    // 검사실 검사 추출
    const labMatches = this._extractByPattern(text, this.entityPatterns.test.laboratory);
    labMatches.forEach(match => {
      const testName = this._cleanEntityText(match.value);
      
      tests.push({
        name: testName,
        originalText: match.value,
        category: 'laboratory',
        radiation: false,
        confidence: this._calculateEntityConfidence(match.value, 'test'),
        position: match.index
      });
    });
    
    return this._deduplicateEntities(tests, 'name');
  }

  /**
   * 의료기관 정보 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 의료기관 정보 배열
   */
  async extractFacilities(text) {
    const facilities = [];
    
    const facilityMatches = this._extractByPattern(text, this.entityPatterns.facility.hospital);
    facilityMatches.forEach(match => {
      const facilityName = this._cleanEntityText(match.value);
      const facilityType = this._identifyFacilityType(facilityName);
      
      facilities.push({
        name: facilityName,
        originalText: match.value,
        type: facilityType.type,
        level: facilityType.level,
        capacity: facilityType.capacity,
        confidence: this._calculateEntityConfidence(match.value, 'facility'),
        position: match.index
      });
    });
    
    return this._deduplicateEntities(facilities, 'name');
  }

  /**
   * 의료진 정보 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 의료진 정보 배열
   */
  async extractMedicalStaff(text) {
    const staff = [];
    
    // 의사 정보 추출
    const doctorMatches = this._extractByPattern(text, this.entityPatterns.staff.doctor);
    doctorMatches.forEach(match => {
      const doctorName = this._cleanEntityText(match.value);
      
      staff.push({
        name: doctorName,
        originalText: match.value,
        role: 'doctor',
        confidence: this._calculateEntityConfidence(match.value, 'staff'),
        position: match.index
      });
    });
    
    // 간호사 정보 추출
    const nurseMatches = this._extractByPattern(text, this.entityPatterns.staff.nurse);
    nurseMatches.forEach(match => {
      const nurseName = this._cleanEntityText(match.value);
      
      staff.push({
        name: nurseName,
        originalText: match.value,
        role: 'nurse',
        confidence: this._calculateEntityConfidence(match.value, 'staff'),
        position: match.index
      });
    });
    
    return this._deduplicateEntities(staff, 'name');
  }

  /**
   * 생체 징후 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 생체 징후 정보 배열
   */
  async extractVitalSigns(text) {
    const vitals = [];
    
    // 혈압 추출
    const bpPattern = /(\d{2,3})\/(\d{2,3})\s*mmHg/gi;
    const bpMatches = this._extractByPattern(text, bpPattern);
    bpMatches.forEach(match => {
      const [, systolic, diastolic] = match.value.match(bpPattern);
      
      vitals.push({
        type: 'blood_pressure',
        value: `${systolic}/${diastolic}`,
        unit: 'mmHg',
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        normal: this._isNormalBloodPressure(systolic, diastolic),
        originalText: match.value,
        confidence: 0.95,
        position: match.index
      });
    });
    
    // 체온 추출
    const tempPattern = /(\d{2,3}(?:\.\d{1,2})?)\s*°?C/gi;
    const tempMatches = this._extractByPattern(text, tempPattern);
    tempMatches.forEach(match => {
      const [, temperature] = match.value.match(tempPattern);
      const temp = parseFloat(temperature);
      
      vitals.push({
        type: 'temperature',
        value: temp,
        unit: '°C',
        normal: this._isNormalTemperature(temp),
        originalText: match.value,
        confidence: 0.9,
        position: match.index
      });
    });
    
    // 맥박 추출
    const pulsePattern = /(\d{2,3})\s*(?:회\/분|bpm)/gi;
    const pulseMatches = this._extractByPattern(text, pulsePattern);
    pulseMatches.forEach(match => {
      const [, pulse] = match.value.match(pulsePattern);
      const pulseRate = parseInt(pulse);
      
      vitals.push({
        type: 'pulse',
        value: pulseRate,
        unit: 'bpm',
        normal: this._isNormalPulse(pulseRate),
        originalText: match.value,
        confidence: 0.9,
        position: match.index
      });
    });
    
    return vitals;
  }

  /**
   * 의료 관련 날짜 추출
   * @param {string} text 텍스트
   * @returns {Promise<Array>} 의료 날짜 정보 배열
   */
  async extractMedicalDates(text) {
    const dates = [];
    
    // 진료일, 입원일, 수술일 등 의료 관련 날짜 패턴
    const medicalDatePatterns = [
      { pattern: /(?:진료일|내원일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi, type: 'visit' },
      { pattern: /(?:입원일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi, type: 'admission' },
      { pattern: /(?:퇴원일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi, type: 'discharge' },
      { pattern: /(?:수술일|시술일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi, type: 'surgery' },
      { pattern: /(?:검사일|촬영일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi, type: 'test' }
    ];
    
    medicalDatePatterns.forEach(({ pattern, type }) => {
      const matches = this._extractByPattern(text, pattern);
      matches.forEach(match => {
        const dateMatch = match.value.match(/(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/);
        if (dateMatch) {
          dates.push({
            date: this._normalizeDate(dateMatch[1]),
            type: type,
            originalText: match.value,
            confidence: 0.95,
            position: match.index
          });
        }
      });
    });
    
    return dates.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * 패턴으로 엔티티 추출
   * @param {string} text 텍스트
   * @param {RegExp} pattern 정규식 패턴
   * @returns {Array} 매치 결과 배열
   * @private
   */
  _extractByPattern(text, pattern) {
    const matches = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        value: match[1] || match[0],
        fullMatch: match[0],
        index: match.index,
        context: text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50)
      });
    }
    
    return matches;
  }

  /**
   * 엔티티 텍스트 정리
   * @param {string} text 텍스트
   * @returns {string} 정리된 텍스트
   * @private
   */
  _cleanEntityText(text) {
    if (!text) return '';
    
    return text
      .replace(/[\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[:：\s]+|[:：\s]+$/g, '')
      .trim();
  }

  /**
   * 질병명 표준화
   * @param {string} diseaseName 질병명
   * @returns {Object|null} 표준화된 질병 정보
   * @private
   */
  _standardizeDiseaseName(diseaseName) {
    const cleaned = diseaseName.toLowerCase().trim();
    
    // 직접 매칭
    for (const [standard, info] of Object.entries(this.medicalDictionary.diseases)) {
      if (cleaned.includes(standard.toLowerCase()) || standard.toLowerCase().includes(cleaned)) {
        return { name: standard, ...info };
      }
    }
    
    // 약어 확장
    for (const [abbr, full] of Object.entries(this.medicalAbbreviations)) {
      if (cleaned.includes(abbr.toLowerCase())) {
        const standardInfo = this.medicalDictionary.diseases[full];
        if (standardInfo) {
          return { name: full, ...standardInfo };
        }
      }
    }
    
    return null;
  }

  /**
   * 약물명 표준화
   * @param {string} medicationName 약물명
   * @returns {Object|null} 표준화된 약물 정보
   * @private
   */
  _standardizeMedicationName(medicationName) {
    const cleaned = medicationName.toLowerCase().trim();
    
    for (const [standard, info] of Object.entries(this.medicalDictionary.medications)) {
      if (cleaned.includes(standard.toLowerCase()) || standard.toLowerCase().includes(cleaned)) {
        return { name: standard, ...info };
      }
    }
    
    return null;
  }

  /**
   * 검사명 표준화
   * @param {string} testName 검사명
   * @returns {Object|null} 표준화된 검사 정보
   * @private
   */
  _standardizeTestName(testName) {
    const cleaned = testName.toLowerCase().trim();
    
    for (const [standard, info] of Object.entries(this.medicalDictionary.tests)) {
      if (cleaned.includes(standard.toLowerCase()) || standard.toLowerCase().includes(cleaned)) {
        return { name: standard, ...info };
      }
    }
    
    return null;
  }

  /**
   * 의료기관 유형 식별
   * @param {string} facilityName 의료기관명
   * @returns {Object} 의료기관 유형 정보
   * @private
   */
  _identifyFacilityType(facilityName) {
    for (const [type, info] of Object.entries(this.medicalDictionary.facilityTypes)) {
      if (facilityName.includes(type)) {
        return { type, ...info };
      }
    }
    
    return { type: 'unknown', level: 'unknown', capacity: 'unknown' };
  }

  /**
   * 용량 정보 추출
   * @param {string} context 문맥
   * @returns {string|null} 용량 정보
   * @private
   */
  _extractDosageFromText(context) {
    const dosageMatch = context.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|정|캡슐)/i);
    return dosageMatch ? `${dosageMatch[1]}${dosageMatch[2]}` : null;
  }

  /**
   * 복용 빈도 추출
   * @param {string} context 문맥
   * @returns {string|null} 복용 빈도
   * @private
   */
  _extractFrequencyFromText(context) {
    const frequencyMatch = context.match(/(\d+)\s*(?:회|번)\s*\/\s*(?:일|하루)/i);
    return frequencyMatch ? `${frequencyMatch[1]}회/일` : null;
  }

  /**
   * 엔티티 신뢰도 계산
   * @param {string} text 텍스트
   * @param {string} type 엔티티 타입
   * @returns {number} 신뢰도 (0-1)
   * @private
   */
  _calculateEntityConfidence(text, type) {
    let confidence = 0.5; // 기본 신뢰도
    
    // 텍스트 길이에 따른 신뢰도 조정
    if (text.length > 10) confidence += 0.1;
    if (text.length > 20) confidence += 0.1;
    
    // 타입별 신뢰도 조정
    switch (type) {
      case 'disease':
        if (text.includes('진단') || text.includes('병명')) confidence += 0.2;
        break;
      case 'medication':
        if (text.includes('처방') || text.includes('투약')) confidence += 0.2;
        break;
      case 'test':
        if (text.includes('검사') || text.includes('촬영')) confidence += 0.2;
        break;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 중복 엔티티 제거
   * @param {Array} entities 엔티티 배열
   * @param {string} key 중복 체크 키
   * @returns {Array} 중복 제거된 엔티티 배열
   * @private
   */
  _deduplicateEntities(entities, key) {
    const seen = new Set();
    return entities.filter(entity => {
      const value = entity[key].toLowerCase();
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * 엔티티 검증
   * @param {Object} entities 엔티티 객체
   * @returns {Object} 검증된 엔티티 객체
   * @private
   */
  _validateEntities(entities) {
    const validated = {};
    
    Object.keys(entities).forEach(category => {
      validated[category] = entities[category].filter(entity => {
        // 최소 신뢰도 체크
        if (entity.confidence < 0.3) return false;
        
        // 텍스트 길이 체크
        if (!entity.name || entity.name.length < 2) return false;
        
        // 특수 문자만으로 구성된 경우 제외
        if (/^[^가-힣a-zA-Z0-9]+$/.test(entity.name)) return false;
        
        return true;
      });
    });
    
    return validated;
  }

  /**
   * 엔티티 표준화
   * @param {Object} entities 엔티티 객체
   * @returns {Object} 표준화된 엔티티 객체
   * @private
   */
  _standardizeEntities(entities) {
    const standardized = {};
    
    Object.keys(entities).forEach(category => {
      standardized[category] = entities[category].map(entity => ({
        ...entity,
        name: this._normalizeEntityName(entity.name),
        category: category,
        extractedAt: new Date().toISOString()
      }));
    });
    
    return standardized;
  }

  /**
   * 엔티티명 정규화
   * @param {string} name 엔티티명
   * @returns {string} 정규화된 엔티티명
   * @private
   */
  _normalizeEntityName(name) {
    return name
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^가-힣a-zA-Z0-9]+|[^가-힣a-zA-Z0-9]+$/g, '');
  }

  /**
   * 엔티티 통계 생성
   * @param {Object} entities 엔티티 객체
   * @returns {Object} 통계 정보
   * @private
   */
  _generateEntityStatistics(entities) {
    const stats = {};
    
    Object.keys(entities).forEach(category => {
      stats[category] = {
        count: entities[category].length,
        avgConfidence: entities[category].reduce((sum, e) => sum + e.confidence, 0) / entities[category].length || 0,
        highConfidence: entities[category].filter(e => e.confidence > 0.8).length
      };
    });
    
    stats.total = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
    
    return stats;
  }

  /**
   * 전체 신뢰도 점수 계산
   * @param {Object} entities 엔티티 객체
   * @returns {number} 신뢰도 점수
   * @private
   */
  _calculateConfidenceScore(entities) {
    let totalConfidence = 0;
    let totalCount = 0;
    
    Object.values(entities).forEach(categoryEntities => {
      categoryEntities.forEach(entity => {
        totalConfidence += entity.confidence;
        totalCount++;
      });
    });
    
    return totalCount > 0 ? totalConfidence / totalCount : 0;
  }

  /**
   * ICD 코드로 카테고리 추정
   * @param {string} icdCode ICD 코드
   * @returns {string} 카테고리
   * @private
   */
  _getCategoryByICD(icdCode) {
    if (!icdCode) return 'unknown';
    
    const firstChar = icdCode.charAt(0);
    const categoryMap = {
      'A': 'infectious', 'B': 'infectious',
      'C': 'oncology', 'D': 'oncology',
      'E': 'endocrine',
      'F': 'psychiatric',
      'G': 'neurological',
      'H': 'sensory',
      'I': 'cardiovascular',
      'J': 'respiratory',
      'K': 'gastroenterology',
      'L': 'dermatology',
      'M': 'orthopedic',
      'N': 'genitourinary',
      'O': 'obstetric',
      'P': 'perinatal',
      'Q': 'congenital',
      'R': 'symptoms',
      'S': 'trauma', 'T': 'trauma',
      'V': 'external', 'W': 'external', 'X': 'external', 'Y': 'external',
      'Z': 'factors'
    };
    
    return categoryMap[firstChar] || 'unknown';
  }

  /**
   * 정상 혈압 여부 확인
   * @param {number} systolic 수축기 혈압
   * @param {number} diastolic 이완기 혈압
   * @returns {boolean} 정상 여부
   * @private
   */
  _isNormalBloodPressure(systolic, diastolic) {
    return systolic >= 90 && systolic <= 140 && diastolic >= 60 && diastolic <= 90;
  }

  /**
   * 정상 체온 여부 확인
   * @param {number} temperature 체온
   * @returns {boolean} 정상 여부
   * @private
   */
  _isNormalTemperature(temperature) {
    return temperature >= 36.0 && temperature <= 37.5;
  }

  /**
   * 정상 맥박 여부 확인
   * @param {number} pulse 맥박
   * @returns {boolean} 정상 여부
   * @private
   */
  _isNormalPulse(pulse) {
    return pulse >= 60 && pulse <= 100;
  }

  /**
   * 날짜 정규화
   * @param {string} dateStr 날짜 문자열
   * @returns {string} 정규화된 날짜
   * @private
   */
  _normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    const standardMatch = dateStr.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
    if (standardMatch) {
      return standardMatch[0].replace(/[\/.]/g, '-');
    }
    
    return dateStr;
  }
}

export default MedicalEntityExtractor;