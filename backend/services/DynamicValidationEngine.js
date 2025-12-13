/**
 * 동적 가중치 검증 엔진
 * 기존 고정된 83.3% 점수 문제를 해결하고 실제 데이터 품질 기반 동적 계산 구현
 */
class DynamicValidationEngine {
    constructor() {
        this.version = '2.0.0';
        
        // 동적 가중치 설정
        this.dynamicWeights = {
            completeness: { base: 0.3, range: [0.2, 0.4] },
            consistency: { base: 0.25, range: [0.15, 0.35] },
            medicalAccuracy: { base: 0.3, range: [0.25, 0.4] },
            formatCompliance: { base: 0.15, range: [0.1, 0.2] }
        };
        
        // 품질 임계값
        this.qualityThresholds = {
            excellent: 0.9,
            good: 0.8,
            acceptable: 0.7,
            poor: 0.6,
            unacceptable: 0.5
        };
        
        // 데이터 복잡도 분석기
        this.complexityAnalyzer = {
            textLength: { low: 1000, medium: 5000, high: 10000 },
            medicalTerms: { low: 10, medium: 30, high: 50 },
            dateComplexity: { low: 5, medium: 15, high: 30 }
        };
    }

    /**
     * 동적 검증 실행
     * @param {Object} nineItems - 9개 항목 데이터
     * @param {Object} rawData - 원본 데이터 (복잡도 분석용)
     * @returns {Object} 동적 검증 결과
     */
    validateWithDynamicWeights(nineItems, rawData = {}) {
        try {
            // 1. 데이터 복잡도 분석
            const complexity = this.analyzeDataComplexity(rawData);
            
            // 2. 동적 가중치 계산
            const weights = this.calculateDynamicWeights(complexity, nineItems);
            
            // 3. 각 검증 항목 점수 계산
            const validationScores = {
                completeness: this.checkCompleteness(nineItems),
                consistency: this.checkConsistency(nineItems),
                medicalAccuracy: this.checkMedicalAccuracy(nineItems, complexity),
                formatCompliance: this.checkFormatCompliance(nineItems)
            };
            
            // 4. 가중 평균 계산
            const weightedScore = this.calculateWeightedScore(validationScores, weights);
            
            // 5. 품질 등급 결정
            const qualityGrade = this.determineQualityGrade(weightedScore);
            
            // 6. 신뢰도 조정
            const adjustedConfidence = this.adjustConfidenceByComplexity(weightedScore, complexity);
            
            return {
                success: true,
                version: this.version,
                overallScore: Math.round(adjustedConfidence * 100),
                qualityGrade,
                weights,
                validationScores,
                complexity,
                recommendations: this.generateDynamicRecommendations(validationScores, weights, complexity),
                metadata: {
                    timestamp: new Date().toISOString(),
                    processingTime: Date.now(),
                    dataPoints: Object.keys(nineItems).length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                fallbackScore: 75 // 기본 점수
            };
        }
    }

    /**
     * 데이터 복잡도 분석
     */
    analyzeDataComplexity(rawData) {
        const text = rawData.text || '';
        const medicalRecords = rawData.medicalRecords || [];
        const dates = rawData.dates || [];
        
        return {
            textComplexity: this.analyzeTextComplexity(text),
            medicalComplexity: this.analyzeMedicalComplexity(medicalRecords),
            dateComplexity: this.analyzeDateComplexity(dates),
            overallComplexity: this.calculateOverallComplexity(text, medicalRecords, dates)
        };
    }

    /**
     * 텍스트 복잡도 분석
     */
    analyzeTextComplexity(text) {
        const length = text.length;
        const sentences = text.split(/[.!?]/).length;
        const medicalTerms = (text.match(/[가-힣]{2,}(증|병|염|암|질환|치료|수술|검사)/g) || []).length;
        
        let complexity = 'low';
        if (length > this.complexityAnalyzer.textLength.high || medicalTerms > this.complexityAnalyzer.medicalTerms.high) {
            complexity = 'high';
        } else if (length > this.complexityAnalyzer.textLength.medium || medicalTerms > this.complexityAnalyzer.medicalTerms.medium) {
            complexity = 'medium';
        }
        
        return {
            level: complexity,
            metrics: { length, sentences, medicalTerms },
            score: this.getComplexityScore(complexity)
        };
    }

    /**
     * 의료 복잡도 분석
     */
    analyzeMedicalComplexity(medicalRecords) {
        const recordCount = medicalRecords.length;
        const uniqueDiagnoses = new Set(medicalRecords.map(r => r.diagnosis || '')).size;
        const treatmentVariety = new Set(medicalRecords.map(r => r.treatment || '')).size;
        
        let complexity = 'low';
        if (recordCount > 20 || uniqueDiagnoses > 5 || treatmentVariety > 10) {
            complexity = 'high';
        } else if (recordCount > 10 || uniqueDiagnoses > 3 || treatmentVariety > 5) {
            complexity = 'medium';
        }
        
        return {
            level: complexity,
            metrics: { recordCount, uniqueDiagnoses, treatmentVariety },
            score: this.getComplexityScore(complexity)
        };
    }

    /**
     * 날짜 복잡도 분석
     */
    analyzeDateComplexity(dates) {
        const dateCount = dates.length;
        const dateRange = this.calculateDateRange(dates);
        const datePatterns = this.analyzeDatePatterns(dates);
        
        let complexity = 'low';
        if (dateCount > this.complexityAnalyzer.dateComplexity.high || dateRange > 365) {
            complexity = 'high';
        } else if (dateCount > this.complexityAnalyzer.dateComplexity.medium || dateRange > 90) {
            complexity = 'medium';
        }
        
        return {
            level: complexity,
            metrics: { dateCount, dateRange, datePatterns },
            score: this.getComplexityScore(complexity)
        };
    }

    /**
     * 전체 복잡도 계산
     */
    calculateOverallComplexity(text, medicalRecords, dates) {
        const textScore = this.analyzeTextComplexity(text).score;
        const medicalScore = this.analyzeMedicalComplexity(medicalRecords).score;
        const dateScore = this.analyzeDateComplexity(dates).score;
        
        const averageScore = (textScore + medicalScore + dateScore) / 3;
        
        if (averageScore >= 0.8) return 'high';
        if (averageScore >= 0.5) return 'medium';
        return 'low';
    }

    /**
     * 복잡도 점수 변환
     */
    getComplexityScore(complexity) {
        switch (complexity) {
            case 'high': return 1.0;
            case 'medium': return 0.6;
            case 'low': return 0.3;
            default: return 0.3;
        }
    }

    /**
     * 동적 가중치 계산
     */
    calculateDynamicWeights(complexity, nineItems) {
        const weights = {};
        
        Object.keys(this.dynamicWeights).forEach(key => {
            const config = this.dynamicWeights[key];
            let weight = config.base;
            
            // 복잡도에 따른 가중치 조정
            if (complexity.overallComplexity === 'high') {
                weight = config.range[1]; // 최대값
            } else if (complexity.overallComplexity === 'low') {
                weight = config.range[0]; // 최소값
            }
            
            // 데이터 품질에 따른 추가 조정
            weight = this.adjustWeightByDataQuality(key, weight, nineItems);
            
            weights[key] = weight;
        });
        
        // 가중치 정규화
        return this.normalizeWeights(weights);
    }

    /**
     * 데이터 품질에 따른 가중치 조정
     */
    adjustWeightByDataQuality(category, weight, nineItems) {
        const itemCount = Object.keys(nineItems).length;
        const validItems = Object.values(nineItems).filter(item => 
            item && !item.extractionError && item.confidence > 0.3
        ).length;
        
        const dataQuality = validItems / itemCount;
        
        // 데이터 품질이 높으면 정확성에 더 높은 가중치
        if (category === 'medicalAccuracy' && dataQuality > 0.8) {
            weight *= 1.2;
        }
        
        // 데이터 품질이 낮으면 완성도에 더 높은 가중치
        if (category === 'completeness' && dataQuality < 0.5) {
            weight *= 1.3;
        }
        
        return weight;
    }

    /**
     * 가중치 정규화
     */
    normalizeWeights(weights) {
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
        const normalized = {};
        
        Object.keys(weights).forEach(key => {
            normalized[key] = weights[key] / total;
        });
        
        return normalized;
    }

    /**
     * 가중 평균 점수 계산
     */
    calculateWeightedScore(scores, weights) {
        let weightedSum = 0;
        
        Object.keys(scores).forEach(key => {
            weightedSum += scores[key] * weights[key];
        });
        
        return Math.min(Math.max(weightedSum, 0), 1);
    }

    /**
     * 복잡도에 따른 신뢰도 조정
     */
    adjustConfidenceByComplexity(score, complexity) {
        let adjustedScore = score;
        
        // 고복잡도 데이터에서 높은 점수는 더 신뢰할 수 있음
        if (complexity.overallComplexity === 'high' && score > 0.8) {
            adjustedScore = Math.min(score * 1.1, 1.0);
        }
        
        // 저복잡도 데이터에서 낮은 점수는 더 심각함
        if (complexity.overallComplexity === 'low' && score < 0.6) {
            adjustedScore = score * 0.9;
        }
        
        return adjustedScore;
    }

    /**
     * 완성도 검사 (개선된 버전)
     */
    checkCompleteness(nineItems) {
        const requiredItems = ['visitDates', 'visitReasons', 'admissionPeriods', 'diagnoses', 
                              'treatments', 'surgeries', 'currentStatus', 'prognosis', 'comprehensiveOpinion'];
        
        let completenessScore = 0;
        let totalWeight = 0;
        
        requiredItems.forEach(item => {
            const weight = this.getItemImportanceWeight(item);
            totalWeight += weight;
            
            if (nineItems[item] && !nineItems[item].extractionError) {
                const itemScore = this.evaluateItemQuality(nineItems[item]);
                completenessScore += itemScore * weight;
            }
        });
        
        return completenessScore / totalWeight;
    }

    /**
     * 항목 중요도 가중치
     */
    getItemImportanceWeight(item) {
        const weights = {
            diagnoses: 1.5,
            treatments: 1.3,
            visitDates: 1.2,
            currentStatus: 1.2,
            prognosis: 1.1,
            visitReasons: 1.0,
            admissionPeriods: 1.0,
            surgeries: 0.9,
            comprehensiveOpinion: 0.8
        };
        
        return weights[item] || 1.0;
    }

    /**
     * 항목 품질 평가
     */
    evaluateItemQuality(item) {
        let quality = 0;
        
        // 기본 존재 여부
        if (item.summary && item.summary.trim() !== '') {
            quality += 0.4;
        }
        
        // 신뢰도
        if (item.confidence > 0.7) {
            quality += 0.3;
        } else if (item.confidence > 0.5) {
            quality += 0.2;
        } else if (item.confidence > 0.3) {
            quality += 0.1;
        }
        
        // 세부 정보
        if (item.details && item.details.length > 0) {
            quality += 0.2;
        }
        
        // 내용 길이 (너무 짧거나 길지 않은 적절한 길이)
        if (item.summary) {
            const length = item.summary.length;
            if (length >= 20 && length <= 500) {
                quality += 0.1;
            }
        }
        
        return Math.min(quality, 1.0);
    }

    /**
     * 일관성 검사 (개선된 버전)
     */
    checkConsistency(nineItems) {
        let consistencyScore = 1.0;
        const penalties = [];
        
        // 날짜 일관성
        const dateConsistency = this.checkDateConsistency(nineItems);
        consistencyScore *= dateConsistency.score;
        if (dateConsistency.issues.length > 0) {
            penalties.push(...dateConsistency.issues);
        }
        
        // 진단-치료 일관성
        const diagnosisTreatmentConsistency = this.checkDiagnosisTreatmentConsistency(nineItems);
        consistencyScore *= diagnosisTreatmentConsistency.score;
        if (diagnosisTreatmentConsistency.issues.length > 0) {
            penalties.push(...diagnosisTreatmentConsistency.issues);
        }
        
        // 현재 상태-예후 일관성
        const statusPrognosisConsistency = this.checkStatusPrognosisConsistency(nineItems);
        consistencyScore *= statusPrognosisConsistency.score;
        if (statusPrognosisConsistency.issues.length > 0) {
            penalties.push(...statusPrognosisConsistency.issues);
        }
        
        return Math.max(consistencyScore, 0.1);
    }

    /**
     * 날짜 일관성 검사
     */
    checkDateConsistency(nineItems) {
        const issues = [];
        let score = 1.0;
        
        const visitDates = nineItems.visitDates?.dates || [];
        const admissionDates = nineItems.admissionPeriods?.dates || [];
        
        // 내원일과 입원일 논리적 순서 확인
        if (visitDates.length > 0 && admissionDates.length > 0) {
            const firstVisit = new Date(visitDates[0]);
            const firstAdmission = new Date(admissionDates[0]);
            
            if (firstAdmission < firstVisit) {
                issues.push('입원일이 내원일보다 빠름');
                score *= 0.8;
            }
        }
        
        return { score, issues };
    }

    /**
     * 진단-치료 일관성 검사
     */
    checkDiagnosisTreatmentConsistency(nineItems) {
        const issues = [];
        let score = 1.0;
        
        const diagnoses = nineItems.diagnoses?.items || [];
        const treatments = nineItems.treatments?.items || [];
        
        if (diagnoses.length === 0 && treatments.length > 0) {
            issues.push('진단 없이 치료만 존재');
            score *= 0.7;
        }
        
        if (diagnoses.length > 0 && treatments.length === 0) {
            issues.push('진단 있으나 치료 정보 없음');
            score *= 0.8;
        }
        
        return { score, issues };
    }

    /**
     * 현재 상태-예후 일관성 검사
     */
    checkStatusPrognosisConsistency(nineItems) {
        const issues = [];
        let score = 1.0;
        
        const currentStatus = nineItems.currentStatus?.summary || '';
        const prognosis = nineItems.prognosis?.summary || '';
        
        // 간단한 키워드 기반 일관성 검사
        const statusKeywords = this.extractKeywords(currentStatus);
        const prognosisKeywords = this.extractKeywords(prognosis);
        
        const commonKeywords = statusKeywords.filter(k => prognosisKeywords.includes(k));
        
        if (statusKeywords.length > 0 && prognosisKeywords.length > 0 && commonKeywords.length === 0) {
            issues.push('현재 상태와 예후 간 연관성 부족');
            score *= 0.9;
        }
        
        return { score, issues };
    }

    /**
     * 키워드 추출
     */
    extractKeywords(text) {
        const medicalKeywords = text.match(/[가-힣]{2,}(증|병|염|암|질환|치료|수술|검사|회복|악화|호전|안정)/g) || [];
        return [...new Set(medicalKeywords)];
    }

    /**
     * 의학적 정확성 검사 (개선된 버전)
     */
    checkMedicalAccuracy(nineItems, complexity) {
        let accuracyScore = 0.7; // 기본 점수
        
        // 진단명 정확성
        const diagnosisAccuracy = this.checkDiagnosisAccuracy(nineItems.diagnoses);
        accuracyScore += diagnosisAccuracy * 0.3;
        
        // 치료 정확성
        const treatmentAccuracy = this.checkTreatmentAccuracy(nineItems.treatments);
        accuracyScore += treatmentAccuracy * 0.2;
        
        // 의학 용어 사용 정확성
        const terminologyAccuracy = this.checkTerminologyAccuracy(nineItems);
        accuracyScore += terminologyAccuracy * 0.1;
        
        // 복잡도에 따른 조정
        if (complexity.overallComplexity === 'high') {
            accuracyScore *= 1.1; // 복잡한 데이터에서 정확성이 높으면 더 가치 있음
        }
        
        return Math.min(accuracyScore, 1.0);
    }

    /**
     * 진단명 정확성 검사
     */
    checkDiagnosisAccuracy(diagnoses) {
        if (!diagnoses || !diagnoses.items) return 0;
        
        const items = diagnoses.items;
        let accuracy = 0;
        
        items.forEach(diagnosis => {
            if (typeof diagnosis === 'string' && diagnosis.length > 2) {
                // 의학적 진단명 패턴 확인
                if (diagnosis.match(/[가-힣]{2,}(증|병|염|암|질환)/)) {
                    accuracy += 0.3;
                }
                
                // ICD 코드 패턴 확인
                if (diagnosis.match(/[A-Z]\d{2}/)) {
                    accuracy += 0.2;
                }
            }
        });
        
        return Math.min(accuracy, 1.0);
    }

    /**
     * 치료 정확성 검사
     */
    checkTreatmentAccuracy(treatments) {
        if (!treatments || !treatments.items) return 0;
        
        const items = treatments.items;
        let accuracy = 0;
        
        items.forEach(treatment => {
            if (typeof treatment === 'string' && treatment.length > 2) {
                // 치료 관련 용어 확인
                if (treatment.match(/[가-힣]{2,}(치료|수술|요법|처방|투약)/)) {
                    accuracy += 0.2;
                }
                
                // 약물명 패턴 확인
                if (treatment.match(/[가-힣]{2,}(정|캡슐|주사|시럽)/)) {
                    accuracy += 0.1;
                }
            }
        });
        
        return Math.min(accuracy, 1.0);
    }

    /**
     * 의학 용어 정확성 검사
     */
    checkTerminologyAccuracy(nineItems) {
        let accuracy = 0;
        let totalTerms = 0;
        
        Object.values(nineItems).forEach(item => {
            if (item && item.summary) {
                const medicalTerms = item.summary.match(/[가-힣]{3,}(증|병|염|암|질환|치료|수술|검사)/g) || [];
                totalTerms += medicalTerms.length;
                
                // 적절한 의학 용어 사용 확인
                medicalTerms.forEach(term => {
                    if (term.length >= 3 && term.length <= 10) {
                        accuracy += 0.1;
                    }
                });
            }
        });
        
        return totalTerms > 0 ? Math.min(accuracy / totalTerms, 1.0) : 0.5;
    }

    /**
     * 형식 준수 검사 (개선된 버전)
     */
    checkFormatCompliance(nineItems) {
        let complianceScore = 1.0;
        const requiredFields = ['summary', 'confidence'];
        
        Object.entries(nineItems).forEach(([key, value]) => {
            if (!value || typeof value !== 'object') {
                complianceScore -= 0.1;
                return;
            }
            
            // 필수 필드 확인
            requiredFields.forEach(field => {
                if (value[field] === undefined || value[field] === null) {
                    complianceScore -= 0.05;
                }
            });
            
            // 신뢰도 범위 확인
            if (value.confidence !== undefined && (value.confidence < 0 || value.confidence > 1)) {
                complianceScore -= 0.03;
            }
            
            // 요약 길이 확인
            if (value.summary && (value.summary.length < 5 || value.summary.length > 1000)) {
                complianceScore -= 0.02;
            }
        });
        
        return Math.max(complianceScore, 0);
    }

    /**
     * 품질 등급 결정
     */
    determineQualityGrade(score) {
        if (score >= this.qualityThresholds.excellent) return 'excellent';
        if (score >= this.qualityThresholds.good) return 'good';
        if (score >= this.qualityThresholds.acceptable) return 'acceptable';
        if (score >= this.qualityThresholds.poor) return 'poor';
        return 'unacceptable';
    }

    /**
     * 동적 권고사항 생성
     */
    generateDynamicRecommendations(scores, weights, complexity) {
        const recommendations = [];
        
        // 점수별 권고사항
        Object.entries(scores).forEach(([category, score]) => {
            const weight = weights[category];
            const impact = score * weight;
            
            if (impact < 0.15) { // 가중 영향도가 낮은 경우
                recommendations.push({
                    category,
                    priority: 'high',
                    message: this.getCategoryRecommendation(category, score),
                    impact: 'high'
                });
            } else if (impact < 0.25) {
                recommendations.push({
                    category,
                    priority: 'medium',
                    message: this.getCategoryRecommendation(category, score),
                    impact: 'medium'
                });
            }
        });
        
        // 복잡도별 권고사항
        if (complexity.overallComplexity === 'high') {
            recommendations.push({
                category: 'complexity',
                priority: 'medium',
                message: '고복잡도 데이터입니다. 전문가 검토를 권장합니다.',
                impact: 'medium'
            });
        }
        
        return recommendations;
    }

    /**
     * 카테고리별 권고사항
     */
    getCategoryRecommendation(category, score) {
        const messages = {
            completeness: score < 0.5 ? '필수 정보가 많이 누락되었습니다. 추가 문서 검토가 필요합니다.' : 
                         '일부 정보가 부족합니다. 보완이 필요합니다.',
            consistency: score < 0.6 ? '데이터 간 심각한 불일치가 있습니다. 전체적인 재검토가 필요합니다.' : 
                        '일부 데이터 불일치가 있습니다. 확인이 필요합니다.',
            medicalAccuracy: score < 0.7 ? '의학적 정확성에 문제가 있습니다. 전문의 검토가 필요합니다.' : 
                           '의학적 정확성 개선이 필요합니다.',
            formatCompliance: score < 0.8 ? '형식 표준 준수에 문제가 있습니다. 형식 재정비가 필요합니다.' : 
                            '형식 개선이 필요합니다.'
        };
        
        return messages[category] || '개선이 필요합니다.';
    }

    /**
     * 날짜 범위 계산
     */
    calculateDateRange(dates) {
        if (dates.length < 2) return 0;
        
        const sortedDates = dates.map(d => new Date(d)).sort((a, b) => a - b);
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        
        return Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
    }

    /**
     * 날짜 패턴 분석
     */
    analyzeDatePatterns(dates) {
        const patterns = {
            formats: new Set(),
            frequencies: {}
        };
        
        dates.forEach(date => {
            // 날짜 형식 패턴 분석
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                patterns.formats.add('YYYY-MM-DD');
            } else if (date.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                patterns.formats.add('YYYY/MM/DD');
            } else {
                patterns.formats.add('other');
            }
        });
        
        return {
            formatCount: patterns.formats.size,
            formats: Array.from(patterns.formats)
        };
    }
}

export default DynamicValidationEngine;
