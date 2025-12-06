/**
 * MedicalTermFormatter - 의료 용어 포맷팅 유틸리티
 * 
 * ICD 코드 정규화 및 진단명 표준 포맷 적용
 * 표준 형식: ICD코드/영어명(한글명)
 * 예: K35.8/Acute Appendicitis(급성 충수염)
 */

export class MedicalTermFormatter {
    constructor() {
        // ICD 코드 매핑 테이블 (주요 질환) - Phase 6: 확장
        this.icdMapping = {
            // 기존 매핑
            '충수염': { code: 'K35.8', english: 'Acute Appendicitis', korean: '급성 충수염' },
            '급성 충수염': { code: 'K35.8', english: 'Acute Appendicitis', korean: '급성 충수염' },
            '고혈압': { code: 'I10', english: 'Essential Hypertension', korean: '본태성 고혈압' },
            '당뇨병': { code: 'E11', english: 'Type 2 Diabetes Mellitus', korean: '제2형 당뇨병' },
            '제2형 당뇨병': { code: 'E11', english: 'Type 2 Diabetes Mellitus', korean: '제2형 당뇨병' },

            // Phase 6: 신규 매핑
            '비만': { code: 'E66', english: 'Obesity', korean: '비만' },
            '담낭염': { code: 'K81', english: 'Cholecystitis', korean: '담낭염' },
            '급성 담낭염': { code: 'K81.0', english: 'Acute Cholecystitis', korean: '급성 담낭염' },
            '만성 담낭염': { code: 'K81.1', english: 'Chronic Cholecystitis', korean: '만성 담낭염' }
        };

        // 노이즈 키워드 (진단으로 잘못 분류되는 단어들) - Phase 6: 축소
        this.noiseKeywords = new Set([
            '현병', '과거', '예정', '회',
            // Phase 6: "통증", "염증" 등 의료적 맥락은 유지
        ]);
    }

    /**
     * ICD 코드 정규화
     * @param {string} code - 원본 ICD 코드 (예: "K35", "K35.8")
     * @returns {string} 정규화된 ICD 코드
     */
    normalizeICDCode(code) {
        if (!code) return null;

        // 공백 제거 및 대문자 변환
        code = code.trim().toUpperCase();

        // 이미 완전한 형식인 경우 (예: K35.8)
        if (/^[A-Z]\d{2}\.\d$/.test(code)) {
            return code;
        }

        // 기본 형식인 경우 .8 추가 (예: K35 -> K35.8)
        if (/^[A-Z]\d{2}$/.test(code)) {
            return `${code}.8`;
        }

        // 점 없이 4자리인 경우 (예: K358 -> K35.8)
        if (/^[A-Z]\d{3}$/.test(code)) {
            return `${code.substring(0, 3)}.${code.substring(3)}`;
        }

        return code;
    }

    /**
     * 텍스트에서 ICD 코드 추출
     * @param {string} text - 원본 텍스트
     * @returns {string|null} 추출된 ICD 코드
     */
    extractICDCode(text) {
        if (!text) return null;

        // ICD 코드 패턴: K35.8, K35, K358 등
        const patterns = [
            /[A-Z]\d{2}\.\d/g,  // K35.8
            /[A-Z]\d{2}/g,      // K35
            /[A-Z]\d{3}/g       // K358
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return this.normalizeICDCode(match[0]);
            }
        }

        return null;
    }

    /**
     * 텍스트에서 영어 진단명 추출
     * @param {string} text - 원본 텍스트
     * @returns {string|null} 추출된 영어 진단명
     */
    extractEnglishName(text) {
        if (!text) return null;

        // 괄호 안의 영어 텍스트 추출: (Acute Appendicitis, K35.8)
        const match = text.match(/\(([A-Za-z\s]+)(?:,|\))/);
        if (match && match[1]) {
            return match[1].trim();
        }

        // 영어 단어만 있는 경우
        const englishOnly = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/);
        if (englishOnly) {
            return englishOnly[0];
        }

        return null;
    }

    /**
     * 한글 진단명에서 ICD 정보 조회
     * @param {string} koreanName - 한글 진단명
     * @returns {Object|null} ICD 정보 객체
     */
    lookupICD(koreanName) {
        if (!koreanName) return null;

        // 정확히 일치하는 경우
        if (this.icdMapping[koreanName]) {
            return this.icdMapping[koreanName];
        }

        // 부분 일치 검색
        for (const [key, value] of Object.entries(this.icdMapping)) {
            if (koreanName.includes(key) || key.includes(koreanName)) {
                return value;
            }
        }

        return null;
    }

    /**
     * Phase 6: 기존 형식 감지 및 변환
     * 기존 형식: "비만(Obesity) ((ICD: E66))" 또는 "진단명(영어명, ICD코드)"
     * 목표 형식: "E66/Obesity(비만)"
     * @param {string} text - 원본 텍스트
     * @returns {Object} { korean, english, icdCode }
     */
    parseAndConvertLegacyFormat(text) {
        if (!text) return null;

        // 패턴 1: "비만(Obesity) ((ICD: E66))"
        const pattern1 = /^([가-힣\s]+)\(([A-Za-z\s]+)\)\s*\(\(ICD:\s*([A-Z]\d{2,3}\.?\d?)\)\)$/;
        const match1 = text.match(pattern1);
        if (match1) {
            return {
                korean: match1[1].trim(),
                english: match1[2].trim(),
                icdCode: this.normalizeICDCode(match1[3])
            };
        }

        // 패턴 2: "비만 (Obesity, E66)"
        const pattern2 = /^([가-힣\s]+)\s*\(([A-Za-z\s]+),\s*([A-Z]\d{2,3}\.?\d?)\)$/;
        const match2 = text.match(pattern2);
        if (match2) {
            return {
                korean: match2[1].trim(),
                english: match2[2].trim(),
                icdCode: this.normalizeICDCode(match2[3])
            };
        }

        // 패턴 3: "Obesity (비만, E66)"
        const pattern3 = /^([A-Za-z\s]+)\s*\(([가-힣\s]+),\s*([A-Z]\d{2,3}\.?\d?)\)$/;
        const match3 = text.match(pattern3);
        if (match3) {
            return {
                english: match3[1].trim(),
                korean: match3[2].trim(),
                icdCode: this.normalizeICDCode(match3[3])
            };
        }

        return null;
    }

    /**
     * Phase 6: 진단명 강제 포맷팅 (모든 형식 처리)
     * @param {string|Object} input - 진단명 텍스트 또는 엔티티 객체
     * @returns {string} 표준 형식으로 포맷팅된 진단명
     */
    formatDiagnosisStrict(input) {
        let text = '';
        let entity = null;

        // 입력 타입 처리
        if (typeof input === 'string') {
            text = input;
        } else if (input && typeof input === 'object') {
            entity = input;
            text = input.originalText || input.normalizedText || '';
        }

        if (!text) return '';

        // Phase 6: 이미 표준 형식인지 확인 (중복 포맷팅 방지)
        // 표준 형식: "ICD코드/영어명(한글명)" 예: "K35.8/Acute Appendicitis(급성 충수염)"
        const standardFormatPattern = /^[A-Z]\d{2,3}\.?\d?\/[A-Za-z\s]+\([가-힣\s]+\)$/;
        if (standardFormatPattern.test(text)) {
            return text;  // 이미 표준 형식이면 그대로 반환
        }

        // 1. 기존 형식 감지 및 변환
        const parsed = this.parseAndConvertLegacyFormat(text);
        if (parsed && parsed.icdCode && parsed.english && parsed.korean) {
            return `${parsed.icdCode}/${parsed.english}(${parsed.korean})`;
        }

        // 2. 엔티티 객체가 있으면 기존 formatDiagnosis 사용 (무한 루프 방지)
        if (entity && !entity._formatting) {
            entity._formatting = true;  // 플래그 설정
            const result = this.formatDiagnosis(entity);
            delete entity._formatting;  // 플래그 제거
            return result;
        }

        // 3. 텍스트만 있는 경우 ICD 코드 추출 시도
        const icdCode = this.extractICDCode(text);
        const englishName = this.extractEnglishName(text);

        // 한글명 추출 (괄호 안의 한글)
        const koreanMatch = text.match(/([가-힣\s]+)/);
        const koreanName = koreanMatch ? koreanMatch[1].trim() : text;

        // 4. 매핑 테이블에서 조회
        if (!icdCode || !englishName) {
            const icdInfo = this.lookupICD(koreanName);
            if (icdInfo) {
                return `${icdInfo.code}/${icdInfo.english}(${icdInfo.korean})`;
            }
        }

        // 5. 표준 형식으로 포맷팅
        if (icdCode && englishName) {
            return `${icdCode}/${englishName}(${koreanName})`;
        } else if (icdCode) {
            return `${icdCode}/${koreanName}`;
        } else if (englishName) {
            return `${englishName}(${koreanName})`;
        }

        // 6. 변환 불가능한 경우 원본 반환
        return text;
    }

    /**
     * 진단명을 표준 형식으로 포맷팅
     * @param {Object} entity - 엔티티 객체
     * @returns {string} 포맷팅된 진단명
     */
    formatDiagnosis(entity) {
        if (!entity || entity.type !== 'diagnosis') {
            return entity?.normalizedText || '';
        }

        const originalText = entity.originalText || '';
        const normalizedText = entity.normalizedText || '';

        // Phase 6: 무한 루프 방지
        if (entity._formatting) {
            // 이미 포맷팅 중이면 기본 로직만 수행
            let icdCode = this.extractICDCode(originalText);
            let englishName = this.extractEnglishName(originalText);
            let koreanName = normalizedText;

            if (!icdCode) {
                const icdInfo = this.lookupICD(normalizedText);
                if (icdInfo) {
                    icdCode = icdInfo.code;
                    englishName = englishName || icdInfo.english;
                    koreanName = icdInfo.korean;
                }
            }

            if (icdCode && englishName) {
                return `${icdCode}/${englishName}(${koreanName})`;
            } else if (icdCode) {
                return `${icdCode}/${koreanName}`;
            } else if (englishName) {
                return `${englishName}(${koreanName})`;
            }

            return normalizedText;
        }

        // Phase 6: 기존 형식 변환 우선 시도
        const converted = this.formatDiagnosisStrict(originalText || normalizedText);
        if (converted && converted !== originalText && converted !== normalizedText) {
            return converted;
        }

        // 1. 원본 텍스트에서 ICD 코드 추출
        let icdCode = this.extractICDCode(originalText);
        let englishName = this.extractEnglishName(originalText);
        let koreanName = normalizedText;

        // 2. ICD 코드가 없으면 매핑 테이블에서 조회
        if (!icdCode) {
            const icdInfo = this.lookupICD(normalizedText);
            if (icdInfo) {
                icdCode = icdInfo.code;
                englishName = englishName || icdInfo.english;
                koreanName = icdInfo.korean;
            }
        }

        // 3. 표준 형식으로 포맷팅
        if (icdCode && englishName) {
            return `${icdCode}/${englishName}(${koreanName})`;
        } else if (icdCode) {
            return `${icdCode}/${koreanName}`;
        } else if (englishName) {
            return `${englishName}(${koreanName})`;
        }

        // 4. 정보가 부족한 경우 원본 반환
        return normalizedText;
    }

    /**
     * 엔티티가 유효한지 검증
     * @param {Object} entity - 엔티티 객체
     * @returns {boolean} 유효 여부
     */
    isValidEntity(entity) {
        if (!entity || !entity.normalizedText) {
            return false;
        }

        const text = entity.normalizedText.trim();

        // 길이 체크 (너무 짧은 경우)
        if (text.length < 2) {
            return false;
        }

        // 숫자만 포함된 경우 (예: "3회", "88회")
        if (/^\d+회?$/.test(text)) {
            return false;
        }

        // 노이즈 키워드 체크
        if (this.noiseKeywords.has(text)) {
            return false;
        }

        // 진단 타입인 경우 추가 검증
        if (entity.type === 'diagnosis') {
            // 단일 문자는 제외
            if (text.length === 1) {
                return false;
            }

            // 일반적인 노이즈 패턴
            const noisePatterns = [
                /^[가-힣]$/,           // 단일 한글
                /^\d+$/,               // 숫자만
                /^[a-z]+$/i,           // 영어 소문자만
            ];

            for (const pattern of noisePatterns) {
                if (pattern.test(text)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 엔티티 리스트 필터링
     * @param {Array} entities - 엔티티 배열
     * @returns {Array} 필터링된 엔티티 배열
     */
    filterEntities(entities) {
        if (!Array.isArray(entities)) {
            return [];
        }

        return entities.filter(entity => this.isValidEntity(entity));
    }

    /**
     * 진단 엔티티 리스트를 표준 형식으로 포맷팅
     * @param {Array} diagnoses - 진단 엔티티 배열
     * @returns {Array} 포맷팅된 진단명 배열
     */
    formatDiagnoses(diagnoses) {
        if (!Array.isArray(diagnoses)) {
            return [];
        }

        return diagnoses
            .filter(d => this.isValidEntity(d))
            .map(d => this.formatDiagnosis(d));
    }
}

export default new MedicalTermFormatter();
