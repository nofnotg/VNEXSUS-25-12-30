/**
 * DisputeScoringUtil.js
 * 
 * Master Plan Phase 1: Dispute Layer
 * 
 * 목적:
 * - 타임라인 이벤트/episode의 쟁점 관련 점수 계산
 * - phase (가입 전/대기기간/보장기간) 계산
 * - importanceScore (사건 중요도) 계산
 * - DisputeTag 생성
 */

import { mapDiagnosisToBodySystem, calculateBodySystemSimilarity } from './DiseaseBodySystemMapper.js';
import { DisputeTag } from '../DataContracts.js';

/**
 * 이벤트 날짜를 기준으로 계약 phase 계산
 * 
 * @param {string} eventDate - 이벤트 날짜 (ISO 문자열)
 * @param {Object} contractInfo - 계약 정보 (ContractInfo 객체)
 * @returns {string} - phase ('PRE_CONTRACT' | 'WAITING_PERIOD' | 'COVERED_PERIOD')
 */
export function calculatePhase(eventDate, contractInfo) {
    if (!eventDate || !contractInfo?.issueDate) {
        return 'COVERED_PERIOD'; // 기본값
    }

    try {
        const eventD = new Date(eventDate);
        const issueD = new Date(contractInfo.issueDate);

        // 대기기간 종료일 계산
        const waitingEndD = new Date(issueD);
        waitingEndD.setDate(waitingEndD.getDate() + (contractInfo.waitingPeriodDays || 0));

        // Phase 판단
        if (eventD < issueD) {
            return 'PRE_CONTRACT';
        } else if (eventD >= issueD && eventD <= waitingEndD) {
            return 'WAITING_PERIOD';
        } else {
            return 'COVERED_PERIOD';
        }
    } catch (error) {
        console.error('Phase 계산 오류:', error);
        return 'COVERED_PERIOD';
    }
}

/**
 * 이벤트와 청구 질환 간 진단 매칭 점수 계산
 * 
 * @param {Array} eventBodySystems - 이벤트의 장기군 배열
 * @param {Object} claimSpec - 청구 정보 (ClaimSpec 객체)
 * @returns {number} - 매칭 점수 (0.0 ~ 1.0)
 */
export function calcDiagnosisMatch(eventBodySystems, claimSpec) {
    if (!claimSpec?.claimBodySystems || claimSpec.claimBodySystems.length === 0) {
        return 0.0;
    }

    if (!eventBodySystems || eventBodySystems.length === 0) {
        return 0.0;
    }

    // Jaccard 유사도 계산
    return calculateBodySystemSimilarity(eventBodySystems, claimSpec.claimBodySystems);
}

/**
 * 이벤트의 중증도 점수 계산
 * 
 * @param {Object} event - 타임라인 이벤트
 * @returns {number} - 중증도 점수 (0.0 ~ 1.0)
 */
export function calcSeverityScore(event) {
    const entities = event.entities || [];
    let score = 0.0;

    // 수술 여부 (가중치: 0.5)
    const hasSurgery = entities.some(e =>
        e.type === 'procedure' &&
        (e.procedureType === 'surgery' || /수술|절제|적출/i.test(e.text || ''))
    );
    if (hasSurgery) score += 0.5;

    // 입원 여부 (가중치: 0.3)
    const hasAdmission = entities.some(e =>
        e.type === 'event' &&
        (e.subtype === 'admission' || e.eventType === 'admission')
    );
    if (hasAdmission) score += 0.3;

    // 항암/중증 치료 여부 (가중치: 0.2)
    const hasChemo = entities.some(e =>
        (e.type === 'medication' || e.type === 'procedure') &&
        /항암|화학요법|방사선|chemo|radiation/i.test(e.text || '')
    );
    if (hasChemo) score += 0.2;

    return Math.min(score, 1.0);
}

/**
 * 이벤트의 체인 위치 점수 계산
 * (index event와의 시간적 근접도)
 * 
 * @param {Object} event - 타임라인 이벤트
 * @param {Object} timelineContext - 타임라인 컨텍스트 { indexEventDate, ... }
 * @returns {number} - 체인 위치 점수 (0.0 ~ 1.0)
 */
export function calcChainPositionScore(event, timelineContext) {
    if (!timelineContext?.indexEventDate) {
        return 0.0;
    }

    try {
        const eventDate = event.date || event.anchor?.date;
        if (!eventDate) return 0.0;

        const eventD = new Date(eventDate);
        const indexD = new Date(timelineContext.indexEventDate);

        const diffMs = Math.abs(eventD.getTime() - indexD.getTime());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // 시간적 근접도에 따른 점수
        if (diffDays <= 7) return 1.0;       // 1주 이내
        if (diffDays <= 30) return 0.7;      // 1개월 이내
        if (diffDays <= 180) return 0.4;     // 6개월 이내
        if (diffDays <= 365) return 0.2;     // 1년 이내
        return 0.1;                           // 1년 초과
    } catch (error) {
        console.error('체인 위치 점수 계산 오류:', error);
        return 0.0;
    }
}

/**
 * 이벤트의 최종 중요도 점수 계산
 * 
 * @param {Object} event - 타임라인 이벤트
 * @param {Object} claimSpec - 청구 정보 (ClaimSpec 객체)
 * @param {Object} contractInfo - 계약 정보 (ContractInfo 객체)
 * @param {Object} timelineContext - 타임라인 컨텍스트
 * @returns {Object} - { phase, importanceScore, reasons }
 */
export function scoreEvent(event, claimSpec, contractInfo, timelineContext) {
    // 1. Phase 계산
    const eventDate = event.date || event.anchor?.date;
    const phase = calculatePhase(eventDate, contractInfo);

    // 2. 이벤트의 장기군 추출
    const eventEntities = event.entities || [];
    const eventDiagnoses = eventEntities.filter(e => e.type === 'diagnosis' || e.entityType === 'diagnosis');
    const eventBodySystems = eventDiagnoses.map(d =>
        mapDiagnosisToBodySystem(d.normalizedText || d.text || '', d.codes || {})
    );

    // 3. 각 점수 계산
    const matchScore = calcDiagnosisMatch(eventBodySystems, claimSpec);
    const severityScore = calcSeverityScore(event);
    const chainScore = calcChainPositionScore(event, timelineContext);

    // 4. Phase별 가중치
    const phaseWeight = {
        'PRE_CONTRACT': 0.7,      // 가입 전 사건은 중요도 높음
        'WAITING_PERIOD': 1.0,    // 대기기간 사건은 매우 중요
        'COVERED_PERIOD': 0.5     // 보장기간 사건은 상대적으로 낮음
    }[phase] || 0.5;

    // 5. 최종 중요도 점수 계산 (가중 평균)
    const importanceScore = Math.min(
        0.35 * phaseWeight +
        0.35 * matchScore +
        0.20 * severityScore +
        0.10 * chainScore,
        1.0
    );

    // 6. 판단 근거 생성
    const reasons = [];
    if (phase === 'PRE_CONTRACT') {
        reasons.push('가입 전 치료력');
    }
    if (phase === 'WAITING_PERIOD') {
        reasons.push('대기기간 내 사건');
    }
    if (matchScore >= 0.7) {
        reasons.push('청구 질환과 높은 관련성');
    }
    if (severityScore >= 0.5) {
        reasons.push('중증 사건(수술/입원/항암 등)');
    }
    if (chainScore >= 0.7) {
        reasons.push('청구 사건과 시간적 근접');
    }

    return {
        phase,
        importanceScore,
        reasons
    };
}

/**
 * 이벤트에 DisputeTag 생성
 * 
 * @param {Object} event - 타임라인 이벤트
 * @param {Object} claimSpec - 청구 정보
 * @param {Object} contractInfo - 계약 정보
 * @param {Object} timelineContext - 타임라인 컨텍스트
 * @returns {DisputeTag} - DisputeTag 객체
 */
export function createDisputeTag(event, claimSpec, contractInfo, timelineContext) {
    const { phase, importanceScore, reasons } = scoreEvent(event, claimSpec, contractInfo, timelineContext);

    // 고지의무 판단 (임시 규칙)
    let dutyToDisclose = 'NONE';
    if (phase === 'PRE_CONTRACT' && importanceScore >= 0.5) {
        dutyToDisclose = 'POTENTIAL';
    }
    if (phase === 'PRE_CONTRACT' && importanceScore >= 0.8) {
        dutyToDisclose = 'VIOLATION_CANDIDATE';
    }

    // Role 판단 (임시 규칙)
    let role = 'BACKGROUND';
    if (importanceScore >= 0.8) {
        role = 'CLAIM_CORE';
    } else if (importanceScore >= 0.6) {
        role = 'ETIOLOGY';
    } else if (importanceScore >= 0.4) {
        role = 'RISK_FACTOR';
    }

    return new DisputeTag({
        phase,
        role,
        dutyToDisclose,
        importanceScore,
        reasons
    });
}

/**
 * Index event (청구 사건) 찾기
 * 
 * @param {Array} events - 타임라인 이벤트 배열
 * @param {Object} claimSpec - 청구 정보
 * @returns {Object|null} - Index event 또는 null
 */
export function findIndexEvent(events, claimSpec) {
    if (!claimSpec?.claimDate || !events || events.length === 0) {
        return null;
    }

    try {
        const claimDate = new Date(claimSpec.claimDate);

        // 청구일과 가장 가까운 이벤트 찾기
        let closestEvent = null;
        let minDiff = Infinity;

        for (const event of events) {
            const eventDate = event.date || event.anchor?.date;
            if (!eventDate) continue;

            const eventD = new Date(eventDate);
            const diff = Math.abs(eventD.getTime() - claimDate.getTime());

            if (diff < minDiff) {
                minDiff = diff;
                closestEvent = event;
            }
        }

        return closestEvent;
    } catch (error) {
        console.error('Index event 찾기 오류:', error);
        return null;
    }
}

export default {
    calculatePhase,
    calcDiagnosisMatch,
    calcSeverityScore,
    calcChainPositionScore,
    scoreEvent,
    createDisputeTag,
    findIndexEvent
};
