/**
 * VNEXSUS Cross Validator (T-402)
 * 
 * 추출된 데이터를 외부 데이터베이스(심평원, WHO ICD-10)와 교차 검증합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class CrossValidator {
    constructor() {
        // ICD-10 코드 데이터베이스 (주요 코드)
        this.icdDatabase = {
            // 암 (C00-C97)
            'C16': { ko: '위암', en: 'Stomach Cancer', category: 'cancer' },
            'C16.0': { ko: '위 분문부암', en: 'Cardia Cancer', category: 'cancer' },
            'C16.9': { ko: '위암, 상세불명', en: 'Stomach Cancer, Unspecified', category: 'cancer' },
            'C18': { ko: '대장암', en: 'Colon Cancer', category: 'cancer' },
            'C22': { ko: '간암', en: 'Liver Cancer', category: 'cancer' },
            'C25': { ko: '췌장암', en: 'Pancreatic Cancer', category: 'cancer' },
            'C34': { ko: '폐암', en: 'Lung Cancer', category: 'cancer' },
            'C50': { ko: '유방암', en: 'Breast Cancer', category: 'cancer' },
            'C61': { ko: '전립선암', en: 'Prostate Cancer', category: 'cancer' },
            'C73': { ko: '갑상선암', en: 'Thyroid Cancer', category: 'cancer' },

            // 순환기 (I00-I99)
            'I10': { ko: '본태성 고혈압', en: 'Essential Hypertension', category: 'cardiovascular' },
            'I20': { ko: '협심증', en: 'Angina Pectoris', category: 'cardiovascular' },
            'I21': { ko: '급성 심근경색', en: 'Acute Myocardial Infarction', category: 'cardiovascular' },
            'I63': { ko: '뇌경색', en: 'Cerebral Infarction', category: 'cardiovascular' },

            // 내분비 (E00-E90)
            'E11': { ko: '제2형 당뇨병', en: 'Type 2 Diabetes', category: 'endocrine' },
            'E11.9': { ko: '제2형 당뇨병, 합병증 없음', en: 'Type 2 Diabetes without Complications', category: 'endocrine' },

            // 소화기 (K00-K93)
            'K25': { ko: '위궤양', en: 'Gastric Ulcer', category: 'digestive' },
            'K26': { ko: '십이지장궤양', en: 'Duodenal Ulcer', category: 'digestive' },
            'K74': { ko: '간경변', en: 'Hepatic Cirrhosis', category: 'digestive' },
            'K76.0': { ko: '지방간', en: 'Fatty Liver', category: 'digestive' },

            // 호흡기 (J00-J99)
            'J18': { ko: '폐렴', en: 'Pneumonia', category: 'respiratory' },
            'J45': { ko: '천식', en: 'Asthma', category: 'respiratory' },

            // 근골격계 (M00-M99)
            'M51.1': { ko: '추간판탈출증', en: 'Disc Herniation', category: 'musculoskeletal' }
        };

        // 주요 병원 데이터베이스 (심평원 등록 기준)
        this.hospitalDatabase = {
            // 상급종합병원
            '서울아산병원': { code: '11100001', type: '상급종합', region: '서울' },
            '삼성서울병원': { code: '11100002', type: '상급종합', region: '서울' },
            '서울대학교병원': { code: '11100003', type: '상급종합', region: '서울' },
            '세브란스병원': { code: '11100004', type: '상급종합', region: '서울' },
            '강북삼성병원': { code: '11100005', type: '종합병원', region: '서울' },
            '서울성모병원': { code: '11100006', type: '상급종합', region: '서울' },
            '고려대학교안암병원': { code: '11100007', type: '상급종합', region: '서울' },
            '한양대학교병원': { code: '11100008', type: '상급종합', region: '서울' },
            '분당서울대학교병원': { code: '31100001', type: '상급종합', region: '경기' },
            '아주대학교병원': { code: '31100002', type: '상급종합', region: '경기' },
            '국립암센터': { code: '31100003', type: '전문병원', region: '경기' },

            // 일반 의원
            '마포리더스내과': { code: '11200001', type: '의원', region: '서울' }
        };

        // 보험사 데이터베이스
        this.insuranceDatabase = {
            'DB손해보험': { code: 'DB', type: '손해보험' },
            '삼성화재': { code: 'SF', type: '손해보험' },
            '현대해상': { code: 'HH', type: '손해보험' },
            '메리츠화재': { code: 'MR', type: '손해보험' },
            'KB손해보험': { code: 'KB', type: '손해보험' },
            '삼성생명': { code: 'SSL', type: '생명보험' },
            '한화생명': { code: 'HWL', type: '생명보험' },
            '교보생명': { code: 'KBL', type: '생명보험' }
        };
    }

    /**
     * ICD 코드 검증
     * @param {string} code - ICD 코드
     * @returns {object} { valid, data, confidence }
     */
    validateICD(code) {
        if (!code) {
            return { valid: false, data: null, confidence: 0, reason: '코드 없음' };
        }

        const normalizedCode = code.toUpperCase().trim();

        // 정확한 매칭
        if (this.icdDatabase[normalizedCode]) {
            return {
                valid: true,
                data: this.icdDatabase[normalizedCode],
                code: normalizedCode,
                confidence: 100,
                reason: 'WHO ICD-10 확인됨'
            };
        }

        // 상위 코드 매칭 (C16.9 → C16)
        const baseCode = normalizedCode.split('.')[0];
        if (this.icdDatabase[baseCode]) {
            return {
                valid: true,
                data: this.icdDatabase[baseCode],
                code: normalizedCode,
                confidence: 80,
                reason: '상위 코드 매칭'
            };
        }

        // 형식만 유효한 경우
        if (/^[A-Z]\d{2}(\.\d{1,2})?$/.test(normalizedCode)) {
            return {
                valid: true,
                data: null,
                code: normalizedCode,
                confidence: 50,
                reason: '형식 유효, DB 미확인'
            };
        }

        return {
            valid: false,
            data: null,
            code: normalizedCode,
            confidence: 0,
            reason: '유효하지 않은 ICD 코드'
        };
    }

    /**
     * 병원명 검증
     * @param {string} name - 병원명
     * @returns {object} { valid, data, confidence }
     */
    validateHospital(name) {
        if (!name) {
            return { valid: false, data: null, confidence: 0, reason: '병원명 없음' };
        }

        const normalizedName = name.trim();

        // 정확한 매칭
        if (this.hospitalDatabase[normalizedName]) {
            return {
                valid: true,
                data: this.hospitalDatabase[normalizedName],
                name: normalizedName,
                confidence: 100,
                reason: '심평원 DB 확인됨'
            };
        }

        // 부분 매칭 (병원명에 키워드 포함)
        for (const [dbName, data] of Object.entries(this.hospitalDatabase)) {
            if (normalizedName.includes(dbName) || dbName.includes(normalizedName)) {
                return {
                    valid: true,
                    data: data,
                    name: dbName,
                    originalName: normalizedName,
                    confidence: 70,
                    reason: '부분 매칭'
                };
            }
        }

        // 병원/의원 키워드 포함 시
        if (/(?:병원|의원|클리닉|센터|의료원)/.test(normalizedName)) {
            return {
                valid: true,
                data: null,
                name: normalizedName,
                confidence: 40,
                reason: '형식 유효, DB 미등록 (신규 등록 권장)'
            };
        }

        return {
            valid: false,
            data: null,
            name: normalizedName,
            confidence: 0,
            reason: '유효하지 않은 병원명'
        };
    }

    /**
     * 보험사 검증
     * @param {string} name - 보험사명
     * @returns {object} { valid, data, confidence }
     */
    validateInsurance(name) {
        if (!name) {
            return { valid: false, data: null, confidence: 0, reason: '보험사명 없음' };
        }

        const normalizedName = name.trim();

        // 정확한 매칭
        if (this.insuranceDatabase[normalizedName]) {
            return {
                valid: true,
                data: this.insuranceDatabase[normalizedName],
                name: normalizedName,
                confidence: 100,
                reason: '보험사 DB 확인됨'
            };
        }

        // 부분 매칭
        for (const [dbName, data] of Object.entries(this.insuranceDatabase)) {
            if (normalizedName.includes(dbName) || dbName.includes(normalizedName)) {
                return {
                    valid: true,
                    data: data,
                    name: dbName,
                    originalName: normalizedName,
                    confidence: 80,
                    reason: '부분 매칭'
                };
            }
        }

        return {
            valid: false,
            data: null,
            name: normalizedName,
            confidence: 30,
            reason: 'DB 미등록 보험사'
        };
    }

    /**
     * 날짜 범위 검증
     * @param {string} dateStr - 날짜 문자열
     * @returns {object} { valid, date, confidence }
     */
    validateDateRange(dateStr) {
        if (!dateStr) {
            return { valid: false, date: null, confidence: 0, reason: '날짜 없음' };
        }

        // 날짜 파싱
        const normalized = dateStr.replace(/[.\-/]/g, '-');
        const date = new Date(normalized);

        if (isNaN(date.getTime())) {
            return { valid: false, date: null, confidence: 0, reason: '날짜 파싱 실패' };
        }

        const now = new Date();
        const minDate = new Date('1900-01-01');

        // 미래 날짜 체크
        if (date > now) {
            return {
                valid: false,
                date: date,
                confidence: 20,
                reason: '미래 날짜 (오류 가능성)'
            };
        }

        // 너무 오래된 날짜 체크
        if (date < minDate) {
            return {
                valid: false,
                date: date,
                confidence: 20,
                reason: '비정상적으로 오래된 날짜'
            };
        }

        return {
            valid: true,
            date: date,
            formatted: date.toISOString().split('T')[0],
            confidence: 100,
            reason: '날짜 범위 정상'
        };
    }

    /**
     * 전체 보고서 교차 검증
     * @param {object} report - 추출된 보고서 데이터
     * @returns {object} 검증 결과
     */
    validateReport(report) {
        const results = {
            hospital: null,
            icdCodes: [],
            insurance: null,
            dates: [],
            overallValid: true,
            issues: []
        };

        // 병원 검증
        if (report.hospitalName) {
            results.hospital = this.validateHospital(report.hospitalName);
            if (!results.hospital.valid || results.hospital.confidence < 70) {
                results.issues.push({ field: 'hospital', ...results.hospital });
            }
        }

        // ICD 코드 검증
        if (report.icdCodes && Array.isArray(report.icdCodes)) {
            for (const code of report.icdCodes) {
                const validation = this.validateICD(code);
                results.icdCodes.push(validation);
                if (!validation.valid || validation.confidence < 70) {
                    results.issues.push({ field: 'icdCode', ...validation });
                }
            }
        }

        // 보험사 검증
        if (report.insuranceCompany) {
            results.insurance = this.validateInsurance(report.insuranceCompany);
            if (!results.insurance.valid || results.insurance.confidence < 70) {
                results.issues.push({ field: 'insurance', ...results.insurance });
            }
        }

        // 날짜 검증
        if (report.dates && Array.isArray(report.dates)) {
            for (const date of report.dates) {
                const validation = this.validateDateRange(date);
                results.dates.push(validation);
                if (!validation.valid) {
                    results.issues.push({ field: 'date', ...validation });
                }
            }
        }

        results.overallValid = results.issues.length === 0;
        results.issueCount = results.issues.length;

        return results;
    }

    /**
     * ICD 코드로 진단명 조회
     * @param {string} code - ICD 코드
     * @returns {object|null} 진단명 정보
     */
    lookupICD(code) {
        const normalizedCode = (code || '').toUpperCase().trim();
        return this.icdDatabase[normalizedCode] || this.icdDatabase[normalizedCode.split('.')[0]] || null;
    }

    /**
     * 데이터베이스에 새 항목 추가
     * @param {string} type - 'icd' | 'hospital' | 'insurance'
     * @param {string} key - 키
     * @param {object} data - 데이터
     */
    addToDatabase(type, key, data) {
        switch (type) {
            case 'icd':
                this.icdDatabase[key] = data;
                break;
            case 'hospital':
                this.hospitalDatabase[key] = data;
                break;
            case 'insurance':
                this.insuranceDatabase[key] = data;
                break;
        }
    }
}

export default CrossValidator;
