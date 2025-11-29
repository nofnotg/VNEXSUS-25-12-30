/**
 * 다른 날짜 데이터블록 간 연관성 분석 모듈
 * 특히 통원 기록 연계 및 크로스 날짜 연관성 분석
 */

import { z } from 'zod';
import { logger } from '../shared/logging/logger.js';

class CrossDateCorrelationAnalyzer {
    constructor() {
        // 연관성 분석 가중치
        this.correlationWeights = {
            temporal: 0.3,      // 시간적 근접성
            diagnostic: 0.4,    // 진단명 유사성
            treatment: 0.3,     // 치료 연속성
            hospital: 0.2,      // 병원 연계성
            symptom: 0.25       // 증상 연관성
        };

        // 통원 관련 키워드
        this.outpatientKeywords = [
            '외래', '통원', '진료', '방문', '재진', '추적관찰',
            '경과관찰', '정기검진', '후속진료', '연속치료'
        ];

        // 진단 연관성 키워드 그룹
        this.diagnosticGroups = {
            cardiovascular: ['심장', '혈관', '고혈압', '부정맥', '심근경색'],
            respiratory: ['폐', '기관지', '천식', '폐렴', '호흡'],
            digestive: ['위', '장', '간', '담낭', '소화'],
            neurological: ['뇌', '신경', '두통', '뇌졸중', '치매'],
            orthopedic: ['뼈', '관절', '근육', '척추', '골절'],
            endocrine: ['당뇨', '갑상선', '호르몬', '내분비'],
            psychiatric: ['우울', '불안', '정신', '스트레스']
        };
    }

    /**
     * 날짜 블록들 간의 연관성 분석
     */
    analyzeCorrelations(dateBlocks) {
        const correlations = [];
        
        for (let i = 0; i < dateBlocks.length; i++) {
            for (let j = i + 1; j < dateBlocks.length; j++) {
                const correlation = this._analyzeBlockPairCorrelation(
                    dateBlocks[i], 
                    dateBlocks[j]
                );
                
                if (correlation.score > 0.3) {
                    correlations.push(correlation);
                }
            }
        }

        return this._sortAndGroupCorrelations(correlations);
    }

    /**
     * 두 날짜 블록 간의 연관성 분석
     */
    _analyzeBlockPairCorrelation(block1, block2) {
        const correlation = {
            block1Id: block1.id,
            block2Id: block2.id,
            block1Date: block1.date,
            block2Date: block2.date,
            score: 0,
            type: [],
            details: {},
            confidence: 0
        };

        // 1. 시간적 근접성 분석
        const temporalScore = this._calculateTemporalProximity(block1.date, block2.date);
        correlation.details.temporal = temporalScore;

        // 2. 진단명 연관성 분석
        const diagnosticScore = this._analyzeDiagnosticCorrelation(
            block1.content, 
            block2.content
        );
        correlation.details.diagnostic = diagnosticScore;

        // 3. 치료 연속성 분석
        const treatmentScore = this._analyzeTreatmentContinuity(
            block1.content, 
            block2.content
        );
        correlation.details.treatment = treatmentScore;

        // 4. 병원 연계성 분석
        const hospitalScore = this._analyzeHospitalConnection(
            block1.content, 
            block2.content
        );
        correlation.details.hospital = hospitalScore;

        // 5. 통원 기록 특별 분석
        const outpatientAnalysis = this._analyzeOutpatientConnection(
            block1.content, 
            block2.content
        );
        correlation.details.outpatient = outpatientAnalysis;

        // 종합 점수 계산
        correlation.score = this._calculateOverallScore(correlation.details);
        correlation.confidence = this._calculateConfidence(correlation.details);
        correlation.type = this._determineCorrelationType(correlation.details);

        return correlation;
    }

    /**
     * 시간적 근접성 계산
     */
    _calculateTemporalProximity(date1, date2) {
        try {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            const daysDiff = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));

            // 시간 간격에 따른 점수 (가까울수록 높은 점수)
            if (daysDiff <= 1) return 1.0;
            if (daysDiff <= 7) return 0.8;
            if (daysDiff <= 30) return 0.6;
            if (daysDiff <= 90) return 0.4;
            if (daysDiff <= 365) return 0.2;
            return 0.1;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 진단명 연관성 분석
     */
    _analyzeDiagnosticCorrelation(content1, content2) {
        let maxScore = 0;
        let matchedGroup = null;

        for (const [groupName, keywords] of Object.entries(this.diagnosticGroups)) {
            const score1 = this._calculateKeywordPresence(content1, keywords);
            const score2 = this._calculateKeywordPresence(content2, keywords);
            
            if (score1 > 0 && score2 > 0) {
                const groupScore = Math.min(score1, score2);
                if (groupScore > maxScore) {
                    maxScore = groupScore;
                    matchedGroup = groupName;
                }
            }
        }

        return {
            score: maxScore,
            group: matchedGroup,
            details: this._extractDiagnosticDetails(content1, content2)
        };
    }

    /**
     * 치료 연속성 분석
     */
    _analyzeTreatmentContinuity(content1, content2) {
        const treatmentKeywords = [
            '처방', '투약', '치료', '수술', '시술', '재활',
            '물리치료', '약물치료', '수술후', '경과관찰'
        ];

        const score1 = this._calculateKeywordPresence(content1, treatmentKeywords);
        const score2 = this._calculateKeywordPresence(content2, treatmentKeywords);

        return {
            score: (score1 + score2) / 2,
            continuity: this._detectTreatmentContinuity(content1, content2)
        };
    }

    /**
     * 병원 연계성 분석
     */
    _analyzeHospitalConnection(content1, content2) {
        const hospitalPatterns = [
            /(\w+병원|\w+의원|\w+클리닉)/g,
            /(\w+과|\w+센터)/g
        ];

        const hospitals1 = this._extractHospitalNames(content1, hospitalPatterns);
        const hospitals2 = this._extractHospitalNames(content2, hospitalPatterns);

        const commonHospitals = hospitals1.filter(h => hospitals2.includes(h));
        
        return {
            score: commonHospitals.length > 0 ? 0.8 : 0,
            commonHospitals: commonHospitals,
            allHospitals: [...new Set([...hospitals1, ...hospitals2])]
        };
    }

    /**
     * 통원 기록 연계 분석
     */
    _analyzeOutpatientConnection(content1, content2) {
        const outpatient1 = this._calculateKeywordPresence(content1, this.outpatientKeywords);
        const outpatient2 = this._calculateKeywordPresence(content2, this.outpatientKeywords);

        const analysis = {
            score: 0,
            isOutpatientSequence: false,
            sequenceType: null,
            details: {}
        };

        if (outpatient1 > 0 && outpatient2 > 0) {
            analysis.score = Math.min(outpatient1, outpatient2);
            analysis.isOutpatientSequence = true;
            analysis.sequenceType = this._determineOutpatientSequenceType(content1, content2);
            analysis.details = {
                firstVisit: this._extractVisitDetails(content1),
                secondVisit: this._extractVisitDetails(content2)
            };
        }

        return analysis;
    }

    /**
     * 키워드 존재 비율 계산
     */
    _calculateKeywordPresence(text, keywords) {
        const textLower = text.toLowerCase();
        let matchCount = 0;

        keywords.forEach(keyword => {
            if (textLower.includes(keyword.toLowerCase())) {
                matchCount++;
            }
        });

        return keywords.length > 0 ? matchCount / keywords.length : 0;
    }

    /**
     * 종합 점수 계산
     */
    _calculateOverallScore(details) {
        let score = 0;
        
        score += details.temporal * this.correlationWeights.temporal;
        score += details.diagnostic.score * this.correlationWeights.diagnostic;
        score += details.treatment.score * this.correlationWeights.treatment;
        score += details.hospital.score * this.correlationWeights.hospital;
        
        // 통원 기록 보너스
        if (details.outpatient.isOutpatientSequence) {
            score += details.outpatient.score * 0.3;
        }

        return Math.min(score, 1.0);
    }

    /**
     * 신뢰도 계산
     */
    _calculateConfidence(details) {
        const factors = [
            details.temporal > 0.5 ? 0.2 : 0,
            details.diagnostic.score > 0.3 ? 0.3 : 0,
            details.treatment.score > 0.3 ? 0.2 : 0,
            details.hospital.score > 0 ? 0.2 : 0,
            details.outpatient.isOutpatientSequence ? 0.1 : 0
        ];

        return factors.reduce((sum, factor) => sum + factor, 0);
    }

    /**
     * 연관성 타입 결정
     */
    _determineCorrelationType(details) {
        const types = [];
        
        if (details.temporal > 0.7) types.push('temporal');
        if (details.diagnostic.score > 0.5) types.push('diagnostic');
        if (details.treatment.score > 0.5) types.push('treatment');
        if (details.hospital.score > 0) types.push('hospital');
        if (details.outpatient.isOutpatientSequence) types.push('outpatient_sequence');

        return types;
    }

    /**
     * 연관성 결과 정렬 및 그룹화
     */
    _sortAndGroupCorrelations(correlations) {
        // 점수 순으로 정렬
        correlations.sort((a, b) => b.score - a.score);

        // 타입별 그룹화
        const grouped = {
            outpatient_sequences: correlations.filter(c => 
                c.type.includes('outpatient_sequence')
            ),
            diagnostic_related: correlations.filter(c => 
                c.type.includes('diagnostic')
            ),
            treatment_continuity: correlations.filter(c => 
                c.type.includes('treatment')
            ),
            hospital_related: correlations.filter(c => 
                c.type.includes('hospital')
            ),
            temporal_proximity: correlations.filter(c => 
                c.type.includes('temporal')
            )
        };

        return {
            all: correlations,
            grouped: grouped,
            summary: this._generateCorrelationSummary(correlations)
        };
    }

    /**
     * 연관성 분석 요약 생성
     */
    _generateCorrelationSummary(correlations) {
        return {
            totalCorrelations: correlations.length,
            highConfidence: correlations.filter(c => c.confidence > 0.7).length,
            outpatientSequences: correlations.filter(c => 
                c.type.includes('outpatient_sequence')
            ).length,
            averageScore: correlations.length > 0 ? 
                correlations.reduce((sum, c) => sum + c.score, 0) / correlations.length : 0
        };
    }

    // 헬퍼 메서드들
    _extractDiagnosticDetails(content1, content2) {
        // 진단명 세부 정보 추출 로직
        return {
            diagnoses1: this._extractDiagnoses(content1),
            diagnoses2: this._extractDiagnoses(content2)
        };
    }

    _detectTreatmentContinuity(content1, content2) {
        // 치료 연속성 감지 로직
        return {
            hasContinuity: false,
            type: null
        };
    }

    _extractHospitalNames(content, patterns) {
        const hospitals = [];
        patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                hospitals.push(...matches);
            }
        });
        return [...new Set(hospitals)];
    }

    _determineOutpatientSequenceType(content1, content2) {
        // 통원 순서 타입 결정 (초진, 재진, 추적관찰 등)
        if (content1.includes('초진') || content2.includes('재진')) {
            return 'initial_followup';
        }
        if (content1.includes('수술') && content2.includes('경과')) {
            return 'post_surgical';
        }
        return 'regular_followup';
    }

    _extractVisitDetails(content) {
        // 방문 세부 정보 추출
        return {
            type: this._extractVisitType(content),
            department: this._extractDepartment(content),
            purpose: this._extractVisitPurpose(content)
        };
    }

    _extractDiagnoses(content) {
        // 진단명 추출 로직
        return [];
    }

    _extractVisitType(content) {
        if (content.includes('초진')) return 'initial';
        if (content.includes('재진')) return 'followup';
        if (content.includes('응급')) return 'emergency';
        return 'regular';
    }

    _extractDepartment(content) {
        const deptPattern = /(\w+과)/g;
        const matches = content.match(deptPattern);
        return matches ? matches[0] : null;
    }

    _extractVisitPurpose(content) {
        if (content.includes('경과관찰')) return 'monitoring';
        if (content.includes('검사')) return 'examination';
        if (content.includes('처방')) return 'prescription';
        return 'general';
    }

    /**
     * 그룹화: 외래 방문 기록을 의료 맥락+시간 인접 기반으로 episode로 통합
     * records: Array<{ date: string, hospital?: string, reason?: string, diagnosis?: string, content?: string }>
     * options: { windowDays?: number, maxMergeGapDays?: number, minCorrelationScore?: number, userWeightConfig?: {...} }
     */
    groupOutpatientEpisodes(records, options = {}) {
        const OptionsSchema = z.object({
            windowDays: z.number().min(1).max(90).default(28),
            maxMergeGapDays: z.number().min(1).max(90).default(7),
            minCorrelationScore: z.number().min(0).max(1).default(0.5),
            userWeightConfig: z.object({
                primarySymptomWeight: z.number().min(0).max(0.5).default(0.1),
                secondarySymptomWeight: z.number().min(0).max(0.3).default(0.05),
                treatmentContinuityBoost: z.number().min(0).max(0.5).default(0.1),
                sameHospitalBoost: z.number().min(0).max(0.5).default(0.05),
                diagnosticGroupBoost: z.number().min(0).max(0.5).default(0.1)
            }).default({})
        });

        const RecordSchema = z.object({
            date: z.string(),
            hospital: z.string().optional(),
            reason: z.string().optional(),
            diagnosis: z.string().optional(),
            content: z.string().optional()
        });

        try {
            const parsedOptions = OptionsSchema.parse(options);
            const parsedRecords = z.array(RecordSchema).parse(records);

            const sorted = parsedRecords
                .filter(r => this._isParsableDate(r.date))
                .map((r, idx) => ({ ...r, _id: `rec_${idx}` }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const episodes = [];

            for (const rec of sorted) {
                const block = this._buildBlockFromRecord(rec);
                let attached = false;

                // Try attach to an existing episode (prefer the most recent one within window)
                for (let i = episodes.length - 1; i >= 0; i--) {
                    const ep = episodes[i];
                    const lastRec = ep.records[ep.records.length - 1];
                    const lastBlock = this._buildBlockFromRecord(lastRec);

                    const recGroup = this._classifyDiagnosticGroupFromText(`${rec.reason || ''} ${rec.diagnosis || ''} ${rec.content || ''}`);
                    const lastRecGroup = this._classifyDiagnosticGroupFromText(`${lastRec.reason || ''} ${lastRec.diagnosis || ''} ${lastRec.content || ''}`);

                    // Hard block: different diagnostic groups should not attach
                    if (recGroup && lastRecGroup && recGroup !== lastRecGroup) {
                        continue;
                    }

                    const details = this._analyzeBlockPairCorrelation(lastBlock, block);
                    let score = details.score;

                    // Apply user-weighted adjustments
                    const sameHospital = (lastRec.hospital && rec.hospital && lastRec.hospital === rec.hospital);
                    const primaryInfo = this._classifySymptomPriority(rec);
                    const diagBoost = details.details.diagnostic.group ? parsedOptions.userWeightConfig.diagnosticGroupBoost : 0;
                    const treatBoost = details.details.treatment.continuity?.hasContinuity ? parsedOptions.userWeightConfig.treatmentContinuityBoost : 0;
                    const hospBoost = sameHospital ? parsedOptions.userWeightConfig.sameHospitalBoost : 0;
                    const symptomBoost = primaryInfo.priority === 'primary' ? parsedOptions.userWeightConfig.primarySymptomWeight : parsedOptions.userWeightConfig.secondarySymptomWeight;
                    score = Math.min(1, score + diagBoost + treatBoost + hospBoost + symptomBoost);

                    const daysGap = this._daysBetween(lastRec.date, rec.date);
                    const withinWindow = daysGap <= parsedOptions.windowDays;

                    if (withinWindow && score >= parsedOptions.minCorrelationScore) {
                        // attach
                        ep.records.push(rec);
                        ep.endDate = rec.date;
                        ep.hospitals.add(rec.hospital || '');
                        ep.metrics.primaryCount += (primaryInfo.priority === 'primary' ? 1 : 0);
                        ep.metrics.secondaryCount += (primaryInfo.priority === 'secondary' ? 1 : 0);
                        ep.metrics.correlationSum += score;
                        ep.metrics.links.push({ from: lastRec._id || '', to: rec._id || '', score, daysGap });
                        ep.groupHints.add(details.details.diagnostic.group || '');
                        if (recGroup) ep.groupHints.add(recGroup);
                        attached = true;
                        break;
                    }
                }

                if (!attached) {
                    const primaryInfo = this._classifySymptomPriority(rec);
                    const recGroup = this._classifyDiagnosticGroupFromText(`${rec.reason || ''} ${rec.diagnosis || ''} ${rec.content || ''}`);
                    episodes.push({
                        id: `episode_${episodes.length + 1}`,
                        startDate: rec.date,
                        endDate: rec.date,
                        hospitals: new Set([rec.hospital || '']),
                        records: [rec],
                        metrics: {
                            primaryCount: primaryInfo.priority === 'primary' ? 1 : 0,
                            secondaryCount: primaryInfo.priority === 'secondary' ? 1 : 0,
                            correlationSum: 0,
                            links: []
                        },
                        groupHints: new Set(recGroup ? [recGroup] : [])
                    });
                }
            }

            // Merge adjacent episodes if close and strongly related
            const merged = [];
            for (const ep of episodes) {
                const last = merged[merged.length - 1];
                if (!last) {
                    merged.push(ep);
                    continue;
                }
                const gapDays = this._daysBetween(last.endDate, ep.startDate);
                const hospitalsOverlap = [...last.hospitals].some(h => h && ep.hospitals.has(h));
                const groupOverlap = [...last.groupHints].some(g => g && ep.groupHints.has(g));
                // Compute bridge correlation between boundary records
                const bridgeDetails = this._analyzeBlockPairCorrelation(
                    this._buildBlockFromRecord(last.records[last.records.length - 1]),
                    this._buildBlockFromRecord(ep.records[0])
                );
                let bridgeScore = bridgeDetails.score;
                const sameHospitalBridge = hospitalsOverlap;
                const diagBoostBridge = bridgeDetails.details.diagnostic.group ? parsedOptions.userWeightConfig.diagnosticGroupBoost : 0;
                const treatBoostBridge = bridgeDetails.details.treatment.continuity?.hasContinuity ? parsedOptions.userWeightConfig.treatmentContinuityBoost : 0;
                const hospBoostBridge = sameHospitalBridge ? parsedOptions.userWeightConfig.sameHospitalBoost : 0;
                bridgeScore = Math.min(1, bridgeScore + diagBoostBridge + treatBoostBridge + hospBoostBridge);

                const canMerge = gapDays <= parsedOptions.maxMergeGapDays && (
                    groupOverlap || bridgeScore >= parsedOptions.minCorrelationScore
                );
                if (canMerge) {
                    last.endDate = ep.endDate;
                    ep.records.forEach(r => last.records.push(r));
                    ep.hospitals.forEach(h => last.hospitals.add(h));
                    ep.groupHints.forEach(g => last.groupHints.add(g));
                    last.metrics.primaryCount += ep.metrics.primaryCount;
                    last.metrics.secondaryCount += ep.metrics.secondaryCount;
                    last.metrics.correlationSum += ep.metrics.correlationSum;
                    last.metrics.links.push(...ep.metrics.links);
                } else {
                    merged.push(ep);
                }
            }

            const finalized = merged.map(ep => ({
                id: ep.id,
                startDate: ep.startDate,
                endDate: ep.endDate,
                recordCount: ep.records.length,
                hospitals: [...ep.hospitals].filter(Boolean),
                diagnosticGroup: this._resolveDiagnosticGroup(ep.groupHints),
                primarySymptomCount: ep.metrics.primaryCount,
                secondarySymptomCount: ep.metrics.secondaryCount,
                averageCorrelation: ep.records.length > 1 ? ep.metrics.correlationSum / (ep.records.length - 1) : 0,
                links: ep.metrics.links
            }));

            const stats = {
                totalRecords: sorted.length,
                episodeCount: finalized.length,
                avgRecordsPerEpisode: finalized.length ? (sorted.length / finalized.length) : 0,
                mergedCount: episodes.length - finalized.length,
                primaryRatio: sorted.length ? (finalized.reduce((acc, e) => acc + e.primarySymptomCount, 0) / sorted.length) : 0
            };

            logger.info({
                event: 'groupOutpatientEpisodes',
                episodes: finalized.length,
                totalRecords: sorted.length,
                avgRecordsPerEpisode: stats.avgRecordsPerEpisode,
                diagnosticGroups: finalized.map(e => e.diagnosticGroup).filter(Boolean),
                userWeights: parsedOptions.userWeightConfig
            });

            return { episodes: finalized, stats };
        } catch (error) {
            logger.error({ event: 'groupOutpatientEpisodes_error', message: error.message });
            throw new Error('episode_grouping_failed');
        }
    }

    _buildBlockFromRecord(rec) {
        const contentParts = [rec.reason || '', rec.diagnosis || '', rec.content || '', rec.hospital || ''];
        const content = contentParts.filter(Boolean).join(' | ');
        return {
            id: rec._id || 'record',
            date: rec.date,
            content
        };
    }

    _isParsableDate(d) {
        const t = Date.parse(d);
        return Number.isFinite(t);
    }

    _daysBetween(d1, d2) {
        try {
            const a = new Date(d1).getTime();
            const b = new Date(d2).getTime();
            return Math.abs(Math.round((b - a) / (1000 * 60 * 60 * 24)));
        } catch {
            return Number.POSITIVE_INFINITY;
        }
    }

    _classifySymptomPriority(rec) {
        const text = `${rec.reason || ''} ${rec.diagnosis || ''} ${rec.content || ''}`.toLowerCase();
        const primaryPatterns = [/주호소|주증상|chief complaint|cc[: ]/i, /주된|primary/i];
        const secondaryPatterns = [/부수증상|associated|secondary/i];
        const isPrimary = primaryPatterns.some(p => p.test(text));
        const isSecondary = secondaryPatterns.some(p => p.test(text));
        return {
            priority: isPrimary ? 'primary' : (isSecondary ? 'secondary' : 'unknown'),
            confidence: isPrimary || isSecondary ? 0.8 : 0.3
        };
    }

    _resolveDiagnosticGroup(groupHints) {
        const candidates = [...groupHints].filter(Boolean);
        if (!candidates.length) return null;
        const freq = candidates.reduce((m, g) => { m[g] = (m[g] || 0) + 1; return m; }, {});
        return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }

    _classifyDiagnosticGroupFromText(text) {
        const lowered = text.toLowerCase();
        let best = null;
        let bestScore = 0;
        for (const [groupName, keywords] of Object.entries(this.diagnosticGroups)) {
            const score = this._calculateKeywordPresence(lowered, keywords);
            if (score > bestScore) {
                bestScore = score;
                best = score > 0 ? groupName : null;
            }
        }
        return best;
    }
}

export default CrossDateCorrelationAnalyzer;
