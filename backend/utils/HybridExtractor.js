/**
 * VNEXSUS Hybrid Extractor
 * 
 * Quick Wins 모듈들을 통합한 하이브리드 추출기입니다.
 * RegexPatterns + FuzzyMatcher + CrossValidator + ConfidenceScorer를 조합하여
 * 정확도를 극대화합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

const RegexPatterns = require('./RegexPatterns');
const FuzzyMatcher = require('./FuzzyMatcher');
const CrossValidator = require('./CrossValidator');
const ConfidenceScorer = require('./ConfidenceScorer');

class HybridExtractor {
    constructor(options = {}) {
        this.regex = new RegexPatterns();
        this.fuzzy = new FuzzyMatcher(options.fuzzy || {});
        this.validator = new CrossValidator();
        this.scorer = new ConfidenceScorer(options.scoring || {});

        this.debug = options.debug || false;
    }

    /**
     * 텍스트에서 모든 정보를 통합 추출합니다.
     * @param {string} text - 입력 텍스트 (OCR 결과)
     * @returns {object} 추출 결과
     */
    extract(text) {
        if (!text || typeof text !== 'string') {
            return this.createEmptyResult('입력 텍스트 없음');
        }

        const startTime = Date.now();
        const result = {
            success: true,
            extractedAt: new Date().toISOString(),
            fields: {},
            validation: {},
            confidence: {},
            summary: {}
        };

        try {
            // 1. 정규식 기반 추출
            const dates = this.regex.extractDates(text);
            const durations = this.regex.extractDurations(text);
            const hospitals = this.regex.extractHospitals(text);
            const icdCodes = this.regex.extractICDCodes(text);
            const diagnoses = this.regex.extractDiagnoses(text);

            result.fields = { dates, durations, hospitals, icdCodes, diagnoses };

            // 2. Fuzzy 매칭으로 병원명/진단명 보정
            result.fields.hospitalsMatched = hospitals.map(h => ({
                ...h,
                fuzzyMatch: this.fuzzy.matchHospital(h.name)
            }));

            result.fields.diagnosesMatched = diagnoses.map(d => ({
                ...d,
                fuzzyMatch: this.fuzzy.matchDiagnosis(d.diagnosis)
            }));

            // 3. Cross-Validation (DB 검증)
            result.validation = {
                hospitals: result.fields.hospitalsMatched.map(h =>
                    this.validator.validateHospital(h.fuzzyMatch?.matched || h.name)
                ),
                icdCodes: icdCodes.map(c => this.validator.validateICD(c.code)),
                dates: dates.map(d => this.validator.validateDateRange(d.normalized))
            };

            // 4. Confidence Scoring
            result.confidence = this.calculateOverallConfidence(result);

            // 5. Summary 생성
            result.summary = this.generateSummary(result);

            result.processingTimeMs = Date.now() - startTime;

        } catch (error) {
            result.success = false;
            result.error = error.message;
            if (this.debug) {
                console.error('[HybridExtractor] Error:', error);
            }
        }

        return result;
    }

    /**
     * 전체 신뢰도 계산
     */
    calculateOverallConfidence(result) {
        const scores = [];

        // 병원 신뢰도
        if (result.validation.hospitals && result.validation.hospitals.length > 0) {
            const avgHospital = result.validation.hospitals.reduce((sum, h) => sum + h.confidence, 0)
                / result.validation.hospitals.length;
            scores.push({ field: 'hospitals', score: avgHospital });
        }

        // ICD 신뢰도
        if (result.validation.icdCodes && result.validation.icdCodes.length > 0) {
            const avgICD = result.validation.icdCodes.reduce((sum, c) => sum + c.confidence, 0)
                / result.validation.icdCodes.length;
            scores.push({ field: 'icdCodes', score: avgICD });
        }

        // 날짜 신뢰도
        if (result.validation.dates && result.validation.dates.length > 0) {
            const avgDate = result.validation.dates.reduce((sum, d) => sum + d.confidence, 0)
                / result.validation.dates.length;
            scores.push({ field: 'dates', score: avgDate });
        }

        const overall = scores.length > 0
            ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
            : 0;

        return {
            overall,
            level: this.scorer.getLevel(overall),
            fields: scores,
            requiresReview: overall < 80
        };
    }

    /**
     * 추출 결과 요약 생성
     */
    generateSummary(result) {
        const fields = result.fields;
        const validation = result.validation;

        return {
            totalDates: fields.dates?.length || 0,
            totalHospitals: fields.hospitals?.length || 0,
            totalICDCodes: fields.icdCodes?.length || 0,
            totalDiagnoses: fields.diagnoses?.length || 0,

            validatedHospitals: validation.hospitals?.filter(h => h.confidence >= 70).length || 0,
            validatedICDCodes: validation.icdCodes?.filter(c => c.confidence >= 70).length || 0,
            validatedDates: validation.dates?.filter(d => d.valid).length || 0,

            overallConfidence: result.confidence?.overall || 0,
            requiresReview: result.confidence?.requiresReview || true
        };
    }

    /**
     * 빈 결과 생성
     */
    createEmptyResult(reason) {
        return {
            success: false,
            error: reason,
            extractedAt: new Date().toISOString(),
            fields: {},
            validation: {},
            confidence: { overall: 0, level: 'missing', requiresReview: true },
            summary: {}
        };
    }

    /**
     * 특정 필드만 추출 (경량화)
     */
    extractField(text, fieldType) {
        switch (fieldType) {
            case 'dates':
                return this.regex.extractDates(text);
            case 'hospitals':
                return this.regex.extractHospitals(text).map(h => ({
                    ...h,
                    fuzzyMatch: this.fuzzy.matchHospital(h.name),
                    validation: this.validator.validateHospital(h.name)
                }));
            case 'icdCodes':
                return this.regex.extractICDCodes(text).map(c => ({
                    ...c,
                    validation: this.validator.validateICD(c.code)
                }));
            case 'diagnoses':
                return this.regex.extractDiagnoses(text).map(d => ({
                    ...d,
                    fuzzyMatch: this.fuzzy.matchDiagnosis(d.diagnosis)
                }));
            default:
                return [];
        }
    }

    /**
     * 사전에 새로운 항목 추가 (피드백 루프용)
     */
    addToDictionary(type, name, data) {
        if (type === 'hospital') {
            this.fuzzy.addToDictionary('hospital', name);
            this.validator.addToDatabase('hospital', name, data || {});
        } else if (type === 'diagnosis') {
            this.fuzzy.addToDictionary('diagnosis', name, data);
        } else if (type === 'icd') {
            this.validator.addToDatabase('icd', name, data);
        }
    }

    /**
     * 현재 사전 내보내기
     */
    exportDictionaries() {
        return {
            fuzzy: this.fuzzy.exportDictionary(),
            exportedAt: new Date().toISOString()
        };
    }
}

module.exports = HybridExtractor;
