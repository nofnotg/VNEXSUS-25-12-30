/**
 * Medical Document Normalizer Module
 * 
 * 역할:
 * 1. 비정형 의료 문서를 날짜별 경과보고서 형식으로 정규화
 * 2. Report_Sample.txt 형식에 맞춘 구조화된 데이터 생성
 * 3. 의료 엔티티 추출 및 표준화
 * 4. 날짜 기반 시계열 정렬 및 그룹핑
 */

import MedicalEntityExtractor from './medicalEntityExtractor.js';
import MassiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import DateOrganizer from './dateOrganizer.js';
import ReportTemplateEngine from './reportTemplateEngine.js';
import InsuranceValidationService from '../services/insuranceValidationService.js';
import AIFilteringService from '../services/aiFilteringService.js';

class MedicalDocumentNormalizer {
  constructor() {
    this.entityExtractor = new MedicalEntityExtractor();
    this.massiveDateProcessor = new MassiveDateBlockProcessor();
    this.dateOrganizer = new DateOrganizer();
    this.templateEngine = new ReportTemplateEngine();
    this.insuranceValidator = new InsuranceValidationService();
    this.aiFilter = new AIFilteringService();
    
    // 의료 문서 섹션 패턴
    this.sectionPatterns = {
      // 환자 정보
      patientInfo: {
        name: /(?:환자명|성명|이름)\s*[:：]?\s*([가-힣]{2,4})/gi,
        birthDate: /(?:생년월일|생일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{6}[-]?[1-4])/gi,
        registrationNumber: /(?:등록번호|환자번호)\s*[:：]?\s*([\w\d-]+)/gi
      },
      
      // 보험 정보
      insuranceInfo: {
        company: /(?:보험사|보험회사)\s*[:：]?\s*([^\n]+)/gi,
        joinDate: /(?:가입일|보장개시일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        productName: /(?:상품명|보험상품)\s*[:：]?\s*([^\n]+)/gi,
        coverage: /(?:청구사항|특약|담보)\s*[:：]?\s*([^\n]+)/gi
      },
      
      // 진료 기록
      medicalRecord: {
        visitDate: /(?:내원일|진료일|방문일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        hospital: /(?:병원|의원|클리닉|센터)\s*[:：]?\s*([^\n]+)/gi,
        diagnosis: /(?:진단명|진단)\s*[:：]?\s*([^\n]+)/gi,
        prescription: /(?:처방|투약|약물)\s*[:：]?\s*([^\n]+)/gi,
        symptoms: /(?:증상|주소|호소)\s*[:：]?\s*([^\n]+)/gi,
        treatment: /(?:치료|처치|시술)\s*[:：]?\s*([^\n]+)/gi
      },
      
      // 입원 기록
      hospitalizationRecord: {
        admissionDate: /(?:입원일|입원)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        dischargeDate: /(?:퇴원일|퇴원)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        period: /(?:입원기간)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})\s*[~-]\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        surgery: /(?:수술|시술)\s*[:：]?\s*([^\n]+)/gi,
        surgeryDate: /(?:수술일|시술일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi
      },
      
      // 검사 결과
      testResults: {
        testDate: /(?:검사일|촬영일)\s*[:：]?\s*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/gi,
        testType: /(?:검사명|검사종류)\s*[:：]?\s*([^\n]+)/gi,
        results: /(?:결과|소견)\s*[:：]?\s*([^\n]+)/gi,
        values: /(\w+)\s*[:：]?\s*([\d.]+)\s*([\w\/μ%]+)/gi
      }
    };
    
    // 의료 코드 매핑
    this.medicalCodes = {
      // ICD-10 코드 패턴
      icd10: /([A-Z]\d{2}(?:\.\d{1,2})?)/g,
      // 수술 코드 패턴
      surgeryCode: /([A-Z]\d{4})/g
    };
    
    // 날짜 정규화 패턴
    this.datePatterns = {
      standard: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
      korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      short: /\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
      compact: /\d{8}/g,  // YYYYMMDD 형식
      withTime: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\s+\d{1,2}[:\.]\d{1,2}(?:[:\.]\d{1,2})?/g,  // 시간 포함
      medical: /\[?\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\]?/g  // 대괄호 포함 가능
    };
  }

  /**
   * 비정형 의료 문서를 정규화된 경과보고서로 변환
   * @param {string} rawText 원본 의료 문서 텍스트
   * @param {Object} options 정규화 옵션
   * @returns {Promise<Object>} 정규화된 의료 문서 데이터
   */
  async normalizeDocument(rawText, options = {}) {
    try {
      console.log('📋 의료 문서 정규화 시작...');
      
      // 1단계: 텍스트 전처리
      const preprocessedText = this._preprocessText(rawText);
      
      // 2단계: 환자 정보 추출
      const patientInfo = this._extractPatientInfo(preprocessedText);
      console.log('👤 환자 정보 추출 완료:', patientInfo.name || '미확인');
      
      // 3단계: 보험 정보 추출 (개선된 검증 포함)
      const insuranceInfo = await this._extractInsuranceInfo(preprocessedText);
      console.log('🏥 보험 정보 추출 완료:', insuranceInfo.length + '개 보험');
      
      // 보험 정보 검증 통계 생성
      const insuranceStats = this._generateInsuranceValidationStats(insuranceInfo);
      console.log('📊 보험 정보 검증 통계:', insuranceStats);
      
      // 4단계: 의료 기록 추출 및 날짜별 정렬
      const medicalRecords = this._extractMedicalRecords(preprocessedText);
      console.log('📅 의료 기록 추출 완료:', medicalRecords.length + '개 기록');
      
      // 5단계: 시계열 정렬 및 그룹핑
      const timelineData = this._createTimeline(medicalRecords);
      
      // 6단계: Report_Sample.txt 형식으로 구조화
      const normalizedReport = this._formatToReportStructure({
        patientInfo,
        insuranceInfo,
        timelineData,
        originalText: preprocessedText
      });
      
      // 경과보고서 생성
      const reportResult = await this.templateEngine.generateReport(
        { normalizedReport },
        options.reportOptions || {}
      );
      
      console.log('✅ 의료 문서 정규화 완료');
      return {
        success: true,
        normalizedReport,
        progressReport: reportResult.report,
        reportMetadata: reportResult.metadata,
        statistics: {
          originalLength: rawText.length,
          processedLength: preprocessedText.length,
          recordsFound: medicalRecords.length,
          insuranceCount: insuranceInfo.length,
          timelineEvents: timelineData.length
        },
        processingTime: Date.now()
      };
      
    } catch (error) {
      console.error('❌ 의료 문서 정규화 중 오류:', error);
      throw new Error(`의료 문서 정규화 실패: ${error.message}`);
    }
  }

  /**
   * 텍스트 전처리
   * @param {string} text 원본 텍스트
   * @returns {string} 전처리된 텍스트
   * @private
   */
  _preprocessText(text) {
    let processed = text;
    
    // 불필요한 문자 제거
    processed = processed.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
    
    // 줄바꿈 정규화
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 공백 정규화(줄바꿈은 유지)
    processed = processed
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n');
    
    // 특수 문자 정규화
    processed = processed.replace(/[：]/g, ':');
    
    return processed.trim();
  }

  /**
   * 환자 정보 추출
   * @param {string} text 전처리된 텍스트
   * @returns {Object} 환자 정보
   * @private
   */
  _extractPatientInfo(text) {
    const patientInfo = {};
    
    // 환자명 추출
    const nameMatch = text.match(this.sectionPatterns.patientInfo.name);
    if (nameMatch) {
      patientInfo.name = nameMatch[0].replace(/(?:환자명|성명|이름)\s*[:：]?\s*/, '').trim();
    }
    
    // 생년월일 추출
    const birthMatch = text.match(this.sectionPatterns.patientInfo.birthDate);
    if (birthMatch) {
      patientInfo.birthDate = this._normalizeBirthDate(birthMatch[0]);
    }
    
    // 등록번호 추출
    const regMatch = text.match(this.sectionPatterns.patientInfo.registrationNumber);
    if (regMatch) {
      patientInfo.registrationNumber = regMatch[0].replace(/(?:등록번호|환자번호)\s*[:：]?\s*/, '').trim();
    }
    
    return patientInfo;
  }

  /**
   * 보험 정보 추출 (개선된 버전)
   * @param {string} text 전처리된 텍스트
   * @returns {Array} 검증된 보험 정보 배열
   * @private
   */
  async _extractInsuranceInfo(text) {
    const insuranceList = [];
    
    // 보험 관련 섹션 찾기
    const insuranceSections = text.split(/(?=보험|가입)/gi);
    
    for (const section of insuranceSections) {
      const insurance = {};
      
      // 보험사명 추출
      const companyMatch = section.match(this.sectionPatterns.insuranceInfo.company);
      if (companyMatch) {
        const rawCompanyName = companyMatch[0].replace(/(?:보험사|보험회사)\s*[:：]?\s*/, '').trim();
        
        // AI 필터링 및 검증
        const aiAnalysis = await this.aiFilter.analyzeInsuranceCompany(rawCompanyName, {
          document: section,
          documentType: 'medical_record'
        });
        
        // 기본 검증
        const validation = this.insuranceValidator.validateInsuranceCompany(rawCompanyName);
        
        // 검증 결과에 따른 처리
        if (validation.isValid && validation.isInsurer) {
          insurance.company = validation.normalizedName;
          insurance.companyValidation = {
            status: 'valid',
            confidence: aiAnalysis.confidence,
            originalInput: rawCompanyName,
            correctionApplied: validation.matchType !== 'exact'
          };
        } else if (validation.category === 'claims_adjuster') {
          // 손해사정회사는 '정보없음'으로 처리
          insurance.company = '정보없음';
          insurance.companyValidation = {
            status: 'filtered_out',
            reason: '손해사정조사회사',
            originalInput: rawCompanyName,
            confidence: aiAnalysis.confidence
          };
        } else {
          // 사용자 입력 오류 보정 시도
          const correction = this.aiFilter.correctUserInput(rawCompanyName);
          if (correction.corrected) {
            const correctedValidation = this.insuranceValidator.validateInsuranceCompany(correction.suggestion);
            if (correctedValidation.isValid) {
              insurance.company = correctedValidation.normalizedName;
              insurance.companyValidation = {
                status: 'corrected',
                originalInput: rawCompanyName,
                correctedInput: correction.suggestion,
                confidence: correction.confidence
              };
            } else {
              insurance.company = '정보없음';
              insurance.companyValidation = {
                status: 'invalid',
                reason: '등록되지 않은 보험사',
                originalInput: rawCompanyName,
                confidence: aiAnalysis.confidence
              };
            }
          } else {
            insurance.company = '정보없음';
            insurance.companyValidation = {
              status: 'invalid',
              reason: validation.reason,
              originalInput: rawCompanyName,
              confidence: aiAnalysis.confidence
            };
          }
        }
      }
      
      // 가입일 추출 및 검증
      const joinMatch = section.match(this.sectionPatterns.insuranceInfo.joinDate);
      if (joinMatch) {
        const rawJoinDate = joinMatch[0];
        const dateExtraction = this.aiFilter.extractAndValidateDates(rawJoinDate);
        
        if (dateExtraction.found && dateExtraction.dates.length > 0) {
          insurance.joinDate = dateExtraction.dates[0].formatted;
          insurance.joinDateValidation = {
            status: 'valid',
            originalInput: rawJoinDate,
            confidence: 'high'
          };
        } else {
          insurance.joinDate = this._normalizeDate(rawJoinDate);
          insurance.joinDateValidation = {
            status: 'fallback',
            originalInput: rawJoinDate,
            confidence: 'medium'
          };
        }
      }
      
      // 상품명 추출
      const productMatch = section.match(this.sectionPatterns.insuranceInfo.productName);
      if (productMatch) {
        insurance.productName = productMatch[0].replace(/(?:상품명|보험상품)\s*[:：]?\s*/, '').trim();
      }
      
      // 청구사항 추출
      const coverageMatch = section.match(this.sectionPatterns.insuranceInfo.coverage);
      if (coverageMatch) {
        insurance.coverage = coverageMatch[0].replace(/(?:청구사항|특약|담보)\s*[:：]?\s*/, '').trim();
      }
      
      if (Object.keys(insurance).length > 0) {
        insuranceList.push(insurance);
      }
    }
    
    return insuranceList;
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
   * 날짜 섹션으로 텍스트 분할
   * @param {string} text 텍스트
   * @returns {Array} 날짜별 섹션 배열
   * @private
   */
  _splitByDateSections(text) {
    const sections = [];
    const dateMatches = [];
    
    // 텍스트 타입 검증
    if (!text || typeof text !== 'string') {
      console.warn('⚠️ _splitByDateSections: 유효하지 않은 텍스트 입력');
      return sections;
    }
    
    console.log('🔍 입력 텍스트 전체:');
    console.log(`"${text}"`);
    
    // 모든 날짜 패턴 찾기 - 긴 패턴부터 우선 매치
    const patternOrder = ['standard', 'withTime', 'medical', 'korean', 'compact', 'short'];
    
    patternOrder.forEach(patternName => {
      const pattern = this.datePatterns[patternName];
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // 이미 매치된 위치와 겹치는지 확인
        const isOverlapping = dateMatches.some(existing => {
          const existingEnd = existing.index + existing.date.length;
          const matchEnd = match.index + match[0].length;
          return (match.index < existingEnd && matchEnd > existing.index);
        });
        
        if (!isOverlapping) {
          dateMatches.push({
            date: match[0],
            index: match.index,
            pattern: patternName
          });
        }
      }
    });
    
    console.log('🔍 발견된 날짜 매치들:', dateMatches);
    
    // 날짜 위치순 정렬
    dateMatches.sort((a, b) => a.index - b.index);
    
    // 날짜 기준으로 섹션 분할
    for (let i = 0; i < dateMatches.length; i++) {
      const start = dateMatches[i].index;
      const end = i < dateMatches.length - 1 ? dateMatches[i + 1].index : text.length;
      const sectionText = text.substring(start, end);
      
      console.log(`🔍 Section ${i}: start=${start}, end=${end}`);
      console.log(`📝 Raw section text: "${sectionText}"`);
      console.log(`📝 Trimmed section text: "${sectionText.trim()}"`);
      
      if (sectionText && typeof sectionText === 'string' && sectionText.trim().length > 10) { // 최소 길이 체크
        sections.push(sectionText.trim());
      }
    }
    
    return sections;
  }

  /**
   * 개별 기록 섹션 파싱
   * @param {string} section 섹션 텍스트
   * @returns {Object} 파싱된 기록
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
    {
      const m = section.match(/(?:병원|의원|클리닉|센터)\s*[:：]?\s*([^\n]+)/i);
      if (m) {
        record.hospital = m[1].trim();
      }
    }
    
    // 진단명 추출
    {
      const m = section.match(/(?:진단명|진단)\s*[:：]?\s*([^\n]+)/i);
      if (m) {
        record.diagnosis = m[1].trim();
        const icdMatch = record.diagnosis.match(this.medicalCodes.icd10);
        if (icdMatch) {
          record.icdCode = icdMatch[0];
        }
      }
    }
    
    // 처방 추출
    {
      const m = section.match(/(?:처방|투약|약물)\s*[:：]?\s*([^\n]+)/i);
      if (m) {
        record.prescription = m[1].trim();
      }
    }
    
    // 증상 추출
    {
      const m = section.match(/(?:증상|주소|호소)\s*[:：]?\s*([^\n]+)/i);
      if (m) {
        record.symptoms = m[1].trim();
      }
    }
    
    // 입원 정보 확인
    if (section.includes('입원') || section.includes('퇴원')) {
      record.type = 'hospitalization';
      this._extractHospitalizationInfo(section, record);
    }
    
    // 수술 정보 확인
    if (section.includes('수술') || section.includes('시술')) {
      record.type = 'surgery';
      this._extractSurgeryInfo(section, record);
    }
    
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
    return records.map(record => ({
      ...record,
      timestamp: new Date(record.date).getTime(),
      formattedDate: this._formatDate(record.date)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Report_Sample.txt 형식으로 구조화
   * @param {Object} data 추출된 데이터
   * @returns {Object} 구조화된 리포트
   * @private
   */
  _formatToReportStructure(data) {
    const { patientInfo, insuranceInfo, timelineData } = data;
    
    return {
      header: {
        patientName: patientInfo.name || '미확인',
        birthDate: patientInfo.birthDate || 'yyyy-mm-dd',
        registrationNumber: patientInfo.registrationNumber
      },
      
      insuranceConditions: insuranceInfo.map((insurance, index) => ({
        conditionNumber: index + 1,
        company: insurance.company,
        joinDate: insurance.joinDate,
        productName: insurance.productName,
        coverage: insurance.coverage
      })),
      
      insuranceHistory: this._formatInsuranceHistory(insuranceInfo),
      
      medicalRecords: this._formatMedicalRecords(timelineData),
      
      hospitalizationRecords: this._formatHospitalizationRecords(timelineData.filter(r => r.type === 'hospitalization')),
      
      insuranceClaims: this._formatInsuranceClaims(timelineData)
    };
  }

  /**
   * 보험 이력 포맷팅
   * @param {Array} insuranceInfo 보험 정보
   * @returns {Array} 포맷된 보험 이력
   * @private
   */
  _formatInsuranceHistory(insuranceInfo) {
    return insuranceInfo.map(insurance => {
      const joinDate = new Date(insurance.joinDate);
      const now = new Date();
      const yearsDiff = now.getFullYear() - joinDate.getFullYear();
      
      let period = '';
      if (yearsDiff >= 5) period = '[보험 가입 5년 이내]';
      else if (yearsDiff >= 2) period = '[보험 가입 2년 이내]';
      else if (yearsDiff >= 1) period = '[보험 가입 1년 이내]';
      else period = '[보험 가입 3개월 이내]';
      
      return {
        period,
        date: insurance.joinDate,
        company: insurance.company,
        joinDate: insurance.joinDate
      };
    });
  }

  /**
   * 진료 기록 포맷팅
   * @param {Array} timelineData 시계열 데이터
   * @returns {Array} 포맷된 진료 기록
   * @private
   */
  _formatMedicalRecords(timelineData) {
    console.log('🔍 _formatMedicalRecords 디버깅:');
    console.log('timelineData 길이:', timelineData.length);
    console.log('timelineData 샘플:', timelineData.slice(0, 2));
    
    const filtered = timelineData.filter(record => record.type === 'medical_record');
    console.log('필터링된 기록 수:', filtered.length);
    
    return filtered.map(record => ({
        date: record.formattedDate,
        hospital: record.hospital || '미확인 의료기관',
        visitDate: record.date,
        reason: record.symptoms || '정기 진료',
        diagnosis: record.diagnosis || '미확인',
        icdCode: record.icdCode,
        prescription: record.prescription,
        notes: this._extractAdditionalNotes(record.rawText)
      }));
  }

  /**
   * 입원 기록 포맷팅
   * @param {Array} hospitalizationRecords 입원 기록
   * @returns {Array} 포맷된 입원 기록
   * @private
   */
  _formatHospitalizationRecords(hospitalizationRecords) {
    return hospitalizationRecords.map(record => {
      // admissionDate와 dischargeDate의 undefined 값 처리
      const admissionDate = record.admissionDate || 'N/A';
      const dischargeDate = record.dischargeDate || 'N/A';
      
      // 둘 다 N/A인 경우 전체를 N/A로 처리
      const admissionPeriod = (admissionDate === 'N/A' && dischargeDate === 'N/A') 
        ? 'N/A' 
        : `${admissionDate} ~ ${dischargeDate}`;

      return {
        date: record.formattedDate,
        hospital: record.hospital || '미확인 의료기관',
        visitDate: record.date,
        reason: record.symptoms || '응급실 내원',
        diagnosis: record.diagnosis || '미확인',
        admissionPeriod: admissionPeriod,
        surgeryInfo: record.surgeryName ? {
          name: record.surgeryName,
          date: record.surgeryDate,
          code: record.surgeryCode
        } : null,
        notes: this._extractAdditionalNotes(record.rawText)
      };
    });
  }

  /**
   * 보험 청구 포맷팅
   * @param {Array} timelineData 시계열 데이터
   * @returns {Array} 포맷된 보험 청구
   * @private
   */
  _formatInsuranceClaims(timelineData) {
    // 보험 청구 관련 기록 필터링
    return timelineData
      .filter(record => record.rawText && (record.rawText.includes('청구') || record.rawText.includes('지급')))
      .map(record => ({
        date: record.formattedDate,
        company: this._extractInsuranceCompanyFromText(record.rawText),
        claimDate: record.date,
        diagnosis: record.diagnosis,
        paymentDate: this._extractPaymentDate(record.rawText),
        amount: this._extractPaymentAmount(record.rawText),
        notes: this._extractAdditionalNotes(record.rawText)
      }));
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
    
    return this._normalizeDate(birthStr);
  }

  /**
   * 날짜 포맷팅
   * @param {string} dateStr 날짜 문자열
   * @returns {string} 포맷된 날짜
   * @private
   */
  _formatDate(dateStr) {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * 추가 노트 추출
   * @param {string} text 텍스트
   * @returns {string} 추가 노트
   * @private
   */
  _extractAdditionalNotes(text) {
    if (!text) return '';
    
    // 기타, 특이사항, 비고 등의 정보 추출
    const notePatterns = [
      /(?:기타|특이사항|비고|참고)\s*[:：]?\s*([^\n]+)/gi,
      /(?:검사결과|소견)\s*[:：]?\s*([^\n]+)/gi
    ];
    
    const notes = [];
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

  /**
   * 보험 정보 검증 통계 생성
   * @param {Array} insuranceInfo 보험 정보 배열
   * @returns {Object} 검증 통계
   * @private
   */
  _generateInsuranceValidationStats(insuranceInfo) {
    const stats = {
      total: insuranceInfo.length,
      valid: 0,
      invalid: 0,
      corrected: 0,
      filteredOut: 0,
      validationDetails: []
    };

    insuranceInfo.forEach(insurance => {
      if (insurance.companyValidation) {
        const validation = insurance.companyValidation;
        stats.validationDetails.push({
          company: insurance.company,
          status: validation.status,
          originalInput: validation.originalInput,
          confidence: validation.confidence
        });

        switch (validation.status) {
          case 'valid':
            stats.valid++;
            break;
          case 'corrected':
            stats.valid++;
            stats.corrected++;
            break;
          case 'filtered_out':
            stats.filteredOut++;
            break;
          case 'invalid':
            stats.invalid++;
            break;
        }
      }
    });

    return stats;
  }

  /**
   * 의료 기록에 시각화 정보 추가
   * @param {Array} medicalRecords 의료 기록 배열
   * @param {string} insuranceJoinDate 보험 가입일
   * @returns {Array} 시각화 정보가 추가된 의료 기록
   * @private
   */
  _addVisualizationInfo(medicalRecords, insuranceJoinDate) {
    if (!insuranceJoinDate) {
      return medicalRecords.map(record => ({
        ...record,
        visualization: {
          category: 'unknown',
          period: '정보없음',
          colorCode: '#999999',
          description: '보험 가입일 정보 없음'
        }
      }));
    }

    return medicalRecords.map(record => {
      const eventClassification = this.insuranceValidator.classifyEventByJoinDate(
        insuranceJoinDate,
        record.date
      );

      return {
        ...record,
        visualization: eventClassification
      };
    });
  }
}

export default MedicalDocumentNormalizer;
