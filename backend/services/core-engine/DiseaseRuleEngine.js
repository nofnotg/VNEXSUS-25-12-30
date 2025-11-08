// DiseaseRuleEngine.js - 질환별 룰 플러그인 시스템 및 룰 실행 엔진
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

export default class DiseaseRuleEngine {
    constructor(options = {}) {
        this.options = {
            enableRuleChaining: options.enableRuleChaining || true,
            maxRuleDepth: options.maxRuleDepth || 5,
            ruleTimeout: options.ruleTimeout || 5000, // 5초
            enableRuleCaching: options.enableRuleCaching || true,
            ...options
        };
        
        this.rulePlugins = new Map();
        this.ruleCache = new Map();
        this.executionStats = {
            totalRulesExecuted: 0,
            successfulRules: 0,
            failedRules: 0,
            averageExecutionTime: 0
        };
        
        // 기본 룰 플러그인 로드
        this.loadDefaultRulePlugins();
        
        logService.info('DiseaseRuleEngine initialized', { options: this.options });
    }

    /**
     * 메인 룰 실행 함수
     * @param {Object} timeline - TimelineAssembler에서 조립된 타임라인
     * @param {Array} entities - 정규화된 엔티티들
     * @returns {Object} 룰 실행 결과
     */
    async executeRules(timeline, entities) {
        try {
            const startTime = Date.now();
            
            // 1. 적용 가능한 룰 식별
            const applicableRules = await this.identifyApplicableRules(timeline, entities);
            
            // 2. 룰 실행 계획 수립
            const executionPlan = await this.createExecutionPlan(applicableRules);
            
            // 3. 룰 실행
            const ruleResults = await this.executeRulePlan(executionPlan, timeline, entities);
            
            // 4. 룰 체이닝 (연쇄 실행)
            const chainedResults = this.options.enableRuleChaining ? 
                await this.executeRuleChaining(ruleResults, timeline, entities) : ruleResults;
            
            // 5. 결과 통합 및 검증
            const consolidatedResults = await this.consolidateResults(chainedResults);
            
            const processingTime = Date.now() - startTime;
            this.updateExecutionStats(chainedResults.length, processingTime);
            
            const result = {
                ruleResults: consolidatedResults,
                executionSummary: {
                    totalRulesExecuted: chainedResults.length,
                    successfulRules: chainedResults.filter(r => r.status === 'success').length,
                    failedRules: chainedResults.filter(r => r.status === 'failed').length,
                    averageConfidence: this.calculateAverageConfidence(consolidatedResults),
                    processingTimeMs: processingTime
                },
                recommendations: await this.generateRecommendations(consolidatedResults),
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    component: 'DiseaseRuleEngine'
                }
            };
            
            logService.info('Rule execution completed', { 
                totalRules: result.executionSummary.totalRulesExecuted,
                successRate: (result.executionSummary.successfulRules / result.executionSummary.totalRulesExecuted * 100).toFixed(2) + '%',
                processingTime 
            });
            
            return result;
            
        } catch (error) {
            logService.error('Rule execution failed', { error: error.message });
            throw new Error(`DiseaseRuleEngine failed: ${error.message}`);
        }
    }

    /**
     * 적용 가능한 룰 식별
     */
    async identifyApplicableRules(timeline, entities) {
        const applicableRules = [];
        
        // 진단 기반 룰 식별
        const diagnoses = this.extractDiagnoses(entities);
        for (const diagnosis of diagnoses) {
            const rules = this.getRulesForDiagnosis(diagnosis);
            applicableRules.push(...rules);
        }
        
        // 시술/수술 기반 룰 식별
        const procedures = this.extractProcedures(entities);
        for (const procedure of procedures) {
            const rules = this.getRulesForProcedure(procedure);
            applicableRules.push(...rules);
        }
        
        // 약물 기반 룰 식별
        const medications = this.extractMedications(entities);
        for (const medication of medications) {
            const rules = this.getRulesForMedication(medication);
            applicableRules.push(...rules);
        }
        
        // 타임라인 패턴 기반 룰 식별
        const timelineRules = await this.getTimelinePatternRules(timeline);
        applicableRules.push(...timelineRules);
        
        // 중복 제거 및 우선순위 정렬
        return this.deduplicateAndPrioritizeRules(applicableRules);
    }

    /**
     * 룰 실행 계획 수립
     */
    async createExecutionPlan(rules) {
        // 의존성 분석
        const dependencyGraph = this.buildDependencyGraph(rules);
        
        // 실행 순서 결정 (위상 정렬)
        const executionOrder = this.topologicalSort(dependencyGraph);
        
        // 병렬 실행 그룹 생성
        const parallelGroups = this.createParallelGroups(executionOrder);
        
        return {
            rules,
            executionOrder,
            parallelGroups,
            estimatedTime: this.estimateExecutionTime(rules)
        };
    }

    /**
     * 룰 실행 계획 실행
     */
    async executeRulePlan(executionPlan, timeline, entities) {
        const results = [];
        
        for (const group of executionPlan.parallelGroups) {
            // 병렬 실행
            const groupPromises = group.map(rule => 
                this.executeRule(rule, timeline, entities)
            );
            
            const groupResults = await Promise.allSettled(groupPromises);
            
            // 결과 처리
            groupResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    logger.warn('Rule execution failed', { 
                        rule: group[index].id,
                        error: result.reason 
                    });
                    results.push({
                        ruleId: group[index].id,
                        status: 'failed',
                        error: result.reason,
                        confidence: 0
                    });
                }
            });
        }
        
        return results;
    }

    /**
     * 개별 룰 실행
     */
    async executeRule(rule, timeline, entities) {
        const startTime = Date.now();
        
        try {
            // 캐시 확인
            const cacheKey = this.generateCacheKey(rule, timeline, entities);
            if (this.options.enableRuleCaching && this.ruleCache.has(cacheKey)) {
                logService.debug('Rule result retrieved from cache', { ruleId: rule.id });
                return this.ruleCache.get(cacheKey);
            }
            
            // 룰 조건 검증
            const conditionResult = await this.evaluateRuleConditions(rule, timeline, entities);
            if (!conditionResult.satisfied) {
                return {
                    ruleId: rule.id,
                    status: 'skipped',
                    reason: 'Conditions not satisfied',
                    conditionResult,
                    confidence: 0,
                    executionTimeMs: Date.now() - startTime
                };
            }
            
            // 룰 액션 실행
            const actionResult = await this.executeRuleActions(rule, timeline, entities, conditionResult);
            
            const result = {
                ruleId: rule.id,
                ruleName: rule.name,
                ruleType: rule.type,
                status: 'success',
                conditionResult,
                actionResult,
                confidence: actionResult.confidence || 0.8,
                executionTimeMs: Date.now() - startTime,
                metadata: {
                    ruleVersion: rule.version,
                    executedAt: new Date().toISOString()
                }
            };
            
            // 캐시 저장
            if (this.options.enableRuleCaching) {
                this.ruleCache.set(cacheKey, result);
            }
            
            return result;
            
        } catch (error) {
            logger.error('Rule execution error', { 
                ruleId: rule.id, 
                error: error.message 
            });
            
            return {
                ruleId: rule.id,
                status: 'failed',
                error: error.message,
                confidence: 0,
                executionTimeMs: Date.now() - startTime
            };
        }
    }

    /**
     * 룰 조건 평가
     */
    async evaluateRuleConditions(rule, timeline, entities) {
        const conditionResults = [];
        let overallSatisfied = true;
        
        for (const condition of rule.conditions) {
            const result = await this.evaluateCondition(condition, timeline, entities);
            conditionResults.push(result);
            
            if (rule.conditionLogic === 'AND' && !result.satisfied) {
                overallSatisfied = false;
            } else if (rule.conditionLogic === 'OR' && result.satisfied) {
                overallSatisfied = true;
                break;
            }
        }
        
        if (rule.conditionLogic === 'OR' && !conditionResults.some(r => r.satisfied)) {
            overallSatisfied = false;
        }
        
        return {
            satisfied: overallSatisfied,
            conditions: conditionResults,
            logic: rule.conditionLogic
        };
    }

    /**
     * 개별 조건 평가
     */
    async evaluateCondition(condition, timeline, entities) {
        switch (condition.type) {
            case 'entity_exists':
                return this.evaluateEntityExistsCondition(condition, entities);
            case 'timeline_pattern':
                return this.evaluateTimelinePatternCondition(condition, timeline);
            case 'temporal_relationship':
                return this.evaluateTemporalRelationshipCondition(condition, timeline);
            case 'entity_count':
                return this.evaluateEntityCountCondition(condition, entities);
            case 'confidence_threshold':
                return this.evaluateConfidenceThresholdCondition(condition, entities);
           default:
                logService.warn('Unknown condition type', { type: condition.type });
                return { satisfied: false, reason: 'Unknown condition type' };
        }
    }

    /**
     * 룰 액션 실행
     */
    async executeRuleActions(rule, timeline, entities, conditionResult) {
        const actionResults = [];
        
        for (const action of rule.actions) {
            const result = await this.executeAction(action, timeline, entities, conditionResult);
            actionResults.push(result);
        }
        
        return {
            actions: actionResults,
            confidence: this.calculateActionConfidence(actionResults),
            summary: this.summarizeActionResults(actionResults)
        };
    }

    /**
     * 개별 액션 실행
     */
    async executeAction(action, timeline, entities, conditionResult) {
        switch (action.type) {
            case 'flag_disclosure_risk':
                return this.flagDisclosureRisk(action, timeline, entities);
            case 'suggest_additional_review':
                return this.suggestAdditionalReview(action, timeline, entities);
            case 'calculate_risk_score':
                return this.calculateRiskScore(action, timeline, entities);
            case 'generate_alert':
                return this.generateAlert(action, timeline, entities);
            case 'recommend_action':
                return this.recommendAction(action, timeline, entities);
            default:
                logService.warn('Unknown action type', { type: action.type });
                return { type: action.type, status: 'failed', reason: 'Unknown action type' };
        }
    }

    /**
     * 룰 체이닝 실행
     */
    async executeRuleChaining(initialResults, timeline, entities) {
        const allResults = [...initialResults];
        let depth = 0;
        
        while (depth < this.options.maxRuleDepth) {
            // 새로운 조건을 만족하는 룰 찾기
            const triggeredRules = await this.findTriggeredRules(allResults, timeline, entities);
            
            if (triggeredRules.length === 0) {
                break; // 더 이상 실행할 룰이 없음
            }
            
            // 새로운 룰 실행
            const newResults = [];
            for (const rule of triggeredRules) {
                const result = await this.executeRule(rule, timeline, entities);
                newResults.push(result);
            }
            
            allResults.push(...newResults);
            depth++;
        }
        
        return allResults;
    }

    /**
     * 기본 룰 플러그인 로드
     */
    loadDefaultRulePlugins() {
        // 고혈압 관련 룰
        this.registerRulePlugin('hypertension', {
            id: 'hypertension_disclosure_rule',
            name: '고혈압 고지의무 룰',
            type: 'disclosure',
            version: '1.0.0',
            conditions: [
                {
                    type: 'entity_exists',
                    entityType: 'diagnosis',
                    entityValue: '고혈압',
                    confidence: 0.7
                }
            ],
            conditionLogic: 'AND',
            actions: [
                {
                    type: 'flag_disclosure_risk',
                    severity: 'high',
                    message: '고혈압 진단 이력이 확인되었습니다. 보험 고지의무 대상입니다.'
                }
            ]
        });
        
        // 당뇨병 관련 룰
        this.registerRulePlugin('diabetes', {
            id: 'diabetes_medication_rule',
            name: '당뇨병 약물 치료 룰',
            type: 'treatment_pattern',
            version: '1.0.0',
            conditions: [
                {
                    type: 'entity_exists',
                    entityType: 'diagnosis',
                    entityValue: '당뇨병',
                    confidence: 0.7
                },
                {
                    type: 'entity_exists',
                    entityType: 'medication',
                    entityValue: '인슐린',
                    confidence: 0.6
                }
            ],
            conditionLogic: 'AND',
            actions: [
                {
                    type: 'calculate_risk_score',
                    riskType: 'diabetes_severity',
                    baseScore: 0.8
                }
            ]
        });
        
        // 수술 관련 룰
        this.registerRulePlugin('surgery', {
            id: 'major_surgery_rule',
            name: '주요 수술 이력 룰',
            type: 'procedure_analysis',
            version: '1.0.0',
            conditions: [
                {
                    type: 'entity_exists',
                    entityType: 'procedure',
                    entityValue: '수술',
                    confidence: 0.8
                }
            ],
            conditionLogic: 'AND',
            actions: [
                {
                    type: 'suggest_additional_review',
                    reviewType: 'surgical_history',
                    priority: 'high'
                }
            ]
        });
    }

    /**
     * 룰 플러그인 등록
     */
    registerRulePlugin(category, rule) {
        if (!this.rulePlugins.has(category)) {
            this.rulePlugins.set(category, []);
        }
        this.rulePlugins.get(category).push(rule);
        logService.debug('Rule plugin registered', { category, ruleId: rule.id });
    }

    /**
     * 유틸리티 메서드들
     */
    extractDiagnoses(entities) {
        return entities.filter(entity => entity.type === 'diagnosis');
    }

    extractProcedures(entities) {
        return entities.filter(entity => entity.type === 'procedure');
    }

    extractMedications(entities) {
        return entities.filter(entity => entity.type === 'medication');
    }

    getRulesForDiagnosis(diagnosis) {
        const rules = [];
        for (const [category, categoryRules] of this.rulePlugins) {
            const matchingRules = categoryRules.filter(rule => 
                this.ruleMatchesDiagnosis(rule, diagnosis)
            );
            rules.push(...matchingRules);
        }
        return rules;
    }

    getRulesForProcedure(procedure) {
        const rules = [];
        for (const [category, categoryRules] of this.rulePlugins) {
            const matchingRules = categoryRules.filter(rule => 
                this.ruleMatchesProcedure(rule, procedure)
            );
            rules.push(...matchingRules);
        }
        return rules;
    }

    getRulesForMedication(medication) {
        const rules = [];
        for (const [category, categoryRules] of this.rulePlugins) {
            const matchingRules = categoryRules.filter(rule => 
                this.ruleMatchesMedication(rule, medication)
            );
            rules.push(...matchingRules);
        }
        return rules;
    }

    async getTimelinePatternRules(timeline) {
        // 타임라인 패턴 기반 룰 (예: 빈번한 병원 방문, 장기간 치료 등)
        return [];
    }

    ruleMatchesDiagnosis(rule, diagnosis) {
        return rule.conditions.some(condition => 
            condition.entityType === 'diagnosis' && 
            this.entityMatches(condition.entityValue, diagnosis.standardTerm || diagnosis.normalizedText)
        );
    }

    ruleMatchesProcedure(rule, procedure) {
        return rule.conditions.some(condition => 
            condition.entityType === 'procedure' && 
            this.entityMatches(condition.entityValue, procedure.standardTerm || procedure.normalizedText)
        );
    }

    ruleMatchesMedication(rule, medication) {
        return rule.conditions.some(condition => 
            condition.entityType === 'medication' && 
            this.entityMatches(condition.entityValue, medication.standardTerm || medication.normalizedText)
        );
    }

    entityMatches(ruleValue, entityValue) {
        // 단순 문자열 매칭 (향후 더 정교한 매칭 로직으로 확장 가능)
        return entityValue.toLowerCase().includes(ruleValue.toLowerCase()) ||
               ruleValue.toLowerCase().includes(entityValue.toLowerCase());
    }

    deduplicateAndPrioritizeRules(rules) {
        // 중복 제거
        const uniqueRules = rules.filter((rule, index, self) => 
            index === self.findIndex(r => r.id === rule.id)
        );
        
        // 우선순위 정렬 (disclosure > treatment_pattern > procedure_analysis)
        const priorityOrder = { 'disclosure': 3, 'treatment_pattern': 2, 'procedure_analysis': 1 };
        
        return uniqueRules.sort((a, b) => 
            (priorityOrder[b.type] || 0) - (priorityOrder[a.type] || 0)
        );
    }

    buildDependencyGraph(rules) {
        // 룰 간 의존성 그래프 구축 (현재는 단순 구현)
        return rules.map(rule => ({ rule, dependencies: [] }));
    }

    topologicalSort(dependencyGraph) {
        // 위상 정렬 (현재는 단순 구현)
        return dependencyGraph.map(node => node.rule);
    }

    createParallelGroups(rules) {
        // 병렬 실행 그룹 생성 (현재는 모든 룰을 하나의 그룹으로)
        return [rules];
    }

    estimateExecutionTime(rules) {
        return rules.length * 100; // 룰당 평균 100ms 추정
    }

    generateCacheKey(rule, timeline, entities) {
        const timelineHash = JSON.stringify(timeline).slice(0, 50);
        const entitiesHash = JSON.stringify(entities).slice(0, 50);
        return `${rule.id}_${timelineHash}_${entitiesHash}`;
    }

    updateExecutionStats(rulesCount, executionTime) {
        this.executionStats.totalRulesExecuted += rulesCount;
        this.executionStats.averageExecutionTime = 
            (this.executionStats.averageExecutionTime + executionTime) / 2;
    }

    calculateAverageConfidence(results) {
        if (results.length === 0) return 0;
        return results.reduce((sum, result) => sum + result.confidence, 0) / results.length;
    }

    async consolidateResults(results) {
        // 결과 통합 및 중복 제거
        return results.filter(result => result.status === 'success');
    }

    async generateRecommendations(results) {
        const recommendations = [];
        
        results.forEach(result => {
            if (result.actionResult && result.actionResult.actions) {
                result.actionResult.actions.forEach(action => {
                    if (action.type === 'recommend_action') {
                        recommendations.push({
                            type: action.recommendationType,
                            message: action.message,
                            priority: action.priority,
                            confidence: result.confidence
                        });
                    }
                });
            }
        });
        
        return recommendations;
    }

    // 조건 평가 메서드들
    evaluateEntityExistsCondition(condition, entities) {
        const matchingEntities = entities.filter(entity => 
            entity.type === condition.entityType &&
            this.entityMatches(condition.entityValue, entity.standardTerm || entity.normalizedText) &&
            (entity.confidence || 0.5) >= (condition.confidence || 0.5)
        );
        
        return {
            satisfied: matchingEntities.length > 0,
            matchingEntities,
            reason: matchingEntities.length > 0 ? 
                `Found ${matchingEntities.length} matching entities` : 
                'No matching entities found'
        };
    }

    evaluateTimelinePatternCondition(condition, timeline) {
        // 타임라인 패턴 평가 (구현 예정)
        return { satisfied: false, reason: 'Timeline pattern evaluation not implemented' };
    }

    evaluateTemporalRelationshipCondition(condition, timeline) {
        // 시간적 관계 평가 (구현 예정)
        return { satisfied: false, reason: 'Temporal relationship evaluation not implemented' };
    }

    evaluateEntityCountCondition(condition, entities) {
        const count = entities.filter(entity => entity.type === condition.entityType).length;
        const satisfied = this.evaluateCountCondition(count, condition.operator, condition.value);
        
        return {
            satisfied,
            actualCount: count,
            expectedCount: condition.value,
            operator: condition.operator,
            reason: satisfied ? 'Count condition satisfied' : 'Count condition not satisfied'
        };
    }

    evaluateConfidenceThresholdCondition(condition, entities) {
        const relevantEntities = entities.filter(entity => 
            !condition.entityType || entity.type === condition.entityType
        );
        
        const avgConfidence = relevantEntities.length > 0 ? 
            relevantEntities.reduce((sum, entity) => sum + (entity.confidence || 0.5), 0) / relevantEntities.length : 0;
        
        const satisfied = avgConfidence >= condition.threshold;
        
        return {
            satisfied,
            actualConfidence: avgConfidence,
            threshold: condition.threshold,
            reason: satisfied ? 'Confidence threshold met' : 'Confidence threshold not met'
        };
    }

    evaluateCountCondition(actual, operator, expected) {
        switch (operator) {
            case '>': return actual > expected;
            case '>=': return actual >= expected;
            case '<': return actual < expected;
            case '<=': return actual <= expected;
            case '==': return actual === expected;
            case '!=': return actual !== expected;
            default: return false;
        }
    }

    // 액션 실행 메서드들
    flagDisclosureRisk(action, timeline, entities) {
        return {
            type: 'flag_disclosure_risk',
            status: 'success',
            severity: action.severity,
            message: action.message,
            flaggedEntities: entities.filter(e => e.type === 'diagnosis'),
            confidence: 0.9
        };
    }

    suggestAdditionalReview(action, timeline, entities) {
        return {
            type: 'suggest_additional_review',
            status: 'success',
            reviewType: action.reviewType,
            priority: action.priority,
            suggestedEntities: entities,
            confidence: 0.8
        };
    }

    calculateRiskScore(action, timeline, entities) {
        const baseScore = action.baseScore || 0.5;
        const entityCount = entities.length;
        const timelineSpan = timeline.length;
        
        const riskScore = Math.min(baseScore + (entityCount * 0.1) + (timelineSpan * 0.05), 1.0);
        
        return {
            type: 'calculate_risk_score',
            status: 'success',
            riskType: action.riskType,
            riskScore,
            factors: {
                baseScore,
                entityCount,
                timelineSpan
            },
            confidence: 0.85
        };
    }

    generateAlert(action, timeline, entities) {
        return {
            type: 'generate_alert',
            status: 'success',
            alertType: action.alertType,
            message: action.message,
            severity: action.severity,
            confidence: 0.9
        };
    }

    recommendAction(action, timeline, entities) {
        return {
            type: 'recommend_action',
            status: 'success',
            recommendationType: action.recommendationType,
            message: action.message,
            priority: action.priority,
            confidence: 0.8
        };
    }

    calculateActionConfidence(actionResults) {
        if (actionResults.length === 0) return 0;
        return actionResults.reduce((sum, result) => sum + (result.confidence || 0.5), 0) / actionResults.length;
    }

    summarizeActionResults(actionResults) {
        const summary = {
            totalActions: actionResults.length,
            successfulActions: actionResults.filter(r => r.status === 'success').length,
            actionTypes: [...new Set(actionResults.map(r => r.type))]
        };
        
        return summary;
    }

    async findTriggeredRules(results, timeline, entities) {
        // 룰 체이닝을 위한 새로운 룰 찾기 (구현 예정)
        return [];
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'DiseaseRuleEngine',
            timestamp: new Date().toISOString(),
            statistics: this.executionStats,
            rulePlugins: {
                totalCategories: this.rulePlugins.size,
                totalRules: Array.from(this.rulePlugins.values()).reduce((sum, rules) => sum + rules.length, 0)
            },
            cacheSize: this.ruleCache.size
        };
    }
}