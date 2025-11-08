/**
 * 의료문서 중첩 날짜 해결기
 * 
 * 복잡한 시간적 표현들을 분석하고 정규화하여
 * 정확한 시간적 앵커를 제공합니다.
 * 
 * 예시:
 * "2023년부터 당뇨약 복용 중, 금일 검사에서..."
 * → 기준날짜: 2023년, 상대날짜: 금일(오늘)
 */

export class NestedDateResolver {
  constructor() {
    // 날짜 패턴 정의
    this.datePatterns = {
      // 절대 날짜 패턴
      absolute: [
        /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
        /(\d{4})-(\d{1,2})-(\d{1,2})/g,
        /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/g
      ],
      
      // 상대 날짜 패턴
      relative: [
        /(금일|오늘|당일)/g,
        /(어제|yesterday)/g,
        /(내일|tomorrow)/g,
        /(\d+)일\s*(전|후|뒤)/g,
        /(\d+)주\s*(전|후|뒤)/g,
        /(\d+)개월\s*(전|후|뒤)/g,
        /(\d+)년\s*(전|후|뒤)/g
      ],
      
      // 기간 패턴
      duration: [
        /(\d{4})년\s*(\d{1,2})월부터/g,
        /(\d{4})년부터/g,
        /(\d+)일간/g,
        /(\d+)주간/g,
        /(\d+)개월간/g,
        /(\d+)년간/g
      ],
      
      // 모호한 표현
      ambiguous: [
        /(최근|근래)/g,
        /(과거|예전)/g,
        /(이전|전에)/g,
        /(이후|후에)/g,
        /(평소|평상시)/g
      ]
    };
    
    // 의료 맥락별 시간 해석
    this.medicalTimeContext = {
      diagnosis: {
        // 진단 관련 시간 해석
        priority: ['진단일', '발병일', '증상 시작일'],
        defaultDuration: 'single_event'
      },
      medication: {
        // 복용 관련 시간 해석
        priority: ['처방일', '복용 시작일', '복용 기간'],
        defaultDuration: 'ongoing'
      },
      examination: {
        // 검사 관련 시간 해석
        priority: ['검사일', '결과일'],
        defaultDuration: 'single_event'
      },
      symptom: {
        // 증상 관련 시간 해석
        priority: ['증상 시작일', '증상 지속기간'],
        defaultDuration: 'variable'
      }
    };
    
    // 시간 우선순위 규칙
    this.priorityRules = {
      // 가장 구체적인 날짜가 최우선
      specificity: {
        'YYYY-MM-DD': 100,
        'YYYY-MM': 80,
        'YYYY': 60,
        'relative_specific': 70,  // "3일 전"
        'relative_general': 40,   // "최근"
        'ambiguous': 20
      },
      
      // 의료 맥락별 우선순위
      medical_context: {
        'diagnosis': 90,
        'examination': 85,
        'medication': 75,
        'symptom': 70,
        'general': 50
      }
    };
    
    // 처리 통계
    this.stats = {
      totalProcessed: 0,
      resolvedDates: 0,
      ambiguousCount: 0,
      conflictCount: 0,
      averageResolutionTime: 0
    };
  }

  /**
   * 텍스트에서 중첩 날짜를 해결합니다.
   * @param {string} text - 분석할 텍스트
   * @param {Object} context - 컨텍스트 정보
   * @returns {Promise<Object>} 해결된 날짜 정보
   */
  async resolveNestedDates(text, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('📅 중첩 날짜 해결 시작...');
      
      // 1. 모든 날짜 표현 추출
      const dateExpressions = this.extractDateExpressions(text);
      console.log(`📝 날짜 표현 ${dateExpressions.length}개 추출`);
      
      // 2. 각 표현을 정규화
      const normalizedDates = this.normalizeDateExpressions(dateExpressions, context);
      console.log(`🔄 정규화된 날짜 ${normalizedDates.length}개`);
      
      // 3. 시간적 관계 분석
      const temporalRelations = this.analyzeTemporalRelations(normalizedDates, text);
      console.log(`🔗 시간적 관계 ${temporalRelations.length}개 발견`);
      
      // 4. 모호성 해결
      const resolvedDates = this.resolveAmbiguity(normalizedDates, temporalRelations, context);
      console.log(`✅ 모호성 해결 완료`);
      
      // 5. 시간 계층 구축
      const timeHierarchy = this.buildTimeHierarchy(resolvedDates, temporalRelations);
      
      // 6. 의료 컨텍스트 적용
      const medicalTimeline = this.applyMedicalContext(timeHierarchy, text, context);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: true,
        processingTime,
        input: {
          textLength: text.length,
          context
        },
        extracted: {
          rawExpressions: dateExpressions,
          normalizedDates,
          temporalRelations
        },
        resolved: {
          dates: resolvedDates,
          timeHierarchy,
          medicalTimeline
        },
        analysis: {
          totalDates: resolvedDates.length,
          ambiguousResolved: this.countAmbiguousResolved(dateExpressions, resolvedDates),
          conflictsResolved: this.countConflictsResolved(temporalRelations),
          confidenceScore: this.calculateConfidenceScore(resolvedDates)
        },
        stats: this.updateStats(processingTime, resolvedDates.length)
      };
      
      console.log(`✅ 중첩 날짜 해결 완료 (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      console.error('❌ 중첩 날짜 해결 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 텍스트에서 모든 날짜 표현을 추출합니다.
   */
  extractDateExpressions(text) {
    const expressions = [];
    let expressionId = 0;
    
    // 각 패턴별로 매칭
    Object.entries(this.datePatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          // match가 유효한지 확인
          if (!match || match.index === undefined) {
            continue;
          }
          
          expressions.push({
            id: `expr_${expressionId++}`,
            category,
            text: match[0],
            match: match,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            confidence: this.calculatePatternConfidence(category, match[0])
          });
        }
      });
    });
    
    // 위치순으로 정렬
    return expressions.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * 날짜 표현을 정규화합니다.
   */
  normalizeDateExpressions(expressions, context) {
    const referenceDate = context.referenceDate || new Date();
    
    return expressions.map(expr => {
      let normalizedDate = null;
      let dateType = 'unknown';
      let precision = 'day';
      
      try {
        switch (expr.category) {
          case 'absolute':
            normalizedDate = this.parseAbsoluteDate(expr.match);
            dateType = 'absolute';
            precision = this.determinePrecision(expr.text);
            break;
            
          case 'relative':
            normalizedDate = this.parseRelativeDate(expr.match, referenceDate);
            dateType = 'relative';
            precision = 'day';
            break;
            
          case 'duration':
            normalizedDate = this.parseDuration(expr.match, referenceDate);
            dateType = 'duration';
            precision = this.determineDurationPrecision(expr.text);
            break;
            
          case 'ambiguous':
            normalizedDate = this.parseAmbiguousDate(expr.match, referenceDate, context);
            dateType = 'ambiguous';
            precision = 'approximate';
            break;
        }
      } catch (error) {
        console.warn(`날짜 파싱 실패: ${expr.text}`, error);
      }
      
      return {
        ...expr,
        normalized: {
          date: normalizedDate,
          dateType,
          precision,
          confidence: this.calculateNormalizationConfidence(normalizedDate, expr.category)
        }
      };
    });
  }

  /**
   * 시간적 관계를 분석합니다.
   */
  analyzeTemporalRelations(normalizedDates, text) {
    const relations = [];
    
    for (let i = 0; i < normalizedDates.length; i++) {
      for (let j = i + 1; j < normalizedDates.length; j++) {
        const relation = this.determineTemporalRelation(
          normalizedDates[i], 
          normalizedDates[j], 
          text
        );
        if (relation) {
          relations.push(relation);
        }
      }
    }
    
    return relations;
  }

  /**
   * 모호성을 해결합니다.
   */
  resolveAmbiguity(normalizedDates, temporalRelations, context) {
    return normalizedDates.map(dateExpr => {
      if (dateExpr.category === 'ambiguous' || dateExpr.normalized.confidence < 0.7) {
        // 컨텍스트 기반 해결
        const contextualDate = this.resolveFromContext(dateExpr, context, temporalRelations);
        if (contextualDate) {
          return {
            ...dateExpr,
            resolved: contextualDate,
            resolutionMethod: 'contextual'
          };
        }
        
        // 관계 기반 해결
        const relationalDate = this.resolveFromRelations(dateExpr, temporalRelations);
        if (relationalDate) {
          return {
            ...dateExpr,
            resolved: relationalDate,
            resolutionMethod: 'relational'
          };
        }
      }
      
      return {
        ...dateExpr,
        resolved: dateExpr.normalized,
        resolutionMethod: 'direct'
      };
    });
  }

  /**
   * 시간 계층을 구축합니다.
   */
  buildTimeHierarchy(resolvedDates, temporalRelations) {
    // 날짜순으로 정렬
    const sortedDates = resolvedDates
      .filter(d => d.resolved && d.resolved.date)
      .sort((a, b) => new Date(a.resolved.date) - new Date(b.resolved.date));
    
    // 시간 클러스터 생성
    const timeClusters = this.createTimeClusters(sortedDates);
    
    // 충돌 탐지
    const conflicts = this.detectTimeConflicts(temporalRelations);
    
    return {
      timeline: sortedDates.map(date => ({
        date: date.resolved.date,
        expression: date.text,
        confidence: date.resolved.confidence,
        precision: date.resolved.precision,
        type: date.resolved.dateType
      })),
      clusters: timeClusters,
      conflicts: conflicts,
      hierarchy: this.constructHierarchy(sortedDates, temporalRelations)
    };
  }

  /**
   * 의료 컨텍스트를 적용합니다.
   */
  applyMedicalContext(timeHierarchy, text, context) {
    const medicalEvents = this.identifyMedicalEvents(text);
    
    return {
      medicalTimeline: timeHierarchy.timeline.map(timePoint => {
        const relatedEvents = medicalEvents.filter(event => 
          this.isTemporallyRelated(timePoint, event)
        );
        
        return {
          ...timePoint,
          medicalEvents: relatedEvents,
          medicalContext: this.determineMedicalContext(relatedEvents),
          clinicalSignificance: this.calculateClinicalSignificance(timePoint, relatedEvents)
        };
      }),
      
      eventSequence: this.constructEventSequence(timeHierarchy.timeline, medicalEvents),
      
      treatmentHistory: this.extractTreatmentHistory(timeHierarchy.timeline, text),
      
      diseaseProgression: this.analyzeDiseaseProgression(timeHierarchy.timeline, medicalEvents)
    };
  }

  /**
   * 유틸리티 메서드들
   */
  parseAbsoluteDate(match) {
    // YYYY-MM-DD 형식으로 변환
    if (match[1] && match[2] && match[3]) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  parseRelativeDate(match, referenceDate) {
    const text = match[0];
    const refDate = new Date(referenceDate);
    
    if (text.includes('금일') || text.includes('오늘')) {
      return refDate.toISOString().split('T')[0];
    }
    
    if (text.includes('어제')) {
      refDate.setDate(refDate.getDate() - 1);
      return refDate.toISOString().split('T')[0];
    }
    
    // 숫자 기반 상대 날짜
    const numMatch = text.match(/(\d+)(일|주|개월|년)\s*(전|후)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      const unit = numMatch[2];
      const direction = numMatch[3] === '전' ? -1 : 1;
      
      switch (unit) {
        case '일':
          refDate.setDate(refDate.getDate() + (num * direction));
          break;
        case '주':
          refDate.setDate(refDate.getDate() + (num * 7 * direction));
          break;
        case '개월':
          refDate.setMonth(refDate.getMonth() + (num * direction));
          break;
        case '년':
          refDate.setFullYear(refDate.getFullYear() + (num * direction));
          break;
      }
      
      return refDate.toISOString().split('T')[0];
    }
    
    return null;
  }

  parseDuration(match, referenceDate) {
    // 기간의 시작점 추정
    return this.parseRelativeDate(match, referenceDate);
  }

  parseAmbiguousDate(match, referenceDate, context) {
    const text = match[0];
    const refDate = new Date(referenceDate);
    
    // 컨텍스트 기반 추정
    if (text.includes('최근')) {
      refDate.setMonth(refDate.getMonth() - 1); // 1개월 전으로 추정
      return refDate.toISOString().split('T')[0];
    }
    
    if (text.includes('과거')) {
      refDate.setFullYear(refDate.getFullYear() - 1); // 1년 전으로 추정
      return refDate.toISOString().split('T')[0];
    }
    
    return null;
  }

  calculatePatternConfidence(category, text) {
    const confidenceMap = {
      absolute: 0.95,
      relative: 0.8,
      duration: 0.75,
      ambiguous: 0.4
    };
    
    return confidenceMap[category] || 0.5;
  }

  calculateNormalizationConfidence(normalizedDate, category) {
    if (!normalizedDate) return 0;
    
    const baseConfidence = this.calculatePatternConfidence(category, '');
    return normalizedDate ? baseConfidence : 0;
  }

  determinePrecision(text) {
    if (text.includes('일')) return 'day';
    if (text.includes('월')) return 'month';
    if (text.includes('년')) return 'year';
    return 'day';
  }

  determineDurationPrecision(text) {
    return this.determinePrecision(text);
  }

  determineTemporalRelation(date1, date2, text) {
    const d1 = new Date(date1.normalized.date);
    const d2 = new Date(date2.normalized.date);
    
    let relationType = 'unknown';
    let confidence = 0.5;
    
    if (d1 < d2) {
      relationType = 'before';
      confidence = 0.8;
    } else if (d1 > d2) {
      relationType = 'after';
      confidence = 0.8;
    } else {
      relationType = 'simultaneous';
      confidence = 0.9;
    }
    
    return {
      id: `rel_${date1.id}_${date2.id}`,
      date1Id: date1.id,
      date2Id: date2.id,
      relationType,
      confidence,
      textEvidence: this.findTextEvidence(date1, date2, text)
    };
  }

  resolveFromContext(dateExpr, context, relations) {
    // 컨텍스트 기반 해결 로직
    return null;
  }

  resolveFromRelations(dateExpr, relations) {
    // 관계 기반 해결 로직
    return null;
  }

  createTimeClusters(sortedDates) {
    const clusters = [];
    const threshold = 7; // 7일 이내는 같은 클러스터
    
    let currentCluster = [];
    
    for (let i = 0; i < sortedDates.length; i++) {
      if (currentCluster.length === 0) {
        currentCluster.push(sortedDates[i]);
      } else {
        const lastDate = new Date(currentCluster[currentCluster.length - 1].resolved.date);
        const currentDate = new Date(sortedDates[i].resolved.date);
        const daysDiff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= threshold) {
          currentCluster.push(sortedDates[i]);
        } else {
          clusters.push([...currentCluster]);
          currentCluster = [sortedDates[i]];
        }
      }
    }
    
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }
    
    return clusters;
  }

  detectTimeConflicts(relations) {
    return relations.filter(rel => rel.confidence < 0.6);
  }

  constructHierarchy(sortedDates, relations) {
    return {
      root: sortedDates[0] || null,
      branches: sortedDates.slice(1),
      relations: relations
    };
  }

  identifyMedicalEvents(text) {
    const events = [];
    const medicalKeywords = [
      '진단', '처방', '검사', '수술', '치료', '복용', '투약',
      '증상', '소견', '결과', '관찰', '추적'
    ];
    
    medicalKeywords.forEach(keyword => {
      const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        // match가 유효한지 확인
        if (!match || match.index === undefined) {
          continue;
        }
        
        events.push({
          type: keyword,
          text: match[0].trim(),
          startIndex: match.index
        });
      }
    });
    
    return events;
  }

  isTemporallyRelated(timePoint, event) {
    // 시간적 관련성 판단 로직
    return Math.abs(timePoint.startIndex - event.startIndex) < 100;
  }

  determineMedicalContext(events) {
    if (events.length === 0) return 'general';
    
    const eventTypes = events.map(e => e.type);
    
    if (eventTypes.includes('진단')) return 'diagnosis';
    if (eventTypes.includes('처방') || eventTypes.includes('복용')) return 'medication';
    if (eventTypes.includes('검사')) return 'examination';
    if (eventTypes.includes('증상')) return 'symptom';
    
    return 'general';
  }

  calculateClinicalSignificance(timePoint, events) {
    let significance = 0.5; // 기본값
    
    events.forEach(event => {
      switch (event.type) {
        case '진단':
          significance += 0.3;
          break;
        case '수술':
          significance += 0.4;
          break;
        case '검사':
          significance += 0.2;
          break;
        case '처방':
          significance += 0.1;
          break;
      }
    });
    
    return Math.min(1.0, significance);
  }

  constructEventSequence(timeline, events) {
    return timeline.map(timePoint => ({
      date: timePoint.date,
      events: events.filter(event => 
        this.isTemporallyRelated(timePoint, event)
      )
    }));
  }

  extractTreatmentHistory(timeline, text) {
    const treatments = timeline.filter(point => 
      point.medicalContext === 'medication' || 
      (point.text && point.text.includes('치료')) || 
      (point.text && point.text.includes('처방'))
    );
    
    return treatments.map(treatment => ({
      date: treatment.date,
      treatment: treatment.expression,
      confidence: treatment.confidence
    }));
  }

  analyzeDiseaseProgression(timeline, events) {
    const progressionEvents = events.filter(event => 
      ['진단', '증상', '치료', '검사'].includes(event.type)
    );
    
    return {
      stages: progressionEvents.map((event, index) => ({
        stage: index + 1,
        type: event.type,
        description: event.text,
        estimatedDate: timeline[index]?.date || null
      })),
      progression: progressionEvents.length > 1 ? 'multiple_stages' : 'single_event'
    };
  }

  countAmbiguousResolved(original, resolved) {
    const originalAmbiguous = original.filter(d => d.category === 'ambiguous').length;
    const resolvedAmbiguous = resolved.filter(d => 
      d.resolutionMethod === 'contextual' || d.resolutionMethod === 'relational'
    ).length;
    
    return { original: originalAmbiguous, resolved: resolvedAmbiguous };
  }

  countConflictsResolved(relations) {
    const conflicts = relations.filter(r => r.confidence < 0.6).length;
    return { total: relations.length, conflicts };
  }

  calculateConfidenceScore(resolvedDates) {
    if (resolvedDates.length === 0) return 0;
    
    const totalConfidence = resolvedDates.reduce((sum, date) => 
      sum + (date.resolved.confidence || 0), 0
    );
    
    return totalConfidence / resolvedDates.length;
  }

  updateStats(processingTime, resolvedCount) {
    this.stats.totalProcessed++;
    this.stats.resolvedDates += resolvedCount;
    this.stats.averageResolutionTime = (
      (this.stats.averageResolutionTime * (this.stats.totalProcessed - 1) + processingTime) / 
      this.stats.totalProcessed
    );
    
    return { ...this.stats };
  }

  findTextEvidence(date1, date2, text) {
    // 텍스트에서 두 날짜 사이의 관계를 나타내는 증거 찾기
    const start = Math.min(date1.startIndex, date2.startIndex);
    const end = Math.max(date1.endIndex, date2.endIndex);
    
    return text.substring(Math.max(0, start - 50), Math.min(text.length, end + 50));
  }
}

export default NestedDateResolver;