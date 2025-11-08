// EvidenceBinder.js - 증거 연결 및 교차 검증 엔진
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

export default class EvidenceBinder {
    constructor(options = {}) {
        this.options = {
            enableCrossValidation: options.enableCrossValidation || true,
            enableEvidenceChaining: options.enableEvidenceChaining || true,
            minEvidenceThreshold: options.minEvidenceThreshold || 0.6,
            maxEvidenceDistance: options.maxEvidenceDistance || 100, // 문자 거리
            crossValidationWeight: options.crossValidationWeight || 0.3,
            evidenceChainWeight: options.evidenceChainWeight || 0.2,
            ...options
        };
        
        // 증거 타입별 가중치
        this.evidenceWeights = {
            direct_mention: 1.0,
            contextual_inference: 0.8,
            temporal_association: 0.7,
            semantic_similarity: 0.6,
            rule_based: 0.9,
            cross_reference: 0.8,
            statistical_correlation: 0.5
        };
        
        // 교차 검증 패턴
        this.crossValidationPatterns = {
            diagnosis_procedure: {
                weight: 0.9,
                description: '진단-시술 일치성 검증'
            },
            medication_diagnosis: {
                weight: 0.8,
                description: '약물-진단 일치성 검증'
            },
            temporal_consistency: {
                weight: 0.85,
                description: '시간적 일관성 검증'
            },
            anatomical_consistency: {
                weight: 0.7,
                description: '해부학적 일관성 검증'
            }
        };
        
        logService.info('EvidenceBinder initialized', { options: this.options });
    }

    /**
     * 메인 증거 연결 함수
     * @param {Object} analysisResults - 모든 분석 결과
     * @returns {Object} 증거가 연결된 분석 결과
     */
    async bindEvidence(analysisResults) {
        try {
            const startTime = Date.now();
            
            // 1. 입력 데이터 검증
            await this.validateInputData(analysisResults);
            
            // 2. 증거 추출 및 인덱싱
            const evidenceIndex = await this.buildEvidenceIndex(analysisResults);
            
            // 3. 엔티티별 증거 연결
            const entitiesWithEvidence = await this.bindEntityEvidence(
                analysisResults.entities, 
                evidenceIndex, 
                analysisResults
            );
            
            // 4. 교차 검증 수행
            let crossValidationResults = {};
            if (this.options.enableCrossValidation) {
                crossValidationResults = await this.performCrossValidation(
                    entitiesWithEvidence, 
                    analysisResults
                );
            }
            
            // 5. 증거 체인 구성
            let evidenceChains = [];
            if (this.options.enableEvidenceChaining) {
                evidenceChains = await this.buildEvidenceChains(
                    entitiesWithEvidence, 
                    analysisResults
                );
            }
            
            // 6. 신뢰도 재계산
            const updatedEntities = await this.recalculateConfidenceWithEvidence(
                entitiesWithEvidence, 
                crossValidationResults, 
                evidenceChains
            );
            
            // 7. 증거 품질 평가
            const evidenceQuality = await this.assessEvidenceQuality(
                updatedEntities, 
                crossValidationResults, 
                evidenceChains
            );
            
            // 8. 결과 구성
            const result = {
                ...analysisResults,
                entities: updatedEntities,
                evidenceBinding: {
                    evidenceIndex,
                    crossValidationResults,
                    evidenceChains,
                    evidenceQuality,
                    processingTimeMs: Date.now() - startTime,
                    statistics: await this.generateEvidenceStatistics(
                        updatedEntities, 
                        crossValidationResults, 
                        evidenceChains
                    )
                }
            };
            
            logService.info('Evidence binding completed', {
                entitiesProcessed: updatedEntities.length,
                crossValidations: Object.keys(crossValidationResults).length,
                evidenceChains: evidenceChains.length,
                processingTime: result.evidenceBinding.processingTimeMs,
                averageConfidenceImprovement: this.calculateConfidenceImprovement(
                    analysisResults.entities, 
                    updatedEntities
                )
            });
            
            return result;
            
        } catch (error) {
            logService.error('Evidence binding failed', { error: error.message });
            throw new Error(`EvidenceBinder failed: ${error.message}`);
        }
    }

    /**
     * 입력 데이터 검증
     */
    async validateInputData(analysisResults) {
        const requiredFields = ['entities', 'textSegments'];
        
        for (const field of requiredFields) {
            if (!analysisResults[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (!Array.isArray(analysisResults.entities) || analysisResults.entities.length === 0) {
            throw new Error('No entities found for evidence binding');
        }
    }

    /**
     * 증거 인덱스 구축
     */
    async buildEvidenceIndex(analysisResults) {
        const evidenceIndex = {
            textSegments: new Map(),
            entities: new Map(),
            anchors: new Map(),
            rules: new Map(),
            temporal: new Map(),
            spatial: new Map()
        };
        
        // 텍스트 세그먼트 인덱싱
        if (analysisResults.textSegments) {
            analysisResults.textSegments.forEach((segment, index) => {
                evidenceIndex.textSegments.set(index, {
                    ...segment,
                    index,
                    words: this.tokenizeText(segment.text || ''),
                    positions: this.calculateWordPositions(segment.text || '')
                });
            });
        }
        
        // 엔티티 인덱싱
        if (analysisResults.entities) {
            analysisResults.entities.forEach((entity, index) => {
                evidenceIndex.entities.set(entity.id || index, {
                    ...entity,
                    index,
                    normalizedText: (entity.normalizedText || entity.originalText || '').toLowerCase()
                });
            });
        }
        
        // 앵커 인덱싱
        if (analysisResults.anchors) {
            analysisResults.anchors.forEach((anchor, index) => {
                evidenceIndex.anchors.set(anchor.id || index, {
                    ...anchor,
                    index,
                    dateObj: new Date(anchor.date)
                });
            });
        }
        
        // 룰 결과 인덱싱
        if (analysisResults.ruleResults) {
            analysisResults.ruleResults.forEach((rule, index) => {
                evidenceIndex.rules.set(rule.id || index, {
                    ...rule,
                    index
                });
            });
        }
        
        // 시간적 관계 인덱싱
        if (analysisResults.timeline && analysisResults.timeline.events) {
            analysisResults.timeline.events.forEach((event, index) => {
                evidenceIndex.temporal.set(event.id || index, {
                    ...event,
                    index,
                    dateObj: new Date(event.date)
                });
            });
        }
        
        return evidenceIndex;
    }

    /**
     * 엔티티별 증거 연결
     */
    async bindEntityEvidence(entities, evidenceIndex, analysisResults) {
        const entitiesWithEvidence = [];
        
        for (const entity of entities) {
            const entityWithEvidence = { ...entity };
            
            // 기존 증거 보존
            entityWithEvidence.evidence = entity.evidence || [];
            
            // 1. 직접 언급 증거
            const directEvidence = await this.findDirectEvidence(entity, evidenceIndex);
            entityWithEvidence.evidence.push(...directEvidence);
            
            // 2. 맥락적 증거
            const contextualEvidence = await this.findContextualEvidence(entity, evidenceIndex);
            entityWithEvidence.evidence.push(...contextualEvidence);
            
            // 3. 시간적 증거
            const temporalEvidence = await this.findTemporalEvidence(entity, evidenceIndex);
            entityWithEvidence.evidence.push(...temporalEvidence);
            
            // 4. 룰 기반 증거
            const ruleEvidence = await this.findRuleEvidence(entity, evidenceIndex);
            entityWithEvidence.evidence.push(...ruleEvidence);
            
            // 5. 교차 참조 증거
            const crossRefEvidence = await this.findCrossReferenceEvidence(entity, evidenceIndex);
            entityWithEvidence.evidence.push(...crossRefEvidence);
            
            // 6. 증거 중복 제거 및 정렬
            entityWithEvidence.evidence = this.deduplicateAndSortEvidence(entityWithEvidence.evidence);
            
            // 7. 증거 품질 점수 계산
            entityWithEvidence.evidenceQualityScore = this.calculateEvidenceQualityScore(
                entityWithEvidence.evidence
            );
            
            entitiesWithEvidence.push(entityWithEvidence);
        }
        
        return entitiesWithEvidence;
    }

    /**
     * 직접 언급 증거 찾기
     */
    async findDirectEvidence(entity, evidenceIndex) {
        const evidence = [];
        const entityText = (entity.originalText || '').toLowerCase();
        const normalizedText = (entity.normalizedText || '').toLowerCase();
        
        // 텍스트 세그먼트에서 직접 언급 찾기
        for (const [segmentId, segment] of evidenceIndex.textSegments) {
            const segmentText = (segment.text || '').toLowerCase();
            
            // 정확한 매치
            if (segmentText.includes(entityText) || segmentText.includes(normalizedText)) {
                const startIndex = segmentText.indexOf(entityText) !== -1 ? 
                    segmentText.indexOf(entityText) : segmentText.indexOf(normalizedText);
                
                evidence.push({
                    type: 'direct_mention',
                    source: 'text_segment',
                    sourceId: segmentId,
                    text: segment.text,
                    position: {
                        start: startIndex,
                        end: startIndex + (entityText.length || normalizedText.length)
                    },
                    confidence: 0.95,
                    weight: this.evidenceWeights.direct_mention,
                    context: this.extractContext(segment.text, startIndex, 50)
                });
            }
        }
        
        return evidence;
    }

    /**
     * 맥락적 증거 찾기
     */
    async findContextualEvidence(entity, evidenceIndex) {
        const evidence = [];
        const entityType = entity.type;
        const entityText = (entity.originalText || entity.normalizedText || '').toLowerCase();
        
        // 관련 키워드 정의
        const contextKeywords = this.getContextKeywords(entityType);
        
        for (const [segmentId, segment] of evidenceIndex.textSegments) {
            const segmentText = (segment.text || '').toLowerCase();
            
            // 맥락 키워드와의 근접성 확인
            for (const keyword of contextKeywords) {
                if (segmentText.includes(keyword)) {
                    const keywordIndex = segmentText.indexOf(keyword);
                    const entityIndex = segmentText.indexOf(entityText);
                    
                    if (entityIndex !== -1) {
                        const distance = Math.abs(keywordIndex - entityIndex);
                        
                        if (distance <= this.options.maxEvidenceDistance) {
                            const confidence = Math.max(0.3, 1 - (distance / this.options.maxEvidenceDistance));
                            
                            evidence.push({
                                type: 'contextual_inference',
                                source: 'text_segment',
                                sourceId: segmentId,
                                text: segment.text,
                                keyword,
                                distance,
                                confidence,
                                weight: this.evidenceWeights.contextual_inference,
                                context: this.extractContext(segment.text, Math.min(keywordIndex, entityIndex), 100)
                            });
                        }
                    }
                }
            }
        }
        
        return evidence;
    }

    /**
     * 시간적 증거 찾기
     */
    async findTemporalEvidence(entity, evidenceIndex) {
        const evidence = [];
        
        // 엔티티와 연관된 시간적 앵커 찾기
        if (entity.dateIdentified || entity.datePerformed || entity.startDate) {
            const entityDate = new Date(entity.dateIdentified || entity.datePerformed || entity.startDate);
            
            for (const [anchorId, anchor] of evidenceIndex.anchors) {
                const timeDiff = Math.abs(entityDate - anchor.dateObj);
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
                
                // 7일 이내의 앵커는 시간적 증거로 간주
                if (daysDiff <= 7) {
                    const confidence = Math.max(0.4, 1 - (daysDiff / 7));
                    
                    evidence.push({
                        type: 'temporal_association',
                        source: 'anchor',
                        sourceId: anchorId,
                        anchorDate: anchor.date,
                        entityDate: entityDate.toISOString(),
                        daysDifference: daysDiff,
                        confidence,
                        weight: this.evidenceWeights.temporal_association,
                        context: anchor.context || ''
                    });
                }
            }
        }
        
        // 타임라인 이벤트와의 연관성
        for (const [eventId, event] of evidenceIndex.temporal) {
            if (event.entities && event.entities.some(e => 
                (e.id === entity.id) || 
                (e.originalText === entity.originalText) ||
                (e.normalizedText === entity.normalizedText)
            )) {
                evidence.push({
                    type: 'temporal_association',
                    source: 'timeline_event',
                    sourceId: eventId,
                    eventDate: event.date,
                    eventType: event.type,
                    confidence: event.confidence || 0.7,
                    weight: this.evidenceWeights.temporal_association,
                    context: event.description || ''
                });
            }
        }
        
        return evidence;
    }

    /**
     * 룰 기반 증거 찾기
     */
    async findRuleEvidence(entity, evidenceIndex) {
        const evidence = [];
        
        for (const [ruleId, rule] of evidenceIndex.rules) {
            if (rule.triggered && rule.matchedEntities) {
                const matchedEntity = rule.matchedEntities.find(e => 
                    e.id === entity.id || 
                    e.originalText === entity.originalText ||
                    e.normalizedText === entity.normalizedText
                );
                
                if (matchedEntity) {
                    evidence.push({
                        type: 'rule_based',
                        source: 'disease_rule',
                        sourceId: ruleId,
                        ruleName: rule.ruleName,
                        ruleType: rule.ruleType,
                        confidence: rule.confidence || 0.8,
                        weight: this.evidenceWeights.rule_based,
                        context: rule.description || '',
                        ruleConditions: rule.conditions || [],
                        matchDetails: matchedEntity
                    });
                }
            }
        }
        
        return evidence;
    }

    /**
     * 교차 참조 증거 찾기
     */
    async findCrossReferenceEvidence(entity, evidenceIndex) {
        const evidence = [];
        
        // 다른 엔티티와의 연관성 확인
        for (const [otherId, otherEntity] of evidenceIndex.entities) {
            if (otherId === (entity.id || entity.index)) continue;
            
            // 의미적 유사성 확인
            const similarity = this.calculateSemanticSimilarity(entity, otherEntity);
            if (similarity > 0.7) {
                evidence.push({
                    type: 'cross_reference',
                    source: 'entity_similarity',
                    sourceId: otherId,
                    relatedEntity: {
                        type: otherEntity.type,
                        text: otherEntity.originalText || otherEntity.normalizedText,
                        confidence: otherEntity.confidence
                    },
                    similarity,
                    confidence: similarity * 0.8,
                    weight: this.evidenceWeights.cross_reference,
                    context: `Similar to: ${otherEntity.originalText || otherEntity.normalizedText}`
                });
            }
            
            // 해부학적/의학적 연관성 확인
            const medicalRelation = this.checkMedicalRelation(entity, otherEntity);
            if (medicalRelation.related) {
                evidence.push({
                    type: 'cross_reference',
                    source: 'medical_relation',
                    sourceId: otherId,
                    relatedEntity: {
                        type: otherEntity.type,
                        text: otherEntity.originalText || otherEntity.normalizedText,
                        confidence: otherEntity.confidence
                    },
                    relationType: medicalRelation.type,
                    confidence: medicalRelation.confidence,
                    weight: this.evidenceWeights.cross_reference,
                    context: medicalRelation.description
                });
            }
        }
        
        return evidence;
    }

    /**
     * 교차 검증 수행
     */
    async performCrossValidation(entities, analysisResults) {
        const crossValidationResults = {};
        
        // 진단-시술 일치성 검증
        crossValidationResults.diagnosisProcedure = await this.validateDiagnosisProcedureConsistency(entities);
        
        // 약물-진단 일치성 검증
        crossValidationResults.medicationDiagnosis = await this.validateMedicationDiagnosisConsistency(entities);
        
        // 시간적 일관성 검증
        crossValidationResults.temporalConsistency = await this.validateTemporalConsistency(entities, analysisResults);
        
        // 해부학적 일관성 검증
        crossValidationResults.anatomicalConsistency = await this.validateAnatomicalConsistency(entities);
        
        // 전체 교차 검증 점수 계산
        crossValidationResults.overallScore = this.calculateOverallCrossValidationScore(crossValidationResults);
        
        return crossValidationResults;
    }

    /**
     * 진단-시술 일치성 검증
     */
    async validateDiagnosisProcedureConsistency(entities) {
        const diagnoses = entities.filter(e => e.type === 'diagnosis');
        const procedures = entities.filter(e => e.type === 'procedure');
        
        const validationResults = [];
        let totalScore = 0;
        let validationCount = 0;
        
        for (const diagnosis of diagnoses) {
            for (const procedure of procedures) {
                const consistency = this.checkDiagnosisProcedureConsistency(diagnosis, procedure);
                
                if (consistency.score > 0) {
                    validationResults.push({
                        diagnosis: {
                            text: diagnosis.originalText || diagnosis.normalizedText,
                            confidence: diagnosis.confidence
                        },
                        procedure: {
                            text: procedure.originalText || procedure.normalizedText,
                            confidence: procedure.confidence
                        },
                        consistencyScore: consistency.score,
                        explanation: consistency.explanation,
                        evidence: consistency.evidence
                    });
                    
                    totalScore += consistency.score;
                    validationCount++;
                }
            }
        }
        
        return {
            validations: validationResults,
            averageScore: validationCount > 0 ? totalScore / validationCount : 0,
            totalValidations: validationCount,
            weight: this.crossValidationPatterns.diagnosis_procedure.weight
        };
    }

    /**
     * 약물-진단 일치성 검증
     */
    async validateMedicationDiagnosisConsistency(entities) {
        const diagnoses = entities.filter(e => e.type === 'diagnosis');
        const medications = entities.filter(e => e.type === 'medication');
        
        const validationResults = [];
        let totalScore = 0;
        let validationCount = 0;
        
        for (const diagnosis of diagnoses) {
            for (const medication of medications) {
                const consistency = this.checkMedicationDiagnosisConsistency(diagnosis, medication);
                
                if (consistency.score > 0) {
                    validationResults.push({
                        diagnosis: {
                            text: diagnosis.originalText || diagnosis.normalizedText,
                            confidence: diagnosis.confidence
                        },
                        medication: {
                            text: medication.originalText || medication.normalizedText,
                            confidence: medication.confidence
                        },
                        consistencyScore: consistency.score,
                        explanation: consistency.explanation,
                        evidence: consistency.evidence
                    });
                    
                    totalScore += consistency.score;
                    validationCount++;
                }
            }
        }
        
        return {
            validations: validationResults,
            averageScore: validationCount > 0 ? totalScore / validationCount : 0,
            totalValidations: validationCount,
            weight: this.crossValidationPatterns.medication_diagnosis.weight
        };
    }

    /**
     * 시간적 일관성 검증
     */
    async validateTemporalConsistency(entities, analysisResults) {
        const temporalEntities = entities.filter(e => 
            e.dateIdentified || e.datePerformed || e.startDate || e.endDate
        );
        
        const inconsistencies = [];
        let consistentPairs = 0;
        let totalPairs = 0;
        
        for (let i = 0; i < temporalEntities.length; i++) {
            for (let j = i + 1; j < temporalEntities.length; j++) {
                const entity1 = temporalEntities[i];
                const entity2 = temporalEntities[j];
                
                const consistency = this.checkTemporalConsistency(entity1, entity2);
                totalPairs++;
                
                if (consistency.consistent) {
                    consistentPairs++;
                } else {
                    inconsistencies.push({
                        entity1: {
                            text: entity1.originalText || entity1.normalizedText,
                            date: entity1.dateIdentified || entity1.datePerformed || entity1.startDate,
                            type: entity1.type
                        },
                        entity2: {
                            text: entity2.originalText || entity2.normalizedText,
                            date: entity2.dateIdentified || entity2.datePerformed || entity2.startDate,
                            type: entity2.type
                        },
                        inconsistencyType: consistency.inconsistencyType,
                        explanation: consistency.explanation
                    });
                }
            }
        }
        
        return {
            consistencyScore: totalPairs > 0 ? consistentPairs / totalPairs : 1,
            inconsistencies,
            totalPairs,
            consistentPairs,
            weight: this.crossValidationPatterns.temporal_consistency.weight
        };
    }

    /**
     * 해부학적 일관성 검증
     */
    async validateAnatomicalConsistency(entities) {
        const anatomicalEntities = entities.filter(e => 
            e.anatomicalSite || e.bodyPart || (e.type === 'anatomical_site')
        );
        
        const validationResults = [];
        let totalScore = 0;
        let validationCount = 0;
        
        for (let i = 0; i < anatomicalEntities.length; i++) {
            for (let j = i + 1; j < anatomicalEntities.length; j++) {
                const entity1 = anatomicalEntities[i];
                const entity2 = anatomicalEntities[j];
                
                const consistency = this.checkAnatomicalConsistency(entity1, entity2);
                
                if (consistency.score !== null) {
                    validationResults.push({
                        entity1: {
                            text: entity1.originalText || entity1.normalizedText,
                            anatomicalSite: entity1.anatomicalSite || entity1.bodyPart,
                            type: entity1.type
                        },
                        entity2: {
                            text: entity2.originalText || entity2.normalizedText,
                            anatomicalSite: entity2.anatomicalSite || entity2.bodyPart,
                            type: entity2.type
                        },
                        consistencyScore: consistency.score,
                        explanation: consistency.explanation
                    });
                    
                    totalScore += consistency.score;
                    validationCount++;
                }
            }
        }
        
        return {
            validations: validationResults,
            averageScore: validationCount > 0 ? totalScore / validationCount : 1,
            totalValidations: validationCount,
            weight: this.crossValidationPatterns.anatomical_consistency.weight
        };
    }

    /**
     * 증거 체인 구성
     */
    async buildEvidenceChains(entities, analysisResults) {
        const evidenceChains = [];
        
        // 각 엔티티에 대해 증거 체인 구성
        for (const entity of entities) {
            if (!entity.evidence || entity.evidence.length < 2) continue;
            
            const chain = await this.constructEvidenceChain(entity, entities, analysisResults);
            
            if (chain.strength > this.options.minEvidenceThreshold) {
                evidenceChains.push(chain);
            }
        }
        
        // 체인 강도순으로 정렬
        return evidenceChains.sort((a, b) => b.strength - a.strength);
    }

    /**
     * 개별 증거 체인 구성
     */
    async constructEvidenceChain(entity, allEntities, analysisResults) {
        const chain = {
            entityId: entity.id || entity.index,
            entityText: entity.originalText || entity.normalizedText,
            entityType: entity.type,
            links: [],
            strength: 0,
            confidence: entity.confidence || 0
        };
        
        // 직접 증거 링크
        const directEvidence = entity.evidence.filter(e => e.type === 'direct_mention');
        directEvidence.forEach(evidence => {
            chain.links.push({
                type: 'direct',
                source: evidence.source,
                confidence: evidence.confidence,
                weight: evidence.weight,
                description: `직접 언급: ${evidence.context}`
            });
        });
        
        // 교차 참조 링크
        const crossRefEvidence = entity.evidence.filter(e => e.type === 'cross_reference');
        crossRefEvidence.forEach(evidence => {
            chain.links.push({
                type: 'cross_reference',
                source: evidence.source,
                relatedEntity: evidence.relatedEntity,
                confidence: evidence.confidence,
                weight: evidence.weight,
                description: evidence.context
            });
        });
        
        // 시간적 링크
        const temporalEvidence = entity.evidence.filter(e => e.type === 'temporal_association');
        temporalEvidence.forEach(evidence => {
            chain.links.push({
                type: 'temporal',
                source: evidence.source,
                temporalRelation: {
                    anchorDate: evidence.anchorDate,
                    entityDate: evidence.entityDate,
                    daysDifference: evidence.daysDifference
                },
                confidence: evidence.confidence,
                weight: evidence.weight,
                description: evidence.context
            });
        });
        
        // 룰 기반 링크
        const ruleEvidence = entity.evidence.filter(e => e.type === 'rule_based');
        ruleEvidence.forEach(evidence => {
            chain.links.push({
                type: 'rule',
                source: evidence.source,
                rule: {
                    name: evidence.ruleName,
                    type: evidence.ruleType,
                    conditions: evidence.ruleConditions
                },
                confidence: evidence.confidence,
                weight: evidence.weight,
                description: evidence.context
            });
        });
        
        // 체인 강도 계산
        chain.strength = this.calculateChainStrength(chain.links);
        
        return chain;
    }

    /**
     * 신뢰도 재계산
     */
    async recalculateConfidenceWithEvidence(entities, crossValidationResults, evidenceChains) {
        const updatedEntities = [];
        
        for (const entity of entities) {
            const updatedEntity = { ...entity };
            
            // 기본 신뢰도
            let baseConfidence = entity.confidence || 0.5;
            
            // 증거 기반 신뢰도 조정
            const evidenceBoost = this.calculateEvidenceBoost(entity.evidence || []);
            
            // 교차 검증 기반 조정
            const crossValidationBoost = this.calculateCrossValidationBoost(
                entity, 
                crossValidationResults
            );
            
            // 증거 체인 기반 조정
            const evidenceChainBoost = this.calculateEvidenceChainBoost(
                entity, 
                evidenceChains
            );
            
            // 최종 신뢰도 계산
            updatedEntity.confidence = Math.min(1.0, Math.max(0.0, 
                baseConfidence + 
                (evidenceBoost * this.options.evidenceChainWeight) +
                (crossValidationBoost * this.options.crossValidationWeight) +
                (evidenceChainBoost * this.options.evidenceChainWeight)
            ));
            
            // 신뢰도 구성 요소 저장
            updatedEntity.confidenceBreakdown = {
                base: baseConfidence,
                evidenceBoost,
                crossValidationBoost,
                evidenceChainBoost,
                final: updatedEntity.confidence
            };
            
            updatedEntities.push(updatedEntity);
        }
        
        return updatedEntities;
    }

    /**
     * 증거 품질 평가
     */
    async assessEvidenceQuality(entities, crossValidationResults, evidenceChains) {
        const qualityMetrics = {
            averageEvidenceCount: 0,
            averageEvidenceQuality: 0,
            crossValidationScore: 0,
            evidenceChainStrength: 0,
            overallQuality: 0
        };
        
        // 평균 증거 개수
        const totalEvidence = entities.reduce((sum, entity) => 
            sum + (entity.evidence ? entity.evidence.length : 0), 0
        );
        qualityMetrics.averageEvidenceCount = entities.length > 0 ? totalEvidence / entities.length : 0;
        
        // 평균 증거 품질
        const totalEvidenceQuality = entities.reduce((sum, entity) => 
            sum + (entity.evidenceQualityScore || 0), 0
        );
        qualityMetrics.averageEvidenceQuality = entities.length > 0 ? totalEvidenceQuality / entities.length : 0;
        
        // 교차 검증 점수
        qualityMetrics.crossValidationScore = crossValidationResults.overallScore || 0;
        
        // 증거 체인 강도
        const totalChainStrength = evidenceChains.reduce((sum, chain) => sum + chain.strength, 0);
        qualityMetrics.evidenceChainStrength = evidenceChains.length > 0 ? totalChainStrength / evidenceChains.length : 0;
        
        // 전체 품질 점수
        qualityMetrics.overallQuality = (
            qualityMetrics.averageEvidenceQuality * 0.4 +
            qualityMetrics.crossValidationScore * 0.3 +
            qualityMetrics.evidenceChainStrength * 0.3
        );
        
        return qualityMetrics;
    }

    /**
     * 유틸리티 메서드들
     */
    tokenizeText(text) {
        return text.toLowerCase()
            .replace(/[^\w\s가-힣]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    calculateWordPositions(text) {
        const positions = [];
        const words = text.split(/\s+/);
        let currentPos = 0;
        
        words.forEach(word => {
            const startPos = text.indexOf(word, currentPos);
            positions.push({
                word,
                start: startPos,
                end: startPos + word.length
            });
            currentPos = startPos + word.length;
        });
        
        return positions;
    }

    extractContext(text, position, contextLength = 50) {
        const start = Math.max(0, position - contextLength);
        const end = Math.min(text.length, position + contextLength);
        return text.substring(start, end).trim();
    }

    getContextKeywords(entityType) {
        const keywordMap = {
            diagnosis: ['진단', '질병', '병명', '증상', '소견', 'diagnosis', 'disease'],
            procedure: ['수술', '시술', '처치', '검사', 'surgery', 'procedure', 'operation'],
            medication: ['약물', '투약', '처방', '복용', 'medication', 'drug', 'prescription'],
            test_result: ['검사', '결과', '수치', '소견', 'test', 'result', 'lab'],
            anatomical_site: ['부위', '위치', '해부', 'site', 'location', 'anatomy']
        };
        
        return keywordMap[entityType] || [];
    }

    calculateSemanticSimilarity(entity1, entity2) {
        const text1 = (entity1.normalizedText || entity1.originalText || '').toLowerCase();
        const text2 = (entity2.normalizedText || entity2.originalText || '').toLowerCase();
        
        if (text1 === text2) return 1.0;
        
        // 간단한 Jaccard 유사도 계산
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    checkMedicalRelation(entity1, entity2) {
        // 의학적 연관성 확인 로직 (간단한 버전)
        const medicalRelations = {
            'diagnosis-procedure': 0.8,
            'diagnosis-medication': 0.7,
            'procedure-medication': 0.6,
            'diagnosis-test': 0.7,
            'procedure-test': 0.6
        };
        
        const type1 = entity1.type;
        const type2 = entity2.type;
        
        const relationKey = `${type1}-${type2}`;
        const reverseKey = `${type2}-${type1}`;
        
        const confidence = medicalRelations[relationKey] || medicalRelations[reverseKey];
        
        if (confidence) {
            return {
                related: true,
                type: relationKey,
                confidence,
                description: `${type1}과 ${type2} 간의 의학적 연관성`
            };
        }
        
        return { related: false };
    }

    deduplicateAndSortEvidence(evidence) {
        // 중복 제거 (타입과 소스 기준)
        const uniqueEvidence = evidence.filter((item, index, array) => 
            index === array.findIndex(e => 
                e.type === item.type && 
                e.source === item.source && 
                e.sourceId === item.sourceId
            )
        );
        
        // 신뢰도와 가중치 기준으로 정렬
        return uniqueEvidence.sort((a, b) => {
            const scoreA = (a.confidence || 0) * (a.weight || 1);
            const scoreB = (b.confidence || 0) * (b.weight || 1);
            return scoreB - scoreA;
        });
    }

    calculateEvidenceQualityScore(evidence) {
        if (!evidence || evidence.length === 0) return 0;
        
        const totalScore = evidence.reduce((sum, item) => 
            sum + ((item.confidence || 0) * (item.weight || 1)), 0
        );
        
        const maxPossibleScore = evidence.length * 1.0; // 최대 신뢰도 * 최대 가중치
        
        return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    }

    calculateChainStrength(links) {
        if (!links || links.length === 0) return 0;
        
        const totalStrength = links.reduce((sum, link) => 
            sum + ((link.confidence || 0) * (link.weight || 1)), 0
        );
        
        // 링크 수에 따른 보너스 (더 많은 링크 = 더 강한 체인)
        const linkBonus = Math.min(0.2, links.length * 0.05);
        
        return Math.min(1.0, (totalStrength / links.length) + linkBonus);
    }

    calculateEvidenceBoost(evidence) {
        if (!evidence || evidence.length === 0) return 0;
        
        const qualityScore = this.calculateEvidenceQualityScore(evidence);
        const quantityBonus = Math.min(0.1, evidence.length * 0.02);
        
        return Math.min(0.3, qualityScore * 0.2 + quantityBonus);
    }

    calculateCrossValidationBoost(entity, crossValidationResults) {
        if (!crossValidationResults || !crossValidationResults.overallScore) return 0;
        
        return Math.min(0.2, crossValidationResults.overallScore * 0.15);
    }

    calculateEvidenceChainBoost(entity, evidenceChains) {
        const entityChain = evidenceChains.find(chain => 
            chain.entityId === entity.id || 
            chain.entityText === (entity.originalText || entity.normalizedText)
        );
        
        if (!entityChain) return 0;
        
        return Math.min(0.2, entityChain.strength * 0.15);
    }

    calculateOverallCrossValidationScore(crossValidationResults) {
        const scores = [];
        const weights = [];
        
        Object.entries(crossValidationResults).forEach(([key, result]) => {
            if (key !== 'overallScore' && result.averageScore !== undefined) {
                scores.push(result.averageScore);
                weights.push(result.weight || 1);
            }
        });
        
        if (scores.length === 0) return 0;
        
        const weightedSum = scores.reduce((sum, score, index) => 
            sum + (score * weights[index]), 0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    checkDiagnosisProcedureConsistency(diagnosis, procedure) {
        // 간단한 일치성 확인 로직
        const diagnosisText = (diagnosis.normalizedText || diagnosis.originalText || '').toLowerCase();
        const procedureText = (procedure.normalizedText || procedure.originalText || '').toLowerCase();
        
        // 키워드 기반 매칭
        const commonKeywords = this.findCommonKeywords(diagnosisText, procedureText);
        
        if (commonKeywords.length > 0) {
            const score = Math.min(1.0, commonKeywords.length * 0.3);
            return {
                score,
                explanation: `공통 키워드 발견: ${commonKeywords.join(', ')}`,
                evidence: commonKeywords
            };
        }
        
        return { score: 0, explanation: '일치성 없음', evidence: [] };
    }

    checkMedicationDiagnosisConsistency(diagnosis, medication) {
        // 간단한 약물-진단 일치성 확인
        const diagnosisText = (diagnosis.normalizedText || diagnosis.originalText || '').toLowerCase();
        const medicationText = (medication.normalizedText || medication.originalText || '').toLowerCase();
        
        // 일반적인 약물-질병 매핑 (예시)
        const commonMappings = {
            '고혈압': ['혈압약', 'ace억제제', '이뇨제'],
            '당뇨': ['인슐린', '메트포르민', '혈당강하제'],
            '감염': ['항생제', '항균제'],
            '통증': ['진통제', '소염제']
        };
        
        for (const [condition, medications] of Object.entries(commonMappings)) {
            if (diagnosisText.includes(condition)) {
                const matchingMeds = medications.filter(med => medicationText.includes(med));
                if (matchingMeds.length > 0) {
                    return {
                        score: 0.8,
                        explanation: `${condition}에 대한 적절한 약물 치료`,
                        evidence: matchingMeds
                    };
                }
            }
        }
        
        return { score: 0, explanation: '약물-진단 일치성 없음', evidence: [] };
    }

    checkTemporalConsistency(entity1, entity2) {
        const date1 = new Date(entity1.dateIdentified || entity1.datePerformed || entity1.startDate);
        const date2 = new Date(entity2.dateIdentified || entity2.datePerformed || entity2.startDate);
        
        // 논리적으로 불가능한 시간 순서 확인
        const timeDiff = date2 - date1;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        // 예: 퇴원이 입원보다 먼저 일어날 수 없음
        if (entity1.type === 'discharge' && entity2.type === 'admission' && daysDiff > 0) {
            return {
                consistent: false,
                inconsistencyType: 'discharge_before_admission',
                explanation: '퇴원이 입원보다 먼저 발생'
            };
        }
        
        // 예: 수술 후 진단이 수술보다 훨씬 늦게 일어날 수 없음
        if (entity1.type === 'procedure' && entity2.type === 'diagnosis' && daysDiff > 30) {
            return {
                consistent: false,
                inconsistencyType: 'late_diagnosis',
                explanation: '진단이 시술보다 30일 이상 늦음'
            };
        }
        
        return { consistent: true };
    }

    checkAnatomicalConsistency(entity1, entity2) {
        const site1 = (entity1.anatomicalSite || entity1.bodyPart || '').toLowerCase();
        const site2 = (entity2.anatomicalSite || entity2.bodyPart || '').toLowerCase();
        
        if (!site1 || !site2) return { score: null };
        
        // 해부학적 일관성 확인 (간단한 버전)
        const anatomicalGroups = {
            '심장': ['심장', '심실', '심방', '관상동맥'],
            '폐': ['폐', '기관지', '폐포'],
            '간': ['간', '담낭', '담관'],
            '신장': ['신장', '요관', '방광']
        };
        
        for (const [organ, parts] of Object.entries(anatomicalGroups)) {
            const site1InGroup = parts.some(part => site1.includes(part));
            const site2InGroup = parts.some(part => site2.includes(part));
            
            if (site1InGroup && site2InGroup) {
                return {
                    score: 0.9,
                    explanation: `${organ} 관련 해부학적 일관성`
                };
            }
        }
        
        return {
            score: site1 === site2 ? 1.0 : 0.3,
            explanation: site1 === site2 ? '동일한 해부학적 부위' : '다른 해부학적 부위'
        };
    }

    findCommonKeywords(text1, text2) {
        const words1 = new Set(text1.split(/\s+/).filter(word => word.length > 2));
        const words2 = new Set(text2.split(/\s+/).filter(word => word.length > 2));
        
        return [...words1].filter(word => words2.has(word));
    }

    calculateConfidenceImprovement(originalEntities, updatedEntities) {
        if (originalEntities.length !== updatedEntities.length) return 0;
        
        let totalImprovement = 0;
        
        for (let i = 0; i < originalEntities.length; i++) {
            const originalConfidence = originalEntities[i].confidence || 0;
            const updatedConfidence = updatedEntities[i].confidence || 0;
            totalImprovement += (updatedConfidence - originalConfidence);
        }
        
        return originalEntities.length > 0 ? totalImprovement / originalEntities.length : 0;
    }

    async generateEvidenceStatistics(entities, crossValidationResults, evidenceChains) {
        const stats = {
            totalEntities: entities.length,
            entitiesWithEvidence: entities.filter(e => e.evidence && e.evidence.length > 0).length,
            averageEvidencePerEntity: 0,
            evidenceTypeDistribution: {},
            crossValidationScore: crossValidationResults.overallScore || 0,
            evidenceChainCount: evidenceChains.length,
            averageChainStrength: 0,
            confidenceImprovement: 0
        };
        
        // 평균 증거 개수
        const totalEvidence = entities.reduce((sum, entity) => 
            sum + (entity.evidence ? entity.evidence.length : 0), 0
        );
        stats.averageEvidencePerEntity = entities.length > 0 ? totalEvidence / entities.length : 0;
        
        // 증거 타입 분포
        entities.forEach(entity => {
            if (entity.evidence) {
                entity.evidence.forEach(evidence => {
                    stats.evidenceTypeDistribution[evidence.type] = 
                        (stats.evidenceTypeDistribution[evidence.type] || 0) + 1;
                });
            }
        });
        
        // 평균 체인 강도
        if (evidenceChains.length > 0) {
            const totalStrength = evidenceChains.reduce((sum, chain) => sum + chain.strength, 0);
            stats.averageChainStrength = totalStrength / evidenceChains.length;
        }
        
        return stats;
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'EvidenceBinder',
            timestamp: new Date().toISOString(),
            configuration: {
                enableCrossValidation: this.options.enableCrossValidation,
                enableEvidenceChaining: this.options.enableEvidenceChaining,
                minEvidenceThreshold: this.options.minEvidenceThreshold,
                maxEvidenceDistance: this.options.maxEvidenceDistance
            },
            evidenceWeights: this.evidenceWeights,
            crossValidationPatterns: this.crossValidationPatterns
        };
    }
}