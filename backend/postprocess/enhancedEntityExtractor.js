/**
 * 🧬 Enhanced Entity Extractor
 * 
 * 역할: Stage3 엔티티 정규화 및 통계 집계
 * - 병원명 추출 (다양한 패턴 지원)
 * - 진단명 추출 (KCD 코드 포함)
 * - 의료진 정보 추출
 * - 치료내용 및 처방 정보 추출
 * - 방문 통계 계산
 */

import dictionaryManager from './dictionaryManager.js';

class EnhancedEntityExtractor {
  constructor() {
    // 강화된 병원명 패턴
    this.hospitalPatterns = [
      // 한국어 병원명
      /([가-힣\s]{2,20})(병원|의원|대학병원|종합병원|전문병원|요양병원|한방병원|치과병원|의료원|보건소|보건지소|클리닉|센터)/g,
      
      // 영문 병원명
      /([A-Z][A-Za-z\s&.]{5,30})(HOSPITAL|MEDICAL CENTER|CLINIC|CENTER)/gi,
      
      // 줄임말 및 특수 형태
      /(삼성서울병원|서울아산병원|세브란스병원|서울대병원|고려대병원|연세대병원|가톨릭대병원|한양대병원|경희대병원|중앙대병원)/g,
      /(SMMC|AMC|YUHS|SNUH|KUMC|CMC|HYU|KHU|CAU)/g,
      
      // 지역 + 병원명 패턴
      /([가-힣]{2,6}시|[가-힣]{2,6}구|[가-힣]{2,6}군)\s*([가-힣\s]{2,15})(병원|의원|보건소)/g
    ];

    // 강화된 진단명 패턴
    this.diagnosisPatterns = [
      // KCD 코드 패턴
      /([A-Z]\d{2}\.?\d?)\s*([가-힣\s,()]{5,50})/g,
      
      // 일반적인 진단명 패턴
      /(진단명?[:：]\s*)([가-힣\s,()]{5,100})/g,
      /(병명[:：]\s*)([가-힣\s,()]{5,100})/g,
      /(질병[:：]\s*)([가-힣\s,()]{5,100})/g,
      
      // 의학적 진단 표현
      /([가-힣]{2,20})(증|염|병|질환|장애|기능부전|결석|종양|암|궤양|협착|파열|골절|탈구|염좌)/g,
      
      // 수술명 (진단과 관련)
      /([가-힣\s]{3,30})(수술|절제술|성형술|복원술|이식술|제거술|봉합술)/g
    ];

    // 의료진 패턴
    this.doctorPatterns = [
      /(담당의|주치의|집도의|마취의|진료의)[:：\s]*([가-힣]{2,4})/g,
      /([가-힣]{2,4})\s*(의사|교수|전문의|과장|부장|원장)/g,
      /(Dr\.|DR\.)\s*([A-Za-z\s]{3,20})/gi
    ];

    // 치료내용 패턴
    this.treatmentPatterns = [
      /(처방|투약|복용)[:：\s]*([가-힣A-Za-z\s,()0-9]{10,100})/g,
      /(수술|시술|검사|치료)[:：\s]*([가-힣A-Za-z\s,()]{10,100})/g,
      /(입원|외래|응급실|중환자실)\s*(치료|진료)/g
    ];

    // 날짜 패턴 (기존보다 강화)
    this.datePatterns = [
      /(\d{4})[.\-\/년\s]*(\d{1,2})[.\-\/월\s]*(\d{1,2})[일]?/g,
      /(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
      /(\d{1,2})월\s*(\d{1,2})일/g
    ];

    // 방문 횟수 패턴
    this.visitPatterns = [
      /(\d+)\s*회\s*(방문|내원|통원|진료)/g,
      /(총|전체)\s*(\d+)\s*(회|번)/g,
      /(\d+)\s*(일간|개월간|년간)\s*(\d+)\s*회/g
    ];
  }

  /**
   * 모든 엔티티를 추출하고 통계를 계산하는 메인 메서드
   */
  async extractAllEntities(text) {
    console.log('🧬 Enhanced Entity Extractor 시작');
    console.log('📊 입력 텍스트 분석:');
    console.log(`   - 텍스트 길이: ${text ? text.length : 0}자`);
    console.log(`   - 텍스트 타입: ${typeof text}`);
    console.log(`   - 빈 텍스트 여부: ${!text || text.trim().length === 0}`);
    
    if (text && text.length > 0) {
      console.log(`   - 처음 200자: ${text.substring(0, 200)}...`);
      console.log(`   - "병원" 키워드 포함: ${text.includes('병원')}`);
      console.log(`   - "진단" 키워드 포함: ${text.includes('진단')}`);
      console.log(`   - "CT" 키워드 포함: ${text.includes('CT')}`);
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('⚠️ 빈 텍스트 또는 유효하지 않은 입력');
      return this.createEmptyResult();
    }

    const entities = {
      hospitals: this.extractHospitals(text),
      diagnoses: this.extractDiagnoses(text),
      doctors: this.extractDoctors(text),
      treatments: this.extractTreatments(text),
      dates: this.extractDates(text),
      visits: this.extractVisitInfo(text)
    };

    // 통계 계산
    const statistics = this.calculateStatistics(entities);

    return {
      entities,
      statistics,
      summary: this.createSummary(entities, statistics)
    };
  }

  /**
   * 병원명 추출 (강화된 로직)
   */
  extractHospitals(text) {
    const hospitals = new Set();
    
    for (const pattern of this.hospitalPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2]) {
          const hospitalName = (match[1] + match[2]).trim();
          // 최소 길이 체크 (노이즈 제거)
          if (hospitalName.length >= 3 && hospitalName.length <= 50) {
            hospitals.add(hospitalName);
          }
        } else if (match[0]) {
          // 전체 매치가 있는 경우 (줄임말 등)
          const hospitalName = match[0].trim();
          if (hospitalName.length >= 3 && hospitalName.length <= 50) {
            hospitals.add(hospitalName);
          }
        }
      }
    }

    return Array.from(hospitals);
  }

  /**
   * 진단명 추출 (KCD 코드 포함)
   */
  extractDiagnoses(text) {
    const diagnoses = new Set();
    
    for (const pattern of this.diagnosisPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2]) {
          // KCD 코드 + 진단명
          const kcdCode = match[1].trim();
          const diagnosisName = match[2].trim();
          diagnoses.add(`${kcdCode} ${diagnosisName}`);
        } else if (match[2]) {
          // 진단명만
          const diagnosisName = match[2].trim();
          if (diagnosisName.length >= 3 && diagnosisName.length <= 100) {
            diagnoses.add(diagnosisName);
          }
        } else if (match[0]) {
          // 전체 매치
          const diagnosisName = match[0].trim();
          if (diagnosisName.length >= 3 && diagnosisName.length <= 100) {
            diagnoses.add(diagnosisName);
          }
        }
      }
    }

    return Array.from(diagnoses);
  }

  /**
   * 의료진 정보 추출
   */
  extractDoctors(text) {
    const doctors = new Set();
    
    for (const pattern of this.doctorPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          const doctorInfo = `${match[1] || ''} ${match[2]}`.trim();
          doctors.add(doctorInfo);
        }
      }
    }

    return Array.from(doctors);
  }

  /**
   * 치료내용 추출
   */
  extractTreatments(text) {
    const treatments = new Set();
    
    for (const pattern of this.treatmentPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          const treatment = `${match[1]} ${match[2]}`.trim();
          if (treatment.length >= 5 && treatment.length <= 200) {
            treatments.add(treatment);
          }
        } else if (match[0]) {
          const treatment = match[0].trim();
          if (treatment.length >= 5 && treatment.length <= 200) {
            treatments.add(treatment);
          }
        }
      }
    }

    return Array.from(treatments);
  }

  /**
   * 날짜 추출 (기존 로직 강화)
   */
  extractDates(text) {
    const dates = new Set();
    const currentYear = new Date().getFullYear();
    
    for (const pattern of this.datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let year, month, day;
        
        if (match.length === 4) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
          
          // 2자리 연도를 4자리로 변환
          if (year < 100) {
            year = year < 30 ? 2000 + year : 1900 + year;
          }
        } else if (match.length === 3) {
          // MM월 DD일 형식
          month = parseInt(match[1]);
          day = parseInt(match[2]);
          year = currentYear;
        }
        
        if (this.isValidDate(year, month, day)) {
          const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          dates.add(formattedDate);
        }
      }
    }

    return Array.from(dates).sort();
  }

  /**
   * 방문 정보 추출
   */
  extractVisitInfo(text) {
    const visitInfo = {
      totalVisits: 0,
      visitPatterns: []
    };
    
    for (const pattern of this.visitPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const visitCount = parseInt(match[1] || match[2]);
        if (!isNaN(visitCount) && visitCount > 0) {
          visitInfo.totalVisits = Math.max(visitInfo.totalVisits, visitCount);
          visitInfo.visitPatterns.push(match[0].trim());
        }
      }
    }

    return visitInfo;
  }

  /**
   * 통계 계산
   */
  calculateStatistics(entities) {
    return {
      uniqueHospitals: entities.hospitals.length,
      uniqueDiagnoses: entities.diagnoses.length,
      totalDoctors: entities.doctors.length,
      totalTreatments: entities.treatments.length,
      dateRange: this.calculateDateRange(entities.dates),
      totalVisits: entities.visits.totalVisits,
      medicalComplexity: this.calculateComplexity(entities)
    };
  }

  /**
   * 날짜 범위 계산
   */
  calculateDateRange(dates) {
    if (dates.length === 0) return null;
    
    const sortedDates = dates.sort();
    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
      span: sortedDates.length,
      totalDays: this.calculateDaysBetween(sortedDates[0], sortedDates[sortedDates.length - 1])
    };
  }

  /**
   * 의료 복잡도 계산
   */
  calculateComplexity(entities) {
    let complexity = 0;
    
    // 병원 수에 따른 복잡도
    complexity += entities.hospitals.length * 10;
    
    // 진단명 수에 따른 복잡도
    complexity += entities.diagnoses.length * 15;
    
    // 치료 수에 따른 복잡도
    complexity += entities.treatments.length * 5;
    
    // 방문 횟수에 따른 복잡도
    complexity += Math.min(entities.visits.totalVisits * 2, 100);
    
    return Math.min(complexity, 1000); // 최대 1000점
  }

  /**
   * 요약 정보 생성
   */
  createSummary(entities, statistics) {
    return {
      totalSegments: 0, // preprocessor에서 설정
      hospitalsFound: statistics.uniqueHospitals,
      datesFound: entities.dates.length,
      uniqueHospitals: statistics.uniqueHospitals,
      uniqueDiagnoses: statistics.uniqueDiagnoses,
      totalVisits: statistics.totalVisits,
      dateRange: statistics.dateRange,
      complexity: statistics.medicalComplexity
    };
  }

  /**
   * 빈 결과 객체 생성
   */
  createEmptyResult() {
    return {
      entities: {
        hospitals: [],
        diagnoses: [],
        doctors: [],
        treatments: [],
        dates: [],
        visits: { totalVisits: 0, visitPatterns: [] }
      },
      statistics: {
        uniqueHospitals: 0,
        uniqueDiagnoses: 0,
        totalDoctors: 0,
        totalTreatments: 0,
        dateRange: null,
        totalVisits: 0,
        medicalComplexity: 0
      },
      summary: {
        totalSegments: 0,
        hospitalsFound: 0,
        datesFound: 0,
        uniqueHospitals: 0,
        uniqueDiagnoses: 0,
        totalVisits: 0,
        dateRange: null,
        complexity: 0
      }
    };
  }

  /**
   * 날짜 유효성 검사
   */
  isValidDate(year, month, day) {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
  }

  /**
   * 두 날짜 사이의 일수 계산
   */
  calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export default new EnhancedEntityExtractor(); 