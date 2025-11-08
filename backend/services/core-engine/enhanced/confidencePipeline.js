/**
 * 🔧 통합 Confidence Pipeline
 * 
 * GPT-5 분석 기반 표준화된 신뢰도 계산 시스템
 * - 통일된 confidence 계산 방식
 * - 표준화된 evidence/position 스키마
 * - 실시간 신뢰도 추적
 */

class UnifiedConfidencePipeline {
    constructor() {
        this.version = '1.0.0';
        this.weights = {
            textClarity: 0.3,      // 텍스트 명확성
            contextStrength: 0.25,  // 문맥 강도
            positionWeight: 0.2,    // 위치 가중치
            evidenceSpan: 0.25      // 근거 범위
        };
        
        this.thresholds = {
            high: 0.85,     // 높은 신뢰도
            medium: 0.65,   // 중간 신뢰도
            low: 0.45       // 낮은 신뢰도
        };
        
        this.confidenceHistory = new Map();
    }

    /**
     * 표준 Confidence 스키마
     */
    createConfidenceSchema(value, factors, evidence, metadata = {}) {
        return {
            value: Math.min(Math.max(value, 0), 1), // 0.0 - 1.0
            level: this.getConfidenceLevel(value),
            factors: {
                textClarity: factors.textClarity || 0,
                contextStrength: factors.contextStrength || 0,
                positionWeight: factors.positionWeight || 0,
                evidenceSpan: factors.evidenceSpan || 0
            },
            evidence: {
                startPos: evidence.startPos || 0,
                endPos: evidence.endPos || 0,
                rawText: evidence.rawText || '',
                context: evidence.context || '',
                sourceType: evidence.sourceType || 'unknown'
            },
            metadata: {
                calculatedAt: new Date(),
                method: 'unified_pipeline_v1',
                version: this.version,
                processingStage: metadata.processingStage || 'unknown',
                ...metadata
            }
        };
    }

    /**
     * 통합 신뢰도 계산
     */
    async calculateConfidence(gene, context = {}) {
        try {
            // 1. 각 요소별 신뢰도 계산
            const factors = {
                textClarity: this.assessTextClarity(gene.content || gene.rawText),
                contextStrength: this.assessContextStrength(gene, context),
                positionWeight: this.assessPositionWeight(gene.position),
                evidenceSpan: this.assessEvidenceSpan(gene.evidence)
            };

            // 2. 가중 평균 계산
            const confidence = Object.keys(factors).reduce((sum, key) => {
                return sum + (factors[key] * this.weights[key]);
            }, 0);

            // 3. 표준 스키마로 반환
            const result = this.createConfidenceSchema(
                confidence,
                factors,
                gene.evidence || this.extractEvidence(gene),
                {
                    processingStage: context.stage || 'gene_extraction',
                    geneType: gene.type,
                    sourceDocument: context.documentId
                }
            );

            // 4. 히스토리 저장
            this.saveConfidenceHistory(gene.id || gene.type, result);

            return result;
        } catch (error) {
            console.error('Confidence calculation error:', error);
            return this.createDefaultConfidence(gene);
        }
    }

    /**
     * 텍스트 명확성 평가
     */
    assessTextClarity(text) {
        if (!text || typeof text !== 'string') return 0;

        let score = 0.5; // 기본 점수

        // 길이 평가 (너무 짧거나 길면 감점)
        const length = text.length;
        if (length >= 10 && length <= 200) {
            score += 0.2;
        } else if (length > 200 && length <= 500) {
            score += 0.1;
        }

        // 의료 키워드 포함 여부
        const medicalKeywords = ['진료', '치료', '검사', '진단', '처방', '수술', '입원', '통원'];
        const keywordCount = medicalKeywords.filter(keyword => text.includes(keyword)).length;
        score += (keywordCount / medicalKeywords.length) * 0.2;

        // 날짜 패턴 포함 여부
        const datePattern = /\d{4}[-년]\d{1,2}[-월]\d{1,2}|\d{1,2}[-월]\d{1,2}[-일]/;
        if (datePattern.test(text)) {
            score += 0.1;
        }

        return Math.min(score, 1);
    }

    /**
     * 문맥 강도 평가
     */
    assessContextStrength(gene, context) {
        let score = 0.5; // 기본 점수

        // 주변 유전자와의 연관성
        if (context.nearbyGenes && context.nearbyGenes.length > 0) {
            score += Math.min(context.nearbyGenes.length * 0.1, 0.3);
        }

        // 의료 문맥 강도
        if (gene.medicalContext) {
            const contextStrengths = {
                'diagnosis': 0.9,
                'treatment': 0.8,
                'examination': 0.7,
                'medication': 0.75,
                'symptom': 0.6,
                'history': 0.5
            };
            score = score * (contextStrengths[gene.medicalContext] || 0.5);
        }

        // 문서 구조 내 위치
        if (context.documentStructure) {
            if (context.documentStructure.isInMainContent) score += 0.2;
            if (context.documentStructure.hasHeaders) score += 0.1;
        }

        return Math.min(score, 1);
    }

    /**
     * 위치 가중치 평가
     */
    assessPositionWeight(position) {
        if (!position) return 0.5;

        let score = 0.5;

        // 문서 내 위치 (앞쪽일수록 중요)
        if (position.documentRatio) {
            score += (1 - position.documentRatio) * 0.3;
        }

        // 섹션 내 위치
        if (position.sectionType) {
            const sectionWeights = {
                'diagnosis': 0.9,
                'treatment': 0.8,
                'examination': 0.7,
                'history': 0.6,
                'other': 0.5
            };
            score = score * (sectionWeights[position.sectionType] || 0.5);
        }

        return Math.min(score, 1);
    }

    /**
     * 근거 범위 평가
     */
    assessEvidenceSpan(evidence) {
        if (!evidence) return 0.5;

        let score = 0.5;

        // 근거 텍스트 길이
        if (evidence.rawText) {
            const length = evidence.rawText.length;
            if (length >= 20 && length <= 100) {
                score += 0.2;
            } else if (length > 100 && length <= 300) {
                score += 0.1;
            }
        }

        // 근거 품질
        if (evidence.sourceType) {
            const sourceWeights = {
                'direct_extraction': 0.9,
                'contextual_inference': 0.7,
                'pattern_match': 0.6,
                'fuzzy_match': 0.4,
                'unknown': 0.3
            };
            score = score * (sourceWeights[evidence.sourceType] || 0.5);
        }

        // 위치 정확성
        if (evidence.startPos !== undefined && evidence.endPos !== undefined) {
            const span = evidence.endPos - evidence.startPos;
            if (span > 0 && span <= 200) {
                score += 0.1;
            }
        }

        return Math.min(score, 1);
    }

    /**
     * 신뢰도 레벨 결정
     */
    getConfidenceLevel(value) {
        if (value >= this.thresholds.high) return 'HIGH';
        if (value >= this.thresholds.medium) return 'MEDIUM';
        if (value >= this.thresholds.low) return 'LOW';
        return 'VERY_LOW';
    }

    /**
     * 근거 정보 추출
     */
    extractEvidence(gene) {
        return {
            startPos: gene.startPos || 0,
            endPos: gene.endPos || 0,
            rawText: gene.content || gene.rawText || '',
            context: gene.context || '',
            sourceType: gene.sourceType || 'extracted'
        };
    }

    /**
     * 기본 신뢰도 생성
     */
    createDefaultConfidence(gene) {
        return this.createConfidenceSchema(
            0.5, // 기본 신뢰도
            {
                textClarity: 0.5,
                contextStrength: 0.5,
                positionWeight: 0.5,
                evidenceSpan: 0.5
            },
            this.extractEvidence(gene),
            {
                processingStage: 'error_fallback',
                error: true
            }
        );
    }

    /**
     * 신뢰도 히스토리 저장
     */
    saveConfidenceHistory(geneId, confidence) {
        if (!this.confidenceHistory.has(geneId)) {
            this.confidenceHistory.set(geneId, []);
        }
        
        const history = this.confidenceHistory.get(geneId);
        history.push({
            timestamp: new Date(),
            confidence: confidence.value,
            level: confidence.level,
            factors: confidence.factors
        });

        // 최대 10개 히스토리 유지
        if (history.length > 10) {
            history.shift();
        }
    }

    /**
     * 배치 신뢰도 계산
     */
    async calculateBatchConfidence(genes, context = {}) {
        const results = [];
        
        for (const gene of genes) {
            const confidence = await this.calculateConfidence(gene, context);
            results.push({
                geneId: gene.id || gene.type,
                gene,
                confidence
            });
        }

        return {
            results,
            summary: this.calculateBatchSummary(results),
            timestamp: new Date()
        };
    }

    /**
     * 배치 요약 계산
     */
    calculateBatchSummary(results) {
        if (results.length === 0) {
            return {
                totalGenes: 0,
                averageConfidence: 0,
                confidenceDistribution: {}
            };
        }

        const confidenceValues = results.map(r => r.confidence.value);
        const levels = results.map(r => r.confidence.level);

        return {
            totalGenes: results.length,
            averageConfidence: confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length,
            confidenceDistribution: {
                HIGH: levels.filter(l => l === 'HIGH').length,
                MEDIUM: levels.filter(l => l === 'MEDIUM').length,
                LOW: levels.filter(l => l === 'LOW').length,
                VERY_LOW: levels.filter(l => l === 'VERY_LOW').length
            }
        };
    }

    /**
     * 신뢰도 개선 제안
     */
    suggestImprovements(confidence) {
        const suggestions = [];

        if (confidence.factors.textClarity < 0.6) {
            suggestions.push({
                factor: 'textClarity',
                issue: '텍스트 명확성 부족',
                suggestion: '더 명확한 의료 키워드나 구조화된 텍스트 필요'
            });
        }

        if (confidence.factors.contextStrength < 0.6) {
            suggestions.push({
                factor: 'contextStrength',
                issue: '문맥 강도 부족',
                suggestion: '주변 유전자와의 연관성 강화 또는 의료 문맥 보완 필요'
            });
        }

        if (confidence.factors.evidenceSpan < 0.6) {
            suggestions.push({
                factor: 'evidenceSpan',
                issue: '근거 범위 부족',
                suggestion: '더 명확한 근거 텍스트나 위치 정보 필요'
            });
        }

        return suggestions;
    }

    /**
     * 신뢰도 통계 조회
     */
    getConfidenceStatistics() {
        const allHistory = Array.from(this.confidenceHistory.values()).flat();
        
        if (allHistory.length === 0) {
            return {
                totalCalculations: 0,
                averageConfidence: 0,
                confidenceDistribution: {}
            };
        }

        const confidenceValues = allHistory.map(h => h.confidence);
        const levels = allHistory.map(h => h.level);

        return {
            totalCalculations: allHistory.length,
            averageConfidence: confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length,
            confidenceDistribution: {
                HIGH: levels.filter(l => l === 'HIGH').length,
                MEDIUM: levels.filter(l => l === 'MEDIUM').length,
                LOW: levels.filter(l => l === 'LOW').length,
                VERY_LOW: levels.filter(l => l === 'VERY_LOW').length
            },
            lastCalculation: Math.max(...allHistory.map(h => h.timestamp.getTime()))
        };
    }
}

export default UnifiedConfidencePipeline;
export { UnifiedConfidencePipeline };