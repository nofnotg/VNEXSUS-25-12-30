/**
 * VNEXSUS Investigation Reporter (T-402)
 * 
 * Reasoning Engine의 분석 결과를 바탕으로 종합 조사 보고서를 생성합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class InvestigationReporter {
    constructor() {
        // 리스크 등급 기준
        this.riskThresholds = {
            HIGH: 3,   // 위반 사항 3건 이상 또는 명백한 고지의무 위반
            MEDIUM: 1  // 의심 정황 1건 이상
        };
    }

    /**
     * 조사 보고서 생성
     * @param {object} reasoningResult - ReasoningEngine.investigate() 결과
     * @param {object} metadata - 케이스 메타데이터 (이름, ID 등)
     */
    generateReport(reasoningResult, metadata = {}) {
        const { progressivity, disclosureViolation, doctorShopping } = reasoningResult;

        // 1. 리스크 평가
        const riskAssessment = this.assessRisk(reasoningResult);

        // 2. 요약 생성
        const summary = this.generateSummary(reasoningResult, riskAssessment);

        // 3. 구조화된 보고서 반환
        return {
            meta: {
                caseId: metadata.caseId || 'Unknown',
                generatedAt: new Date().toISOString(),
                investigator: 'VNEXSUS AI Investigator'
            },
            riskLevel: riskAssessment.level, // HIGH, MEDIUM, LOW
            riskScore: riskAssessment.score,
            summary: summary,
            details: {
                progressivity: {
                    status: progressivity.conclusion,
                    evidence: progressivity.evidence,
                    timeline: `${progressivity.firstDate} ~ ${progressivity.lastDate} (${progressivity.visitCount} visits)`
                },
                disclosure: {
                    hasViolation: disclosureViolation.hasViolationRisk,
                    violationCount: disclosureViolation.violationCount,
                    violations: disclosureViolation.violations
                },
                doctorShopping: {
                    isSuspicious: doctorShopping.isSuspicious,
                    maxHospitals: doctorShopping.maxHospitalsIn30Days,
                    evidence: doctorShopping.evidence
                }
            }
        };
    }

    /**
     * 리스크 레벨 평가
     */
    assessRisk(result) {
        let score = 0;

        // 고지의무 위반: 건당 2점
        if (result.disclosureViolation?.hasViolationRisk) {
            score += (result.disclosureViolation.violationCount * 2);
        }

        // 의료쇼핑: 3점 (강력한 의심)
        if (result.doctorShopping?.isSuspicious) {
            score += 3;
        }

        // 진행성/만성 질환: 1점 (주의 필요)
        if (result.progressivity?.conclusion === 'PROGRESSIVE/CHRONIC') {
            score += 1;
        }

        let level = 'LOW';
        if (score >= this.riskThresholds.HIGH) level = 'HIGH';
        else if (score >= this.riskThresholds.MEDIUM) level = 'MEDIUM';

        return { level, score };
    }

    /**
     * 텍스트 요약 생성
     */
    generateSummary(result, risk) {
        const points = [];

        if (result.disclosureViolation?.hasViolationRisk) {
            points.push(`⚠️ 고지의무 위반 의심: 가입 전 ${result.disclosureViolation.violationCount}건의 진료 기록 발견.`);
        }

        if (result.doctorShopping?.isSuspicious) {
            points.push(`🏥 의료쇼핑 의심: 30일 내 ${result.doctorShopping.maxHospitalsIn30Days}개 병원 방문.`);
        }

        if (result.progressivity?.conclusion === 'PROGRESSIVE/CHRONIC') {
            points.push(`📈 질환 진행성: 만성적 또는 진행성 패턴 확인됨.`);
        }

        if (points.length === 0) {
            return "특이사항 없음. 정상적인 진료 패턴으로 보입니다.";
        }

        return `[Risk Level: ${risk.level}] ${points.join(' ')}`;
    }
}

export default InvestigationReporter;
