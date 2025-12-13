/**
 * VNEXSUS Advanced Regex Patterns Library (T-101)
 * 
 * 50+ 정규식 패턴을 중앙화하여 날짜, 기간, 병원명, ICD 코드 등을 추출합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

class RegexPatterns {
    constructor() {
        // ========================================
        // 1. 날짜 패턴 (Date Patterns) - 20+ 패턴
        // ========================================
        this.datePatterns = {
            // 기본 형식
            'YYYY.MM.DD': /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
            'YYYY-MM-DD': /(\d{4})-(\d{1,2})-(\d{1,2})/g,
            'YYYY/MM/DD': /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
            'YYYYMMDD': /(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g,

            // 한글 형식
            'YYYY년MM월DD일': /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
            'YYYY년 MM월 DD일': /(\d{4})년\s+(\d{1,2})월\s+(\d{1,2})일/g,
            'MM월DD일': /(\d{1,2})월\s*(\d{1,2})일/g,

            // 축약 형식
            'YY.MM.DD': /(?<!\d)(\d{2})\.(\d{1,2})\.(\d{1,2})/g,
            'YY-MM-DD': /(?<!\d)(\d{2})-(\d{1,2})-(\d{1,2})/g,

            // 범위 형식
            'DATE_RANGE_TILDE': /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*~\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,
            'DATE_RANGE_DASH': /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*-\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,
            'DATE_RANGE_TO': /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*부터\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,

            // OCR 오류 허용 형식
            'WITH_SPACES': /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g
        };

        // ========================================
        // 2. 기간 패턴 (Duration Patterns) - 15+ 패턴
        // ========================================
        this.durationPatterns = {
            // 일 단위
            'N일간': /(\d+)\s*일\s*간/g,
            'N일': /(\d+)\s*일(?!\s*[간전후])/g,
            'N일동안': /(\d+)\s*일\s*동안/g,

            // 주 단위
            'N주간': /(\d+)\s*주\s*간/g,
            'N주': /(\d+)\s*주(?!\s*간)/g,

            // 월 단위
            'N개월': /(\d+)\s*개\s*월/g,
            'N개월간': /(\d+)\s*개\s*월\s*간/g,
            'N월간': /(\d+)\s*월\s*간/g,

            // 년 단위
            'N년': /(\d+)\s*년(?!\s*[간전월일])/g,
            'N년간': /(\d+)\s*년\s*간/g,

            // 상대적 표현
            '약N개월': /약\s*(\d+)\s*개\s*월/g,
            '약N주': /약\s*(\d+)\s*주/g,
            '약N일': /약\s*(\d+)\s*일/g,

            // 복합 표현
            'N년N개월': /(\d+)\s*년\s*(\d+)\s*개\s*월/g,
            'N개월N일': /(\d+)\s*개\s*월\s*(\d+)\s*일/g
        };

        // ========================================
        // 3. 병원 패턴 (Hospital Patterns) - 10+ 패턴
        // ========================================
        this.hospitalPatterns = {
            // 기본 병원
            '병원': /([가-힣]{2,15})병원/g,
            '의원': /([가-힣]{2,15})의원/g,
            '클리닉': /([가-힣]{2,15})클리닉/g,
            '센터': /([가-힣]{2,15})(?:의료)?센터/g,
            '의료원': /([가-힣]{2,15})의료원/g,

            // 대학병원
            '대학병원': /([가-힣]{2,10})대학(?:교)?(?:부속)?병원/g,
            '대학의료원': /([가-힣]{2,10})대학(?:교)?의료원/g,

            // 종합병원
            '종합병원': /([가-힣]{2,10})종합병원/g,

            // 특수 병원
            '한의원': /([가-힣]{2,15})한의원/g,
            '치과': /([가-힣]{2,15})치과(?:의원|병원)?/g,
            '정형외과': /([가-힣]{2,15})정형외과/g,
            '내과': /([가-힣]{2,15})내과(?:의원)?/g,
            '외과': /([가-힣]{2,15})외과(?:의원)?/g
        };

        // ========================================
        // 4. ICD 코드 패턴 (ICD Code Patterns) - 10+ 패턴
        // ========================================
        this.icdPatterns = {
            // 표준 ICD-10 형식
            'ICD_STANDARD': /([A-TV-Z]\d{2}(?:\.\d{1,2})?)/gi,

            // 괄호 안 형식
            'ICD_PAREN': /\(([A-TV-Z]\d{2}(?:\.\d{1,2})?)\)/gi,
            'ICD_BRACKET': /\[([A-TV-Z]\d{2}(?:\.\d{1,2})?)\]/gi,

            // 라벨 포함 형식
            'ICD_LABELED': /ICD(?:-?10)?[\s:：]*([A-TV-Z]\d{2}(?:\.\d{1,2})?)/gi,
            'ICD_COLON': /코드[\s:：]*([A-TV-Z]\d{2}(?:\.\d{1,2})?)/gi,

            // 복합 형식
            'ICD_RANGE': /([A-TV-Z]\d{2})-([A-TV-Z]\d{2})/gi,
            'ICD_MULTIPLE': /([A-TV-Z]\d{2}(?:\.\d)?)[,\s]+([A-TV-Z]\d{2}(?:\.\d)?)/gi
        };

        // ========================================
        // 5. 진단 패턴 (Diagnosis Patterns) - 10+ 패턴
        // ========================================
        this.diagnosisPatterns = {
            // 진단명 라벨
            '진단명': /진단(?:명)?[\s:：]+([^\n,;]+)/g,
            '진단병명': /진단\s*병명[\s:：]+([^\n,;]+)/g,
            '병명': /병명[\s:：]+([^\n,;]+)/g,
            '상병명': /상병명[\s:：]+([^\n,;]+)/g,
            '주진단': /주\s*진단[\s:：]+([^\n,;]+)/g,
            '부진단': /부\s*진단[\s:：]+([^\n,;]+)/g,

            // 영문 진단
            'DIAGNOSIS_EN': /[Dd]iagnosis[\s:：]+([^\n,;]+)/g,
            'DX': /[Dd][Xx][\s:：]+([^\n,;]+)/g,

            // 암/종양 특화
            '암진단': /((?:[가-힣]+)?(?:암|종양|carcinoma|cancer|tumor)(?:[가-힣]+)?)/gi,

            // 질환명
            '질환': /([가-힣]{2,20}(?:질환|증후군|병증|염|증))/g
        };

        // ========================================
        // 6. 치료 패턴 (Treatment Patterns) - 10+ 패턴
        // ========================================
        this.treatmentPatterns = {
            '치료내용': /치료\s*(?:내용)?[\s:：]+([^\n;]+)/g,
            '치료방법': /치료\s*방법[\s:：]+([^\n;]+)/g,
            '수술명': /수술(?:명)?[\s:：]+([^\n;]+)/g,
            '시술명': /시술(?:명)?[\s:：]+([^\n;]+)/g,
            '처치': /처치[\s:：]+([^\n;]+)/g,
            '투약': /투약[\s:：]+([^\n;]+)/g,
            '처방': /처방[\s:：]+([^\n;]+)/g,
            '입원': /입원[\s:：]*([^\n;]*)/g,
            '통원': /통원[\s:：]*([^\n;]*)/g,
            '경과관찰': /경과\s*관찰/g
        };

        // ========================================
        // 7. 보험 패턴 (Insurance Patterns) - 5+ 패턴
        // ========================================
        this.insurancePatterns = {
            '보험명': /([가-힣A-Za-z0-9]+(?:보험|플랜|건강보험))/g,
            '보험가입일': /(?:보험)?(?:가입일|계약일)[\s:：]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,
            '보장개시': /보장\s*개시[\s:：]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,
            '보험사': /([가-힣]+(?:손해보험|생명보험|화재|생명|보험))/g,
            '증권번호': /(?:증권|계약)(?:번호)?[\s:：]*([A-Z0-9\-]+)/gi
        };
    }

    /**
     * 텍스트에서 모든 날짜를 추출합니다.
     * @param {string} text - 입력 텍스트
     * @returns {Array<{original: string, normalized: string, pattern: string}>}
     */
    extractDates(text) {
        const results = [];
        for (const [patternName, regex] of Object.entries(this.datePatterns)) {
            const clonedRegex = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = clonedRegex.exec(text)) !== null) {
                results.push({
                    original: match[0],
                    normalized: this.normalizeDate(match),
                    pattern: patternName,
                    index: match.index
                });
            }
        }
        return this.deduplicateByIndex(results);
    }

    /**
     * 텍스트에서 모든 기간을 추출합니다.
     * @param {string} text - 입력 텍스트
     * @returns {Array<{original: string, days: number, pattern: string}>}
     */
    extractDurations(text) {
        const results = [];
        for (const [patternName, regex] of Object.entries(this.durationPatterns)) {
            const clonedRegex = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = clonedRegex.exec(text)) !== null) {
                results.push({
                    original: match[0],
                    value: parseInt(match[1]),
                    days: this.durationToDays(match, patternName),
                    pattern: patternName,
                    index: match.index
                });
            }
        }
        return this.deduplicateByIndex(results);
    }

    /**
     * 텍스트에서 모든 병원명을 추출합니다.
     * @param {string} text - 입력 텍스트
     * @returns {Array<{name: string, type: string}>}
     */
    extractHospitals(text) {
        const results = [];
        for (const [patternName, regex] of Object.entries(this.hospitalPatterns)) {
            const clonedRegex = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = clonedRegex.exec(text)) !== null) {
                results.push({
                    name: match[0],
                    prefix: match[1],
                    type: patternName,
                    index: match.index
                });
            }
        }
        return this.deduplicateByIndex(results);
    }

    /**
     * 텍스트에서 모든 ICD 코드를 추출합니다.
     * @param {string} text - 입력 텍스트
     * @returns {Array<{code: string, pattern: string}>}
     */
    extractICDCodes(text) {
        const results = [];
        for (const [patternName, regex] of Object.entries(this.icdPatterns)) {
            const clonedRegex = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = clonedRegex.exec(text)) !== null) {
                const code = (match[1] || match[0]).toUpperCase();
                if (this.isValidICDCode(code)) {
                    results.push({
                        code: code,
                        original: match[0],
                        pattern: patternName,
                        index: match.index
                    });
                }
            }
        }
        return this.deduplicateByCode(results);
    }

    /**
     * 텍스트에서 모든 진단명을 추출합니다.
     * @param {string} text - 입력 텍스트
     * @returns {Array<{diagnosis: string, pattern: string}>}
     */
    extractDiagnoses(text) {
        const results = [];
        for (const [patternName, regex] of Object.entries(this.diagnosisPatterns)) {
            const clonedRegex = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = clonedRegex.exec(text)) !== null) {
                const diagnosis = (match[1] || match[0]).trim();
                if (diagnosis.length > 1) {
                    results.push({
                        diagnosis: diagnosis,
                        pattern: patternName,
                        index: match.index
                    });
                }
            }
        }
        return results;
    }

    /**
     * 날짜를 YYYY-MM-DD 형식으로 정규화합니다.
     */
    normalizeDate(match) {
        let year = match[1];
        let month = match[2];
        let day = match[3];

        // 2자리 연도 처리
        if (year && year.length === 2) {
            year = parseInt(year) > 50 ? '19' + year : '20' + year;
        }

        if (year && month && day) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return match[0];
    }

    /**
     * 기간을 일수로 변환합니다.
     */
    durationToDays(match, patternName) {
        const value = parseInt(match[1]);
        if (patternName.includes('년')) return value * 365;
        if (patternName.includes('개월') || patternName.includes('월간')) return value * 30;
        if (patternName.includes('주')) return value * 7;
        return value; // 일
    }

    /**
     * ICD 코드 유효성 검사
     */
    isValidICDCode(code) {
        // 기본 형식 검증 (A00-Z99)
        const validCategories = 'ABCDEFGHIJKLMNOPQRSTUVWZ';
        if (!code || code.length < 3) return false;
        if (!validCategories.includes(code[0].toUpperCase())) return false;
        return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(code.toUpperCase());
    }

    /**
     * 인덱스 기준 중복 제거
     */
    deduplicateByIndex(results) {
        const seen = new Set();
        return results.filter(r => {
            const key = `${r.index}-${r.original || r.name || r.code}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * 코드 기준 중복 제거
     */
    deduplicateByCode(results) {
        const seen = new Set();
        return results.filter(r => {
            if (seen.has(r.code)) return false;
            seen.add(r.code);
            return true;
        });
    }
}

export default RegexPatterns;
