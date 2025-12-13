/**
 * VNEXSUS Fuzzy Matcher (T-102)
 * 
 * Levenshtein Distance 알고리즘을 사용하여 유사 문자열을 매칭합니다.
 * 병원명, 진단명 등에서 오타를 허용하여 정확도를 높입니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class FuzzyMatcher {
    constructor(options = {}) {
        this.threshold = options.threshold || 0.7; // 70% 이상 유사도
        this.maxDistance = options.maxDistance || 3; // 최대 편집 거리

        // 주요 병원명 사전 (확장 가능)
        this.hospitalDictionary = [
            '서울아산병원', '삼성서울병원', '서울대학교병원', '세브란스병원',
            '강북삼성병원', '서울성모병원', '고려대학교안암병원', '한양대학교병원',
            '분당서울대학교병원', '아주대학교병원', '경희대학교병원', '이대목동병원',
            '건국대학교병원', '중앙대학교병원', '순천향대학교병원', '인하대학교병원',
            '국립암센터', '국립중앙의료원', '보라매병원', '서울백병원',
            '마포리더스내과', '삼성화재부속의원'
        ];

        // 주요 진단명 사전 (ICD 코드 매핑)
        this.diagnosisDictionary = {
            '고혈압': { icd: 'I10', en: 'Essential Hypertension' },
            '본태성고혈압': { icd: 'I10', en: 'Essential Hypertension' },
            '당뇨병': { icd: 'E11', en: 'Diabetes Mellitus' },
            '제2형당뇨병': { icd: 'E11', en: 'Type 2 Diabetes Mellitus' },
            '위암': { icd: 'C16', en: 'Gastric Cancer' },
            '위선암': { icd: 'C16.9', en: 'Adenocarcinoma of Stomach' },
            '대장암': { icd: 'C18', en: 'Colon Cancer' },
            '폐암': { icd: 'C34', en: 'Lung Cancer' },
            '유방암': { icd: 'C50', en: 'Breast Cancer' },
            '간암': { icd: 'C22', en: 'Liver Cancer' },
            '갑상선암': { icd: 'C73', en: 'Thyroid Cancer' },
            '전립선암': { icd: 'C61', en: 'Prostate Cancer' },
            '췌장암': { icd: 'C25', en: 'Pancreatic Cancer' },
            '뇌졸중': { icd: 'I63', en: 'Cerebral Infarction' },
            '심근경색': { icd: 'I21', en: 'Acute Myocardial Infarction' },
            '협심증': { icd: 'I20', en: 'Angina Pectoris' },
            '지방간': { icd: 'K76.0', en: 'Fatty Liver' },
            '간경변': { icd: 'K74', en: 'Hepatic Cirrhosis' },
            '위궤양': { icd: 'K25', en: 'Gastric Ulcer' },
            '십이지장궤양': { icd: 'K26', en: 'Duodenal Ulcer' },
            '천식': { icd: 'J45', en: 'Asthma' },
            '폐렴': { icd: 'J18', en: 'Pneumonia' },
            '골절': { icd: 'S72', en: 'Fracture' },
            '추간판탈출증': { icd: 'M51.1', en: 'Intervertebral Disc Herniation' },
            '디스크': { icd: 'M51.1', en: 'Intervertebral Disc Herniation' }
        };
    }

    /**
     * Levenshtein Distance 계산
     * @param {string} a - 첫 번째 문자열
     * @param {string} b - 두 번째 문자열
     * @returns {number} 편집 거리
     */
    levenshteinDistance(a, b) {
        if (!a || !b) return Math.max((a || '').length, (b || '').length);

        const matrix = [];
        const aLen = a.length;
        const bLen = b.length;

        // 초기화
        for (let i = 0; i <= aLen; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= bLen; j++) {
            matrix[0][j] = j;
        }

        // 동적 프로그래밍
        for (let i = 1; i <= aLen; i++) {
            for (let j = 1; j <= bLen; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // 삭제
                    matrix[i][j - 1] + 1,      // 삽입
                    matrix[i - 1][j - 1] + cost // 대체
                );
            }
        }

        return matrix[aLen][bLen];
    }

    /**
     * 유사도 계산 (0~1)
     * @param {string} a - 첫 번째 문자열
     * @param {string} b - 두 번째 문자열
     * @returns {number} 유사도 (0~1)
     */
    similarity(a, b) {
        if (!a || !b) return 0;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        const distance = this.levenshteinDistance(a, b);
        return 1 - distance / maxLen;
    }

    /**
     * 병원명 매칭
     * @param {string} input - 입력 병원명
     * @returns {{matched: string, similarity: number, original: string} | null}
     */
    matchHospital(input) {
        if (!input) return null;

        const normalized = this.normalizeHospitalName(input);
        let bestMatch = null;
        let bestSimilarity = 0;

        for (const hospital of this.hospitalDictionary) {
            const normalizedDict = this.normalizeHospitalName(hospital);
            const sim = this.similarity(normalized, normalizedDict);

            if (sim > bestSimilarity && sim >= this.threshold) {
                bestSimilarity = sim;
                bestMatch = hospital;
            }
        }

        if (bestMatch) {
            return {
                matched: bestMatch,
                similarity: bestSimilarity,
                original: input,
                confidence: Math.round(bestSimilarity * 100)
            };
        }

        // 사전에 없으면 원본 반환 (낮은 신뢰도)
        return {
            matched: input,
            similarity: 0,
            original: input,
            confidence: 30, // 낮은 신뢰도
            isNewEntry: true
        };
    }

    /**
     * 진단명 매칭
     * @param {string} input - 입력 진단명
     * @returns {{matched: string, icd: string, en: string, similarity: number} | null}
     */
    matchDiagnosis(input) {
        if (!input) return null;

        const normalized = this.normalizeDiagnosisName(input);
        let bestMatch = null;
        let bestSimilarity = 0;
        let bestData = null;

        for (const [diagnosis, data] of Object.entries(this.diagnosisDictionary)) {
            const normalizedDict = this.normalizeDiagnosisName(diagnosis);
            const sim = this.similarity(normalized, normalizedDict);

            if (sim > bestSimilarity && sim >= this.threshold) {
                bestSimilarity = sim;
                bestMatch = diagnosis;
                bestData = data;
            }
        }

        if (bestMatch && bestData) {
            return {
                matched: bestMatch,
                icd: bestData.icd,
                en: bestData.en,
                similarity: bestSimilarity,
                original: input,
                confidence: Math.round(bestSimilarity * 100),
                formatted: `[${bestData.icd}/${bestData.en}-${bestMatch}]`
            };
        }

        // 사전에 없으면 원본 반환
        return {
            matched: input,
            icd: null,
            en: null,
            similarity: 0,
            original: input,
            confidence: 30,
            isNewEntry: true
        };
    }

    /**
     * 여러 후보 중 최적 매칭 찾기
     * @param {string} input - 입력 문자열
     * @param {Array<string>} candidates - 후보 목록
     * @returns {{matched: string, similarity: number} | null}
     */
    findBestMatch(input, candidates) {
        if (!input || !candidates || candidates.length === 0) return null;

        let bestMatch = null;
        let bestSimilarity = 0;

        for (const candidate of candidates) {
            const sim = this.similarity(input, candidate);
            if (sim > bestSimilarity) {
                bestSimilarity = sim;
                bestMatch = candidate;
            }
        }

        if (bestSimilarity >= this.threshold) {
            return {
                matched: bestMatch,
                similarity: bestSimilarity,
                original: input,
                confidence: Math.round(bestSimilarity * 100)
            };
        }

        return null;
    }

    /**
     * 병원명 정규화
     */
    normalizeHospitalName(name) {
        if (!name) return '';
        return name
            .replace(/\s+/g, '')
            .replace(/[（）()]/g, '')
            .replace(/대학교/g, '대')
            .replace(/종합병원/g, '병원')
            .replace(/의료원/g, '병원')
            .toLowerCase();
    }

    /**
     * 진단명 정규화
     */
    normalizeDiagnosisName(name) {
        if (!name) return '';
        return name
            .replace(/\s+/g, '')
            .replace(/[（）()]/g, '')
            .replace(/증후군/g, '')
            .replace(/질환/g, '')
            .toLowerCase();
    }

    /**
     * 사전에 새로운 항목 추가
     * @param {string} type - 'hospital' | 'diagnosis'
     * @param {string} name - 추가할 이름
     * @param {object} data - 추가 데이터 (진단명의 경우 {icd, en})
     */
    addToDictionary(type, name, data = null) {
        if (type === 'hospital') {
            if (!this.hospitalDictionary.includes(name)) {
                this.hospitalDictionary.push(name);
            }
        } else if (type === 'diagnosis' && data) {
            if (!this.diagnosisDictionary[name]) {
                this.diagnosisDictionary[name] = data;
            }
        }
    }

    /**
     * 현재 사전 내보내기 (JSON)
     */
    exportDictionary() {
        return {
            hospitals: this.hospitalDictionary,
            diagnoses: this.diagnosisDictionary,
            exportedAt: new Date().toISOString()
        };
    }
}

export default FuzzyMatcher;
