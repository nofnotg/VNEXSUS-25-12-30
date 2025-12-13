/**
 * VNEXSUS Entity Relation Mapper (T-301)
 * 
 * 추출된 의료 데이터(Entity) 간의 관계(Relation)를 정의하고 그래프 구조로 변환합니다.
 * 시간 순서(Timeline)와 인과 관계(Causality)를 중심으로 구조화합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class EntityRelationMapper {
    constructor() {
        this.nodes = [];
        this.edges = [];
    }

    /**
     * 추출된 데이터를 그래프 구조로 매핑합니다.
     * @param {object} extractedData - HybridExtractor 결과
     * @returns {object} { nodes, edges, timeline }
     */
    map(extractedData) {
        this.reset();
        const { fields } = extractedData;

        if (!fields) return this.getGraph();

        // 1. 환자 노드 생성 (Root)
        const patientNode = this.createNode('Patient', 'Patient_1', { name: 'Unknown' });

        // 2. 방문(Visit) 노드 생성 (날짜 기준)
        const visitNodes = this.createVisitNodes(fields.dates);

        // 3. 병원(Hospital) 노드 생성 및 방문과 연결
        this.mapHospitals(fields.hospitals, visitNodes);

        // 4. 진단(Diagnosis) 노드 생성 및 방문과 연결
        this.mapDiagnoses(fields.diagnoses, fields.icdCodes, visitNodes);

        // 5. 시간 순서 정렬 (Timeline)
        const timeline = this.createTimeline(visitNodes);

        return {
            ...this.getGraph(),
            timeline
        };
    }

    /**
     * 방문 노드 생성
     */
    createVisitNodes(dates) {
        const visits = [];
        if (!dates) return visits;

        dates.forEach((date, index) => {
            if (!date.normalized) return;

            const visitId = `Visit_${index}`;
            const node = this.createNode('Visit', visitId, {
                date: date.normalized,
                original: date.original,
                index: date.index // 텍스트 위치 (관계 추론용)
            });

            // 환자와 연결
            this.createEdge('Patient_1', visitId, 'HAS_VISIT');
            visits.push(node);
        });

        return visits;
    }

    /**
     * 병원 매핑 (위치 기반 근접성)
     */
    mapHospitals(hospitals, visits) {
        if (!hospitals) return;

        hospitals.forEach((hospital, index) => {
            const hospId = `Hospital_${index}`;
            this.createNode('Hospital', hospId, {
                name: hospital.name,
                type: hospital.type
            });

            // 가장 가까운 방문 노드 찾기 (텍스트 인덱스 기준)
            const nearestVisit = this.findNearestNode(hospital.index, visits);
            if (nearestVisit) {
                this.createEdge(nearestVisit.id, hospId, 'AT_HOSPITAL');
            }
        });
    }

    /**
     * 진단 매핑 (위치 기반 근접성 + ICD 매칭)
     */
    mapDiagnoses(diagnoses, icdCodes, visits) {
        if (!diagnoses) return;

        diagnoses.forEach((diag, index) => {
            const diagId = `Diagnosis_${index}`;
            const nodeData = { name: diag.diagnosis };

            // ICD 코드 매칭 (같은 줄이나 근처에 있는 코드)
            if (icdCodes) {
                const nearestICD = this.findNearestItem(diag.index, icdCodes, 50); // 50자 이내
                if (nearestICD) {
                    nodeData.icd = nearestICD.code;
                    nodeData.icdDesc = nearestICD.original;
                }
            }

            this.createNode('Diagnosis', diagId, nodeData);

            // 가장 가까운 방문 노드 찾기
            const nearestVisit = this.findNearestNode(diag.index, visits);
            if (nearestVisit) {
                this.createEdge(nearestVisit.id, diagId, 'DIAGNOSED_WITH');
            }
        });
    }

    /**
     * 타임라인 생성
     */
    createTimeline(visits) {
        return visits
            .sort((a, b) => new Date(a.data.date) - new Date(b.data.date))
            .map(v => ({
                date: v.data.date,
                visitId: v.id,
                events: this.getConnectedNodes(v.id)
            }));
    }

    // --- Helper Methods ---

    reset() {
        this.nodes = [];
        this.edges = [];
    }

    createNode(type, id, data) {
        const node = { id, type, data };
        this.nodes.push(node);
        return node;
    }

    createEdge(source, target, type) {
        this.edges.push({ source, target, type });
    }

    getGraph() {
        return { nodes: this.nodes, edges: this.edges };
    }

    findNearestNode(targetIndex, nodes) {
        if (!nodes || nodes.length === 0) return null;

        return nodes.reduce((nearest, node) => {
            const currentDist = Math.abs(node.data.index - targetIndex);
            const nearestDist = Math.abs(nearest.data.index - targetIndex);
            return currentDist < nearestDist ? node : nearest;
        });
    }

    findNearestItem(targetIndex, items, threshold) {
        if (!items || items.length === 0) return null;

        let nearest = null;
        let minDist = Infinity;

        items.forEach(item => {
            const dist = Math.abs(item.index - targetIndex);
            if (dist < minDist && dist <= threshold) {
                minDist = dist;
                nearest = item;
            }
        });

        return nearest;
    }

    getConnectedNodes(sourceId) {
        return this.edges
            .filter(e => e.source === sourceId)
            .map(e => {
                const targetNode = this.nodes.find(n => n.id === e.target);
                return {
                    type: e.type,
                    node: targetNode
                };
            });
    }
}

export default EntityRelationMapper;
