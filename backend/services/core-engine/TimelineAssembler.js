// TimelineAssembler.js - 시간순 이벤트 조립 및 타임라인 구성 컴포넌트
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

export default class TimelineAssembler {
    constructor(options = {}) {
        this.options = {
            maxTimelineGap: options.maxTimelineGap || 365, // 최대 타임라인 간격 (일)
            minConfidenceThreshold: options.minConfidenceThreshold || 0.3,
            enableTemporalInference: options.enableTemporalInference || true,
            groupingStrategy: options.groupingStrategy || 'date', // 'date', 'visit', 'episode'
            ...options
        };
        
        this.temporalRelations = this.initializeTemporalRelations();
        
        logService.info('TimelineAssembler initialized', { options: this.options });
    }

    /**
     * 메인 타임라인 조립 함수
     * @param {Array} anchors - AnchorDetector에서 탐지된 시간 앵커들
     * @param {Array} entities - EntityNormalizer에서 정규화된 엔티티들
     * @returns {Object} 조립된 타임라인 결과
     */
    async assemble(anchors, entities) {
        try {
            const startTime = Date.now();
            
            // 1. 시간 앵커 검증 및 정렬
            const validatedAnchors = await this.validateAndSortAnchors(anchors);
            
            // 2. 엔티티-앵커 매핑 강화
            const mappedEntities = await this.enhanceEntityAnchorMapping(entities, validatedAnchors);
            
            // 3. 시간적 이벤트 생성
            const temporalEvents = await this.createTemporalEvents(mappedEntities, validatedAnchors);
            
            // 4. 타임라인 구성
            const timeline = await this.constructTimeline(temporalEvents);
            
            // 5. 시간적 관계 분석
            const analyzedTimeline = await this.analyzeTemporalRelations(timeline);
            
            // 6. 타임라인 검증 및 보정
            const validatedTimeline = await this.validateAndCorrectTimeline(analyzedTimeline);
            
            const processingTime = Date.now() - startTime;
            
            const result = {
                timeline: validatedTimeline,
                events: temporalEvents,
                statistics: {
                    totalEvents: temporalEvents.length,
                    timelineSpan: this.calculateTimelineSpan(validatedTimeline),
                    confidenceDistribution: this.calculateConfidenceDistribution(temporalEvents),
                    processingTimeMs: processingTime
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    component: 'TimelineAssembler',
                    groupingStrategy: this.options.groupingStrategy
                }
            };
            
            logService.info('Timeline assembly completed', { 
                totalEvents: result.statistics.totalEvents,
                timelineSpan: result.statistics.timelineSpan,
                processingTime 
            });
            
            return result;
            
        } catch (error) {
            logService.error('Timeline assembly failed', { error: error.message });
            throw new Error(`TimelineAssembler failed: ${error.message}`);
        }
    }

    /**
     * 시간 앵커 검증 및 정렬
     */
    async validateAndSortAnchors(anchors) {
        const validAnchors = anchors.filter(anchor => {
            // 신뢰도 임계값 확인
            if (anchor.confidence < this.options.minConfidenceThreshold) {
                return false;
            }
            
            // 날짜 유효성 확인
            if (!anchor.normalizedDate || !this.isValidDate(anchor.normalizedDate)) {
                return false;
            }
            
            // 미래 날짜 필터링 (현재 날짜 + 30일 이후)
            const futureThreshold = new Date();
            futureThreshold.setDate(futureThreshold.getDate() + 30);
            if (new Date(anchor.normalizedDate) > futureThreshold) {
                return false;
            }
            
            return true;
        });
        
        // 날짜순 정렬
        return validAnchors.sort((a, b) => 
            new Date(a.normalizedDate) - new Date(b.normalizedDate)
        );
    }

    /**
     * 엔티티-앵커 매핑 강화
     */
    async enhanceEntityAnchorMapping(entities, anchors) {
        return entities.map(entity => {
            // 기존 연결된 앵커가 있으면 유지
            if (entity.linkedAnchor) {
                return entity;
            }
            
            // 새로운 앵커 매핑 시도
            const bestAnchor = this.findBestAnchorForEntity(entity, anchors);
            
            return {
                ...entity,
                linkedAnchor: bestAnchor,
                temporalContext: bestAnchor ? {
                    date: bestAnchor.normalizedDate,
                    type: bestAnchor.type,
                    confidence: bestAnchor.confidence,
                    mappingMethod: 'enhanced'
                } : entity.temporalContext
            };
        });
    }

    /**
     * 시간적 이벤트 생성
     */
    async createTemporalEvents(entities, anchors) {
        const events = [];
        
        // 앵커 기반 이벤트 생성
        for (const anchor of anchors) {
            const relatedEntities = entities.filter(entity => 
                entity.linkedAnchor && entity.linkedAnchor.id === anchor.id
            );
            
            if (relatedEntities.length > 0) {
                const event = {
                    id: `event_${anchor.id}`,
                    date: anchor.normalizedDate,
                    type: anchor.type,
                    anchor: anchor,
                    entities: relatedEntities,
                    confidence: this.calculateEventConfidence(anchor, relatedEntities),
                    context: anchor.context,
                    metadata: {
                        source: 'anchor-based',
                        entityCount: relatedEntities.length
                    }
                };
                
                events.push(event);
            }
        }
        
        // 고립된 엔티티들을 위한 추론 이벤트 생성
        if (this.options.enableTemporalInference) {
            const orphanEntities = entities.filter(entity => !entity.linkedAnchor);
            const inferredEvents = await this.createInferredEvents(orphanEntities, anchors);
            events.push(...inferredEvents);
        }
        
        return events.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * 타임라인 구성
     */
    async constructTimeline(events) {
        const timeline = [];
        
        switch (this.options.groupingStrategy) {
            case 'date':
                return this.groupEventsByDate(events);
            case 'visit':
                return this.groupEventsByVisit(events);
            case 'episode':
                return this.groupEventsByEpisode(events);
            default:
                return this.groupEventsByDate(events);
        }
    }

    /**
     * 날짜별 이벤트 그룹핑
     */
    groupEventsByDate(events) {
        const grouped = new Map();
        
        events.forEach(event => {
            const dateKey = event.date.split('T')[0]; // YYYY-MM-DD 형식
            
            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, {
                    date: dateKey,
                    events: [],
                    summary: {
                        totalEvents: 0,
                        eventTypes: new Set(),
                        avgConfidence: 0
                    }
                });
            }
            
            const group = grouped.get(dateKey);
            group.events.push(event);
            group.summary.totalEvents++;
            group.summary.eventTypes.add(event.type);
        });
        
        // 요약 정보 계산
        grouped.forEach(group => {
            group.summary.avgConfidence = group.events.reduce((sum, event) => 
                sum + event.confidence, 0) / group.events.length;
            group.summary.eventTypes = Array.from(group.summary.eventTypes);
        });
        
        return Array.from(grouped.values()).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
    }

    /**
     * 방문별 이벤트 그룹핑
     */
    groupEventsByVisit(events) {
        const visits = [];
        let currentVisit = null;
        const visitGapThreshold = 1; // 1일
        
        events.forEach(event => {
            const eventDate = new Date(event.date);
            
            if (!currentVisit || 
                (eventDate - new Date(currentVisit.endDate)) / (1000 * 60 * 60 * 24) > visitGapThreshold) {
                // 새로운 방문 시작
                currentVisit = {
                    id: `visit_${visits.length + 1}`,
                    startDate: event.date,
                    endDate: event.date,
                    events: [event],
                    type: 'visit'
                };
                visits.push(currentVisit);
            } else {
                // 기존 방문에 추가
                currentVisit.events.push(event);
                currentVisit.endDate = event.date;
            }
        });
        
        return visits;
    }

    /**
     * 에피소드별 이벤트 그룹핑
     */
    groupEventsByEpisode(events) {
        const episodes = [];
        const episodeGapThreshold = 30; // 30일
        
        // 진단 기반 에피소드 구성
        const diagnosisEvents = events.filter(event => 
            event.entities.some(entity => entity.type === 'diagnosis')
        );
        
        diagnosisEvents.forEach(diagnosisEvent => {
            const relatedEvents = events.filter(event => {
                const daysDiff = Math.abs(
                    (new Date(event.date) - new Date(diagnosisEvent.date)) / (1000 * 60 * 60 * 24)
                );
                return daysDiff <= episodeGapThreshold;
            });
            
            episodes.push({
                id: `episode_${episodes.length + 1}`,
                primaryDiagnosis: diagnosisEvent.entities.find(e => e.type === 'diagnosis'),
                startDate: Math.min(...relatedEvents.map(e => new Date(e.date))),
                endDate: Math.max(...relatedEvents.map(e => new Date(e.date))),
                events: relatedEvents,
                type: 'episode'
            });
        });
        
        return episodes;
    }

    /**
     * 시간적 관계 분석
     */
    async analyzeTemporalRelations(timeline) {
        const analyzedTimeline = timeline.map(timePoint => {
            const relations = [];
            
            // 이전/이후 관계 분석
            const prevIndex = timeline.indexOf(timePoint) - 1;
            const nextIndex = timeline.indexOf(timePoint) + 1;
            
            if (prevIndex >= 0) {
                relations.push({
                    type: 'follows',
                    target: timeline[prevIndex].date,
                    interval: this.calculateInterval(timeline[prevIndex].date, timePoint.date)
                });
            }
            
            if (nextIndex < timeline.length) {
                relations.push({
                    type: 'precedes',
                    target: timeline[nextIndex].date,
                    interval: this.calculateInterval(timePoint.date, timeline[nextIndex].date)
                });
            }
            
            // 인과관계 추론
            const causalRelations = this.inferCausalRelations(timePoint, timeline);
            relations.push(...causalRelations);
            
            return {
                ...timePoint,
                temporalRelations: relations
            };
        });
        
        return analyzedTimeline;
    }

    /**
     * 타임라인 검증 및 보정
     */
    async validateAndCorrectTimeline(timeline) {
        const corrected = [];
        
        for (const timePoint of timeline) {
            // 날짜 일관성 검증
            if (this.validateDateConsistency(timePoint)) {
                // 이벤트 신뢰도 재계산
                const recalculatedTimePoint = this.recalculateConfidence(timePoint);
                corrected.push(recalculatedTimePoint);
            } else {
                 logService.warn('Timeline inconsistency detected', { 
                     date: timePoint.date,
                     events: timePoint.events?.length || 0
                 });
             }
        }
        
        return corrected;
    }

    /**
     * 유틸리티 메서드들
     */
    findBestAnchorForEntity(entity, anchors) {
        if (!anchors || anchors.length === 0) return null;
        
        // 세그먼트 기반 매칭
        const sameSegmentAnchors = anchors.filter(anchor => 
            anchor.segmentId === entity.segmentId
        );
        
        if (sameSegmentAnchors.length > 0) {
            return sameSegmentAnchors.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
            );
        }
        
        // 거리 기반 매칭
        return anchors.reduce((best, current) => {
            const bestDistance = Math.abs(best.startIndex - entity.startIndex);
            const currentDistance = Math.abs(current.startIndex - entity.startIndex);
            return currentDistance < bestDistance ? current : best;
        });
    }

    calculateEventConfidence(anchor, entities) {
        const anchorWeight = 0.4;
        const entityWeight = 0.6;
        
        const anchorConfidence = anchor.confidence;
        const avgEntityConfidence = entities.reduce((sum, entity) => 
            sum + (entity.confidence || 0.5), 0) / entities.length;
        
        return (anchorConfidence * anchorWeight) + (avgEntityConfidence * entityWeight);
    }

    async createInferredEvents(orphanEntities, anchors) {
        const inferredEvents = [];
        
        // 가장 가까운 앵커를 기준으로 추론 이벤트 생성
        orphanEntities.forEach(entity => {
            const nearestAnchor = this.findBestAnchorForEntity(entity, anchors);
            
            if (nearestAnchor) {
                inferredEvents.push({
                    id: `inferred_${entity.id || Math.random().toString(36).substr(2, 9)}`,
                    date: nearestAnchor.normalizedDate,
                    type: 'inferred',
                    anchor: nearestAnchor,
                    entities: [entity],
                    confidence: Math.min(nearestAnchor.confidence * 0.7, 0.6), // 추론 이벤트는 신뢰도 감소
                    context: `Inferred from ${nearestAnchor.type}`,
                    metadata: {
                        source: 'temporal-inference',
                        entityCount: 1
                    }
                });
            }
        });
        
        return inferredEvents;
    }

    calculateInterval(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end - start;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        return {
            days: diffDays,
            weeks: Math.floor(diffDays / 7),
            months: Math.floor(diffDays / 30),
            years: Math.floor(diffDays / 365)
        };
    }

    inferCausalRelations(timePoint, timeline) {
        const relations = [];
        
        // 진단-치료 관계 추론
        const diagnoses = timePoint.events?.flatMap(event => 
            event.entities.filter(entity => entity.type === 'diagnosis')
        ) || [];
        
        if (diagnoses.length > 0) {
            // 이후 치료 이벤트 찾기
            const laterTimePoints = timeline.filter(tp => 
                new Date(tp.date) > new Date(timePoint.date)
            );
            
            laterTimePoints.forEach(laterTP => {
                const treatments = laterTP.events?.flatMap(event => 
                    event.entities.filter(entity => 
                        entity.type === 'procedure' || entity.type === 'medication'
                    )
                ) || [];
                
                if (treatments.length > 0) {
                    relations.push({
                        type: 'causes',
                        target: laterTP.date,
                        confidence: 0.6,
                        description: 'Diagnosis may have led to treatment'
                    });
                }
            });
        }
        
        return relations;
    }

    validateDateConsistency(timePoint) {
        // 기본 날짜 유효성 검사
        if (!timePoint.date || !this.isValidDate(timePoint.date)) {
            return false;
        }
        
        // 이벤트 내 일관성 검사
        if (timePoint.events) {
            return timePoint.events.every(event => 
                event.date === timePoint.date || 
                Math.abs(new Date(event.date) - new Date(timePoint.date)) < 24 * 60 * 60 * 1000 // 1일 이내
            );
        }
        
        return true;
    }

    recalculateConfidence(timePoint) {
        if (!timePoint.events || timePoint.events.length === 0) {
            return timePoint;
        }
        
        const avgConfidence = timePoint.events.reduce((sum, event) => 
            sum + event.confidence, 0) / timePoint.events.length;
        
        return {
            ...timePoint,
            confidence: avgConfidence,
            summary: {
                ...timePoint.summary,
                avgConfidence: avgConfidence
            }
        };
    }

    calculateTimelineSpan(timeline) {
        if (!timeline || timeline.length === 0) return null;
        
        const dates = timeline.map(tp => new Date(tp.date));
        const earliest = new Date(Math.min(...dates));
        const latest = new Date(Math.max(...dates));
        
        return {
            start: earliest.toISOString().split('T')[0],
            end: latest.toISOString().split('T')[0],
            durationDays: Math.floor((latest - earliest) / (1000 * 60 * 60 * 24))
        };
    }

    calculateConfidenceDistribution(events) {
        const distribution = { high: 0, medium: 0, low: 0 };
        
        events.forEach(event => {
            if (event.confidence >= 0.8) distribution.high++;
            else if (event.confidence >= 0.6) distribution.medium++;
            else distribution.low++;
        });
        
        return distribution;
    }

    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    initializeTemporalRelations() {
        return {
            'follows': 'temporal sequence',
            'precedes': 'temporal precedence',
            'causes': 'causal relationship',
            'concurrent': 'simultaneous occurrence'
        };
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'TimelineAssembler',
            timestamp: new Date().toISOString(),
            configuration: {
                maxTimelineGap: this.options.maxTimelineGap,
                minConfidenceThreshold: this.options.minConfidenceThreshold,
                groupingStrategy: this.options.groupingStrategy,
                temporalInference: this.options.enableTemporalInference
            }
        };
    }
}