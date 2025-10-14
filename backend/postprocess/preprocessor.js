/**
 * Preprocessor Module
 * 
 * 역할:
 * 1. OCR 결과 텍스트에서 날짜(정규식) + "병원명" + "주요단어(수술, 진단 등)" 파싱
 * 2. DictionaryManager의 키워드 목록 활용(필요한 데이터만 남기는 화이트리스트 방식)
 * 3. 영어 의료 용어를 한글로 매핑
 * 4. 병원별 템플릿 캐시를 통한 보일러플레이트 패턴 제거 (v2.0 추가)
 */

import dictionaryManager from './dictionaryManager.js';
import hospitalTemplateCache from './hospitalTemplateCache.js';

class Preprocessor {
  constructor() {
    // 날짜 정규식 패턴들
    this.datePatterns = [
      // YYYY.MM.DD 형식
      /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
      // YY.MM.DD 형식 (20xx년 가정)
      /(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g,
      // YYYY년 MM월 DD일 형식
      /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
      // MM월 DD일 형식 (연도 없음, 현재 연도 또는 문맥에 따라 추론 필요)
      /(\d{1,2})월\s*(\d{1,2})일/g
    ];

    // 병원 정규식 패턴
    this.hospitalPatterns = [
      /([가-힣\s]+병원)/g,         // OO병원
      /([가-힣\s]+의원)/g,         // OO의원
      /([가-힣\s]+대학병원)/g,     // OO대학병원
      /([가-힣\s]+클리닉)/g,       // OO클리닉
      /([가-힣\s]+의료원)/g,       // OO의료원
      /([가-힣\s]+한의원)/g,       // OO한의원
      /([a-zA-Z\s]+clinic)/gi,    // 영문 클리닉
      /([a-zA-Z\s]+hospital)/gi   // 영문 병원
    ];
  }

  /**
   * OCR 텍스트를 처리하여 의미 있는 데이터 추출
   * @param {string} ocrText OCR로 추출된 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Promise<Array>} 추출된 데이터 객체 배열
   */
  async run(ocrText, options = {}) {
    try {
      // 옵션 기본값 설정
      const opts = {
        translateTerms: true,
        requireKeywords: true,
        enableTemplateCache: true, // 템플릿 캐시 활성화 (기본값: true)
        ...options
      };

      // 사전 데이터 로드 (아직 로드되지 않았다면)
      await this._ensureDictionaryLoaded();

      // 병원별 템플릿 캐시를 통한 보일러플레이트 제거 (v2.0 추가)
      let processedText = ocrText;
      if (opts.enableTemplateCache) {
        try {
          const cacheResult = await hospitalTemplateCache.processDocument(ocrText);
          processedText = cacheResult.cleanedText;
          
          // 템플릿 캐시 처리 결과 로깅
          if (cacheResult.hospital && cacheResult.removedPatterns.length > 0) {
            console.log(`[템플릿 캐시] ${cacheResult.hospital}: ${cacheResult.removedPatterns.length}개 패턴 제거됨`);
          }
        } catch (cacheError) {
          // 템플릿 캐시 오류 시 원본 텍스트 사용 (기존 파이프라인 무결성 보장)
          console.warn('[템플릿 캐시] 처리 중 오류 발생, 원본 텍스트 사용:', cacheError.message);
          processedText = ocrText;
        }
      }

      // 텍스트를 문단 또는 섹션으로 분할
      const sections = this._splitIntoSections(processedText);
      
      // 각 섹션에서 데이터 추출
      const results = [];
      
      for (const section of sections) {
        // 추출 작업 수행
        const extractedData = this._processSection(section, opts);
        
        // 필요한 키워드가 있는 데이터만 추가(옵션에 따라)
        if (!opts.requireKeywords || 
            (extractedData.keywordMatches && extractedData.keywordMatches.length > 0)) {
          results.push(extractedData);
        }
      }

      console.log(`텍스트 전처리 완료: ${results.length}개 의미 있는 섹션 추출됨`);
      return results;
    } catch (error) {
      console.error('텍스트 전처리 중 오류 발생:', error);
      throw new Error(`텍스트 전처리 실패: ${error.message}`);
    }
  }

  /**
   * 섹션 텍스트를 처리하여 데이터 추출
   * @param {string} sectionText 섹션 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Object} 추출된 데이터 객체
   * @private
   */
  _processSection(sectionText, options) {
    // 날짜 추출
    const dates = this._extractDates(sectionText);
    const extractedDate = dates.length > 0 ? dates[0] : null;
    
    // 병원명 추출
    const hospitalName = this._extractHospitalName(sectionText);
    
    // 키워드 확인
    const { matches: keywordMatches } = dictionaryManager.checkRequiredKeywords(sectionText);
    
    // 제외 키워드 확인
    const { shouldExclude, excludedMatches } = dictionaryManager.checkExcludedKeywords(sectionText);
    
    // 의료 용어 번역 (옵션에 따라)
    let translatedText = sectionText;
    let mappedTerms = [];
    
    if (options.translateTerms) {
      const translationResult = dictionaryManager.translateMedicalTerms(sectionText);
      translatedText = translationResult.translatedText;
      mappedTerms = translationResult.mappedTerms;
    }
    
    // 결과 객체 구성
    return {
      date: extractedDate,
      hospital: hospitalName || '미상 병원',
      rawText: sectionText,
      translatedText: translatedText !== sectionText ? translatedText : undefined,
      keywordMatches,
      mappedTerms,
      shouldExclude,
      excludedMatches
    };
  }

  /**
   * 텍스트를 의미 있는 섹션으로 분할
   * @param {string} text 분할할 텍스트
   * @returns {Array<string>} 섹션 배열
   * @private
   */
  _splitIntoSections(text) {
    // 줄바꿈 또는 특정 문장 기호로 분할한 후 의미 있는 단위로 재결합
    const lines = text.split(/\n+/);
    const sections = [];
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 빈 줄은 건너뛰기
      if (!trimmedLine) continue;
      
      // 날짜로 시작하는 줄은 새 섹션 시작으로 간주
      const hasDate = this.datePatterns.some(pattern => {
        pattern.lastIndex = 0; // lastIndex 초기화
        return pattern.test(trimmedLine);
      });
      
      if (hasDate && currentSection) {
        sections.push(currentSection.trim());
        currentSection = trimmedLine;
      } else {
        currentSection += (currentSection ? '\n' : '') + trimmedLine;
      }
    }
    
    // 마지막 섹션 추가
    if (currentSection) {
      sections.push(currentSection.trim());
    }
    
    return sections;
  }

  /**
   * 텍스트에서 날짜 추출
   * @param {string} text 날짜를 추출할 텍스트
   * @returns {Array<string>} 추출된 날짜 배열 (YYYY-MM-DD 형식)
   * @private
   */
  _extractDates(text) {
    const dates = [];
    const currentYear = new Date().getFullYear();

    // 여러 날짜 패턴에 대해 검사
    for (const pattern of this.datePatterns) {
      const regex = new RegExp(pattern);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY/MM/DD 형식
        if (match.length === 4) {
          let year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const day = parseInt(match[3], 10);
          
          // YY.MM.DD 형식인 경우 20xx년으로 변환
          if (year < 100) {
            year = 2000 + year;
          }
          
          // 유효한 날짜 검사
          if (this._isValidDate(year, month, day)) {
            const formattedMonth = month.toString().padStart(2, '0');
            const formattedDay = day.toString().padStart(2, '0');
            dates.push(`${year}-${formattedMonth}-${formattedDay}`);
          }
        }
        // MM월 DD일 형식 (연도 없음)
        else if (match.length === 3) {
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          
          // 유효한 날짜 검사
          if (this._isValidDate(currentYear, month, day)) {
            const formattedMonth = month.toString().padStart(2, '0');
            const formattedDay = day.toString().padStart(2, '0');
            dates.push(`${currentYear}-${formattedMonth}-${formattedDay}`);
          }
        }
      }
    }
    
    return dates;
  }

  /**
   * 날짜의 유효성 검사
   * @param {number} year 연도
   * @param {number} month 월
   * @param {number} day 일
   * @returns {boolean} 유효 여부
   * @private
   */
  _isValidDate(year, month, day) {
    // 기본 범위 검사
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    
    // 월별 일수 검사
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      return false;
    }
    
    return true;
  }

  /**
   * 텍스트에서 병원명 추출
   * @param {string} text 병원명을 추출할 텍스트
   * @returns {string|null} 추출된 병원명 또는 null
   * @private
   */
  _extractHospitalName(text) {
    for (const pattern of this.hospitalPatterns) {
      const regex = new RegExp(pattern);
      const match = regex.exec(text);
      
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * 사전 매니저가 로드되었는지 확인하고 필요 시 로드
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDictionaryLoaded() {
    if (!dictionaryManager.initialized) {
      await dictionaryManager.loadData();
    }
  }
}

export default new Preprocessor();