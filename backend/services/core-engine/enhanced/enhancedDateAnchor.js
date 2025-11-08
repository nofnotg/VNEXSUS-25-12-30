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
 */

export class EnhancedDateAnchor {
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
   * Dual-Sweep Analysis 메인 메서드
   */
  async dualSweepAnalysis(text, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Dual-Sweep Anchoring 시작...');
      
      // 1. Forward Sweep: 순방향 분석
      const forwardAnchors = await this.forwardSweep(text, context);
      
      // 2. Backward Sweep: 역방향 검증
      const backwardAnchors = await this.backwardSweep(text, forwardAnchors, context);
      
      // 3. Conflict Resolution: 충돌 해결
      const resolvedAnchors = await this.resolveConflicts(forwardAnchors, backwardAnchors, text);
      
      // 4. Primary/Secondary Classification: 계층 분류
      const classifiedAnchors = this.classifyDateHierarchy(resolvedAnchors.resolved, text);
      
      // 5. Final Confidence Calculation: 최종 신뢰도 계산
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
   * Forward Sweep: 순방향 분석
   */
  async forwardSweep(text, context) {
    const anchors = [];
    
    for (const [category, patternGroup] of Object.entries(this.datePatterns)) {
      for (const pattern of patternGroup.patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          // match가 유효한지 확인
          if (!match || match.index === undefined) {
            continue;
          }
          
          const anchor = {
            id: `anchor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: match[0],
            category,
            groups: match.groups || {},
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            context: this.extractContext(text, match.index, 50),
            confidence: patternGroup.confidence,
            priority: patternGroup.priority,
            normalized: null,
            medicalContext: null
          };
          
          // 날짜 정규화
          anchor.normalized = this.normalizeDateAnchor(anchor, context);
          
          // 의료 맥락 분석
          anchor.medicalContext = this.analyzeMedicalContext(anchor, text);
          
          if (anchor.normalized.isValid) {
            anchors.push(anchor);
          }
        }
      }
    }
    
    return anchors.sort((a, b) => a.position.start - b.position.start);
  }

  /**
   * Backward Sweep: 역방향 검증
   */
  async backwardSweep(text, forwardAnchors, context) {
    const validationAnchors = [];
    
    // 역방향 패턴으로 검증
    const backwardPatterns = [
      /(?<validation>확인|검증|재확인)\s*(?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?/g,
      /(?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?\s*(?<validation>맞음|정확|확실)/g
    ];
    
    for (const pattern of backwardPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const anchor = {
          id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: match[0],
          category: 'backward_validation',
          groups: match.groups || {},
          position: {
            start: match.index,
            end: match.index + match[0].length
          },
          context: this.extractContext(text, match.index, 50),
          confidence: 0.9,
          priority: 95,
          normalized: null
        };
        
        anchor.normalized = this.normalizeDateAnchor(anchor, context);
        
        if (anchor.normalized.isValid) {
          validationAnchors.push(anchor);
        }
      }
    }
    
    return validationAnchors;
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
    
    if (!year) return null;
    
    const y = parseInt(year);
    const m = parseInt(month || '1');
    const d = parseInt(day || '1');
    
    // 2자리 연도 처리
    const fullYear = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
    
    if (!this.isValidDateComponents(fullYear, m, d)) {
      return null;
    }
    
    const date = new Date(fullYear, m - 1, d);
    return date.toISOString().split('T')[0];
  }

  /**
   * 상대 날짜 파싱
   */
  parseRelativeDate(groups, referenceDate) {
    const { reference, number, unit, direction } = groups;
    const refDate = new Date(referenceDate);
    
    if (reference) {
      switch (reference.toLowerCase()) {
        case '금일':
        case '오늘':
        case '당일':
        case '현재':
        case 'today':
          return refDate.toISOString().split('T')[0];
          
        case '어제':
        case 'yesterday':
          refDate.setDate(refDate.getDate() - 1);
          return refDate.toISOString().split('T')[0];
          
        case '내일':
        case 'tomorrow':
          refDate.setDate(refDate.getDate() + 1);
          return refDate.toISOString().split('T')[0];
      }
    }
    
    if (number && unit && direction) {
      const num = parseInt(number);
      const isBackward = direction.includes('전') || direction.includes('ago');
      const multiplier = isBackward ? -1 : 1;
      
      switch (unit) {
        case '일':
        case 'day':
          refDate.setDate(refDate.getDate() + (num * multiplier));
          break;
        case '주':
        case 'week':
          refDate.setDate(refDate.getDate() + (num * 7 * multiplier));
          break;
        case '개월':
        case 'month':
          refDate.setMonth(refDate.getMonth() + (num * multiplier));
          break;
        case '년':
        case 'year':
          refDate.setFullYear(refDate.getFullYear() + (num * multiplier));
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
   * 역방향 날짜 파싱
   */
  parseBackwardDate(groups) {
    return this.parseAbsoluteDate(groups);
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
   * 충돌 해결
   */
  async resolveConflicts(forwardAnchors, backwardAnchors, text) {
    const allAnchors = [...forwardAnchors, ...backwardAnchors];
    const conflicts = [];
    const resolved = [];
    
    // 충돌 감지
    for (let i = 0; i < allAnchors.length; i++) {
      for (let j = i + 1; j < allAnchors.length; j++) {
        const anchor1 = allAnchors[i];
        const anchor2 = allAnchors[j];
        
        if (this.detectConflict(anchor1, anchor2)) {
          conflicts.push({ anchor1, anchor2, type: 'date_conflict' });
        }
      }
    }
    
    // 충돌 해결
    const resolvedConflicts = [];
    for (const conflict of conflicts) {
      const resolution = await this.conflictResolver.resolve(conflict, text);
      resolvedConflicts.push(resolution);
      resolved.push(resolution.winner);
    }
    
    // 충돌하지 않는 앵커들 추가
    const conflictedIds = new Set();
    conflicts.forEach(c => {
      conflictedIds.add(c.anchor1.id);
      conflictedIds.add(c.anchor2.id);
    });
    
    allAnchors.forEach(anchor => {
      if (!conflictedIds.has(anchor.id)) {
        resolved.push(anchor);
      }
    });
    
    return {
      conflicts: resolvedConflicts,
      resolved
    };
  }

  /**
   * 충돌 감지
   */
  detectConflict(anchor1, anchor2) {
    // 위치 겹침 검사
    const pos1 = anchor1.position;
    const pos2 = anchor2.position;
    
    if (pos1.start < pos2.end && pos2.start < pos1.end) {
      return true;
    }
    
    // 날짜 논리 충돌 검사
    if (anchor1.normalized.isValid && anchor2.normalized.isValid) {
      const date1 = new Date(anchor1.normalized.date);
      const date2 = new Date(anchor2.normalized.date);
      const daysDiff = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
      
      // 같은 맥락에서 너무 다른 날짜
      if (daysDiff > 365 && this.isSameContext(anchor1, anchor2)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 최종 신뢰도 계산
   */
  async calculateFinalConfidence(classifiedAnchors, text) {
    const { primary, secondary } = classifiedAnchors;
    
    // Primary anchors 신뢰도 계산
    for (const anchor of primary) {
      anchor.finalConfidence = await this.confidenceCalculator.calculate(anchor, text, 'primary');
    }
    
    // Secondary anchors 신뢰도 계산
    for (const anchor of secondary) {
      anchor.finalConfidence = await this.confidenceCalculator.calculate(anchor, text, 'secondary');
    }
    
    return { primary, secondary };
  }

  /**
   * 근접 날짜 병합
   */
  mergeNearbyDates(anchors, thresholdDays = 7) {
    const { primary, secondary } = anchors;
    
    const mergePrimary = this.performDateMerging(primary, thresholdDays);
    const mergeSecondary = this.performDateMerging(secondary, thresholdDays);
    
    return {
      primary: mergePrimary,
      secondary: mergeSecondary
    };
  }

  /**
   * 날짜 병합 수행
   */
  performDateMerging(anchors, thresholdDays) {
    const merged = [];
    const processed = new Set();
    
    for (let i = 0; i < anchors.length; i++) {
      if (processed.has(i)) continue;
      
      const anchor = anchors[i];
      const group = [anchor];
      processed.add(i);
      
      // 근접한 날짜들 찾기
      for (let j = i + 1; j < anchors.length; j++) {
        if (processed.has(j)) continue;
        
        const other = anchors[j];
        const date1 = new Date(anchor.normalized.date);
        const date2 = new Date(other.normalized.date);
        const daysDiff = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= thresholdDays) {
          group.push(other);
          processed.add(j);
        }
      }
      
      // 그룹 병합
      if (group.length > 1) {
        const mergedAnchor = this.mergeAnchorGroup(group);
        merged.push(mergedAnchor);
      } else {
        merged.push(anchor);
      }
    }
    
    return merged;
  }

  /**
   * 앵커 그룹 병합
   */
  mergeAnchorGroup(group) {
    // 가장 높은 신뢰도의 앵커를 기준으로 병합
    const primary = group.reduce((best, current) => 
      (current.finalConfidence?.value || current.confidence) > (best.finalConfidence?.value || best.confidence) ? current : best
    );
    
    return {
      ...primary,
      mergedFrom: group.map(a => a.id),
      mergedCount: group.length,
      mergedConfidence: group.reduce((sum, a) => sum + (a.finalConfidence?.value || a.confidence), 0) / group.length
    };
  }

  // 유틸리티 메서드들
  extractContext(text, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  determinePrecision(groups) {
    if (groups.day) return 'day';
    if (groups.month) return 'month';
    if (groups.year) return 'year';
    return 'unknown';
  }

  calculateNormalizationConfidence(date, category) {
    if (!date) return 0;
    
    const baseConfidence = {
      'absolute': 0.95,
      'medical': 0.85,
      'relative': 0.75,
      'duration': 0.7,
      'backward_validation': 0.9
    };
    
    return baseConfidence[category] || 0.5;
  }

  validateDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 10, 0, 1);
    const maxDate = new Date(now.getFullYear() + 1, 11, 31);
    
    return date >= minDate && date <= maxDate;
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

  calculateHierarchyScore(anchor, text) {
    let score = 0;
    
    // 기본 신뢰도
    score += (anchor.finalConfidence?.value || anchor.confidence) * 50;
    
    // 의료 맥락 보너스
    if (anchor.medicalContext) {
      score += anchor.medicalContext.priority * 0.3;
    }
    
    // 위치 보너스 (문서 앞쪽일수록 높음)
    const positionRatio = 1 - (anchor.position.start / text.length);
    score += positionRatio * 20;
    
    return Math.min(100, score);
  }

  calculateClinicalSignificance(context, anchor) {
    let significance = 0.5;
    
    if (context.type === 'current_visit') significance = 0.9;
    else if (context.type === 'diagnosis') significance = 0.85;
    else if (context.type === 'treatment') significance = 0.8;
    else if (context.type === 'examination') significance = 0.75;
    
    return significance;
  }

  isSameContext(anchor1, anchor2) {
    const context1 = anchor1.medicalContext?.type || 'general';
    const context2 = anchor2.medicalContext?.type || 'general';
    return context1 === context2;
  }

  buildDateHierarchy(anchors) {
    return {
      primary: anchors.primary.map(a => ({
        id: a.id,
        date: a.normalized.date,
        confidence: a.finalConfidence?.value || a.confidence,
        context: a.medicalContext?.type || 'general'
      })),
      secondary: anchors.secondary.map(a => ({
        id: a.id,
        date: a.normalized.date,
        confidence: a.finalConfidence?.value || a.confidence,
        context: a.medicalContext?.type || 'general'
      }))
    };
  }

  calculateOverallConfidence(anchors) {
    const allAnchors = [...anchors.primary, ...anchors.secondary];
    if (allAnchors.length === 0) return 0;
    
    const totalConfidence = allAnchors.reduce((sum, a) => 
      sum + (a.finalConfidence?.value || a.confidence), 0
    );
    
    return totalConfidence / allAnchors.length;
  }

  extractEvidence(anchors, text) {
    const evidence = [];
    
    [...anchors.primary, ...anchors.secondary].forEach(anchor => {
      evidence.push({
        id: anchor.id,
        text: anchor.text,
        context: anchor.context,
        position: anchor.position,
        category: anchor.category,
        confidence: anchor.finalConfidence?.value || anchor.confidence
      });
    });
    
    return evidence;
  }

  updateStats(processingTime, conflictCount) {
    this.stats.totalProcessed++;
    this.stats.processingTime.push(processingTime);
    this.stats.conflictsResolved += conflictCount;
    
    return {
      totalProcessed: this.stats.totalProcessed,
      averageProcessingTime: this.stats.processingTime.reduce((a, b) => a + b, 0) / this.stats.processingTime.length,
      conflictsResolved: this.stats.conflictsResolved
    };
  }
}

/**
 * Conflict Resolution 클래스
 */
export class ConflictResolver {
  constructor() {
    this.resolutionStrategies = {
      'temporal_logic': this.resolveTemporalLogic.bind(this),
      'confidence_based': this.resolveByConfidence.bind(this),
      'medical_priority': this.resolveByMedicalPriority.bind(this),
      'position_based': this.resolveByPosition.bind(this)
    };
  }

  async resolve(conflict, text) {
    const { anchor1, anchor2 } = conflict;
    
    // 전략별 해결 시도
    for (const [strategy, resolver] of Object.entries(this.resolutionStrategies)) {
      const result = await resolver(anchor1, anchor2, text);
      if (result.resolved) {
        return {
          ...result,
          strategy,
          conflict
        };
      }
    }
    
    // 기본 해결: 신뢰도 기반
    return {
      resolved: true,
      winner: anchor1.confidence > anchor2.confidence ? anchor1 : anchor2,
      strategy: 'default_confidence',
      conflict
    };
  }

  async resolveTemporalLogic(anchor1, anchor2, text) {
    // 시간적 논리 검증
    const date1 = new Date(anchor1.normalized.date);
    const date2 = new Date(anchor2.normalized.date);
    const now = new Date();
    
    // 미래 날짜 제외
    if (date1 > now && date2 <= now) {
      return { resolved: true, winner: anchor2 };
    }
    if (date2 > now && date1 <= now) {
      return { resolved: true, winner: anchor1 };
    }
    
    return { resolved: false };
  }

  async resolveByConfidence(anchor1, anchor2, text) {
    const conf1 = anchor1.finalConfidence?.value || anchor1.confidence;
    const conf2 = anchor2.finalConfidence?.value || anchor2.confidence;
    
    if (Math.abs(conf1 - conf2) > 0.2) {
      return {
        resolved: true,
        winner: conf1 > conf2 ? anchor1 : anchor2
      };
    }
    
    return { resolved: false };
  }

  async resolveByMedicalPriority(anchor1, anchor2, text) {
    const priority1 = anchor1.medicalContext?.priority || 50;
    const priority2 = anchor2.medicalContext?.priority || 50;
    
    if (Math.abs(priority1 - priority2) > 10) {
      return {
        resolved: true,
        winner: priority1 > priority2 ? anchor1 : anchor2
      };
    }
    
    return { resolved: false };
  }

  async resolveByPosition(anchor1, anchor2, text) {
    // 문서 앞쪽에 있는 것을 우선
    if (Math.abs(anchor1.position.start - anchor2.position.start) > 100) {
      return {
        resolved: true,
        winner: anchor1.position.start < anchor2.position.start ? anchor1 : anchor2
      };
    }
    
    return { resolved: false };
  }
}

/**
 * Unified Confidence Calculator 클래스
 */
export class UnifiedConfidenceCalculator {
  async calculate(anchor, text, type) {
    const factors = {
      pattern: this.calculatePatternConfidence(anchor),
      context: this.calculateContextConfidence(anchor, text),
      medical: this.calculateMedicalConfidence(anchor),
      position: this.calculatePositionConfidence(anchor, text),
      validation: this.calculateValidationConfidence(anchor)
    };
    
    const weights = {
      primary: { pattern: 0.3, context: 0.25, medical: 0.25, position: 0.1, validation: 0.1 },
      secondary: { pattern: 0.25, context: 0.2, medical: 0.2, position: 0.15, validation: 0.2 }
    };
    
    const weight = weights[type] || weights.secondary;
    
    const finalValue = Object.entries(factors).reduce((sum, [factor, value]) => {
      return sum + (value * weight[factor]);
    }, 0);
    
    return {
      value: Math.min(1.0, Math.max(0.0, finalValue)),
      factors,
      weights: weight
    };
  }

  calculatePatternConfidence(anchor) {
    return anchor.confidence || 0.5;
  }

  calculateContextConfidence(anchor, text) {
    const contextLength = anchor.context.length;
    const medicalKeywords = ['진료', '검사', '치료', '진단', '처방'];
    const keywordCount = medicalKeywords.filter(k => anchor.context.includes(k)).length;
    
    return Math.min(1.0, 0.5 + (keywordCount * 0.1) + (contextLength / 200));
  }

  calculateMedicalConfidence(anchor) {
    if (!anchor.medicalContext) return 0.5;
    return anchor.medicalContext.clinicalSignificance || 0.5;
  }

  calculatePositionConfidence(anchor, text) {
    const positionRatio = anchor.position.start / text.length;
    return 1.0 - (positionRatio * 0.3); // 앞쪽일수록 높은 신뢰도
  }

  calculateValidationConfidence(anchor) {
    if (anchor.category === 'backward_validation') return 0.9;
    return 0.7;
  }
}

/**
 * Evidence Tracker 클래스
 */
export class EvidenceTracker {
  constructor() {
    this.evidence = [];
  }

  track(anchor, evidence) {
    this.evidence.push({
      anchorId: anchor.id,
      timestamp: new Date().toISOString(),
      evidence
    });
  }

  getEvidence(anchorId) {
    return this.evidence.filter(e => e.anchorId === anchorId);
  }

  getAllEvidence() {
    return this.evidence;
  }
}