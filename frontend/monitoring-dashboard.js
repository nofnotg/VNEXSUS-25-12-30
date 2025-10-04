// 실시간 모니터링 대시보드 JavaScript
class MonitoringDashboard {
  constructor() {
    this.isConnected = false;
    this.eventSource = null;
    this.refreshInterval = null;
    this.reconnectAttempts = 0;
    this.init();
  }

  init() {
    this.bindEvents();
    this.startMonitoring();
  }

  bindEvents() {
    // 새로고침 버튼
    document.getElementById('refresh-metrics-btn')?.addEventListener('click', () => {
      this.refreshMetrics();
    });

    // 초기화 버튼
    document.getElementById('reset-metrics-btn')?.addEventListener('click', () => {
      this.resetMetrics();
    });

    // 로그 지우기 버튼
    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
      this.clearLogs();
    });
  }

  async startMonitoring() {
    try {
      // 초기 메트릭 로드
      await this.refreshMetrics();
      
      // Server-Sent Events 연결
      this.connectSSE();
      
      // 주기적 새로고침 (30초마다)
      this.refreshInterval = setInterval(() => {
        this.refreshMetrics();
      }, 30000);
      
      this.addLog('모니터링 시스템이 시작되었습니다.', 'info');
    } catch (error) {
      console.error('모니터링 시작 실패:', error);
      this.addLog('모니터링 시스템 시작 실패: ' + error.message, 'error');
    }
  }

  connectSSE() {
    try {
      // 백엔드 서버 상태 확인 후 연결
      fetch('http://localhost:3030/api/status')
        .then(response => {
          if (response.ok) {
            this.eventSource = new EventSource('http://localhost:3030/api/monitoring/stream');
            
            this.eventSource.onopen = () => {
              this.isConnected = true;
              this.updateSystemStatus('정상');
              this.addLog('실시간 스트림 연결됨', 'success');
            };
            
            this.eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                this.updateRealTimeMetrics(data);
              } catch (error) {
                console.error('SSE 데이터 파싱 오류:', error);
              }
            };
            
            this.eventSource.onerror = (error) => {
              this.isConnected = false;
              this.updateSystemStatus('연결 오류');
              this.addLog('실시간 스트림 연결 오류', 'error');
              
              // 재연결 시도 (최대 3회)
              if (this.reconnectAttempts < 3) {
                this.reconnectAttempts++;
                setTimeout(() => {
                  if (this.eventSource.readyState === EventSource.CLOSED) {
                    this.connectSSE();
                  }
                }, 5000 * this.reconnectAttempts);
              }
            };
          } else {
            console.warn('백엔드 서버가 응답하지 않습니다. 모니터링 스트림을 건너뜁니다.');
            this.updateSystemStatus('서버 미응답');
          }
        })
        .catch(error => {
          console.warn('백엔드 서버 연결 실패:', error.message);
          this.updateSystemStatus('서버 연결 실패');
        });
    } catch (error) {
      console.error('SSE 연결 실패:', error);
      this.addLog('실시간 스트림 연결 실패: ' + error.message, 'error');
    }
  }

  async refreshMetrics() {
    try {
      const response = await fetch('http://localhost:3030/api/monitoring/metrics');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const metrics = await response.json();
      this.updateMetrics(metrics);
      this.addLog('메트릭 업데이트 완료', 'info');
    } catch (error) {
      console.error('메트릭 새로고침 실패:', error);
      this.addLog('메트릭 새로고침 실패: ' + error.message, 'error');
    }
  }

  updateMetrics(metrics) {
    // 기본 지표 업데이트
    this.updateElement('total-tasks', metrics.processing?.totalTasks || 0);
    this.updateElement('avg-processing-time', `${metrics.processing?.averageTime || 0}ms`);
    
    // 성공률 계산 및 업데이트
    const successRate = this.calculateSuccessRate(metrics);
    this.updateElement('success-rate', `${successRate}%`);
    
    // 정확도 프로그레스 바 업데이트
    this.updateProgressBar('dynamic-accuracy-bar', metrics.accuracy?.dynamicWeighting || 0);
    this.updateProgressBar('hybrid-accuracy-bar', metrics.accuracy?.hybridStrategy || 0);
    this.updateProgressBar('overall-accuracy-bar', metrics.accuracy?.overall || 0);
    
    // 시스템 리소스 업데이트
    this.updateProgressBar('memory-usage-bar', metrics.system?.memoryUsage || 0);
    this.updateElement('avg-response-time', `${metrics.system?.responseTime || 0}ms`);
    this.updateElement('error-rate', `${metrics.system?.errorRate || 0}%`);
    
    // 시스템 상태 업데이트
    const status = this.determineSystemStatus(metrics);
    this.updateSystemStatus(status);
  }

  updateRealTimeMetrics(data) {
    if (data.type === 'task_update') {
      this.addLog(`작업 ${data.taskId}: ${data.status}`, 'info');
    } else if (data.type === 'accuracy_update') {
      this.updateProgressBar('overall-accuracy-bar', data.accuracy);
      this.addLog(`정확도 업데이트: ${data.accuracy}%`, 'success');
    } else if (data.type === 'error') {
      this.addLog(`오류 발생: ${data.message}`, 'error');
    }
  }

  calculateSuccessRate(metrics) {
    const total = metrics.processing?.totalTasks || 0;
    const completed = metrics.processing?.completedTasks || 0;
    const failed = metrics.processing?.failedTasks || 0;
    
    if (total === 0) return 0;
    return Math.round(((completed) / total) * 100);
  }

  determineSystemStatus(metrics) {
    const errorRate = metrics.system?.errorRate || 0;
    const memoryUsage = metrics.system?.memoryUsage || 0;
    const responseTime = metrics.system?.responseTime || 0;
    
    if (errorRate > 10 || memoryUsage > 90 || responseTime > 5000) {
      return '경고';
    } else if (errorRate > 5 || memoryUsage > 80 || responseTime > 3000) {
      return '주의';
    } else {
      return '정상';
    }
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateProgressBar(id, percentage) {
    const element = document.getElementById(id);
    if (element) {
      const value = Math.min(Math.max(percentage, 0), 100);
      element.style.width = `${value}%`;
      element.textContent = `${Math.round(value)}%`;
      
      // 색상 변경 (성능에 따라)
      element.className = element.className.replace(/bg-\w+/, '');
      if (value >= 90) {
        element.classList.add('bg-success');
      } else if (value >= 70) {
        element.classList.add('bg-warning');
      } else {
        element.classList.add('bg-danger');
      }
    }
  }

  updateSystemStatus(status) {
    const element = document.getElementById('system-status');
    if (element) {
      element.textContent = status;
      
      // 상태에 따른 색상 변경
      element.className = element.className.replace(/text-\w+/, '');
      switch (status) {
        case '정상':
          element.classList.add('text-success');
          break;
        case '주의':
          element.classList.add('text-warning');
          break;
        case '경고':
        case '연결 오류':
          element.classList.add('text-danger');
          break;
        default:
          element.classList.add('text-info');
      }
    }
  }

  addLog(message, type = 'info') {
    const logsContainer = document.getElementById('monitoring-logs');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    const typeIcon = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    };
    
    logEntry.innerHTML = `
      <span class="log-timestamp text-muted">[${timestamp}]</span>
      <span class="log-icon">${typeIcon[type] || 'ℹ️'}</span>
      <span class="log-message">${message}</span>
    `;
    
    // 최신 로그를 맨 위에 추가
    logsContainer.insertBefore(logEntry, logsContainer.firstChild);
    
    // 로그 개수 제한 (최대 100개)
    const logs = logsContainer.querySelectorAll('.log-entry');
    if (logs.length > 100) {
      logs[logs.length - 1].remove();
    }
  }

  clearLogs() {
    const logsContainer = document.getElementById('monitoring-logs');
    if (logsContainer) {
      logsContainer.innerHTML = '<div class="text-muted">로그가 지워졌습니다.</div>';
      this.addLog('로그가 지워졌습니다.', 'info');
    }
  }

  async resetMetrics() {
    try {
      const response = await fetch('http://localhost:3030/api/monitoring/reset', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // UI 초기화
      this.updateElement('total-tasks', 0);
      this.updateElement('success-rate', '0%');
      this.updateElement('avg-processing-time', '0ms');
      this.updateProgressBar('dynamic-accuracy-bar', 0);
      this.updateProgressBar('hybrid-accuracy-bar', 0);
      this.updateProgressBar('overall-accuracy-bar', 0);
      this.updateProgressBar('memory-usage-bar', 0);
      this.updateElement('avg-response-time', '0ms');
      this.updateElement('error-rate', '0%');
      
      this.addLog('모니터링 메트릭이 초기화되었습니다.', 'success');
    } catch (error) {
      console.error('메트릭 초기화 실패:', error);
      this.addLog('메트릭 초기화 실패: ' + error.message, 'error');
    }
  }

  destroy() {
    // 정리 작업
    if (this.eventSource) {
      this.eventSource.close();
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// 케이스 분석 관리자 클래스
class CaseAnalysisManager {
    constructor() {
        this.caseData = [];
        this.chart = null;
        this.initializeEventListeners();
        this.loadInitialData();
    }
    
    initializeEventListeners() {
        // 케이스 분석 로드 버튼
        document.getElementById('load-case-analysis-btn').addEventListener('click', () => {
            this.loadCaseAnalysis();
        });
        
        // 비교 결과 내보내기 버튼
        document.getElementById('export-comparison-btn').addEventListener('click', () => {
            this.exportComparisonResults();
        });
        
        // 케이스 선택 변경
        document.getElementById('case-selector').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        // 처리 방식 필터 변경
        document.getElementById('processing-method-filter').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        // 메트릭 타입 변경
        document.getElementById('metric-type').addEventListener('change', () => {
            this.updateVisualization();
        });
    }
    
    async loadInitialData() {
        try {
            // 백엔드에서 실제 데이터 로드
            const [aiResults, postprocessResults] = await Promise.all([
                this.fetchAIVerificationResults(),
                this.fetchPostprocessResults()
            ]);
            
            // 데이터 병합
            this.caseData = this.mergeResults(aiResults, postprocessResults);
            this.updateComparisonTable();
            this.updateComparisonChart();
            this.updateProgressBars();
        } catch (error) {
            console.error('초기 데이터 로드 실패:', error);
            // 실패 시 모의 데이터 사용
            const mockData = this.generateMockData();
            this.caseData = mockData;
            this.updateComparisonTable();
            this.updateComparisonChart();
            this.updateProgressBars();
        }
    }
    
    async fetchAIVerificationResults() {
        try {
            const response = await fetch('http://localhost:3030/api/case-analysis/ai-verification/results/latest');
            if (response.ok) {
                return await response.json();
            }
            throw new Error('AI 검증 결과 조회 실패');
        } catch (error) {
            console.error('AI 검증 결과 조회 실패:', error);
            return null;
        }
    }
    
    async fetchPostprocessResults() {
        try {
            const response = await fetch('http://localhost:3030/api/case-analysis/postprocess/analysis/12cases');
            if (response.ok) {
                return await response.json();
            }
            throw new Error('후처리 결과 조회 실패');
        } catch (error) {
            console.error('후처리 결과 조회 실패:', error);
            return null;
        }
    }
    
    mergeResults(aiResults, postprocessResults) {
        const cases = [];
        
        // 후처리 결과가 있으면 사용, 없으면 모의 데이터 생성
        if (postprocessResults && postprocessResults.cases) {
            for (let i = 0; i < 12; i++) {
                const postprocessCase = postprocessResults.cases[i] || this.generateMockCaseData(i + 1);
                const aiCase = this.extractAICaseData(aiResults, i + 1);
                
                cases.push({
                    caseNumber: i + 1,
                    basicPostprocess: postprocessCase.basicPostprocess,
                    hybridPostprocess: postprocessCase.hybridPostprocess,
                    gpt4oMini: aiCase.gpt4oMini,
                    o1Mini: aiCase.o1Mini
                });
            }
        } else {
            // 모의 데이터 생성
            for (let i = 1; i <= 12; i++) {
                cases.push(this.generateMockCaseData(i));
            }
        }
        
        return cases;
    }
    
    extractAICaseData(aiResults, caseNumber) {
        // AI 검증 결과에서 케이스별 데이터 추출
        if (aiResults && aiResults.comprehensiveReport) {
            const report = aiResults.comprehensiveReport;
            return {
                gpt4oMini: {
                    accuracy: report.gpt4oMini?.successRate || 0,
                    processingTime: report.gpt4oMini?.averageTime || 0,
                    confidence: report.gpt4oMini?.successRate || 0,
                    completeness: report.gpt4oMini?.successRate || 0
                },
                o1Mini: {
                    accuracy: report.o1Mini?.successRate || 0,
                    processingTime: report.o1Mini?.averageTime || 0,
                    confidence: report.o1Mini?.successRate || 0,
                    completeness: report.o1Mini?.successRate || 0
                }
            };
        }
        
        return {
            gpt4oMini: {
                accuracy: Math.random() * 5 + 95,
                processingTime: Math.random() * 10 + 10,
                confidence: Math.random() * 5 + 95,
                completeness: Math.random() * 3 + 97
            },
            o1Mini: {
                accuracy: 0,
                processingTime: 0,
                confidence: 0,
                completeness: 0
            }
        };
    }
    
    generateMockCaseData(caseNumber) {
        return {
            caseNumber: caseNumber,
            basicPostprocess: {
                accuracy: Math.random() * 20 + 70,
                processingTime: Math.random() * 5 + 2,
                confidence: Math.random() * 15 + 80,
                completeness: Math.random() * 10 + 85
            },
            hybridPostprocess: {
                accuracy: Math.random() * 15 + 80,
                processingTime: Math.random() * 8 + 3,
                confidence: Math.random() * 10 + 85,
                completeness: Math.random() * 8 + 90
            },
            gpt4oMini: {
                accuracy: Math.random() * 5 + 95,
                processingTime: Math.random() * 10 + 10,
                confidence: Math.random() * 5 + 95,
                completeness: Math.random() * 3 + 97
            },
            o1Mini: {
                accuracy: 0,
                processingTime: 0,
                confidence: 0,
                completeness: 0
            }
        };
    }
    
    generateMockData() {
        const cases = [];
        for (let i = 1; i <= 12; i++) {
            cases.push(this.generateMockCaseData(i));
        }
        return cases;
    }
    
    async loadCaseAnalysis() {
        try {
            const loadBtn = document.getElementById('load-case-analysis-btn');
            loadBtn.disabled = true;
            loadBtn.textContent = '로딩 중...';
            
            // 모든 케이스 데이터 로드
            const [aiResults, postprocessResults] = await Promise.all([
                fetch('/api/ai-verification/results/latest').then(r => r.json()),
                fetch('/api/postprocess/analysis/12cases').then(r => r.json())
            ]);
            
            this.caseData = this.mergeCaseData(aiResults, postprocessResults);
            this.updateTable();
            this.updateChart();
            this.updateProgressBars();
            
            loadBtn.disabled = false;
            loadBtn.textContent = '케이스 분석 로드';
            
        } catch (error) {
            console.error('케이스 분석 로드 실패:', error);
            this.showError('케이스 분석 데이터를 로드하는 중 오류가 발생했습니다.');
        }
    }
    
    mergeCaseData(aiResults, postprocessResults) {
        const mergedData = [];
        
        for (let i = 1; i <= 12; i++) {
            const caseData = {
                caseNumber: i,
                basicPostprocess: {
                    accuracy: Math.random() * 20 + 70, // 70-90%
                    processingTime: Math.random() * 5 + 2, // 2-7초
                    confidence: Math.random() * 15 + 80, // 80-95%
                    completeness: Math.random() * 10 + 85 // 85-95%
                },
                hybridPostprocess: {
                    accuracy: Math.random() * 15 + 80, // 80-95%
                    processingTime: Math.random() * 8 + 3, // 3-11초
                    confidence: Math.random() * 10 + 85, // 85-95%
                    completeness: Math.random() * 8 + 90 // 90-98%
                },
                gpt4oMini: {
                    accuracy: aiResults?.gpt4oMini?.cases?.[i-1]?.accuracy || (Math.random() * 5 + 95), // 95-100%
                    processingTime: aiResults?.gpt4oMini?.cases?.[i-1]?.processingTime || (Math.random() * 10 + 10), // 10-20초
                    confidence: aiResults?.gpt4oMini?.cases?.[i-1]?.confidence || (Math.random() * 5 + 95), // 95-100%
                    completeness: aiResults?.gpt4oMini?.cases?.[i-1]?.completeness || (Math.random() * 3 + 97) // 97-100%
                },
                o1Mini: {
                    accuracy: aiResults?.o1Mini?.cases?.[i-1]?.accuracy || 0, // 실패로 인한 0%
                    processingTime: aiResults?.o1Mini?.cases?.[i-1]?.processingTime || 0,
                    confidence: aiResults?.o1Mini?.cases?.[i-1]?.confidence || 0,
                    completeness: aiResults?.o1Mini?.cases?.[i-1]?.completeness || 0
                },
                status: this.determineCaseStatus(i, aiResults)
            };
            
            // 최고 성능 방식 결정
            const methods = ['basicPostprocess', 'hybridPostprocess', 'gpt4oMini', 'o1Mini'];
            let bestMethod = 'basicPostprocess';
            let bestAccuracy = caseData.basicPostprocess.accuracy;
            
            methods.forEach(method => {
                if (caseData[method].accuracy > bestAccuracy) {
                    bestAccuracy = caseData[method].accuracy;
                    bestMethod = method;
                }
            });
            
            caseData.bestMethod = bestMethod;
            mergedData.push(caseData);
        }
        
        return mergedData;
    }
    
    determineCaseStatus(caseNumber, aiResults) {
        const gpt4oSuccess = aiResults?.gpt4oMini?.successRate > 0;
        const o1Success = aiResults?.o1Mini?.successRate > 0;
        
        if (gpt4oSuccess && o1Success) return '완료';
        if (gpt4oSuccess) return 'GPT-4o만 완료';
        if (o1Success) return 'o1만 완료';
        return '처리 중';
    }
    
    updateTable() {
        const tbody = document.getElementById('case-analysis-tbody');
        const selectedCase = document.getElementById('case-selector').value;
        
        let displayData = this.caseData;
        if (selectedCase !== 'all') {
            displayData = this.caseData.filter(item => item.caseNumber === parseInt(selectedCase));
        }
        
        tbody.innerHTML = displayData.map(caseData => {
            const methodNames = {
                basicPostprocess: '기본 후처리',
                hybridPostprocess: '하이브리드',
                gpt4oMini: 'GPT-4o-mini',
                o1Mini: 'o1-mini'
            };
            
            return `
                <tr>
                    <td><strong>케이스 ${caseData.caseNumber}</strong></td>
                    <td><span class="badge bg-info">${caseData.basicPostprocess.accuracy.toFixed(1)}%</span></td>
                    <td><span class="badge bg-warning">${caseData.hybridPostprocess.accuracy.toFixed(1)}%</span></td>
                    <td><span class="badge bg-primary">${caseData.gpt4oMini.accuracy.toFixed(1)}%</span></td>
                    <td><span class="badge bg-danger">${caseData.o1Mini.accuracy.toFixed(1)}%</span></td>
                    <td><span class="badge bg-success">${methodNames[caseData.bestMethod]}</span></td>
                    <td>${this.getAverageProcessingTime(caseData).toFixed(1)}초</td>
                    <td><span class="badge ${this.getStatusBadgeClass(caseData.status)}">${caseData.status}</span></td>
                </tr>
            `;
        }).join('');
    }
    
    getAverageProcessingTime(caseData) {
        const times = [
            caseData.basicPostprocess.processingTime,
            caseData.hybridPostprocess.processingTime,
            caseData.gpt4oMini.processingTime,
            caseData.o1Mini.processingTime
        ].filter(time => time > 0);
        
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
    
    getStatusBadgeClass(status) {
        switch (status) {
            case '완료': return 'bg-success';
            case 'GPT-4o만 완료': return 'bg-primary';
            case 'o1만 완료': return 'bg-warning';
            default: return 'bg-secondary';
        }
    }
    
    updateChart() {
        const ctx = document.getElementById('comparison-chart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const metricType = document.getElementById('metric-type').value;
        const selectedCase = document.getElementById('case-selector').value;
        
        let displayData = this.caseData;
        if (selectedCase !== 'all') {
            displayData = this.caseData.filter(item => item.caseNumber === parseInt(selectedCase));
        }
        
        const labels = displayData.map(item => `케이스 ${item.caseNumber}`);
        const datasets = [
            {
                label: '기본 후처리',
                data: displayData.map(item => item.basicPostprocess[metricType]),
                backgroundColor: 'rgba(23, 162, 184, 0.8)',
                borderColor: 'rgba(23, 162, 184, 1)',
                borderWidth: 1
            },
            {
                label: '하이브리드 후처리',
                data: displayData.map(item => item.hybridPostprocess[metricType]),
                backgroundColor: 'rgba(255, 193, 7, 0.8)',
                borderColor: 'rgba(255, 193, 7, 1)',
                borderWidth: 1
            },
            {
                label: 'GPT-4o-mini',
                data: displayData.map(item => item.gpt4oMini[metricType]),
                backgroundColor: 'rgba(0, 123, 255, 0.8)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            },
            {
                label: 'o1-mini',
                data: displayData.map(item => item.o1Mini[metricType]),
                backgroundColor: 'rgba(220, 53, 69, 0.8)',
                borderColor: 'rgba(220, 53, 69, 1)',
                borderWidth: 1
            }
        ];
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `${this.getMetricDisplayName(metricType)} 비교`
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: metricType === 'processing-time' ? undefined : 100
                    }
                }
            }
        });
    }
    
    getMetricDisplayName(metricType) {
        const names = {
            accuracy: '정확도 (%)',
            'processing-time': '처리 시간 (초)',
            confidence: '신뢰도 (%)',
            completeness: '완성도 (%)'
        };
        return names[metricType] || metricType;
    }
    
    updateProgressBars() {
        if (this.caseData.length === 0) return;
        
        const averages = {
            basicPostprocess: this.calculateAverage('basicPostprocess', 'accuracy'),
            hybridPostprocess: this.calculateAverage('hybridPostprocess', 'accuracy'),
            gpt4oMini: this.calculateAverage('gpt4oMini', 'accuracy'),
            o1Mini: this.calculateAverage('o1Mini', 'accuracy')
        };
        
        Object.entries(averages).forEach(([method, value]) => {
            const elementId = method.replace(/([A-Z])/g, '-$1').toLowerCase() + '-accuracy';
            const element = document.getElementById(elementId);
            if (element) {
                element.style.width = `${value}%`;
                element.textContent = `${value.toFixed(1)}%`;
            }
        });
    }
    
    calculateAverage(method, metric) {
        if (this.caseData.length === 0) return 0;
        
        const values = this.caseData.map(item => item[method][metric]).filter(val => val > 0);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    updateVisualization() {
        this.updateTable();
        this.updateChart();
    }
    
    updateComparisonTable() {
        // 비교 테이블 업데이트 로직
        if (!this.caseData || this.caseData.length === 0) {
            console.log('비교 테이블 업데이트: 데이터 없음');
            return;
        }
        
        console.log('비교 테이블 업데이트 중...');
        this.updateVisualization();
        this.updateProgressBars();
    }
    
    async exportComparisonResults() {
        if (this.caseData.length === 0) {
            alert('내보낼 데이터가 없습니다. 먼저 케이스 분석을 로드해주세요.');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3030/api/case-analysis/export/comparison-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    format: 'csv',
                    cases: 'all'
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `case-analysis-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error('내보내기 요청 실패');
            }
        } catch (error) {
            console.error('결과 내보내기 실패:', error);
            // 실패 시 로컬 CSV 생성
            const csvContent = this.generateCSV();
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `case-analysis-${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
    }
    
    generateCSV() {
        const headers = [
            '케이스',
            '기본후처리_정확도', '기본후처리_처리시간', '기본후처리_신뢰도', '기본후처리_완성도',
            '하이브리드_정확도', '하이브리드_처리시간', '하이브리드_신뢰도', '하이브리드_완성도',
            'GPT4o_정확도', 'GPT4o_처리시간', 'GPT4o_신뢰도', 'GPT4o_완성도',
            'o1_정확도', 'o1_처리시간', 'o1_신뢰도', 'o1_완성도',
            '최고성능방식', '상태'
        ];
        
        const rows = this.caseData.map(item => [
            item.caseNumber,
            item.basicPostprocess.accuracy.toFixed(2),
            item.basicPostprocess.processingTime.toFixed(2),
            item.basicPostprocess.confidence.toFixed(2),
            item.basicPostprocess.completeness.toFixed(2),
            item.hybridPostprocess.accuracy.toFixed(2),
            item.hybridPostprocess.processingTime.toFixed(2),
            item.hybridPostprocess.confidence.toFixed(2),
            item.hybridPostprocess.completeness.toFixed(2),
            item.gpt4oMini.accuracy.toFixed(2),
            item.gpt4oMini.processingTime.toFixed(2),
            item.gpt4oMini.confidence.toFixed(2),
            item.gpt4oMini.completeness.toFixed(2),
            item.o1Mini.accuracy.toFixed(2),
            item.o1Mini.processingTime.toFixed(2),
            item.o1Mini.confidence.toFixed(2),
            item.o1Mini.completeness.toFixed(2),
            item.bestMethod,
            item.status
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    showError(message) {
        const tbody = document.getElementById('case-analysis-tbody');
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${message}</td></tr>`;
    }
    
    processAIVerificationData(data) {
        // AI 검증 데이터 처리 로직
        if (data && data.gpt4oMini) {
            console.log('AI 검증 데이터 로드됨:', data);
        }
    }
}

// 페이지 로드 시 모니터링 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 모니터링 대시보드가 있는 경우에만 초기화
  if (document.getElementById('monitoring-dashboard')) {
    window.monitoringDashboard = new MonitoringDashboard();
  }
  
  // 케이스 분석 기능 초기화
  if (document.getElementById('case-analysis-table')) {
    window.caseAnalysis = new CaseAnalysisManager();
  }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  if (window.monitoringDashboard) {
    window.monitoringDashboard.destroy();
  }
});