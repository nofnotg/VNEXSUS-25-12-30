/**
 * 🧬📈 Disease Progression Tracker
 * Task 05: 질병 진행 패턴 추적 및 분석
 * 
 * 보험 관점에서 질병의 진행 패턴을 추적하고 분석하여
 * 기존 질환과 신규 질환을 구분하고 보험 리스크를 평가합니다.
 */

const { AIService } = require('./aiService');
const logger = require('../utils/logger');

class DiseaseProgressionTracker {
    constructor() {
        this.aiService = new AIService();
        this.diseasePatterns = this.initializeDiseasePatterns();
        this.insuranceKeywords = this.initializeInsuranceKeywords();
        this.progressionStages = this.initializeProgressionStages();
    }

    /**
     * 질병 패턴 초기화
     */
    initializeDiseasePatterns() {
        return {
            // 급성 질환 패턴
            acute: {
                keywords: ['급성', '응급', '돌발', '갑작스런', '즉시'],
                timeframe: { min: 0, max: 7 }, // 일 단위
                severity: 'high',
                insuranceRisk: 'immediate'
            },
            
            // 만성 질환 패턴
            chronic: {
                keywords: ['만성', '지속적', '계속', '오랜기간', '장기간'],
                timeframe: { min: 90, max: null }, // 3개월 이상
                severity: 'moderate',
                insuranceRisk: 'ongoing'
            },
            
            // 진행성 질환 패턴
            progressive: {
                keywords: ['진행', '악화', '확산', '전이', '발전'],
                timeframe: { min: 30, max: 365 },
                severity: 'variable',
                insuranceRisk: 'escalating'
            },
            
            // 재발성 질환 패턴
            recurrent: {
                keywords: ['재발', '반복', '다시', '또다시', '재차'],
                timeframe: { min: 30, max: null },
                severity: 'moderate',
                insuranceRisk: 'recurring'
            },
            
            // 합병증 패턴
            complication: {
                keywords: ['합병증', '부작용', '이차적', '연관', '동반'],
                timeframe: { min: 1, max: 180 },
                severity: 'high',
                insuranceRisk: 'compound'
            }
        };
    }

    /**
     * 보험 관련 키워드 초기화
     */
    initializeInsuranceKeywords() {
        return {
            preexisting: {
                keywords: ['기존', '과거', '이전', '예전', '전부터', '원래'],
                weight: 1.0,
                riskLevel: 'excluded'
            },
            newOnset: {
                keywords: ['신규', '새로운', '처음', '최초', '금번', '이번'],
                weight: 0.8,
                riskLevel: 'covered'
            },
            uncertain: {
                keywords: ['의심', '추정', '가능성', '불명확', '애매'],
                weight: 0.6,
                riskLevel: 'investigation'
            },
            severity: {
                mild: ['경미', '가벼운', '약간', '미미'],
                moderate: ['중등도', '보통', '일반적'],
                severe: ['심각', '중증', '위험', '심한', '극심']
            }
        };
    }

    /**
     * 진행 단계 초기화
     */
    initializeProgressionStages() {
        return {
            initial: {
                stage: 'initial',
                description: '초기 발병',
                keywords: ['초기', '시작', '발병', '발생', '시작됨'],
                insuranceImpact: 'low'
            },
            developing: {
                stage: 'developing',
                description: '진행 중',
                keywords: ['진행', '발전', '확산', '증가', '심화'],
                insuranceImpact: 'medium'
            },
            established: {
                stage: 'established',
                description: '확립된 상태',
                keywords: ['확립', '안정', '지속', '유지', '고정'],
                insuranceImpact: 'high'
            },
            advanced: {
                stage: 'advanced',
                description: '진행된 상태',
                keywords: ['진행된', '고도', '심각', '말기', '중증'],
                insuranceImpact: 'very_high'
            },
            resolved: {
                stage: 'resolved',
                description: '해결됨',
                keywords: ['완치', '회복', '해결', '치유', '정상'],
                insuranceImpact: 'minimal'
            }
        };
    }

    /**
     * 질병 진행 패턴 추적
     * @param {Array} genes - DNA 유전자 배열
     * @param {Object} causalNetwork - 인과관계 네트워크
     * @param {Object} dateInfo - 날짜 정보
     * @returns {Object} 질병 진행 분석 결과
     */
    async trackDiseaseProgression(genes, causalNetwork = {}, dateInfo = {}) {
        try {
            logger.info('📈 Tracking disease progression patterns');
            
            // 1. 질병 이벤트 추출
            const diseaseEvents = this.extractDiseaseEvents(genes);
            
            // 2. 시간적 순서 분석
            const temporalAnalysis = this.analyzeTemporalProgression(diseaseEvents, dateInfo);
            
            // 3. 질병 패턴 분류
            const patternClassification = this.classifyDiseasePatterns(diseaseEvents);
            
            // 4. 진행 단계 분석
            const stageAnalysis = await this.analyzeProgressionStages(diseaseEvents);
            
            // 5. 보험 관점 분석
            const insuranceAnalysis = this.analyzeInsurancePerspective(diseaseEvents, temporalAnalysis);
            
            // 6. 리스크 평가
            const riskAssessment = this.assessInsuranceRisk(diseaseEvents, patternClassification, stageAnalysis);
            
            // 7. 진행 예측
            const progressionPrediction = await this.predictProgression(diseaseEvents, causalNetwork);
            
            const result = {
                diseaseEvents,
                temporalAnalysis,
                patternClassification,
                stageAnalysis,
                insuranceAnalysis,
                riskAssessment,
                progressionPrediction,
                summary: this.generateProgressionSummary(diseaseEvents, riskAssessment)
            };
            
            logger.info(`✅ Disease progression tracked for ${diseaseEvents.length} events`);
            return result;
            
        } catch (error) {
            logger.error('❌ Error tracking disease progression:', error);
            throw error;
        }
    }

    /**
     * 질병 이벤트 추출
     */
    extractDiseaseEvents(genes) {
        const diseaseEvents = [];
        
        genes.forEach((gene, index) => {
            const diseaseInfo = this.analyzeDiseaseContent(gene.content);
            
            if (diseaseInfo.isDiseaseRelated) {
                diseaseEvents.push({
                    id: `disease_${index}`,
                    geneId: gene.id,
                    content: gene.content,
                    diseaseType: diseaseInfo.type,
                    severity: diseaseInfo.severity,
                    confidence: gene.confidence,
                    temporalInfo: gene.temporalContext || null,
                    layoutInfo: gene.layout || null,
                    diseaseKeywords: diseaseInfo.keywords,
                    medicalCodes: diseaseInfo.codes || []
                });
            }
        });
        
        return diseaseEvents;
    }

    /**
     * 질병 내용 분석
     */
    analyzeDiseaseContent(content) {
        const diseaseKeywords = [
            '질병', '질환', '병', '증상', '진단', '치료',
            '고혈압', '당뇨', '암', '심장병', '뇌졸중',
            '감염', '염증', '종양', '골절', '손상'
        ];
        
        const isDiseaseRelated = diseaseKeywords.some(keyword => content.includes(keyword));
        
        if (!isDiseaseRelated) {
            return { isDiseaseRelated: false };
        }
        
        // 질병 유형 분석
        const type = this.determineDiseaseType(content);
        
        // 심각도 분석
        const severity = this.determineSeverity(content);
        
        // 관련 키워드 추출
        const keywords = this.extractRelevantKeywords(content);
        
        return {
            isDiseaseRelated: true,
            type,
            severity,
            keywords
        };
    }

    /**
     * 질병 유형 결정
     */
    determineDiseaseType(content) {
        const typePatterns = {
            cardiovascular: /심장|혈관|고혈압|심근|부정맥/,
            diabetes: /당뇨|혈당|인슐린/,
            cancer: /암|종양|악성|전이/,
            neurological: /뇌|신경|치매|파킨슨/,
            respiratory: /폐|호흡|천식|기관지/,
            musculoskeletal: /골절|관절|근육|뼈/,
            infectious: /감염|바이러스|세균|염증/,
            other: /.*/
        };
        
        for (const [type, pattern] of Object.entries(typePatterns)) {
            if (pattern.test(content)) {
                return type;
            }
        }
        
        return 'unknown';
    }

    /**
     * 심각도 결정
     */
    determineSeverity(content) {
        const { severity } = this.insuranceKeywords;
        
        for (const [level, keywords] of Object.entries(severity)) {
            if (keywords.some(keyword => content.includes(keyword))) {
                return level;
            }
        }
        
        return 'moderate'; // 기본값
    }

    /**
     * 관련 키워드 추출
     */
    extractRelevantKeywords(content) {
        const allKeywords = [
            ...this.insuranceKeywords.preexisting.keywords,
            ...this.insuranceKeywords.newOnset.keywords,
            ...this.insuranceKeywords.uncertain.keywords,
            ...Object.values(this.insuranceKeywords.severity).flat()
        ];
        
        return allKeywords.filter(keyword => content.includes(keyword));
    }

    /**
     * 시간적 진행 분석
     */
    analyzeTemporalProgression(diseaseEvents, dateInfo) {
        if (!dateInfo.timeline || dateInfo.timeline.length === 0) {
            return {
                hasTemporalData: false,
                progression: 'unknown'
            };
        }
        
        // 질병 관련 이벤트를 시간순으로 정렬
        const sortedEvents = diseaseEvents
            .filter(event => event.temporalInfo)
            .sort((a, b) => {
                const dateA = new Date(a.temporalInfo.normalizedDate);
                const dateB = new Date(b.temporalInfo.normalizedDate);
                return dateA - dateB;
            });
        
        if (sortedEvents.length < 2) {
            return {
                hasTemporalData: true,
                progression: 'insufficient_data',
                events: sortedEvents
            };
        }
        
        // 진행 패턴 분석
        const progressionPattern = this.analyzeProgressionPattern(sortedEvents);
        
        return {
            hasTemporalData: true,
            progression: progressionPattern.type,
            timeline: sortedEvents,
            pattern: progressionPattern,
            duration: this.calculateDuration(sortedEvents),
            intervals: this.calculateIntervals(sortedEvents)
        };
    }

    /**
     * 진행 패턴 분석
     */
    analyzeProgressionPattern(sortedEvents) {
        const intervals = this.calculateIntervals(sortedEvents);
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        
        // 패턴 분류
        if (avgInterval <= 7) {
            return { type: 'acute', confidence: 0.9 };
        } else if (avgInterval <= 30) {
            return { type: 'subacute', confidence: 0.8 };
        } else if (avgInterval <= 90) {
            return { type: 'chronic_developing', confidence: 0.85 };
        } else {
            return { type: 'chronic_stable', confidence: 0.9 };
        }
    }

    /**
     * 기간 계산
     */
    calculateDuration(sortedEvents) {
        if (sortedEvents.length < 2) return 0;
        
        const firstDate = new Date(sortedEvents[0].temporalInfo.normalizedDate);
        const lastDate = new Date(sortedEvents[sortedEvents.length - 1].temporalInfo.normalizedDate);
        
        return Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)); // 일 단위
    }

    /**
     * 간격 계산
     */
    calculateIntervals(sortedEvents) {
        const intervals = [];
        
        for (let i = 1; i < sortedEvents.length; i++) {
            const prevDate = new Date(sortedEvents[i-1].temporalInfo.normalizedDate);
            const currDate = new Date(sortedEvents[i].temporalInfo.normalizedDate);
            const interval = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24));
            intervals.push(interval);
        }
        
        return intervals;
    }

    /**
     * 질병 패턴 분류
     */
    classifyDiseasePatterns(diseaseEvents) {
        const patterns = {};
        
        Object.keys(this.diseasePatterns).forEach(patternType => {
            patterns[patternType] = {
                events: [],
                confidence: 0,
                count: 0
            };
        });
        
        diseaseEvents.forEach(event => {
            for (const [patternType, pattern] of Object.entries(this.diseasePatterns)) {
                const hasKeywords = pattern.keywords.some(keyword => 
                    event.content.includes(keyword)
                );
                
                if (hasKeywords) {
                    patterns[patternType].events.push(event);
                    patterns[patternType].count++;
                    patterns[patternType].confidence = Math.min(
                        patterns[patternType].confidence + 0.2, 
                        1.0
                    );
                }
            }
        });
        
        return patterns;
    }

    /**
     * 진행 단계 분석
     */
    async analyzeProgressionStages(diseaseEvents) {
        try {
            const prompt = this.buildStageAnalysisPrompt(diseaseEvents);
            const response = await this.aiService.generateResponse(prompt, {
                model: 'claude-3-sonnet-20240229',
                maxTokens: 1500,
                temperature: 0.3
            });
            
            return this.parseStageAnalysisResponse(response, diseaseEvents);
            
        } catch (error) {
            logger.error('❌ Error in AI-based stage analysis:', error);
            return this.fallbackStageAnalysis(diseaseEvents);
        }
    }

    /**
     * 단계 분석 프롬프트 구축
     */
    buildStageAnalysisPrompt(diseaseEvents) {
        const eventsText = diseaseEvents.map(event => 
            `[${event.id}] ${event.diseaseType}: ${event.content}`
        ).join('\n');
        
        return `
다음 질병 관련 이벤트들의 진행 단계를 분석해주세요:

${eventsText}

각 이벤트에 대해 다음 형식으로 분석해주세요:
- 이벤트 ID: 진행단계 (신뢰도 0-1) - 설명
- 예: disease_1: initial (0.85) - 초기 증상 발현

진행단계: initial, developing, established, advanced, resolved
보험 관점에서 기존 질환과 신규 질환을 구분하여 분석해주세요.
`;
    }

    /**
     * 단계 분석 응답 파싱
     */
    parseStageAnalysisResponse(response, diseaseEvents) {
        const stageAnalysis = {};
        const lines = response.split('\n');
        
        for (const line of lines) {
            const match = line.match(/([a-zA-Z0-9_]+):\s*([a-zA-Z_]+)\s*\((\d*\.?\d+)\)\s*-\s*(.+)/);
            if (match) {
                const [, eventId, stage, confidence, description] = match;
                
                stageAnalysis[eventId] = {
                    stage,
                    confidence: parseFloat(confidence),
                    description: description.trim(),
                    insuranceImpact: this.progressionStages[stage]?.insuranceImpact || 'unknown'
                };
            }
        }
        
        return stageAnalysis;
    }

    /**
     * 대체 단계 분석
     */
    fallbackStageAnalysis(diseaseEvents) {
        const stageAnalysis = {};
        
        diseaseEvents.forEach(event => {
            // 키워드 기반 단계 분석
            let detectedStage = 'developing'; // 기본값
            let maxConfidence = 0;
            
            for (const [stageName, stageInfo] of Object.entries(this.progressionStages)) {
                const keywordMatches = stageInfo.keywords.filter(keyword => 
                    event.content.includes(keyword)
                ).length;
                
                const confidence = keywordMatches / stageInfo.keywords.length;
                
                if (confidence > maxConfidence) {
                    maxConfidence = confidence;
                    detectedStage = stageName;
                }
            }
            
            stageAnalysis[event.id] = {
                stage: detectedStage,
                confidence: Math.max(maxConfidence, 0.5),
                description: `키워드 기반 ${detectedStage} 단계 추정`,
                insuranceImpact: this.progressionStages[detectedStage]?.insuranceImpact || 'unknown'
            };
        });
        
        return stageAnalysis;
    }

    /**
     * 보험 관점 분석
     */
    analyzeInsurancePerspective(diseaseEvents, temporalAnalysis) {
        const analysis = {
            preexistingConditions: [],
            newOnsetConditions: [],
            uncertainConditions: [],
            riskFactors: [],
            coverageRecommendations: []
        };
        
        diseaseEvents.forEach(event => {
            const classification = this.classifyInsuranceStatus(event);
            
            switch (classification.status) {
                case 'preexisting':
                    analysis.preexistingConditions.push({
                        event,
                        confidence: classification.confidence,
                        reason: classification.reason
                    });
                    break;
                    
                case 'new_onset':
                    analysis.newOnsetConditions.push({
                        event,
                        confidence: classification.confidence,
                        reason: classification.reason
                    });
                    break;
                    
                case 'uncertain':
                    analysis.uncertainConditions.push({
                        event,
                        confidence: classification.confidence,
                        reason: classification.reason
                    });
                    break;
            }
            
            // 리스크 요인 분석
            const riskFactors = this.identifyRiskFactors(event);
            analysis.riskFactors.push(...riskFactors);
        });
        
        // 보장 권고사항 생성
        analysis.coverageRecommendations = this.generateCoverageRecommendations(analysis);
        
        return analysis;
    }

    /**
     * 보험 상태 분류
     */
    classifyInsuranceStatus(event) {
        const { preexisting, newOnset, uncertain } = this.insuranceKeywords;
        
        let preexistingScore = 0;
        let newOnsetScore = 0;
        let uncertainScore = 0;
        
        // 키워드 기반 점수 계산
        preexisting.keywords.forEach(keyword => {
            if (event.content.includes(keyword)) {
                preexistingScore += preexisting.weight;
            }
        });
        
        newOnset.keywords.forEach(keyword => {
            if (event.content.includes(keyword)) {
                newOnsetScore += newOnset.weight;
            }
        });
        
        uncertain.keywords.forEach(keyword => {
            if (event.content.includes(keyword)) {
                uncertainScore += uncertain.weight;
            }
        });
        
        // 시간 정보 고려
        if (event.temporalInfo) {
            const timeContext = event.temporalInfo.medicalContext;
            if (timeContext === 'past_history') {
                preexistingScore += 0.5;
            } else if (timeContext === 'current') {
                newOnsetScore += 0.3;
            }
        }
        
        // 최고 점수 기준 분류
        const maxScore = Math.max(preexistingScore, newOnsetScore, uncertainScore);
        
        if (maxScore === 0) {
            return {
                status: 'uncertain',
                confidence: 0.3,
                reason: '명확한 분류 키워드 없음'
            };
        }
        
        if (preexistingScore === maxScore) {
            return {
                status: 'preexisting',
                confidence: Math.min(preexistingScore, 1.0),
                reason: '기존 질환 키워드 감지'
            };
        } else if (newOnsetScore === maxScore) {
            return {
                status: 'new_onset',
                confidence: Math.min(newOnsetScore, 1.0),
                reason: '신규 발병 키워드 감지'
            };
        } else {
            return {
                status: 'uncertain',
                confidence: Math.min(uncertainScore, 1.0),
                reason: '불확실성 키워드 감지'
            };
        }
    }

    /**
     * 리스크 요인 식별
     */
    identifyRiskFactors(event) {
        const riskFactors = [];
        
        // 심각도 기반 리스크
        if (event.severity === 'severe') {
            riskFactors.push({
                type: 'severity',
                level: 'high',
                description: '중증 질환',
                impact: 'major'
            });
        }
        
        // 질병 유형 기반 리스크
        const highRiskTypes = ['cancer', 'cardiovascular', 'neurological'];
        if (highRiskTypes.includes(event.diseaseType)) {
            riskFactors.push({
                type: 'disease_type',
                level: 'high',
                description: `고위험 질병군: ${event.diseaseType}`,
                impact: 'major'
            });
        }
        
        return riskFactors;
    }

    /**
     * 보장 권고사항 생성
     */
    generateCoverageRecommendations(analysis) {
        const recommendations = [];
        
        // 기존 질환이 많은 경우
        if (analysis.preexistingConditions.length > 2) {
            recommendations.push({
                type: 'exclusion',
                priority: 'high',
                description: '다수의 기존 질환으로 인한 보장 제외 검토 필요',
                conditions: analysis.preexistingConditions.map(c => c.event.diseaseType)
            });
        }
        
        // 신규 질환이 있는 경우
        if (analysis.newOnsetConditions.length > 0) {
            recommendations.push({
                type: 'coverage',
                priority: 'medium',
                description: '신규 발병 질환에 대한 보장 적용 가능',
                conditions: analysis.newOnsetConditions.map(c => c.event.diseaseType)
            });
        }
        
        // 불확실한 경우
        if (analysis.uncertainConditions.length > 0) {
            recommendations.push({
                type: 'investigation',
                priority: 'high',
                description: '추가 조사 및 의료진 검토 필요',
                conditions: analysis.uncertainConditions.map(c => c.event.diseaseType)
            });
        }
        
        return recommendations;
    }

    /**
     * 보험 리스크 평가
     */
    assessInsuranceRisk(diseaseEvents, patternClassification, stageAnalysis) {
        let totalRiskScore = 0;
        let riskFactors = [];
        
        // 질병 이벤트별 리스크 계산
        diseaseEvents.forEach(event => {
            let eventRisk = 0;
            
            // 심각도 기반 리스크
            const severityWeights = { mild: 0.2, moderate: 0.5, severe: 1.0 };
            eventRisk += severityWeights[event.severity] || 0.5;
            
            // 질병 유형 기반 리스크
            const typeWeights = {
                cancer: 1.0,
                cardiovascular: 0.9,
                neurological: 0.8,
                diabetes: 0.7,
                respiratory: 0.6,
                other: 0.4
            };
            eventRisk += typeWeights[event.diseaseType] || 0.4;
            
            // 진행 단계 기반 리스크
            const stageInfo = stageAnalysis[event.id];
            if (stageInfo) {
                const stageWeights = {
                    initial: 0.3,
                    developing: 0.6,
                    established: 0.8,
                    advanced: 1.0,
                    resolved: 0.1
                };
                eventRisk += stageWeights[stageInfo.stage] || 0.5;
            }
            
            totalRiskScore += eventRisk;
            
            if (eventRisk > 1.5) {
                riskFactors.push({
                    eventId: event.id,
                    riskScore: eventRisk,
                    factors: [event.severity, event.diseaseType, stageInfo?.stage]
                });
            }
        });
        
        // 패턴 기반 리스크 조정
        if (patternClassification.chronic.count > 0) {
            totalRiskScore *= 1.2; // 만성 질환 가중치
        }
        
        if (patternClassification.progressive.count > 0) {
            totalRiskScore *= 1.3; // 진행성 질환 가중치
        }
        
        // 리스크 레벨 결정
        const averageRisk = diseaseEvents.length > 0 ? totalRiskScore / diseaseEvents.length : 0;
        let riskLevel = 'low';
        
        if (averageRisk > 2.0) {
            riskLevel = 'very_high';
        } else if (averageRisk > 1.5) {
            riskLevel = 'high';
        } else if (averageRisk > 1.0) {
            riskLevel = 'medium';
        }
        
        return {
            totalRiskScore,
            averageRisk,
            riskLevel,
            riskFactors,
            recommendation: this.generateRiskRecommendation(riskLevel, riskFactors)
        };
    }

    /**
     * 리스크 권고사항 생성
     */
    generateRiskRecommendation(riskLevel, riskFactors) {
        const recommendations = {
            very_high: {
                action: 'decline',
                description: '보험 가입 거절 권고',
                reason: '매우 높은 리스크로 인한 보장 불가'
            },
            high: {
                action: 'conditional',
                description: '조건부 가입 검토',
                reason: '높은 리스크로 인한 보장 제한 필요'
            },
            medium: {
                action: 'standard_plus',
                description: '표준 플러스 요율 적용',
                reason: '중간 리스크로 인한 할증 적용'
            },
            low: {
                action: 'standard',
                description: '표준 요율 적용 가능',
                reason: '낮은 리스크로 정상 보장'
            }
        };
        
        return recommendations[riskLevel] || recommendations.medium;
    }

    /**
     * 진행 예측
     */
    async predictProgression(diseaseEvents, causalNetwork) {
        try {
            const prompt = this.buildProgressionPredictionPrompt(diseaseEvents, causalNetwork);
            const response = await this.aiService.generateResponse(prompt, {
                model: 'claude-3-sonnet-20240229',
                maxTokens: 1000,
                temperature: 0.4
            });
            
            return this.parseProgressionPrediction(response);
            
        } catch (error) {
            logger.error('❌ Error in progression prediction:', error);
            return this.fallbackProgressionPrediction(diseaseEvents);
        }
    }

    /**
     * 진행 예측 프롬프트 구축
     */
    buildProgressionPredictionPrompt(diseaseEvents, causalNetwork) {
        const eventsText = diseaseEvents.map(event => 
            `${event.diseaseType}: ${event.content} (심각도: ${event.severity})`
        ).join('\n');
        
        return `
다음 질병 이벤트들의 향후 진행을 예측해주세요:

${eventsText}

다음 항목들을 포함하여 분석해주세요:
1. 예상 진행 방향 (호전/악화/유지)
2. 예상 기간 (단기/중기/장기)
3. 주요 위험 요인
4. 보험 관점에서의 리스크 변화
5. 권고사항

간결하고 구체적으로 답변해주세요.
`;
    }

    /**
     * 진행 예측 파싱
     */
    parseProgressionPrediction(response) {
        // 간단한 파싱 로직
        return {
            direction: this.extractDirection(response),
            timeframe: this.extractTimeframe(response),
            riskFactors: this.extractRiskFactors(response),
            insuranceImpact: this.extractInsuranceImpact(response),
            recommendations: this.extractRecommendations(response),
            confidence: 0.7,
            rawResponse: response
        };
    }

    /**
     * 방향 추출
     */
    extractDirection(response) {
        if (response.includes('호전') || response.includes('개선')) return 'improvement';
        if (response.includes('악화') || response.includes('진행')) return 'deterioration';
        if (response.includes('유지') || response.includes('안정')) return 'stable';
        return 'uncertain';
    }

    /**
     * 기간 추출
     */
    extractTimeframe(response) {
        if (response.includes('단기') || response.includes('즉시')) return 'short_term';
        if (response.includes('중기') || response.includes('수개월')) return 'medium_term';
        if (response.includes('장기') || response.includes('수년')) return 'long_term';
        return 'medium_term';
    }

    /**
     * 리스크 요인 추출
     */
    extractRiskFactors(response) {
        const factors = [];
        const riskKeywords = ['위험', '요인', '합병증', '악화', '진행'];
        
        riskKeywords.forEach(keyword => {
            if (response.includes(keyword)) {
                factors.push(keyword);
            }
        });
        
        return factors;
    }

    /**
     * 보험 영향 추출
     */
    extractInsuranceImpact(response) {
        if (response.includes('높은 리스크') || response.includes('거절')) return 'high_risk';
        if (response.includes('중간 리스크') || response.includes('할증')) return 'medium_risk';
        if (response.includes('낮은 리스크') || response.includes('표준')) return 'low_risk';
        return 'medium_risk';
    }

    /**
     * 권고사항 추출
     */
    extractRecommendations(response) {
        const recommendations = [];
        
        if (response.includes('추가 검사')) recommendations.push('additional_testing');
        if (response.includes('정기 검진')) recommendations.push('regular_monitoring');
        if (response.includes('치료 필요')) recommendations.push('treatment_required');
        if (response.includes('보장 제외')) recommendations.push('coverage_exclusion');
        
        return recommendations;
    }

    /**
     * 대체 진행 예측
     */
    fallbackProgressionPrediction(diseaseEvents) {
        const severeCases = diseaseEvents.filter(e => e.severity === 'severe').length;
        const chronicCases = diseaseEvents.filter(e => e.diseaseType === 'chronic').length;
        
        let direction = 'stable';
        let riskLevel = 'medium_risk';
        
        if (severeCases > 0) {
            direction = 'deterioration';
            riskLevel = 'high_risk';
        } else if (chronicCases > 0) {
            direction = 'stable';
            riskLevel = 'medium_risk';
        } else {
            direction = 'improvement';
            riskLevel = 'low_risk';
        }
        
        return {
            direction,
            timeframe: 'medium_term',
            riskFactors: ['기본 분석 기반'],
            insuranceImpact: riskLevel,
            recommendations: ['정기 모니터링'],
            confidence: 0.5,
            rawResponse: '기본 분석 결과'
        };
    }

    /**
     * 진행 요약 생성
     */
    generateProgressionSummary(diseaseEvents, riskAssessment) {
        const totalEvents = diseaseEvents.length;
        const diseaseTypes = [...new Set(diseaseEvents.map(e => e.diseaseType))];
        const severityDistribution = {
            mild: diseaseEvents.filter(e => e.severity === 'mild').length,
            moderate: diseaseEvents.filter(e => e.severity === 'moderate').length,
            severe: diseaseEvents.filter(e => e.severity === 'severe').length
        };
        
        return {
            totalEvents,
            diseaseTypes,
            severityDistribution,
            overallRiskLevel: riskAssessment.riskLevel,
            averageRiskScore: riskAssessment.averageRisk,
            keyFindings: this.generateKeyFindings(diseaseEvents, riskAssessment),
            insuranceRecommendation: riskAssessment.recommendation
        };
    }

    /**
     * 주요 발견사항 생성
     */
    generateKeyFindings(diseaseEvents, riskAssessment) {
        const findings = [];
        
        // 고위험 질병 확인
        const highRiskDiseases = diseaseEvents.filter(e => 
            ['cancer', 'cardiovascular', 'neurological'].includes(e.diseaseType)
        );
        
        if (highRiskDiseases.length > 0) {
            findings.push(`고위험 질병군 ${highRiskDiseases.length}건 확인`);
        }
        
        // 중증 질환 확인
        const severeCases = diseaseEvents.filter(e => e.severity === 'severe');
        if (severeCases.length > 0) {
            findings.push(`중증 질환 ${severeCases.length}건 확인`);
        }
        
        // 리스크 레벨 요약
        findings.push(`전체 리스크 레벨: ${riskAssessment.riskLevel}`);
        
        return findings;
    }
}

module.exports = { DiseaseProgressionTracker };