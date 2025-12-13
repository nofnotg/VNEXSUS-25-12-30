/**
 * VNEXSUS Confidence Scorer (T-403)
 * 
 * 각 추출 필드에 신뢰도 점수를 부여합니다.
 * 80% 미만 필드는 UI에서 사용자 검토를 유도합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class ConfidenceScorer {
    constructor(options = {}) {
        this.thresholds = {
            high: options.highThreshold || 80,    // 높은 신뢰도 (녹색)
            medium: options.mediumThreshold || 60, // 중간 신뢰도 (노란색)
            low: options.lowThreshold || 40       // 낮은 신뢰도 (빨간색)
        };

        // 필드별 기본 가중치
        this.fieldWeights = {
            hospitalName: { base: 70, fuzzyBonus: 20, dbMatchBonus: 10 },
            diagnosis: { base: 60, icdPresent: 20, fuzzyBonus: 20 },
            icdCode: { base: 50, formatValid: 20, dbMatchBonus: 30 },
            date: { base: 80, formatValid: 10, rangeValid: 10 },
            treatment: { base: 60, structured: 20, complete: 20 },
            insurance: { base: 70, companyMatch: 15, dateValid: 15 }
        };
    }

    /**
     * 병원명 신뢰도 계산
     * @param {object} hospital - { name, fuzzyMatch, dbMatch }
     * @returns {object} { confidence, level, reason }
     */
    scoreHospital(hospital) {
        if (!hospital || !hospital.name) {
            return this.createScore(0, 'missing', '병원명 누락');
        }

        let score = this.fieldWeights.hospitalName.base;
        const reasons = [];

        // Fuzzy 매칭 보너스
        if (hospital.fuzzyMatch && hospital.fuzzyMatch.similarity >= 0.7) {
            score += this.fieldWeights.hospitalName.fuzzyBonus;
            reasons.push('사전 매칭 성공');
        } else {
            reasons.push('사전에 없는 병원명');
        }

        // DB 검증 보너스
        if (hospital.dbMatch) {
            score += this.fieldWeights.hospitalName.dbMatchBonus;
            reasons.push('심평원 DB 확인');
        }

        return this.createScore(Math.min(score, 100), this.getLevel(score), reasons.join(', '));
    }

    /**
     * 진단명 신뢰도 계산
     * @param {object} diagnosis - { name, icdCode, fuzzyMatch }
     * @returns {object} { confidence, level, reason }
     */
    scoreDiagnosis(diagnosis) {
        if (!diagnosis || !diagnosis.name) {
            return this.createScore(0, 'missing', '진단명 누락');
        }

        let score = this.fieldWeights.diagnosis.base;
        const reasons = [];

        // ICD 코드 존재 여부
        if (diagnosis.icdCode) {
            score += this.fieldWeights.diagnosis.icdPresent;
            reasons.push('ICD 코드 포함');
        } else {
            reasons.push('ICD 코드 누락');
        }

        // Fuzzy 매칭 보너스
        if (diagnosis.fuzzyMatch && diagnosis.fuzzyMatch.similarity >= 0.7) {
            score += this.fieldWeights.diagnosis.fuzzyBonus;
            reasons.push('표준 진단명 매칭');
        }

        return this.createScore(Math.min(score, 100), this.getLevel(score), reasons.join(', '));
    }

    /**
     * ICD 코드 신뢰도 계산
     * @param {object} icd - { code, formatValid, dbMatch }
     * @returns {object} { confidence, level, reason }
     */
    scoreICD(icd) {
        if (!icd || !icd.code) {
            return this.createScore(0, 'missing', 'ICD 코드 누락');
        }

        let score = this.fieldWeights.icdCode.base;
        const reasons = [];

        // 형식 유효성
        if (icd.formatValid) {
            score += this.fieldWeights.icdCode.formatValid;
            reasons.push('형식 유효');
        } else {
            reasons.push('형식 오류');
        }

        // DB 검증 보너스
        if (icd.dbMatch) {
            score += this.fieldWeights.icdCode.dbMatchBonus;
            reasons.push('WHO ICD-10 확인');
        } else {
            reasons.push('DB 미확인');
        }

        return this.createScore(Math.min(score, 100), this.getLevel(score), reasons.join(', '));
    }

    /**
     * 날짜 신뢰도 계산
     * @param {object} date - { value, formatValid, rangeValid }
     * @returns {object} { confidence, level, reason }
     */
    scoreDate(date) {
        if (!date || !date.value) {
            return this.createScore(0, 'missing', '날짜 누락');
        }

        let score = this.fieldWeights.date.base;
        const reasons = [];

        // 형식 유효성
        if (date.formatValid) {
            score += this.fieldWeights.date.formatValid;
            reasons.push('형식 유효');
        } else {
            reasons.push('형식 불명확');
        }

        // 범위 유효성 (미래 날짜 체크)
        if (date.rangeValid !== false) {
            score += this.fieldWeights.date.rangeValid;
        } else {
            score -= 20;
            reasons.push('미래 날짜 감지');
        }

        return this.createScore(Math.min(score, 100), this.getLevel(score), reasons.join(', '));
    }

    /**
     * 전체 보고서 신뢰도 계산
     * @param {object} report - 전체 보고서 객체
     * @returns {object} { overall, fields, requiresReview }
     */
    scoreReport(report) {
        const fieldScores = {};
        const requiresReview = [];

        // 각 필드 점수 계산
        if (report.hospital) {
            fieldScores.hospital = this.scoreHospital(report.hospital);
            if (fieldScores.hospital.confidence < this.thresholds.high) {
                requiresReview.push({ field: 'hospital', ...fieldScores.hospital });
            }
        }

        if (report.diagnosis) {
            fieldScores.diagnosis = this.scoreDiagnosis(report.diagnosis);
            if (fieldScores.diagnosis.confidence < this.thresholds.high) {
                requiresReview.push({ field: 'diagnosis', ...fieldScores.diagnosis });
            }
        }

        if (report.icdCode) {
            fieldScores.icdCode = this.scoreICD(report.icdCode);
            if (fieldScores.icdCode.confidence < this.thresholds.high) {
                requiresReview.push({ field: 'icdCode', ...fieldScores.icdCode });
            }
        }

        if (report.date) {
            fieldScores.date = this.scoreDate(report.date);
            if (fieldScores.date.confidence < this.thresholds.high) {
                requiresReview.push({ field: 'date', ...fieldScores.date });
            }
        }

        // 전체 점수 계산 (가중 평균)
        const scores = Object.values(fieldScores).map(f => f.confidence);
        const overall = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

        return {
            overall,
            level: this.getLevel(overall),
            fields: fieldScores,
            requiresReview,
            reviewCount: requiresReview.length,
            isComplete: requiresReview.length === 0
        };
    }

    /**
     * 신뢰도 수준 결정
     */
    getLevel(score) {
        if (score >= this.thresholds.high) return 'high';
        if (score >= this.thresholds.medium) return 'medium';
        if (score >= this.thresholds.low) return 'low';
        return 'critical';
    }

    /**
     * 점수 객체 생성
     */
    createScore(confidence, level, reason) {
        return {
            confidence,
            level,
            reason,
            color: this.getColor(level),
            icon: this.getIcon(level)
        };
    }

    /**
     * 수준별 색상
     */
    getColor(level) {
        const colors = {
            high: '#10b981',      // 녹색
            medium: '#f59e0b',    // 노란색
            low: '#f97316',       // 주황색
            critical: '#ef4444', // 빨간색
            missing: '#94a3b8'   // 회색
        };
        return colors[level] || colors.missing;
    }

    /**
     * 수준별 아이콘
     */
    getIcon(level) {
        const icons = {
            high: '✓',
            medium: '⚠',
            low: '⚡',
            critical: '✗',
            missing: '?'
        };
        return icons[level] || icons.missing;
    }
}

export default ConfidenceScorer;
