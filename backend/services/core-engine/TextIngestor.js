// TextIngestor.js - 텍스트 수집 및 전처리 컴포넌트
export default class TextIngestor {
  /**
   * 텍스트 전처리 및 세그먼트화
   * @param {string|string[]} extractedText - 추출된 텍스트
   * @returns {Promise<Array>} 처리된 세그먼트 배열
   */
  static async process(extractedText) {
    try {
      // 입력 정규화
      const textArray = Array.isArray(extractedText) ? extractedText : [extractedText];
      const segments = [];

      for (let i = 0; i < textArray.length; i++) {
        const text = textArray[i];
        if (!text || typeof text !== 'string') continue;

        // 기본 전처리
        const cleaned = this.cleanText(text);
        
        // 세그먼트 분할
        const textSegments = this.segmentText(cleaned, i);
        segments.push(...textSegments);
      }

      console.log(`TextIngestor: Processed ${segments.length} segments from ${textArray.length} documents`);
      return segments;

    } catch (error) {
      console.error('TextIngestor processing error:', error);
      throw new Error(`CE-INGEST-001: ${error.message}`);
    }
  }

  /**
   * 텍스트 정리 및 정규화
   */
  static cleanText(text) {
    return text
      // 불필요한 공백 제거
      .replace(/\s+/g, ' ')
      // 특수 문자 정리
      .replace(/[^\w\s가-힣.,():\-\/]/g, '')
      // 날짜 패턴 정규화 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
      .replace(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g, '$1-$2-$3')
      // 시간 패턴 정리
      .replace(/(\d{1,2}):(\d{2})/g, '$1:$2')
      .trim();
  }

  /**
   * 텍스트를 의미있는 세그먼트로 분할
   */
  static segmentText(text, sourceIndex) {
    const segments = [];
    
    // 병원별 구분 패턴
    const hospitalSections = text.split(/(?=\[.*병원.*\]|\n.*병원.*\n)/);
    
    for (let i = 0; i < hospitalSections.length; i++) {
      const section = hospitalSections[i].trim();
      if (!section) continue;

      // 날짜별 세그먼트 분할
      const dateSegments = this.splitByDatePatterns(section);
      
      for (const segment of dateSegments) {
        if (segment.length > 10) { // 최소 길이 필터
          segments.push({
            id: `seg_${sourceIndex}_${segments.length}`,
            text: segment,
            sourceIndex,
            hospitalSection: i,
            length: segment.length,
            datePatterns: this.extractDatePatterns(segment),
            medicalTerms: this.extractMedicalTerms(segment)
          });
        }
      }
    }

    return segments;
  }

  /**
   * 날짜 패턴으로 텍스트 분할
   */
  static splitByDatePatterns(text) {
    // 날짜 패턴을 기준으로 분할
    const datePattern = /(\d{4}-\d{1,2}-\d{1,2})/g;
    const parts = text.split(datePattern);
    const segments = [];
    
    let currentSegment = '';
    for (const part of parts) {
      if (datePattern.test(part)) {
        if (currentSegment) {
          segments.push(currentSegment.trim());
        }
        currentSegment = part + ' ';
      } else {
        currentSegment += part;
      }
    }
    
    if (currentSegment) {
      segments.push(currentSegment.trim());
    }
    
    return segments.filter(s => s.length > 0);
  }

  /**
   * 날짜 패턴 추출
   */
  static extractDatePatterns(text) {
    const patterns = [];
    const dateRegex = /(\d{4}-\d{1,2}-\d{1,2})/g;
    let match;
    
    while ((match = dateRegex.exec(text)) !== null) {
      patterns.push({
        date: match[1],
        position: match.index,
        context: text.substring(Math.max(0, match.index - 20), match.index + 30)
      });
    }
    
    return patterns;
  }

  /**
   * 의료 용어 추출 (기본 패턴)
   */
  static extractMedicalTerms(text) {
    const medicalPatterns = [
      /CT|MRI|X-ray|초음파|내시경/gi,
      /수술|시술|치료|투약/gi,
      /입원|퇴원|외래|응급실/gi,
      /진단|검사|소견|판독/gi,
      /암|종양|악성|양성/gi
    ];
    
    const terms = [];
    for (const pattern of medicalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        terms.push(...matches.map(m => m.toLowerCase()));
      }
    }
    
    return [...new Set(terms)]; // 중복 제거
  }

  /**
   * 병원 서식 패턴 감지
   */
  static detectHospitalFormat(text) {
    const formats = {
      standard: /\d{4}-\d{2}-\d{2}.*진료과.*의사/,
      simple: /\d{4}\.\d{2}\.\d{2}/,
      detailed: /\[.*병원.*\].*\d{4}-\d{2}-\d{2}/
    };
    
    for (const [format, pattern] of Object.entries(formats)) {
      if (pattern.test(text)) {
        return format;
      }
    }
    
    return 'unknown';
  }
}