// VNEXSUS AI 모니터링 대시보드
// 실시간 성능 메트릭 및 시스템 상태 모니터링

class MonitoringDashboard {
    constructor() {
        this.charts = {};
        this.updateInterval = 5000; // 5초마다 업데이트
        this.maxDataPoints = 20;
        this.apiBaseUrl = 'http://localhost:3030/api';
        
        this.init();
    }

    async init() {
        console.log('모니터링 대시보드 초기화 중...');
        
        try {
            await this.initializeCharts();
            await this.loadInitialData();
            this.startRealTimeUpdates();
            
            console.log('모니터링 대시보드 초기화 완료');
        } catch (error) {
            console.error('대시보드 초기화 실패:', error);
            this.showError('대시보드를 초기화할 수 없습니다.');
        }
    }

    // 차트 초기화
    async initializeCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.4
                },
                point: {
                    radius: 0
                }
            }
        };

        // 응답 시간 차트
        this.charts.responseTime = new Chart(
            document.getElementById('responseTimeChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        fill: true
                    }]
                },
                options: chartOptions
            }
        );

        // 처리량 차트
        this.charts.throughput = new Chart(
            document.getElementById('throughputChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        fill: true
                    }]
                },
                options: chartOptions
            }
        );

        // 오류율 차트
        this.charts.errorRate = new Chart(
            document.getElementById('errorRateChart'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true
                    }]
                },
                options: chartOptions
            }
        );

        // 시스템 리소스 차트 (도넛 차트)
        this.charts.resource = new Chart(
            document.getElementById('resourceChart'),
            {
                type: 'doughnut',
                data: {
                    labels: ['CPU', '메모리', '디스크'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: [
                            '#3498db',
                            '#e74c3c',
                            '#f39c12'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            }
        );
    }

    // 초기 데이터 로드
    async loadInitialData() {
        try {
            // Load metrics
            const metricsResponse = await fetch('http://localhost:3030/api/monitoring/metrics');
            const metricsData = await metricsResponse.json();
            
            if (metricsData.success) {
                this.updateMetricsDisplay(metricsData.data);
            }

            // Load health status
            const healthResponse = await fetch('http://localhost:3030/api/monitoring/health');
            const healthData = await healthResponse.json();
            
            if (healthData.success) {
                this.updateActivities([{
                    timestamp: new Date().toISOString(),
                    type: 'system',
                    message: `시스템 상태: ${healthData.data.status}`,
                    status: healthData.data.status === 'healthy' ? 'success' : 'warning'
                }]);
            }

            // Load performance report
            const reportResponse = await fetch('http://localhost:3030/api/monitoring/report');
            const reportData = await reportResponse.json();
            
            if (reportData.success) {
                this.updateAlerts([{
                    id: 1,
                    type: 'info',
                    message: '성능 리포트가 업데이트되었습니다.',
                    timestamp: new Date().toISOString()
                }]);
            }

            // Mock hospital data for demonstration
            this.updateHospitals([
                { name: '서울대학교병원', processed: 45, accuracy: 98.5 },
                { name: '삼성서울병원', processed: 32, accuracy: 97.8 },
                { name: '아산병원', processed: 28, accuracy: 98.2 }
            ]);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.updateAlerts([{
                id: 1,
                type: 'error',
                message: `데이터 로드 실패: ${error.message}`,
                timestamp: new Date().toISOString()
            }]);
        }
    }

    // 실시간 업데이트 시작
    startRealTimeUpdates() {
        // 5초마다 메트릭 업데이트
        setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3030/api/monitoring/metrics');
                const data = await response.json();
                
                if (data.success) {
                    this.updateMetricsDisplay(data.data);
                }
            } catch (error) {
                console.error('실시간 업데이트 실패:', error);
            }
        }, 5000);

        // 10초마다 건강 상태 체크
        setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3030/api/monitoring/health');
                const data = await response.json();
                
                if (data.success) {
                    const activity = {
                        timestamp: new Date().toISOString(),
                        type: 'system',
                        message: `시스템 상태 체크: ${data.data.status}`,
                        status: data.data.status === 'healthy' ? 'success' : 'warning'
                    };
                    
                    // 기존 활동 목록에 추가
                    const activitiesContainer = document.getElementById('activities-list');
                    if (activitiesContainer) {
                        const activityElement = document.createElement('div');
                        activityElement.className = `activity-item ${activity.status}`;
                        activityElement.innerHTML = `
                            <span class="activity-time">${new Date(activity.timestamp).toLocaleTimeString()}</span>
                            <span class="activity-message">${activity.message}</span>
                        `;
                        activitiesContainer.insertBefore(activityElement, activitiesContainer.firstChild);
                        
                        // 최대 10개 항목만 유지
                        while (activitiesContainer.children.length > 10) {
                            activitiesContainer.removeChild(activitiesContainer.lastChild);
                        }
                    }
                }
            } catch (error) {
                console.error('건강 상태 체크 실패:', error);
            }
        }, 10000);
    }

    // 메트릭 업데이트
    async updateMetrics() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/monitoring/metrics`);
            const result = await response.json();
            
            if (result.success) {
                const metrics = result.data;
                
                // 응답 시간 업데이트
                if (metrics.system && metrics.system.responseTime !== undefined) {
                    this.updateChart('responseTime', metrics.system.responseTime);
                    document.getElementById('response-time').textContent = 
                        Math.round(metrics.system.responseTime);
                }
                
                // 처리량 업데이트
                if (metrics.processing && metrics.processing.throughput !== undefined) {
                    this.updateChart('throughput', metrics.processing.throughput);
                    document.getElementById('throughput').textContent = 
                        Math.round(metrics.processing.throughput);
                }
                
                // 오류율 업데이트
                if (metrics.system && metrics.system.errorRate !== undefined) {
                    const errorRatePercent = metrics.system.errorRate * 100;
                    this.updateChart('errorRate', errorRatePercent);
                    document.getElementById('error-rate').textContent = 
                        errorRatePercent.toFixed(2);
                }
                
                // 시스템 리소스 업데이트
                if (metrics.system) {
                    const cpuUsage = Math.random() * 100; // 실제 CPU 사용률로 대체
                    const memoryUsage = metrics.system.memoryUsage ? 
                        (metrics.system.memoryUsage / 1024) : Math.random() * 100;
                    const diskUsage = Math.random() * 100; // 실제 디스크 사용률로 대체
                    
                    document.getElementById('cpu-usage').textContent = Math.round(cpuUsage);
                    document.getElementById('memory-usage').textContent = Math.round(memoryUsage);
                    document.getElementById('disk-usage').textContent = Math.round(diskUsage);
                    
                    this.charts.resource.data.datasets[0].data = [cpuUsage, memoryUsage, diskUsage];
                    this.charts.resource.update('none');
                }
            }
        } catch (error) {
            console.error('메트릭 업데이트 실패:', error);
            this.showError('메트릭 데이터를 가져올 수 없습니다.');
        }
    }

    // 차트 데이터 업데이특
    updateChart(chartName, value) {
        const chart = this.charts[chartName];
        if (!chart) return;
        
        const now = new Date().toLocaleTimeString();
        
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(value);
        
        // 최대 데이터 포인트 수 제한
        if (chart.data.labels.length > this.maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.update('none');
    }

    // 최근 활동 업데이트
    async updateActivities() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/monitoring/activities`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const activitiesHtml = result.data.map(activity => `
                    <div class="activity-item">
                        <div>
                            <span class="activity-type ${activity.type}">${activity.type}</span>
                            <span>${activity.description}</span>
                        </div>
                        <div class="time">${activity.timeAgo || '방금 전'}</div>
                    </div>
                `).join('');
                
                document.getElementById('recent-activities').innerHTML = 
                    activitiesHtml || '<div class="loading">활동 내역이 없습니다.</div>';
            }
        } catch (error) {
            console.error('활동 업데이트 실패:', error);
            document.getElementById('recent-activities').innerHTML = 
                '<div class="error">활동 데이터를 불러올 수 없습니다.</div>';
        }
    }

    // 알림 업데이트
    async updateAlerts() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/monitoring/alerts`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const alertsHtml = result.data.map(alert => `
                    <div class="alert-item">
                        <div>
                            <span class="alert-level ${alert.level}">${alert.level}</span>
                            <span>${alert.message}</span>
                        </div>
                        <div class="time">${alert.timeAgo || '방금 전'}</div>
                    </div>
                `).join('');
                
                document.getElementById('alerts').innerHTML = 
                    alertsHtml || '<div class="loading">알림이 없습니다.</div>';
            }
        } catch (error) {
            console.error('알림 업데이트 실패:', error);
            document.getElementById('alerts').innerHTML = 
                '<div class="error">알림 데이터를 불러올 수 없습니다.</div>';
        }
    }

    // 병원 통계 업데이트
    async updateHospitalStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/monitoring/hospitals`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const hospitalHtml = result.data.map(hospital => `
                    <div class="hospital-item">
                        <div class="hospital-name">${hospital.name}</div>
                        <div class="hospital-metrics">
                            <span class="hospital-processed">${hospital.processed}건</span>
                            <span class="hospital-success">${hospital.success.toFixed(1)}%</span>
                        </div>
                    </div>
                `).join('');
                
                document.getElementById('hospital-stats').innerHTML = hospitalHtml;
            }
        } catch (error) {
            console.error('병원 통계 업데이트 실패:', error);
            document.getElementById('hospital-stats').innerHTML = 
                '<div class="error">병원 데이터를 불러올 수 없습니다.</div>';
        }
    }

    // 메트릭 데이터 표시 업데이트
    updateMetricsDisplay(metrics) {
        try {
            // 응답 시간 업데이트
            if (metrics.system && metrics.system.responseTime !== undefined) {
                this.updateChart('responseTime', metrics.system.responseTime);
                document.getElementById('response-time').textContent = 
                    Math.round(metrics.system.responseTime);
            }
            
            // 처리량 업데이트
            if (metrics.processing && metrics.processing.throughput !== undefined) {
                this.updateChart('throughput', metrics.processing.throughput);
                document.getElementById('throughput').textContent = 
                    Math.round(metrics.processing.throughput);
            }
            
            // 오류율 업데이트
            if (metrics.system && metrics.system.errorRate !== undefined) {
                const errorRatePercent = metrics.system.errorRate * 100;
                this.updateChart('errorRate', errorRatePercent);
                document.getElementById('error-rate').textContent = 
                    errorRatePercent.toFixed(2);
            }
            
            // 시스템 리소스 업데이트
            if (metrics.system) {
                const cpuUsage = Math.random() * 100; // 실제 CPU 사용률로 대체
                const memoryUsage = metrics.system.memoryUsage ? 
                    (metrics.system.memoryUsage / 1024) : Math.random() * 100;
                const diskUsage = Math.random() * 100; // 실제 디스크 사용률로 대체
                
                document.getElementById('cpu-usage').textContent = Math.round(cpuUsage);
                document.getElementById('memory-usage').textContent = Math.round(memoryUsage);
                document.getElementById('disk-usage').textContent = Math.round(diskUsage);
                
                if (this.charts.resource) {
                    this.charts.resource.data.datasets[0].data = [cpuUsage, memoryUsage, diskUsage];
                    this.charts.resource.update('none');
                }
            }
            
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('메트릭 표시 업데이트 실패:', error);
        }
    }

    // 마지막 업데이트 시간 갱신
    updateLastUpdateTime() {
        const now = new Date();
        document.getElementById('last-update').textContent = 
            now.toLocaleTimeString();
    }

    // 오류 메시지 표시
    showError(message) {
        console.error(message);
        // 필요시 사용자에게 오류 알림 표시
    }
}

// 수동 새로고침 함수
async function refreshData() {
    if (window.dashboard) {
        try {
            await window.dashboard.loadInitialData();
            console.log('데이터 새로고침 완료');
        } catch (error) {
            console.error('데이터 새로고침 실패:', error);
        }
    }
}

// 페이지 로드 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new MonitoringDashboard();
});

// ... existing code ...