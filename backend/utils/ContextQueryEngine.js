/**
 * VNEXSUS Context Query Engine (T-302)
 * 
 * Entity Relation Map(그래프)을 기반으로 문맥적 질문에 답변합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class ContextQueryEngine {
    constructor(graph) {
        this.graph = graph;
        this.nodes = graph?.nodes || [];
        this.edges = graph?.edges || [];
        this.timeline = graph?.timeline || [];
    }

    /**
     * 질문에 대한 답변을 생성합니다.
     * @param {string} queryType - 질문 유형 (FIRST_DIAGNOSIS, HOSPITAL_HISTORY, etc.)
     * @param {object} params - 질문 파라미터
     */
    query(queryType, params = {}) {
        switch (queryType) {
            case 'FIRST_DIAGNOSIS':
                return this.findFirstDiagnosis(params.diagnosisName);
            case 'HOSPITAL_HISTORY':
                return this.findHospitalHistory(params.hospitalName);
            case 'DIAGNOSIS_TIMELINE':
                return this.getDiagnosisTimeline(params.diagnosisName);
            default:
                return { error: 'Unknown query type' };
        }
    }

    /**
     * 특정 진단의 최초 진단일 찾기
     */
    findFirstDiagnosis(diagnosisName) {
        if (!diagnosisName) return { error: 'Diagnosis name required' };

        // 1. 해당 진단명 노드 찾기
        const diagNodes = this.nodes.filter(n =>
            n.type === 'Diagnosis' && n.data.name.includes(diagnosisName)
        );

        if (diagNodes.length === 0) return { found: false, message: 'Diagnosis not found' };

        // 2. 각 진단 노드와 연결된 방문 노드 찾기
        let earliestDate = null;
        let firstVisit = null;

        diagNodes.forEach(diagNode => {
            // DIAGNOSED_WITH 엣지의 소스(Visit) 찾기
            const edge = this.edges.find(e => e.target === diagNode.id && e.type === 'DIAGNOSED_WITH');
            if (edge) {
                const visitNode = this.nodes.find(n => n.id === edge.source);
                if (visitNode && visitNode.data.date) {
                    const date = new Date(visitNode.data.date);
                    if (!isNaN(date.getTime())) { // 유효한 날짜인지 확인
                        if (!earliestDate || date < earliestDate) {
                            earliestDate = date;
                            firstVisit = visitNode;
                        }
                    }
                }
            }
        });

        if (earliestDate) {
            return {
                found: true,
                date: earliestDate.toISOString().split('T')[0],
                visitId: firstVisit.id,
                message: `${diagnosisName} was first diagnosed on ${earliestDate.toISOString().split('T')[0]}`
            };
        }

        return { found: false, message: 'Date not found for diagnosis' };
    }

    /**
     * 특정 병원 방문 이력 찾기
     */
    findHospitalHistory(hospitalName) {
        if (!hospitalName) return { error: 'Hospital name required' };

        // 1. 병원 노드 찾기
        const hospNodes = this.nodes.filter(n =>
            n.type === 'Hospital' && n.data.name.includes(hospitalName)
        );

        if (hospNodes.length === 0) return { found: false, message: 'Hospital not found' };

        const history = [];

        hospNodes.forEach(hospNode => {
            // AT_HOSPITAL 엣지의 소스(Visit) 찾기
            const edges = this.edges.filter(e => e.target === hospNode.id && e.type === 'AT_HOSPITAL');
            edges.forEach(edge => {
                const visitNode = this.nodes.find(n => n.id === edge.source);
                if (visitNode) {
                    // 해당 방문의 진단명 찾기
                    const diagEdges = this.edges.filter(e => e.source === visitNode.id && e.type === 'DIAGNOSED_WITH');
                    const diagnoses = diagEdges.map(de => {
                        const dNode = this.nodes.find(n => n.id === de.target);
                        return dNode ? dNode.data.name : null;
                    }).filter(Boolean);

                    history.push({
                        date: visitNode.data.date,
                        diagnoses: diagnoses
                    });
                }
            });
        });

        // 날짜순 정렬
        history.sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            found: history.length > 0,
            count: history.length,
            history: history
        };
    }

    /**
     * 진단 타임라인 (언제, 어디서 진단받았는지)
     */
    getDiagnosisTimeline(diagnosisName) {
        if (!this.timeline) return { error: 'Timeline not available' };

        const events = [];

        this.timeline.forEach(t => {
            const hasDiagnosis = t.events.some(e =>
                e.type === 'DIAGNOSED_WITH' && e.node.data.name.includes(diagnosisName)
            );

            if (hasDiagnosis) {
                const hospital = t.events.find(e => e.type === 'AT_HOSPITAL')?.node?.data?.name || 'Unknown Hospital';
                events.push({
                    date: t.date,
                    hospital: hospital,
                    diagnosis: diagnosisName
                });
            }
        });

        return {
            found: events.length > 0,
            events: events
        };
    }
}

export default ContextQueryEngine;
