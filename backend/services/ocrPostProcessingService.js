/**
 * OCR Post-Processing Service
 *
 * 컨텍스트 기반 후처리 파이프라인
 *
 * 핵심 원칙:
 * - 컨텍스트 이해가 Primary (키워드 + 문맥 분석)
 * - 좌표 정보는 Secondary (보조 정보)
 * - BBox는 컨텍스트 검증 및 미세 조정에만 사용
 */

/**
 * OCR Post-Processing Service 클래스
 */
export class OCRPostProcessingService {
  constructor() {
    // 패턴 정의: 컨텍스트 기반
    this.patterns = {
      insurancePeriod: {
        keywords: ['보험기간', '보장기간', '보장개시일', '계약기간', '가입일'],
        context: ['YYYY.MM.DD', '~', '만기', '가입'],
        confidence: 0.9,
        importance: 'critical'
      },
      medicalEvent: {
        keywords: ['일자', '사고경위', '병원', '기관', '진료', '내원', '입원', '퇴원'],
        context: ['표', '테이블', '열'],
        confidence: 0.85,
        importance: 'high'
      },
      diagnosis: {
        keywords: ['진단', 'diagnosis', 'ICD', 'KCD', '병명'],
        context: ['코드', '질환', '질병'],
        confidence: 0.85,
        importance: 'high'
      },
      examination: {
        keywords: ['검사', 'test', 'lab', '혈액', 'CT', 'MRI', 'X-ray', '조직검사'],
        context: ['결과', '소견', 'findings'],
        confidence: 0.8,
        importance: 'medium'
      },
      treatment: {
        keywords: ['수술', '치료', 'treatment', '약물', '방사선', '항암', '처치'],
        context: ['일자', '날짜', '시행'],
        confidence: 0.8,
        importance: 'high'
      }
    };
  }

  /**
   * 컨텍스트 기반 후처리 파이프라인
   *
   * @param {Array} ocrBlocks - OCR 블록 배열
   * @returns {object} 처리된 결과
   */
  async processOCRResults(ocrBlocks) {
    // Step 1: 컨텍스트 분석 (Primary)
    const contextAnalyzed = await this.analyzeContext(ocrBlocks);

    // Step 2: 좌표 보완 (Secondary)
    const coordinateAdjusted = this.adjustWithCoordinates(contextAnalyzed, ocrBlocks);

    // Step 3: 패턴 매칭
    const patterns = this.matchPatterns(coordinateAdjusted);

    return {
      analyzed: contextAnalyzed,
      adjusted: coordinateAdjusted,
      patterns: patterns,
      stats: {
        totalBlocks: ocrBlocks.length,
        contextMatched: contextAnalyzed.length,
        coordinateAdjusted: coordinateAdjusted.filter(b => b.coordinateAdjusted).length,
        patternsFound: patterns.length
      }
    };
  }

  /**
   * Step 1: 컨텍스트 분석 (Primary)
   *
   * 키워드 + 문맥 분석으로 OCR 블록의 의미를 파악
   *
   * @param {Array} ocrBlocks - OCR 블록 배열
   * @returns {Array} 컨텍스트가 분석된 블록 배열
   */
  async analyzeContext(ocrBlocks) {
    const analyzed = [];

    ocrBlocks.forEach(block => {
      const text = block.text || block.content || '';
      const matches = [];

      // 각 패턴에 대해 매칭 시도
      for (const [patternName, pattern] of Object.entries(this.patterns)) {
        const keywordMatch = this._matchKeywords(text, pattern.keywords);
        const contextMatch = this._matchContext(text, pattern.context);

        if (keywordMatch || contextMatch) {
          matches.push({
            pattern: patternName,
            keywordScore: keywordMatch ? 1.0 : 0,
            contextScore: contextMatch ? 1.0 : 0.5,
            confidence: pattern.confidence,
            importance: pattern.importance
          });
        }
      }

      if (matches.length > 0) {
        // 가장 높은 confidence를 가진 패턴 선택
        const bestMatch = matches.sort((a, b) => b.confidence - a.confidence)[0];

        analyzed.push({
          ...block,
          patternMatches: matches,
          primaryPattern: bestMatch.pattern,
          confidence: bestMatch.confidence,
          importance: bestMatch.importance,
          contextAnalyzed: true
        });
      } else {
        // 패턴 매칭 안됨 - 일반 텍스트
        analyzed.push({
          ...block,
          primaryPattern: 'unknown',
          confidence: 0.3,
          importance: 'low',
          contextAnalyzed: false
        });
      }
    });

    return analyzed;
  }

  /**
   * 키워드 매칭
   * @private
   */
  _matchKeywords(text, keywords) {
    return keywords.some(keyword => {
      const regex = new RegExp(keyword, 'i');
      return regex.test(text);
    });
  }

  /**
   * 컨텍스트 매칭
   * @private
   */
  _matchContext(text, contextKeywords) {
    // 컨텍스트 키워드 중 하나라도 포함되면 매칭
    return contextKeywords.some(keyword => {
      // 날짜 패턴 특수 처리
      if (keyword === 'YYYY.MM.DD') {
        return /\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2}/.test(text);
      }

      const regex = new RegExp(keyword, 'i');
      return regex.test(text);
    });
  }

  /**
   * Step 2: 좌표 정보로 보완 (Secondary)
   *
   * 컨텍스트로 찾은 패턴에 대해서만 좌표 검증 및 조정
   *
   * @param {Array} contextMatches - 컨텍스트가 분석된 블록
   * @param {Array} ocrBlocks - 원본 OCR 블록 (BBox 포함)
   * @returns {Array} 좌표가 조정된 블록 배열
   */
  adjustWithCoordinates(contextMatches, ocrBlocks) {
    return contextMatches.map(match => {
      // BBox 정보가 있는 경우에만 처리
      if (!match.bbox) {
        return {
          ...match,
          coordinateAdjusted: false
        };
      }

      const bbox = match.bbox;
      let confidenceAdjustment = 1.0;
      const adjustments = [];

      // 1. 표 내부 정렬 확인
      if (match.primaryPattern === 'medicalEvent') {
        const alignment = this._checkColumnAlignment(bbox, ocrBlocks);
        if (alignment > 0.8) {
          confidenceAdjustment *= 1.1;  // 정렬이 좋으면 confidence 증가
          adjustments.push('column_aligned');
        }
      }

      // 2. 병합된 텍스트 보완 (예: "보 험 기 간" → "보험기간")
      if (this._isSeparatedText(match.text, bbox)) {
        const merged = this._mergeNearbyBlocks(match, ocrBlocks);
        if (merged) {
          match.text = merged;
          adjustments.push('text_merged');
        }
      }

      // 3. 인접 블록과의 관계 분석
      const nearbyBlocks = this._findNearbyBlocks(bbox, ocrBlocks);
      if (nearbyBlocks.length > 0) {
        const contextEnriched = this._enrichContextFromNearby(match, nearbyBlocks);
        if (contextEnriched) {
          match.context = match.context + ' ' + contextEnriched;
          adjustments.push('context_enriched');
        }
      }

      return {
        ...match,
        confidence: match.confidence * confidenceAdjustment,
        coordinateAdjusted: adjustments.length > 0,
        coordinateAdjustments: adjustments
      };
    });
  }

  /**
   * 표 열 정렬 확인
   * @private
   */
  _checkColumnAlignment(bbox, ocrBlocks) {
    // 같은 X 좌표 (열)에 있는 블록들 찾기
    const sameColumn = ocrBlocks.filter(block => {
      if (!block.bbox) return false;

      const xDiff = Math.abs(block.bbox.x - bbox.x);
      return xDiff < 10;  // 10픽셀 이내는 같은 열로 간주
    });

    // 같은 열에 여러 블록이 있으면 표로 판단
    return sameColumn.length >= 3 ? 0.9 : 0.5;
  }

  /**
   * 분리된 텍스트 판단
   * @private
   */
  _isSeparatedText(text, bbox) {
    // 텍스트에 공백이 많고, BBox 너비가 넓으면 분리된 텍스트로 판단
    const spaceCount = (text.match(/\s/g) || []).length;
    const textLength = text.replace(/\s/g, '').length;

    if (textLength === 0) return false;

    const spaceRatio = spaceCount / textLength;
    return spaceRatio > 0.5;  // 공백 비율 50% 이상
  }

  /**
   * 인근 블록 병합
   * @private
   */
  _mergeNearbyBlocks(block, ocrBlocks) {
    // BBox가 인접한 블록들을 찾아서 텍스트 병합
    const nearbyBlocks = this._findNearbyBlocks(block.bbox, ocrBlocks);

    if (nearbyBlocks.length === 0) {
      return null;
    }

    // 같은 라인에 있는 블록들만 병합 (Y 좌표 유사)
    const sameLine = nearbyBlocks.filter(b => {
      return Math.abs(b.bbox.y - block.bbox.y) < 5;
    });

    if (sameLine.length === 0) {
      return null;
    }

    // X 좌표 순으로 정렬하여 병합
    const sorted = [block, ...sameLine].sort((a, b) => a.bbox.x - b.bbox.x);
    const merged = sorted.map(b => b.text).join('');

    return merged;
  }

  /**
   * 인근 블록 찾기
   * @private
   */
  _findNearbyBlocks(bbox, ocrBlocks) {
    const nearby = [];
    const maxDistance = 50;  // 50픽셀 이내를 인근으로 간주

    ocrBlocks.forEach(block => {
      if (!block.bbox) return;

      const distance = Math.sqrt(
        Math.pow(block.bbox.x - bbox.x, 2) +
        Math.pow(block.bbox.y - bbox.y, 2)
      );

      if (distance > 0 && distance <= maxDistance) {
        nearby.push(block);
      }
    });

    return nearby;
  }

  /**
   * 인근 블록에서 컨텍스트 보강
   * @private
   */
  _enrichContextFromNearby(block, nearbyBlocks) {
    // 인근 블록의 텍스트를 결합하여 컨텍스트 보강
    const nearbyTexts = nearbyBlocks
      .map(b => b.text || '')
      .filter(t => t.length > 0)
      .slice(0, 3);  // 최대 3개까지

    return nearbyTexts.join(' ');
  }

  /**
   * Step 3: 패턴 매칭
   *
   * 컨텍스트 + 좌표 분석이 완료된 블록에서 최종 패턴 추출
   *
   * @param {Array} adjustedBlocks - 조정된 블록 배열
   * @returns {Array} 매칭된 패턴 배열
   */
  matchPatterns(adjustedBlocks) {
    const patterns = [];

    // 패턴별 그룹화
    const grouped = {};

    adjustedBlocks.forEach(block => {
      const pattern = block.primaryPattern;
      if (pattern === 'unknown') return;

      if (!grouped[pattern]) {
        grouped[pattern] = [];
      }

      grouped[pattern].push(block);
    });

    // 각 패턴별로 처리
    for (const [patternName, blocks] of Object.entries(grouped)) {
      patterns.push({
        pattern: patternName,
        blocks: blocks,
        count: blocks.length,
        avgConfidence: blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length,
        importance: blocks[0].importance
      });
    }

    return patterns.sort((a, b) => b.avgConfidence - a.avgConfidence);
  }

  /**
   * 날짜 추출 (컨텍스트 기반)
   *
   * @param {Array} ocrBlocks - OCR 블록 배열
   * @returns {Array} 추출된 날짜 배열
   */
  extractDates(ocrBlocks) {
    const dates = [];

    ocrBlocks.forEach(block => {
      const text = block.text || block.content || '';

      // 날짜 패턴
      const datePatterns = [
        /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
        /(\d{4})-(\d{1,2})-(\d{1,2})/g,
        /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
        /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
      ];

      for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');

          const y = parseInt(year);
          const m = parseInt(month);
          const d = parseInt(day);

          // 유효한 날짜인지 확인
          if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            dates.push({
              date: `${year}-${month}-${day}`,
              originalFormat: match[0],
              context: text,
              type: this._inferDateType(text),
              confidence: this._calculateDateConfidence(text),
              bbox: block.bbox || null
            });
          }
        }
      }
    });

    return dates;
  }

  /**
   * 날짜 타입 추론 (컨텍스트 기반)
   * @private
   */
  _inferDateType(context) {
    if (/보험기간|가입일|계약일/.test(context)) return '보험가입일';
    if (/만기일|종료일/.test(context)) return '보험만기일';
    if (/입원|admission/.test(context)) return '입원일';
    if (/퇴원|discharge/.test(context)) return '퇴원일';
    if (/수술|surgery/.test(context)) return '수술일';
    if (/진단|diagnosis/.test(context)) return '진단일';
    if (/검사|test/.test(context)) return '검사일';
    if (/통원|외래|outpatient/.test(context)) return '통원일';

    return '기타';
  }

  /**
   * 날짜 confidence 계산
   * @private
   */
  _calculateDateConfidence(context) {
    let confidence = 0.5;  // 기본

    // 컨텍스트 키워드가 있으면 confidence 증가
    if (/보험|진료|입원|수술|진단|검사/.test(context)) {
      confidence += 0.3;
    }

    // 숫자만 있는 경우 confidence 감소
    if (context.replace(/[\d\.\-\/\s년월일]/g, '').length < 3) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

/**
 * 팩토리 함수
 */
export function createOCRPostProcessingService() {
  return new OCRPostProcessingService();
}

export default OCRPostProcessingService;
