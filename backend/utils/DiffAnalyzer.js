/**
 * VNEXSUS Diff Analyzer (T-202)
 * 
 * AI가 생성한 초기 데이터(Original)와 사용자가 수정한 데이터(Corrected)를 비교하여
 * 차이점(Diff)을 분석하고, 학습 가능한 형태의 피드백 데이터로 변환합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

// import { diffWords } from 'diff'; // Removed external dependency

class DiffAnalyzer {
    constructor() {
        // 무시할 필드 목록
        this.ignoredFields = ['extractedAt', 'confidence', 'summary', 'validation'];
    }

    /**
     * 두 객체 간의 차이를 분석합니다.
     * @param {object} original - AI 초기 추출 결과
     * @param {object} corrected - 사용자 수정 결과
     * @returns {object} 분석된 차이점 (Changes)
     */
    analyze(original, corrected) {
        const changes = [];
        const originalFields = original.fields || {};
        const correctedFields = corrected.fields || {};

        // 1. 병원명 비교
        this.compareHospitals(originalFields.hospitals, correctedFields.hospitals, changes);

        // 2. 진단명 비교
        this.compareDiagnoses(originalFields.diagnoses, correctedFields.diagnoses, changes);

        // 3. 날짜 비교
        this.compareDates(originalFields.dates, correctedFields.dates, changes);

        return {
            hasChanges: changes.length > 0,
            changeCount: changes.length,
            changes: changes,
            analyzedAt: new Date().toISOString()
        };
    }

    /**
     * 병원명 비교 로직
     */
    compareHospitals(originalList, correctedList, changes) {
        const org = originalList || [];
        const cor = correctedList || [];

        // 간단한 비교를 위해 첫 번째 병원명만 비교 (프로토타입)
        // 실제로는 배열 전체 매칭이 필요함
        if (cor.length > 0) {
            const bestOrg = org.find(o => o.name === cor[0].name) || org[0];

            if (!bestOrg) {
                changes.push({
                    type: 'ADD',
                    field: 'hospital',
                    value: cor[0].name,
                    reason: 'AI가 병원명을 추출하지 못함'
                });
            } else if (bestOrg.name !== cor[0].name) {
                changes.push({
                    type: 'MODIFY',
                    field: 'hospital',
                    before: bestOrg.name,
                    after: cor[0].name,
                    reason: '병원명 오타 또는 오인식 수정'
                });
            }
        }
    }

    /**
     * 진단명 비교 로직
     */
    compareDiagnoses(originalList, correctedList, changes) {
        const org = originalList || [];
        const cor = correctedList || [];

        // 추가된 진단명 찾기
        cor.forEach(c => {
            const match = org.find(o => o.diagnosis === c.diagnosis);
            if (!match) {
                changes.push({
                    type: 'ADD',
                    field: 'diagnosis',
                    value: c.diagnosis,
                    reason: '누락된 진단명 추가'
                });
            }
        });

        // 삭제된 진단명 찾기 (오인식)
        org.forEach(o => {
            const match = cor.find(c => c.diagnosis === o.diagnosis);
            if (!match) {
                changes.push({
                    type: 'DELETE',
                    field: 'diagnosis',
                    value: o.diagnosis,
                    reason: '잘못 추출된 진단명 삭제'
                });
            }
        });
    }

    /**
     * 날짜 비교 로직
     */
    compareDates(originalList, correctedList, changes) {
        const org = originalList || [];
        const cor = correctedList || [];

        // 날짜 형식 변경 감지
        cor.forEach(c => {
            const match = org.find(o => o.normalized === c.normalized);
            if (!match) {
                changes.push({
                    type: 'ADD',
                    field: 'date',
                    value: c.normalized,
                    reason: '누락된 날짜 추가'
                });
            }
        });
    }
}

export default DiffAnalyzer;
