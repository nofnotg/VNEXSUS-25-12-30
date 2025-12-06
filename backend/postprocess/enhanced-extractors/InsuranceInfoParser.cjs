/**
 * Insurance Information Parser
 * 
 * 목적: 보험정보 구조화 추출 (텍스트 → 구조화된 객체)
 * 
 * 핵심 기능:
 * 1. 보험 가입일 추출
 * 2. 보험 유형 분류 (생명/손해/건강)
 * 3. 보장 내용 파싱
 * 4. 고지의무 관련 정보 추출
 */

const NaNGuard = require('./NaNGuard.cjs');

class InsuranceInfoParser {
    constructor(options = {}) {
        this.options = {
            debug: options.debug ?? false,
            ...options
        };

        // 보험 유형 패턴
        this.insuranceTypePatterns = {
            life: ['생명보험', '종신보험', '정기보험', '변액보험', '저축성보험'],
            health: ['건강보험', '실손보험', '실손의료보험', '의료실비', '의료비보험'],
            accident: ['상해보험', '상해사망', '재해보험'],
            cancer: ['암보험', '암진단', '암치료'],
            pension: ['연금보험', '연금저축', '퇴직연금'],
            property: ['손해보험', '자동차보험', '화재보험', '배상책임']
        };

        // 보험 관련 키워드
        this.insuranceKeywords = [
            '보험', '보장', '가입', '계약', '피보험자', '보험수익자',
            '보험료', '납입', '만기', '해약', '청구', '지급',
            '특약', '주계약', '담보'
        ];

        // 날짜 패턴 (가입일, 만기일 등)
        this.datePatterns = [
            /가입일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
            /계약일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
            /효력발생일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
            /만기일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
            /(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*가입/gi
        ];

        // 금액 패턴
        this.amountPatterns = [
            /보험료[:\s]*([\d,]+)\s*원/gi,
            /보장금액[:\s]*([\d,]+)\s*원/gi,
            /가입금액[:\s]*([\d,]+)\s*원/gi,
            /([\d,]+)\s*원\s*(?:보장|가입)/gi
        ];

        // 고지의무 관련 키워드  
        this.disclosureKeywords = [
            '고지', '고지의무', '계약전 알릴의무', '청약서',
            '건강고지', '직업고지', '과거병력'
        ];
    }

    /**
     * 보험정보 추출 (메인 메서드)
     * @param {Array} genes - DNA gene 배열
     * @param {Object} causalNetwork - 인과 네트워크
     * @param {Object} patientInfo - 환자/피보험자 정보
     * @returns {Promise<Object>} 구조화된 보험정보
     */
    async extract(genes, causalNetwork = {}, patientInfo = {}) {
        const text = this._genesToText(genes);

        const result = {
            // 보험 계약 정보
            contracts: this._extractContracts(text),

            // 보험 유형
            insuranceTypes: this._identifyInsuranceTypes(text),

            // 날짜 정보
            dates: {
                enrollmentDate: this._extractEnrollmentDate(text),
                expiryDate: this._extractExpiryDate(text),
                allDates: this._extractAllInsuranceDates(text)
            },

            // 금액 정보
            amounts: this._extractAmounts(text),

            // 고지의무 관련
            disclosure: this._extractDisclosureInfo(text, genes),

            // 피보험자 정보 연결
            insuredInfo: this._linkInsuredInfo(patientInfo),

            // 요약
            summary: '',

            // 신뢰도
            confidence: 0
        };

        // 요약 생성
        result.summary = this._generateSummary(result);

        // 신뢰도 계산
        result.confidence = this._calculateConfidence(result);

        // NaN 가드 적용
        return NaNGuard.cleanObject(result);
    }

    /**
     * genes를 텍스트로 변환
     */
    _genesToText(genes) {
        if (!Array.isArray(genes)) return '';
        return genes
            .map(g => g.content || g.raw_text || '')
            .filter(t => t.length > 0)
            .join('\n');
    }

    /**
     * 보험 계약 정보 추출
     */
    _extractContracts(text) {
        const contracts = [];

        // 계약 패턴 탐지
        const contractPatterns = [
            /(?:보험)?계약[:\s]*([^\n]+)/gi,
            /(?:주계약|특약)[:\s]*([^\n]+)/gi,
            /담보[:\s]*([^\n]+)/gi
        ];

        for (const pattern of contractPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                contracts.push({
                    content: match[1].trim().substring(0, 100),
                    type: this._classifyContract(match[0])
                });
            }
        }

        return contracts.slice(0, 20);
    }

    /**
     * 계약 유형 분류
     */
    _classifyContract(text) {
        if (/주계약/.test(text)) return 'main';
        if (/특약/.test(text)) return 'rider';
        if (/담보/.test(text)) return 'coverage';
        return 'general';
    }

    /**
     * 보험 유형 식별
     */
    _identifyInsuranceTypes(text) {
        const identified = [];

        for (const [type, keywords] of Object.entries(this.insuranceTypePatterns)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    identified.push({
                        type,
                        keyword,
                        koreanName: this._getKoreanTypeName(type)
                    });
                    break; // 같은 유형 중복 방지
                }
            }
        }

        return identified;
    }

    /**
     * 보험 유형 한글명
     */
    _getKoreanTypeName(type) {
        const names = {
            life: '생명보험',
            health: '건강보험',
            accident: '상해보험',
            cancer: '암보험',
            pension: '연금보험',
            property: '손해보험'
        };
        return names[type] || type;
    }

    /**
     * 가입일 추출
     */
    _extractEnrollmentDate(text) {
        const patterns = [
            /가입일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i,
            /계약일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i,
            /효력발생일[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this._normalizeDate(match[1]);
            }
        }

        return null;
    }

    /**
     * 만기일 추출
     */
    _extractExpiryDate(text) {
        const pattern = /만기일?[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i;
        const match = text.match(pattern);

        if (match) {
            return this._normalizeDate(match[1]);
        }

        return null;
    }

    /**
     * 모든 보험 관련 날짜 추출
     */
    _extractAllInsuranceDates(text) {
        const dates = [];

        for (const pattern of this.datePatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const date = match[1];
                if (date) {
                    dates.push({
                        date: this._normalizeDate(date),
                        context: match[0].substring(0, 50)
                    });
                }
            }
        }

        return dates;
    }

    /**
     * 날짜 정규화
     */
    _normalizeDate(dateStr) {
        if (!dateStr) return null;

        // YYYY-MM-DD 형식으로 변환
        const parts = dateStr.split(/[-./]/);
        if (parts.length === 3) {
            const [year, month, day] = parts;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return dateStr;
    }

    /**
     * 금액 정보 추출
     */
    _extractAmounts(text) {
        const amounts = [];

        for (const pattern of this.amountPatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const amount = match[1].replace(/,/g, '');
                amounts.push({
                    amount: parseInt(amount, 10),
                    formatted: this._formatAmount(amount),
                    context: match[0].substring(0, 50)
                });
            }
        }

        return amounts.slice(0, 10);
    }

    /**
     * 금액 포맷팅
     */
    _formatAmount(amount) {
        const num = parseInt(amount, 10);
        if (num >= 100000000) {
            return `${(num / 100000000).toFixed(1)}억원`;
        } else if (num >= 10000) {
            return `${(num / 10000).toFixed(0)}만원`;
        }
        return `${num.toLocaleString()}원`;
    }

    /**
     * 고지의무 관련 정보 추출
     */
    _extractDisclosureInfo(text, genes) {
        const disclosureInfo = {
            hasDisclosureContent: false,
            keywords: [],
            relatedContent: [],
            preExistingConditions: []
        };

        // 고지의무 키워드 탐지
        for (const keyword of this.disclosureKeywords) {
            if (text.includes(keyword)) {
                disclosureInfo.hasDisclosureContent = true;
                disclosureInfo.keywords.push(keyword);
            }
        }

        // 관련 컨텐츠 추출
        if (disclosureInfo.hasDisclosureContent) {
            genes.forEach(gene => {
                const content = gene.content || gene.raw_text || '';
                if (this.disclosureKeywords.some(k => content.includes(k))) {
                    disclosureInfo.relatedContent.push({
                        content: content.substring(0, 150),
                        confidence: gene.confidence || 0.7
                    });
                }
            });

            // 기왕증 탐지
            const preExistingPatterns = [
                /(?:과거|이전|기존)\s*(?:병력|질환|질병)/gi,
                /(?:기왕력|기왕증)/gi,
                /(?:고혈압|당뇨|암)\s*(?:병력|기왕)/gi
            ];

            for (const pattern of preExistingPatterns) {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    disclosureInfo.preExistingConditions.push(match[0]);
                }
            }
        }

        return disclosureInfo;
    }

    /**
     * 피보험자 정보 연결
     */
    _linkInsuredInfo(patientInfo) {
        if (!patientInfo || Object.keys(patientInfo).length === 0) {
            return { linked: false };
        }

        return {
            linked: true,
            name: patientInfo.name || patientInfo.patient_name || '',
            birthDate: patientInfo.birth_date || patientInfo.birthDate || '',
            insuranceEnrollmentDate: patientInfo.insurance_enrollment_date || ''
        };
    }

    /**
     * 요약 생성
     */
    _generateSummary(result) {
        const parts = [];

        // 보험 유형
        if (result.insuranceTypes.length > 0) {
            parts.push(`보험 유형: ${result.insuranceTypes.map(t => t.koreanName).join(', ')}`);
        }

        // 가입일
        if (result.dates.enrollmentDate) {
            parts.push(`가입일: ${result.dates.enrollmentDate}`);
        }

        // 계약 수
        if (result.contracts.length > 0) {
            parts.push(`계약/담보: ${result.contracts.length}건`);
        }

        // 고지의무
        if (result.disclosure.hasDisclosureContent) {
            parts.push(`고지의무 관련 정보 ${result.disclosure.relatedContent.length}건 발견`);
        }

        return parts.length > 0 ? parts.join('\n') : '보험정보를 찾을 수 없습니다.';
    }

    /**
     * 신뢰도 계산
     */
    _calculateConfidence(result) {
        let score = 0.3; // 기본값

        if (result.insuranceTypes.length > 0) score += 0.2;
        if (result.dates.enrollmentDate) score += 0.2;
        if (result.contracts.length > 0) score += 0.15;
        if (result.disclosure.hasDisclosureContent) score += 0.15;

        return Math.min(score, 1.0);
    }
}

module.exports = InsuranceInfoParser;
