// 텍스트 처리 모니터링 대시보드 JavaScript

class TextProcessingDashboard {
    constructor() {
        this.diffVisualizer = new TextDiffVisualizer();
        // VirtualScrollOptimizer는 필요할 때 초기화
        this.virtualScrollOptimizer = null;
        this.processMonitoringSystem = new ProcessMonitoringSystem();
        this.currentCase = 'Case1';
        this.textData = {
            original: '',
            basicProcessed: '',
            hybridProcessed: '',
            aiReport: ''
        };
        this.isMonitoringVisible = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCaseData(this.currentCase);
        this.initializeMonitoringSystem();
        this.initializeAdvancedFeatures();
    }

    initializeVirtualScrollOptimizer(container) {
        if (!this.virtualScrollOptimizer && container) {
            this.virtualScrollOptimizer = new VirtualScrollOptimizer(container, {
                itemHeight: 25,
                bufferSize: 10,
                renderItem: (data, index) => {
                    return `<div class="text-line">${data}</div>`;
                }
            });
        }
        return this.virtualScrollOptimizer;
    }

    initializeAdvancedFeatures() {
        // 고급 기능 초기화
        if (typeof AdvancedFeatures !== 'undefined') {
            this.advancedFeatures = new AdvancedFeatures();
        }
    }

    setupEventListeners() {
        // 케이스 선택 이벤트
        const caseSelector = document.getElementById('case-selector');
        const toggleMonitoringBtn = document.getElementById('toggleMonitoringBtn');
        
        if (caseSelector) {
            caseSelector.addEventListener('change', (e) => {
                this.currentCase = e.target.value;
                this.loadCaseData(this.currentCase);
            });
        }
        
        if (toggleMonitoringBtn) {
            toggleMonitoringBtn.addEventListener('click', () => {
                this.toggleMonitoringView();
            });
        }
        
        // 고급 기능 관련 이벤트 리스너
        const toggleAdvancedFeaturesBtn = document.getElementById('toggleAdvancedFeaturesBtn');
        if (toggleAdvancedFeaturesBtn) {
            toggleAdvancedFeaturesBtn.addEventListener('click', () => {
                this.advancedFeatures.togglePanel();
            });
        }

        // 처리 단계 버튼 이벤트
        document.querySelectorAll('.stage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stage = e.target.dataset.stage;
                this.showStage(stage);
            });
        });
        
        // 모니터링 시스템 이벤트 리스너
        this.setupMonitoringEventListeners();
    }

    async loadCaseData(caseId) {
        try {
            // 원본 데이터 로드
            const originalResponse = await fetch(`src/rag/case_sample/${caseId}.txt`);
            if (!originalResponse.ok) {
                throw new Error(`Failed to load original case data: ${originalResponse.status}`);
            }
            this.textData.original = await originalResponse.text();

            // 후처리 결과 로드
            const possibleFiles = [
                `backend/postprocess/test_outputs/${caseId.toLowerCase()}_extended_result.json`,
                `backend/postprocess/test_outputs/${caseId.toLowerCase()}_fixed_result.json`
            ];
            
            let processedData = null;
            for (const file of possibleFiles) {
                try {
                    console.log(`Attempting to load: ${file}`);
                    const response = await fetch(file);
                    console.log(`Response status for ${file}:`, response.status);
                    if (response.ok) {
                        const text = await response.text();
                        console.log(`Text length for ${file}:`, text.length);
                        console.log(`First 100 chars:`, text.substring(0, 100));
                        if (text.trim()) {
                            processedData = JSON.parse(text);
                            console.log(`Successfully parsed ${file}`);
                            break;
                        } else {
                            console.log(`Empty response from ${file}`);
                        }
                    }
                } catch (e) {
                    console.error(`Failed to load ${file}:`, e);
                }
            }
            
            // AI 검증 결과 로드 (실제 존재하는 경로 시도)
            let aiData = null;
            const aiResultDirs = [
                'verification-2025-08-21T11-47-50-712Z',
                'verification-2025-08-21T11-31-31-209Z'
            ];
            
            for (const dir of aiResultDirs) {
                try {
                    const aiUrl = `backend/ai-verification/results/${dir}/gpt-4o-mini-results.json`;
                    console.log(`Attempting to load AI results: ${aiUrl}`);
                    const aiResponse = await fetch(aiUrl);
                    console.log(`AI Response status for ${dir}:`, aiResponse.status);
                    if (aiResponse.ok) {
                        const text = await aiResponse.text();
                        console.log(`AI Text length for ${dir}:`, text.length);
                        console.log(`AI First 100 chars:`, text.substring(0, 100));
                        if (text.trim()) {
                            aiData = JSON.parse(text);
                            console.log(`Successfully parsed AI results from ${dir}`);
                            break;
                        } else {
                            console.log(`Empty AI response from ${dir}`);
                        }
                    }
                } catch (e) {
                    console.error(`AI 결과 로드 실패 (${dir}):`, e);
                    continue;
                }
            }
            
            if (!aiData) {
                throw new Error('AI 검증 결과를 찾을 수 없습니다.');
            }

            this.processLoadedData(processedData, aiData);
            this.updateDisplay();
            this.generateDiffVisualization();
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.showError('데이터를 로드할 수 없습니다.');
        }
    }

    processLoadedData(processedData, aiData) {
        // 기본 후처리 텍스트 생성
        this.textData.basicProcessed = this.generateBasicProcessedText(processedData);
        
        // 하이브리드 후처리 텍스트 생성
        this.textData.hybridProcessed = this.generateHybridProcessedText(processedData);
        
        // AI 보고서 텍스트 생성
        this.textData.aiReport = this.generateAIReportText(aiData);
    }

    generateBasicProcessedText(data) {
        // 기본 후처리 로직 구현
        let text = '';
        if (data.medical_records) {
            data.medical_records.forEach(record => {
                text += `날짜: ${record.date}\n`;
                text += `내용: ${record.content}\n\n`;
            });
        }
        return text;
    }

    generateHybridProcessedText(data) {
        // 하이브리드 후처리 로직 구현
        let text = this.generateBasicProcessedText(data);
        
        // 추가 정제 로직
        if (data.patient_info) {
            text = `환자 정보:\n${JSON.stringify(data.patient_info, null, 2)}\n\n` + text;
        }
        
        return text;
    }

    generateAIReportText(aiData) {
        // AI 보고서 생성
        const caseData = aiData.results?.find(r => r.case_id === this.currentCase);
        if (!caseData) return 'AI 보고서를 찾을 수 없습니다.';
        
        return `AI 분석 결과:\n${JSON.stringify(caseData, null, 2)}`;
    }

    generateDiffVisualization() {
        // 각 단계별 diff 생성
        const stages = [
            { id: 'basic', from: 'original', to: 'basicProcessed' },
            { id: 'hybrid', from: 'basicProcessed', to: 'hybridProcessed' },
            { id: 'ai', from: 'hybridProcessed', to: 'aiReport' }
        ];

        stages.forEach(stage => {
            const fromText = this.textData[stage.from];
            const toText = this.textData[stage.to];
            const diffResult = this.diffVisualizer.calculateDiff(fromText, toText);
            
            // diff 컨테이너에 결과 저장
            const container = document.getElementById(`${stage.id}-diff-container`);
            if (container) {
                container.innerHTML = this.diffVisualizer.generateDiffHTML(diffResult);
            }
        });

        // 처리 요약 생성
        this.generateProcessingSummary();
        
        // 키워드 추적 생성
        this.generateKeywordTracking();
        
        // 품질 점수 생성
        this.generateQualityScore();
        
        // 고급 기능에 데이터 업데이트
        if (this.advancedFeatures) {
            this.advancedFeatures.updateData({
                original: this.textData.original,
                basicProcessed: this.textData.basicProcessed,
                hybridProcessed: this.textData.hybridProcessed,
                aiReport: this.textData.aiReport,
                currentCase: this.currentCase
            });
        }
    }

    generateProcessingSummary() {
        const summaryStats = document.getElementById('summary-stats');
        const summaryChanges = document.getElementById('summary-changes');
        
        if (!summaryStats || !summaryChanges) return;

        // 전체 통계
        const originalLength = this.textData.original.length;
        const finalLength = this.textData.aiReport.length;
        const reductionRate = ((originalLength - finalLength) / originalLength * 100).toFixed(1);
        
        summaryStats.innerHTML = `
            <div class="summary-stat">
                <div class="summary-stat-value">${originalLength}</div>
                <div class="summary-stat-label">원본 문자수</div>
            </div>
            <div class="summary-stat">
                <div class="summary-stat-value">${finalLength}</div>
                <div class="summary-stat-label">최종 문자수</div>
            </div>
            <div class="summary-stat">
                <div class="summary-stat-value">${reductionRate}%</div>
                <div class="summary-stat-label">압축률</div>
            </div>
            <div class="summary-stat">
                <div class="summary-stat-value">4</div>
                <div class="summary-stat-label">처리 단계</div>
            </div>
        `;

        // 단계별 변화
        const stages = [
            { name: '기본 후처리', from: 'original', to: 'basicProcessed' },
            { name: '하이브리드 후처리', from: 'basicProcessed', to: 'hybridProcessed' },
            { name: 'AI 보고서', from: 'hybridProcessed', to: 'aiReport' }
        ];

        summaryChanges.innerHTML = stages.map(stage => {
            const fromLength = this.textData[stage.from].length;
            const toLength = this.textData[stage.to].length;
            const changeRate = ((toLength - fromLength) / fromLength * 100).toFixed(1);
            
            return `
                <div class="summary-change">
                    <div class="change-title">${stage.name}</div>
                    <div class="change-stats">
                        <span>${fromLength} → ${toLength}</span>
                        <span>${changeRate > 0 ? '+' : ''}${changeRate}%</span>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('processing-summary').style.display = 'block';
    }

    generateKeywordTracking() {
        const medicalKeywords = this.diffVisualizer.trackKeywords(this.textData.original, this.textData.aiReport, 'medical');
        const dateKeywords = this.diffVisualizer.trackKeywords(this.textData.original, this.textData.aiReport, 'date');
        const numberKeywords = this.diffVisualizer.trackKeywords(this.textData.original, this.textData.aiReport, 'number');

        this.renderKeywords('medical-keywords', medicalKeywords);
        this.renderKeywords('date-keywords', dateKeywords);
        this.renderKeywords('number-keywords', numberKeywords);

        document.getElementById('keyword-tracking').style.display = 'block';
    }

    renderKeywords(containerId, keywords) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = keywords.map(keyword => {
            const status = keyword.preserved ? 'preserved' : 'lost';
            return `<span class="keyword-tag ${keyword.type} ${status}">${keyword.word}</span>`;
        }).join('');
    }

    generateQualityScore() {
        const qualityScore = this.diffVisualizer.calculateQualityScore(
            this.textData.original,
            this.textData.aiReport
        );

        const qualityOverall = document.getElementById('quality-overall');
        const qualityMetrics = document.getElementById('quality-metrics');
        
        if (!qualityOverall || !qualityMetrics) return;

        const overallScore = Math.round((qualityScore.completeness + qualityScore.structure + qualityScore.readability + qualityScore.medicalAccuracy) / 4);
        
        qualityOverall.textContent = `${overallScore}/100`;
        qualityOverall.className = `quality-overall ${overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'poor'}`;

        qualityMetrics.innerHTML = `
            <div class="quality-metric">
                <div class="metric-value">${qualityScore.completeness}/100</div>
                <div class="metric-label">완성도</div>
            </div>
            <div class="quality-metric">
                <div class="metric-value">${qualityScore.structure}/100</div>
                <div class="metric-label">구조화</div>
            </div>
            <div class="quality-metric">
                <div class="metric-value">${qualityScore.readability}/100</div>
                <div class="metric-label">가독성</div>
            </div>
            <div class="quality-metric">
                <div class="metric-value">${qualityScore.medicalAccuracy}/100</div>
                <div class="metric-label">의료 정확성</div>
            </div>
        `;

        document.getElementById('quality-score').style.display = 'block';
    }

    updateDisplay() {
        // 텍스트 내용 업데이트
        this.updateTextContent('original-text', this.textData.original);
        this.updateTextContent('basic-processed-text', this.textData.basicProcessed);
        this.updateTextContent('hybrid-processed-text', this.textData.hybridProcessed);
        this.updateTextContent('ai-report-text', this.textData.aiReport);

        // 통계 업데이트
        this.updateStats();
    }

    updateTextContent(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = content;
        }
    }

    updateStats() {
        // 각 단계별 통계 업데이트
        const stages = ['original', 'basic', 'hybrid', 'ai'];
        const textKeys = ['original', 'basicProcessed', 'hybridProcessed', 'aiReport'];
        
        stages.forEach((stage, index) => {
            const text = this.textData[textKeys[index]];
            const length = text.length;
            const lines = text.split('\n').length;
            
            const lengthElement = document.getElementById(`${stage}-length`);
            const linesElement = document.getElementById(`${stage}-lines`);
            
            if (lengthElement) lengthElement.textContent = length;
            if (linesElement) linesElement.textContent = lines;
        });
    }

    showStage(stage) {
        // 단계별 표시 로직
        document.querySelectorAll('.stage-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-stage="${stage}"]`).classList.add('active');
        
        // 해당 단계의 텍스트 패널 강조
        document.querySelectorAll('.text-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(`${stage}-text-panel`) || 
                           document.getElementById(`${stage}-processed-panel`) ||
                           document.getElementById(`${stage}-report-panel`);
        
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }

    showError(message) {
        // 에러 메시지 표시
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const container = document.querySelector('.main-content');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
            
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }
    }
    
    // 모니터링 시스템 관련 메서드들
    initializeMonitoringSystem() {
        this.processMonitoringSystem.init();
        
        // 고급 기능 초기화
        this.initializeAdvancedFeatures();
    }
    
    setupMonitoringEventListeners() {
        // 처리 시작 버튼
        const startProcessBtn = document.getElementById('startProcessBtn');
        if (startProcessBtn) {
            startProcessBtn.addEventListener('click', () => {
                this.startProcessing();
            });
        }
        
        // 일시정지 버튼
        const pauseProcessBtn = document.getElementById('pauseProcessBtn');
        if (pauseProcessBtn) {
            pauseProcessBtn.addEventListener('click', () => {
                this.pauseProcessing();
            });
        }
        
        // 중지 버튼
        const stopProcessBtn = document.getElementById('stopProcessBtn');
        if (stopProcessBtn) {
            stopProcessBtn.addEventListener('click', () => {
                this.stopProcessing();
            });
        }
        
        // 로그 관련 버튼들
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.processMonitoringSystem.clearLogs();
            });
        }
        
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        if (exportLogsBtn) {
            exportLogsBtn.addEventListener('click', () => {
                this.exportLogs();
            });
        }
        
        // 메트릭 새로고침
        const refreshMetricsBtn = document.getElementById('refreshMetricsBtn');
        if (refreshMetricsBtn) {
            refreshMetricsBtn.addEventListener('click', () => {
                this.refreshMetrics();
            });
        }
        
        // 로그 탭 전환
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchLogTab(e.target.dataset.tab);
            }
        });
        
        // 필터 변경
        const dateFilter = document.getElementById('dateFilter');
        const statusFilter = document.getElementById('statusFilter');
        
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.filterDateBlocks();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.filterDateBlocks();
            });
        }
    }
    
    toggleMonitoringView() {
        const monitoringSection = document.getElementById('monitoringSection');
        const toggleBtn = document.getElementById('toggleMonitoringBtn');
        
        if (monitoringSection && toggleBtn) {
            this.isMonitoringVisible = !this.isMonitoringVisible;
            
            if (this.isMonitoringVisible) {
                monitoringSection.style.display = 'grid';
                toggleBtn.textContent = '텍스트 보기';
                this.processMonitoringSystem.updateUI();
            } else {
                monitoringSection.style.display = 'none';
                toggleBtn.textContent = '모니터링 보기';
            }
        }
    }
    
    startProcessing() {
        if (!this.currentCase) {
            alert('먼저 케이스를 선택해주세요.');
            return;
        }
        
        this.processMonitoringSystem.startProcessing(this.currentCase);
        
        // 버튼 상태 업데이트
        const startBtn = document.getElementById('startProcessBtn');
        const pauseBtn = document.getElementById('pauseProcessBtn');
        const stopBtn = document.getElementById('stopProcessBtn');
        
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = false;
    }
    
    pauseProcessing() {
        this.processMonitoringSystem.pauseProcessing();
        
        const startBtn = document.getElementById('startProcessBtn');
        const pauseBtn = document.getElementById('pauseProcessBtn');
        
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
    }
    
    stopProcessing() {
        this.processMonitoringSystem.stopProcessing();
        
        const startBtn = document.getElementById('startProcessBtn');
        const pauseBtn = document.getElementById('pauseProcessBtn');
        const stopBtn = document.getElementById('stopProcessBtn');
        
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
    }
    
    exportLogs() {
        const logs = this.processMonitoringSystem.getLogs();
        const logText = logs.map(log => 
            `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}\n${log.details || ''}`
        ).join('\n\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `processing-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    refreshMetrics() {
        this.processMonitoringSystem.updatePerformanceMetrics();
    }
    
    switchLogTab(tabType) {
        // 탭 버튼 활성화 상태 변경
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // 로그 필터링
        this.processMonitoringSystem.filterLogs(tabType);
    }
    
    filterDateBlocks() {
        const dateFilter = document.getElementById('dateFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        
        this.processMonitoringSystem.filterDateBlocks(dateFilter, statusFilter);
    }
}

// diff 토글 함수
function toggleDiffView(stage) {
    const textContent = document.querySelector(`#${stage}-processed-text, #${stage}-report-text`);
    const diffContainer = document.getElementById(`${stage}-diff-container`);
    const toggleBtn = document.querySelector(`#${stage}-processed-panel .diff-toggle-btn, #${stage}-report-panel .diff-toggle-btn`);
    
    if (!textContent || !diffContainer || !toggleBtn) return;
    
    if (diffContainer.style.display === 'none') {
        textContent.style.display = 'none';
        diffContainer.style.display = 'block';
        toggleBtn.textContent = '원본 보기';
    } else {
        textContent.style.display = 'block';
        diffContainer.style.display = 'none';
        toggleBtn.textContent = '변화 보기';
    }
}

// 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TextProcessingDashboard();
});