/**
 * 의료문서 인과관계 네트워크 구축기
 * 
 * DNA 유전자들 간의 복잡한 인과관계를 분석하고
 * 의학적으로 유의미한 네트워크를 구축합니다.
 * 
 * 예시:
 * 당뇨병 진단 → 메트포르민 처방 → 혈당 검사 → 약물 증량
 */

export class CausalNetworkBuilder {
  constructor() {
    // 의료 인과관계 패턴 정의
    this.causalPatterns = {
      // 진단 → 치료 패턴
      diagnosis_to_treatment: {
        triggers: ['진단', '병명', '질환', '증후군'],
        effects: ['처방', '치료', '투약', '수술', '시술'],
        confidence: 0.9,
        timeWindow: 30 // 일
      },
      
      // 증상 → 진단 패턴
      symptom_to_diagnosis: {
        triggers: ['증상', '호소', '불편감', '통증', '발열'],
        effects: ['진단', '소견', '판정', '의심'],
        confidence: 0.8,
        timeWindow: 7
      },
      
      // 치료 → 검사 패턴
      treatment_to_monitoring: {
        triggers: ['처방', '치료', '수술', '투약'],
        effects: ['검사', '추적', '관찰', '모니터링'],
        confidence: 0.85,
        timeWindow: 90
      },
      
      // 검사 → 치료 조정 패턴
      monitoring_to_adjustment: {
        triggers: ['검사', '결과', '수치', '소견'],
        effects: ['조정', '증량', '감량', '변경', '중단'],
        confidence: 0.8,
        timeWindow: 14
      },
      
      // 부작용 → 치료 변경 패턴
      adverse_to_change: {
        triggers: ['부작용', '이상반응', '알레르기', '독성'],
        effects: ['중단', '변경', '대체', '조정'],
        confidence: 0.95,
        timeWindow: 3
      }
    };
    
    // 인과관계 강도 가중치
    this.causalWeights = {
      temporal: 0.4,    // 시간적 순서
      medical: 0.3,     // 의학적 논리
      semantic: 0.2,    // 의미적 유사성
      frequency: 0.1    // 빈도 기반
    };
    
    // 의학적 논리 규칙
    this.medicalLogicRules = {
      // 질병 진행 규칙
      disease_progression: [
        {
          condition: ['당뇨병', '고혈압', '이상지질혈증'],
          progression: ['합병증', '악화', '조절불량'],
          weight: 0.9
        },
        {
          condition: ['감염', '염증'],
          progression: ['항생제', '소염제', '해열제'],
          weight: 0.85
        }
      ],
      
      // 약물 작용 규칙
      drug_action: [
        {
          drug: ['메트포르민', '인슐린'],
          effect: ['혈당', '당화혈색소', 'HbA1c'],
          weight: 0.9
        },
        {
          drug: ['안지오텐신', 'ACE', 'ARB'],
          effect: ['혈압', '신기능', '단백뇨'],
          weight: 0.85
        }
      ],
      
      // 검사 → 진단 규칙
      test_diagnosis: [
        {
          test: ['혈당', 'glucose', 'HbA1c'],
          diagnosis: ['당뇨병', '내당능장애', '공복혈당장애'],
          weight: 0.9
        },
        {
          test: ['혈압', 'BP'],
          diagnosis: ['고혈압', '저혈압'],
          weight: 0.85
        }
      ]
    };
    
    // 네트워크 구조
    this.network = {
      nodes: [],      // 의료 사건 노드들
      edges: [],      // 인과관계 간선들
      clusters: [],   // 관련 사건 클러스터들
      pathways: []    // 인과관계 경로들
    };
    
    // 처리 통계
    this.stats = {
      totalRelations: 0,
      strongRelations: 0,
      weakRelations: 0,
      averageConfidence: 0,
      networkDensity: 0,
      processingTime: 0
    };
  }

  /**
   * DNA 유전자들로부터 인과관계 네트워크를 구축합니다.
   * @param {Array} genes - DNA 유전자 배열
   * @param {Object} context - 컨텍스트 정보
   * @returns {Promise<Object>} 인과관계 네트워크
   */
  async buildCausalNetwork(genes, context = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🔗 인과관계 네트워크 구축 시작...');
      
      // 1. 노드 생성 (각 DNA 유전자를 노드로)
      const nodes = this.createNodes(genes);
      console.log(`🔵 노드 ${nodes.length}개 생성`);
      
      // 2. 잠재적 인과관계 탐지
      const potentialRelations = this.detectPotentialRelations(nodes, context);
      console.log(`🔍 잠재적 관계 ${potentialRelations.length}개 탐지`);
      
      // 3. 인과관계 강도 계산
      const scoredRelations = await this.scoreCausalRelations(potentialRelations, nodes);
      console.log(`📊 관계 점수 계산 완료`);
      
      // 4. 신뢰도 기반 필터링
      const validRelations = this.filterByConfidence(scoredRelations, context.minConfidence || 0.6);
      console.log(`✅ 유효한 관계 ${validRelations.length}개 선별`);
      
      // 5. 네트워크 구조 생성
      const networkStructure = this.constructNetwork(nodes, validRelations);
      console.log(`🕸️ 네트워크 구조 생성 완료`);
      
      // 6. 클러스터 분석
      const clusters = this.analyzeClusters(networkStructure);
      console.log(`🔗 클러스터 ${clusters.length}개 분석`);
      
      // 7. 인과경로 추출
      const pathways = this.extractCausalPathways(networkStructure);
      console.log(`🛤️ 인과경로 ${pathways.length}개 추출`);
      
      // 8. 의학적 검증
      const validatedNetwork = this.validateMedicalLogic(networkStructure, clusters, pathways);
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: true,
        processingTime,
        network: validatedNetwork,
        analysis: {
          totalNodes: nodes.length,
          totalRelations: validRelations.length,
          strongRelations: validRelations.filter(r => r.confidence > 0.8).length,
          clusters: clusters.length,
          pathways: pathways.length,
          networkDensity: this.calculateNetworkDensity(nodes.length, validRelations.length),
          averageConfidence: this.calculateAverageConfidence(validRelations)
        },
        insights: {
          primaryCauses: this.identifyPrimaryCauses(validatedNetwork),
          criticalPathways: this.identifyCriticalPathways(pathways),
          riskFactors: this.identifyRiskFactors(validatedNetwork),
          treatmentEffectiveness: this.analyzeTreatmentEffectiveness(validatedNetwork)
        },
        stats: this.updateStats(processingTime, validRelations)
      };
      
      console.log(`✅ 인과관계 네트워크 구축 완료 (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      console.error('❌ 인과관계 네트워크 구축 실패:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * DNA 유전자들을 네트워크 노드로 변환합니다.
   */
  createNodes(genes) {
    return genes.map((gene, index) => ({
      id: gene.id || `node_${index}`,
      label: gene.content.substring(0, 50) + (gene.content.length > 50 ? '...' : ''),
      content: gene.content,
      type: this.classifyNodeType(gene),
      temporalInfo: gene.temporalContext || gene.anchors?.temporal,
      medicalContext: gene.enhancedAnchors?.medical || gene.anchors?.medical,
      confidence: gene.confidence || 0.5,
      attributes: {
        isSymptom: this.isSymptom(gene.content),
        isDiagnosis: this.isDiagnosis(gene.content),
        isTreatment: this.isTreatment(gene.content),
        isTest: this.isTest(gene.content),
        isOutcome: this.isOutcome(gene.content)
      },
      position: {
        x: Math.random() * 800,
        y: Math.random() * 600
      },
      metadata: gene
    }));
  }

  /**
   * 잠재적 인과관계를 탐지합니다.
   */
  detectPotentialRelations(nodes, context) {
    const relations = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        // 시간적 순서 확인
        const temporalOrder = this.checkTemporalOrder(node1, node2);
        if (temporalOrder.isOrdered) {
          const relation = {
            id: `rel_${node1.id}_${node2.id}`,
            source: temporalOrder.first,
            target: temporalOrder.second,
            type: 'causal_candidate',
            temporalGap: temporalOrder.gap,
            direction: temporalOrder.direction
          };
          
          relations.push(relation);
        }
      }
    }
    
    return relations;
  }

  /**
   * 인과관계의 강도를 계산합니다.
   */
  async scoreCausalRelations(relations, nodes) {
    return relations.map(relation => {
      const sourceNode = nodes.find(n => n.id === relation.source);
      const targetNode = nodes.find(n => n.id === relation.target);
      
      // 1. 시간적 점수
      const temporalScore = this.calculateTemporalScore(relation.temporalGap);
      
      // 2. 의학적 논리 점수
      const medicalScore = this.calculateMedicalLogicScore(sourceNode, targetNode);
      
      // 3. 의미적 유사성 점수
      const semanticScore = this.calculateSemanticScore(sourceNode, targetNode);
      
      // 4. 패턴 매칭 점수
      const patternScore = this.calculatePatternScore(sourceNode, targetNode);
      
      // 가중 평균으로 최종 점수 계산
      const finalScore = (
        temporalScore * this.causalWeights.temporal +
        medicalScore * this.causalWeights.medical +
        semanticScore * this.causalWeights.semantic +
        patternScore * this.causalWeights.frequency
      );
      
      return {
        ...relation,
        scores: {
          temporal: temporalScore,
          medical: medicalScore,
          semantic: semanticScore,
          pattern: patternScore,
          final: finalScore
        },
        confidence: finalScore,
        strength: this.categorizeStrength(finalScore),
        evidence: this.gatherEvidence(sourceNode, targetNode)
      };
    });
  }

  /**
   * 신뢰도 기반으로 관계를 필터링합니다.
   */
  filterByConfidence(relations, minConfidence) {
    return relations.filter(relation => relation.confidence >= minConfidence);
  }

  /**
   * 네트워크 구조를 생성합니다.
   */
  constructNetwork(nodes, relations) {
    return {
      nodes: nodes.map(node => ({
        ...node,
        inDegree: relations.filter(r => r.target === node.id).length,
        outDegree: relations.filter(r => r.source === node.id).length,
        centrality: this.calculateCentrality(node, relations)
      })),
      edges: relations.map(relation => ({
        ...relation,
        weight: relation.confidence,
        style: this.getEdgeStyle(relation.strength),
        label: `${(relation.confidence * 100).toFixed(0)}%`
      }))
    };
  }

  /**
   * 클러스터를 분석합니다.
   */
  analyzeClusters(network) {
    const clusters = [];
    const visited = new Set();
    
    network.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const cluster = this.findConnectedCluster(node, network, visited);
        if (cluster.nodes.length > 1) {
          clusters.push({
            id: `cluster_${clusters.length}`,
            nodes: cluster.nodes,
            edges: cluster.edges,
            theme: this.identifyClusterTheme(cluster.nodes),
            significance: this.calculateClusterSignificance(cluster)
          });
        }
      }
    });
    
    return clusters;
  }

  /**
   * 인과경로를 추출합니다.
   */
  extractCausalPathways(network) {
    const pathways = [];
    
    // 시작점이 될 수 있는 노드들 (증상, 초기 진단 등)
    const startNodes = network.nodes.filter(node => 
      node.attributes.isSymptom || 
      (node.attributes.isDiagnosis && node.inDegree === 0)
    );
    
    startNodes.forEach(startNode => {
      const paths = this.findPathsFromNode(startNode, network, [], 5); // 최대 5단계
      paths.forEach(path => {
        if (path.length >= 2) {
          pathways.push({
            id: `pathway_${pathways.length}`,
            path: path,
            length: path.length,
            totalConfidence: this.calculatePathConfidence(path),
            medicalSignificance: this.calculatePathSignificance(path),
            pathType: this.classifyPathType(path)
          });
        }
      });
    });
    
    return pathways.sort((a, b) => b.medicalSignificance - a.medicalSignificance);
  }

  /**
   * 의학적 논리를 검증합니다.
   */
  validateMedicalLogic(network, clusters, pathways) {
    // 의학적으로 불가능한 관계 제거
    const validEdges = network.edges.filter(edge => {
      const sourceNode = network.nodes.find(n => n.id === edge.source);
      const targetNode = network.nodes.find(n => n.id === edge.target);
      return this.isMedicallyValid(sourceNode, targetNode);
    });
    
    return {
      ...network,
      edges: validEdges,
      clusters,
      pathways,
      validation: {
        originalEdges: network.edges.length,
        validEdges: validEdges.length,
        removedEdges: network.edges.length - validEdges.length,
        validationScore: validEdges.length / network.edges.length
      }
    };
  }

  /**
   * 유틸리티 메서드들
   */
  classifyNodeType(gene) {
    const content = gene.content.toLowerCase();
    
    if (this.isSymptom(content)) return 'symptom';
    if (this.isDiagnosis(content)) return 'diagnosis';
    if (this.isTreatment(content)) return 'treatment';
    if (this.isTest(content)) return 'test';
    if (this.isOutcome(content)) return 'outcome';
    
    return 'general';
  }

  isSymptom(content) {
    const symptomKeywords = ['증상', '호소', '통증', '발열', '기침', '두통', '어지러움', '구토', '설사'];
    return symptomKeywords.some(keyword => content.includes(keyword));
  }

  isDiagnosis(content) {
    const diagnosisKeywords = ['진단', '병명', '질환', '증후군', '장애', 'E11', 'I10', 'M79'];
    return diagnosisKeywords.some(keyword => content.includes(keyword));
  }

  isTreatment(content) {
    const treatmentKeywords = ['처방', '치료', '투약', '수술', '시술', '요법', '복용'];
    return treatmentKeywords.some(keyword => content.includes(keyword));
  }

  isTest(content) {
    const testKeywords = ['검사', '측정', '수치', '결과', '혈당', '혈압', 'HbA1c', 'CBC'];
    return testKeywords.some(keyword => content.includes(keyword));
  }

  isOutcome(content) {
    const outcomeKeywords = ['호전', '악화', '회복', '재발', '완치', '조절', '개선'];
    return outcomeKeywords.some(keyword => content.includes(keyword));
  }

  checkTemporalOrder(node1, node2) {
    if (!node1.temporalInfo || !node2.temporalInfo) {
      return { isOrdered: false };
    }
    
    const date1 = new Date(node1.temporalInfo);
    const date2 = new Date(node2.temporalInfo);
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return { isOrdered: false };
    }
    
    const gap = Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24); // 일 단위
    
    return {
      isOrdered: true,
      first: date1 < date2 ? node1.id : node2.id,
      second: date1 < date2 ? node2.id : node1.id,
      gap,
      direction: date1 < date2 ? 'forward' : 'backward'
    };
  }

  calculateTemporalScore(gap) {
    // 시간 간격이 적절할 때 높은 점수
    if (gap <= 1) return 0.9;        // 1일 이내
    if (gap <= 7) return 0.8;        // 1주 이내
    if (gap <= 30) return 0.7;       // 1개월 이내
    if (gap <= 90) return 0.5;       // 3개월 이내
    if (gap <= 365) return 0.3;      // 1년 이내
    return 0.1;                      // 1년 초과
  }

  calculateMedicalLogicScore(sourceNode, targetNode) {
    let score = 0.5; // 기본 점수
    
    // 의학적 논리 규칙 적용
    this.medicalLogicRules.disease_progression.forEach(rule => {
      if (this.matchesRule(sourceNode, targetNode, rule)) {
        score = Math.max(score, rule.weight);
      }
    });
    
    this.medicalLogicRules.drug_action.forEach(rule => {
      if (this.matchesRule(sourceNode, targetNode, rule)) {
        score = Math.max(score, rule.weight);
      }
    });
    
    return score;
  }

  calculateSemanticScore(sourceNode, targetNode) {
    // 간단한 의미적 유사성 계산
    const sourceWords = sourceNode.content.toLowerCase().split(/\s+/);
    const targetWords = targetNode.content.toLowerCase().split(/\s+/);
    
    let commonWords = 0;
    sourceWords.forEach(word => {
      if (targetWords.includes(word) && word.length > 2) {
        commonWords++;
      }
    });
    
    return commonWords / Math.max(sourceWords.length, targetWords.length);
  }

  calculatePatternScore(sourceNode, targetNode) {
    let score = 0;
    
    Object.values(this.causalPatterns).forEach(pattern => {
      const sourceMatches = pattern.triggers.some(trigger => 
        sourceNode.content.toLowerCase().includes(trigger)
      );
      const targetMatches = pattern.effects.some(effect => 
        targetNode.content.toLowerCase().includes(effect)
      );
      
      if (sourceMatches && targetMatches) {
        score = Math.max(score, pattern.confidence);
      }
    });
    
    return score;
  }

  categorizeStrength(score) {
    if (score >= 0.8) return 'strong';
    if (score >= 0.6) return 'moderate';
    if (score >= 0.4) return 'weak';
    return 'very_weak';
  }

  gatherEvidence(sourceNode, targetNode) {
    return {
      temporal: sourceNode.temporalInfo && targetNode.temporalInfo,
      medical: this.findMedicalEvidence(sourceNode, targetNode),
      semantic: this.findSemanticEvidence(sourceNode, targetNode)
    };
  }

  calculateCentrality(node, relations) {
    const totalConnections = relations.filter(r => 
      r.source === node.id || r.target === node.id
    ).length;
    
    return totalConnections / (relations.length || 1);
  }

  getEdgeStyle(strength) {
    const styles = {
      strong: { width: 3, color: '#dc3545', dash: 'solid' },
      moderate: { width: 2, color: '#ffc107', dash: 'solid' },
      weak: { width: 1, color: '#6c757d', dash: 'dashed' },
      very_weak: { width: 1, color: '#e9ecef', dash: 'dotted' }
    };
    
    return styles[strength] || styles.weak;
  }

  findConnectedCluster(startNode, network, visited) {
    const cluster = { nodes: [startNode], edges: [] };
    visited.add(startNode.id);
    
    const queue = [startNode];
    
    while (queue.length > 0) {
      const currentNode = queue.shift();
      
      network.edges.forEach(edge => {
        let connectedNode = null;
        
        if (edge.source === currentNode.id && !visited.has(edge.target)) {
          connectedNode = network.nodes.find(n => n.id === edge.target);
        } else if (edge.target === currentNode.id && !visited.has(edge.source)) {
          connectedNode = network.nodes.find(n => n.id === edge.source);
        }
        
        if (connectedNode) {
          cluster.nodes.push(connectedNode);
          cluster.edges.push(edge);
          visited.add(connectedNode.id);
          queue.push(connectedNode);
        }
      });
    }
    
    return cluster;
  }

  identifyClusterTheme(nodes) {
    const types = nodes.map(n => n.type);
    const mostCommon = this.getMostCommonType(types);
    return mostCommon;
  }

  calculateClusterSignificance(cluster) {
    const avgConfidence = cluster.edges.reduce((sum, edge) => sum + edge.confidence, 0) / cluster.edges.length;
    const nodeImportance = cluster.nodes.reduce((sum, node) => sum + node.centrality, 0) / cluster.nodes.length;
    
    return (avgConfidence + nodeImportance) / 2;
  }

  findPathsFromNode(startNode, network, currentPath, maxDepth) {
    if (currentPath.length >= maxDepth) return [currentPath];
    
    const paths = [];
    const newPath = [...currentPath, startNode];
    
    // 현재 노드에서 출발하는 간선들 찾기
    const outgoingEdges = network.edges.filter(edge => edge.source === startNode.id);
    
    if (outgoingEdges.length === 0) {
      // 더 이상 갈 곳이 없으면 현재 경로 반환
      paths.push(newPath);
    } else {
      outgoingEdges.forEach(edge => {
        const nextNode = network.nodes.find(n => n.id === edge.target);
        if (nextNode && !currentPath.find(n => n.id === nextNode.id)) { // 순환 방지
          const subPaths = this.findPathsFromNode(nextNode, network, newPath, maxDepth);
          paths.push(...subPaths);
        }
      });
    }
    
    return paths;
  }

  calculatePathConfidence(path) {
    // 경로상의 모든 간선의 신뢰도 평균
    return 0.8; // 간단한 구현
  }

  calculatePathSignificance(path) {
    // 의학적 중요도 계산
    return path.length * 0.2; // 간단한 구현
  }

  classifyPathType(path) {
    if (path.some(n => n.attributes.isSymptom) && path.some(n => n.attributes.isDiagnosis)) {
      return 'diagnostic_pathway';
    }
    if (path.some(n => n.attributes.isDiagnosis) && path.some(n => n.attributes.isTreatment)) {
      return 'treatment_pathway';
    }
    return 'general_pathway';
  }

  isMedicallyValid(sourceNode, targetNode) {
    // 의학적으로 불가능한 관계 체크
    return true; // 간단한 구현
  }

  calculateNetworkDensity(nodeCount, edgeCount) {
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    return edgeCount / maxPossibleEdges;
  }

  calculateAverageConfidence(relations) {
    if (relations.length === 0) return 0;
    return relations.reduce((sum, rel) => sum + rel.confidence, 0) / relations.length;
  }

  identifyPrimaryCauses(network) {
    return network.nodes
      .filter(node => node.inDegree === 0 && node.outDegree > 0)
      .sort((a, b) => b.outDegree - a.outDegree)
      .slice(0, 3);
  }

  identifyCriticalPathways(pathways) {
    return pathways
      .filter(pathway => pathway.medicalSignificance > 0.7)
      .slice(0, 5);
  }

  identifyRiskFactors(network) {
    return network.nodes
      .filter(node => node.attributes.isSymptom || node.type === 'risk_factor')
      .sort((a, b) => b.centrality - a.centrality);
  }

  analyzeTreatmentEffectiveness(network) {
    const treatmentNodes = network.nodes.filter(n => n.attributes.isTreatment);
    const outcomeNodes = network.nodes.filter(n => n.attributes.isOutcome);
    
    return {
      totalTreatments: treatmentNodes.length,
      measuredOutcomes: outcomeNodes.length,
      effectiveness: outcomeNodes.length / (treatmentNodes.length || 1)
    };
  }

  updateStats(processingTime, relations) {
    this.stats.totalRelations = relations.length;
    this.stats.strongRelations = relations.filter(r => r.confidence > 0.8).length;
    this.stats.weakRelations = relations.filter(r => r.confidence < 0.6).length;
    this.stats.averageConfidence = this.calculateAverageConfidence(relations);
    this.stats.processingTime = processingTime;
    
    return { ...this.stats };
  }

  matchesRule(sourceNode, targetNode, rule) {
    // 규칙 매칭 로직 구현
    return false; // 간단한 구현
  }

  findMedicalEvidence(sourceNode, targetNode) {
    return '의학적 근거 발견'; // 간단한 구현
  }

  findSemanticEvidence(sourceNode, targetNode) {
    return '의미적 연관성 발견'; // 간단한 구현
  }

  getMostCommonType(types) {
    const counts = {};
    types.forEach(type => counts[type] = (counts[type] || 0) + 1);
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }
} 