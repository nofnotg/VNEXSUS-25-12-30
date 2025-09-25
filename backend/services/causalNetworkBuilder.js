/**
 * 🧬🔗 Medical Causal Network Builder
 * Task 04: 의료 인과관계 네트워크 구축
 * 
 * 의료 문서에서 추출된 정보들 간의 인과관계를 분석하고
 * 의료 논리에 기반한 네트워크를 구축합니다.
 */

const { AIService } = require('./aiService');
const logger = require('../utils/logger');

class CausalNetworkBuilder {
    constructor() {
        this.aiService = new AIService();
        this.medicalPatterns = this.initializeMedicalPatterns();
        this.causalRules = this.initializeCausalRules();
    }

    /**
     * 의료 인과관계 패턴 초기화
     */
    initializeMedicalPatterns() {
        return {
            // 진단 → 치료 패턴
            diagnosisToTreatment: {
                keywords: ['진단', '치료', '처방', '투약', '수술'],
                patterns: [
                    /(.+?)(?:진단|확진).*?(?:치료|처방|투약).*?(.+)/g,
                    /(.+?)(?:소견|판단).*?(?:시행|실시).*?(.+)/g
                ],
                confidence: 0.9
            },
            
            // 증상 → 진단 패턴
            symptomToDiagnosis: {
                keywords: ['증상', '호소', '진단', '소견'],
                patterns: [
                    /(.+?)(?:증상|호소|불편감).*?(?:진단|소견|판단).*?(.+)/g,
                    /(.+?)(?:통증|아픔).*?(?:확인|진단).*?(.+)/g
                ],
                confidence: 0.85
            },
            
            // 검사 → 진단 패턴
            testToDiagnosis: {
                keywords: ['검사', '촬영', '진단', '결과'],
                patterns: [
                    /(.+?)(?:검사|촬영|시행).*?(?:결과|소견).*?(.+)/g,
                    /(.+?)(?:CT|MRI|X-ray).*?(?:확인|진단).*?(.+)/g
                ],
                confidence: 0.92
            },
            
            // 치료 → 경과 패턴
            treatmentToOutcome: {
                keywords: ['치료', '처방', '경과', '호전', '악화'],
                patterns: [
                    /(.+?)(?:치료|처방|투약).*?(?:경과|호전|개선|악화).*?(.+)/g,
                    /(.+?)(?:수술|시술).*?(?:결과|상태).*?(.+)/g
                ],
                confidence: 0.88
            }
        };
    }

    /**
     * 인과관계 규칙 초기화
     */
    initializeCausalRules() {
        return {
            temporal: {
                // 시간적 선후관계
                beforeAfter: /(.+?)(?:후|다음|이후).*?(.+)/g,
                causeTiming: /(.+?)(?:으로 인해|때문에|원인으로).*?(.+)/g
            },
            logical: {
                // 논리적 인과관계
                causeEffect: /(.+?)(?:원인|요인).*?(.+?)(?:결과|영향)/g,
                condition: /(.+?)(?:경우|상황).*?(.+?)(?:발생|나타남)/g
            },
            medical: {
                // 의료적 인과관계
                complication: /(.+?)(?:합병증|부작용).*?(.+)/g,
                progression: /(.+?)(?:진행|악화|호전).*?(.+)/g
            }
        };
    }

    /**
     * 인과관계 네트워크 구축
     * @param {Array} genes - DNA 유전자 배열
     * @param {Object} layoutInfo - 레이아웃 정보
     * @param {Object} dateInfo - 날짜 정보
     * @returns {Object} 인과관계 네트워크
     */
    async buildCausalNetwork(genes, layoutInfo = {}, dateInfo = {}) {
        try {
            logger.info('🔗 Building causal network from genes');
            
            // 1. 의료 이벤트 분류
            const medicalEvents = this.classifyMedicalEvents(genes);
            
            // 2. 인과관계 추출
            const causalRelations = await this.extractCausalRelations(medicalEvents);
            
            // 3. 시간적 순서 적용
            const temporalNetwork = this.applyTemporalOrdering(causalRelations, dateInfo);
            
            // 4. 의료 논리 검증
            const validatedNetwork = this.validateMedicalLogic(temporalNetwork);
            
            // 5. 네트워크 구조화
            const structuredNetwork = this.structureNetwork(validatedNetwork);
            
            // 6. 신뢰도 계산
            const finalNetwork = this.calculateNetworkConfidence(structuredNetwork);
            
            logger.info(`✅ Causal network built with ${finalNetwork.nodes.length} nodes and ${finalNetwork.edges.length} edges`);
            
            return {
                network: finalNetwork,
                statistics: this.generateNetworkStatistics(finalNetwork),
                insights: this.generateMedicalInsights(finalNetwork)
            };
            
        } catch (error) {
            logger.error('❌ Error building causal network:', error);
            throw error;
        }
    }

    /**
     * 의료 이벤트 분류
     */
    classifyMedicalEvents(genes) {
        const events = [];
        
        genes.forEach((gene, index) => {
            const event = {
                id: `event_${index}`,
                geneId: gene.id,
                content: gene.content,
                type: this.determineMedicalEventType(gene.content),
                confidence: gene.confidence,
                anchors: gene.anchors || {},
                temporalInfo: gene.temporalContext || null,
                layoutInfo: gene.layout || null
            };
            
            events.push(event);
        });
        
        return events;
    }

    /**
     * 의료 이벤트 타입 결정
     */
    determineMedicalEventType(content) {
        const typePatterns = {
            symptom: /증상|호소|불편|통증|아픔|불쾌감/,
            diagnosis: /진단|소견|판단|확진|의심/,
            test: /검사|촬영|시행|CT|MRI|X-ray|혈액검사/,
            treatment: /치료|처방|투약|수술|시술|요법/,
            outcome: /경과|호전|개선|악화|완치|재발/,
            medication: /약물|의약품|처방전|복용|투여/,
            procedure: /수술|시술|처치|조치|시행/
        };
        
        for (const [type, pattern] of Object.entries(typePatterns)) {
            if (pattern.test(content)) {
                return type;
            }
        }
        
        return 'unknown';
    }

    /**
     * 인과관계 추출
     */
    async extractCausalRelations(events) {
        const relations = [];
        
        // 패턴 기반 인과관계 추출
        const patternRelations = this.extractPatternBasedRelations(events);
        relations.push(...patternRelations);
        
        // AI 기반 인과관계 추출
        const aiRelations = await this.extractAIBasedRelations(events);
        relations.push(...aiRelations);
        
        return this.deduplicateRelations(relations);
    }

    /**
     * 패턴 기반 인과관계 추출
     */
    extractPatternBasedRelations(events) {
        const relations = [];
        
        // 의료 패턴 적용
        for (const [patternName, pattern] of Object.entries(this.medicalPatterns)) {
            const patternRelations = this.applyMedicalPattern(events, pattern, patternName);
            relations.push(...patternRelations);
        }
        
        // 인과관계 규칙 적용
        for (const [ruleType, rules] of Object.entries(this.causalRules)) {
            const ruleRelations = this.applyCausalRules(events, rules, ruleType);
            relations.push(...ruleRelations);
        }
        
        return relations;
    }

    /**
     * 의료 패턴 적용
     */
    applyMedicalPattern(events, pattern, patternName) {
        const relations = [];
        
        for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
                const event1 = events[i];
                const event2 = events[j];
                
                // 패턴 키워드 확인
                const hasKeywords = pattern.keywords.some(keyword => 
                    event1.content.includes(keyword) || event2.content.includes(keyword)
                );
                
                if (hasKeywords) {
                    // 패턴 매칭 확인
                    const combinedText = `${event1.content} ${event2.content}`;
                    const isMatched = pattern.patterns.some(regex => regex.test(combinedText));
                    
                    if (isMatched) {
                        relations.push({
                            source: event1.id,
                            target: event2.id,
                            type: patternName,
                            confidence: pattern.confidence,
                            method: 'pattern',
                            evidence: combinedText
                        });
                    }
                }
            }
        }
        
        return relations;
    }

    /**
     * AI 기반 인과관계 추출
     */
    async extractAIBasedRelations(events) {
        try {
            const prompt = this.buildCausalAnalysisPrompt(events);
            const response = await this.aiService.generateResponse(prompt, {
                model: 'claude-3-sonnet-20240229',
                maxTokens: 2000,
                temperature: 0.3
            });
            
            return this.parseCausalAnalysisResponse(response, events);
            
        } catch (error) {
            logger.error('❌ Error in AI-based causal extraction:', error);
            return [];
        }
    }

    /**
     * 인과관계 분석 프롬프트 구축
     */
    buildCausalAnalysisPrompt(events) {
        const eventsText = events.map(event => 
            `[${event.id}] ${event.type}: ${event.content}`
        ).join('\n');
        
        return `
의료 문서에서 추출된 다음 이벤트들 간의 인과관계를 분석해주세요:

${eventsText}

다음 형식으로 인과관계를 식별해주세요:
- 원인 이벤트 ID → 결과 이벤트 ID: 관계 유형 (신뢰도 0-1)
- 예: event_1 → event_3: symptom_to_diagnosis (0.85)

의료적 논리와 시간적 순서를 고려하여 분석해주세요.
관계 유형: symptom_to_diagnosis, diagnosis_to_treatment, treatment_to_outcome, test_to_diagnosis, complication, progression
`;
    }

    /**
     * AI 응답 파싱
     */
    parseCausalAnalysisResponse(response, events) {
        const relations = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
            const match = line.match(/([a-zA-Z0-9_]+)\s*→\s*([a-zA-Z0-9_]+):\s*([a-zA-Z_]+)\s*\((\d*\.?\d+)\)/);
            if (match) {
                const [, sourceId, targetId, relationType, confidence] = match;
                
                // 이벤트 ID 유효성 확인
                const sourceExists = events.some(e => e.id === sourceId);
                const targetExists = events.some(e => e.id === targetId);
                
                if (sourceExists && targetExists) {
                    relations.push({
                        source: sourceId,
                        target: targetId,
                        type: relationType,
                        confidence: parseFloat(confidence),
                        method: 'ai',
                        evidence: line.trim()
                    });
                }
            }
        }
        
        return relations;
    }

    /**
     * 시간적 순서 적용
     */
    applyTemporalOrdering(relations, dateInfo) {
        if (!dateInfo.timeline || dateInfo.timeline.length === 0) {
            return relations;
        }
        
        // 시간 순서에 따른 관계 검증 및 조정
        return relations.map(relation => {
            const temporalConsistency = this.checkTemporalConsistency(relation, dateInfo.timeline);
            
            return {
                ...relation,
                temporalConsistency,
                confidence: relation.confidence * (temporalConsistency ? 1.0 : 0.7)
            };
        });
    }

    /**
     * 시간적 일관성 확인
     */
    checkTemporalConsistency(relation, timeline) {
        // 간단한 시간적 일관성 확인 로직
        // 실제로는 더 복잡한 시간 분석이 필요
        return true; // 기본값
    }

    /**
     * 의료 논리 검증
     */
    validateMedicalLogic(relations) {
        return relations.filter(relation => {
            // 의료적으로 타당한 인과관계인지 확인
            const isLogicallyValid = this.isMedicallyLogical(relation);
            
            if (!isLogicallyValid) {
                logger.warn(`⚠️ Medically illogical relation filtered: ${relation.source} → ${relation.target}`);
                return false;
            }
            
            return true;
        });
    }

    /**
     * 의료적 논리성 확인
     */
    isMedicallyLogical(relation) {
        const logicalPatterns = {
            'symptom_to_diagnosis': true,
            'diagnosis_to_treatment': true,
            'treatment_to_outcome': true,
            'test_to_diagnosis': true,
            'diagnosis_to_test': true,
            'complication': true,
            'progression': true
        };
        
        return logicalPatterns[relation.type] || false;
    }

    /**
     * 네트워크 구조화
     */
    structureNetwork(relations) {
        const nodes = new Map();
        const edges = [];
        
        // 노드 생성
        relations.forEach(relation => {
            if (!nodes.has(relation.source)) {
                nodes.set(relation.source, {
                    id: relation.source,
                    type: 'event',
                    inDegree: 0,
                    outDegree: 0
                });
            }
            
            if (!nodes.has(relation.target)) {
                nodes.set(relation.target, {
                    id: relation.target,
                    type: 'event',
                    inDegree: 0,
                    outDegree: 0
                });
            }
            
            // 차수 업데이트
            nodes.get(relation.source).outDegree++;
            nodes.get(relation.target).inDegree++;
        });
        
        // 엣지 생성
        relations.forEach(relation => {
            edges.push({
                id: `${relation.source}_${relation.target}`,
                source: relation.source,
                target: relation.target,
                type: relation.type,
                confidence: relation.confidence,
                method: relation.method,
                evidence: relation.evidence
            });
        });
        
        return {
            nodes: Array.from(nodes.values()),
            edges: edges
        };
    }

    /**
     * 네트워크 신뢰도 계산
     */
    calculateNetworkConfidence(network) {
        // 전체 네트워크 신뢰도 계산
        const totalConfidence = network.edges.reduce((sum, edge) => sum + edge.confidence, 0);
        const averageConfidence = network.edges.length > 0 ? totalConfidence / network.edges.length : 0;
        
        return {
            ...network,
            overallConfidence: averageConfidence,
            qualityScore: this.calculateQualityScore(network)
        };
    }

    /**
     * 품질 점수 계산
     */
    calculateQualityScore(network) {
        const nodeCount = network.nodes.length;
        const edgeCount = network.edges.length;
        const density = nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0;
        
        // 품질 점수 = 밀도 * 평균 신뢰도 * 노드 수 가중치
        const nodeWeight = Math.min(nodeCount / 10, 1); // 최대 10개 노드까지 가중치
        const avgConfidence = network.edges.reduce((sum, e) => sum + e.confidence, 0) / edgeCount;
        
        return density * avgConfidence * nodeWeight;
    }

    /**
     * 네트워크 통계 생성
     */
    generateNetworkStatistics(network) {
        const nodeTypes = {};
        const edgeTypes = {};
        
        network.nodes.forEach(node => {
            nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        });
        
        network.edges.forEach(edge => {
            edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
        });
        
        return {
            nodeCount: network.nodes.length,
            edgeCount: network.edges.length,
            nodeTypes,
            edgeTypes,
            density: network.nodes.length > 1 ? 
                network.edges.length / (network.nodes.length * (network.nodes.length - 1)) : 0,
            averageConfidence: network.overallConfidence,
            qualityScore: network.qualityScore
        };
    }

    /**
     * 의료 인사이트 생성
     */
    generateMedicalInsights(network) {
        const insights = [];
        
        // 주요 인과관계 체인 식별
        const chains = this.identifyCausalChains(network);
        if (chains.length > 0) {
            insights.push({
                type: 'causal_chain',
                title: '주요 인과관계 체인',
                description: `${chains.length}개의 인과관계 체인이 식별되었습니다.`,
                details: chains
            });
        }
        
        // 핵심 이벤트 식별 (높은 차수)
        const centralNodes = network.nodes
            .filter(node => (node.inDegree + node.outDegree) >= 2)
            .sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree));
            
        if (centralNodes.length > 0) {
            insights.push({
                type: 'central_events',
                title: '핵심 의료 이벤트',
                description: `${centralNodes.length}개의 핵심 이벤트가 식별되었습니다.`,
                details: centralNodes.slice(0, 3)
            });
        }
        
        return insights;
    }

    /**
     * 인과관계 체인 식별
     */
    identifyCausalChains(network) {
        const chains = [];
        const visited = new Set();
        
        // 시작 노드들 (inDegree가 0인 노드들)
        const startNodes = network.nodes.filter(node => node.inDegree === 0);
        
        startNodes.forEach(startNode => {
            if (!visited.has(startNode.id)) {
                const chain = this.buildChainFromNode(startNode, network, visited);
                if (chain.length > 2) {
                    chains.push(chain);
                }
            }
        });
        
        return chains;
    }

    /**
     * 노드에서 체인 구축
     */
    buildChainFromNode(startNode, network, visited) {
        const chain = [startNode.id];
        let currentNode = startNode;
        
        while (true) {
            visited.add(currentNode.id);
            
            // 다음 노드 찾기
            const outgoingEdges = network.edges.filter(edge => edge.source === currentNode.id);
            
            if (outgoingEdges.length !== 1) break; // 분기점이거나 끝점
            
            const nextNodeId = outgoingEdges[0].target;
            const nextNode = network.nodes.find(node => node.id === nextNodeId);
            
            if (!nextNode || visited.has(nextNodeId)) break;
            
            chain.push(nextNodeId);
            currentNode = nextNode;
        }
        
        return chain;
    }

    /**
     * 관계 중복 제거
     */
    deduplicateRelations(relations) {
        const unique = new Map();
        
        relations.forEach(relation => {
            const key = `${relation.source}_${relation.target}_${relation.type}`;
            
            if (!unique.has(key) || unique.get(key).confidence < relation.confidence) {
                unique.set(key, relation);
            }
        });
        
        return Array.from(unique.values());
    }

    /**
     * 인과관계 규칙 적용
     */
    applyCausalRules(events, rules, ruleType) {
        const relations = [];
        
        for (const [ruleName, regex] of Object.entries(rules)) {
            events.forEach(event => {
                const matches = [...event.content.matchAll(regex)];
                
                matches.forEach(match => {
                    // 매치된 내용을 기반으로 관계 생성
                    // 이 부분은 더 정교한 로직이 필요
                    if (match[1] && match[2]) {
                        relations.push({
                            source: event.id,
                            target: event.id, // 임시로 같은 이벤트
                            type: `${ruleType}_${ruleName}`,
                            confidence: 0.7,
                            method: 'rule',
                            evidence: match[0]
                        });
                    }
                });
            });
        }
        
        return relations;
    }
}

module.exports = { CausalNetworkBuilder };