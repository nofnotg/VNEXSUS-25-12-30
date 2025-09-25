# TASK-2025-01-20-MONITORING-SYSTEM

## 📋 Task 개요

**Task ID**: TASK-2025-01-20-MONITORING-SYSTEM  
**생성일**: 2025-01-17  
**시작 예정일**: 2025-01-20  
**우선순위**: 🟡 MEDIUM  
**예상 기간**: 4주 (2025-01-20 ~ 2025-02-17)  
**담당자**: 백엔드 개발자 1명 + DevOps 엔지니어 1명  

### 목표
날짜 분류 시스템의 **실시간 모니터링, 품질 관리, 성능 추적** 시스템 구축

### 성공 기준
- ✅ 실시간 성능 모니터링: 응답시간, 정확도, 오류율 추적
- ✅ 자동 알림 시스템: 임계값 초과 시 즉시 알림
- ✅ 품질 관리: 자동 테스트 및 회귀 검증
- ✅ 대시보드: 실시간 시각화 및 트렌드 분석
- ✅ 로그 분석: 상세한 로그 수집 및 분석

---

## 🏗️ 모니터링 시스템 아키텍처

### 전체 시스템 구조
```
┌─────────────────────────────────────────────────────────────┐
│                   Monitoring System                        │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │  Data Collector │   Metrics       │   Alert         │   │
│  │  • API Metrics  │   Processor     │   Manager       │   │
│  │  • Performance  │   • Aggregation │   • Thresholds  │   │
│  │  • Error Logs   │   • Analysis    │   • Notifications│   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│  ┌─────────────────┬─────────────────┬─────────────────┐   │
│  │  Dashboard      │   Quality       │   Log           │   │
│  │  • Real-time    │   Manager       │   Analyzer      │   │
│  │  • Historical   │   • Auto Tests  │   • Pattern     │   │
│  │  • Trends       │   • Regression  │   • Insights    │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 플로우
```
API Request → Metrics Collector → Time Series DB → Dashboard
     ↓              ↓                    ↓           ↓
Error Logs → Log Analyzer → Alert System → Notifications
     ↓              ↓                    ↓           ↓
Quality Tests → Test Results → Quality Reports → Actions
```

---

## 🎯 세부 작업 계획

### Week 1: 기본 모니터링 인프라 (2025-01-20 ~ 2025-01-26)

#### Day 1-3: 메트릭 수집기 구현
**작업 내용:**
- [ ] MetricsCollector 클래스 구현
- [ ] API 성능 메트릭 수집
- [ ] 시스템 리소스 모니터링
- [ ] 커스텀 메트릭 정의

**MetricsCollector 구현:**
```javascript
// 새 파일: src/monitoring/metricsCollector.js
class MetricsCollector {
  constructor(options = {}) {
    this.metrics = new Map();
    this.timeSeries = [];
    this.config = {
      collectInterval: options.collectInterval || 5000, // 5초
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7일
      maxDataPoints: options.maxDataPoints || 10000
    };
    
    this.startCollection();
  }
  
  // API 요청 메트릭 수집
  recordApiRequest(endpoint, method, statusCode, responseTime, accuracy = null) {
    const timestamp = Date.now();
    const metricData = {
      timestamp,
      endpoint,
      method,
      statusCode,
      responseTime,
      accuracy,
      success: statusCode >= 200 && statusCode < 300
    };
    
    // 실시간 메트릭 업데이트
    this.updateRealTimeMetrics(metricData);
    
    // 시계열 데이터 저장
    this.addTimeSeriesData(metricData);
    
    // 임계값 확인
    this.checkThresholds(metricData);
  }
  
  // 날짜 추출 성능 메트릭
  recordDateExtraction(result) {
    const timestamp = Date.now();
    const metricData = {
      timestamp,
      type: 'date_extraction',
      processingTime: result.processingTime,
      accuracy: result.accuracy,
      dateCount: result.dates?.length || 0,
      textLength: result.textLength,
      extractor: result.extractor, // 'simplified' or 'legacy'
      success: result.success,
      errorType: result.errorType || null
    };
    
    this.updateRealTimeMetrics(metricData);
    this.addTimeSeriesData(metricData);
    this.checkThresholds(metricData);
  }
  
  // 시스템 리소스 메트릭
  recordSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metricData = {
      timestamp: Date.now(),
      type: 'system',
      memory: {
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
    
    this.addTimeSeriesData(metricData);
  }
  
  updateRealTimeMetrics(data) {
    const key = `${data.type || 'api'}_${data.endpoint || 'general'}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        averageAccuracy: 0,
        errorRate: 0,
        lastUpdated: Date.now()
      });
    }
    
    const metric = this.metrics.get(key);
    metric.totalRequests++;
    
    if (data.success) {
      metric.successfulRequests++;
    }
    
    // 이동 평균 계산
    if (data.responseTime) {
      metric.averageResponseTime = this.calculateMovingAverage(
        metric.averageResponseTime,
        data.responseTime,
        metric.totalRequests
      );
    }
    
    if (data.accuracy !== null && data.accuracy !== undefined) {
      metric.averageAccuracy = this.calculateMovingAverage(
        metric.averageAccuracy,
        data.accuracy,
        metric.successfulRequests
      );
    }
    
    metric.errorRate = 1 - (metric.successfulRequests / metric.totalRequests);
    metric.lastUpdated = Date.now();
    
    this.metrics.set(key, metric);
  }
  
  calculateMovingAverage(currentAvg, newValue, count) {
    return (currentAvg * (count - 1) + newValue) / count;
  }
  
  addTimeSeriesData(data) {
    this.timeSeries.push(data);
    
    // 데이터 포인트 수 제한
    if (this.timeSeries.length > this.config.maxDataPoints) {
      this.timeSeries = this.timeSeries.slice(-this.config.maxDataPoints);
    }
    
    // 오래된 데이터 정리
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.timeSeries = this.timeSeries.filter(item => item.timestamp > cutoffTime);
  }
  
  checkThresholds(data) {
    const thresholds = {
      maxResponseTime: 5000, // 5초
      minAccuracy: 0.8, // 80%
      maxErrorRate: 0.05, // 5%
      maxMemoryUsage: 1024 * 1024 * 1024 // 1GB
    };
    
    const alerts = [];
    
    if (data.responseTime && data.responseTime > thresholds.maxResponseTime) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `응답 시간 임계값 초과: ${data.responseTime}ms`,
        data: data
      });
    }
    
    if (data.accuracy !== null && data.accuracy < thresholds.minAccuracy) {
      alerts.push({
        type: 'accuracy',
        severity: 'critical',
        message: `정확도 임계값 미달: ${(data.accuracy * 100).toFixed(1)}%`,
        data: data
      });
    }
    
    // 알림 발송
    for (const alert of alerts) {
      this.sendAlert(alert);
    }
  }
  
  sendAlert(alert) {
    // AlertManager로 알림 전송
    if (global.alertManager) {
      global.alertManager.sendAlert(alert);
    }
    
    console.warn(`🚨 [${alert.severity.toUpperCase()}] ${alert.message}`);
  }
  
  startCollection() {
    // 주기적으로 시스템 메트릭 수집
    setInterval(() => {
      this.recordSystemMetrics();
    }, this.config.collectInterval);
  }
  
  getMetrics() {
    return {
      realtime: Object.fromEntries(this.metrics),
      timeSeries: this.timeSeries.slice(-100), // 최근 100개
      summary: this.generateSummary()
    };
  }
  
  generateSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentData = this.timeSeries.filter(item => item.timestamp > oneHourAgo);
    
    if (recentData.length === 0) {
      return { message: '최근 1시간 데이터 없음' };
    }
    
    const apiRequests = recentData.filter(item => item.type !== 'system');
    const systemData = recentData.filter(item => item.type === 'system');
    
    return {
      period: '최근 1시간',
      totalRequests: apiRequests.length,
      averageResponseTime: this.calculateAverage(apiRequests, 'responseTime'),
      averageAccuracy: this.calculateAverage(apiRequests, 'accuracy'),
      errorRate: this.calculateErrorRate(apiRequests),
      averageMemoryUsage: this.calculateAverage(systemData, 'memory.heapUsed')
    };
  }
  
  calculateAverage(data, field) {
    const values = data
      .map(item => this.getNestedValue(item, field))
      .filter(val => val !== null && val !== undefined);
    
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  calculateErrorRate(data) {
    const total = data.length;
    const errors = data.filter(item => !item.success).length;
    return total > 0 ? errors / total : 0;
  }
}

// 전역 메트릭 수집기 인스턴스
global.metricsCollector = new MetricsCollector();

module.exports = MetricsCollector;
```

#### Day 4-5: 알림 시스템 구현
**작업 내용:**
- [ ] AlertManager 클래스 구현
- [ ] 다양한 알림 채널 지원 (이메일, 슬랙, 웹훅)
- [ ] 알림 규칙 및 임계값 설정
- [ ] 알림 중복 방지 로직

**AlertManager 구현:**
```javascript
// 새 파일: src/monitoring/alertManager.js
class AlertManager {
  constructor(options = {}) {
    this.config = {
      email: options.email || null,
      slack: options.slack || null,
      webhook: options.webhook || null,
      cooldownPeriod: options.cooldownPeriod || 300000, // 5분
      maxAlertsPerHour: options.maxAlertsPerHour || 10
    };
    
    this.alertHistory = new Map();
    this.recentAlerts = [];
  }
  
  async sendAlert(alert) {
    // 중복 알림 방지
    if (this.isDuplicateAlert(alert)) {
      console.log(`중복 알림 무시: ${alert.message}`);
      return;
    }
    
    // 알림 빈도 제한
    if (this.isRateLimited()) {
      console.log('알림 빈도 제한으로 인해 알림 무시');
      return;
    }
    
    // 알림 기록
    this.recordAlert(alert);
    
    // 다양한 채널로 알림 발송
    const promises = [];
    
    if (this.config.email) {
      promises.push(this.sendEmailAlert(alert));
    }
    
    if (this.config.slack) {
      promises.push(this.sendSlackAlert(alert));
    }
    
    if (this.config.webhook) {
      promises.push(this.sendWebhookAlert(alert));
    }
    
    // 콘솔 로그는 항상 출력
    this.logAlert(alert);
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('알림 발송 중 오류:', error);
    }
  }
  
  isDuplicateAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}_${alert.message}`;
    const lastAlertTime = this.alertHistory.get(alertKey);
    
    if (lastAlertTime && (Date.now() - lastAlertTime) < this.config.cooldownPeriod) {
      return true;
    }
    
    return false;
  }
  
  isRateLimited() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentAlertsCount = this.recentAlerts.filter(
      alert => alert.timestamp > oneHourAgo
    ).length;
    
    return recentAlertsCount >= this.config.maxAlertsPerHour;
  }
  
  recordAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}_${alert.message}`;
    const timestamp = Date.now();
    
    this.alertHistory.set(alertKey, timestamp);
    this.recentAlerts.push({ ...alert, timestamp });
    
    // 오래된 알림 기록 정리
    const oneHourAgo = timestamp - (60 * 60 * 1000);
    this.recentAlerts = this.recentAlerts.filter(
      alert => alert.timestamp > oneHourAgo
    );
  }
  
  async sendEmailAlert(alert) {
    if (!this.config.email.enabled) return;
    
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter(this.config.email.smtp);
    
    const mailOptions = {
      from: this.config.email.from,
      to: this.config.email.to,
      subject: `[${alert.severity.toUpperCase()}] 날짜 분류 시스템 알림`,
      html: this.generateEmailTemplate(alert)
    };
    
    try {
      await transporter.sendMail(mailOptions);
      console.log('이메일 알림 발송 완료');
    } catch (error) {
      console.error('이메일 알림 발송 실패:', error);
    }
  }
  
  async sendSlackAlert(alert) {
    if (!this.config.slack.enabled) return;
    
    const axios = require('axios');
    
    const slackMessage = {
      channel: this.config.slack.channel,
      username: '날짜분류시스템',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        title: `${alert.type} 알림`,
        text: alert.message,
        fields: [
          {
            title: '심각도',
            value: alert.severity,
            short: true
          },
          {
            title: '시간',
            value: new Date().toLocaleString('ko-KR'),
            short: true
          }
        ],
        footer: '날짜 분류 시스템 모니터링',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    try {
      await axios.post(this.config.slack.webhookUrl, slackMessage);
      console.log('슬랙 알림 발송 완료');
    } catch (error) {
      console.error('슬랙 알림 발송 실패:', error);
    }
  }
  
  async sendWebhookAlert(alert) {
    if (!this.config.webhook.enabled) return;
    
    const axios = require('axios');
    
    const webhookPayload = {
      timestamp: Date.now(),
      alert: alert,
      system: 'date-classification-system',
      environment: process.env.NODE_ENV || 'development'
    };
    
    try {
      await axios.post(this.config.webhook.url, webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.webhook.auth || ''
        }
      });
      console.log('웹훅 알림 발송 완료');
    } catch (error) {
      console.error('웹훅 알림 발송 실패:', error);
    }
  }
  
  logAlert(alert) {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date().toLocaleString('ko-KR');
    
    console.log(`\n${emoji} [${alert.severity.toUpperCase()}] ${alert.type} 알림`);
    console.log(`📅 시간: ${timestamp}`);
    console.log(`📝 메시지: ${alert.message}`);
    
    if (alert.data) {
      console.log(`📊 데이터:`, JSON.stringify(alert.data, null, 2));
    }
    
    console.log('─'.repeat(50));
  }
  
  getSeverityEmoji(severity) {
    const emojiMap = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'critical': '🚨',
      'error': '❌'
    };
    return emojiMap[severity] || '📢';
  }
  
  getSeverityColor(severity) {
    const colorMap = {
      'info': '#36a64f',
      'warning': '#ff9500',
      'critical': '#ff0000',
      'error': '#ff0000'
    };
    return colorMap[severity] || '#808080';
  }
  
  generateEmailTemplate(alert) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
          <div style="border-left: 4px solid ${this.getSeverityColor(alert.severity)}; padding-left: 20px;">
            <h2 style="color: ${this.getSeverityColor(alert.severity)};">
              ${this.getSeverityEmoji(alert.severity)} ${alert.type} 알림
            </h2>
            <p><strong>심각도:</strong> ${alert.severity}</p>
            <p><strong>메시지:</strong> ${alert.message}</p>
            <p><strong>시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            ${alert.data ? `<p><strong>상세 데이터:</strong><br><pre>${JSON.stringify(alert.data, null, 2)}</pre></p>` : ''}
          </div>
          <hr>
          <p style="color: #666; font-size: 12px;">
            이 알림은 날짜 분류 시스템 모니터링에서 자동으로 발송되었습니다.
          </p>
        </body>
      </html>
    `;
  }
  
  getAlertHistory() {
    return {
      recent: this.recentAlerts.slice(-50), // 최근 50개
      summary: this.generateAlertSummary()
    };
  }
  
  generateAlertSummary() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentAlerts = this.recentAlerts.filter(
      alert => alert.timestamp > oneHourAgo
    );
    
    const summary = {
      total: recentAlerts.length,
      bySeverity: {},
      byType: {}
    };
    
    recentAlerts.forEach(alert => {
      summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
      summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
    });
    
    return summary;
  }
}

// 전역 알림 관리자 인스턴스
global.alertManager = new AlertManager({
  email: {
    enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO
  },
  slack: {
    enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    channel: process.env.SLACK_CHANNEL || '#alerts'
  },
  webhook: {
    enabled: process.env.WEBHOOK_ALERTS_ENABLED === 'true',
    url: process.env.WEBHOOK_URL,
    auth: process.env.WEBHOOK_AUTH
  }
});

module.exports = AlertManager;
```

#### Day 6-7: API 통합
**작업 내용:**
- [ ] 기존 API에 모니터링 미들웨어 추가
- [ ] 메트릭 수집 자동화
- [ ] 성능 추적 구현

**모니터링 미들웨어:**
```javascript
// 새 파일: src/middleware/monitoringMiddleware.js
const MetricsCollector = require('../monitoring/metricsCollector');

class MonitoringMiddleware {
  static createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 응답 완료 시 메트릭 수집
      const originalSend = res.send;
      res.send = function(data) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // API 메트릭 수집
        global.metricsCollector.recordApiRequest(
          req.route?.path || req.path,
          req.method,
          res.statusCode,
          responseTime
        );
        
        // 날짜 추출 결과가 있는 경우 추가 메트릭 수집
        if (req.path.includes('preprocess') && data) {
          try {
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.data) {
              global.metricsCollector.recordDateExtraction({
                processingTime: responseTime,
                accuracy: result.data.accuracy,
                dateCount: result.data.dates?.length || 0,
                textLength: req.body?.text?.length || 0,
                extractor: result.metadata?.extractor || 'unknown',
                success: result.success,
                errorType: result.success ? null : result.error
              });
            }
          } catch (error) {
            console.warn('메트릭 수집 중 오류:', error);
          }
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}

module.exports = MonitoringMiddleware;
```

### Week 2: 대시보드 구현 (2025-01-27 ~ 2025-02-02)

#### Day 8-10: 실시간 대시보드 개발
**작업 내용:**
- [ ] 웹 기반 대시보드 구현
- [ ] 실시간 차트 및 그래프
- [ ] 메트릭 시각화
- [ ] 반응형 디자인

**대시보드 API 엔드포인트:**
```javascript
// 새 파일: backend/routes/monitoring.js
const express = require('express');
const router = express.Router();

// 실시간 메트릭 조회
router.get('/metrics', (req, res) => {
  try {
    const metrics = global.metricsCollector.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 알림 히스토리 조회
router.get('/alerts', (req, res) => {
  try {
    const alerts = global.alertManager.getAlertHistory();
    res.json({
      success: true,
      data: alerts,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 시스템 상태 조회
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json({
    success: true,
    data: health
  });
});

// 성능 트렌드 조회
router.get('/trends', (req, res) => {
  const { period = '1h', metric = 'responseTime' } = req.query;
  
  try {
    const trends = global.metricsCollector.getTrends(period, metric);
    res.json({
      success: true,
      data: trends,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

**대시보드 프론트엔드 (HTML + JavaScript):**
```html
<!-- 새 파일: public/monitoring/dashboard.html -->
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>날짜 분류 시스템 모니터링 대시보드</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-5px);
        }
        
        .metric-title {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        
        .metric-change {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 20px;
            display: inline-block;
        }
        
        .metric-change.positive {
            background-color: #d4edda;
            color: #155724;
        }
        
        .metric-change.negative {
            background-color: #f8d7da;
            color: #721c24;
        }
        
        .chart-container {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .chart-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .status-healthy { background-color: #28a745; }
        .status-warning { background-color: #ffc107; }
        .status-critical { background-color: #dc3545; }
        
        .alerts-section {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .alert-item {
            padding: 15px;
            border-left: 4px solid #ddd;
            margin-bottom: 10px;
            border-radius: 0 5px 5px 0;
        }
        
        .alert-item.warning { border-left-color: #ffc107; background-color: #fff3cd; }
        .alert-item.critical { border-left-color: #dc3545; background-color: #f8d7da; }
        .alert-item.info { border-left-color: #17a2b8; background-color: #d1ecf1; }
        
        .refresh-button {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }
        
        .refresh-button:hover {
            background: #5a6fd8;
            transform: scale(1.1);
        }
        
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 날짜 분류 시스템 모니터링 대시보드</h1>
        <p>실시간 성능 및 품질 모니터링</p>
    </div>
    
    <div class="container">
        <!-- 주요 메트릭 카드 -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">시스템 상태</div>
                <div class="metric-value">
                    <span class="status-indicator status-healthy"></span>
                    정상
                </div>
                <div class="metric-change positive">99.9% 가용률</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">평균 응답 시간</div>
                <div class="metric-value" id="avgResponseTime">-</div>
                <div class="metric-change" id="responseTimeChange">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">정확도</div>
                <div class="metric-value" id="accuracy">-</div>
                <div class="metric-change" id="accuracyChange">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">오류율</div>
                <div class="metric-value" id="errorRate">-</div>
                <div class="metric-change" id="errorRateChange">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">처리된 요청</div>
                <div class="metric-value" id="totalRequests">-</div>
                <div class="metric-change" id="requestsChange">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">메모리 사용량</div>
                <div class="metric-value" id="memoryUsage">-</div>
                <div class="metric-change" id="memoryChange">-</div>
            </div>
        </div>
        
        <!-- 차트 섹션 -->
        <div class="chart-container">
            <div class="chart-title">응답 시간 트렌드</div>
            <canvas id="responseTimeChart" width="400" height="200"></canvas>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">정확도 트렌드</div>
            <canvas id="accuracyChart" width="400" height="200"></canvas>
        </div>
        
        <!-- 최근 알림 -->
        <div class="alerts-section">
            <div class="chart-title">최근 알림</div>
            <div id="alertsList">
                <p>알림을 불러오는 중...</p>
            </div>
        </div>
    </div>
    
    <button class="refresh-button" onclick="refreshData()">🔄</button>
    
    <script>
        let responseTimeChart, accuracyChart;
        
        // 차트 초기화
        function initCharts() {
            const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
            responseTimeChart = new Chart(responseTimeCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: '응답 시간 (ms)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            
            const accuracyCtx = document.getElementById('accuracyChart').getContext('2d');
            accuracyChart = new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: '정확도 (%)',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
        
        // 데이터 새로고침
        async function refreshData() {
            try {
                // 메트릭 데이터 가져오기
                const metricsResponse = await fetch('/api/monitoring/metrics');
                const metricsData = await metricsResponse.json();
                
                if (metricsData.success) {
                    updateMetricCards(metricsData.data);
                    updateCharts(metricsData.data.timeSeries);
                }
                
                // 알림 데이터 가져오기
                const alertsResponse = await fetch('/api/monitoring/alerts');
                const alertsData = await alertsResponse.json();
                
                if (alertsData.success) {
                    updateAlerts(alertsData.data.recent);
                }
                
            } catch (error) {
                console.error('데이터 새로고침 실패:', error);
            }
        }
        
        // 메트릭 카드 업데이트
        function updateMetricCards(data) {
            const summary = data.summary;
            
            document.getElementById('avgResponseTime').textContent = 
                summary.averageResponseTime ? `${Math.round(summary.averageResponseTime)}ms` : '-';
            
            document.getElementById('accuracy').textContent = 
                summary.averageAccuracy ? `${(summary.averageAccuracy * 100).toFixed(1)}%` : '-';
            
            document.getElementById('errorRate').textContent = 
                summary.errorRate ? `${(summary.errorRate * 100).toFixed(1)}%` : '-';
            
            document.getElementById('totalRequests').textContent = 
                summary.totalRequests || '-';
            
            document.getElementById('memoryUsage').textContent = 
                summary.averageMemoryUsage ? `${(summary.averageMemoryUsage / 1024 / 1024).toFixed(1)}MB` : '-';
        }
        
        // 차트 업데이트
        function updateCharts(timeSeries) {
            if (!timeSeries || timeSeries.length === 0) return;
            
            const last20Points = timeSeries.slice(-20);
            const labels = last20Points.map(point => 
                new Date(point.timestamp).toLocaleTimeString('ko-KR')
            );
            
            // 응답 시간 차트
            const responseTimes = last20Points
                .filter(point => point.responseTime)
                .map(point => point.responseTime);
            
            responseTimeChart.data.labels = labels.slice(-responseTimes.length);
            responseTimeChart.data.datasets[0].data = responseTimes;
            responseTimeChart.update();
            
            // 정확도 차트
            const accuracies = last20Points
                .filter(point => point.accuracy !== null && point.accuracy !== undefined)
                .map(point => point.accuracy * 100);
            
            accuracyChart.data.labels = labels.slice(-accuracies.length);
            accuracyChart.data.datasets[0].data = accuracies;
            accuracyChart.update();
        }
        
        // 알림 목록 업데이트
        function updateAlerts(alerts) {
            const alertsList = document.getElementById('alertsList');
            
            if (!alerts || alerts.length === 0) {
                alertsList.innerHTML = '<p>최근 알림이 없습니다.</p>';
                return;
            }
            
            const alertsHtml = alerts.slice(0, 10).map(alert => `
                <div class="alert-item ${alert.severity}">
                    <strong>${alert.type}</strong> - ${alert.message}
                    <br>
                    <small>${new Date(alert.timestamp).toLocaleString('ko-KR')}</small>
                </div>
            `).join('');
            
            alertsList.innerHTML = alertsHtml;
        }
        
        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', function() {
            initCharts();
            refreshData();
            
            // 30초마다 자동 새로고침
            setInterval(refreshData, 30000);
        });
    </script>
</body>
</html>
```

#### Day 11-14: 트렌드 분석 및 리포팅
**작업 내용:**
- [ ] 시계열 데이터 분석
- [ ] 성능 트렌드 리포트
- [ ] 자동 리포트 생성
- [ ] 데이터 내보내기 기능

### Week 3: 품질 관리 시스템 (2025-02-03 ~ 2025-02-09)

#### Day 15-17: 자동 테스트 시스템
**작업 내용:**
- [ ] QualityManager 클래스 구현
- [ ] 자동 회귀 테스트
- [ ] 성능 벤치마크 자동화
- [ ] 품질 게이트 설정

#### Day 18-21: 로그 분석 시스템
**작업 내용:**
- [ ] LogAnalyzer 클래스 구현
- [ ] 패턴 분석 및 인사이트 추출
- [ ] 오류 패턴 감지
- [ ] 성능 병목 지점 식별

### Week 4: 최적화 및 배포 (2025-02-10 ~ 2025-02-17)

#### Day 22-25: 성능 최적화
**작업 내용:**
- [ ] 모니터링 오버헤드 최소화
- [ ] 데이터 압축 및 저장 최적화
- [ ] 메모리 사용량 최적화
- [ ] 네트워크 트래픽 최적화

#### Day 26-28: 배포 및 문서화
**작업 내용:**
- [ ] 프로덕션 배포
- [ ] 운영 가이드 작성
- [ ] 사용자 매뉴얼 작성
- [ ] 모니터링 시스템 완료 보고서

---

## 🧪 테스트 전략

### 기능 테스트
- [ ] 메트릭 수집 정확성 테스트
- [ ] 알림 발송 테스트
- [ ] 대시보드 기능 테스트
- [ ] API 엔드포인트 테스트

### 성능 테스트
- [ ] 모니터링 오버헤드 측정
- [ ] 대용량 데이터 처리 테스트
- [ ] 동시 접속 테스트
- [ ] 메모리 누수 테스트

### 안정성 테스트
- [ ] 장기간 운영 테스트
- [ ] 장애 상황 시뮬레이션
- [ ] 복구 시나리오 테스트

---

## 📊 성공 지표

### 기술적 KPI
1. **모니터링 정확도**: 99% 이상
2. **알림 응답 시간**: 30초 이내
3. **대시보드 로딩 시간**: 3초 이내
4. **모니터링 오버헤드**: 5% 이하

### 운영 KPI
1. **시스템 가시성**: 100% 커버리지
2. **문제 감지 시간**: 평균 1분 이내
3. **알림 정확도**: 95% 이상 (거짓 양성 5% 이하)
4. **운영자 만족도**: 4.5/5.0 이상

---

## 🚨 위험 요소 및 대응 방안

### 기술적 위험
1. **모니터링 오버헤드**
   - 대응: 비동기 처리 및 배치 수집
   - 모니터링: 성능 영향 지속 측정

2. **데이터 저장 용량**
   - 대응: 데이터 압축 및 자동 정리
   - 백업: 외부 저장소 연동

3. **알림 폭주**
   - 대응: 알림 빈도 제한 및 그룹화
   - 검증: 알림 규칙 지속 개선

### 운영 위험
1. **모니터링 시스템 장애**
   - 대응: 이중화 및 백업 시스템
   - 복구: 자동 복구 메커니즘

---

## 📝 체크리스트

### Week 1: 기본 모니터링 인프라
- [ ] MetricsCollector 구현 완료
- [ ] AlertManager 구현 완료
- [ ] API 모니터링 미들웨어 통합
- [ ] 기본 메트릭 수집 동작 확인

### Week 2: 대시보드 구현
- [ ] 실시간 대시보드 구현 완료
- [ ] 차트 및 시각화 완료
- [ ] 모바일 반응형 디자인 완료
- [ ] API 엔드포인트 구현 완료

### Week 3: 품질 관리 시스템
- [ ] 자동 테스트 시스템 구현
- [ ] 로그 분석 시스템 구현
- [ ] 품질 게이트 설정 완료
- [ ] 회귀 테스트 자동화 완료

### Week 4: 최적화 및 배포
- [ ] 성능 최적화 완료
- [ ] 프로덕션 배포 완료
- [ ] 운영 문서 작성 완료
- [ ] 모니터링 시스템 완료 보고서 작성

### 최종 검증
- [ ] 모든 KPI 목표 달성
- [ ] 안정성 테스트 통과
- [ ] 운영팀 교육 완료
- [ ] 24/7 모니터링 체계 구축

---

## 📋 향후 확장 계획

### 고급 기능
- [ ] 머신러닝 기반 이상 탐지
- [ ] 예측적 알림 시스템
- [ ] 자동 성능 튜닝
- [ ] 비즈니스 메트릭 연동

### 통합 확장
- [ ] 다른 시스템과의 모니터링 통합
- [ ] 클라우드 모니터링 서비스 연동
- [ ] APM 도구 통합
- [ ] 로그 관리 시스템 연동

---

*Task 생성일: 2025-01-17*  
*병행 Task: TASK-2025-01-17-PHASE1-EMERGENCY-FIX*  
*연계 Task: 모든 Phase와 연동*  
*목표: 완전한 시스템 가시성 및 품질 보장*