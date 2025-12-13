/**
 * VNEXSUS Reasoning Engine (T-401)
 * 
 * Context Query Engine을 확장하여 복합적인 조사 시나리오를 수행합니다.
 * 1. 질환 진행성 분석 (Progressivity)
 * 2. 고지의무 위반 탐지 (Disclosure Violation)
 * 3. 의료쇼핑 패턴 감지 (Doctor Shopping)
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

import ContextQueryEngine from './ContextQueryEngine.js';

class ReasoningEngine extends ContextQueryEngine {
    constructor(graph) {
        super(graph);
    }

    /**
     * 종합 조사 수행
     */
    investigate(params) {
        return {
            progressivity: this.analyzeProgressivity(params.targetDiagnosis),
            disclosureViolation: this.detectDisclosureViolation(params.contractDate),
            doctorShopping: this.detectDoctorShopping(params.shoppingThreshold)
        };
    }

    /**
     * 1. 질환 진행성 분석
     * "이 질환이 심해져서 계속 진료를 보는 것인가?"
     */
    analyzeProgressivity(diagnosisName) {
        if (!diagnosisName) return { status: 'SKIPPED', reason: 'No diagnosis specified' };

        // 해당 진단의 타임라인 확보
        const timeline = this.getDiagnosisTimeline(diagnosisName);
        if (!timeline.found || timeline.events.length < 2) {
            return { status: 'INCONCLUSIVE', reason: 'Insufficient data points (less than 2 visits)' };
        }

        const events = timeline.events;
        const firstDate = new Date(events[0].date);
        const lastDate = new Date(events[events.length - 1].date);

        // 기간 계산 (일 단위)
        const durationDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        const visitCount = events.length;
        const frequency = durationDays > 0 ? visitCount / (durationDays / 30) : visitCount; // 월평균 방문

        // 단순 로직: 월 2회 이상 방문하거나 3개월 이상 지속되면 "진행성/지속성"으로 판단
        let conclusion = 'TEMPORARY';
        let evidence = `Visited ${visitCount} times over ${durationDays} days.`;

        if (durationDays > 90 || frequency >= 2.0) {
            conclusion = 'PROGRESSIVE/CHRONIC';
            evidence += ' High frequency or long duration suggests chronic condition.';
        }

        return {
            status: 'ANALYZED',
            diagnosis: diagnosisName,
            conclusion,
            evidence,
            firstDate: events[0].date,
            lastDate: events[events.length - 1].date,
            visitCount
        };
    }

    /**
     * 2. 고지의무 위반 탐지
     * "보험 가입일 기준 위반 사항이 있는가?"
     */
    detectDisclosureViolation(contractDateStr) {
        if (!contractDateStr) return { status: 'SKIPPED', reason: 'No contract date provided' };

        const contractDate = new Date(contractDateStr);
        if (isNaN(contractDate.getTime())) return { status: 'ERROR', reason: 'Invalid contract date' };

        // 가입 전 3개월, 1년, 5년 기준일 설정
        const threeMonthsAgo = new Date(contractDate); threeMonthsAgo.setMonth(contractDate.getMonth() - 3);
        const oneYearAgo = new Date(contractDate); oneYearAgo.setFullYear(contractDate.getFullYear() - 1);
        const fiveYearsAgo = new Date(contractDate); fiveYearsAgo.setFullYear(contractDate.getFullYear() - 5);

        const violations = [];

        // 타임라인 순회
        this.timeline.forEach(t => {
            const visitDate = new Date(t.date);
            if (visitDate >= contractDate) return; // 가입 후는 제외

            // 3개월 내: 모든 질병 확정진단/의심소견
            if (visitDate >= threeMonthsAgo) {
                const diagnoses = t.events
                    .filter(e => e.type === 'DIAGNOSED_WITH')
                    .map(e => e.node.data.name);

                if (diagnoses.length > 0) {
                    violations.push({
                        period: '3_MONTHS',
                        date: t.date,
                        type: 'DIAGNOSIS',
                        details: diagnoses.join(', '),
                        hospital: this.getHospitalName(t)
                    });
                }
            }

            // (간소화를 위해 1년/5년 로직은 생략하거나 추후 고도화)
            // 예: 1년 내 재검사, 5년 내 입원/수술/7일이상통원/30일이상투약 등
        });

        return {
            status: 'ANALYZED',
            contractDate: contractDateStr,
            hasViolationRisk: violations.length > 0,
            violationCount: violations.length,
            violations
        };
    }

    /**
     * 3. 의료쇼핑 패턴 감지
     * "연관성 높은 타 병원 기록이 있는가?"
     */
    detectDoctorShopping(threshold = 3) {
        // 단기간(예: 30일) 내에 서로 다른 병원을 몇 군데 방문했는지 확인
        const hospitalVisits = [];

        this.timeline.forEach(t => {
            const hospital = this.getHospitalName(t);
            if (hospital && hospital !== 'Unknown Hospital') {
                hospitalVisits.push({ date: new Date(t.date), hospital });
            }
        });

        if (hospitalVisits.length === 0) return { status: 'INCONCLUSIVE' };

        // 윈도우 슬라이딩으로 30일 내 병원 수 계산
        let maxHospitals = 0;
        let shoppingPeriod = null;

        for (let i = 0; i < hospitalVisits.length; i++) {
            const currentWindow = new Set();
            const startDate = hospitalVisits[i].date;
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 30);

            for (let j = i; j < hospitalVisits.length; j++) {
                if (hospitalVisits[j].date <= endDate) {
                    currentWindow.add(hospitalVisits[j].hospital);
                } else {
                    break;
                }
            }

            if (currentWindow.size > maxHospitals) {
                maxHospitals = currentWindow.size;
                shoppingPeriod = { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
            }
        }

        return {
            status: 'ANALYZED',
            isSuspicious: maxHospitals >= threshold,
            maxHospitalsIn30Days: maxHospitals,
            period: shoppingPeriod,
            evidence: maxHospitals >= threshold ? `Visited ${maxHospitals} different hospitals within 30 days.` : 'No suspicious pattern detected.'
        };
    }

    // Helper
    getHospitalName(timelineEvent) {
        const hospEvent = timelineEvent.events.find(e => e.type === 'AT_HOSPITAL');
        return hospEvent ? hospEvent.node.data.name : 'Unknown Hospital';
    }
}

export default ReasoningEngine;
