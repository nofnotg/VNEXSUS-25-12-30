/**
 * 의료 방문 분석 서비스
 * 통원 횟수, 연관성, 치료 연속성을 분석합니다.
 */

class MedicalVisitAnalysisService {
    constructor() {
        this.visitPatterns = {
            // 질환별 일반적인 통원 패턴
            diabetes: {
                keywords: ['당뇨', 'diabetes', 'DM', 'E11'],
                expectedFrequency: 'monthly', // 월 1회
                followUpRequired: true,
                relatedTests: ['혈당', 'HbA1c', '당화혈색소']
            },
            cardiovascular: {
                keywords: ['협심증', 'angina', '관상동맥', 'coronary', 'I20', 'I25'],
                expectedFrequency: 'biweekly', // 2주 1회
                followUpRequired: true,
                relatedTests: ['심전도', 'ECG', '심초음파', 'echo']
            },
            hypertension: {
                keywords: ['고혈압', 'hypertension', 'HTN', 'I10'],
                expectedFrequency: 'monthly',
                followUpRequired: true,
                relatedTests: ['혈압', 'BP']
            }
        };
    }

    /**
     * 의료 이벤트 연관성 분석
     * @param {Array} medicalEvents - 의료 이벤트 배열
     * @returns {Object} 분석 결과
     */
    analyzeVisitPatterns(medicalEvents) {
        if (!medicalEvents || medicalEvents.length === 0) {
            return {
                totalVisits: 0,
                visitGroups: [],
                continuityAnalysis: {},
                recommendations: []
            };
        }

        // 날짜순 정렬
        const sortedEvents = medicalEvents.sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        // 병원별, 진단명별 그룹화
        const visitGroups = this.groupVisitsByRelation(sortedEvents);
        
        // 연속성 분석
        const continuityAnalysis = this.analyzeContinuity(visitGroups);
        
        // 통원 횟수 재계산
        const correctedVisitCounts = this.recalculateVisitCounts(visitGroups);
        
        return {
            totalVisits: sortedEvents.length,
            visitGroups,
            continuityAnalysis,
            correctedVisitCounts,
            recommendations: this.generateRecommendations(visitGroups, continuityAnalysis)
        };
    }

    /**
     * 방문을 관련성에 따라 그룹화
     * @param {Array} events - 의료 이벤트 배열
     * @returns {Array} 그룹화된 방문
     */
    groupVisitsByRelation(events) {
        const groups = [];
        
        // 병원 + 진단명 조합으로 그룹화
        const groupMap = new Map();
        
        events.forEach(event => {
            const hospital = event.hospital || event.의료기관 || '';
            const diagnosis = event.diagnosis || event.진단명 || '';
            const icdCode = this.extractICDCode(diagnosis);
            
            // 그룹 키 생성 (병원 + ICD 코드 기준)
            const groupKey = `${hospital}_${icdCode}`;
            
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    hospital,
                    diagnosis,
                    icdCode,
                    visits: [],
                    dateRange: { start: null, end: null },
                    totalVisits: 0
                });
            }
            
            const group = groupMap.get(groupKey);
            group.visits.push(event);
            group.totalVisits++;
            
            // 날짜 범위 업데이트
            const eventDate = new Date(event.date || event.내원일);
            if (!group.dateRange.start || eventDate < group.dateRange.start) {
                group.dateRange.start = eventDate;
            }
            if (!group.dateRange.end || eventDate > group.dateRange.end) {
                group.dateRange.end = eventDate;
            }
        });
        
        return Array.from(groupMap.values());
    }

    /**
     * ICD 코드 추출
     * @param {string} diagnosis - 진단명
     * @returns {string} ICD 코드
     */
    extractICDCode(diagnosis) {
        if (!diagnosis) return '';
        
        const icdMatch = diagnosis.match(/([A-Z]\d{2,3}(?:\.\d{1,2})?)/);
        return icdMatch ? icdMatch[1] : '';
    }

    /**
     * 치료 연속성 분석
     * @param {Array} visitGroups - 방문 그룹
     * @returns {Object} 연속성 분석 결과
     */
    analyzeContinuity(visitGroups) {
        const analysis = {
            continuousGroups: [],
            isolatedVisits: [],
            followUpRequired: [],
            treatmentPatterns: {}
        };

        visitGroups.forEach(group => {
            const { visits, icdCode, hospital } = group;
            
            if (visits.length === 1) {
                analysis.isolatedVisits.push(group);
            } else {
                // 연속 치료 그룹
                const continuityInfo = this.assessContinuity(visits, icdCode);
                analysis.continuousGroups.push({
                    ...group,
                    continuityInfo
                });
                
                // 후속 치료 필요성 평가
                if (this.requiresFollowUp(icdCode, visits)) {
                    analysis.followUpRequired.push(group);
                }
            }
            
            // 치료 패턴 분석
            const pattern = this.identifyTreatmentPattern(visits, icdCode);
            if (pattern) {
                analysis.treatmentPatterns[`${hospital}_${icdCode}`] = pattern;
            }
        });

        return analysis;
    }

    /**
     * 연속성 평가
     * @param {Array} visits - 방문 배열
     * @param {string} icdCode - ICD 코드
     * @returns {Object} 연속성 정보
     */
    assessContinuity(visits, icdCode) {
        const sortedVisits = visits.sort((a, b) => 
            new Date(a.date || a.내원일) - new Date(b.date || b.내원일)
        );

        const intervals = [];
        for (let i = 1; i < sortedVisits.length; i++) {
            const prevDate = new Date(sortedVisits[i-1].date || sortedVisits[i-1].내원일);
            const currDate = new Date(sortedVisits[i].date || sortedVisits[i].내원일);
            const daysDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
            intervals.push(daysDiff);
        }

        const avgInterval = intervals.length > 0 ? 
            intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0;

        return {
            visitCount: visits.length,
            averageInterval: Math.round(avgInterval),
            intervals,
            isRegular: this.isRegularPattern(intervals),
            treatmentType: this.classifyTreatmentType(visits, avgInterval)
        };
    }

    /**
     * 규칙적인 패턴인지 확인
     * @param {Array} intervals - 간격 배열
     * @returns {boolean} 규칙성 여부
     */
    isRegularPattern(intervals) {
        if (intervals.length < 2) return false;
        
        const variance = this.calculateVariance(intervals);
        const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
        
        // 변동계수가 0.3 이하면 규칙적으로 판단
        return (Math.sqrt(variance) / mean) <= 0.3;
    }

    /**
     * 분산 계산
     * @param {Array} values - 값 배열
     * @returns {number} 분산
     */
    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * 치료 유형 분류
     * @param {Array} visits - 방문 배열
     * @param {number} avgInterval - 평균 간격
     * @returns {string} 치료 유형
     */
    classifyTreatmentType(visits, avgInterval) {
        if (visits.length === 1) return 'single_visit';
        if (avgInterval <= 7) return 'intensive_care';
        if (avgInterval <= 30) return 'regular_followup';
        if (avgInterval <= 90) return 'periodic_monitoring';
        return 'long_term_management';
    }

    /**
     * 후속 치료 필요성 확인
     * @param {string} icdCode - ICD 코드
     * @param {Array} visits - 방문 배열
     * @returns {boolean} 후속 치료 필요 여부
     */
    requiresFollowUp(icdCode, visits) {
        // 만성 질환은 지속적인 관리 필요
        const chronicConditions = ['E11', 'I10', 'I20', 'I25'];
        const isChronicCondition = chronicConditions.some(code => 
            icdCode.startsWith(code)
        );
        
        if (isChronicCondition) {
            const lastVisit = visits[visits.length - 1];
            const lastVisitDate = new Date(lastVisit.date || lastVisit.내원일);
            const daysSinceLastVisit = Math.floor(
                (new Date() - lastVisitDate) / (1000 * 60 * 60 * 24)
            );
            
            // 30일 이상 방문하지 않은 만성 질환
            return daysSinceLastVisit > 30;
        }
        
        return false;
    }

    /**
     * 치료 패턴 식별
     * @param {Array} visits - 방문 배열
     * @param {string} icdCode - ICD 코드
     * @returns {Object} 치료 패턴
     */
    identifyTreatmentPattern(visits, icdCode) {
        const pattern = {
            patternType: 'unknown',
            frequency: 'irregular',
            duration: 0,
            intensity: 'low'
        };

        if (visits.length < 2) {
            pattern.patternType = 'single_episode';
            return pattern;
        }

        const firstVisit = new Date(visits[0].date || visits[0].내원일);
        const lastVisit = new Date(visits[visits.length - 1].date || visits[visits.length - 1].내원일);
        pattern.duration = Math.floor((lastVisit - firstVisit) / (1000 * 60 * 60 * 24));

        // 빈도 분석
        const avgInterval = pattern.duration / (visits.length - 1);
        if (avgInterval <= 7) pattern.frequency = 'weekly';
        else if (avgInterval <= 14) pattern.frequency = 'biweekly';
        else if (avgInterval <= 30) pattern.frequency = 'monthly';
        else pattern.frequency = 'irregular';

        // 강도 분석
        if (visits.length >= 5) pattern.intensity = 'high';
        else if (visits.length >= 3) pattern.intensity = 'medium';
        else pattern.intensity = 'low';

        // 패턴 유형 결정
        if (pattern.frequency !== 'irregular' && visits.length >= 3) {
            pattern.patternType = 'regular_management';
        } else if (pattern.duration <= 30 && visits.length >= 2) {
            pattern.patternType = 'acute_treatment';
        } else {
            pattern.patternType = 'sporadic_visits';
        }

        return pattern;
    }

    /**
     * 통원 횟수 재계산
     * @param {Array} visitGroups - 방문 그룹
     * @returns {Array} 수정된 통원 정보
     */
    recalculateVisitCounts(visitGroups) {
        return visitGroups.map(group => {
            const { visits, hospital, diagnosis, icdCode } = group;
            
            return {
                hospital,
                diagnosis,
                icdCode,
                actualVisitCount: visits.length,
                dateRange: {
                    start: group.dateRange.start.toISOString().split('T')[0],
                    end: group.dateRange.end.toISOString().split('T')[0]
                },
                visitDates: visits.map(v => v.date || v.내원일),
                correctedDescription: `${group.dateRange.start.toISOString().split('T')[0]} ~ ${group.dateRange.end.toISOString().split('T')[0]} / ${visits.length}회 통원`
            };
        });
    }

    /**
     * 권장사항 생성
     * @param {Array} visitGroups - 방문 그룹
     * @param {Object} continuityAnalysis - 연속성 분석
     * @returns {Array} 권장사항
     */
    generateRecommendations(visitGroups, continuityAnalysis) {
        const recommendations = [];

        // 고립된 방문에 대한 권장사항
        continuityAnalysis.isolatedVisits.forEach(group => {
            if (this.requiresFollowUp(group.icdCode, group.visits)) {
                recommendations.push({
                    type: 'follow_up_needed',
                    message: `${group.diagnosis}에 대한 후속 치료가 필요할 수 있습니다.`,
                    priority: 'high',
                    group
                });
            }
        });

        // 불규칙한 치료 패턴에 대한 권장사항
        continuityAnalysis.continuousGroups.forEach(group => {
            if (!group.continuityInfo.isRegular && group.visits.length >= 3) {
                recommendations.push({
                    type: 'irregular_pattern',
                    message: `${group.diagnosis} 치료가 불규칙적입니다. 정기적인 관리를 권장합니다.`,
                    priority: 'medium',
                    group
                });
            }
        });

        return recommendations;
    }
}

export default MedicalVisitAnalysisService;