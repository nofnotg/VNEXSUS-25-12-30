// QualityAssurance.js - 품질 보증 및 점수 측정 시스템
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../../utils/logger.js';

class QualityAssurance {
    constructor(options = {}) {
        this.options = {
            targetQualityScore: options.targetQualityScore || 70,
            enableRealTimeMonitoring: options.enableRealTimeMonitoring !== false,
            enableDetailedMetrics: options.enableDetailedMetrics !== false,
            qualityGates: options.qualityGates || ['draft', 'standard', 'rigorous'],
            ...options
        };

        // 품질 메트릭 정의
        this.qualityMetrics = this.initializeQualityMetrics();
        
        // 품질 게이트 설정
        this.qualityGates = this.initializeQualityGates();
        
        // 실시간 모니터링 데이터
        this.monitoringData = {
            processedCases: 0,
            qualityScores: [],
            errorCounts: {},
            performanceMetrics: {}
        };

        logService.info('QualityAssurance initialized', { 
            options: this.options 
        });
    }

    /**
     * 종합 품질 점수 계산
     * @param {CaseBundle} caseBundle - 케이스 번들
     * @param {Object} referenceData - 참조 데이터 (선택적)
     * @returns {Promise<Object>} 품질 점수 및 상세 메트릭
     */
    async calculateQualityScore(caseBundle, referenceData = null) {
        try {
            const startTime = Date.now();
            
            // 1. 정보 보존도 평가 (25점)
            const preservationScore = await this.evaluateInformationPreservation(caseBundle);
            
            // 2. 엔티티 추출 품질 (25점)
            const entityScore = await this.evaluateEntityExtraction(caseBundle, referenceData);
            
            // 3. 시간 정규화 품질 (25점)
            const temporalScore = await this.evaluateTemporalNormalization(caseBundle, referenceData);
            
            // 4. 컨텍스트 분류 품질 (25점)
            const contextScore = await this.evaluateContextualClassification(caseBundle);
            
            // 5. 종합 점수 계산
            const totalScore = preservationScore.score + entityScore.score + temporalScore.score + contextScore.score;
            
            // 6. 품질 게이트 평가
            const qualityGate = this.determineQualityGate(totalScore);
            
            // 7. 상세 분석
            const detailedAnalysis = await this.performDetailedAnalysis(caseBundle, {
                preservation: preservationScore,
                entity: entityScore,
                temporal: temporalScore,
                context: contextScore
            });

            const processingTime = Date.now() - startTime;

            const result = {
                overallScore: Math.round(totalScore),
                qualityGate: qualityGate,
                breakdown: {
                    informationPreservation: preservationScore,
                    entityExtraction: entityScore,
                    temporalNormalization: temporalScore,
                    contextualClassification: contextScore
                },
                detailedAnalysis: detailedAnalysis,
                recommendations: this.generateRecommendations(totalScore, detailedAnalysis),
                metadata: {
                    processingTime: processingTime,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };

            // 실시간 모니터링 업데이트
            this.updateMonitoring(result);

            logService.info('Quality score calculation started', {
                caseId: caseBundle.caseId,
                hasReferenceData: !!referenceData
            });

            logService.info('Quality score calculated', {
                caseId: caseBundle.caseId,
                overallScore: result.overallScore,
                qualityGate: result.qualityGate,
                processingTime
            });

            return result;

        } catch (error) {
            logService.error('Quality score calculation failed', {
                error: error.message,
                caseId: caseBundle?.caseId,
                stack: error.stack
            });
            throw new Error(`QualityAssurance failed: ${error.message}`);
        }
    }

    /**
     * 정보 보존도 평가
     */
    async evaluateInformationPreservation(caseBundle) {
        const metrics = {
            textPreservationRatio: 0,
            structuralPreservationRatio: 0,
            semanticPreservationRatio: 0,
            score: 0,
            details: {}
        };

        try {
            const originalText = caseBundle.originalText;
            const preservedText = caseBundle.segments.map(s => s.text).join(' ');
            
            // 1. 텍스트 보존율
            metrics.textPreservationRatio = preservedText.length / originalText.length;
            
            // 2. 구조적 보존율 (세그먼트 수, 엔티티 수 등)
            const originalStructures = this.extractStructuralElements(originalText);
            const entitiesLength = Array.isArray(caseBundle.entities) ? caseBundle.entities.length : 0;
            const segmentsLength = Array.isArray(caseBundle.segments) ? caseBundle.segments.length : 0;
            const preservedStructures = segmentsLength + entitiesLength;
            metrics.structuralPreservationRatio = Math.min(preservedStructures / Math.max(originalStructures, 1), 1);
            
            // 3. 의미적 보존율 (키워드 보존)
            const originalKeywords = this.extractKeywords(originalText);
            const preservedKeywords = this.extractKeywords(preservedText);
            const keywordOverlap = this.calculateKeywordOverlap(originalKeywords, preservedKeywords);
            metrics.semanticPreservationRatio = keywordOverlap;
            
            // 4. 종합 점수 (25점 만점)
            const weightedScore = (
                metrics.textPreservationRatio * 0.4 +
                metrics.structuralPreservationRatio * 0.3 +
                metrics.semanticPreservationRatio * 0.3
            );
            metrics.score = Math.round(weightedScore * 25);
            
            metrics.details = {
                originalLength: originalText ? originalText.length : 0,
                preservedLength: preservedText ? preservedText.length : 0,
                originalKeywords: originalKeywords ? originalKeywords.length : 0,
                preservedKeywords: preservedKeywords ? preservedKeywords.length : 0,
                keywordOverlap: keywordOverlap
            };

        } catch (error) {
            logService.warn('Information preservation evaluation warning', {
                issue: 'Low preservation ratio',
                ratio: preservationRatio,
                caseId: caseBundle.caseId
            });
            metrics.score = 0;
        }

        return metrics;
    }

    /**
     * 엔티티 추출 품질 평가
     */
    async evaluateEntityExtraction(caseBundle, referenceData) {
        const metrics = {
            precision: 0,
            recall: 0,
            f1Score: 0,
            confidenceDistribution: {},
            typeAccuracy: {},
            score: 0,
            details: {}
        };

        try {
            const extractedEntities = caseBundle.entities;
            
            if (referenceData && referenceData.entities) {
                // 참조 데이터가 있는 경우 정확한 평가
                const referenceEntities = referenceData.entities;
                
                const { precision, recall, f1 } = this.calculatePRF(extractedEntities, referenceEntities);
                metrics.precision = precision;
                metrics.recall = recall;
                metrics.f1Score = f1;
                
                metrics.score = Math.round(f1 * 25);
            } else {
                // 참조 데이터가 없는 경우 휴리스틱 평가
                const heuristicScore = this.evaluateEntitiesHeuristically(extractedEntities);
                metrics.score = Math.round(heuristicScore * 25);
            }
            
            // 신뢰도 분포 분석 (개선된 버전)
            metrics.confidenceDistribution = this.analyzeConfidenceDistribution(extractedEntities);
            
            // 타입별 정확도 분석 (개선된 버전)
            metrics.typeAccuracy = this.analyzeTypeAccuracy(extractedEntities);
     * 신뢰도 분포 분석 (개선된 버전)
     */
    analyzeConfidenceDistribution(entities) {
        const distribution = {
            veryHigh: 0,    // 0.9 이상
            high: 0,        // 0.8-0.89
            medium: 0,      // 0.6-0.79
            low: 0,         // 0.4-0.59
            veryLow: 0      // 0.4 미만
        };

        entities.forEach(entity => {
            const confidence = entity.confidence || 0;
            if (confidence >= 0.9) distribution.veryHigh++;
            else if (confidence >= 0.8) distribution.high++;
            else if (confidence >= 0.6) distribution.medium++;
            else if (confidence >= 0.4) distribution.low++;
            else distribution.veryLow++;
        });

        const total = entities.length;
        return {
            counts: distribution,
            percentages: {
                veryHigh: (distribution.veryHigh / total) * 100,
                high: (distribution.high / total) * 100,
                medium: (distribution.medium / total) * 100,
                low: (distribution.low / total) * 100,
                veryLow: (distribution.veryLow / total) * 100
            },
            qualityScore: this.calculateConfidenceQualityScore(distribution, total)
        };
    }

    /**
     * 신뢰도 품질 점수 계산 (개선된 버전)
     */
    calculateConfidenceQualityScore(distribution, total) {
        if (total === 0) return 0;
        
        // 가중치 기반 점수 계산
        const weights = {
            veryHigh: 1.0,
            high: 0.8,
            medium: 0.6,
            low: 0.3,
            veryLow: 0.1
        };
        
        const weightedSum = 
            distribution.veryHigh * weights.veryHigh +
            distribution.high * weights.high +
            distribution.medium * weights.medium +
            distribution.low * weights.low +
            distribution.veryLow * weights.veryLow;
        
        return (weightedSum / total) * 100;
    }

    /**
     * 타입별 정확도 분석 (개선된 버전)
     */
    analyzeTypeAccuracy(entities) {
        const typeStats = {};
        
        entities.forEach(entity => {
            const type = entity.type || 'unknown';
            if (!typeStats[type]) {
                typeStats[type] = {
                    count: 0,
                    totalConfidence: 0,
                    highConfidenceCount: 0,
                    contextualAccuracy: 0,
                    evidenceStrength: 0
                };
            }
            
            typeStats[type].count++;
            typeStats[type].totalConfidence += entity.confidence || 0;
            
            if ((entity.confidence || 0) >= 0.8) {
                typeStats[type].highConfidenceCount++;
            }
            
            // 컨텍스트 정확도 평가
            typeStats[type].contextualAccuracy += this.evaluateContextualAccuracy(entity);
            
            // 증거 강도 평가
            typeStats[type].evidenceStrength += this.evaluateEvidenceStrength(entity);
        });
        
        // 평균 계산
        Object.keys(typeStats).forEach(type => {
            const stats = typeStats[type];
            stats.averageConfidence = stats.totalConfidence / stats.count;
            stats.highConfidenceRatio = stats.highConfidenceCount / stats.count;
            stats.averageContextualAccuracy = stats.contextualAccuracy / stats.count;
            stats.averageEvidenceStrength = stats.evidenceStrength / stats.count;
            
            // 종합 타입 품질 점수
            stats.overallQuality = (
                stats.averageConfidence * 0.4 +
                stats.highConfidenceRatio * 0.3 +
                stats.averageContextualAccuracy * 0.2 +
                stats.averageEvidenceStrength * 0.1
            ) * 100;
        });
        
        return typeStats;
    }

    /**
     * 컨텍스트 정확도 평가 (새로운 메서드)
     */
    evaluateContextualAccuracy(entity) {
        let accuracy = 0.5; // 기본 점수
        
        // 컨텍스트 정보가 있는지 확인
        if (entity.context) {
            accuracy += 0.2;
            
            // 의료 도메인 컨텍스트 확인
            const medicalContexts = ['diagnosis', 'procedure', 'medication', 'symptom', 'examination'];
            if (medicalContexts.includes(entity.context.domain)) {
                accuracy += 0.2;
            }
            
            // 시간적 컨텍스트 확인
            if (entity.context.temporal) {
                accuracy += 0.1;
            }
        }
        
        // 주변 텍스트와의 일관성 확인
        if (entity.attributes && entity.attributes.contextualConsistency) {
            accuracy += entity.attributes.contextualConsistency * 0.2;
        }
        
        return Math.min(accuracy, 1.0);
    }

    /**
     * 증거 강도 평가 (새로운 메서드)
     */
    evaluateEvidenceStrength(entity) {
        let strength = 0.3; // 기본 강도
        
        // 증거 정보 확인
        if (entity.evidence) {
            // 패턴 매칭 강도
            if (entity.evidence.patternMatch) {
                strength += 0.3;
            }
            
            // 키워드 매칭 강도
            if (entity.evidence.keywordMatch) {
                strength += 0.2;
            }
            
            // 컨텍스트 증거
            if (entity.evidence.contextual) {
                strength += 0.2;
            }
        }
        
        // 정규화된 텍스트 품질
        if (entity.normalizedText && entity.normalizedText !== entity.text) {
            strength += 0.1;
        }
        
        // 의료 코드 매핑
        if (entity.metadata && entity.metadata.medicalCode) {
            strength += 0.2;
        }
        
        return Math.min(strength, 1.0);
    }
            
            metrics.details = {
                totalEntities: extractedEntities.length,
                highConfidenceEntities: extractedEntities.filter(e => e.confidence >= 0.8).length,
                averageConfidence: extractedEntities.reduce((sum, e) => sum + e.confidence, 0) / extractedEntities.length
            };

        } catch (error) {
            logService.warn('Entity extraction evaluation warning', {
                issue: 'Low preservation ratio',
                ratio: preservationRatio,
                caseId: caseBundle.caseId
            });
            metrics.score = 0;
        }

        return metrics;
    }

    /**
     * 시간 정규화 품질 평가
     */
    async evaluateTemporalNormalization(caseBundle, referenceData) {
        const metrics = {
            temporalCoverage: 0,
            dateAccuracy: 0,
            sequenceAccuracy: 0,
            inferenceQuality: 0,
            score: 0,
            details: {}
        };

        try {
            const events = caseBundle.events;
            
            // 1. 시간 정보 커버리지
            const datedEvents = events.filter(e => e.normalizedDate);
            metrics.temporalCoverage = datedEvents.length / Math.max(events.length, 1);
            
            // 2. 날짜 정확도 (참조 데이터가 있는 경우)
            if (referenceData && referenceData.events) {
                metrics.dateAccuracy = this.evaluateDateAccuracy(events, referenceData.events);
            } else {
                metrics.dateAccuracy = this.evaluateDateConsistency(events);
            }
            
            // 3. 시퀀스 정확도
            metrics.sequenceAccuracy = this.evaluateSequenceAccuracy(events);
            
            // 4. 추론 품질
            const inferredEvents = events.filter(e => e.attributes && e.attributes.isInferred);
            metrics.inferenceQuality = this.evaluateInferenceQuality(inferredEvents);
            
            // 5. 종합 점수 (25점 만점)
            const weightedScore = (
                metrics.temporalCoverage * 0.3 +
                metrics.dateAccuracy * 0.4 +
                metrics.sequenceAccuracy * 0.2 +
                metrics.inferenceQuality * 0.1
            );
            metrics.score = Math.round(weightedScore * 25);
            
            metrics.details = {
                totalEvents: events.length,
                datedEvents: datedEvents.length,
                inferredEvents: inferredEvents.length,
                timeSpan: this.calculateTimeSpan(events)
            };

        } catch (error) {
            logService.warn('Temporal normalization evaluation warning', {
                issue: 'Low preservation ratio',
                ratio: preservationRatio,
                caseId: caseBundle.caseId
            });
            metrics.score = 0;
        }

        return metrics;
    }

    /**
     * 컨텍스트 분류 품질 평가
     */
    async evaluateContextualClassification(caseBundle) {
        const metrics = {
            segmentationQuality: 0,
            contextAccuracy: 0,
            domainClassification: 0,
            coherenceScore: 0,
            score: 0,
            details: {}
        };

        try {
            const segments = caseBundle.segments;
            
            // 1. 세그멘테이션 품질
            metrics.segmentationQuality = this.evaluateSegmentationQuality(segments);
            
            // 2. 컨텍스트 분류 정확도
            metrics.contextAccuracy = this.evaluateContextAccuracy(segments);
            
            // 3. 의료 도메인 분류 정확도
            metrics.domainClassification = this.evaluateDomainClassification(segments);
            
            // 4. 일관성 점수
            metrics.coherenceScore = this.evaluateCoherence(segments);
            
            // 5. 종합 점수 (25점 만점)
            const weightedScore = (
                metrics.segmentationQuality * 0.3 +
                metrics.contextAccuracy * 0.3 +
                metrics.domainClassification * 0.2 +
                metrics.coherenceScore * 0.2
            );
            metrics.score = Math.round(weightedScore * 25);
            
            metrics.details = {
                totalSegments: segments.length,
                contextualSegments: segments.filter(s => s.context && s.context.type).length,
                medicalSegments: segments.filter(s => s.medicalDomain).length,
                averageConfidence: segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
            };

        } catch (error) {
            logService.warn('Contextual classification evaluation warning', {
                issue: 'Low preservation ratio',
                ratio: preservationRatio,
                caseId: caseBundle.caseId
            });
            metrics.score = 0;
        }

        return metrics;
    }

    /**
     * 상세 분석 수행
     */
    async performDetailedAnalysis(caseBundle, breakdown) {
        return {
            strengths: this.identifyStrengths(breakdown),
            weaknesses: this.identifyWeaknesses(breakdown),
            riskFactors: this.identifyRiskFactors(caseBundle, breakdown),
            improvementAreas: this.identifyImprovementAreas(breakdown),
            confidenceAnalysis: this.analyzeOverallConfidence(caseBundle),
            performanceMetrics: this.calculatePerformanceMetrics(caseBundle)
        };
    }

    /**
     * 품질 게이트 결정
     */
    determineQualityGate(totalScore) {
        if (totalScore >= 85) return 'rigorous';
        if (totalScore >= 70) return 'standard';
        if (totalScore >= 50) return 'draft';
        return 'insufficient';
    }

    /**
     * 추천사항 생성
     */
    generateRecommendations(totalScore, detailedAnalysis) {
        const recommendations = [];
        
        if (totalScore < this.options.targetQualityScore) {
            recommendations.push({
                priority: 'high',
                category: 'quality_improvement',
                description: `품질 점수가 목표치(${this.options.targetQualityScore}점)에 미달합니다. 전반적인 개선이 필요합니다.`
            });
        }
        
        // 약점 기반 추천
        for (const weakness of detailedAnalysis.weaknesses) {
            recommendations.push({
                priority: 'medium',
                category: 'weakness_improvement',
                description: `${weakness} 영역의 개선이 필요합니다.`
            });
        }
        
        // 위험 요소 기반 추천
        for (const risk of detailedAnalysis.riskFactors) {
            recommendations.push({
                priority: 'high',
                category: 'risk_mitigation',
                description: `${risk} 위험 요소에 대한 대응이 필요합니다.`
            });
        }
        
        return recommendations;
    }

    /**
     * 실시간 모니터링 업데이트
     */
    updateMonitoring(qualityResult) {
        if (!this.options.enableRealTimeMonitoring) return;
        
        this.monitoringData.processedCases++;
        this.monitoringData.qualityScores.push(qualityResult.overallScore);
        
        // 최근 100개 케이스만 유지
        if (this.monitoringData.qualityScores.length > 100) {
            this.monitoringData.qualityScores.shift();
        }
        
        // 성능 메트릭 업데이트
        this.monitoringData.performanceMetrics = {
            averageScore: this.monitoringData.qualityScores.reduce((sum, score) => sum + score, 0) / this.monitoringData.qualityScores.length,
            minScore: Math.min(...this.monitoringData.qualityScores),
            maxScore: Math.max(...this.monitoringData.qualityScores),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 모니터링 데이터 조회
     */
    getMonitoringData() {
        return this.monitoringData;
    }

    /**
     * 품질 트렌드 분석
     */
    analyzeQualityTrend() {
        const scores = this.monitoringData.qualityScores;
        if (scores.length < 10) return null;
        
        const recent = scores.slice(-10);
        const previous = scores.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
        const previousAvg = previous.reduce((sum, score) => sum + score, 0) / previous.length;
        
        return {
            trend: recentAvg > previousAvg ? 'improving' : 'declining',
            change: recentAvg - previousAvg,
            recentAverage: recentAvg,
            previousAverage: previousAvg
        };
    }

    /**
     * 헬퍼 메서드들
     */
    initializeQualityMetrics() {
        return {
            informationPreservation: { weight: 0.25, threshold: 0.8 },
            entityExtraction: { weight: 0.25, threshold: 0.7 },
            temporalNormalization: { weight: 0.25, threshold: 0.7 },
            contextualClassification: { weight: 0.25, threshold: 0.6 }
        };
    }

    initializeQualityGates() {
        return {
            rigorous: { minScore: 85, confidence: 0.9, processingTime: 'extended' },
            standard: { minScore: 70, confidence: 0.8, processingTime: 'normal' },
            draft: { minScore: 50, confidence: 0.6, processingTime: 'fast' },
            insufficient: { minScore: 0, confidence: 0.4, processingTime: 'minimal' }
        };
    }

    extractStructuralElements(text) {
        // 구조적 요소 추출 (문단, 목록, 날짜 등)
        const paragraphs = text.split('\n\n').length;
        const dates = (text.match(/\d{4}[년\-\/\.]\d{1,2}[월\-\/\.]\d{1,2}/g) || []).length;
        const lists = (text.match(/^\s*[-*]\s/gm) || []).length;
        return paragraphs + dates + lists;
    }

    extractKeywords(text) {
        // 의료 키워드 추출
        const medicalKeywords = text.match(/[가-힣]{2,}(병|증|염|암|종양|수술|시술|처치|진단|치료|약물|처방)/g) || [];
        return [...new Set(medicalKeywords)];
    }

    calculateKeywordOverlap(original, preserved) {
        const intersection = original.filter(keyword => preserved.includes(keyword));
        return intersection.length / Math.max(original.length, 1);
    }

    calculatePRF(extracted, reference) {
        // Precision, Recall, F1 계산
        let tp = 0, fp = 0, fn = 0;
        
        for (const ref of reference) {
            const found = extracted.find(ext => 
                ext.type === ref.type && 
                ext.normalizedText.toLowerCase().includes(ref.text.toLowerCase())
            );
            if (found) tp++;
            else fn++;
        }
        
        fp = extracted.length - tp;
        
        const precision = tp / Math.max(tp + fp, 1);
        const recall = tp / Math.max(tp + fn, 1);
        const f1 = 2 * precision * recall / Math.max(precision + recall, 1);
        
        return { precision, recall, f1 };
    }

    evaluateEntitiesHeuristically(entities) {
        // entities가 배열이 아닌 경우 처리
        if (!Array.isArray(entities)) {
            logService('QualityAssurance', 'Entities is not an array', 'warn', { entities });
            return 0;
        }
        
        if (entities.length === 0) {
            return 0;
        }
        
        // 휴리스틱 기반 엔티티 평가
        const avgConfidence = entities.reduce((sum, e) => sum + (e.confidence || 0), 0) / entities.length;
        const typeVariety = new Set(entities.map(e => e.type)).size;
        const evidenceQuality = entities.filter(e => e.evidence && e.evidence.length > 0).length / entities.length;
        
        return (avgConfidence * 0.4 + Math.min(typeVariety / 5, 1) * 0.3 + evidenceQuality * 0.3);
    }

    analyzeConfidenceDistribution(entities) {
        // entities가 배열이 아닌 경우 처리
        if (!Array.isArray(entities)) {
            logService('QualityAssurance', 'Entities is not an array for confidence distribution', 'warn', { entities });
            return { high: 0, medium: 0, low: 0 };
        }
        
        const distribution = { high: 0, medium: 0, low: 0 };
        
        for (const entity of entities) {
            if (entity.confidence >= 0.8) distribution.high++;
            else if (entity.confidence >= 0.6) distribution.medium++;
            else distribution.low++;
        }
        
        return distribution;
    }

    analyzeTypeAccuracy(entities) {
        // entities가 배열이 아닌 경우 처리
        if (!Array.isArray(entities)) {
            logService('QualityAssurance', 'Entities is not an array for type accuracy', 'warn', { entities });
            return {};
        }
        
        const typeStats = {};
        
        for (const entity of entities) {
            if (!typeStats[entity.type]) {
                typeStats[entity.type] = { count: 0, totalConfidence: 0 };
            }
            typeStats[entity.type].count++;
            typeStats[entity.type].totalConfidence += (entity.confidence || 0);
        }
        
        for (const type in typeStats) {
            typeStats[type].averageConfidence = typeStats[type].totalConfidence / typeStats[type].count;
        }
        
        return typeStats;
    }

    evaluateDateAccuracy(events, referenceEvents) {
        // 참조 이벤트와 비교하여 날짜 정확도 평가
        let accurateCount = 0;
        
        for (const refEvent of referenceEvents) {
            const found = events.find(e => 
                e.description.includes(refEvent.description) &&
                e.normalizedDate &&
                Math.abs(new Date(e.normalizedDate) - new Date(refEvent.date)) < 24 * 60 * 60 * 1000 // 1일 오차 허용
            );
            if (found) accurateCount++;
        }
        
        return accurateCount / Math.max(referenceEvents.length, 1);
    }

    evaluateDateConsistency(events) {
        // 날짜 일관성 평가
        const datedEvents = events.filter(e => e.normalizedDate).sort((a, b) => new Date(a.normalizedDate) - new Date(b.normalizedDate));
        if (datedEvents.length < 2) return 1;
        
        let consistentCount = 0;
        for (let i = 1; i < datedEvents.length; i++) {
            const prev = datedEvents[i - 1];
            const curr = datedEvents[i];
            
            // 논리적 순서 확인 (예: 진단 -> 치료 -> 회복)
            if (this.isLogicalSequence(prev, curr)) {
                consistentCount++;
            }
        }
        
        return consistentCount / Math.max(datedEvents.length - 1, 1);
    }

    evaluateSequenceAccuracy(events) {
        // 시퀀스 정확도 평가
        return this.evaluateDateConsistency(events);
    }

    evaluateInferenceQuality(inferredEvents) {
        if (inferredEvents.length === 0) return 1;
        
        const avgConfidence = inferredEvents.reduce((sum, e) => sum + e.confidence, 0) / inferredEvents.length;
        return avgConfidence;
    }

    calculateTimeSpan(events) {
        const datedEvents = events.filter(e => e.normalizedDate);
        if (datedEvents.length < 2) return null;
        
        const dates = datedEvents.map(e => new Date(e.normalizedDate)).sort((a, b) => a - b);
        const span = dates[dates.length - 1] - dates[0];
        return Math.ceil(span / (24 * 60 * 60 * 1000)); // 일 단위
    }

    evaluateSegmentationQuality(segments) {
        // 세그멘테이션 품질 평가
        const avgLength = segments.reduce((sum, s) => sum + s.text.length, 0) / Math.max(segments.length, 1);
        const lengthVariance = this.calculateVariance(segments.map(s => s.text.length));
        
        // 적절한 길이와 일관성을 가진 세그먼트일수록 높은 점수
        const lengthScore = Math.min(avgLength / 200, 1); // 200자 기준
        const consistencyScore = 1 - Math.min(lengthVariance / 10000, 1); // 분산 기준
        
        return (lengthScore + consistencyScore) / 2;
    }

    evaluateContextAccuracy(segments) {
        const contextualSegments = segments.filter(s => s.context && s.context.type);
        return contextualSegments.length / Math.max(segments.length, 1);
    }

    evaluateDomainClassification(segments) {
        const medicalSegments = segments.filter(s => s.medicalDomain);
        return medicalSegments.length / Math.max(segments.length, 1);
    }

    evaluateCoherence(segments) {
        // 세그먼트 간 일관성 평가
        const avgConfidence = segments.reduce((sum, s) => sum + s.confidence, 0) / Math.max(segments.length, 1);
        return avgConfidence;
    }

    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }

    identifyStrengths(breakdown) {
        const strengths = [];
        
        if (breakdown.preservation.score >= 20) strengths.push('정보 보존도');
        if (breakdown.entity.score >= 20) strengths.push('엔티티 추출');
        if (breakdown.temporal.score >= 20) strengths.push('시간 정규화');
        if (breakdown.context.score >= 20) strengths.push('컨텍스트 분류');
        
        return strengths;
    }

    identifyWeaknesses(breakdown) {
        const weaknesses = [];
        
        if (breakdown.preservation.score < 15) weaknesses.push('정보 보존도');
        if (breakdown.entity.score < 15) weaknesses.push('엔티티 추출');
        if (breakdown.temporal.score < 15) weaknesses.push('시간 정규화');
        if (breakdown.context.score < 15) weaknesses.push('컨텍스트 분류');
        
        return weaknesses;
    }

    identifyRiskFactors(caseBundle, breakdown) {
        const risks = [];
        
        if (breakdown.entity.details.averageConfidence < 0.6) {
            risks.push('낮은 엔티티 신뢰도');
        }
        
        if (breakdown.temporal.details.datedEvents / breakdown.temporal.details.totalEvents < 0.5) {
            risks.push('시간 정보 부족');
        }
        
        return risks;
    }

    identifyImprovementAreas(breakdown) {
        const areas = [];
        
        Object.entries(breakdown).forEach(([key, value]) => {
            if (value.score < 18) {
                areas.push(key);
            }
        });
        
        return areas;
    }

    analyzeOverallConfidence(caseBundle) {
        const allConfidences = [
            ...caseBundle.entities.map(e => e.confidence),
            ...caseBundle.events.map(e => e.confidence),
            ...caseBundle.segments.map(s => s.confidence)
        ];
        
        return {
            average: allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length,
            min: Math.min(...allConfidences),
            max: Math.max(...allConfidences),
            distribution: this.analyzeConfidenceDistribution({ map: () => allConfidences.map(c => ({ confidence: c })) })
        };
    }

    calculatePerformanceMetrics(caseBundle) {
        return {
            entitiesPerSegment: caseBundle.entities.length / Math.max(caseBundle.segments.length, 1),
            eventsPerEntity: caseBundle.events.length / Math.max(caseBundle.entities.length, 1),
            averageSegmentLength: caseBundle.segments.reduce((sum, s) => sum + s.text.length, 0) / Math.max(caseBundle.segments.length, 1)
        };
    }

    isLogicalSequence(prevEvent, currEvent) {
        // 의료 도메인 논리적 순서 확인
        const sequenceRules = {
            'symptom_onset': ['diagnosis', 'procedure', 'treatment'],
            'diagnosis': ['procedure', 'treatment', 'follow_up'],
            'procedure': ['recovery', 'follow_up', 'treatment'],
            'treatment': ['follow_up', 'recovery']
        };
        
        const prevType = prevEvent.type.split('_')[0];
        const currType = currEvent.type.split('_')[0];
        
        return sequenceRules[prevType]?.includes(currType) || false;
    }
}

export default QualityAssurance;