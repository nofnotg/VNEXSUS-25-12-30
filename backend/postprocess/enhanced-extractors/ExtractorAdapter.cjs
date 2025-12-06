/**
 * Extractor Adapter Module
 * 
 * 목적: MedicalEntityExtractor와 nineItemReportGenerator 추출기 연결
 * 
 * 어댑터 패턴을 사용하여 기존 MedicalEntityExtractor의 강력한 추출 로직을
 * nineItemReportGenerator의 기존 인터페이스와 호환되도록 변환합니다.
 * 
 * 핵심 전략:
 * 1. 기존 코드 수정 없이 새 모듈로 기능 확장
 * 2. useEnhanced 플래그로 기존/새 추출기 전환
 * 3. 기존 인터페이스 유지로 무중단 배포 가능
 */

const path = require('path');
const NaNGuard = require('./NaNGuard.cjs');

// MedicalEntityExtractor 동적 로드 (ES Module 호환)
// 주의: medicalEntityExtractor.js는 ES module이므로 CommonJS에서 직접 로드 불가
// 나중에 ES module 통합 시 활성화될 수 있음
let MedicalEntityExtractor = null;

// CommonJS 환경에서 ES module 로드 시도 (fallback으로 null 유지)
// 실제 환경에서는 ES module wrapper를 통해 로드하거나 
// 또는 medicalEntityExtractorCompat.cjs 래퍼 생성 필요
try {
    // createRequire를 사용한 ES module 로드 시도
    const { createRequire } = require('module');
    const requireForESM = createRequire(require.resolve('../medicalEntityExtractor.js'));
    // ES default export가 아닌 경우를 위한 처리
    const imported = requireForESM('../medicalEntityExtractor.js');
    MedicalEntityExtractor = imported.default || imported.MedicalEntityExtractor || imported;
} catch (e) {
    // ES module 로드 실패 - 레거시 모드로 계속 동작
    console.warn('⚠️ MedicalEntityExtractor 로드 실패 - 레거시 추출기 사용:', e.message);
    MedicalEntityExtractor = null;
}

class ExtractorAdapter {
    constructor(options = {}) {
        this.options = {
            useEnhanced: options.useEnhanced ?? true,
            fallbackToLegacy: options.fallbackToLegacy ?? true,
            enableNaNGuard: options.enableNaNGuard ?? true,
            debug: options.debug ?? false,
            ...options
        };

        // MedicalEntityExtractor 인스턴스
        this.medicalEntityExtractor = MedicalEntityExtractor ?
            new MedicalEntityExtractor() : null;

        if (this.options.debug) {
            console.log('🔧 ExtractorAdapter 초기화:', {
                useEnhanced: this.options.useEnhanced,
                medicalExtractorAvailable: !!this.medicalEntityExtractor
            });
        }
    }

    /**
     * genes 배열을 텍스트로 변환
     * @param {Array} genes - DNA gene 배열
     * @returns {string} 결합된 텍스트
     */
    genesToText(genes) {
        if (!Array.isArray(genes)) return '';
        return genes
            .map(gene => gene.content || gene.raw_text || '')
            .filter(text => text.length > 0)
            .join('\n');
    }

    /**
     * 진단 추출 (기존 DiagnosisExtractor 인터페이스 호환)
     * @param {Array} genes - DNA gene 배열
     * @param {Object} causalNetwork - 인과 네트워크
     * @param {Object} patientInfo - 환자 정보
     * @returns {Promise<Object>} 추출 결과
     */
    async extractDiagnosis(genes, causalNetwork, patientInfo) {
        try {
            if (!this.options.useEnhanced || !this.medicalEntityExtractor) {
                return this._legacyExtractDiagnosis(genes);
            }

            const text = this.genesToText(genes);
            const diseases = await this.medicalEntityExtractor.extractDiseases(text);

            // nineItemReportGenerator 형식으로 변환
            const formatted = this._formatDiseasesForNineItem(diseases);

            if (this.options.enableNaNGuard) {
                return NaNGuard.cleanObject(formatted);
            }

            return formatted;
        } catch (error) {
            console.error('❌ 진단 추출 오류:', error.message);
            if (this.options.fallbackToLegacy) {
                return this._legacyExtractDiagnosis(genes);
            }
            throw error;
        }
    }

    /**
     * 의료 날짜 추출 (기존 VisitDateExtractor 인터페이스 호환)
     * @param {Array} genes - DNA gene 배열
     * @param {Object} causalNetwork - 인과 네트워크
     * @param {Object} patientInfo - 환자 정보
     * @returns {Promise<Object>} 추출 결과
     */
    async extractVisitDates(genes, causalNetwork, patientInfo) {
        try {
            if (!this.options.useEnhanced || !this.medicalEntityExtractor) {
                return this._legacyExtractVisitDates(genes);
            }

            const text = this.genesToText(genes);
            const dates = await this.medicalEntityExtractor.extractMedicalDates(text);

            // nineItemReportGenerator 형식으로 변환
            const formatted = this._formatDatesForNineItem(dates);

            if (this.options.enableNaNGuard) {
                return NaNGuard.cleanObject(formatted);
            }

            return formatted;
        } catch (error) {
            console.error('❌ 날짜 추출 오류:', error.message);
            if (this.options.fallbackToLegacy) {
                return this._legacyExtractVisitDates(genes);
            }
            throw error;
        }
    }

    /**
     * 의료기관 추출 (강화된 병원명 추출)
     * @param {Array} genes - DNA gene 배열
     * @returns {Promise<Object>} 추출 결과
     */
    async extractFacilities(genes) {
        try {
            if (!this.options.useEnhanced || !this.medicalEntityExtractor) {
                return { facilities: [], summary: '의료기관 정보를 찾을 수 없습니다.' };
            }

            const text = this.genesToText(genes);
            const facilities = await this.medicalEntityExtractor.extractFacilities(text);

            // 노이즈 필터링 적용
            const cleaned = this._filterFacilityNoise(facilities);

            const formatted = {
                summary: cleaned.length > 0 ?
                    `의료기관 ${cleaned.length}곳: ${cleaned.slice(0, 3).map(f => f.name).join(', ')}` :
                    '의료기관 정보를 찾을 수 없습니다.',
                facilities: cleaned,
                confidence: cleaned.length > 0 ?
                    cleaned.reduce((sum, f) => sum + (f.confidence || 0.5), 0) / cleaned.length : 0
            };

            return this.options.enableNaNGuard ? NaNGuard.cleanObject(formatted) : formatted;
        } catch (error) {
            console.error('❌ 의료기관 추출 오류:', error.message);
            return { facilities: [], summary: '의료기관 정보를 찾을 수 없습니다.', confidence: 0 };
        }
    }

    /**
     * 검사 결과 추출
     * @param {Array} genes - DNA gene 배열
     * @returns {Promise<Object>} 추출 결과
     */
    async extractTests(genes) {
        try {
            if (!this.options.useEnhanced || !this.medicalEntityExtractor) {
                return this._legacyExtractTests(genes);
            }

            const text = this.genesToText(genes);
            const tests = await this.medicalEntityExtractor.extractTests(text);

            const formatted = {
                summary: tests.length > 0 ?
                    `검사 ${tests.length}건: ${tests.slice(0, 5).map(t => t.name).join(', ')}` :
                    '검사내용 정보를 찾을 수 없습니다.',
                examinations: tests.map(t => ({
                    examination: t.name,
                    originalText: t.originalText || '',
                    category: t.category || '',
                    confidence: t.confidence || 0.7
                })),
                confidence: tests.length > 0 ?
                    tests.reduce((sum, t) => sum + (t.confidence || 0.7), 0) / tests.length : 0
            };

            return this.options.enableNaNGuard ? NaNGuard.cleanObject(formatted) : formatted;
        } catch (error) {
            console.error('❌ 검사 추출 오류:', error.message);
            return this._legacyExtractTests(genes);
        }
    }

    /**
     * 모든 추출기를 nineItemReportGenerator 형식으로 제공
     * @returns {Object} 추출기 객체
     */
    getExtractors() {
        const adapter = this;

        return {
            visitDates: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter.extractVisitDates(genes, causalNetwork, patientInfo)
            },
            diagnoses: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter.extractDiagnosis(genes, causalNetwork, patientInfo)
            },
            examinations: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter.extractTests(genes)
            },
            // 나머지 추출기들은 레거시 로직 유지 (점진적 마이그레이션)
            visitReasons: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter._legacyExtractVisitReasons(genes)
            },
            admissionPeriods: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter._legacyExtractAdmissionPeriods(genes)
            },
            treatments: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter._legacyExtractTreatments(genes)
            },
            pastHistory: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter._legacyExtractPastHistory(genes)
            },
            doctorOpinion: {
                extract: (genes, causalNetwork, patientInfo) =>
                    adapter._legacyExtractDoctorOpinion(genes)
            }
        };
    }

    // ============ 내부 변환 메서드 ============

    /**
     * MedicalEntityExtractor 질병 결과를 nineItem 형식으로 변환
     */
    _formatDiseasesForNineItem(diseases) {
        if (!diseases || diseases.length === 0) {
            return {
                summary: '진단병명 정보를 찾을 수 없습니다.',
                items: [],
                details: [],
                confidence: 0
            };
        }

        const items = diseases.map(d => {
            // ICD 코드가 있으면 [ICD코드/한글-영어] 형식으로 포맷
            if (d.icd10) {
                return `[${d.icd10}/${d.name}]`;
            }
            return d.name;
        });

        return {
            summary: `진단명 ${items.length}건:\n${items.slice(0, 5).join('\n')}`,
            items: items,
            details: diseases.map(d => ({
                diagnosis: d.name,
                icd10: d.icd10 || '',
                category: d.category || '',
                severity: d.severity || '',
                originalText: d.originalText || '',
                confidence: d.confidence || 0.8
            })),
            confidence: diseases.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / diseases.length
        };
    }

    /**
     * MedicalEntityExtractor 날짜 결과를 nineItem 형식으로 변환
     */
    _formatDatesForNineItem(dates) {
        if (!dates || dates.length === 0) {
            return {
                summary: '내원일 정보를 찾을 수 없습니다.',
                dates: [],
                details: [],
                confidence: 0
            };
        }

        const uniqueDates = [...new Set(dates.map(d => d.date))].sort();

        return {
            summary: `총 ${uniqueDates.length}회 내원\n주요 내원일: ${uniqueDates.slice(0, 5).join(', ')}`,
            dates: uniqueDates,
            details: dates.slice(0, 10).map(d => ({
                date: d.date,
                type: d.type || 'visit',
                context: d.originalText || '',
                confidence: d.confidence || 0.8
            })),
            confidence: dates.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / dates.length
        };
    }

    /**
     * 의료기관명에서 노이즈 필터링
     */
    _filterFacilityNoise(facilities) {
        const noisePatterns = [
            /=+\s*파일:/gi,           // 파일명 마커
            /\d+\/\d+\s*빈경환/gi,    // 페이지 번호
            /i\?[?￢￡]+/gi,          // 깨진 문자
            /DATE|PROGRESS NOTE|SIGN/gi,  // OCR 아티팩트
            /의무기록사본/gi,
            /표지제외/gi,
            /원본대조필/gi
        ];

        return facilities.filter(f => {
            const name = f.name || '';
            // 병원 관련 키워드가 있어야 함
            const hasHospitalKeyword = /병원|의원|클리닉|센터|대학교..*병원/.test(name);
            // 노이즈 패턴 검사
            const hasNoise = noisePatterns.some(pattern => pattern.test(name));
            // 너무 긴 텍스트 제외 (병원명은 보통 50자 이내)
            const tooLong = name.length > 50;

            return hasHospitalKeyword && !hasNoise && !tooLong;
        });
    }

    // ============ 레거시 추출 메서드 (폴백용) ============

    _legacyExtractDiagnosis(genes) {
        const diagnoses = [];
        const diagnosisKeywords = ['진단', '병명', '질환', '소견', 'Dx', 'diagnosis'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            diagnosisKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    diagnoses.push({
                        diagnosis: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });
        });

        const uniqueDiagnoses = [...new Set(diagnoses.map(d => d.diagnosis))];
        return {
            summary: uniqueDiagnoses.length > 0 ?
                `진단명 ${uniqueDiagnoses.length}건:\n${uniqueDiagnoses.slice(0, 5).join('\n')}` :
                '진단병명 정보를 찾을 수 없습니다.',
            items: uniqueDiagnoses,
            details: diagnoses.slice(0, 10),
            confidence: diagnoses.length > 0 ?
                diagnoses.reduce((sum, d) => sum + d.confidence, 0) / diagnoses.length : 0
        };
    }

    _legacyExtractVisitDates(genes) {
        const visitDates = [];
        const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4}/g;

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            const matches = content.match(datePattern);
            if (matches) {
                matches.forEach(match => {
                    visitDates.push({
                        date: match,
                        context: content.substring(0, 100),
                        confidence: gene.confidence || 0.7
                    });
                });
            }
        });

        const uniqueDates = [...new Set(visitDates.map(d => d.date))].sort();
        return {
            summary: uniqueDates.length > 0 ?
                `총 ${uniqueDates.length}회 내원\n주요 내원일: ${uniqueDates.slice(0, 5).join(', ')}` :
                '내원일 정보를 찾을 수 없습니다.',
            dates: uniqueDates,
            details: visitDates.slice(0, 10),
            confidence: visitDates.length > 0 ?
                visitDates.reduce((sum, d) => sum + d.confidence, 0) / visitDates.length : 0
        };
    }

    _legacyExtractTests(genes) {
        const examinations = [];
        const examKeywords = ['검사', '촬영', 'CT', 'MRI', 'X-ray', '혈액검사', '소변검사', '결과'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            examKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    examinations.push({
                        examination: content,
                        keyword,
                        confidence: gene.confidence || 0.8
                    });
                }
            });
        });

        return {
            summary: examinations.length > 0 ?
                `검사 기록 ${examinations.length}건 확인` :
                '검사내용 정보를 찾을 수 없습니다.',
            examinations: examinations.slice(0, 10),
            confidence: examinations.length > 0 ?
                examinations.reduce((sum, e) => sum + e.confidence, 0) / examinations.length : 0
        };
    }

    _legacyExtractVisitReasons(genes) {
        const reasons = [];
        const reasonKeywords = ['주증상', '호소', '내원경위', '응급', '통증', '불편', '증상'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            reasonKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    reasons.push({ reason: content, keyword, confidence: gene.confidence || 0.7 });
                }
            });
        });

        return {
            summary: reasons.length > 0 ?
                reasons.slice(0, 3).map(r => r.reason.substring(0, 100)).join('\n') :
                '내원경위 정보를 찾을 수 없습니다.',
            reasons: reasons.slice(0, 5),
            confidence: reasons.length > 0 ?
                reasons.reduce((sum, r) => sum + r.confidence, 0) / reasons.length : 0
        };
    }

    _legacyExtractAdmissionPeriods(genes) {
        const admissions = [];
        const admissionKeywords = ['입원', '퇴원', '병동', '입실', '전실'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            admissionKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    admissions.push({ period: content, keyword, confidence: gene.confidence || 0.7 });
                }
            });
        });

        return {
            summary: admissions.length > 0 ?
                `입퇴원 기록 ${admissions.length}건 확인` :
                '입퇴원 정보를 찾을 수 없습니다.',
            periods: admissions.slice(0, 5),
            confidence: admissions.length > 0 ?
                admissions.reduce((sum, a) => sum + a.confidence, 0) / admissions.length : 0
        };
    }

    _legacyExtractTreatments(genes) {
        const treatments = [];
        const treatmentKeywords = ['치료', '처방', '투약', '수술', '시술', '요법', 'Tx', 'treatment'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            treatmentKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    treatments.push({ treatment: content, keyword, confidence: gene.confidence || 0.8 });
                }
            });
        });

        return {
            summary: treatments.length > 0 ?
                `치료 기록 ${treatments.length}건:\n${treatments.slice(0, 5).map(t => t.treatment.substring(0, 80)).join('\n')}` :
                '치료사항 정보를 찾을 수 없습니다.',
            treatments: treatments.slice(0, 10),
            confidence: treatments.length > 0 ?
                treatments.reduce((sum, t) => sum + t.confidence, 0) / treatments.length : 0
        };
    }

    _legacyExtractPastHistory(genes) {
        const histories = [];
        const historyKeywords = ['과거력', '과거병력', '병력', '기왕력', '가족력'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            historyKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    histories.push({ history: content, keyword, confidence: gene.confidence || 0.7 });
                }
            });
        });

        return {
            summary: histories.length > 0 ?
                histories.slice(0, 3).map(h => h.history.substring(0, 100)).join('\n') :
                '과거병력 정보를 찾을 수 없습니다.',
            histories: histories.slice(0, 5),
            confidence: histories.length > 0 ?
                histories.reduce((sum, h) => sum + h.confidence, 0) / histories.length : 0
        };
    }

    _legacyExtractDoctorOpinion(genes) {
        const opinions = [];
        const opinionKeywords = ['소견', '의견', '판정', '결론', '진단의견', '의사소견'];

        genes.forEach(gene => {
            const content = gene.content || gene.raw_text || '';
            opinionKeywords.forEach(keyword => {
                if (content.includes(keyword)) {
                    opinions.push({ opinion: content, keyword, confidence: gene.confidence || 0.8 });
                }
            });
        });

        return {
            summary: opinions.length > 0 ?
                opinions.slice(0, 2).map(o => o.opinion.substring(0, 150)).join('\n') :
                '주치의 소견 정보를 찾을 수 없습니다.',
            opinions: opinions.slice(0, 5),
            confidence: opinions.length > 0 ?
                opinions.reduce((sum, o) => sum + o.confidence, 0) / opinions.length : 0
        };
    }
}

module.exports = ExtractorAdapter;
