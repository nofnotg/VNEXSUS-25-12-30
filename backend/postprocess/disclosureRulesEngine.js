/**
 * Disclosure Rules Engine (Phase 2 - T05)
 * 
 * 목적:
 * - Rule 기반으로 이벤트와 UW 질문 매칭
 * - 고지의무 위반 판단을 위한 증거 이벤트 제시
 * - 학습/파인튜닝 없이 사전/룰 기반으로 동작
 * 
 * 설계 원칙:
 * - 심사 질문(Question) 우선
 * - 정밀도 가드레일 (추정 금지)
 * - 설명가능성 (ruleId + sourceSpan)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DisclosureRulesEngine {
    constructor() {
        this.questions = [];
        this.rules = [];
        this.loadQuestions();
    }

    /**
     * UW Questions 로드
     */
    loadQuestions() {
        try {
            const questionsPath = path.join(__dirname, 'uwQuestions.json');
            const data = fs.readFileSync(questionsPath, 'utf-8');
            const parsed = JSON.parse(data);
            this.questions = parsed.questions || [];
            console.log(`✅ ${this.questions.length}개 UW 질문 로드 완료`);
        } catch (error) {
            console.error('❌ UW Questions 로드 실패:', error.message);
            this.questions = [];
        }
    }

    /**
     * 이벤트 배열에 대해 질문 매칭 수행
     * @param {Array} events - MedicalEvent 배열
     * @param {Object} patientInfo - 환자 정보 (가입일 등)
     * @returns {Object} Question Map
     */
    processEvents(events, patientInfo = {}) {
        console.log('🔍 Disclosure Rules Engine 시작');
        console.log(`   - 이벤트: ${events.length}개`);
        console.log(`   - 질문: ${this.questions.length}개`);

        const questionMap = {};

        // 각 질문에 대해 매칭되는 이벤트 찾기
        this.questions.forEach(question => {
            const matchedEvents = this.matchEventsToQuestion(events, question, patientInfo);

            if (matchedEvents.length > 0) {
                questionMap[question.id] = {
                    question: {
                        id: question.id,
                        title: question.title,
                        description: question.description,
                        priority: question.priority
                    },
                    matchedEvents: matchedEvents,
                    summary: this.generateQuestionSummary(matchedEvents, question),
                    totalScore: this.calculateTotalScore(matchedEvents)
                };
            }
        });

        console.log(`✅ ${Object.keys(questionMap).length}개 질문에 이벤트 매칭됨`);
        return questionMap;
    }

    /**
     * 특정 질문에 매칭되는 이벤트 찾기
     * @param {Array} events - 이벤트 배열
     * @param {Object} question - UW 질문
     * @param {Object} patientInfo - 환자 정보
     * @returns {Array} 매칭된 이벤트 배열
     */
    matchEventsToQuestion(events, question, patientInfo) {
        const matched = [];

        events.forEach(event => {
            // 기간 필터링
            if (!this.isWithinPeriod(event, question, patientInfo)) {
                return;
            }

            // Rule 매칭
            const ruleHits = this.evaluateRules(event, question);

            if (ruleHits.length > 0) {
                // 스코어 계산
                const score = this.calculateEventScore(event, question, ruleHits);

                matched.push({
                    eventId: event.id,
                    date: event.date,
                    hospital: event.hospital,
                    diagnosis: event.diagnosis,
                    eventType: event.eventType,
                    shortFact: event.shortFact,
                    sourceSpan: event.sourceSpan,
                    ruleHits: ruleHits,
                    score: score,
                    flags: event.flags
                });
            }
        });

        // 스코어 기준 정렬 (높은 순)
        return matched.sort((a, b) => b.score - a.score);
    }

    /**
     * 기간 필터링
     * @param {Object} event - 이벤트
     * @param {Object} question - 질문
     * @param {Object} patientInfo - 환자 정보
     * @returns {boolean} 기간 내 포함 여부
     */
    isWithinPeriod(event, question, patientInfo) {
        // ALL 기간은 모두 포함
        if (question.period === 'ALL') {
            return true;
        }

        // 가입일 없으면 포함
        if (!patientInfo.enrollmentDate) {
            return true;
        }

        const eventDate = new Date(event.date);
        const enrollmentDate = new Date(patientInfo.enrollmentDate);

        // 3M 체크
        if (question.period === '3M') {
            return event.flags && event.flags.preEnroll3M;
        }

        // 5Y 체크
        if (question.period === '5Y') {
            return event.flags && event.flags.preEnroll5Y;
        }

        return true;
    }

    /**
     * Rule 평가
     * @param {Object} event - 이벤트
     * @param {Object} question - 질문
     * @returns {Array} 적중된 rule 목록
     */
    evaluateRules(event, question) {
        const hits = [];
        const triggers = question.triggers;

        // 1. Event Type 매칭
        if (triggers.eventTypes && triggers.eventTypes.includes(event.eventType)) {
            hits.push({
                ruleType: 'eventType',
                matched: event.eventType,
                confidence: 0.8
            });
        }

        // 2. Keyword 매칭
        if (triggers.keywords && triggers.keywords.length > 0) {
            const matchedKeywords = this.matchKeywords(event, triggers.keywords);
            if (matchedKeywords.length > 0) {
                hits.push({
                    ruleType: 'keyword',
                    matched: matchedKeywords,
                    confidence: 0.7
                });
            }
        }

        // 3. Exclude Keyword 체크
        if (triggers.excludeKeywords && triggers.excludeKeywords.length > 0) {
            const excludeMatched = this.matchKeywords(event, triggers.excludeKeywords);
            if (excludeMatched.length > 0) {
                // Exclude 키워드가 있으면 모든 hits 제거
                return [];
            }
        }

        // 4. ICD Code Prefix 매칭
        if (triggers.diagnosisCodesPrefix && triggers.diagnosisCodesPrefix.length > 0) {
            if (event.diagnosis && event.diagnosis.code) {
                const matched = triggers.diagnosisCodesPrefix.some(prefix =>
                    event.diagnosis.code.startsWith(prefix)
                );
                if (matched) {
                    hits.push({
                        ruleType: 'icdCode',
                        matched: event.diagnosis.code,
                        confidence: 0.9
                    });
                }
            }
        }

        // 5. Procedure Keyword 매칭
        if (triggers.procedureKeywords && triggers.procedureKeywords.length > 0) {
            const procedures = [
                ...(event.procedures || []).map(p => p.name || p),
                ...(event.treatments || []).map(t => t.name || t)
            ];

            const matchedProcs = triggers.procedureKeywords.filter(keyword =>
                procedures.some(proc => proc.includes(keyword))
            );

            if (matchedProcs.length > 0) {
                hits.push({
                    ruleType: 'procedure',
                    matched: matchedProcs,
                    confidence: 0.85
                });
            }
        }

        return hits;
    }

    /**
     * 키워드 매칭
     * @param {Object} event - 이벤트
     * @param {Array} keywords - 키워드 배열
     * @returns {Array} 매칭된 키워드
     */
    matchKeywords(event, keywords) {
        const matched = [];
        const searchText = [
            event.shortFact || '',
            event.diagnosis?.name || '',
            event.rawText || ''
        ].join(' ').toLowerCase();

        keywords.forEach(keyword => {
            if (searchText.includes(keyword.toLowerCase())) {
                matched.push(keyword);
            }
        });

        return matched;
    }

    /**
     * 이벤트 스코어 계산
     * @param {Object} event - 이벤트
     * @param {Object} question - 질문
     * @param {Array} ruleHits - Rule 적중 목록
     * @returns {number} 스코어 (0.0-1.0)
     */
    calculateEventScore(event, question, ruleHits) {
        const scoring = question.scoring;
        let score = 0;

        // 1. Base Weight (질문 적중)
        score += scoring.baseWeight || 0.3;

        // 2. Period Boost (기간 가중치)
        if (event.flags) {
            if (event.flags.preEnroll3M && question.period === '3M') {
                score += scoring.periodBoost || 0.2;
            } else if (event.flags.preEnroll5Y && question.period === '5Y') {
                score += scoring.periodBoost || 0.15;
            }
        }

        // 3. Event Type Boost
        if (scoring.eventTypeBoost && scoring.eventTypeBoost[event.eventType]) {
            score += scoring.eventTypeBoost[event.eventType];
        }

        // 4. Code Boost (ICD 코드 있으면)
        if (event.diagnosis && event.diagnosis.code && scoring.codeBoost) {
            score += scoring.codeBoost;
        }

        // 5. Rule Confidence 평균
        if (ruleHits.length > 0) {
            const avgConfidence = ruleHits.reduce((sum, hit) => sum + hit.confidence, 0) / ruleHits.length;
            score *= avgConfidence;
        }

        return Math.min(1.0, score); // 최대 1.0
    }

    /**
     * 총 스코어 계산
     * @param {Array} matchedEvents - 매칭된 이벤트 배열
     * @returns {number} 총 스코어
     */
    calculateTotalScore(matchedEvents) {
        if (matchedEvents.length === 0) return 0;

        // 상위 3개 이벤트의 평균 스코어
        const topEvents = matchedEvents.slice(0, 3);
        const avgScore = topEvents.reduce((sum, e) => sum + e.score, 0) / topEvents.length;

        return avgScore;
    }

    /**
     * 질문 요약 생성
     * @param {Array} matchedEvents - 매칭된 이벤트
     * @param {Object} question - 질문
     * @returns {string} 요약
     */
    generateQuestionSummary(matchedEvents, question) {
        if (matchedEvents.length === 0) {
            return '해당 없음';
        }

        const count = matchedEvents.length;
        const topEvent = matchedEvents[0];

        return `${count}건 발견 (최근: ${topEvent.date} ${topEvent.hospital})`;
    }

    /**
     * Question Map을 출력 형식으로 변환
     * @param {Object} questionMap - Question Map
     * @returns {Object} 출력용 데이터
     */
    formatOutput(questionMap) {
        const output = {
            summary: {
                totalQuestions: Object.keys(questionMap).length,
                highPriority: 0,
                mediumPriority: 0,
                lowPriority: 0
            },
            questions: []
        };

        Object.values(questionMap).forEach(qData => {
            // 우선순위 카운트
            if (qData.question.priority === 1) output.summary.highPriority++;
            else if (qData.question.priority === 2) output.summary.mediumPriority++;
            else output.summary.lowPriority++;

            output.questions.push({
                id: qData.question.id,
                title: qData.question.title,
                priority: qData.question.priority,
                eventCount: qData.matchedEvents.length,
                totalScore: qData.totalScore,
                summary: qData.summary,
                events: qData.matchedEvents.map(e => ({
                    date: e.date,
                    hospital: e.hospital,
                    diagnosis: e.diagnosis.name,
                    diagnosisCode: e.diagnosis.code,
                    eventType: e.eventType,
                    shortFact: e.shortFact,
                    score: e.score,
                    sourceSpan: {
                        start: e.sourceSpan?.start,
                        end: e.sourceSpan?.end,
                        preview: e.sourceSpan?.textPreview?.substring(0, 100)
                    }
                }))
            });
        });

        // 우선순위 및 스코어 기준 정렬
        output.questions.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // 낮은 숫자가 높은 우선순위
            }
            return b.totalScore - a.totalScore;
        });

        return output;
    }

    /**
     * Question Map 저장
     * @param {Object} questionMap - Question Map
     * @param {string} outputPath - 출력 경로
     */
    saveQuestionMap(questionMap, outputPath) {
        const formatted = this.formatOutput(questionMap);
        fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2), 'utf-8');
        console.log(`💾 Question Map 저장: ${outputPath}`);
    }
}

// Singleton export
const disclosureRulesEngine = new DisclosureRulesEngine();
export default disclosureRulesEngine;

// Named export
export {
    DisclosureRulesEngine
};
