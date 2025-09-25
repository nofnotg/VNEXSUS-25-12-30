/**
 * 고급 기능 모듈
 * 검색, 필터링, 내보내기, 히스토리 비교 등의 기능을 제공
 */

class AdvancedFeatures {
    constructor() {
        this.searchHistory = [];
        this.filterSettings = {
            dateRange: { start: null, end: null },
            textLength: { min: 0, max: Infinity },
            processingStage: 'all',
            keywords: []
        };
        this.exportFormats = ['pdf', 'excel', 'json', 'txt'];
        this.comparisonHistory = [];
        this.notifications = [];
        
        this.initializeFeatures();
    }

    initializeFeatures() {
        this.setupSearchFunctionality();
        this.setupFilterSystem();
        this.setupExportSystem();
        this.setupComparisonSystem();
        this.setupNotificationSystem();
    }

    // 검색 기능
    setupSearchFunctionality() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <div class="search-box">
                <input type="text" id="globalSearch" class="form-control" placeholder="텍스트 검색...">
                <div class="search-options">
                    <label><input type="checkbox" id="caseSensitive"> 대소문자 구분</label>
                    <label><input type="checkbox" id="wholeWord"> 전체 단어</label>
                    <label><input type="checkbox" id="useRegex"> 정규식</label>
                </div>
                <div class="search-results" id="searchResults"></div>
            </div>
        `;
        
        return searchContainer;
    }

    performSearch(query, options = {}) {
        const {
            caseSensitive = false,
            wholeWord = false,
            useRegex = false,
            stage = 'all'
        } = options;

        let searchPattern;
        if (useRegex) {
            try {
                searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
            } catch (e) {
                console.error('Invalid regex pattern:', e);
                return [];
            }
        } else {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
            searchPattern = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        }

        const results = [];
        const textStages = this.getTextStages(stage);

        textStages.forEach((stageData, stageIndex) => {
            const matches = [...stageData.text.matchAll(searchPattern)];
            matches.forEach(match => {
                const startIndex = Math.max(0, match.index - 50);
                const endIndex = Math.min(stageData.text.length, match.index + match[0].length + 50);
                const context = stageData.text.substring(startIndex, endIndex);
                
                results.push({
                    stage: stageData.name,
                    match: match[0],
                    context: context,
                    position: match.index,
                    line: this.getLineNumber(stageData.text, match.index)
                });
            });
        });

        this.searchHistory.push({ query, options, results, timestamp: new Date() });
        return results;
    }

    // 필터링 시스템
    setupFilterSystem() {
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-container';
        filterContainer.innerHTML = `
            <div class="filter-panel">
                <h4>필터 설정</h4>
                <div class="filter-group">
                    <label>날짜 범위:</label>
                    <input type="date" id="startDate" class="form-control">
                    <input type="date" id="endDate" class="form-control">
                </div>
                <div class="filter-group">
                    <label>텍스트 길이:</label>
                    <input type="number" id="minLength" class="form-control" placeholder="최소">
                    <input type="number" id="maxLength" class="form-control" placeholder="최대">
                </div>
                <div class="filter-group">
                    <label>처리 단계:</label>
                    <select id="stageFilter" class="form-control">
                        <option value="all">전체</option>
                        <option value="original">원본</option>
                        <option value="basic">기본 후처리</option>
                        <option value="hybrid">하이브리드 후처리</option>
                        <option value="ai_report">AI 보고서</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>키워드:</label>
                    <input type="text" id="keywordFilter" class="form-control" placeholder="쉼표로 구분">
                </div>
                <div class="filter-actions">
                    <button id="applyFilter" class="btn btn-primary">필터 적용</button>
                    <button id="clearFilter" class="btn btn-secondary">필터 초기화</button>
                </div>
            </div>
        `;
        
        return filterContainer;
    }

    applyFilters(data) {
        return data.filter(item => {
            // 날짜 필터
            if (this.filterSettings.dateRange.start && item.date < this.filterSettings.dateRange.start) {
                return false;
            }
            if (this.filterSettings.dateRange.end && item.date > this.filterSettings.dateRange.end) {
                return false;
            }

            // 텍스트 길이 필터
            const textLength = item.text ? item.text.length : 0;
            if (textLength < this.filterSettings.textLength.min || textLength > this.filterSettings.textLength.max) {
                return false;
            }

            // 처리 단계 필터
            if (this.filterSettings.processingStage !== 'all' && item.stage !== this.filterSettings.processingStage) {
                return false;
            }

            // 키워드 필터
            if (this.filterSettings.keywords.length > 0) {
                const hasKeyword = this.filterSettings.keywords.some(keyword => 
                    item.text && item.text.toLowerCase().includes(keyword.toLowerCase())
                );
                if (!hasKeyword) return false;
            }

            return true;
        });
    }

    // 내보내기 시스템
    setupExportSystem() {
        const exportContainer = document.createElement('div');
        exportContainer.className = 'export-container';
        exportContainer.innerHTML = `
            <div class="export-panel">
                <h4>데이터 내보내기</h4>
                <div class="export-options">
                    <div class="export-format">
                        <label>형식 선택:</label>
                        <select id="exportFormat" class="form-control">
                            <option value="pdf">PDF</option>
                            <option value="excel">Excel</option>
                            <option value="json">JSON</option>
                            <option value="txt">텍스트</option>
                        </select>
                    </div>
                    <div class="export-content">
                        <label>내보낼 내용:</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" id="includeOriginal" checked> 원본 텍스트</label>
                            <label><input type="checkbox" id="includeProcessed" checked> 처리된 텍스트</label>
                            <label><input type="checkbox" id="includeMetrics" checked> 성능 메트릭</label>
                            <label><input type="checkbox" id="includeLogs"> 처리 로그</label>
                        </div>
                    </div>
                    <div class="export-settings">
                        <label><input type="checkbox" id="includeTimestamp" checked> 타임스탬프 포함</label>
                        <label><input type="checkbox" id="compressOutput"> 압축 출력</label>
                    </div>
                </div>
                <button id="exportData" class="btn btn-success">내보내기</button>
            </div>
        `;
        
        return exportContainer;
    }

    async exportData(format, options = {}) {
        const {
            includeOriginal = true,
            includeProcessed = true,
            includeMetrics = true,
            includeLogs = false,
            includeTimestamp = true,
            compressOutput = false
        } = options;

        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                format: format,
                version: '1.0'
            },
            data: {}
        };

        if (includeOriginal) {
            exportData.data.original = await this.getOriginalData();
        }
        if (includeProcessed) {
            exportData.data.processed = await this.getProcessedData();
        }
        if (includeMetrics) {
            exportData.data.metrics = await this.getMetricsData();
        }
        if (includeLogs) {
            exportData.data.logs = await this.getLogsData();
        }

        switch (format) {
            case 'pdf':
                return this.exportToPDF(exportData);
            case 'excel':
                return this.exportToExcel(exportData);
            case 'json':
                return this.exportToJSON(exportData, compressOutput);
            case 'txt':
                return this.exportToText(exportData);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    // 히스토리 비교 시스템
    setupComparisonSystem() {
        const comparisonContainer = document.createElement('div');
        comparisonContainer.className = 'comparison-container';
        comparisonContainer.innerHTML = `
            <div class="comparison-panel">
                <h4>히스토리 비교</h4>
                <div class="comparison-selector">
                    <div class="selector-group">
                        <label>비교 대상 A:</label>
                        <select id="compareA" class="form-control">
                            <option value="">선택하세요</option>
                        </select>
                    </div>
                    <div class="selector-group">
                        <label>비교 대상 B:</label>
                        <select id="compareB" class="form-control">
                            <option value="">선택하세요</option>
                        </select>
                    </div>
                </div>
                <div class="comparison-options">
                    <label><input type="checkbox" id="showLineNumbers" checked> 줄 번호 표시</label>
                    <label><input type="checkbox" id="ignoreWhitespace"> 공백 무시</label>
                    <label><input type="checkbox" id="showStatistics" checked> 통계 표시</label>
                </div>
                <button id="startComparison" class="btn btn-primary">비교 시작</button>
                <div id="comparisonResult" class="comparison-result"></div>
            </div>
        `;
        
        return comparisonContainer;
    }

    compareTexts(textA, textB, options = {}) {
        const {
            ignoreWhitespace = false,
            showLineNumbers = true,
            showStatistics = true
        } = options;

        let processedA = textA;
        let processedB = textB;

        if (ignoreWhitespace) {
            processedA = textA.replace(/\s+/g, ' ').trim();
            processedB = textB.replace(/\s+/g, ' ').trim();
        }

        const linesA = processedA.split('\n');
        const linesB = processedB.split('\n');
        
        const diff = this.calculateDiff(linesA, linesB);
        const statistics = this.calculateDiffStatistics(diff);

        const result = {
            diff: diff,
            statistics: showStatistics ? statistics : null,
            options: options
        };

        this.comparisonHistory.push({
            timestamp: new Date(),
            textA: textA.substring(0, 100) + '...',
            textB: textB.substring(0, 100) + '...',
            result: result
        });

        return result;
    }

    // 알림 시스템
    setupNotificationSystem() {
        const notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        notificationContainer.id = 'notificationContainer';
        document.body.appendChild(notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        const container = document.getElementById('notificationContainer');
        container.appendChild(notification);

        // 자동 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);

        // 수동 제거
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        this.notifications.push({
            message,
            type,
            timestamp: new Date()
        });
    }

    // 유틸리티 메서드들
    getTextStages(stage) {
        // 실제 구현에서는 현재 로드된 데이터에서 가져옴
        return [];
    }

    getLineNumber(text, position) {
        return text.substring(0, position).split('\n').length;
    }

    calculateDiff(linesA, linesB) {
        // 간단한 diff 알고리즘 구현
        const diff = [];
        let i = 0, j = 0;

        while (i < linesA.length || j < linesB.length) {
            if (i >= linesA.length) {
                diff.push({ type: 'added', content: linesB[j], lineB: j + 1 });
                j++;
            } else if (j >= linesB.length) {
                diff.push({ type: 'removed', content: linesA[i], lineA: i + 1 });
                i++;
            } else if (linesA[i] === linesB[j]) {
                diff.push({ type: 'unchanged', content: linesA[i], lineA: i + 1, lineB: j + 1 });
                i++;
                j++;
            } else {
                diff.push({ type: 'removed', content: linesA[i], lineA: i + 1 });
                diff.push({ type: 'added', content: linesB[j], lineB: j + 1 });
                i++;
                j++;
            }
        }

        return diff;
    }

    calculateDiffStatistics(diff) {
        const stats = {
            total: diff.length,
            added: 0,
            removed: 0,
            unchanged: 0,
            modified: 0
        };

        diff.forEach(item => {
            stats[item.type]++;
        });

        stats.changePercentage = ((stats.added + stats.removed) / stats.total * 100).toFixed(2);
        return stats;
    }

    // 내보내기 구현 메서드들
    async exportToPDF(data) {
        // PDF 내보내기 구현 (jsPDF 라이브러리 사용)
        this.showNotification('PDF 내보내기 기능은 추후 구현 예정입니다.', 'info');
    }

    async exportToExcel(data) {
        // Excel 내보내기 구현 (SheetJS 라이브러리 사용)
        this.showNotification('Excel 내보내기 기능은 추후 구현 예정입니다.', 'info');
    }

    async exportToJSON(data, compress = false) {
        const jsonString = JSON.stringify(data, null, compress ? 0 : 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `text-processing-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('JSON 파일이 다운로드되었습니다.', 'success');
    }

    async exportToText(data) {
        let textContent = `텍스트 처리 데이터 내보내기\n`;
        textContent += `내보내기 날짜: ${new Date().toLocaleString()}\n\n`;
        
        if (data.data.original) {
            textContent += `=== 원본 데이터 ===\n${JSON.stringify(data.data.original, null, 2)}\n\n`;
        }
        
        if (data.data.processed) {
            textContent += `=== 처리된 데이터 ===\n${JSON.stringify(data.data.processed, null, 2)}\n\n`;
        }
        
        if (data.data.metrics) {
            textContent += `=== 성능 메트릭 ===\n${JSON.stringify(data.data.metrics, null, 2)}\n\n`;
        }
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `text-processing-data-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('텍스트 파일이 다운로드되었습니다.', 'success');
    }

    // 데이터 가져오기 메서드들 (실제 구현에서는 적절한 데이터 소스에서 가져옴)
    async getOriginalData() {
        return { placeholder: 'Original data would be loaded here' };
    }

    async getProcessedData() {
        return { placeholder: 'Processed data would be loaded here' };
    }

    async getMetricsData() {
        return { placeholder: 'Metrics data would be loaded here' };
    }

    async getLogsData() {
        return { placeholder: 'Logs data would be loaded here' };
    }
}

// 전역 인스턴스 생성
window.AdvancedFeatures = AdvancedFeatures;