/**
 * 지능형 라우팅 시스템
 * 문서 복잡도 분석을 통한 최적 처리 엔진 선택
 */

class IntelligentRouter {
    constructor() {
        this.performanceHistory = new Map();
        this.complexityThresholds = {
            simple: 0.3,
            moderate: 0.6,
            complex: 0.8
        };
        this.routingStrategies = {
            performance: 'performance_based',
            accuracy: 'accuracy_based',
            balanced: 'balanced',
            adaptive: 'adaptive'
        };
        this.currentStrategy = 'adaptive';
    }

    /**
     * 문서 복잡도 분석
     * @param {Object} document - 분석할 문서
     * @returns {Object} 복잡도 분석 결과
     */
    async analyzeComplexity(document) {
        const metrics = {
            textLength: this.calculateTextLength(document),
            dateComplexity: this.analyzeDateComplexity(document),
            medicalTermDensity: this.analyzeMedicalTermDensity(document),
            structuralComplexity: this.analyzeStructuralComplexity(document),
            nestedElementCount: this.countNestedElements(document)
        };

        const complexityScore = this.calculateOverallComplexity(metrics);
        
        return {
            score: complexityScore,
            level: this.getComplexityLevel(complexityScore),
            metrics: metrics,
            recommendation: this.getProcessingRecommendation(complexityScore)
        };
    }

    /**
     * 텍스트 길이 기반 복잡도 계산
     */
    calculateTextLength(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        const length = text.length;
        
        if (length < 1000) return 0.1;
        if (length < 5000) return 0.3;
        if (length < 10000) return 0.5;
        if (length < 20000) return 0.7;
        return 0.9;
    }

    /**
     * 날짜 복잡도 분석
     */
    analyzeDateComplexity(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        
        // 다양한 날짜 패턴 검색
        const datePatterns = [
            /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g,  // YYYY-MM-DD
            /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/g,  // MM-DD-YYYY
            /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g, // 한국어 날짜
            /\d{1,2}월\s*\d{1,2}일/g,          // 월일만
            /\d{4}\.\d{1,2}\.\d{1,2}/g        // YYYY.MM.DD
        ];

        let totalMatches = 0;
        let uniquePatterns = 0;

        datePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                totalMatches += matches.length;
                uniquePatterns++;
            }
        });

        // 상대적 날짜 표현 검색
        const relativeDatePatterns = [
            /\d+일\s*전/g,
            /\d+주\s*전/g,
            /\d+개월\s*전/g,
            /어제|오늘|내일/g,
            /지난주|다음주/g
        ];

        let relativeMatches = 0;
        relativeDatePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) relativeMatches += matches.length;
        });

        const complexity = Math.min(
            (totalMatches * 0.1 + uniquePatterns * 0.2 + relativeMatches * 0.15) / text.length * 10000,
            1.0
        );

        return complexity;
    }

    /**
     * 의료 용어 밀도 분석
     */
    analyzeMedicalTermDensity(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        
        const medicalTerms = [
            '진단', '치료', '수술', '처방', '약물', '증상', '질병', '환자',
            '의사', '병원', '검사', '결과', '소견', '판독', '처치', '입원',
            '외래', '응급', '중환자', '수혈', '마취', '재활', '물리치료'
        ];

        let termCount = 0;
        const words = text.split(/\s+/);
        
        words.forEach(word => {
            if (medicalTerms.some(term => word.includes(term))) {
                termCount++;
            }
        });

        return Math.min(termCount / words.length * 10, 1.0);
    }

    /**
     * 구조적 복잡도 분석
     */
    analyzeStructuralComplexity(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        
        // 구조적 요소 검색
        const structuralElements = [
            /\n\s*\d+\./g,        // 번호 목록
            /\n\s*[-*]\s/g,       // 불릿 포인트
            /\|\s*\w+\s*\|/g,     // 테이블 구조
            /\n\s*#{1,6}\s/g,     // 헤더
            /\[\w+\]/g,           // 참조나 링크
            /\(\d+\)/g            // 번호 참조
        ];

        let structuralCount = 0;
        structuralElements.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) structuralCount += matches.length;
        });

        return Math.min(structuralCount / text.length * 1000, 1.0);
    }

    /**
     * 중첩 요소 개수 계산
     */
    countNestedElements(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        
        // 괄호, 인용부호 등의 중첩 구조 분석
        let nestingLevel = 0;
        let maxNesting = 0;
        
        for (let char of text) {
            if (char === '(' || char === '[' || char === '{') {
                nestingLevel++;
                maxNesting = Math.max(maxNesting, nestingLevel);
            } else if (char === ')' || char === ']' || char === '}') {
                nestingLevel = Math.max(0, nestingLevel - 1);
            }
        }

        return Math.min(maxNesting / 10, 1.0);
    }

    /**
     * 전체 복잡도 점수 계산
     */
    calculateOverallComplexity(metrics) {
        const weights = {
            textLength: 0.2,
            dateComplexity: 0.3,
            medicalTermDensity: 0.25,
            structuralComplexity: 0.15,
            nestedElementCount: 0.1
        };

        let totalScore = 0;
        for (const [metric, value] of Object.entries(metrics)) {
            totalScore += (weights[metric] || 0) * value;
        }

        return Math.min(totalScore, 1.0);
    }

    /**
     * 복잡도 레벨 결정
     */
    getComplexityLevel(score) {
        if (score <= this.complexityThresholds.simple) return 'simple';
        if (score <= this.complexityThresholds.moderate) return 'moderate';
        if (score <= this.complexityThresholds.complex) return 'complex';
        return 'very_complex';
    }

    /**
     * 처리 방식 추천
     */
    getProcessingRecommendation(complexityScore) {
        const level = this.getComplexityLevel(complexityScore);
        
        switch (level) {
            case 'simple':
                return {
                    engine: 'legacy',
                    mode: 'fast',
                    reason: '단순한 문서로 기존 시스템으로 충분'
                };
            case 'moderate':
                return {
                    engine: 'hybrid',
                    mode: 'balanced',
                    reason: '중간 복잡도로 하이브리드 처리 권장'
                };
            case 'complex':
                return {
                    engine: 'core',
                    mode: 'accurate',
                    reason: '복잡한 문서로 코어엔진 처리 필요'
                };
            case 'very_complex':
                return {
                    engine: 'adaptive',
                    mode: 'comprehensive',
                    reason: '매우 복잡한 문서로 적응형 처리 필요'
                };
            default:
                return {
                    engine: 'hybrid',
                    mode: 'balanced',
                    reason: '기본 하이브리드 처리'
                };
        }
    }

    /**
     * 최적 처리 엔진 선택
     */
    async selectOptimalProcessor(document, options = {}) {
        const complexity = await this.analyzeComplexity(document);
        const historicalData = await this.getHistoricalPerformance(document);
        
        const selection = {
            complexity: complexity,
            historical: historicalData,
            strategy: options.strategy || this.currentStrategy,
            timestamp: new Date().toISOString()
        };

        // 전략에 따른 엔진 선택
        let selectedEngine;
        switch (selection.strategy) {
            case 'performance_based':
                selectedEngine = this.selectByPerformance(complexity, historicalData);
                break;
            case 'accuracy_based':
                selectedEngine = this.selectByAccuracy(complexity, historicalData);
                break;
            case 'balanced':
                selectedEngine = this.selectBalanced(complexity, historicalData);
                break;
            case 'adaptive':
            default:
                selectedEngine = this.selectAdaptive(complexity, historicalData);
                break;
        }

        selection.selectedEngine = selectedEngine;
        selection.confidence = this.calculateSelectionConfidence(complexity, historicalData, selectedEngine);

        // 선택 결과 기록
        this.recordSelection(selection);

        return selection;
    }

    /**
     * 성능 기반 엔진 선택
     */
    selectByPerformance(complexity, historical) {
        if (complexity.score <= 0.4) return 'legacy';
        if (complexity.score <= 0.7) return 'hybrid';
        return 'core';
    }

    /**
     * 정확도 기반 엔진 선택
     */
    selectByAccuracy(complexity, historical) {
        if (complexity.score <= 0.3) return 'legacy';
        if (complexity.score <= 0.6) return 'hybrid';
        return 'core';
    }

    /**
     * 균형 기반 엔진 선택
     */
    selectBalanced(complexity, historical) {
        const performanceChoice = this.selectByPerformance(complexity, historical);
        const accuracyChoice = this.selectByAccuracy(complexity, historical);
        
        // 두 선택이 다르면 하이브리드 선택
        if (performanceChoice !== accuracyChoice) return 'hybrid';
        return performanceChoice;
    }

    /**
     * 적응형 엔진 선택
     */
    selectAdaptive(complexity, historical) {
        // 과거 성능 데이터가 있으면 활용
        if (historical.samples > 5) {
            const bestEngine = historical.bestPerforming;
            if (historical.confidence > 0.8) return bestEngine;
        }

        // 복잡도와 시스템 부하를 고려한 동적 선택
        const systemLoad = this.getCurrentSystemLoad();
        
        if (systemLoad > 0.8) {
            // 시스템 부하가 높으면 가벼운 처리
            return complexity.score > 0.7 ? 'hybrid' : 'legacy';
        }

        // 일반적인 적응형 선택
        if (complexity.score <= 0.3) return 'legacy';
        if (complexity.score <= 0.7) return 'hybrid';
        return 'core';
    }

    /**
     * 과거 성능 데이터 조회
     */
    async getHistoricalPerformance(document) {
        const documentType = this.classifyDocumentType(document);
        const key = `${documentType}_performance`;
        
        const data = this.performanceHistory.get(key) || {
            samples: 0,
            engines: {
                legacy: { count: 0, avgTime: 0, avgAccuracy: 0 },
                hybrid: { count: 0, avgTime: 0, avgAccuracy: 0 },
                core: { count: 0, avgTime: 0, avgAccuracy: 0 }
            },
            bestPerforming: 'hybrid',
            confidence: 0
        };

        return data;
    }

    /**
     * 문서 유형 분류
     */
    classifyDocumentType(document) {
        const text = typeof document === 'string' ? document : document.text || '';
        
        if (text.includes('진료') || text.includes('의무기록')) return 'medical';
        if (text.includes('검사') || text.includes('결과')) return 'test_result';
        if (text.includes('처방') || text.includes('약물')) return 'prescription';
        return 'general';
    }

    /**
     * 현재 시스템 부하 조회
     */
    getCurrentSystemLoad() {
        // 실제 구현에서는 시스템 메트릭을 조회
        return Math.random() * 0.5; // 임시 구현
    }

    /**
     * 선택 신뢰도 계산
     */
    calculateSelectionConfidence(complexity, historical, selectedEngine) {
        let confidence = 0.5; // 기본 신뢰도

        // 복잡도 분석 신뢰도
        if (complexity.score < 0.2 || complexity.score > 0.8) {
            confidence += 0.2; // 극단적인 경우 더 확실
        }

        // 과거 데이터 신뢰도
        if (historical.samples > 10) {
            confidence += 0.2;
        }

        // 엔진별 신뢰도 조정
        if (selectedEngine === 'hybrid') {
            confidence += 0.1; // 하이브리드는 일반적으로 안전한 선택
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 선택 결과 기록
     */
    recordSelection(selection) {
        const documentType = this.classifyDocumentType(selection.complexity);
        const key = `${documentType}_selections`;
        
        if (!this.performanceHistory.has(key)) {
            this.performanceHistory.set(key, []);
        }

        const selections = this.performanceHistory.get(key);
        selections.push(selection);

        // 최근 100개만 유지
        if (selections.length > 100) {
            selections.shift();
        }
    }

    /**
     * 성능 피드백 기록
     */
    recordPerformanceFeedback(selectionId, performance) {
        // 실제 처리 결과를 바탕으로 성능 데이터 업데이트
        const { engine, processingTime, accuracy, errors } = performance;
        
        // 성능 히스토리 업데이트 로직
        console.log(`Performance feedback recorded for ${engine}: ${processingTime}ms, accuracy: ${accuracy}`);
    }

    /**
     * 라우팅 통계 조회
     */
    getRoutingStatistics() {
        const stats = {
            totalSelections: 0,
            engineDistribution: { legacy: 0, hybrid: 0, core: 0 },
            averageComplexity: 0,
            averageConfidence: 0
        };

        for (const [key, selections] of this.performanceHistory.entries()) {
            if (key.endsWith('_selections')) {
                stats.totalSelections += selections.length;
                
                selections.forEach(selection => {
                    stats.engineDistribution[selection.selectedEngine]++;
                    stats.averageComplexity += selection.complexity.score;
                    stats.averageConfidence += selection.confidence;
                });
            }
        }

        if (stats.totalSelections > 0) {
            stats.averageComplexity /= stats.totalSelections;
            stats.averageConfidence /= stats.totalSelections;
        }

        return stats;
    }

    /**
     * 라우팅 통계 조회 (대시보드용)
     */
    getRoutingStats() {
        return {
            totalRouted: 0,
            routingDistribution: { legacy: 0, hybrid: 0, core: 0 },
            averageConfidence: 0.85
        };
    }
}

export default IntelligentRouter;