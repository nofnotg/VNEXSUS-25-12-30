/**
 * SourceSpan Manager (Phase 1 - T03)
 * 
 * 목적:
 * - 모든 의료 이벤트에 원문 근거 위치 추적
 * - 감사/분쟁 대응을 위한 정확한 원문 참조
 * - UI 하이라이트/점프 기능 지원
 * 
 * 목표: sourceSpan 첨부율 95%+
 */

class SourceSpanManager {
    constructor() {
        this.missingSpans = []; // 누락된 sourceSpan 추적
    }

    /**
     * 이벤트에 sourceSpan 첨부 (강화된 버전)
     * @param {Object} event - MedicalEvent 객체
     * @param {string} rawText - 전체 원문 텍스트
     * @param {Object} block - 날짜 블록 (선택)
     * @returns {Object} sourceSpan
     */
    attachSourceSpan(event, rawText, block = null) {
        if (!rawText || rawText.length === 0) {
            return this.createEmptySpan('원문 없음');
        }

        // Anchor 키워드 수집
        const anchorTerms = this.collectAnchorTerms(event, block);

        if (anchorTerms.length === 0) {
            return this.createEmptySpan('Anchor 키워드 없음');
        }

        // 원문에서 위치 찾기
        const position = this.findPositionInText(rawText, anchorTerms, event.date);

        if (!position) {
            this.missingSpans.push({
                eventId: event.id,
                date: event.date,
                hospital: event.hospital,
                reason: 'Anchor 매칭 실패'
            });
            return this.createEmptySpan('위치 찾기 실패');
        }

        // TextPreview 생성
        const textPreview = this.generateTextPreview(rawText, position.start, position.end);

        return {
            start: position.start,
            end: position.end,
            textPreview,
            anchorTerms, // 매칭에 사용된 키워드
            confidence: position.confidence || 0.8
        };
    }

    /**
     * Anchor 키워드 수집
     * @param {Object} event - MedicalEvent
     * @param {Object} block - 날짜 블록
     * @returns {Array<string>} Anchor 키워드 배열
     */
    collectAnchorTerms(event, block) {
        const terms = [];

        // 1. 날짜 (필수)
        if (event.date && event.date !== '날짜미상') {
            // 다양한 날짜 형식 추가
            terms.push(event.date); // 2024-04-09
            terms.push(event.date.replace(/-/g, '.')); // 2024.04.09
            terms.push(event.date.replace(/-/g, '/')); // 2024/04/09

            // 한글 형식
            const [year, month, day] = event.date.split('-');
            if (year && month && day) {
                terms.push(`${year}년 ${parseInt(month)}월 ${parseInt(day)}일`);
                terms.push(`${year}년${parseInt(month)}월${parseInt(day)}일`);
            }
        }

        // 2. 병원명
        if (event.hospital && event.hospital !== '병원명 미상') {
            terms.push(event.hospital);
            // 병원명 축약형 (예: "삼성서울병원" -> "삼성서울")
            const shortName = event.hospital.replace(/병원|의원|클리닉|센터|한의원|치과/g, '');
            if (shortName !== event.hospital) {
                terms.push(shortName);
            }
        }

        // 3. 진단명
        if (event.diagnosis && event.diagnosis.name) {
            terms.push(event.diagnosis.name);
        }

        // 4. ICD 코드
        if (event.diagnosis && event.diagnosis.code) {
            terms.push(event.diagnosis.code);
            // 점 없는 버전도 추가 (R07.4 -> R074)
            terms.push(event.diagnosis.code.replace(/\./g, ''));
        }

        // 5. 검사/시술
        if (event.procedures && event.procedures.length > 0) {
            event.procedures.forEach(proc => {
                if (proc.name) terms.push(proc.name);
            });
        }

        // 6. 블록 rawText에서 추가 키워드 (있는 경우)
        if (block && block.rawText) {
            // 블록 텍스트의 처음 50자를 anchor로 사용
            const blockSnippet = block.rawText.substring(0, 50).trim();
            if (blockSnippet) {
                terms.push(blockSnippet);
            }
        }

        // 중복 제거 및 빈 문자열 제거
        return [...new Set(terms)].filter(t => t && t.length > 0);
    }

    /**
     * 원문에서 위치 찾기 (Anchor 기반)
     * @param {string} rawText - 원문
     * @param {Array<string>} anchorTerms - Anchor 키워드
     * @param {string} date - 날짜 (우선순위 높음)
     * @returns {Object|null} {start, end, confidence}
     */
    findPositionInText(rawText, anchorTerms, date) {
        // 전략 1: 날짜를 먼저 찾고, 그 주변에서 다른 키워드 찾기
        const datePositions = this.findAllOccurrences(rawText, date);

        if (datePositions.length === 0) {
            // 날짜를 못 찾으면 다른 anchor로 시도
            return this.findByOtherAnchors(rawText, anchorTerms);
        }

        // 각 날짜 위치에서 다른 anchor 매칭 점수 계산
        let bestMatch = null;
        let bestScore = 0;

        datePositions.forEach(datePos => {
            // 날짜 주변 ±500자 범위에서 검색
            const windowStart = Math.max(0, datePos - 500);
            const windowEnd = Math.min(rawText.length, datePos + 500);
            const window = rawText.substring(windowStart, windowEnd);

            // 이 윈도우에서 매칭되는 anchor 개수 계산
            let matchCount = 0;
            anchorTerms.forEach(term => {
                if (term !== date && window.includes(term)) {
                    matchCount++;
                }
            });

            const score = matchCount / (anchorTerms.length - 1); // 날짜 제외

            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    start: windowStart,
                    end: windowEnd,
                    confidence: Math.min(0.95, 0.5 + score * 0.5) // 0.5 ~ 0.95
                };
            }
        });

        return bestMatch;
    }

    /**
     * 다른 Anchor로 위치 찾기 (날짜 없을 때)
     * @param {string} rawText - 원문
     * @param {Array<string>} anchorTerms - Anchor 키워드
     * @returns {Object|null} {start, end, confidence}
     */
    findByOtherAnchors(rawText, anchorTerms) {
        // 가장 긴 anchor를 먼저 시도 (더 구체적)
        const sortedTerms = anchorTerms.sort((a, b) => b.length - a.length);

        for (const term of sortedTerms) {
            const pos = rawText.indexOf(term);
            if (pos !== -1) {
                // 찾았으면 주변 ±300자 반환
                const start = Math.max(0, pos - 300);
                const end = Math.min(rawText.length, pos + term.length + 300);

                return {
                    start,
                    end,
                    confidence: 0.6 // 날짜 없이 찾은 경우 낮은 신뢰도
                };
            }
        }

        return null;
    }

    /**
     * 문자열의 모든 출현 위치 찾기
     * @param {string} text - 검색 대상 텍스트
     * @param {string} searchTerm - 검색어
     * @returns {Array<number>} 위치 배열
     */
    findAllOccurrences(text, searchTerm) {
        const positions = [];
        let pos = text.indexOf(searchTerm);

        while (pos !== -1) {
            positions.push(pos);
            pos = text.indexOf(searchTerm, pos + 1);
        }

        return positions;
    }

    /**
     * TextPreview 생성
     * @param {string} rawText - 원문
     * @param {number} start - 시작 위치
     * @param {number} end - 종료 위치
     * @param {number} maxLength - 최대 길이 (기본 200자)
     * @returns {string} Preview 텍스트
     */
    generateTextPreview(rawText, start, end, maxLength = 200) {
        const spanLength = end - start;

        if (spanLength <= maxLength) {
            // 전체 span이 maxLength보다 짧으면 그대로 반환
            return rawText.substring(start, end).trim();
        }

        // 너무 길면 앞부분만 + "..."
        const preview = rawText.substring(start, start + maxLength).trim();
        return preview + '...';
    }

    /**
     * 빈 SourceSpan 생성
     * @param {string} reason - 누락 이유
     * @returns {Object} 빈 sourceSpan
     */
    createEmptySpan(reason) {
        return {
            start: 0,
            end: 0,
            textPreview: '',
            anchorTerms: [],
            confidence: 0,
            missingReason: reason
        };
    }

    /**
     * 이벤트 배열의 sourceSpan 첨부율 계산
     * @param {Array} events - MedicalEvent 배열
     * @returns {Object} 통계
     */
    calculateAttachmentRate(events) {
        const total = events.length;
        const withSpan = events.filter(e =>
            e.sourceSpan &&
            e.sourceSpan.textPreview &&
            e.sourceSpan.textPreview.length > 0
        ).length;

        const rate = total > 0 ? withSpan / total : 0;

        return {
            total,
            withSpan,
            withoutSpan: total - withSpan,
            rate,
            ratePercent: (rate * 100).toFixed(1),
            missingSpans: this.missingSpans
        };
    }

    /**
     * 누락된 sourceSpan 로그 출력
     */
    logMissingSpans() {
        if (this.missingSpans.length === 0) {
            console.log('✅ 모든 이벤트에 sourceSpan 첨부됨');
            return;
        }

        console.log(`⚠️ sourceSpan 누락: ${this.missingSpans.length}개`);
        this.missingSpans.forEach((missing, index) => {
            console.log(`  ${index + 1}. ${missing.eventId} (${missing.date} ${missing.hospital})`);
            console.log(`     이유: ${missing.reason}`);
        });
    }

    /**
     * 누락 추적 초기화
     */
    resetMissingSpans() {
        this.missingSpans = [];
    }
}

// Singleton export
const sourceSpanManager = new SourceSpanManager();
export default sourceSpanManager;

// Named export
export {
    SourceSpanManager
};
