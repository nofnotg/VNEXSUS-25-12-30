// DisclosureAnalyzer.js - 보험 고지의무 분석 엔진
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

// Master Plan Phase 1.2: Dispute Layer Integration (Feature Flag Protected)
import { createDisputeTag, findIndexEvent } from './utils/DisputeScoringUtil.js';
import { ContractInfo, ClaimSpec } from './DataContracts.js';


export default class DisclosureAnalyzer {
    constructor(options = {}) {
        this.options = {
            strictMode: options.strictMode || false,
            confidenceThreshold: options.confidenceThreshold || 0.7,
            riskThreshold: options.riskThreshold || 0.6,
            enableDetailedAnalysis: options.enableDetailedAnalysis || true,
            ...options
        };

        // 고지의무 대상 질환 및 시술 매핑
        this.disclosureMapping = this.initializeDisclosureMapping();

        // 위험도 가중치
        this.riskWeights = {
            chronic: 0.9,      // 만성질환
            acute: 0.6,        // 급성질환
            surgery: 0.8,      // 수술
            medication: 0.5,   // 약물치료
            hospitalization: 0.7, // 입원
            emergency: 0.9     // 응급실
        };

        logService.info('DisclosureAnalyzer initialized', { options: this.options });
    }

    /**
     * 메인 고지의무 분석 함수
     * @param {Array} ruleResults - DiseaseRuleEngine 결과
     * @param {Array} entities - 정규화된 엔티티들
     * @param {Object} timeline - 타임라인 데이터
     * @param {Object} contractInfo - 계약 정보 (optional, for DisputeTag)
     * @param {Object} claimSpec - 청구 정보 (optional, for DisputeTag)
     * @returns {Object} 고지의무 분석 결과
     */
    async analyzeDisclosure(ruleResults, entities, timeline, contractInfo = null, claimSpec = null) {
        try {
            const startTime = Date.now();

            // 1. 고지의무 대상 항목 식별
            const disclosureItems = await this.identifyDisclosureItems(entities, timeline);

            // 2. 위험도 평가
            const riskAssessment = await this.assessRisk(disclosureItems, ruleResults);

            // 3. 고지 권고사항 생성
            const recommendations = await this.generateRecommendations(disclosureItems, riskAssessment);

            // 4. 상세 분석 (옵션)
            const detailedAnalysis = this.options.enableDetailedAnalysis ?
                await this.performDetailedAnalysis(disclosureItems, entities, timeline) : null;

            // 5. Master Plan Phase 1.2: DisputeTag 생성 (Feature Flag)
            if (process.env.ENABLE_DISPUTE_TAGGING === 'true' && contractInfo && claimSpec && timeline.events) {
                try {
                    logService.info('DisputeTag generation enabled', {
                        contractInfo: !!contractInfo,
                        claimSpec: !!claimSpec,
                        eventCount: timeline.events.length
                    });

                    // Index event 찾기
                    const timelineContext = {
                        indexEventDate: claimSpec.claimDate || null
                    };

                    if (!timelineContext.indexEventDate) {
                        const indexEvent = findIndexEvent(timeline.events, claimSpec);
                        if (indexEvent) {
                            timelineContext.indexEventDate = indexEvent.date || indexEvent.anchor?.date;
                        }
                    }

                    // 각 타임라인 이벤트에 DisputeTag 추가
                    for (const event of timeline.events) {
                        if (!event.disputeTag) { // 이미 있으면 건너뛰기
                            event.disputeTag = createDisputeTag(event, claimSpec, contractInfo, timelineContext);
                        }
                    }

                    logService.info('DisputeTag generation completed', {
                        taggedEvents: timeline.events.filter(e => e.disputeTag).length
                    });
                } catch (disputeError) {
                    // DisputeTag 생성 실패는 전체 분석을 중단하지 않음
                    logService.warn('DisputeTag generation failed', {
                        error: disputeError.message
                    });
                }
            }

            // 6. 결과 통합
            const result = {
                disclosureRequired: this.determineDisclosureRequirement(riskAssessment),
                overallRiskScore: riskAssessment.overallRiskScore,
                disclosureItems,
                riskAssessment,
                recommendations,
                detailedAnalysis,
                summary: this.generateSummary(disclosureItems, riskAssessment),
                processingTimeMs: Date.now() - startTime,
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    component: 'DisclosureAnalyzer',
                    strictMode: this.options.strictMode,
                    disputeTaggingEnabled: process.env.ENABLE_DISPUTE_TAGGING === 'true'
                }
            };

            logService.info('Disclosure analysis completed', {
                disclosureRequired: result.disclosureRequired,
                riskScore: result.overallRiskScore,
                itemCount: disclosureItems.length,
                processingTime: result.processingTimeMs,
                disputeTaggingEnabled: result.metadata.disputeTaggingEnabled
            });

            return result;

        } catch (error) {
            logService.error('Disclosure analysis failed', { error: error.message });
            throw new Error(`DisclosureAnalyzer failed: ${error.message}`);
        }
    }

    /**
     * 고지의무 대상 항목 식별
     */
    async identifyDisclosureItems(entities, timeline) {
        const disclosureItems = [];

        // 진단 기반 고지의무 항목
        const diagnoses = entities.filter(e => e.type === 'diagnosis');
        for (const diagnosis of diagnoses) {
            const disclosureInfo = this.getDisclosureInfoForDiagnosis(diagnosis);
            if (disclosureInfo) {
                disclosureItems.push({
                    id: `diagnosis_${diagnosis.id || Math.random()}`,
                    type: 'diagnosis',
                    entity: diagnosis,
                    disclosureInfo,
                    confidence: diagnosis.confidence || 0.5,
                    severity: disclosureInfo.severity,
                    category: disclosureInfo.category
                });
            }
        }

        // 시술/수술 기반 고지의무 항목
        const procedures = entities.filter(e => e.type === 'procedure');
        for (const procedure of procedures) {
            const disclosureInfo = this.getDisclosureInfoForProcedure(procedure);
            if (disclosureInfo) {
                disclosureItems.push({
                    id: `procedure_${procedure.id || Math.random()}`,
                    type: 'procedure',
                    entity: procedure,
                    disclosureInfo,
                    confidence: procedure.confidence || 0.5,
                    severity: disclosureInfo.severity,
                    category: disclosureInfo.category
                });
            }
        }

        // 약물 기반 고지의무 항목
        const medications = entities.filter(e => e.type === 'medication');
        for (const medication of medications) {
            const disclosureInfo = this.getDisclosureInfoForMedication(medication);
            if (disclosureInfo) {
                disclosureItems.push({
                    id: `medication_${medication.id || Math.random()}`,
                    type: 'medication',
                    entity: medication,
                    disclosureInfo,
                    confidence: medication.confidence || 0.5,
                    severity: disclosureInfo.severity,
                    category: disclosureInfo.category
                });
            }
        }

        // 입원/응급실 방문 기반 고지의무 항목
        const hospitalizations = this.identifyHospitalizations(timeline);
        for (const hospitalization of hospitalizations) {
            disclosureItems.push({
                id: `hospitalization_${Math.random()}`,
                type: 'hospitalization',
                entity: hospitalization,
                disclosureInfo: {
                    category: 'hospitalization',
                    severity: hospitalization.type === 'emergency' ? 'high' : 'medium',
                    description: `${hospitalization.type} 방문`,
                    disclosureRequired: true
                },
                confidence: 0.9,
                severity: hospitalization.type === 'emergency' ? 'high' : 'medium',
                category: 'hospitalization'
            });
        }

        // 중복 제거 및 정렬
        return this.deduplicateAndSortItems(disclosureItems);
    }

    /**
     * 위험도 평가
     */
    async assessRisk(disclosureItems, ruleResults) {
        const riskFactors = [];
        let totalRiskScore = 0;

        // 개별 항목 위험도 계산
        for (const item of disclosureItems) {
            const itemRisk = this.calculateItemRisk(item);
            riskFactors.push(itemRisk);
            totalRiskScore += itemRisk.riskScore * itemRisk.weight;
        }

        // 룰 결과 기반 위험도 조정
        const ruleRiskAdjustment = this.calculateRuleRiskAdjustment(ruleResults);
        totalRiskScore += ruleRiskAdjustment.adjustment;

        // 시간적 패턴 기반 위험도 조정
        const temporalRiskAdjustment = this.calculateTemporalRiskAdjustment(disclosureItems);
        totalRiskScore += temporalRiskAdjustment.adjustment;

        // 전체 위험도 정규화 (0-1 범위)
        const overallRiskScore = Math.min(Math.max(totalRiskScore, 0), 1);

        return {
            overallRiskScore,
            riskLevel: this.determineRiskLevel(overallRiskScore),
            riskFactors,
            adjustments: {
                ruleBasedAdjustment: ruleRiskAdjustment,
                temporalAdjustment: temporalRiskAdjustment
            },
            breakdown: {
                diagnosisRisk: this.calculateCategoryRisk(riskFactors, 'diagnosis'),
                procedureRisk: this.calculateCategoryRisk(riskFactors, 'procedure'),
                medicationRisk: this.calculateCategoryRisk(riskFactors, 'medication'),
                hospitalizationRisk: this.calculateCategoryRisk(riskFactors, 'hospitalization')
            }
        };
    }

    /**
     * 고지 권고사항 생성
     */
    async generateRecommendations(disclosureItems, riskAssessment) {
        const recommendations = [];

        // 전체 고지 권고
        if (riskAssessment.overallRiskScore >= this.options.riskThreshold) {
            recommendations.push({
                type: 'disclosure_required',
                priority: 'high',
                message: '보험 가입 시 고지의무 대상 항목이 확인되었습니다.',
                details: `위험도 점수: ${(riskAssessment.overallRiskScore * 100).toFixed(1)}%`,
                actionRequired: true
            });
        }

        // 카테고리별 권고사항
        const categoryRecommendations = this.generateCategoryRecommendations(disclosureItems, riskAssessment);
        recommendations.push(...categoryRecommendations);

        // 개별 항목별 권고사항
        const itemRecommendations = this.generateItemRecommendations(disclosureItems);
        recommendations.push(...itemRecommendations);

        // 추가 검토 권고사항
        const reviewRecommendations = this.generateReviewRecommendations(riskAssessment);
        recommendations.push(...reviewRecommendations);

        return this.prioritizeRecommendations(recommendations);
    }

    /**
     * 상세 분석 수행
     */
    async performDetailedAnalysis(disclosureItems, entities, timeline) {
        return {
            temporalAnalysis: this.analyzeTemporalPatterns(disclosureItems, timeline),
            severityAnalysis: this.analyzeSeverityDistribution(disclosureItems),
            categoryAnalysis: this.analyzeCategoryDistribution(disclosureItems),
            confidenceAnalysis: this.analyzeConfidenceDistribution(disclosureItems),
            correlationAnalysis: this.analyzeItemCorrelations(disclosureItems),
            treatmentPatterns: this.analyzeTreatmentPatterns(entities, timeline)
        };
    }

    /**
     * 고지의무 매핑 초기화
     */
    initializeDisclosureMapping() {
        return {
            diagnoses: {
                // 심혈관계 질환
                '고혈압': { category: 'cardiovascular', severity: 'high', disclosureRequired: true },
                '심근경색': { category: 'cardiovascular', severity: 'high', disclosureRequired: true },
                '협심증': { category: 'cardiovascular', severity: 'high', disclosureRequired: true },
                '부정맥': { category: 'cardiovascular', severity: 'medium', disclosureRequired: true },

                // 내분비계 질환
                '당뇨병': { category: 'endocrine', severity: 'high', disclosureRequired: true },
                '갑상선': { category: 'endocrine', severity: 'medium', disclosureRequired: true },

                // 호흡기계 질환
                '천식': { category: 'respiratory', severity: 'medium', disclosureRequired: true },
                '폐렴': { category: 'respiratory', severity: 'medium', disclosureRequired: true },

                // 소화기계 질환
                '위궤양': { category: 'digestive', severity: 'medium', disclosureRequired: true },
                '간염': { category: 'digestive', severity: 'high', disclosureRequired: true },

                // 신경계 질환
                '뇌졸중': { category: 'neurological', severity: 'high', disclosureRequired: true },
                '간질': { category: 'neurological', severity: 'high', disclosureRequired: true },

                // 정신과 질환
                '우울증': { category: 'psychiatric', severity: 'medium', disclosureRequired: true },
                '불안장애': { category: 'psychiatric', severity: 'medium', disclosureRequired: true },

                // 암
                '암': { category: 'cancer', severity: 'high', disclosureRequired: true },
                '종양': { category: 'cancer', severity: 'high', disclosureRequired: true }
            },

            procedures: {
                // 심혈관계 시술
                '심장수술': { category: 'cardiovascular_surgery', severity: 'high', disclosureRequired: true },
                '혈관성형술': { category: 'cardiovascular_surgery', severity: 'high', disclosureRequired: true },
                '스텐트': { category: 'cardiovascular_surgery', severity: 'high', disclosureRequired: true },

                // 신경외과 시술
                '뇌수술': { category: 'neurosurgery', severity: 'high', disclosureRequired: true },

                // 정형외과 시술
                '관절수술': { category: 'orthopedic_surgery', severity: 'medium', disclosureRequired: true },
                '척추수술': { category: 'orthopedic_surgery', severity: 'high', disclosureRequired: true },

                // 일반외과 시술
                '복부수술': { category: 'general_surgery', severity: 'medium', disclosureRequired: true },
                '담낭수술': { category: 'general_surgery', severity: 'medium', disclosureRequired: true }
            },

            medications: {
                // 심혈관계 약물
                '혈압약': { category: 'cardiovascular_med', severity: 'high', disclosureRequired: true },
                '항응고제': { category: 'cardiovascular_med', severity: 'high', disclosureRequired: true },

                // 내분비계 약물
                '인슐린': { category: 'endocrine_med', severity: 'high', disclosureRequired: true },
                '혈당강하제': { category: 'endocrine_med', severity: 'high', disclosureRequired: true },

                // 정신과 약물
                '항우울제': { category: 'psychiatric_med', severity: 'medium', disclosureRequired: true },
                '항불안제': { category: 'psychiatric_med', severity: 'medium', disclosureRequired: true },

                // 항암제
                '항암제': { category: 'cancer_med', severity: 'high', disclosureRequired: true }
            }
        };
    }

    /**
     * 진단에 대한 고지의무 정보 조회
     */
    getDisclosureInfoForDiagnosis(diagnosis) {
        const normalizedText = (diagnosis.standardTerm || diagnosis.normalizedText || '').toLowerCase();

        for (const [key, info] of Object.entries(this.disclosureMapping.diagnoses)) {
            if (normalizedText.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedText)) {
                return {
                    ...info,
                    description: `${key} 진단 이력`,
                    matchedTerm: key
                };
            }
        }

        return null;
    }

    /**
     * 시술에 대한 고지의무 정보 조회
     */
    getDisclosureInfoForProcedure(procedure) {
        const normalizedText = (procedure.standardTerm || procedure.normalizedText || '').toLowerCase();

        for (const [key, info] of Object.entries(this.disclosureMapping.procedures)) {
            if (normalizedText.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedText)) {
                return {
                    ...info,
                    description: `${key} 시술 이력`,
                    matchedTerm: key
                };
            }
        }

        return null;
    }

    /**
     * 약물에 대한 고지의무 정보 조회
     */
    getDisclosureInfoForMedication(medication) {
        const normalizedText = (medication.standardTerm || medication.normalizedText || '').toLowerCase();

        for (const [key, info] of Object.entries(this.disclosureMapping.medications)) {
            if (normalizedText.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedText)) {
                return {
                    ...info,
                    description: `${key} 복용 이력`,
                    matchedTerm: key
                };
            }
        }

        return null;
    }

    /**
     * 입원/응급실 방문 식별
     */
    identifyHospitalizations(timeline) {
        const hospitalizations = [];

        // 타임라인에서 입원/응급실 관련 이벤트 찾기
        if (timeline.events) {
            timeline.events.forEach(event => {
                const eventText = (event.description || '').toLowerCase();

                if (eventText.includes('입원') || eventText.includes('병원') || eventText.includes('admission')) {
                    hospitalizations.push({
                        type: 'hospitalization',
                        date: event.date,
                        description: event.description,
                        duration: event.duration
                    });
                } else if (eventText.includes('응급') || eventText.includes('emergency') || eventText.includes('er')) {
                    hospitalizations.push({
                        type: 'emergency',
                        date: event.date,
                        description: event.description
                    });
                }
            });
        }

        return hospitalizations;
    }

    /**
     * 항목 중복 제거 및 정렬
     */
    deduplicateAndSortItems(items) {
        // 중복 제거 (같은 타입과 엔티티)
        const uniqueItems = items.filter((item, index, self) =>
            index === self.findIndex(i =>
                i.type === item.type &&
                (i.entity.standardTerm || i.entity.normalizedText) === (item.entity.standardTerm || item.entity.normalizedText)
            )
        );

        // 심각도와 신뢰도로 정렬
        return uniqueItems.sort((a, b) => {
            const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);

            if (severityDiff !== 0) return severityDiff;
            return b.confidence - a.confidence;
        });
    }

    /**
     * 개별 항목 위험도 계산
     */
    calculateItemRisk(item) {
        const baseRisk = this.getBaseRiskForItem(item);
        const confidenceWeight = item.confidence || 0.5;
        const severityMultiplier = this.getSeverityMultiplier(item.severity);

        const riskScore = baseRisk * confidenceWeight * severityMultiplier;
        const weight = this.getItemWeight(item);

        return {
            itemId: item.id,
            itemType: item.type,
            baseRisk,
            confidenceWeight,
            severityMultiplier,
            riskScore,
            weight,
            category: item.category
        };
    }

    getBaseRiskForItem(item) {
        const baseRisks = {
            diagnosis: 0.8,
            procedure: 0.7,
            medication: 0.5,
            hospitalization: 0.6
        };

        return baseRisks[item.type] || 0.5;
    }

    getSeverityMultiplier(severity) {
        const multipliers = {
            high: 1.2,
            medium: 1.0,
            low: 0.8
        };

        return multipliers[severity] || 1.0;
    }

    getItemWeight(item) {
        return this.riskWeights[item.category] || 0.5;
    }

    /**
     * 룰 결과 기반 위험도 조정
     */
    calculateRuleRiskAdjustment(ruleResults) {
        let adjustment = 0;
        const factors = [];

        ruleResults.forEach(result => {
            if (result.status === 'success' && result.actionResult) {
                result.actionResult.actions.forEach(action => {
                    if (action.type === 'flag_disclosure_risk') {
                        const riskAdjustment = action.severity === 'high' ? 0.2 : 0.1;
                        adjustment += riskAdjustment;
                        factors.push({
                            ruleId: result.ruleId,
                            actionType: action.type,
                            severity: action.severity,
                            adjustment: riskAdjustment
                        });
                    }
                });
            }
        });

        return { adjustment, factors };
    }

    /**
     * 시간적 패턴 기반 위험도 조정
     */
    calculateTemporalRiskAdjustment(disclosureItems) {
        let adjustment = 0;
        const factors = [];

        // 최근 발생한 항목들에 대한 가중치 증가
        const now = new Date();
        disclosureItems.forEach(item => {
            if (item.entity.date) {
                const itemDate = new Date(item.entity.date);
                const daysDiff = (now - itemDate) / (1000 * 60 * 60 * 24);

                if (daysDiff <= 30) { // 최근 30일 이내
                    const recentAdjustment = 0.1;
                    adjustment += recentAdjustment;
                    factors.push({
                        itemId: item.id,
                        factor: 'recent_occurrence',
                        daysDiff,
                        adjustment: recentAdjustment
                    });
                }
            }
        });

        return { adjustment, factors };
    }

    /**
     * 카테고리별 위험도 계산
     */
    calculateCategoryRisk(riskFactors, category) {
        const categoryFactors = riskFactors.filter(f => f.category === category);
        if (categoryFactors.length === 0) return 0;

        return categoryFactors.reduce((sum, factor) => sum + factor.riskScore * factor.weight, 0) / categoryFactors.length;
    }

    /**
     * 위험도 레벨 결정
     */
    determineRiskLevel(riskScore) {
        if (riskScore >= 0.8) return 'high';
        if (riskScore >= 0.6) return 'medium';
        if (riskScore >= 0.3) return 'low';
        return 'minimal';
    }

    /**
     * 고지의무 필요성 결정
     */
    determineDisclosureRequirement(riskAssessment) {
        if (this.options.strictMode) {
            return riskAssessment.overallRiskScore > 0;
        }

        return riskAssessment.overallRiskScore >= this.options.riskThreshold;
    }

    /**
     * 카테고리별 권고사항 생성
     */
    generateCategoryRecommendations(disclosureItems, riskAssessment) {
        const recommendations = [];

        Object.entries(riskAssessment.breakdown).forEach(([category, riskScore]) => {
            if (riskScore >= this.options.riskThreshold) {
                const categoryItems = disclosureItems.filter(item =>
                    item.category.includes(category.replace('Risk', ''))
                );

                if (categoryItems.length > 0) {
                    recommendations.push({
                        type: 'category_disclosure',
                        category,
                        priority: riskScore >= 0.8 ? 'high' : 'medium',
                        message: `${category} 관련 고지의무 항목이 확인되었습니다.`,
                        itemCount: categoryItems.length,
                        riskScore,
                        actionRequired: true
                    });
                }
            }
        });

        return recommendations;
    }

    /**
     * 개별 항목별 권고사항 생성
     */
    generateItemRecommendations(disclosureItems) {
        const recommendations = [];

        disclosureItems.forEach(item => {
            if (item.confidence >= this.options.confidenceThreshold && item.severity === 'high') {
                recommendations.push({
                    type: 'item_disclosure',
                    itemId: item.id,
                    itemType: item.type,
                    priority: 'high',
                    message: `${item.disclosureInfo.description}에 대한 고지가 필요합니다.`,
                    details: {
                        entity: item.entity.standardTerm || item.entity.normalizedText,
                        confidence: item.confidence,
                        severity: item.severity
                    },
                    actionRequired: true
                });
            }
        });

        return recommendations;
    }

    /**
     * 추가 검토 권고사항 생성
     */
    generateReviewRecommendations(riskAssessment) {
        const recommendations = [];

        if (riskAssessment.riskLevel === 'high') {
            recommendations.push({
                type: 'additional_review',
                priority: 'high',
                message: '높은 위험도로 인해 전문가 검토가 권장됩니다.',
                details: {
                    riskScore: riskAssessment.overallRiskScore,
                    riskLevel: riskAssessment.riskLevel
                },
                actionRequired: false
            });
        }

        return recommendations;
    }

    /**
     * 권고사항 우선순위 정렬
     */
    prioritizeRecommendations(recommendations) {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };

        return recommendations.sort((a, b) => {
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;

            // 액션 필요 여부로 2차 정렬
            if (a.actionRequired && !b.actionRequired) return -1;
            if (!a.actionRequired && b.actionRequired) return 1;

            return 0;
        });
    }

    /**
     * 요약 생성
     */
    generateSummary(disclosureItems, riskAssessment) {
        return {
            totalItems: disclosureItems.length,
            highSeverityItems: disclosureItems.filter(item => item.severity === 'high').length,
            mediumSeverityItems: disclosureItems.filter(item => item.severity === 'medium').length,
            lowSeverityItems: disclosureItems.filter(item => item.severity === 'low').length,
            overallRiskLevel: riskAssessment.riskLevel,
            overallRiskScore: riskAssessment.overallRiskScore,
            categoryBreakdown: {
                diagnosis: disclosureItems.filter(item => item.type === 'diagnosis').length,
                procedure: disclosureItems.filter(item => item.type === 'procedure').length,
                medication: disclosureItems.filter(item => item.type === 'medication').length,
                hospitalization: disclosureItems.filter(item => item.type === 'hospitalization').length
            }
        };
    }

    /**
     * 분석 메서드들 (상세 분석용)
     */
    analyzeTemporalPatterns(disclosureItems, timeline) {
        // 시간적 패턴 분석 구현
        return {
            recentItems: disclosureItems.filter(item => {
                if (!item.entity.date) return false;
                const daysDiff = (new Date() - new Date(item.entity.date)) / (1000 * 60 * 60 * 24);
                return daysDiff <= 90;
            }).length,
            chronicItems: disclosureItems.filter(item =>
                item.disclosureInfo.category.includes('chronic') ||
                ['cardiovascular', 'endocrine', 'psychiatric'].includes(item.disclosureInfo.category)
            ).length
        };
    }

    analyzeSeverityDistribution(disclosureItems) {
        const distribution = { high: 0, medium: 0, low: 0 };
        disclosureItems.forEach(item => {
            distribution[item.severity] = (distribution[item.severity] || 0) + 1;
        });
        return distribution;
    }

    analyzeCategoryDistribution(disclosureItems) {
        const distribution = {};
        disclosureItems.forEach(item => {
            const category = item.disclosureInfo.category;
            distribution[category] = (distribution[category] || 0) + 1;
        });
        return distribution;
    }

    analyzeConfidenceDistribution(disclosureItems) {
        const confidences = disclosureItems.map(item => item.confidence);
        return {
            average: confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length,
            min: Math.min(...confidences),
            max: Math.max(...confidences),
            highConfidence: confidences.filter(conf => conf >= 0.8).length,
            mediumConfidence: confidences.filter(conf => conf >= 0.6 && conf < 0.8).length,
            lowConfidence: confidences.filter(conf => conf < 0.6).length
        };
    }

    analyzeItemCorrelations(disclosureItems) {
        // 항목 간 상관관계 분석 (간단한 구현)
        const correlations = [];

        for (let i = 0; i < disclosureItems.length; i++) {
            for (let j = i + 1; j < disclosureItems.length; j++) {
                const item1 = disclosureItems[i];
                const item2 = disclosureItems[j];

                if (item1.disclosureInfo.category === item2.disclosureInfo.category) {
                    correlations.push({
                        item1: item1.id,
                        item2: item2.id,
                        type: 'category_correlation',
                        strength: 0.7
                    });
                }
            }
        }

        return correlations;
    }

    analyzeTreatmentPatterns(entities, timeline) {
        // 치료 패턴 분석
        const medications = entities.filter(e => e.type === 'medication');
        const procedures = entities.filter(e => e.type === 'procedure');

        return {
            medicationCount: medications.length,
            procedureCount: procedures.length,
            chronicMedications: medications.filter(med =>
                ['혈압약', '인슐린', '항우울제'].some(chronic =>
                    (med.standardTerm || med.normalizedText || '').toLowerCase().includes(chronic.toLowerCase())
                )
            ).length
        };
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'DisclosureAnalyzer',
            timestamp: new Date().toISOString(),
            configuration: {
                strictMode: this.options.strictMode,
                confidenceThreshold: this.options.confidenceThreshold,
                riskThreshold: this.options.riskThreshold
            },
            mappingStats: {
                diagnosesCount: Object.keys(this.disclosureMapping.diagnoses).length,
                proceduresCount: Object.keys(this.disclosureMapping.procedures).length,
                medicationsCount: Object.keys(this.disclosureMapping.medications).length
            }
        };
    }
}