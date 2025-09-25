/**
 * 텍스트 처리 단계별 변화 시각화 모듈
 * 원본 → 기본후처리 → 하이브리드후처리 → AI보고서 단계별 diff 표시
 */

class TextDiffVisualizer {
    constructor() {
        this.stages = ['original', 'basic', 'hybrid', 'ai'];
        this.stageNames = {
            original: '원본 텍스트',
            basic: '기본 후처리',
            hybrid: '하이브리드 처리',
            ai: 'AI 보고서'
        };
        this.currentComparison = null;
    }

    /**
     * 두 텍스트 간의 차이점을 계산하고 시각화
     * @param {string} text1 - 이전 단계 텍스트
     * @param {string} text2 - 현재 단계 텍스트
     * @param {string} fromStage - 이전 단계명
     * @param {string} toStage - 현재 단계명
     * @returns {Object} 차이점 분석 결과
     */
    generateDiff(text1, text2, fromStage, toStage) {
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        
        const diff = this.computeLineDiff(lines1, lines2);
        const stats = this.calculateDiffStats(diff);
        
        return {
            fromStage,
            toStage,
            diff,
            stats,
            visualHtml: this.generateDiffHtml(diff, fromStage, toStage)
        };
    }

    /**
     * 라인 단위 차이점 계산 (간단한 LCS 알고리즘 사용)
     */
    computeLineDiff(lines1, lines2) {
        const m = lines1.length;
        const n = lines2.length;
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
        
        // LCS 길이 계산
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (lines1[i - 1].trim() === lines2[j - 1].trim()) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }
        
        // 역추적하여 차이점 찾기
        const diff = [];
        let i = m, j = n;
        
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && lines1[i - 1].trim() === lines2[j - 1].trim()) {
                diff.unshift({
                    type: 'equal',
                    line1: lines1[i - 1],
                    line2: lines2[j - 1],
                    lineNum1: i,
                    lineNum2: j
                });
                i--;
                j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                diff.unshift({
                    type: 'added',
                    line2: lines2[j - 1],
                    lineNum2: j
                });
                j--;
            } else if (i > 0) {
                diff.unshift({
                    type: 'removed',
                    line1: lines1[i - 1],
                    lineNum1: i
                });
                i--;
            }
        }
        
        return diff;
    }

    /**
     * 차이점 통계 계산
     */
    calculateDiffStats(diff) {
        const stats = {
            total: diff.length,
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0
        };
        
        diff.forEach(item => {
            switch (item.type) {
                case 'added':
                    stats.added++;
                    break;
                case 'removed':
                    stats.removed++;
                    break;
                case 'equal':
                    stats.unchanged++;
                    break;
            }
        });
        
        stats.changeRate = Math.round(((stats.added + stats.removed) / stats.total) * 100);
        
        return stats;
    }

    /**
     * 차이점을 HTML로 시각화
     */
    generateDiffHtml(diff, fromStage, toStage) {
        let html = `
            <div class="diff-container">
                <div class="diff-header">
                    <h3>${this.stageNames[fromStage]} → ${this.stageNames[toStage]} 변화 분석</h3>
                    <div class="diff-legend">
                        <span class="legend-item removed">🗑️ 제거된 내용</span>
                        <span class="legend-item added">➕ 추가된 내용</span>
                        <span class="legend-item unchanged">✅ 변경없음</span>
                    </div>
                </div>
                <div class="diff-content">
        `;
        
        diff.forEach((item, index) => {
            switch (item.type) {
                case 'removed':
                    html += `
                        <div class="diff-line removed" data-line="${item.lineNum1}">
                            <span class="line-number">${item.lineNum1}</span>
                            <span class="line-content">- ${this.escapeHtml(item.line1)}</span>
                        </div>
                    `;
                    break;
                case 'added':
                    html += `
                        <div class="diff-line added" data-line="${item.lineNum2}">
                            <span class="line-number">${item.lineNum2}</span>
                            <span class="line-content">+ ${this.escapeHtml(item.line2)}</span>
                        </div>
                    `;
                    break;
                case 'equal':
                    if (this.shouldShowUnchangedLine(diff, index)) {
                        html += `
                            <div class="diff-line unchanged" data-line1="${item.lineNum1}" data-line2="${item.lineNum2}">
                                <span class="line-number">${item.lineNum1}/${item.lineNum2}</span>
                                <span class="line-content">  ${this.escapeHtml(item.line1)}</span>
                            </div>
                        `;
                    }
                    break;
            }
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    /**
     * 변경되지 않은 라인을 표시할지 결정 (컨텍스트 제공)
     */
    shouldShowUnchangedLine(diff, index) {
        const contextLines = 2;
        
        // 변경사항 주변의 컨텍스트 라인만 표시
        for (let i = Math.max(0, index - contextLines); i <= Math.min(diff.length - 1, index + contextLines); i++) {
            if (i !== index && (diff[i].type === 'added' || diff[i].type === 'removed')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 단어 단위 차이점 하이라이트
     */
    highlightWordDiff(text1, text2) {
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        
        const wordDiff = this.computeWordDiff(words1, words2);
        
        return {
            highlighted1: this.generateWordHighlight(wordDiff, 'from'),
            highlighted2: this.generateWordHighlight(wordDiff, 'to')
        };
    }

    /**
     * 단어 단위 차이점 계산
     */
    computeWordDiff(words1, words2) {
        // 간단한 단어 매칭 알고리즘
        const diff = [];
        let i = 0, j = 0;
        
        while (i < words1.length || j < words2.length) {
            if (i < words1.length && j < words2.length && words1[i] === words2[j]) {
                diff.push({ type: 'equal', word: words1[i] });
                i++;
                j++;
            } else if (i < words1.length && (j >= words2.length || !words2.slice(j).includes(words1[i]))) {
                diff.push({ type: 'removed', word: words1[i] });
                i++;
            } else if (j < words2.length) {
                diff.push({ type: 'added', word: words2[j] });
                j++;
            }
        }
        
        return diff;
    }

    /**
     * 단어 하이라이트 HTML 생성
     */
    generateWordHighlight(wordDiff, direction) {
        let html = '';
        
        wordDiff.forEach(item => {
            switch (item.type) {
                case 'equal':
                    html += `<span class="word-unchanged">${this.escapeHtml(item.word)}</span> `;
                    break;
                case 'removed':
                    if (direction === 'from') {
                        html += `<span class="word-removed">${this.escapeHtml(item.word)}</span> `;
                    }
                    break;
                case 'added':
                    if (direction === 'to') {
                        html += `<span class="word-added">${this.escapeHtml(item.word)}</span> `;
                    }
                    break;
            }
        });
        
        return html.trim();
    }

    /**
     * 텍스트 처리 단계별 변화 요약 생성
     */
    generateProcessingSummary(originalText, basicText, hybridText, aiText) {
        const stages = {
            original: originalText,
            basic: basicText,
            hybrid: hybridText,
            ai: aiText
        };
        
        const summary = {
            totalStages: 4,
            changes: [],
            overallStats: {
                originalLength: originalText.length,
                finalLength: aiText.length,
                compressionRatio: Math.round((1 - aiText.length / originalText.length) * 100)
            }
        };
        
        // 각 단계별 변화 분석
        const stageKeys = ['original', 'basic', 'hybrid', 'ai'];
        for (let i = 0; i < stageKeys.length - 1; i++) {
            const fromStage = stageKeys[i];
            const toStage = stageKeys[i + 1];
            const diff = this.generateDiff(stages[fromStage], stages[toStage], fromStage, toStage);
            summary.changes.push(diff);
        }
        
        return summary;
    }

    /**
     * 처리 단계별 키워드 추출 및 변화 추적
     */
    trackKeywordChanges(originalText, basicText, hybridText, aiText) {
        const extractKeywords = (text) => {
            // 의료 관련 키워드 추출 (간단한 정규식 기반)
            const medicalKeywords = text.match(/\b(진단|치료|처방|검사|수술|입원|퇴원|증상|질환|약물|병원|의사|간호사)\b/g) || [];
            const dateKeywords = text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/g) || [];
            const numberKeywords = text.match(/\d+(\.\d+)?\s*(mg|ml|cc|회|일|시간)/g) || [];
            
            return {
                medical: [...new Set(medicalKeywords)],
                dates: [...new Set(dateKeywords)],
                numbers: [...new Set(numberKeywords)]
            };
        };
        
        return {
            original: extractKeywords(originalText),
            basic: extractKeywords(basicText),
            hybrid: extractKeywords(hybridText),
            ai: extractKeywords(aiText)
        };
    }

    /**
     * 데이터 품질 점수 계산
     */
    calculateQualityScore(originalText, processedText) {
        const metrics = {
            completeness: this.calculateCompleteness(originalText, processedText),
            structure: this.calculateStructureScore(processedText),
            readability: this.calculateReadabilityScore(processedText),
            medicalAccuracy: this.calculateMedicalAccuracyScore(processedText)
        };
        
        const overallScore = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;
        
        return {
            overall: Math.round(overallScore),
            metrics
        };
    }

    calculateCompleteness(original, processed) {
        const originalKeywords = this.extractImportantKeywords(original);
        const processedKeywords = this.extractImportantKeywords(processed);
        
        const preservedKeywords = originalKeywords.filter(keyword => 
            processedKeywords.some(pk => pk.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        return Math.round((preservedKeywords.length / originalKeywords.length) * 100);
    }

    calculateStructureScore(text) {
        // 구조화 점수 (날짜, 섹션 구분 등)
        let score = 0;
        
        if (text.includes('===') || text.includes('---')) score += 25; // 섹션 구분
        if (/\d{4}[-.]\d{1,2}[-.]\d{1,2}/.test(text)) score += 25; // 날짜 형식
        if (text.includes(':') && text.includes('\n')) score += 25; // 키-값 구조
        if (text.length > 100 && text.length < 5000) score += 25; // 적절한 길이
        
        return score;
    }

    calculateReadabilityScore(text) {
        // 가독성 점수 (간단한 휴리스틱)
        const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
        const avgSentenceLength = text.length / sentences.length;
        
        let score = 100;
        if (avgSentenceLength > 100) score -= 20; // 너무 긴 문장
        if (avgSentenceLength < 10) score -= 10; // 너무 짧은 문장
        if (!/[가-힣]/.test(text)) score -= 30; // 한글 없음
        
        return Math.max(0, score);
    }

    calculateMedicalAccuracyScore(text) {
        // 의료 정확성 점수
        const medicalTerms = ['진단', '치료', '처방', '검사', '증상', '질환'];
        const foundTerms = medicalTerms.filter(term => text.includes(term));
        
        return Math.round((foundTerms.length / medicalTerms.length) * 100);
    }

    extractImportantKeywords(text) {
        // 중요 키워드 추출 (의료 용어, 날짜, 수치 등)
        const keywords = [];
        
        // 의료 용어
        const medicalTerms = text.match(/\b(진단|치료|처방|검사|수술|입원|퇴원|증상|질환|약물|병원|의사|간호사|환자)\b/g) || [];
        keywords.push(...medicalTerms);
        
        // 날짜
        const dates = text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/g) || [];
        keywords.push(...dates);
        
        // 수치와 단위
        const numbers = text.match(/\d+(\.\d+)?\s*(mg|ml|cc|회|일|시간|년|개월|주)/g) || [];
        keywords.push(...numbers);
        
        return [...new Set(keywords)];
    }
}

// 전역 인스턴스 생성
window.TextDiffVisualizer = TextDiffVisualizer;

// 모듈 내보내기 (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextDiffVisualizer;
}