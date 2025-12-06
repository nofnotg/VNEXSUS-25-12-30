/**
 * DiseaseBodySystemMapper.js
 * 
 * Master Plan Phase 1: Dispute Layer
 * 
 * 목적:
 * - KCD/ICD 코드 또는 진단명을 장기군/질환군으로 매핑
 * - 청구 질환과의 관련성 판단에 사용
 * - 간단한 패턴 매칭 기반 (향후 확장 가능)
 */

/**
 * 장기군/질환군 매핑 테이블
 */
const BODY_SYSTEM_MAP = [
    {
        system: 'breast',
        patterns: [
            /유방암/i,
            /유방 종양/i,
            /유방 악성/i,
            /breast cancer/i,
            /breast tumor/i,
            /mammary/i
        ],
        icdPrefixes: ['C50', 'D05']
    },
    {
        system: 'cardio',
        patterns: [
            /협심증/i,
            /심근경색/i,
            /관상동맥/i,
            /심장/i,
            /angina/i,
            /myocardial infarction/i,
            /coronary/i,
            /cardiac/i
        ],
        icdPrefixes: ['I20', 'I21', 'I22', 'I23', 'I24', 'I25']
    },
    {
        system: 'cns',
        patterns: [
            /뇌경색/i,
            /뇌출혈/i,
            /중풍/i,
            /뇌혈관/i,
            /stroke/i,
            /cerebral/i,
            /brain/i
        ],
        icdPrefixes: ['I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I68', 'I69']
    },
    {
        system: 'respiratory',
        patterns: [
            /폐암/i,
            /폐렴/i,
            /기관지/i,
            /호흡기/i,
            /lung cancer/i,
            /pneumonia/i,
            /bronchial/i,
            /respiratory/i
        ],
        icdPrefixes: ['C34', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18']
    },
    {
        system: 'digestive',
        patterns: [
            /위암/i,
            /대장암/i,
            /간암/i,
            /췌장암/i,
            /소화기/i,
            /gastric cancer/i,
            /colon cancer/i,
            /liver cancer/i,
            /pancreatic cancer/i
        ],
        icdPrefixes: ['C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25']
    },
    {
        system: 'endocrine',
        patterns: [
            /당뇨/i,
            /갑상선/i,
            /내분비/i,
            /diabetes/i,
            /thyroid/i,
            /endocrine/i
        ],
        icdPrefixes: ['E10', 'E11', 'E12', 'E13', 'E14', 'C73']
    },
    {
        system: 'musculoskeletal',
        patterns: [
            /골절/i,
            /관절/i,
            /근골격/i,
            /척추/i,
            /fracture/i,
            /joint/i,
            /musculoskeletal/i,
            /spine/i
        ],
        icdPrefixes: ['M', 'S']
    },
    {
        system: 'reproductive',
        patterns: [
            /자궁/i,
            /난소/i,
            /전립선/i,
            /생식기/i,
            /uterus/i,
            /ovary/i,
            /prostate/i,
            /reproductive/i
        ],
        icdPrefixes: ['C53', 'C54', 'C55', 'C56', 'C61']
    }
];

/**
 * 진단명 또는 코드를 장기군으로 매핑
 * 
 * @param {string} diagnosisText - 진단명 텍스트
 * @param {Object} codes - 코드 객체 { icd10: 'C50.9', ... }
 * @returns {string} - 장기군 ('breast', 'cardio', 'cns', 'other' 등)
 */
export function mapDiagnosisToBodySystem(diagnosisText, codes = {}) {
    const text = (diagnosisText || '').toLowerCase();

    // 1. 텍스트 패턴 매칭
    for (const item of BODY_SYSTEM_MAP) {
        if (item.patterns.some(pattern => pattern.test(text))) {
            return item.system;
        }
    }

    // 2. ICD 코드 매칭
    const icd10 = codes.icd10 || codes.icd10Code || codes.ICD10 || '';
    if (icd10) {
        for (const item of BODY_SYSTEM_MAP) {
            if (item.icdPrefixes && item.icdPrefixes.some(prefix => icd10.startsWith(prefix))) {
                return item.system;
            }
        }
    }

    // 3. 매칭 실패 시 'other' 반환
    return 'other';
}

/**
 * 여러 진단을 장기군으로 매핑
 * 
 * @param {Array} diagnoses - 진단 배열 [{ text, codes }, ...]
 * @returns {Array} - 장기군 배열 ['breast', 'cardio', ...]
 */
export function mapDiagnosesToBodySystems(diagnoses) {
    if (!Array.isArray(diagnoses)) {
        return [];
    }

    const systems = diagnoses.map(diagnosis => {
        const text = diagnosis.text || diagnosis.normalizedText || '';
        const codes = diagnosis.codes || {};
        return mapDiagnosisToBodySystem(text, codes);
    });

    // 중복 제거
    return [...new Set(systems)];
}

/**
 * 장기군 간 유사도 계산 (Jaccard 유사도)
 * 
 * @param {Array} systemsA - 장기군 배열 A
 * @param {Array} systemsB - 장기군 배열 B
 * @returns {number} - 유사도 (0.0 ~ 1.0)
 */
export function calculateBodySystemSimilarity(systemsA, systemsB) {
    if (!systemsA || !systemsB || systemsA.length === 0 || systemsB.length === 0) {
        return 0.0;
    }

    const setA = new Set(systemsA);
    const setB = new Set(systemsB);

    const intersection = [...setA].filter(x => setB.has(x));
    const union = new Set([...setA, ...setB]);

    return intersection.length / union.size;
}

/**
 * 장기군 정보 조회
 * 
 * @param {string} system - 장기군 코드
 * @returns {Object|null} - 장기군 정보 또는 null
 */
export function getBodySystemInfo(system) {
    return BODY_SYSTEM_MAP.find(item => item.system === system) || null;
}

/**
 * 모든 장기군 목록 조회
 * 
 * @returns {Array} - 장기군 코드 배열
 */
export function getAllBodySystems() {
    return BODY_SYSTEM_MAP.map(item => item.system);
}

export default {
    mapDiagnosisToBodySystem,
    mapDiagnosesToBodySystems,
    calculateBodySystemSimilarity,
    getBodySystemInfo,
    getAllBodySystems
};
