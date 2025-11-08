import React, { useState, useEffect } from 'react';
import './PerformanceDashboard.css';

const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5초
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [alerts, setAlerts] = useState([]);

  // 실시간 메트릭 업데이트
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/hybrid/metrics');
        const data = await response.json();
        setMetrics(data);
        
        // 히스토리컬 데이터 업데이트
        setHistoricalData(prev => {
          const newData = [...prev, {
            timestamp: new Date(),
            ...data
          }];
          // 최대 100개 데이터 포인트 유지
          return newData.slice(-100);
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('메트릭 가져오기 실패:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // 알림 확인
  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const response = await fetch('/api/hybrid/alerts');
        const alertData = await response.json();
        setAlerts(alertData.alerts || []);
      } catch (error) {
        console.error('알림 확인 실패:', error);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 10000); // 10초마다 알림 확인
    return () => clearInterval(interval);
  }, []);

  // 성능 상태 계산
  const getPerformanceStatus = (value, thresholds) => {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'good';
  };

  // 차트 데이터 준비
  const prepareChartData = (dataKey) => {
    return historicalData.slice(-20).map((item, index) => ({
      x: index,
      y: item[dataKey] || 0,
      timestamp: item.timestamp
    }));
  };

  // 간단한 라인 차트 컴포넌트
  const MiniChart = ({ data, color, height = 60 }) => {
    if (!data || data.length === 0) return <div className="chart-placeholder">데이터 없음</div>;

    const maxValue = Math.max(...data.map(d => d.y));
    const minValue = Math.min(...data.map(d => d.y));
    const range = maxValue - minValue || 1;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = ((maxValue - point.y) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="mini-chart" style={{ height }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="performance-dashboard loading">
        <div className="loading-spinner">
          <i className="bi bi-arrow-clockwise spin"></i>
          <p>성능 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <h3>실시간 성능 모니터링</h3>
        <div className="dashboard-controls">
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
          >
            <option value={1000}>1초</option>
            <option value={5000}>5초</option>
            <option value={10000}>10초</option>
            <option value={30000}>30초</option>
          </select>
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
          >
            <option value="5m">5분</option>
            <option value="1h">1시간</option>
            <option value="6h">6시간</option>
            <option value="24h">24시간</option>
          </select>
        </div>
      </div>

      {/* 알림 영역 */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          {alerts.map((alert, index) => (
            <div key={index} className={`alert alert-${alert.severity}`}>
              <i className={`bi bi-${alert.severity === 'critical' ? 'exclamation-triangle-fill' : 'exclamation-circle'}`}></i>
              <span>{alert.message}</span>
              <small>{new Date(alert.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      )}

      {/* 주요 메트릭 카드 */}
      <div className="metrics-grid">
        {/* 처리 시간 */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>평균 처리 시간</h4>
            <span className={`status-indicator status-${getPerformanceStatus(metrics?.averageProcessingTime || 0, { warning: 1000, critical: 2000 })}`}></span>
          </div>
          <div className="metric-value">
            {metrics?.averageProcessingTime || 0}ms
          </div>
          <div className="metric-change">
            {metrics?.processingTimeChange > 0 ? '+' : ''}{metrics?.processingTimeChange || 0}%
          </div>
          <MiniChart 
            data={prepareChartData('averageProcessingTime')} 
            color="#3b82f6" 
          />
        </div>

        {/* 메모리 사용량 */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>메모리 사용량</h4>
            <span className={`status-indicator status-${getPerformanceStatus(metrics?.memoryUsage || 0, { warning: 512, critical: 1024 })}`}></span>
          </div>
          <div className="metric-value">
            {metrics?.memoryUsage || 0}MB
          </div>
          <div className="metric-change">
            {metrics?.memoryChange > 0 ? '+' : ''}{metrics?.memoryChange || 0}%
          </div>
          <MiniChart 
            data={prepareChartData('memoryUsage')} 
            color="#10b981" 
          />
        </div>

        {/* CPU 사용률 */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>CPU 사용률</h4>
            <span className={`status-indicator status-${getPerformanceStatus(metrics?.cpuUsage || 0, { warning: 70, critical: 90 })}`}></span>
          </div>
          <div className="metric-value">
            {metrics?.cpuUsage || 0}%
          </div>
          <div className="metric-change">
            {metrics?.cpuChange > 0 ? '+' : ''}{metrics?.cpuChange || 0}%
          </div>
          <MiniChart 
            data={prepareChartData('cpuUsage')} 
            color="#f59e0b" 
          />
        </div>

        {/* 성공률 */}
        <div className="metric-card">
          <div className="metric-header">
            <h4>성공률</h4>
            <span className={`status-indicator status-${getPerformanceStatus(100 - (metrics?.successRate * 100 || 100), { warning: 5, critical: 10 })}`}></span>
          </div>
          <div className="metric-value">
            {Math.round((metrics?.successRate || 0) * 100)}%
          </div>
          <div className="metric-change">
            {metrics?.successRateChange > 0 ? '+' : ''}{metrics?.successRateChange || 0}%
          </div>
          <MiniChart 
            data={prepareChartData('successRate')} 
            color="#ef4444" 
          />
        </div>
      </div>

      {/* 처리 모드별 성능 비교 */}
      <div className="mode-comparison">
        <h4>처리 모드별 성능 비교</h4>
        <div className="comparison-grid">
          {['legacy', 'core', 'hybrid', 'adaptive'].map(mode => (
            <div key={mode} className="mode-card">
              <h5>{mode.toUpperCase()}</h5>
              <div className="mode-metrics">
                <div className="mode-metric">
                  <span>처리 시간</span>
                  <strong>{metrics?.modeMetrics?.[mode]?.averageTime || 0}ms</strong>
                </div>
                <div className="mode-metric">
                  <span>성공률</span>
                  <strong>{Math.round((metrics?.modeMetrics?.[mode]?.successRate || 0) * 100)}%</strong>
                </div>
                <div className="mode-metric">
                  <span>사용 빈도</span>
                  <strong>{metrics?.modeMetrics?.[mode]?.usage || 0}%</strong>
                </div>
              </div>
              <div className="mode-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${metrics?.modeMetrics?.[mode]?.usage || 0}%`,
                    backgroundColor: mode === 'legacy' ? '#f59e0b' : 
                                   mode === 'core' ? '#3b82f6' : 
                                   mode === 'hybrid' ? '#10b981' : '#8b5cf6'
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 시스템 상태 */}
      <div className="system-status">
        <h4>시스템 상태</h4>
        <div className="status-grid">
          <div className="status-item">
            <i className="bi bi-server"></i>
            <div>
              <span>서버 상태</span>
              <strong className={`status-${metrics?.systemStatus?.server || 'unknown'}`}>
                {metrics?.systemStatus?.server || 'Unknown'}
              </strong>
            </div>
          </div>
          <div className="status-item">
            <i className="bi bi-database"></i>
            <div>
              <span>데이터베이스</span>
              <strong className={`status-${metrics?.systemStatus?.database || 'unknown'}`}>
                {metrics?.systemStatus?.database || 'Unknown'}
              </strong>
            </div>
          </div>
          <div className="status-item">
            <i className="bi bi-gear"></i>
            <div>
              <span>처리 엔진</span>
              <strong className={`status-${metrics?.systemStatus?.engine || 'unknown'}`}>
                {metrics?.systemStatus?.engine || 'Unknown'}
              </strong>
            </div>
          </div>
          <div className="status-item">
            <i className="bi bi-cloud"></i>
            <div>
              <span>외부 API</span>
              <strong className={`status-${metrics?.systemStatus?.externalApi || 'unknown'}`}>
                {metrics?.systemStatus?.externalApi || 'Unknown'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="recent-activity">
        <h4>최근 활동</h4>
        <div className="activity-list">
          {metrics?.recentActivity?.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-time">
                {new Date(activity.timestamp).toLocaleTimeString()}
              </div>
              <div className="activity-content">
                <span className={`activity-type type-${activity.type}`}>
                  {activity.type}
                </span>
                <span className="activity-message">{activity.message}</span>
              </div>
              <div className="activity-duration">
                {activity.duration}ms
              </div>
            </div>
          )) || (
            <div className="no-activity">최근 활동이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;