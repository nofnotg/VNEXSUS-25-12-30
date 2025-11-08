/**
 * AI 기반 보험사 정보 필터링 및 검증 서비스
 * 자연어 처리와 패턴 매칭을 통한 지능형 보험사 정보 검증
 */

class AIFilteringService {
    constructor() {
        this.patterns = {
            // 보험사 패턴
            insuranceCompanyPatterns: [
                /(.+)(보험|화재|생명|손해보험|해상)$/,
                /(.+)(Insurance|Life|Fire|Marine)$/i,
                /(AIG|AXA|삼성|현대|LIG|KB|DB|메리츠|한화|롯데|MG|하나|우리|NH농협|교보|신한|IBK기업은행)/
            ],
            
            // 손해사정 패턴
            claimsAdjusterPatterns: [
                /(.+)(손해사정|사정조사|조사회사|사정회사|손사)(.*)$/,
                /(.+)(클레임|claim|adjust|survey)(.*)$/i,
                /(해오름|대한|한국|서울|부산|대구|광주|대전|울산|인천)(.+)(손해사정|사정|조사)/
            ],
            
            // 날짜 패턴
            datePatterns: [
                /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/,
                /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
                /(\d{1,2})[\/](\d{1,2})[\/](\d{4})/
            ]
        };
        
        this.confidenceThresholds = {
            high: 0.8,
            medium: 0.6,
            low: 0.4
        };
    }

    /**
     * AI 기반 보험사 여부 판단
     * @param {string} companyName - 회사명
     * @param {Object} context - 추가 컨텍스트 정보
     * @returns {Object} AI 판단 결과
     */
    async analyzeInsuranceCompany(companyName, context = {}) {
        if (!companyName || typeof companyName !== 'string') {
            return this.createAnalysisResult(false, 0, '입력값이 유효하지 않습니다.');
        }

        const analysis = {
            textAnalysis: this.analyzeText(companyName),
            patternMatching: this.matchPatterns(companyName),
            contextAnalysis: this.analyzeContext(context),
            semanticAnalysis: this.performSemanticAnalysis(companyName)
        };

        const confidence = this.calculateConfidence(analysis);
        const isInsurer = this.determineInsuranceStatus(analysis, confidence);
        
        return this.createAnalysisResult(isInsurer, confidence, 'AI 분석 완료', analysis);
    }

    /**
     * 텍스트 분석
     * @param {string} text - 분석할 텍스트
     * @returns {Object} 텍스트 분석 결과
     */
    analyzeText(text) {
        const cleanText = text.trim().toLowerCase();
        
        return {
            length: text.length,
            hasNumbers: /\d/.test(text),
            hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(text),
            wordCount: text.split(/\s+/).length,
            containsInsuranceTerms: this.containsInsuranceTerms(cleanText),
            containsClaimsTerms: this.containsClaimsTerms(cleanText),
            languageType: this.detectLanguage(text)
        };
    }

    /**
     * 패턴 매칭
     * @param {string} companyName - 회사명
     * @returns {Object} 패턴 매칭 결과
     */
    matchPatterns(companyName) {
        const results = {
            insurancePatternMatch: false,
            claimsPatternMatch: false,
            matchedPatterns: []
        };

        // 보험사 패턴 매칭
        for (const pattern of this.patterns.insuranceCompanyPatterns) {
            if (pattern.test(companyName)) {
                results.insurancePatternMatch = true;
                results.matchedPatterns.push({
                    type: 'insurance',
                    pattern: pattern.toString(),
                    match: companyName.match(pattern)
                });
            }
        }

        // 손해사정 패턴 매칭
        for (const pattern of this.patterns.claimsAdjusterPatterns) {
            if (pattern.test(companyName)) {
                results.claimsPatternMatch = true;
                results.matchedPatterns.push({
                    type: 'claims',
                    pattern: pattern.toString(),
                    match: companyName.match(pattern)
                });
            }
        }

        return results;
    }

    /**
     * 컨텍스트 분석
     * @param {Object} context - 컨텍스트 정보
     * @returns {Object} 컨텍스트 분석 결과
     */
    analyzeContext(context) {
        return {
            hasDocumentContext: !!context.document,
            hasDateContext: !!context.dates,
            hasLocationContext: !!context.location,
            documentType: context.documentType || 'unknown',
            contextScore: this.calculateContextScore(context)
        };
    }

    /**
     * 의미론적 분석
     * @param {string} companyName - 회사명
     * @returns {Object} 의미론적 분석 결과
     */
    performSemanticAnalysis(companyName) {
        const tokens = this.tokenize(companyName);
        const semanticFeatures = this.extractSemanticFeatures(tokens);
        
        return {
            tokens,
            semanticFeatures,
            businessType: this.inferBusinessType(semanticFeatures),
            industryCategory: this.categorizeIndustry(semanticFeatures)
        };
    }

    /**
     * 신뢰도 계산
     * @param {Object} analysis - 분석 결과
     * @returns {number} 신뢰도 (0-1)
     */
    calculateConfidence(analysis) {
        let confidence = 0;
        
        // 텍스트 분석 기반 점수
        if (analysis.textAnalysis.containsInsuranceTerms) confidence += 0.3;
        if (analysis.textAnalysis.containsClaimsTerms) confidence -= 0.4;
        
        // 패턴 매칭 기반 점수
        if (analysis.patternMatching.insurancePatternMatch) confidence += 0.4;
        if (analysis.patternMatching.claimsPatternMatch) confidence -= 0.5;
        
        // 컨텍스트 기반 점수
        confidence += analysis.contextAnalysis.contextScore * 0.2;
        
        // 의미론적 분석 기반 점수
        if (analysis.semanticAnalysis.businessType === 'insurance') confidence += 0.3;
        if (analysis.semanticAnalysis.businessType === 'claims') confidence -= 0.3;
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * 보험사 여부 결정
     * @param {Object} analysis - 분석 결과
     * @param {number} confidence - 신뢰도
     * @returns {boolean} 보험사 여부
     */
    determineInsuranceStatus(analysis, confidence) {
        // 손해사정 패턴이 매칭되면 보험사가 아님
        if (analysis.patternMatching.claimsPatternMatch) {
            return false;
        }
        
        // 높은 신뢰도로 보험사 패턴 매칭
        if (analysis.patternMatching.insurancePatternMatch && confidence >= this.confidenceThresholds.medium) {
            return true;
        }
        
        // 종합 판단
        return confidence >= this.confidenceThresholds.medium;
    }

    /**
     * 사용자 입력 오류 보정
     * @param {string} input - 사용자 입력
     * @returns {Object} 보정 결과
     */
    correctUserInput(input) {
        if (!input || typeof input !== 'string') {
            return {
                corrected: false,
                original: input,
                suggestion: null,
                confidence: 0
            };
        }

        const corrections = [];
        
        // 공백 정리
        const trimmed = input.trim().replace(/\s+/g, ' ');
        if (trimmed !== input) {
            corrections.push({
                type: 'whitespace',
                original: input,
                corrected: trimmed
            });
        }
        
        // 특수문자 제거
        const cleanSpecialChars = trimmed.replace(/[^\w\s가-힣]/g, '');
        if (cleanSpecialChars !== trimmed) {
            corrections.push({
                type: 'special_chars',
                original: trimmed,
                corrected: cleanSpecialChars
            });
        }
        
        // 대소문자 정규화
        const normalized = this.normalizeCase(cleanSpecialChars);
        if (normalized !== cleanSpecialChars) {
            corrections.push({
                type: 'case_normalization',
                original: cleanSpecialChars,
                corrected: normalized
            });
        }
        
        const finalCorrected = corrections.length > 0 ? 
            corrections[corrections.length - 1].corrected : input;
        
        return {
            corrected: corrections.length > 0,
            original: input,
            suggestion: finalCorrected,
            corrections,
            confidence: this.calculateCorrectionConfidence(corrections)
        };
    }

    /**
     * 날짜 정보 추출 및 검증
     * @param {string} text - 텍스트
     * @returns {Object} 날짜 추출 결과
     */
    extractAndValidateDates(text) {
        const dates = [];
        
        for (const pattern of this.patterns.datePatterns) {
            const matches = text.matchAll(new RegExp(pattern, 'g'));
            for (const match of matches) {
                const dateInfo = this.parseDate(match);
                if (dateInfo.isValid) {
                    dates.push(dateInfo);
                }
            }
        }
        
        return {
            found: dates.length > 0,
            dates,
            count: dates.length
        };
    }

    /**
     * 보험 용어 포함 여부 확인
     * @param {string} text - 텍스트
     * @returns {boolean} 보험 용어 포함 여부
     */
    containsInsuranceTerms(text) {
        const insuranceTerms = [
            '보험', '화재', '생명', '손해보험', '해상', 'insurance', 
            'life', 'fire', 'marine', '보장', '가입', '청구'
        ];
        
        return insuranceTerms.some(term => 
            text.toLowerCase().includes(term.toLowerCase())
        );
    }

    /**
     * 손해사정 용어 포함 여부 확인
     * @param {string} text - 텍스트
     * @returns {boolean} 손해사정 용어 포함 여부
     */
    containsClaimsTerms(text) {
        const claimsTerms = [
            '손해사정', '사정조사', '조사회사', '사정회사', '손사',
            'claim', 'adjust', 'survey', '조사', '사정'
        ];
        
        return claimsTerms.some(term => 
            text.toLowerCase().includes(term.toLowerCase())
        );
    }

    /**
     * 언어 감지
     * @param {string} text - 텍스트
     * @returns {string} 언어 타입
     */
    detectLanguage(text) {
        const koreanPattern = /[가-힣]/;
        const englishPattern = /[a-zA-Z]/;
        
        if (koreanPattern.test(text) && englishPattern.test(text)) {
            return 'mixed';
        } else if (koreanPattern.test(text)) {
            return 'korean';
        } else if (englishPattern.test(text)) {
            return 'english';
        } else {
            return 'unknown';
        }
    }

    /**
     * 분석 결과 생성
     * @param {boolean} isInsurer - 보험사 여부
     * @param {number} confidence - 신뢰도
     * @param {string} message - 메시지
     * @param {Object} details - 상세 정보
     * @returns {Object} 분석 결과
     */
    createAnalysisResult(isInsurer, confidence, message, details = null) {
        return {
            isInsurer,
            confidence,
            confidenceLevel: this.getConfidenceLevel(confidence),
            message,
            timestamp: new Date().toISOString(),
            details
        };
    }

    /**
     * 신뢰도 레벨 반환
     * @param {number} confidence - 신뢰도
     * @returns {string} 신뢰도 레벨
     */
    getConfidenceLevel(confidence) {
        if (confidence >= this.confidenceThresholds.high) return 'high';
        if (confidence >= this.confidenceThresholds.medium) return 'medium';
        if (confidence >= this.confidenceThresholds.low) return 'low';
        return 'very_low';
    }

    // 헬퍼 메서드들
    tokenize(text) {
        return text.split(/\s+/).filter(token => token.length > 0);
    }

    extractSemanticFeatures(tokens) {
        return {
            hasCompanyIndicators: tokens.some(token => 
                ['회사', '법인', '주식회사', 'company', 'corp', 'inc'].includes(token.toLowerCase())
            ),
            hasInsuranceIndicators: tokens.some(token => 
                ['보험', '화재', '생명', 'insurance', 'life'].includes(token.toLowerCase())
            )
        };
    }

    inferBusinessType(features) {
        if (features.hasInsuranceIndicators) return 'insurance';
        if (features.hasCompanyIndicators) return 'company';
        return 'unknown';
    }

    categorizeIndustry(features) {
        if (features.hasInsuranceIndicators) return 'financial_services';
        return 'unknown';
    }

    calculateContextScore(context) {
        let score = 0;
        if (context.document) score += 0.3;
        if (context.dates) score += 0.2;
        if (context.location) score += 0.1;
        return Math.min(1, score);
    }

    normalizeCase(text) {
        // 간단한 대소문자 정규화
        return text.replace(/([A-Z]+)/g, (match) => 
            match.charAt(0) + match.slice(1).toLowerCase()
        );
    }

    calculateCorrectionConfidence(corrections) {
        if (corrections.length === 0) return 1;
        return Math.max(0.5, 1 - (corrections.length * 0.1));
    }

    parseDate(match) {
        try {
            // 날짜 파싱 로직 (간단한 버전)
            const dateStr = match[0];
            const date = new Date(dateStr);
            
            return {
                isValid: !isNaN(date.getTime()),
                date: date,
                original: dateStr,
                formatted: date.toISOString().split('T')[0]
            };
        } catch (error) {
            return {
                isValid: false,
                date: null,
                original: match[0],
                error: error.message
            };
        }
    }
}

export default AIFilteringService;