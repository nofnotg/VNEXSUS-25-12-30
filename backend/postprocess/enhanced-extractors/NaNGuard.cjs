/**
 * NaN Guard Utility Module
 * 
 * 목적: 보고서 생성 시 NaN/null/undefined 값 방어
 * 
 * 모든 출력 데이터에서 NaN 값을 안전하게 처리하여
 * 최종 보고서 품질을 보장합니다.
 */

class NaNGuard {
    /**
     * 단일 값 정화
     * @param {*} value - 검사할 값
     * @param {*} defaultValue - 기본값 (기본: '')
     * @returns {*} 정화된 값
     */
    static clean(value, defaultValue = '') {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'number' && isNaN(value)) return defaultValue;
        if (typeof value === 'string' && (value === 'NaN' || value === 'undefined' || value === 'null')) {
            return defaultValue;
        }
        return value;
    }

    /**
     * 문자열 값 정화 (항상 문자열 반환)
     */
    static cleanString(value, defaultValue = '') {
        const cleaned = this.clean(value, defaultValue);
        return String(cleaned);
    }

    /**
     * 숫자 값 정화 (항상 숫자 반환)
     */
    static cleanNumber(value, defaultValue = 0) {
        if (value === undefined || value === null) return defaultValue;
        const num = Number(value);
        if (isNaN(num)) return defaultValue;
        return num;
    }

    /**
     * 배열 정화 (각 요소 정화)
     */
    static cleanArray(arr, defaultValue = '') {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
            if (typeof item === 'object' && item !== null) {
                return this.cleanObject(item);
            }
            return this.clean(item, defaultValue);
        });
    }

    /**
     * 객체 정화 (재귀적으로 모든 필드 정화)
     */
    static cleanObject(obj, defaults = {}) {
        if (obj === null || obj === undefined) return {};
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return this.cleanArray(obj);

        const cleaned = {};

        for (const [key, value] of Object.entries(obj)) {
            const defaultValue = defaults[key] !== undefined ? defaults[key] : '';

            if (Array.isArray(value)) {
                cleaned[key] = this.cleanArray(value);
            } else if (typeof value === 'object' && value !== null) {
                cleaned[key] = this.cleanObject(value, defaults[key] || {});
            } else {
                cleaned[key] = this.clean(value, defaultValue);
            }
        }

        return cleaned;
    }

    /**
     * 의료 기록 객체 정화 (특화된 필드 처리)
     * @param {Object} record - 의료 기록 객체
     * @returns {Object} 정화된 의료 기록
     */
    static cleanMedicalRecord(record) {
        const defaults = {
            date: '',
            visitDate: '',
            hospital: '미확인 의료기관',
            diagnosis: '미확인',
            reason: '',
            treatment: '',
            notes: '',
            confidence: 0
        };

        // 기본값 먼저 적용 후 실제 값으로 오버라이드
        const merged = { ...defaults };

        if (record && typeof record === 'object') {
            for (const [key, value] of Object.entries(record)) {
                merged[key] = this.clean(value, defaults[key] !== undefined ? defaults[key] : '');
            }
        }

        return merged;
    }

    /**
     * 진단 정보 정화
     */
    static cleanDiagnosis(diagnosis) {
        const defaults = {
            name: '미확인',
            icd10: '',
            category: '',
            originalText: '',
            confidence: 0
        };

        const merged = { ...defaults };

        if (diagnosis && typeof diagnosis === 'object') {
            for (const [key, value] of Object.entries(diagnosis)) {
                merged[key] = this.clean(value, defaults[key] !== undefined ? defaults[key] : '');
            }
        }

        return merged;
    }

    /**
     * 보고서 전체 정화
     */
    static cleanReport(report) {
        if (!report) return {};

        const cleaned = {
            header: this.cleanObject(report.header || {}, {
                patientName: '',
                birthDate: '',
                registrationNumber: ''
            }),
            insuranceConditions: this.cleanArray(report.insuranceConditions || []),
            insuranceHistory: this.cleanArray(report.insuranceHistory || []),
            medicalRecords: (report.medicalRecords || []).map(r => this.cleanMedicalRecord(r)),
            progressReport: this.cleanString(report.progressReport, ''),
            summary: this.cleanObject(report.summary || {}),
            validation: this.cleanObject(report.validation || {})
        };

        return cleaned;
    }

    /**
     * 깊은 NaN 검사 (재귀적)
     */
    static findNaNLocations(obj, path = '') {
        const locations = [];

        if (obj === null || obj === undefined) return locations;

        if (typeof obj === 'number' && isNaN(obj)) {
            locations.push(path || 'root');
            return locations;
        }

        if (typeof obj === 'string' && obj === 'NaN') {
            locations.push(path || 'root');
            return locations;
        }

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                locations.push(...this.findNaNLocations(item, `${path}[${index}]`));
            });
        } else if (typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                const newPath = path ? `${path}.${key}` : key;
                locations.push(...this.findNaNLocations(value, newPath));
            }
        }

        return locations;
    }

    /**
     * NaN 존재 여부 빠른 검사
     */
    static hasNaN(obj) {
        return this.findNaNLocations(obj).length > 0;
    }
}

module.exports = NaNGuard;
