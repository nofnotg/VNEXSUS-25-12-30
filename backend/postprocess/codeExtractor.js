/**
 * Code Extractor (Phase 4 - T08)
 * 
 * 목적:
 * - 정규표현식을 사용하여 텍스트에서 ICD/KCD 코드 패턴을 강력하게 추출
 * - AI 추출 전/후 보정 및 SourceSpan 생성 지원
 */

class CodeExtractor {
    constructor() {
        // ICD/KCD 코드 패턴 (예: C16.9, I10, D18.0, M51.1)
        // 알파벳 1자 + 숫자 2자 + (점(.) + 숫자 1~4자)?
        this.codePattern = /\b([A-Z][0-9]{2}(?:\.[0-9]{1,4})?)\b/g;

        // 한국형 질병분류 코드 (KCD) 특성 고려 (R/O, 의증 등 제외)
        this.excludePatterns = [
            /^T[0-9]{2}$/ // 체온 등 오탐지 가능성 있는 패턴 제외
        ];
    }

    /**
     * 텍스트에서 코드 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 추출된 코드 객체 배열 [{ code, index, raw }]
     */
    extractCodes(text) {
        if (!text) return [];

        const matches = [];
        let match;

        // 정규식 초기화
        this.codePattern.lastIndex = 0;

        while ((match = this.codePattern.exec(text)) !== null) {
            const rawCode = match[0];
            const code = this.normalizeCode(rawCode);

            if (this.isValidCode(code)) {
                matches.push({
                    code: code,
                    raw: rawCode,
                    index: match.index
                });
            }
        }

        return matches;
    }

    /**
     * 코드 정규화
     * - 대문자 변환
     * - 점(.) 처리 등
     */
    normalizeCode(code) {
        return code.toUpperCase();
    }

    /**
     * 유효한 코드인지 검증
     */
    isValidCode(code) {
        // 제외 패턴 확인
        if (this.excludePatterns.some(p => p.test(code))) {
            return false;
        }
        return true;
    }
}

const codeExtractor = new CodeExtractor();
export default codeExtractor;
