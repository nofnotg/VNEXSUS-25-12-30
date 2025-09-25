// 처리 과정 상세 모니터링 시스템

class ProcessMonitoringSystem {
    constructor() {
        this.processSteps = [
            { id: 'upload', name: '파일 업로드', status: 'pending', progress: 0, startTime: null, endTime: null },
            { id: 'ocr', name: 'OCR 처리', status: 'pending', progress: 0, startTime: null, endTime: null },
            { id: 'extraction', name: '텍스트 추출', status: 'pending', progress: 0, startTime: null, endTime: null },
            { id: 'basic_processing', name: '기본 후처리', status: 'pending', progress: 0, startTime: null, endTime: null },
            { id: 'hybrid_processing', name: '하이브리드 후처리', status: 'pending', progress: 0, startTime: null, endTime: null },
            { id: 'ai_report', name: 'AI 보고서 생성', status: 'pending', progress: 0, startTime: null, endTime: null }
        ];
        
        this.dateBlocks = [];
        this.processingLogs = [];
        this.errorLogs = [];
        this.performanceMetrics = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeMonitoringUI();
    }

    setupEventListeners() {
        // 실시간 모니터링 이벤트
        document.addEventListener('processStep', (e) => {
            this.updateProcessStep(e.detail.stepId, e.detail.status, e.detail.progress);
        });
        
        document.addEventListener('processError', (e) => {
            this.logError(e.detail.stepId, e.detail.error);
        });
        
        document.addEventListener('dateBlockProcessed', (e) => {
            this.updateDateBlock(e.detail.blockId, e.detail.data);
        });
    }

    initializeMonitoringUI() {
        this.createProcessFlowUI();
        this.createDateBlocksUI();
        this.createLogsUI();
        this.createPerformanceUI();
    }

    createProcessFlowUI() {
        const container = document.getElementById('process-flow-monitor');
        if (!container) return;
        
        container.innerHTML = `
            <div class="process-flow-header">
                <h3>처리 과정 모니터링</h3>
                <div class="flow-controls">
                    <button id="start-process-btn" class="btn btn-primary">처리 시작</button>
                    <button id="pause-process-btn" class="btn btn-secondary" disabled>일시정지</button>
                    <button id="stop-process-btn" class="btn btn-danger" disabled>중지</button>
                </div>
            </div>
            <div class="process-flow-timeline">
                ${this.processSteps.map(step => this.createStepElement(step)).join('')}
            </div>
            <div class="process-summary">
                <div class="summary-item">
                    <span class="summary-label">전체 진행률:</span>
                    <div class="progress-bar">
                        <div id="overall-progress" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span id="overall-percentage">0%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">예상 완료 시간:</span>
                    <span id="estimated-completion">계산 중...</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">경과 시간:</span>
                    <span id="elapsed-time">00:00:00</span>
                </div>
            </div>
        `;
        
        this.bindProcessControls();
    }

    createStepElement(step) {
        return `
            <div class="process-step" id="step-${step.id}" data-step="${step.id}">
                <div class="step-icon">
                    <div class="step-number">${this.processSteps.indexOf(step) + 1}</div>
                    <div class="step-status-indicator ${step.status}"></div>
                </div>
                <div class="step-content">
                    <div class="step-title">${step.name}</div>
                    <div class="step-progress">
                        <div class="progress-bar small">
                            <div class="progress-fill" style="width: ${step.progress}%"></div>
                        </div>
                        <span class="progress-text">${step.progress}%</span>
                    </div>
                    <div class="step-timing">
                        <span class="start-time">${step.startTime ? this.formatTime(step.startTime) : '-'}</span>
                        <span class="duration">${this.calculateDuration(step)}</span>
                    </div>
                </div>
                <div class="step-details">
                    <button class="details-btn" onclick="toggleStepDetails('${step.id}')">상세보기</button>
                </div>
            </div>
        `;
    }

    createDateBlocksUI() {
        const container = document.getElementById('date-blocks-monitor');
        if (!container) return;
        
        container.innerHTML = `
            <div class="date-blocks-header">
                <h3>날짜별 데이터 블록 처리</h3>
                <div class="blocks-filter">
                    <select id="date-filter">
                        <option value="all">전체 날짜</option>
                    </select>
                    <select id="status-filter">
                        <option value="all">전체 상태</option>
                        <option value="pending">대기중</option>
                        <option value="processing">처리중</option>
                        <option value="completed">완료</option>
                        <option value="error">오류</option>
                    </select>
                </div>
            </div>
            <div class="date-blocks-grid" id="date-blocks-grid">
                <!-- 날짜 블록들이 동적으로 추가됩니다 -->
            </div>
        `;
    }

    createLogsUI() {
        const container = document.getElementById('processing-logs');
        if (!container) return;
        
        container.innerHTML = `
            <div class="logs-header">
                <h3>처리 로그</h3>
                <div class="logs-controls">
                    <button id="clear-logs-btn" class="btn btn-secondary">로그 지우기</button>
                    <button id="export-logs-btn" class="btn btn-primary">로그 내보내기</button>
                </div>
            </div>
            <div class="logs-tabs">
                <button class="tab-btn active" data-tab="all">전체</button>
                <button class="tab-btn" data-tab="info">정보</button>
                <button class="tab-btn" data-tab="warning">경고</button>
                <button class="tab-btn" data-tab="error">오류</button>
            </div>
            <div class="logs-content">
                <div id="logs-list" class="logs-list">
                    <!-- 로그 항목들이 동적으로 추가됩니다 -->
                </div>
            </div>
        `;
        
        this.bindLogsControls();
    }

    createPerformanceUI() {
        const container = document.getElementById('performance-metrics');
        if (!container) return;
        
        container.innerHTML = `
            <div class="performance-header">
                <h3>성능 메트릭</h3>
                <div class="metrics-refresh">
                    <button id="refresh-metrics-btn" class="btn btn-secondary">새로고침</button>
                </div>
            </div>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">처리 속도</div>
                    <div class="metric-value" id="processing-speed">0</div>
                    <div class="metric-unit">블록/분</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">메모리 사용량</div>
                    <div class="metric-value" id="memory-usage">0</div>
                    <div class="metric-unit">MB</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">평균 응답시간</div>
                    <div class="metric-value" id="avg-response-time">0</div>
                    <div class="metric-unit">ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">오류율</div>
                    <div class="metric-value" id="error-rate">0</div>
                    <div class="metric-unit">%</div>
                </div>
            </div>
            <div class="performance-chart">
                <canvas id="performance-chart" width="400" height="200"></canvas>
            </div>
        `;
    }

    bindProcessControls() {
        document.getElementById('start-process-btn')?.addEventListener('click', () => {
            this.startProcessing();
        });
        
        document.getElementById('pause-process-btn')?.addEventListener('click', () => {
            this.pauseProcessing();
        });
        
        document.getElementById('stop-process-btn')?.addEventListener('click', () => {
            this.stopProcessing();
        });
    }

    bindLogsControls() {
        document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
            this.clearLogs();
        });
        
        document.getElementById('export-logs-btn')?.addEventListener('click', () => {
            this.exportLogs();
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchLogsTab(e.target.dataset.tab);
            });
        });
    }

    updateProcessStep(stepId, status, progress = 0) {
        const step = this.processSteps.find(s => s.id === stepId);
        if (!step) return;
        
        const previousStatus = step.status;
        step.status = status;
        step.progress = progress;
        
        if (status === 'processing' && previousStatus !== 'processing') {
            step.startTime = new Date();
        } else if (status === 'completed' || status === 'error') {
            step.endTime = new Date();
        }
        
        this.updateStepUI(stepId);
        this.updateOverallProgress();
        this.logProcessEvent(stepId, status, progress);
    }

    updateStepUI(stepId) {
        const step = this.processSteps.find(s => s.id === stepId);
        const stepElement = document.getElementById(`step-${stepId}`);
        
        if (!step || !stepElement) return;
        
        // 상태 표시기 업데이트
        const statusIndicator = stepElement.querySelector('.step-status-indicator');
        statusIndicator.className = `step-status-indicator ${step.status}`;
        
        // 진행률 업데이트
        const progressFill = stepElement.querySelector('.progress-fill');
        const progressText = stepElement.querySelector('.progress-text');
        progressFill.style.width = `${step.progress}%`;
        progressText.textContent = `${step.progress}%`;
        
        // 시간 정보 업데이트
        const startTimeElement = stepElement.querySelector('.start-time');
        const durationElement = stepElement.querySelector('.duration');
        startTimeElement.textContent = step.startTime ? this.formatTime(step.startTime) : '-';
        durationElement.textContent = this.calculateDuration(step);
    }

    updateOverallProgress() {
        const totalSteps = this.processSteps.length;
        const completedSteps = this.processSteps.filter(s => s.status === 'completed').length;
        const overallProgress = Math.round((completedSteps / totalSteps) * 100);
        
        const progressFill = document.getElementById('overall-progress');
        const progressText = document.getElementById('overall-percentage');
        
        if (progressFill) progressFill.style.width = `${overallProgress}%`;
        if (progressText) progressText.textContent = `${overallProgress}%`;
        
        this.updateEstimatedCompletion();
    }

    updateEstimatedCompletion() {
        const completedSteps = this.processSteps.filter(s => s.status === 'completed');
        const processingStep = this.processSteps.find(s => s.status === 'processing');
        
        if (completedSteps.length === 0) {
            document.getElementById('estimated-completion').textContent = '계산 중...';
            return;
        }
        
        const avgStepTime = completedSteps.reduce((sum, step) => {
            return sum + (step.endTime - step.startTime);
        }, 0) / completedSteps.length;
        
        const remainingSteps = this.processSteps.filter(s => s.status === 'pending').length;
        const estimatedTime = remainingSteps * avgStepTime;
        
        if (processingStep) {
            const processingTime = new Date() - processingStep.startTime;
            const estimatedStepCompletion = avgStepTime - processingTime;
            estimatedTime += Math.max(0, estimatedStepCompletion);
        }
        
        document.getElementById('estimated-completion').textContent = this.formatDuration(estimatedTime);
    }

    updateDateBlock(blockId, data) {
        const existingBlock = this.dateBlocks.find(b => b.id === blockId);
        
        if (existingBlock) {
            Object.assign(existingBlock, data);
        } else {
            this.dateBlocks.push({ id: blockId, ...data });
        }
        
        this.renderDateBlocks();
    }

    renderDateBlocks() {
        const container = document.getElementById('date-blocks-grid');
        if (!container) return;
        
        container.innerHTML = this.dateBlocks.map(block => `
            <div class="date-block ${block.status}" data-block-id="${block.id}">
                <div class="block-header">
                    <div class="block-date">${block.date}</div>
                    <div class="block-status ${block.status}">${this.getStatusText(block.status)}</div>
                </div>
                <div class="block-content">
                    <div class="block-stats">
                        <span>라인: ${block.lineCount || 0}</span>
                        <span>문자: ${block.charCount || 0}</span>
                    </div>
                    <div class="block-progress">
                        <div class="progress-bar mini">
                            <div class="progress-fill" style="width: ${block.progress || 0}%"></div>
                        </div>
                    </div>
                </div>
                <div class="block-actions">
                    <button onclick="viewBlockDetails('${block.id}')">상세보기</button>
                </div>
            </div>
        `).join('');
    }

    logProcessEvent(stepId, status, progress) {
        const log = {
            timestamp: new Date(),
            type: 'info',
            stepId,
            message: `${this.getStepName(stepId)}: ${this.getStatusText(status)} (${progress}%)`,
            details: { status, progress }
        };
        
        this.processingLogs.push(log);
        this.renderLogs();
    }

    logError(stepId, error) {
        const log = {
            timestamp: new Date(),
            type: 'error',
            stepId,
            message: `${this.getStepName(stepId)}: 오류 발생`,
            details: { error: error.message, stack: error.stack }
        };
        
        this.errorLogs.push(log);
        this.processingLogs.push(log);
        this.renderLogs();
    }

    renderLogs() {
        const container = document.getElementById('logs-list');
        if (!container) return;
        
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
        let logsToShow = this.processingLogs;
        
        if (activeTab !== 'all') {
            logsToShow = this.processingLogs.filter(log => log.type === activeTab);
        }
        
        container.innerHTML = logsToShow.slice(-100).reverse().map(log => `
            <div class="log-item ${log.type}">
                <div class="log-timestamp">${this.formatTime(log.timestamp)}</div>
                <div class="log-message">${log.message}</div>
                ${log.details ? `<div class="log-details">${JSON.stringify(log.details, null, 2)}</div>` : ''}
            </div>
        `).join('');
    }

    // 유틸리티 메서드들
    formatTime(date) {
        return date.toLocaleTimeString('ko-KR');
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    calculateDuration(step) {
        if (!step.startTime) return '-';
        
        const endTime = step.endTime || new Date();
        const duration = endTime - step.startTime;
        
        return this.formatDuration(duration);
    }

    getStepName(stepId) {
        const step = this.processSteps.find(s => s.id === stepId);
        return step ? step.name : stepId;
    }

    getStatusText(status) {
        const statusMap = {
            pending: '대기중',
            processing: '처리중',
            completed: '완료',
            error: '오류',
            paused: '일시정지'
        };
        
        return statusMap[status] || status;
    }

    // 처리 제어 메서드들
    startProcessing() {
        this.updateProcessStep('upload', 'processing', 0);
        // 실제 처리 로직은 여기에 구현
    }

    pauseProcessing() {
        // 일시정지 로직
    }

    stopProcessing() {
        // 중지 로직
    }

    clearLogs() {
        this.processingLogs = [];
        this.errorLogs = [];
        this.renderLogs();
    }

    exportLogs() {
        const logsData = JSON.stringify(this.processingLogs, null, 2);
        const blob = new Blob([logsData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `processing-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    switchLogsTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        this.renderLogs();
    }
}

// 전역 함수들
function toggleStepDetails(stepId) {
    const stepElement = document.getElementById(`step-${stepId}`);
    const detailsElement = stepElement.querySelector('.step-details-content');
    
    if (detailsElement) {
        detailsElement.style.display = detailsElement.style.display === 'none' ? 'block' : 'none';
    }
}

function viewBlockDetails(blockId) {
    // 블록 상세 정보 모달 표시
    console.log('Viewing details for block:', blockId);
}

// 모니터링 시스템 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.processMonitor = new ProcessMonitoringSystem();
});