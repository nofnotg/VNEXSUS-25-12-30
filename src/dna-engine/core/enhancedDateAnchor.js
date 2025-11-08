/**
 * Enhanced Date-Data Anchoring Engine
 * 
 * GPT-5 분석 기반으로 설계된 고급 날짜-데이터 연결 시스템
 * 
 * 핵심 기능:
 * 1. Dual-Sweep Anchoring: 순방향/역방향 이중 스위프 분석
 * 2. Conflict Resolution: 날짜 충돌 해결 알고리즘
 * 3. Primary/Secondary Date Classification: 주/부 날짜 계층 구조
 * 4. Evidence-based Confidence: 근거 기반 신뢰도 계산
 * 5. Error Handling: 강화된 에러 처리 및 복구
 * 
 * 예시 케이스:
 * "2025-05-10 진료 시 2025-04-30 치료받았다고 함"
 * → Primary: 2025-05-10 (현재 진료), Secondary: 2025-04-30 (과거 언급)
 */

import { globalErrorHandler, safeExecute, safeExecuteWithRetry } from './errorHandler.js';

class EnhancedDateAnchor {
  constructor() {
    this.version = '1.0.0';
    this.conflictResolver = new ConflictResolver();
    this.confidenceCalculator = new UnifiedConfidenceCalculator();
    this.evidenceTracker = new EvidenceTracker();
    
    // 날짜 패턴 (의료 문서 특화 강화)
    this.datePatterns = {
      // 절대 날짜 패턴 (우선순위 높음)
      absolute: {
        patterns: [
          // 한국어 표준 형식
          /(?<year>\d{4})[년\-\.\s]*(?<month>\d{1,2})[월\-\.\s]*(?<day>\d{1,2})[일]?/g,
          /(?<year>\d{4})[\-\.\/](?<month>\d{1,2})[\-\.\/](?<day>\d{1,2})/g,
          // 미국식 형식 (MM/DD/YYYY)
          /(?<month>\d{1,2})[월\/\-\.](?<day>\d{1,2})[일\/\-\.](?<year>\d{4})/g,
          // 축약형 (YY.MM.DD)
          /(?<year>\d{2})[\-\.](?<month>\d{1,2})[\-\.](?<day>\d{1,2})/g,
          // 의료 문서 특화 (괄호 포함)
          /\((?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?\)/g,
          // 공백 포함 형식
          /(?<year>\d{4})\s+(?<month>\d{1,2})\s+(?<day>\d{1,2})/g
        ],
        confidence: 0.95,
        priority: 100
      },
      
      // 상대 날짜 패턴 (의료 문서 강화)
      relative: {
        patterns: [
          // 기본 상대 표현
          /(?<reference>금일|오늘|당일|현재|today)/gi,
          /(?<reference>어제|yesterday)/gi,
          /(?<reference>내일|tomorrow)/gi,
          // 숫자 포함 상대 표현
          /(?<number>\d+)\s*(?<unit>일|주|개월|년|month|week|day|year)\s*(?<direction>전|후|뒤|ago|later)/gi,
          // 의료 특화 상대 표현
          /(?<reference>최근|근래|recently)\s*(?<number>\d+)?\s*(?<unit>일|주|개월|년)?/gi,
          /(?<reference>지난|last)\s*(?<unit>주|월|년|week|month|year)/gi,
          // 진료 관련 상대 표현
          /(?<reference>초진|재진|첫\s*방문)\s*(?<direction>시|당시)/gi
        ],
        confidence: 0.8,
        priority: 70
      },
      
      // 기간 패턴 (의료 문서 강화)
      duration: {
        patterns: [
          // 기본 기간 표현
          /(?<start_year>\d{4})[년\-\.]*(?<start_month>\d{1,2})?[월\-\.]*(?<start_day>\d{1,2})?[일]?\s*(?:부터|에서|~|-|to)\s*(?<end_year>\d{4})?[년\-\.]*(?<end_month>\d{1,2})?[월\-\.]*(?<end_day>\d{1,2})?[일]?\s*(?:까지|동안|until)/gi,
          // 시작점 표현
          /(?<year>\d{4})[년]?\s*(?<month>\d{1,2})?[월]?\s*(?:부터|이후|이래|since)/gi,
          // 기간 길이 표현
          /(?<number>\d+)\s*(?<unit>일|주|개월|년|day|week|month|year)\s*(?:간|동안|for)/gi,
          // 의료 특화 기간
          /(?<context>치료|복용|입원)\s*(?<number>\d+)\s*(?<unit>일|주|개월|년)\s*(?:간|동안)/gi
        ],
        confidence: 0.75,
        priority: 80
      },
      
      // 의료 맥락 특화 패턴 (대폭 강화)
      medical: {
        patterns: [
          // 진료 관련 날짜
          /(?<context>진료|검사|수술|처방|투약|복용|시술|치료)\s*(?<date_ref>당시|시점|일자|날짜|date)/gi,
          // 진단 관련 날짜
          /(?<date_ref>발병|진단|치료\s*시작|onset|diagnosis)\s*(?<year>\d{4})[년]?\s*(?<month>\d{1,2})?[월]?\s*(?<day>\d{1,2})?[일]?/gi,
          // 입퇴원 날짜
          /(?<context>입원|퇴원|내원|방문|visit|admission|discharge)\s*(?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?/gi,
          // 검사 날짜
          /(?<context>촬영|검사|측정|test|exam|scan)\s*(?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?/gi,
          // 증상 관련 날짜
          /(?<context>증상|symptom|pain|발열|fever)\s*(?<date_ref>시작|발생|onset)\s*(?<year>\d{4})?[년]?\s*(?<month>\d{1,2})?[월]?/gi,
          // 처방 관련 날짜
          /(?<context>처방|prescription|약물|medication)\s*(?<date_ref>시작|변경|중단)\s*(?<year>\d{4})?[년]?\s*(?<month>\d{1,2})?[월]?/gi,
          // 수술 관련 날짜
          /(?<context>수술|surgery|operation)\s*(?<date_ref>예정|시행|완료)\s*(?<year>\d{4})?[년]?\s*(?<month>\d{1,2})?[월]?\s*(?<day>\d{1,2})?[일]?/gi
        ],
        confidence: 0.85,
        priority: 90
      }
    };
    
    // 충돌 해결 규칙
    this.conflictRules = {
      // 시간적 논리 검증
      temporal_logic: {
        max_future_days: 30,  // 미래 30일 이내만 허용
        max_past_years: 10,   // 과거 10년 이내만 허용
        min_interval_hours: 1 // 최소 1시간 간격
      },
      
      // 의료 맥락 우선순위
      medical_priority: {
        'current_visit': 100,    // 현재 진료
        'recent_treatment': 90,  // 최근 치료
        'diagnosis_date': 85,    // 진단일
        'symptom_onset': 80,     // 증상 시작
        'past_history': 60,      // 과거력
        'mentioned_event': 40    // 언급된 사건
      }
    };
    
    // 처리 통계
    this.stats = {
      totalProcessed: 0,
      dualSweepSuccess: 0,
      conflictsResolved: 0,
      averageConfidence: 0,
      processingTime: []
    };
  }

  /**
   * 메인 처리 함수: Dual-Sweep Anchoring 수행
   * @param {string} text - 분석할 텍스트
   * @param {Object} context - 컨텍스트 정보
   * @returns {Promise<Object>} 처리 결과
   */
  async dualSweepAnalysis(text, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Dual-Sweep Anchoring 시작...');
      
      // 1. Forward Sweep: 시간순 진행 분석
      const forwardAnchors = await this.forwardSweep(text, context);
      console.log(`➡️ Forward Sweep: ${forwardAnchors.length}개 앵커 발견`);
      
      // 2. Backward Sweep: 역순 검증 분석
      const backwardAnchors = await this.backwardSweep(text, context);
      console.log(`⬅️ Backward Sweep: ${backwardAnchors.length}개 앵커 검증`);
      
      // 3. Conflict Resolution: 충돌 해결
      const resolvedAnchors = await this.conflictResolver.resolve(
        forwardAnchors, 
        backwardAnchors, 
        context
      );
      console.log(`⚖️ Conflict Resolution: ${resolvedAnchors.conflicts.length}개 충돌 해결`);
      
      // 4. Primary/Secondary Classification: 주/부 날짜 분류
      const classifiedAnchors = this.classifyDateHierarchy(resolvedAnchors.anchors, text);
      console.log(`📊 Date Classification: Primary ${classifiedAnchors.primary.length}개, Secondary ${classifiedAnchors.secondary.length}개`);
      
      // 5. Confidence Calculation: 신뢰도 계산
      const finalAnchors = await this.calculateFinalConfidence(classifiedAnchors, text);
      
      // 6. Nearby Date Merging: 근접 날짜 병합
      const mergedAnchors = this.mergeNearbyDates(finalAnchors, 7); // 7일 임계값
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: true,
        version: this.version,
        processingTime,
        input: {
          textLength: text.length,
          context
        },
        analysis: {
          forwardSweep: {
            anchors: forwardAnchors,
            count: forwardAnchors.length
          },
          backwardSweep: {
            anchors: backwardAnchors,
            count: backwardAnchors.length
          },
          conflictResolution: {
            conflicts: resolvedAnchors.conflicts,
            resolved: resolvedAnchors.resolved,
            conflictCount: resolvedAnchors.conflicts.length
          }
        },
        result: {
          primary: mergedAnchors.primary,
          secondary: mergedAnchors.secondary,
          hierarchy: this.buildDateHierarchy(mergedAnchors),
          confidence: this.calculateOverallConfidence(mergedAnchors),
          evidence: this.extractEvidence(mergedAnchors, text)
        },
        stats: this.updateStats(processingTime, resolvedAnchors.conflicts.length)
      };
      
      console.log(`✅ Dual-Sweep Anchoring 완료 (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      console.error('❌ Dual-Sweep Anchoring 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Forward Sweep: 텍스트를 순방향으로 분석하여 날짜 앵커 추출
   */
  async forwardSweep(text, context) {
    const anchors = [];
    let anchorId = 0;
    
    // 각 패턴 카테고리별로 순차 처리
    for (const [category, config] of Object.entries(this.datePatterns)) {
      for (const pattern of config.patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const anchor = {
            id: `anchor_${anchorId++}`,
            category,
            text: match[0],
            groups: match.groups || {},
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            confidence: config.confidence,
            priority: config.priority,
            sweep: 'forward',
            context: this.extractLocalContext(text, match.index, 100)
          };
          
          // 날짜 정규화
          anchor.normalized = this.normalizeDateAnchor(anchor, context);
          
          // 의료 맥락 분석
          anchor.medicalContext = this.analyzeMedicalContext(anchor, text);
          
          anchors.push(anchor);
        }
      }
    }
    
    // 위치순 정렬
    return anchors.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Backward Sweep: 텍스트를 역방향으로 분석하여 검증
   */
  async backwardSweep(text, context) {
    const anchors = [];
    let anchorId = 1000; // Forward와 구분하기 위해 1000부터 시작
    
    // 텍스트를 역순으로 처리
    const reversedText = text.split('').reverse().join('');
    
    // 역방향 패턴 (간단한 검증용)
    const backwardPatterns = [
      /(?<day>\d{1,2})[일\-\.\s]*(?<month>\d{1,2})[월\-\.\s]*(?<year>\d{4})[년]?/g,
      /(?<reference>일금|늘오)/g // 역순 상대 날짜
    ];
    
    for (const pattern of backwardPatterns) {
      let match;
      while ((match = pattern.exec(reversedText)) !== null) {
        // 원본 텍스트에서의 실제 위치 계산
        const actualStart = text.length - match.index - match[0].length;
        const actualEnd = text.length - match.index;
        
        const anchor = {
          id: `anchor_${anchorId++}`,
          category: 'backward_validation',
          text: text.substring(actualStart, actualEnd),
          groups: match.groups || {},
          position: {
            start: actualStart,
            end: actualEnd
          },
          confidence: 0.7, // 검증용이므로 낮은 신뢰도
          priority: 50,
          sweep: 'backward',
          context: this.extractLocalContext(text, actualStart, 100)
        };
        
        anchor.normalized = this.normalizeDateAnchor(anchor, context);
        anchors.push(anchor);
      }
    }
    
    return anchors.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * 날짜 앵커 정규화
   */
  normalizeDateAnchor(anchor, context) {
    const referenceDate = context.referenceDate || new Date();
    let normalizedDate = null;
    let dateType = 'unknown';
    let precision = 'day';
    
    try {
      switch (anchor.category) {
        case 'absolute':
        case 'medical':
          normalizedDate = this.parseAbsoluteDate(anchor.groups);
          dateType = 'absolute';
          precision = this.determinePrecision(anchor.groups);
          break;
          
        case 'relative':
          normalizedDate = this.parseRelativeDate(anchor.groups, referenceDate);
          dateType = 'relative';
          precision = 'day';
          break;
          
        case 'duration':
          const duration = this.parseDurationDate(anchor.groups, referenceDate);
          normalizedDate = duration.start;
          dateType = 'duration';
          precision = duration.precision;
          anchor.endDate = duration.end;
          break;
          
        case 'backward_validation':
          normalizedDate = this.parseBackwardDate(anchor.groups);
          dateType = 'validation';
          precision = 'day';
          break;
      }
    } catch (error) {
      console.warn(`날짜 정규화 실패: ${anchor.text}`, error);
    }
    
    return {
      date: normalizedDate,
      dateType,
      precision,
      confidence: this.calculateNormalizationConfidence(normalizedDate, anchor.category),
      isValid: normalizedDate !== null && this.validateDate(normalizedDate)
    };
  }

  /**
   * 절대 날짜 파싱
   */
  parseAbsoluteDate(groups) {
    const { year, month, day } = groups;
    
    if (year && month && day) {
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      
      if (this.isValidDateComponents(y, m, d)) {
        return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }
    }
    
    return null;
  }

  /**
   * 상대 날짜 파싱
   */
  parseRelativeDate(groups, referenceDate) {
    const { reference, number, unit, direction } = groups;
    const refDate = new Date(referenceDate);
    
    if (reference) {
      switch (reference) {
        case '금일':
        case '오늘':
        case '당일':
        case '현재':
          return refDate.toISOString().split('T')[0];
        case '어제':
          refDate.setDate(refDate.getDate() - 1);
          return refDate.toISOString().split('T')[0];
      }
    }
    
    if (number && unit && direction) {
      const num = parseInt(number);
      const dir = direction === '전' ? -1 : 1;
      
      switch (unit) {
        case '일':
          refDate.setDate(refDate.getDate() + (num * dir));
          break;
        case '주':
          refDate.setDate(refDate.getDate() + (num * 7 * dir));
          break;
        case '개월':
          refDate.setMonth(refDate.getMonth() + (num * dir));
          break;
        case '년':
          refDate.setFullYear(refDate.getFullYear() + (num * dir));
          break;
      }
      
      return refDate.toISOString().split('T')[0];
    }
    
    return null;
  }

  /**
   * 기간 날짜 파싱
   */
  parseDurationDate(groups, referenceDate) {
    const { start_year, start_month, start_day, end_year, end_month, end_day, year, month, number, unit } = groups;
    
    let startDate = null;
    let endDate = null;
    let precision = 'day';
    
    // 시작-종료 형식
    if (start_year) {
      startDate = this.parseAbsoluteDate({ year: start_year, month: start_month || '1', day: start_day || '1' });
      
      if (end_year || end_month || end_day) {
        endDate = this.parseAbsoluteDate({ 
          year: end_year || start_year, 
          month: end_month || '12', 
          day: end_day || '31' 
        });
      }
    }
    
    // "YYYY년부터" 형식
    if (year && !startDate) {
      startDate = this.parseAbsoluteDate({ year, month: month || '1', day: '1' });
      precision = month ? 'month' : 'year';
    }
    
    // "N일간" 형식
    if (number && unit && !startDate) {
      const refDate = new Date(referenceDate);
      startDate = refDate.toISOString().split('T')[0];
      
      const num = parseInt(number);
      switch (unit) {
        case '일':
          refDate.setDate(refDate.getDate() + num);
          break;
        case '주':
          refDate.setDate(refDate.getDate() + (num * 7));
          break;
        case '개월':
          refDate.setMonth(refDate.getMonth() + num);
          break;
        case '년':
          refDate.setFullYear(refDate.getFullYear() + num);
          break;
      }
      
      endDate = refDate.toISOString().split('T')[0];
    }
    
    return {
      start: startDate,
      end: endDate,
      precision
    };
  }

  /**
   * 역방향 날짜 파싱 (검증용)
   */
  parseBackwardDate(groups) {
    // 역순으로 추출된 날짜를 정방향으로 변환
    const { year, month, day } = groups;
    
    if (year && month && day) {
      return this.parseAbsoluteDate({ year, month, day });
    }
    
    return null;
  }

  /**
   * 의료 맥락 분석
   */
  analyzeMedicalContext(anchor, text) {
    const context = {
      type: 'general',
      keywords: [],
      priority: 50,
      clinicalSignificance: 0.5
    };
    
    // 의료 키워드 검색
    const medicalKeywords = {
      'current_visit': ['내원', '진료', '방문', '현재'],
      'diagnosis': ['진단', '소견', '판정'],
      'treatment': ['치료', '처방', '투약', '복용'],
      'examination': ['검사', '촬영', '측정'],
      'surgery': ['수술', '시술'],
      'symptom': ['증상', '호소', '불편'],
      'past_history': ['과거', '이전', '예전', '당시']
    };
    
    const contextWindow = anchor.context;
    
    for (const [type, keywords] of Object.entries(medicalKeywords)) {
      for (const keyword of keywords) {
        if (contextWindow.includes(keyword)) {
          context.type = type;
          context.keywords.push(keyword);
          context.priority = this.conflictRules.medical_priority[type] || 50;
          break;
        }
      }
      if (context.type !== 'general') break;
    }
    
    // 임상적 중요도 계산
    context.clinicalSignificance = this.calculateClinicalSignificance(context, anchor);
    
    return context;
  }

  /**
   * 주/부 날짜 계층 분류
   */
  classifyDateHierarchy(anchors, text) {
    const primary = [];
    const secondary = [];
    
    // 우선순위 기반 분류
    anchors.forEach(anchor => {
      if (!anchor.normalized.isValid) return;
      
      const score = this.calculateHierarchyScore(anchor, text);
      
      if (score >= 80) {
        primary.push({ ...anchor, hierarchyScore: score });
      } else {
        secondary.push({ ...anchor, hierarchyScore: score });
      }
    });
    
    // 점수순 정렬
    primary.sort((a, b) => b.hierarchyScore - a.hierarchyScore);
    secondary.sort((a, b) => b.hierarchyScore - a.hierarchyScore);
    
    return { primary, secondary };
  }

  /**
   * 계층 점수 계산
   */
  calculateHierarchyScore(anchor, text) {
    let score = anchor.priority || 50;
    
    // 의료 맥락 보너스
    score += (anchor.medicalContext.priority - 50) * 0.5;
    
    // 정확도 보너스
    score += anchor.normalized.confidence * 20;
    
    // 위치 보너스 (텍스트 앞부분에 있으면 더 중요)
    const positionRatio = 1 - (anchor.position.start / text.length);
    score += positionRatio * 10;
    
    // 구체성 보너스
    if (anchor.normalized.precision === 'day') score += 10;
    else if (anchor.normalized.precision === 'month') score += 5;
    
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 근접 날짜 병합
   */
  mergeNearbyDates(classifiedAnchors, thresholdDays = 7) {
    const mergeGroup = (anchors) => {
      const merged = [];
      const processed = new Set();
      
      anchors.forEach((anchor, index) => {
        if (processed.has(index)) return;
        
        const group = [anchor];
        const anchorDate = new Date(anchor.normalized.date);
        
        // 임계값 내의 다른 날짜들 찾기
        for (let i = index + 1; i < anchors.length; i++) {
          if (processed.has(i)) continue;
          
          const otherAnchor = anchors[i];
          const otherDate = new Date(otherAnchor.normalized.date);
          const daysDiff = Math.abs((anchorDate - otherDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= thresholdDays) {
            group.push(otherAnchor);
            processed.add(i);
          }
        }
        
        processed.add(index);
        
        // 그룹이 여러 개면 병합, 아니면 그대로
        if (group.length > 1) {
          merged.push(this.mergeAnchorGroup(group));
        } else {
          merged.push(anchor);
        }
      });
      
      return merged;
    };
    
    return {
      primary: mergeGroup(classifiedAnchors.primary),
      secondary: mergeGroup(classifiedAnchors.secondary)
    };
  }

  /**
   * 앵커 그룹 병합
   */
  mergeAnchorGroup(group) {
    // 가장 높은 점수의 앵커를 기준으로 병합
    const primary = group.reduce((best, current) => 
      current.hierarchyScore > best.hierarchyScore ? current : best
    );
    
    return {
      ...primary,
      id: `merged_${group.map(a => a.id).join('_')}`,
      mergedFrom: group.map(a => a.id),
      mergedCount: group.length,
      confidence: Math.max(...group.map(a => a.normalized.confidence)),
      evidence: group.map(a => a.text).join(', ')
    };
  }

  /**
   * 최종 신뢰도 계산
   */
  async calculateFinalConfidence(classifiedAnchors, text) {
    const calculateForGroup = (anchors) => {
      return anchors.map(anchor => {
        const confidence = this.confidenceCalculator.calculate({
          content: anchor.text,
          anchors: [anchor],
          position: anchor.position,
          evidence: {
            startPos: anchor.position.start,
            endPos: anchor.position.end,
            rawText: anchor.text,
            context: anchor.context
          }
        });
        
        return {
          ...anchor,
          finalConfidence: confidence
        };
      });
    };
    
    return {
      primary: calculateForGroup(classifiedAnchors.primary),
      secondary: calculateForGroup(classifiedAnchors.secondary)
    };
  }

  /**
   * 날짜 계층 구조 구축
   */
  buildDateHierarchy(mergedAnchors) {
    const timeline = [];
    
    // 모든 앵커를 시간순으로 정렬
    const allAnchors = [...mergedAnchors.primary, ...mergedAnchors.secondary]
      .filter(anchor => anchor.normalized.isValid)
      .sort((a, b) => new Date(a.normalized.date) - new Date(b.normalized.date));
    
    allAnchors.forEach((anchor, index) => {
      timeline.push({
        position: index,
        date: anchor.normalized.date,
        type: mergedAnchors.primary.includes(anchor) ? 'primary' : 'secondary',
        anchor: anchor,
        relationships: this.findRelationships(anchor, allAnchors)
      });
    });
    
    return {
      timeline,
      primaryCount: mergedAnchors.primary.length,
      secondaryCount: mergedAnchors.secondary.length,
      totalSpan: this.calculateTimeSpan(allAnchors)
    };
  }

  /**
   * 관계 찾기
   */
  findRelationships(anchor, allAnchors) {
    const relationships = [];
    const anchorDate = new Date(anchor.normalized.date);
    
    allAnchors.forEach(other => {
      if (other.id === anchor.id) return;
      
      const otherDate = new Date(other.normalized.date);
      const daysDiff = (otherDate - anchorDate) / (1000 * 60 * 60 * 24);
      
      let relationType = 'unrelated';
      if (Math.abs(daysDiff) <= 1) relationType = 'same_period';
      else if (daysDiff > 0) relationType = 'before';
      else relationType = 'after';
      
      relationships.push({
        targetId: other.id,
        type: relationType,
        daysDifference: Math.round(daysDiff),
        confidence: this.calculateRelationshipConfidence(anchor, other)
      });
    });
    
    return relationships;
  }

  /**
   * 전체 신뢰도 계산
   */
  calculateOverallConfidence(mergedAnchors) {
    const allAnchors = [...mergedAnchors.primary, ...mergedAnchors.secondary];
    
    if (allAnchors.length === 0) return 0;
    
    const totalConfidence = allAnchors.reduce((sum, anchor) => {
      return sum + (anchor.finalConfidence?.value || anchor.normalized.confidence || 0);
    }, 0);
    
    return totalConfidence / allAnchors.length;
  }

  /**
   * 증거 추출
   */
  extractEvidence(mergedAnchors, text) {
    const evidence = {
      primary: [],
      secondary: [],
      conflicts: [],
      supporting: []
    };
    
    // Primary 증거
    mergedAnchors.primary.forEach(anchor => {
      evidence.primary.push({
        anchorId: anchor.id,
        text: anchor.text,
        context: anchor.context,
        position: anchor.position,
        confidence: anchor.finalConfidence?.value || anchor.normalized.confidence
      });
    });
    
    // Secondary 증거
    mergedAnchors.secondary.forEach(anchor => {
      evidence.secondary.push({
        anchorId: anchor.id,
        text: anchor.text,
        context: anchor.context,
        position: anchor.position,
        confidence: anchor.finalConfidence?.value || anchor.normalized.confidence
      });
    });
    
    return evidence;
  }

  /**
   * 유틸리티 메서드들
   */
  extractLocalContext(text, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  determinePrecision(groups) {
    if (groups.day) return 'day';
    if (groups.month) return 'month';
    if (groups.year) return 'year';
    return 'approximate';
  }

  calculateNormalizationConfidence(normalizedDate, category) {
    if (!normalizedDate) return 0;
    
    const baseConfidence = this.datePatterns[category]?.confidence || 0.5;
    return Math.min(baseConfidence + 0.1, 1.0);
  }

  validateDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && 
           date.getFullYear() >= 1900 && 
           date.getFullYear() <= 2100;
  }

  isValidDateComponents(year, month, day) {
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }

  calculateClinicalSignificance(context, anchor) {
    let significance = 0.5;
    
    // 의료 맥락 보너스
    if (context.type !== 'general') significance += 0.2;
    if (context.keywords.length > 0) significance += context.keywords.length * 0.1;
    
    // 정확도 보너스
    significance += anchor.normalized.confidence * 0.3;
    
    return Math.min(significance, 1.0);
  }

  calculateTimeSpan(anchors) {
    if (anchors.length < 2) return null;
    
    const dates = anchors.map(a => new Date(a.normalized.date)).sort((a, b) => a - b);
    const start = dates[0];
    const end = dates[dates.length - 1];
    
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days: diffDays,
      formatted: this.formatTimeSpan(diffDays)
    };
  }

  formatTimeSpan(days) {
    if (days === 0) return '당일';
    if (days < 7) return `${days}일`;
    if (days < 30) return `${Math.floor(days / 7)}주`;
    if (days < 365) return `${Math.floor(days / 30)}개월`;
    return `${Math.floor(days / 365)}년`;
  }

  calculateRelationshipConfidence(anchor1, anchor2) {
    const conf1 = anchor1.normalized.confidence;
    const conf2 = anchor2.normalized.confidence;
    return (conf1 + conf2) / 2;
  }

  updateStats(processingTime, conflictCount) {
    this.stats.totalProcessed++;
    this.stats.conflictsResolved += conflictCount;
    this.stats.processingTime.push(processingTime);
    
    // 평균 처리 시간 계산
    const avgTime = this.stats.processingTime.reduce((sum, time) => sum + time, 0) / this.stats.processingTime.length;
    
    return {
      ...this.stats,
      averageProcessingTime: Math.round(avgTime)
    };
  }
}

/**
 * Conflict Resolution 클래스
 * 날짜 충돌을 해결하는 전용 클래스
 */
class ConflictResolver {
  constructor() {
    this.resolutionStrategies = {
      'temporal_logic': this.resolveTemporalLogic.bind(this),
      'confidence_based': this.resolveByConfidence.bind(this),
      'medical_priority': this.resolveByMedicalPriority.bind(this),
      'position_based': this.resolveByPosition.bind(this)
    };
  }

  /**
   * 충돌 해결 메인 함수
   */
  async resolve(forwardAnchors, backwardAnchors, context) {
    const conflicts = this.detectConflicts(forwardAnchors, backwardAnchors);
    const resolved = [];
    
    console.log(`🔍 ${conflicts.length}개 충돌 감지`);
    
    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, context);
      resolved.push(resolution);
    }
    
    // 충돌이 해결된 앵커들과 충돌이 없는 앵커들 병합
    const allAnchors = this.mergeResolvedAnchors(forwardAnchors, backwardAnchors, resolved);
    
    return {
      anchors: allAnchors,
      conflicts,
      resolved
    };
  }

  /**
   * 충돌 감지
   */
  detectConflicts(forwardAnchors, backwardAnchors) {
    const conflicts = [];
    
    forwardAnchors.forEach(forward => {
      backwardAnchors.forEach(backward => {
        if (this.isConflicting(forward, backward)) {
          conflicts.push({
            id: `conflict_${forward.id}_${backward.id}`,
            type: this.classifyConflictType(forward, backward),
            forward,
            backward,
            severity: this.calculateConflictSeverity(forward, backward)
          });
        }
      });
    });
    
    return conflicts;
  }

  /**
   * 충돌 여부 판단
   */
  isConflicting(anchor1, anchor2) {
    // 위치가 겹치는지 확인
    const positionOverlap = (
      anchor1.position.start < anchor2.position.end && 
      anchor2.position.start < anchor1.position.end
    );
    
    if (!positionOverlap) return false;
    
    // 날짜가 다른지 확인
    const date1 = anchor1.normalized.date;
    const date2 = anchor2.normalized.date;
    
    if (!date1 || !date2) return false;
    
    return date1 !== date2;
  }

  /**
   * 충돌 유형 분류
   */
  classifyConflictType(anchor1, anchor2) {
    if (anchor1.category !== anchor2.category) return 'category_mismatch';
    if (Math.abs(anchor1.position.start - anchor2.position.start) < 10) return 'position_overlap';
    return 'date_mismatch';
  }

  /**
   * 충돌 심각도 계산
   */
  calculateConflictSeverity(anchor1, anchor2) {
    let severity = 0.5;
    
    // 신뢰도 차이
    const confidenceDiff = Math.abs(anchor1.confidence - anchor2.confidence);
    severity += confidenceDiff * 0.3;
    
    // 우선순위 차이
    const priorityDiff = Math.abs(anchor1.priority - anchor2.priority);
    severity += (priorityDiff / 100) * 0.2;
    
    return Math.min(severity, 1.0);
  }

  /**
   * 개별 충돌 해결
   */
  async resolveConflict(conflict, context) {
    const strategies = ['confidence_based', 'medical_priority', 'temporal_logic', 'position_based'];
    
    for (const strategy of strategies) {
      const resolution = await this.resolutionStrategies[strategy](conflict, context);
      if (resolution.success) {
        console.log(`✅ 충돌 ${conflict.id} 해결: ${strategy}`);
        return {
          ...resolution,
          conflictId: conflict.id,
          strategy
        };
      }
    }
    
    console.warn(`⚠️ 충돌 ${conflict.id} 해결 실패`);
    return {
      success: false,
      conflictId: conflict.id,
      reason: 'no_strategy_succeeded'
    };
  }

  /**
   * 신뢰도 기반 해결
   */
  async resolveByConfidence(conflict, context) {
    const { forward, backward } = conflict;
    
    if (forward.confidence > backward.confidence + 0.1) {
      return {
        success: true,
        winner: forward,
        reason: 'higher_confidence',
        confidence: forward.confidence
      };
    }
    
    if (backward.confidence > forward.confidence + 0.1) {
      return {
        success: true,
        winner: backward,
        reason: 'higher_confidence',
        confidence: backward.confidence
      };
    }
    
    return { success: false, reason: 'confidence_too_close' };
  }

  /**
   * 의료 우선순위 기반 해결
   */
  async resolveByMedicalPriority(conflict, context) {
    const { forward, backward } = conflict;
    
    const forwardPriority = forward.medicalContext?.priority || 50;
    const backwardPriority = backward.medicalContext?.priority || 50;
    
    if (forwardPriority > backwardPriority + 10) {
      return {
        success: true,
        winner: forward,
        reason: 'higher_medical_priority',
        priority: forwardPriority
      };
    }
    
    if (backwardPriority > forwardPriority + 10) {
      return {
        success: true,
        winner: backward,
        reason: 'higher_medical_priority',
        priority: backwardPriority
      };
    }
    
    return { success: false, reason: 'medical_priority_too_close' };
  }

  /**
   * 시간적 논리 기반 해결
   */
  async resolveTemporalLogic(conflict, context) {
    const { forward, backward } = conflict;
    const referenceDate = context.referenceDate || new Date();
    
    const forwardDate = new Date(forward.normalized.date);
    const backwardDate = new Date(backward.normalized.date);
    
    // 미래 날짜 제거
    const forwardIsFuture = forwardDate > referenceDate;
    const backwardIsFuture = backwardDate > referenceDate;
    
    if (forwardIsFuture && !backwardIsFuture) {
      return {
        success: true,
        winner: backward,
        reason: 'eliminated_future_date'
      };
    }
    
    if (backwardIsFuture && !forwardIsFuture) {
      return {
        success: true,
        winner: forward,
        reason: 'eliminated_future_date'
      };
    }
    
    // 너무 오래된 날짜 제거 (10년 이상)
    const tenYearsAgo = new Date(referenceDate);
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    
    const forwardTooOld = forwardDate < tenYearsAgo;
    const backwardTooOld = backwardDate < tenYearsAgo;
    
    if (forwardTooOld && !backwardTooOld) {
      return {
        success: true,
        winner: backward,
        reason: 'eliminated_too_old_date'
      };
    }
    
    if (backwardTooOld && !forwardTooOld) {
      return {
        success: true,
        winner: forward,
        reason: 'eliminated_too_old_date'
      };
    }
    
    return { success: false, reason: 'both_dates_valid' };
  }

  /**
   * 위치 기반 해결
   */
  async resolveByPosition(conflict, context) {
    const { forward, backward } = conflict;
    
    // Forward sweep가 더 정확한 위치 정보를 가진다고 가정
    if (forward.sweep === 'forward' && backward.sweep === 'backward') {
      return {
        success: true,
        winner: forward,
        reason: 'forward_sweep_priority'
      };
    }
    
    return { success: false, reason: 'no_position_advantage' };
  }

  /**
   * 해결된 앵커들 병합
   */
  mergeResolvedAnchors(forwardAnchors, backwardAnchors, resolved) {
    const winners = new Set(resolved.filter(r => r.success).map(r => r.winner.id));
    const conflictIds = new Set();
    
    // 충돌에 관련된 모든 앵커 ID 수집
    resolved.forEach(r => {
      if (r.success) {
        conflictIds.add(r.winner.id === r.conflictId.split('_')[1] ? r.conflictId.split('_')[2] : r.conflictId.split('_')[1]);
      }
    });
    
    // 승자와 충돌하지 않은 앵커들만 포함
    const finalAnchors = [];
    
    [...forwardAnchors, ...backwardAnchors].forEach(anchor => {
      if (winners.has(anchor.id) || !conflictIds.has(anchor.id)) {
        finalAnchors.push(anchor);
      }
    });
    
    return finalAnchors;
  }
}

/**
 * Unified Confidence Calculator 클래스
 * 통합된 신뢰도 계산 시스템
 */
class UnifiedConfidenceCalculator {
  constructor() {
    this.weights = {
      textClarity: 0.3,
      contextStrength: 0.25,
      positionWeight: 0.2,
      evidenceSpan: 0.25
    };
    
    this.version = '1.0.0';
  }

  /**
   * 통합 신뢰도 계산
   */
  calculate(gene) {
    const factors = {
      textClarity: this.assessTextClarity(gene.content),
      contextStrength: this.assessContextStrength(gene.anchors),
      positionWeight: this.assessPositionWeight(gene.position),
      evidenceSpan: this.assessEvidenceSpan(gene.evidence)
    };

    const confidence = Object.keys(factors).reduce((sum, key) => {
      return sum + (factors[key] * this.weights[key]);
    }, 0);

    return {
      value: Math.min(Math.max(confidence, 0), 1),
      factors,
      evidence: gene.evidence,
      metadata: {
        calculatedAt: new Date(),
        method: 'unified_pipeline_v1',
        version: this.version
      }
    };
  }

  /**
   * 텍스트 명확성 평가
   */
  assessTextClarity(content) {
    if (!content) return 0;
    
    let clarity = 0.5;
    
    // 숫자 포함 여부
    if (/\d/.test(content)) clarity += 0.2;
    
    // 날짜 형식 명확성
    if (/\d{4}/.test(content)) clarity += 0.2; // 4자리 연도
    if (/\d{1,2}[월]/.test(content)) clarity += 0.1; // 월 표시
    if (/\d{1,2}[일]/.test(content)) clarity += 0.1; // 일 표시
    
    return Math.min(clarity, 1.0);
  }

  /**
   * 문맥 강도 평가
   */
  assessContextStrength(anchors) {
    if (!anchors || anchors.length === 0) return 0.3;
    
    let strength = 0.5;
    
    // 의료 키워드 존재
    const medicalKeywords = ['진료', '검사', '치료', '진단', '처방', '내원'];
    const hasmedicalContext = anchors.some(anchor => 
      medicalKeywords.some(keyword => anchor.context?.includes(keyword))
    );
    
    if (hasmedicalContext) strength += 0.3;
    
    // 앵커 개수에 따른 보정
    strength += Math.min(anchors.length * 0.1, 0.2);
    
    return Math.min(strength, 1.0);
  }

  /**
   * 위치 가중치 평가
   */
  assessPositionWeight(position) {
    if (!position) return 0.5;
    
    // 텍스트 앞부분에 있을수록 높은 가중치
    const relativePosition = position.start / (position.end || position.start + 100);
    return Math.max(0.3, 1.0 - relativePosition * 0.5);
  }

  /**
   * 증거 범위 평가
   */
  assessEvidenceSpan(evidence) {
    if (!evidence) return 0.4;
    
    let span = 0.5;
    
    // 증거 텍스트 길이
    if (evidence.rawText) {
      const length = evidence.rawText.length;
      if (length > 10) span += 0.2;
      if (length > 20) span += 0.1;
    }
    
    // 문맥 정보 존재
    if (evidence.context && evidence.context.length > 20) {
      span += 0.2;
    }
    
    return Math.min(span, 1.0);
  }
}

/**
 * Evidence Tracker 클래스
 * 증거 추적 및 관리 시스템
 */
class EvidenceTracker {
  constructor() {
    this.evidenceStore = new Map();
  }

  /**
   * 증거 추적
   */
  trackEvidence(gene, originalText) {
    const evidence = {
      startPos: this.findStartPosition(gene.content, originalText),
      endPos: this.findEndPosition(gene.content, originalText),
      rawText: gene.content,
      context: this.extractContext(gene.content, originalText, 100),
      confidence: this.assessEvidenceQuality(gene.content, originalText),
      timestamp: new Date(),
      metadata: {
        textLength: originalText.length,
        geneLength: gene.content.length,
        contextWindow: 100
      }
    };
    
    this.evidenceStore.set(gene.id || 'unknown', evidence);
    return evidence;
  }

  /**
   * 시작 위치 찾기
   */
  findStartPosition(content, text) {
    const index = text.indexOf(content);
    return index !== -1 ? index : 0;
  }

  /**
   * 종료 위치 찾기
   */
  findEndPosition(content, text) {
    const startPos = this.findStartPosition(content, text);
    return startPos + content.length;
  }

  /**
   * 문맥 추출
   */
  extractContext(content, text, windowSize) {
    const startPos = this.findStartPosition(content, text);
    const contextStart = Math.max(0, startPos - windowSize);
    const contextEnd = Math.min(text.length, startPos + content.length + windowSize);
    
    return text.substring(contextStart, contextEnd);
  }

  /**
   * 증거 품질 평가
   */
  assessEvidenceQuality(content, text) {
    let quality = 0.5;
    
    // 내용 길이
    if (content.length > 5) quality += 0.1;
    if (content.length > 10) quality += 0.1;
    
    // 텍스트 내 위치
    const position = text.indexOf(content);
    const relativePosition = position / text.length;
    
    // 앞부분에 있으면 더 중요
    if (relativePosition < 0.3) quality += 0.2;
    else if (relativePosition < 0.6) quality += 0.1;
    
    // 주변 문맥의 의료 관련성
    const context = this.extractContext(content, text, 50);
    const medicalKeywords = ['진료', '검사', '치료', '진단', '처방', '내원', '병원'];
    const medicalCount = medicalKeywords.filter(keyword => context.includes(keyword)).length;
    
    quality += medicalCount * 0.05;
    
    return Math.min(quality, 1.0);
  }

  /**
   * 저장된 증거 조회
   */
  getEvidence(geneId) {
    return this.evidenceStore.get(geneId);
  }

  /**
   * 모든 증거 조회
   */
  getAllEvidence() {
    return Array.from(this.evidenceStore.entries()).map(([id, evidence]) => ({
      geneId: id,
      ...evidence
    }));
  }

  /**
   * 증거 통계
   */
  getEvidenceStats() {
    const evidences = this.getAllEvidence();
    
    if (evidences.length === 0) {
      return {
        total: 0,
        averageConfidence: 0,
        averageLength: 0
      };
    }
    
    const totalConfidence = evidences.reduce((sum, e) => sum + e.confidence, 0);
    const totalLength = evidences.reduce((sum, e) => sum + e.rawText.length, 0);
    
    return {
      total: evidences.length,
      averageConfidence: totalConfidence / evidences.length,
      averageLength: totalLength / evidences.length,
      highQualityCount: evidences.filter(e => e.confidence > 0.8).length
    };
  }
}

// 기본 내보내기
export { EnhancedDateAnchor, ConflictResolver, UnifiedConfidenceCalculator, EvidenceTracker };