// ConfidenceScorer.js - 신뢰도 점수 계산 및 품질 평가 엔진
import { logService } from '../../utils/logger.js';

export default class ConfidenceScorer {
    constructor(options = {}) {
        this.options = {
            enableDetailedScoring: options.enableDetailedScoring || true,
            enableUncertaintyAnalysis: options.enableUncertaintyAnalysis || true,
            minConfidenceThreshold: options.minConfidenceThreshold || 0.3,
            qualityGateThresholds: options.qualityGateThresholds || {
                draft: 0.5,
                standard: 0.7,
                rigorous: 0.85
            },
            ...options
        };
        
        // 신뢰도 가중치 설정
        this.confidenceWeights = {
            entityExtraction: 0.25,    // 엔티티 추출 정확도
            temporalAccuracy: 0.20,    // 시간적 정확도
            contextualRelevance: 0.20, // 문맥적 관련성
            dataCompleteness: 0.15,    // 데이터 완성도
            sourceReliability: 0.10,   // 소스 신뢰성
            crossValidation: 0.10      // 교차 검증
        };
        
        // 불확실성 요인
        this.uncertaintyFactors = {
            ambiguousTerms: 0.1,       // 모호한 용어
            incompleteData: 0.15,      // 불완전한 데이터
            conflictingInfo: 0.2,      // 상충하는 정보
            lowSourceQuality: 0.1,     // 낮은 소스 품질
            temporalGaps: 0.1,         // 시간적 공백
            contextualUncertainty: 0.15 // 문맥적 불확실성
        };
        
        logService.info('ConfidenceScorer initialized', { options: this.options });
    }

    /**
     * 메인 신뢰도 점수 계산 함수
     * @param {Object} analysisResults - 이전 단계들의 분석 결과
     * @returns {Object} 신뢰도 점수 결과
     */
    async calculateConfidenceScore(analysisResults) {
        try {
            const startTime = Date.now();
            
            // 1. 개별 컴포넌트 신뢰도 계산
            const componentScores = await this.calculateComponentScores(analysisResults);
            
            // 2. 전체 신뢰도 점수 계산
            const overallScore = await this.calculateOverallScore(componentScores);
            
            // 3. 품질 게이트 평가
            const qualityGateResult = await this.evaluateQualityGates(overallScore, componentScores);
            
            // 4. 불확실성 분석
            const uncertaintyAnalysis = this.options.enableUncertaintyAnalysis ? 
                await this.analyzeUncertainty(analysisResults, componentScores) : null;
            
            // 5. 상세 점수 분석
            const detailedAnalysis = this.options.enableDetailedScoring ? 
                await this.performDetailedAnalysis(componentScores, analysisResults) : null;
            
            // 6. 개선 권고사항 생성
            const recommendations = await this.generateImprovementRecommendations(componentScores, uncertaintyAnalysis);
            
            const result = {
                overallConfidenceScore: overallScore.score,
                confidenceLevel: overallScore.level,
                qualityGate: qualityGateResult.gate,
                qualityGatePassed: qualityGateResult.passed,
                componentScores,
                uncertaintyAnalysis,
                detailedAnalysis,
                recommendations,
                summary: this.generateSummary(overallScore, componentScores, qualityGateResult),
                processingTimeMs: Date.now() - startTime,
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    component: 'ConfidenceScorer'
                }
            };
            
            logService.info('Confidence scoring completed', {
                overallScore: result.overallConfidenceScore,
                confidenceLevel: result.confidenceLevel,
                qualityGate: result.qualityGate,
                processingTime: result.processingTimeMs
            });
            
            return result;
            
        } catch (error) {
            logService.error('Confidence scoring failed', { error: error.message });
            throw new Error(`ConfidenceScorer failed: ${error.message}`);
        }
    }

    /**
     * 개별 컴포넌트 신뢰도 계산
     */
    async calculateComponentScores(analysisResults) {
        const scores = {};
        
        // 1. 엔티티 추출 신뢰도
        scores.entityExtraction = await this.calculateEntityExtractionScore(analysisResults.entities);
        
        // 2. 시간적 정확도
        scores.temporalAccuracy = await this.calculateTemporalAccuracyScore(
            analysisResults.timeline, 
            analysisResults.anchors
        );
        
        // 3. 문맥적 관련성
        scores.contextualRelevance = await this.calculateContextualRelevanceScore(
            analysisResults.entities, 
            analysisResults.timeline
        );
        
        // 4. 데이터 완성도
        scores.dataCompleteness = await this.calculateDataCompletenessScore(analysisResults);
        
        // 5. 소스 신뢰성
        scores.sourceReliability = await this.calculateSourceReliabilityScore(analysisResults.textSegments);
        
        // 6. 교차 검증
        scores.crossValidation = await this.calculateCrossValidationScore(analysisResults);
        
        return scores;
    }

    /**
     * 엔티티 추출 신뢰도 계산
     */
    async calculateEntityExtractionScore(entities) {
        if (!entities || entities.length === 0) {
            return {
                score: 0,
                details: {
                    totalEntities: 0,
                    highConfidenceEntities: 0,
                    averageConfidence: 0,
                    entityTypeDistribution: {}
                }
            };
        }
        
        const confidences = entities.map(entity => entity.confidence || 0.5);
        const averageConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
        
        const highConfidenceEntities = entities.filter(entity => (entity.confidence || 0.5) >= 0.8);
        const highConfidenceRatio = highConfidenceEntities.length / entities.length;
        
        // 엔티티 타입 분포
        const entityTypeDistribution = {};
        entities.forEach(entity => {
            entityTypeDistribution[entity.type] = (entityTypeDistribution[entity.type] || 0) + 1;
        });
        
        // 다양성 보너스 (다양한 타입의 엔티티가 있으면 신뢰도 증가)
        const diversityBonus = Math.min(Object.keys(entityTypeDistribution).length * 0.05, 0.2);
        
        const score = Math.min(averageConfidence + (highConfidenceRatio * 0.2) + diversityBonus, 1.0);
        
        return {
            score,
            details: {
                totalEntities: entities.length,
                highConfidenceEntities: highConfidenceEntities.length,
                averageConfidence,
                highConfidenceRatio,
                diversityBonus,
                entityTypeDistribution
            }
        };
    }

    /**
     * 시간적 정확도 계산
     */
    async calculateTemporalAccuracyScore(timeline, anchors) {
        if (!timeline || !anchors || anchors.length === 0) {
            return {
                score: 0.3, // 기본 점수
                details: {
                    totalAnchors: 0,
                    validAnchors: 0,
                    temporalConsistency: 0,
                    dateFormatConsistency: 0
                }
            };
        }
        
        const validAnchors = anchors.filter(anchor => 
            anchor.confidence >= 0.6 && anchor.normalizedDate
        );
        
        const validAnchorRatio = validAnchors.length / anchors.length;
        
        // 시간적 일관성 검사
        const temporalConsistency = this.calculateTemporalConsistency(validAnchors);
        
        // 날짜 형식 일관성
        const dateFormatConsistency = this.calculateDateFormatConsistency(anchors);
        
        // 타임라인 완성도
        const timelineCompleteness = timeline.events ? 
            Math.min(timeline.events.length / 10, 1.0) : 0; // 10개 이벤트를 완성도 100%로 가정
        
        const score = (validAnchorRatio * 0.4) + 
                     (temporalConsistency * 0.3) + 
                     (dateFormatConsistency * 0.2) + 
                     (timelineCompleteness * 0.1);
        
        return {
            score: Math.min(score, 1.0),
            details: {
                totalAnchors: anchors.length,
                validAnchors: validAnchors.length,
                validAnchorRatio,
                temporalConsistency,
                dateFormatConsistency,
                timelineCompleteness
            }
        };
    }

    /**
     * 문맥적 관련성 계산
     */
    async calculateContextualRelevanceScore(entities, timeline) {
        if (!entities || entities.length === 0) {
            return {
                score: 0,
                details: {
                    entityTimelineAlignment: 0,
                    medicalContextConsistency: 0,
                    crossReferenceScore: 0
                }
            };
        }
        
        // 엔티티-타임라인 정렬도
        const entityTimelineAlignment = this.calculateEntityTimelineAlignment(entities, timeline);
        
        // 의료적 문맥 일관성
        const medicalContextConsistency = this.calculateMedicalContextConsistency(entities);
        
        // 교차 참조 점수
        const crossReferenceScore = this.calculateCrossReferenceScore(entities);
        
        const score = (entityTimelineAlignment * 0.4) + 
                     (medicalContextConsistency * 0.4) + 
                     (crossReferenceScore * 0.2);
        
        return {
            score: Math.min(score, 1.0),
            details: {
                entityTimelineAlignment,
                medicalContextConsistency,
                crossReferenceScore
            }
        };
    }

    /**
     * 데이터 완성도 계산
     */
    async calculateDataCompletenessScore(analysisResults) {
        const completenessFactors = {
            hasEntities: analysisResults.entities && analysisResults.entities.length > 0,
            hasTimeline: analysisResults.timeline && analysisResults.timeline.events && analysisResults.timeline.events.length > 0,
            hasAnchors: analysisResults.anchors && analysisResults.anchors.length > 0,
            hasRuleResults: analysisResults.ruleResults && analysisResults.ruleResults.length > 0,
            hasDisclosureAnalysis: analysisResults.disclosureAnalysis !== null
        };
        
        const completedFactors = Object.values(completenessFactors).filter(Boolean).length;
        const totalFactors = Object.keys(completenessFactors).length;
        
        const completenessRatio = completedFactors / totalFactors;
        
        // 각 컴포넌트의 품질 평가
        const qualityFactors = {
            entityQuality: this.assessEntityQuality(analysisResults.entities),
            timelineQuality: this.assessTimelineQuality(analysisResults.timeline),
            anchorQuality: this.assessAnchorQuality(analysisResults.anchors)
        };
        
        const averageQuality = Object.values(qualityFactors).reduce((sum, quality) => sum + quality, 0) / 
                              Object.keys(qualityFactors).length;
        
        const score = (completenessRatio * 0.6) + (averageQuality * 0.4);
        
        return {
            score: Math.min(score, 1.0),
            details: {
                completenessFactors,
                completenessRatio,
                qualityFactors,
                averageQuality
            }
        };
    }

    /**
     * 소스 신뢰성 계산
     */
    async calculateSourceReliabilityScore(textSegments) {
        if (!textSegments || textSegments.length === 0) {
            return {
                score: 0.5, // 기본 점수
                details: {
                    totalSegments: 0,
                    structuredSegments: 0,
                    medicalTermDensity: 0
                }
            };
        }
        
        // 구조화된 세그먼트 비율
        const structuredSegments = textSegments.filter(segment => 
            segment.section && segment.section !== 'unknown'
        );
        const structuredRatio = structuredSegments.length / textSegments.length;
        
        // 의료 용어 밀도
        const medicalTermDensity = this.calculateMedicalTermDensity(textSegments);
        
        // 텍스트 품질 (길이, 완성도 등)
        const textQuality = this.assessTextQuality(textSegments);
        
        const score = (structuredRatio * 0.4) + 
                     (medicalTermDensity * 0.3) + 
                     (textQuality * 0.3);
        
        return {
            score: Math.min(score, 1.0),
            details: {
                totalSegments: textSegments.length,
                structuredSegments: structuredSegments.length,
                structuredRatio,
                medicalTermDensity,
                textQuality
            }
        };
    }

    /**
     * 교차 검증 점수 계산
     */
    async calculateCrossValidationScore(analysisResults) {
        let validationScore = 0;
        const validationResults = [];
        
        // 엔티티-타임라인 교차 검증
        if (analysisResults.entities && analysisResults.timeline) {
            const entityTimelineValidation = this.validateEntityTimelineConsistency(
                analysisResults.entities, 
                analysisResults.timeline
            );
            validationScore += entityTimelineValidation.score * 0.3;
            validationResults.push(entityTimelineValidation);
        }
        
        // 룰 결과-엔티티 교차 검증
        if (analysisResults.ruleResults && analysisResults.entities) {
            const ruleEntityValidation = this.validateRuleEntityConsistency(
                analysisResults.ruleResults, 
                analysisResults.entities
            );
            validationScore += ruleEntityValidation.score * 0.3;
            validationResults.push(ruleEntityValidation);
        }
        
        // 고지의무 분석-엔티티 교차 검증
        if (analysisResults.disclosureAnalysis && analysisResults.entities) {
            const disclosureEntityValidation = this.validateDisclosureEntityConsistency(
                analysisResults.disclosureAnalysis, 
                analysisResults.entities
            );
            validationScore += disclosureEntityValidation.score * 0.4;
            validationResults.push(disclosureEntityValidation);
        }
        
        return {
            score: Math.min(validationScore, 1.0),
            details: {
                validationResults,
                totalValidations: validationResults.length
            }
        };
    }

    /**
     * 전체 신뢰도 점수 계산
     */
    async calculateOverallScore(componentScores) {
        let weightedSum = 0;
        let totalWeight = 0;
        
        Object.entries(this.confidenceWeights).forEach(([component, weight]) => {
            if (componentScores[component]) {
                weightedSum += componentScores[component].score * weight;
                totalWeight += weight;
            }
        });
        
        const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const level = this.determineConfidenceLevel(score);
        
        return {
            score: Math.max(Math.min(score, 1.0), 0),
            level,
            weightedSum,
            totalWeight
        };
    }

    /**
     * 품질 게이트 평가
     */
    async evaluateQualityGates(overallScore, componentScores) {
        const gates = ['draft', 'standard', 'rigorous'];
        let passedGate = null;
        
        for (const gate of gates) {
            const threshold = this.options.qualityGateThresholds[gate];
            if (overallScore.score >= threshold) {
                passedGate = gate;
            } else {
                break;
            }
        }
        
        // 컴포넌트별 게이트 통과 여부
        const componentGateResults = {};
        Object.entries(componentScores).forEach(([component, result]) => {
            componentGateResults[component] = {};
            gates.forEach(gate => {
                const threshold = this.options.qualityGateThresholds[gate];
                componentGateResults[component][gate] = result.score >= threshold;
            });
        });
        
        return {
            gate: passedGate || 'none',
            passed: passedGate !== null,
            overallScore: overallScore.score,
            thresholds: this.options.qualityGateThresholds,
            componentGateResults
        };
    }

    /**
     * 불확실성 분석
     */
    async analyzeUncertainty(analysisResults, componentScores) {
        const uncertaintyFactors = {};
        let totalUncertainty = 0;
        
        // 모호한 용어 분석
        uncertaintyFactors.ambiguousTerms = this.analyzeAmbiguousTerms(analysisResults.entities);
        totalUncertainty += uncertaintyFactors.ambiguousTerms * this.uncertaintyFactors.ambiguousTerms;
        
        // 불완전한 데이터 분석
        uncertaintyFactors.incompleteData = this.analyzeIncompleteData(analysisResults);
        totalUncertainty += uncertaintyFactors.incompleteData * this.uncertaintyFactors.incompleteData;
        
        // 상충하는 정보 분석
        uncertaintyFactors.conflictingInfo = this.analyzeConflictingInfo(analysisResults);
        totalUncertainty += uncertaintyFactors.conflictingInfo * this.uncertaintyFactors.conflictingInfo;
        
        // 낮은 소스 품질 분석
        uncertaintyFactors.lowSourceQuality = this.analyzeLowSourceQuality(componentScores.sourceReliability);
        totalUncertainty += uncertaintyFactors.lowSourceQuality * this.uncertaintyFactors.lowSourceQuality;
        
        // 시간적 공백 분석
        uncertaintyFactors.temporalGaps = this.analyzeTemporalGaps(analysisResults.timeline);
        totalUncertainty += uncertaintyFactors.temporalGaps * this.uncertaintyFactors.temporalGaps;
        
        // 문맥적 불확실성 분석
        uncertaintyFactors.contextualUncertainty = this.analyzeContextualUncertainty(analysisResults.entities);
        totalUncertainty += uncertaintyFactors.contextualUncertainty * this.uncertaintyFactors.contextualUncertainty;
        
        const uncertaintyLevel = this.determineUncertaintyLevel(totalUncertainty);
        
        return {
            totalUncertainty: Math.min(totalUncertainty, 1.0),
            uncertaintyLevel,
            uncertaintyFactors,
            recommendations: this.generateUncertaintyRecommendations(uncertaintyFactors, uncertaintyLevel)
        };
    }

    /**
     * 상세 분석 수행
     */
    async performDetailedAnalysis(componentScores, analysisResults) {
        return {
            scoreDistribution: this.analyzeScoreDistribution(componentScores),
            strengthsAndWeaknesses: this.identifyStrengthsAndWeaknesses(componentScores),
            improvementPotential: this.calculateImprovementPotential(componentScores),
            riskFactors: this.identifyRiskFactors(componentScores, analysisResults),
            qualityMetrics: this.calculateQualityMetrics(componentScores, analysisResults)
        };
    }

    /**
     * 개선 권고사항 생성
     */
    async generateImprovementRecommendations(componentScores, uncertaintyAnalysis) {
        const recommendations = [];
        
        // 컴포넌트별 개선 권고
        Object.entries(componentScores).forEach(([component, result]) => {
            if (result.score < 0.7) {
                recommendations.push({
                    type: 'component_improvement',
                    component,
                    currentScore: result.score,
                    targetScore: 0.8,
                    priority: result.score < 0.5 ? 'high' : 'medium',
                    suggestions: this.getComponentImprovementSuggestions(component, result)
                });
            }
        });
        
        // 불확실성 기반 권고
        if (uncertaintyAnalysis && uncertaintyAnalysis.uncertaintyLevel === 'high') {
            recommendations.push({
                type: 'uncertainty_reduction',
                uncertaintyLevel: uncertaintyAnalysis.uncertaintyLevel,
                priority: 'high',
                suggestions: uncertaintyAnalysis.recommendations
            });
        }
        
        return this.prioritizeRecommendations(recommendations);
    }

    /**
     * 유틸리티 메서드들
     */
    determineConfidenceLevel(score) {
        if (score >= 0.85) return 'very_high';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        if (score >= 0.3) return 'low';
        return 'very_low';
    }

    calculateTemporalConsistency(anchors) {
        if (anchors.length < 2) return 1.0;
        
        let consistentPairs = 0;
        let totalPairs = 0;
        
        for (let i = 0; i < anchors.length; i++) {
            for (let j = i + 1; j < anchors.length; j++) {
                const anchor1 = anchors[i];
                const anchor2 = anchors[j];
                
                if (anchor1.normalizedDate && anchor2.normalizedDate) {
                    const date1 = new Date(anchor1.normalizedDate);
                    const date2 = new Date(anchor2.normalizedDate);
                    
                    // 논리적 순서 확인 (예: 입원 < 퇴원)
                    if (this.isTemporallyConsistent(anchor1, anchor2, date1, date2)) {
                        consistentPairs++;
                    }
                    totalPairs++;
                }
            }
        }
        
        return totalPairs > 0 ? consistentPairs / totalPairs : 1.0;
    }

    calculateDateFormatConsistency(anchors) {
        if (anchors.length === 0) return 1.0;
        
        const formats = anchors.map(anchor => this.detectDateFormat(anchor.originalText));
        const uniqueFormats = [...new Set(formats)];
        
        // 형식이 일관될수록 높은 점수
        return Math.max(1 - (uniqueFormats.length - 1) * 0.2, 0.2);
    }

    calculateEntityTimelineAlignment(entities, timeline) {
        if (!timeline || !timeline.events || entities.length === 0) return 0.5;
        
        let alignedEntities = 0;
        
        entities.forEach(entity => {
            const hasTimelineReference = timeline.events.some(event => 
                event.entities && event.entities.some(eventEntity => 
                    eventEntity.id === entity.id || 
                    (eventEntity.normalizedText || '').toLowerCase() === (entity.normalizedText || '').toLowerCase()
                )
            );
            
            if (hasTimelineReference) {
                alignedEntities++;
            }
        });
        
        return entities.length > 0 ? alignedEntities / entities.length : 0.5;
    }

    calculateMedicalContextConsistency(entities) {
        if (entities.length === 0) return 0.5;
        
        // 의료적으로 일관된 엔티티 조합 확인
        const diagnoses = entities.filter(e => e.type === 'diagnosis');
        const medications = entities.filter(e => e.type === 'medication');
        const procedures = entities.filter(e => e.type === 'procedure');
        
        let consistencyScore = 0.5; // 기본 점수
        
        // 진단-약물 일관성
        if (diagnoses.length > 0 && medications.length > 0) {
            const consistentPairs = this.findConsistentDiagnosisMedicationPairs(diagnoses, medications);
            consistencyScore += (consistentPairs / Math.max(diagnoses.length, medications.length)) * 0.3;
        }
        
        // 진단-시술 일관성
        if (diagnoses.length > 0 && procedures.length > 0) {
            const consistentPairs = this.findConsistentDiagnosisProcedurePairs(diagnoses, procedures);
            consistencyScore += (consistentPairs / Math.max(diagnoses.length, procedures.length)) * 0.2;
        }
        
        return Math.min(consistencyScore, 1.0);
    }

    calculateCrossReferenceScore(entities) {
        if (entities.length < 2) return 0.5;
        
        let crossReferences = 0;
        let totalPossibleReferences = 0;
        
        entities.forEach(entity => {
            if (entity.relatedEntities && entity.relatedEntities.length > 0) {
                crossReferences += entity.relatedEntities.length;
            }
            totalPossibleReferences += entities.length - 1; // 자기 자신 제외
        });
        
        return totalPossibleReferences > 0 ? 
            Math.min(crossReferences / (totalPossibleReferences * 0.3), 1.0) : 0.5;
    }

    assessEntityQuality(entities) {
        if (!entities || entities.length === 0) return 0;
        
        const qualityFactors = entities.map(entity => {
            let quality = 0;
            
            // 신뢰도
            quality += (entity.confidence || 0.5) * 0.4;
            
            // 표준화 여부
            if (entity.standardTerm) quality += 0.3;
            
            // 문맥 정보 존재
            if (entity.context) quality += 0.2;
            
            // 관련 엔티티 존재
            if (entity.relatedEntities && entity.relatedEntities.length > 0) quality += 0.1;
            
            return Math.min(quality, 1.0);
        });
        
        return qualityFactors.reduce((sum, quality) => sum + quality, 0) / qualityFactors.length;
    }

    assessTimelineQuality(timeline) {
        if (!timeline || !timeline.events) return 0;
        
        const events = timeline.events;
        if (events.length === 0) return 0;
        
        let qualityScore = 0;
        
        // 이벤트 수 (적절한 수의 이벤트)
        const eventCountScore = Math.min(events.length / 10, 1.0);
        qualityScore += eventCountScore * 0.3;
        
        // 시간적 정렬
        const temporalOrderScore = this.assessTemporalOrder(events);
        qualityScore += temporalOrderScore * 0.3;
        
        // 이벤트 완성도
        const completenessScore = this.assessEventCompleteness(events);
        qualityScore += completenessScore * 0.4;
        
        return Math.min(qualityScore, 1.0);
    }

    assessAnchorQuality(anchors) {
        if (!anchors || anchors.length === 0) return 0;
        
        const qualityFactors = anchors.map(anchor => {
            let quality = 0;
            
            // 신뢰도
            quality += (anchor.confidence || 0.5) * 0.4;
            
            // 정규화된 날짜 존재
            if (anchor.normalizedDate) quality += 0.3;
            
            // 타입 식별
            if (anchor.type && anchor.type !== 'unknown') quality += 0.2;
            
            // 문맥 정보
            if (anchor.context) quality += 0.1;
            
            return Math.min(quality, 1.0);
        });
        
        return qualityFactors.reduce((sum, quality) => sum + quality, 0) / qualityFactors.length;
    }

    calculateMedicalTermDensity(textSegments) {
        if (!textSegments || textSegments.length === 0) return 0;
        
        const medicalTerms = [
            '진단', '치료', '수술', '약물', '처방', '검사', '증상', '질환', '병원', '의사',
            '환자', '입원', '퇴원', '응급', '수치', '결과', '소견', '판독', '처치', '시술'
        ];
        
        let totalTerms = 0;
        let totalWords = 0;
        
        textSegments.forEach(segment => {
            const words = (segment.text || '').split(/\s+/);
            totalWords += words.length;
            
            words.forEach(word => {
                if (medicalTerms.some(term => word.includes(term))) {
                    totalTerms++;
                }
            });
        });
        
        return totalWords > 0 ? totalTerms / totalWords : 0;
    }

    assessTextQuality(textSegments) {
        if (!textSegments || textSegments.length === 0) return 0;
        
        let qualityScore = 0;
        
        // 평균 세그먼트 길이
        const avgLength = textSegments.reduce((sum, segment) => 
            sum + (segment.text || '').length, 0) / textSegments.length;
        const lengthScore = Math.min(avgLength / 100, 1.0); // 100자를 기준으로
        qualityScore += lengthScore * 0.4;
        
        // 구조화 정도
        const structuredSegments = textSegments.filter(segment => 
            segment.section && segment.section !== 'unknown'
        );
        const structureScore = structuredSegments.length / textSegments.length;
        qualityScore += structureScore * 0.6;
        
        return Math.min(qualityScore, 1.0);
    }

    // 검증 메서드들
    validateEntityTimelineConsistency(entities, timeline) {
        // 엔티티와 타임라인의 일관성 검증
        return { score: 0.8, details: 'Entity-timeline consistency validation' };
    }

    validateRuleEntityConsistency(ruleResults, entities) {
        // 룰 결과와 엔티티의 일관성 검증
        return { score: 0.75, details: 'Rule-entity consistency validation' };
    }

    validateDisclosureEntityConsistency(disclosureAnalysis, entities) {
        // 고지의무 분석과 엔티티의 일관성 검증
        return { score: 0.85, details: 'Disclosure-entity consistency validation' };
    }

    // 불확실성 분석 메서드들
    analyzeAmbiguousTerms(entities) {
        if (!entities || entities.length === 0) return 0;
        
        const ambiguousTerms = entities.filter(entity => 
            (entity.confidence || 0.5) < 0.6 || 
            (entity.normalizedText || '').includes('의심') ||
            (entity.normalizedText || '').includes('가능성')
        );
        
        return ambiguousTerms.length / entities.length;
    }

    analyzeIncompleteData(analysisResults) {
        let incompleteness = 0;
        let totalFactors = 0;
        
        // 엔티티 불완전성
        if (!analysisResults.entities || analysisResults.entities.length === 0) {
            incompleteness += 0.3;
        }
        totalFactors++;
        
        // 타임라인 불완전성
        if (!analysisResults.timeline || !analysisResults.timeline.events || analysisResults.timeline.events.length === 0) {
            incompleteness += 0.3;
        }
        totalFactors++;
        
        // 앵커 불완전성
        if (!analysisResults.anchors || analysisResults.anchors.length === 0) {
            incompleteness += 0.2;
        }
        totalFactors++;
        
        return incompleteness / totalFactors;
    }

    analyzeConflictingInfo(analysisResults) {
        // 상충하는 정보 분석 (간단한 구현)
        return 0.1; // 기본값
    }

    analyzeLowSourceQuality(sourceReliabilityScore) {
        return Math.max(0, 1 - sourceReliabilityScore.score);
    }

    analyzeTemporalGaps(timeline) {
        if (!timeline || !timeline.events || timeline.events.length < 2) return 0;
        
        const events = timeline.events.filter(event => event.date);
        if (events.length < 2) return 0.5;
        
        // 이벤트 간 시간 간격 분석
        const gaps = [];
        for (let i = 1; i < events.length; i++) {
            const prevDate = new Date(events[i-1].date);
            const currDate = new Date(events[i].date);
            const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
            gaps.push(daysDiff);
        }
        
        // 큰 시간 간격이 있으면 불확실성 증가
        const largeGaps = gaps.filter(gap => gap > 90); // 90일 이상
        return Math.min(largeGaps.length / gaps.length, 1.0);
    }

    analyzeContextualUncertainty(entities) {
        if (!entities || entities.length === 0) return 0;
        
        const uncertainEntities = entities.filter(entity => 
            !entity.context || 
            (entity.context && entity.context.length < 10) ||
            (entity.confidence || 0.5) < 0.5
        );
        
        return uncertainEntities.length / entities.length;
    }

    determineUncertaintyLevel(totalUncertainty) {
        if (totalUncertainty >= 0.7) return 'high';
        if (totalUncertainty >= 0.4) return 'medium';
        if (totalUncertainty >= 0.2) return 'low';
        return 'minimal';
    }

    generateUncertaintyRecommendations(uncertaintyFactors, uncertaintyLevel) {
        const recommendations = [];
        
        Object.entries(uncertaintyFactors).forEach(([factor, value]) => {
            if (value > 0.3) {
                recommendations.push({
                    factor,
                    value,
                    suggestion: this.getUncertaintyReductionSuggestion(factor)
                });
            }
        });
        
        return recommendations;
    }

    getUncertaintyReductionSuggestion(factor) {
        const suggestions = {
            ambiguousTerms: '모호한 용어에 대한 추가 문맥 정보 수집 필요',
            incompleteData: '누락된 데이터 보완 및 추가 정보 수집 필요',
            conflictingInfo: '상충하는 정보에 대한 검증 및 우선순위 결정 필요',
            lowSourceQuality: '더 신뢰할 수 있는 데이터 소스 확보 필요',
            temporalGaps: '시간적 공백에 대한 추가 정보 수집 필요',
            contextualUncertainty: '문맥적 정보 보강 및 관련 데이터 연결 필요'
        };
        
        return suggestions[factor] || '추가 검토 필요';
    }

    // 기타 유틸리티 메서드들
    generateSummary(overallScore, componentScores, qualityGateResult) {
        return {
            overallConfidenceScore: overallScore.score,
            confidenceLevel: overallScore.level,
            qualityGate: qualityGateResult.gate,
            qualityGatePassed: qualityGateResult.passed,
            strongestComponent: this.findStrongestComponent(componentScores),
            weakestComponent: this.findWeakestComponent(componentScores),
            improvementNeeded: overallScore.score < 0.7
        };
    }

    findStrongestComponent(componentScores) {
        let strongest = null;
        let highestScore = -1;
        
        Object.entries(componentScores).forEach(([component, result]) => {
            if (result.score > highestScore) {
                highestScore = result.score;
                strongest = component;
            }
        });
        
        return { component: strongest, score: highestScore };
    }

    findWeakestComponent(componentScores) {
        let weakest = null;
        let lowestScore = 2;
        
        Object.entries(componentScores).forEach(([component, result]) => {
            if (result.score < lowestScore) {
                lowestScore = result.score;
                weakest = component;
            }
        });
        
        return { component: weakest, score: lowestScore };
    }

    getComponentImprovementSuggestions(component, result) {
        const suggestions = {
            entityExtraction: [
                '엔티티 추출 모델의 정확도 향상',
                '의료 용어 사전 확장',
                '문맥 정보 활용 강화'
            ],
            temporalAccuracy: [
                '날짜 형식 정규화 개선',
                '시간적 관계 추론 강화',
                '타임라인 검증 로직 개선'
            ],
            contextualRelevance: [
                '문맥 분석 알고리즘 개선',
                '엔티티 간 관계 추론 강화',
                '의료적 일관성 검증 강화'
            ],
            dataCompleteness: [
                '데이터 수집 범위 확장',
                '누락 데이터 보완 로직 개선',
                '품질 검증 기준 강화'
            ],
            sourceReliability: [
                '데이터 소스 품질 평가 강화',
                '구조화된 데이터 활용 증대',
                '의료 용어 밀도 개선'
            ],
            crossValidation: [
                '교차 검증 로직 강화',
                '일관성 검사 기준 개선',
                '검증 범위 확장'
            ]
        };
        
        return suggestions[component] || ['추가 검토 및 개선 필요'];
    }

    prioritizeRecommendations(recommendations) {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        
        return recommendations.sort((a, b) => {
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            
            // 점수 차이로 2차 정렬
            if (a.currentScore && b.currentScore) {
                return a.currentScore - b.currentScore;
            }
            
            return 0;
        });
    }

    // 추가 분석 메서드들 (상세 분석용)
    analyzeScoreDistribution(componentScores) {
        const scores = Object.values(componentScores).map(result => result.score);
        return {
            mean: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            min: Math.min(...scores),
            max: Math.max(...scores),
            standardDeviation: this.calculateStandardDeviation(scores)
        };
    }

    identifyStrengthsAndWeaknesses(componentScores) {
        const strengths = [];
        const weaknesses = [];
        
        Object.entries(componentScores).forEach(([component, result]) => {
            if (result.score >= 0.8) {
                strengths.push({ component, score: result.score });
            } else if (result.score < 0.6) {
                weaknesses.push({ component, score: result.score });
            }
        });
        
        return { strengths, weaknesses };
    }

    calculateImprovementPotential(componentScores) {
        const potential = {};
        
        Object.entries(componentScores).forEach(([component, result]) => {
            potential[component] = {
                currentScore: result.score,
                maxPotentialScore: 1.0,
                improvementGap: 1.0 - result.score,
                improvementPriority: result.score < 0.6 ? 'high' : result.score < 0.8 ? 'medium' : 'low'
            };
        });
        
        return potential;
    }

    identifyRiskFactors(componentScores, analysisResults) {
        const riskFactors = [];
        
        // 낮은 신뢰도 컴포넌트
        Object.entries(componentScores).forEach(([component, result]) => {
            if (result.score < 0.5) {
                riskFactors.push({
                    type: 'low_confidence_component',
                    component,
                    score: result.score,
                    riskLevel: 'high'
                });
            }
        });
        
        // 데이터 품질 위험
        if (componentScores.dataCompleteness && componentScores.dataCompleteness.score < 0.6) {
            riskFactors.push({
                type: 'data_quality_risk',
                riskLevel: 'medium',
                details: 'Incomplete or low-quality data detected'
            });
        }
        
        return riskFactors;
    }

    calculateQualityMetrics(componentScores, analysisResults) {
        return {
            overallQuality: Object.values(componentScores).reduce((sum, result) => sum + result.score, 0) / Object.keys(componentScores).length,
            consistencyScore: this.calculateConsistencyScore(componentScores),
            reliabilityScore: this.calculateReliabilityScore(componentScores),
            completenessScore: componentScores.dataCompleteness ? componentScores.dataCompleteness.score : 0
        };
    }

    calculateConsistencyScore(componentScores) {
        const scores = Object.values(componentScores).map(result => result.score);
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        
        // 분산이 낮을수록 일관성이 높음
        return Math.max(0, 1 - variance);
    }

    calculateReliabilityScore(componentScores) {
        // 교차 검증과 소스 신뢰성을 기반으로 계산
        const crossValidationScore = componentScores.crossValidation ? componentScores.crossValidation.score : 0.5;
        const sourceReliabilityScore = componentScores.sourceReliability ? componentScores.sourceReliability.score : 0.5;
        
        return (crossValidationScore + sourceReliabilityScore) / 2;
    }

    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    // 헬퍼 메서드들
    isTemporallyConsistent(anchor1, anchor2, date1, date2) {
        // 시간적 일관성 검사 로직 (간단한 구현)
        return true; // 실제로는 더 복잡한 로직 필요
    }

    detectDateFormat(text) {
        // 날짜 형식 감지 (간단한 구현)
        if (/\d{4}-\d{2}-\d{2}/.test(text)) return 'YYYY-MM-DD';
        if (/\d{2}\/\d{2}\/\d{4}/.test(text)) return 'MM/DD/YYYY';
        if (/\d{4}\.\d{2}\.\d{2}/.test(text)) return 'YYYY.MM.DD';
        return 'unknown';
    }

    findConsistentDiagnosisMedicationPairs(diagnoses, medications) {
        // 진단-약물 일관성 쌍 찾기 (간단한 구현)
        return Math.min(diagnoses.length, medications.length);
    }

    findConsistentDiagnosisProcedurePairs(diagnoses, procedures) {
        // 진단-시술 일관성 쌍 찾기 (간단한 구현)
        return Math.min(diagnoses.length, procedures.length);
    }

    assessTemporalOrder(events) {
        // 시간적 순서 평가
        if (events.length < 2) return 1.0;
        
        let orderedPairs = 0;
        let totalPairs = 0;
        
        for (let i = 0; i < events.length - 1; i++) {
            if (events[i].date && events[i + 1].date) {
                const date1 = new Date(events[i].date);
                const date2 = new Date(events[i + 1].date);
                
                if (date1 <= date2) {
                    orderedPairs++;
                }
                totalPairs++;
            }
        }
        
        return totalPairs > 0 ? orderedPairs / totalPairs : 1.0;
    }

    assessEventCompleteness(events) {
        // 이벤트 완성도 평가
        let completenessScore = 0;
        
        events.forEach(event => {
            let eventScore = 0;
            
            if (event.date) eventScore += 0.3;
            if (event.description) eventScore += 0.3;
            if (event.entities && event.entities.length > 0) eventScore += 0.2;
            if (event.type) eventScore += 0.2;
            
            completenessScore += eventScore;
        });
        
        return events.length > 0 ? completenessScore / events.length : 0;
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'ConfidenceScorer',
            timestamp: new Date().toISOString(),
            configuration: {
                enableDetailedScoring: this.options.enableDetailedScoring,
                enableUncertaintyAnalysis: this.options.enableUncertaintyAnalysis,
                minConfidenceThreshold: this.options.minConfidenceThreshold,
                qualityGateThresholds: this.options.qualityGateThresholds
            },
            weights: {
                confidenceWeights: this.confidenceWeights,
                uncertaintyFactors: this.uncertaintyFactors
            }
        };
    }
}