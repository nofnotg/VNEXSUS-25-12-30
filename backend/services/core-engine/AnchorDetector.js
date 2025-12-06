// AnchorDetector.js - 앵커(시간 기준점) 탐지 컴포넌트
import { logService } from '../../utils/logger.js';

export default class AnchorDetector {
  /**
   * 텍스트 세그먼트에서 앵커 탐지
   * @param {Array} segments - 처리된 텍스트 세그먼트
   * @returns {Promise<Array>} 탐지된 앵커 배열
   */
  static async detect(segments) {
    try {
      const anchors = [];

      for (const segment of segments) {
        const segmentAnchors = await this.detectInSegment(segment);
        anchors.push(...segmentAnchors);
      }

      // 앵커 정렬 및 중복 제거
      const sortedAnchors = this.sortAndDeduplicateAnchors(anchors);

      logService.info('Anchor detection completed', {
        totalAnchors: sortedAnchors.length,
        segmentCount: segments.length
      });

      return sortedAnchors;

    } catch (error) {
      console.error('AnchorDetector processing error:', error);
      throw new Error(`CE-ANCHOR-002: ${error.message}`);
    }
  }

  /**
   * 개별 세그먼트에서 앵커 탐지
   */
  static async detectInSegment(segment) {
    const anchors = [];
    const text = segment.text;

    // 1. 내원일 패턴
    const visitPatterns = [
      /(\d{4}-\d{1,2}-\d{1,2}).*?내원/g,
      /내원.*?(\d{4}-\d{1,2}-\d{1,2})/g,
      /(\d{4}-\d{1,2}-\d{1,2}).*?외래/g,
      /외래.*?(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    for (const pattern of visitPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        anchors.push(this.createAnchor('visit', match[1], segment, match.index));
      }
    }

    // 2. 입원/퇴원 패턴
    const admissionPatterns = [
      /(\d{4}-\d{1,2}-\d{1,2}).*?입원/g,
      /입원.*?(\d{4}-\d{1,2}-\d{1,2})/g,
      /(\d{4}-\d{1,2}-\d{1,2}).*?퇴원/g,
      /퇴원.*?(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    for (const pattern of admissionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const type = text.includes('입원') ? 'admission' : 'discharge';
        anchors.push(this.createAnchor(type, match[1], segment, match.index));
      }
    }

    // 3. 검사 시행일 패턴
    const examPatterns = [
      /(\d{4}-\d{1,2}-\d{1,2}).*?(CT|MRI|초음파|내시경|X-ray)/gi,
      /(CT|MRI|초음파|내시경|X-ray).*?(\d{4}-\d{1,2}-\d{1,2})/gi,
      /(\d{4}-\d{1,2}-\d{1,2}).*?검사/g,
      /검사.*?(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    for (const pattern of examPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateMatch = match[1] && /\d{4}-\d{1,2}-\d{1,2}/.test(match[1]) ? match[1] : match[2];
        if (dateMatch) {
          anchors.push(this.createAnchor('exam_performed', dateMatch, segment, match.index));
        }
      }
    }

    // 4. 검사 보고일 패턴
    const reportPatterns = [
      /(\d{4}-\d{1,2}-\d{1,2}).*?(판독|보고|결과)/g,
      /(판독|보고|결과).*?(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    for (const pattern of reportPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateMatch = match[1] && /\d{4}-\d{1,2}-\d{1,2}/.test(match[1]) ? match[1] : match[2];
        if (dateMatch) {
          anchors.push(this.createAnchor('exam_reported', dateMatch, segment, match.index));
        }
      }
    }

    // 5. 수술/시술일 패턴
    const surgeryPatterns = [
      /(\d{4}-\d{1,2}-\d{1,2}).*?(수술|시술)/g,
      /(수술|시술).*?(\d{4}-\d{1,2}-\d{1,2})/g
    ];

    for (const pattern of surgeryPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateMatch = match[1] && /\d{4}-\d{1,2}-\d{1,2}/.test(match[1]) ? match[1] : match[2];
        if (dateMatch) {
          anchors.push(this.createAnchor('surgery', dateMatch, segment, match.index));
        }
      }
    }

    // 6. 한국어 날짜 패턴 (YYYY년 MM월 DD일)
    const koreanDatePattern = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
    let koreanMatch;

    while ((koreanMatch = koreanDatePattern.exec(text)) !== null) {
      const year = koreanMatch[1];
      const month = koreanMatch[2];
      const day = koreanMatch[3];
      const dateString = `${year}년 ${month}월 ${day}일`;

      // 주변 컨텍스트로 타입 결정
      const context = text.substring(
        Math.max(0, koreanMatch.index - 30),
        Math.min(text.length, koreanMatch.index + 50)
      );

      let type = 'general';
      if (/내원|외래/.test(context)) type = 'visit';
      else if (/입원/.test(context)) type = 'admission';
      else if (/퇴원/.test(context)) type = 'discharge';
      else if (/검사/.test(context)) type = 'exam_performed';
      else if (/수술|시술/.test(context)) type = 'surgery';
      else if (/진료/.test(context)) type = 'visit';

      anchors.push(this.createAnchor(type, dateString, segment, koreanMatch.index));
    }

    return anchors;
  }

  /**
   * 앵커 객체 생성
   */
  static createAnchor(type, dateString, segment, position) {
    // 날짜 정규화
    const normalizedDate = this.normalizeDate(dateString);

    // 근접도 점수 계산 (주변 컨텍스트 기반)
    const proximityScore = this.calculateProximityScore(segment.text, position, type);


    return {
      id: `anchor_${type}_${segment.id}_${position}`,
      type,
      date: normalizedDate,
      normalizedDate: normalizedDate, // TimelineAssembler expects this field
      originalDate: dateString,
      sourceId: segment.id,
      segmentId: segment.id, // EntityNormalizer expects this field
      position,
      startIndex: position, // EntityNormalizer expects this field
      proximityScore,
      context: this.extractContext(segment.text, position, 50),
      confidence: this.calculateConfidence(type, segment.text, position)
    };
  }

  /**
   * 날짜 정규화 (YYYY-MM-DD 형식으로 통일)
   */
  static normalizeDate(dateString) {
    // 이미 YYYY-MM-DD 형식인 경우
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
      const parts = dateString.split('-');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // YYYY.MM.DD 형식
    if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(dateString)) {
      const parts = dateString.split('.');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // YYYY/MM/DD 형식
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateString)) {
      const parts = dateString.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    // 한국어 형식: YYYY년 MM월 DD일
    const koreanMatch = dateString.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanMatch) {
      const year = koreanMatch[1];
      const month = koreanMatch[2];
      const day = koreanMatch[3];
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateString; // 정규화 실패시 원본 반환
  }

  /**
   * 근접도 점수 계산
   */
  static calculateProximityScore(text, position, type) {
    const contextWindow = 30;
    const before = text.substring(Math.max(0, position - contextWindow), position);
    const after = text.substring(position, Math.min(text.length, position + contextWindow));

    let score = 0.5; // 기본 점수

    // 타입별 키워드 가중치
    const typeKeywords = {
      visit: ['내원', '외래', '방문'],
      admission: ['입원', '병동'],
      discharge: ['퇴원', '퇴실'],
      exam_performed: ['시행', '촬영', '검사'],
      exam_reported: ['판독', '보고', '결과'],
      surgery: ['수술', '시술', '처치']
    };

    const keywords = typeKeywords[type] || [];
    for (const keyword of keywords) {
      if (before.includes(keyword) || after.includes(keyword)) {
        score += 0.2;
      }
    }

    // 의료진/부서 언급시 가중치
    if (/의사|교수|과장|간호사|부서|과/.test(before + after)) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * 신뢰도 계산
   */
  static calculateConfidence(type, text, position) {
    let confidence = 0.7; // 기본 신뢰도

    // 명확한 패턴일수록 높은 신뢰도
    const strongPatterns = {
      visit: /\d{4}-\d{2}-\d{2}\s+내원/,
      admission: /\d{4}-\d{2}-\d{2}\s+입원/,
      exam_performed: /\d{4}-\d{2}-\d{2}\s+(CT|MRI)/
    };

    if (strongPatterns[type] && strongPatterns[type].test(text)) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * 컨텍스트 추출
   */
  static extractContext(text, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end).trim();
  }

  /**
   * 앵커 정렬 및 중복 제거
   */
  static sortAndDeduplicateAnchors(anchors) {
    // 날짜순 정렬
    anchors.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 중복 제거 (같은 날짜, 같은 타입)
    const deduped = [];
    const seen = new Set();

    for (const anchor of anchors) {
      const key = `${anchor.date}_${anchor.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(anchor);
      } else {
        // 기존 앵커보다 신뢰도가 높으면 교체
        const existingIndex = deduped.findIndex(a =>
          a.date === anchor.date && a.type === anchor.type
        );
        if (existingIndex >= 0 && anchor.confidence > deduped[existingIndex].confidence) {
          deduped[existingIndex] = anchor;
        }
      }
    }

    return deduped;
  }

  /**
   * 앵커 검증
   */
  static validateAnchors(anchors) {
    const warnings = [];

    // 날짜 역전 체크
    for (let i = 1; i < anchors.length; i++) {
      const prev = anchors[i - 1];
      const curr = anchors[i];

      if (new Date(curr.date) < new Date(prev.date)) {
        warnings.push({
          type: 'date_reversal',
          message: `Date reversal detected: ${prev.date} -> ${curr.date}`,
          anchors: [prev.id, curr.id]
        });
      }
    }

    return warnings;
  }
}