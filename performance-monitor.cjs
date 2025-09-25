const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// 성능 모니터링 클래스
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            startTime: Date.now(),
            samples: [],
            alerts: []
        };
        this.isRunning = false;
        this.intervalId = null;
    }

    // 메모리 사용량 측정
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100
        };
    }

    // CPU 사용률 측정 (근사치)
    getCpuUsage() {
        const startUsage = process.cpuUsage();
        const startTime = performance.now();
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = performance.now();
                const timeDiff = endTime - startTime;
                
                const userPercent = (endUsage.user / 1000) / timeDiff * 100;
                const systemPercent = (endUsage.system / 1000) / timeDiff * 100;
                
                resolve({
                    user: Math.round(userPercent * 100) / 100,
                    system: Math.round(systemPercent * 100) / 100,
                    total: Math.round((userPercent + systemPercent) * 100) / 100
                });
            }, 100);
        });
    }

    // 시스템 정보 수집
    async collectMetrics() {
        const timestamp = new Date().toISOString();
        const memory = this.getMemoryUsage();
        const cpu = await this.getCpuUsage();
        const uptime = Math.round(process.uptime());
        
        const sample = {
            timestamp,
            memory,
            cpu,
            uptime,
            pid: process.pid
        };
        
        this.metrics.samples.push(sample);
        
        // 최근 100개 샘플만 유지
        if (this.metrics.samples.length > 100) {
            this.metrics.samples.shift();
        }
        
        // 알림 체크
        this.checkAlerts(sample);
        
        return sample;
    }

    // 알림 체크
    checkAlerts(sample) {
        const alerts = [];
        
        // 메모리 사용량 체크 (100MB 이상)
        if (sample.memory.heapUsed > 100) {
            alerts.push({
                type: 'memory',
                level: 'warning',
                message: `높은 메모리 사용량: ${sample.memory.heapUsed}MB`,
                timestamp: sample.timestamp
            });
        }
        
        // CPU 사용률 체크 (80% 이상)
        if (sample.cpu.total > 80) {
            alerts.push({
                type: 'cpu',
                level: 'warning',
                message: `높은 CPU 사용률: ${sample.cpu.total}%`,
                timestamp: sample.timestamp
            });
        }
        
        // 메모리 누수 체크 (지속적인 증가)
        if (this.metrics.samples.length >= 10) {
            const recent = this.metrics.samples.slice(-10);
            const trend = this.calculateMemoryTrend(recent);
            
            if (trend > 5) { // 5MB/분 이상 증가
                alerts.push({
                    type: 'memory_leak',
                    level: 'critical',
                    message: `메모리 누수 의심: ${trend.toFixed(2)}MB/분 증가`,
                    timestamp: sample.timestamp
                });
            }
        }
        
        this.metrics.alerts.push(...alerts);
        
        // 최근 50개 알림만 유지
        if (this.metrics.alerts.length > 50) {
            this.metrics.alerts = this.metrics.alerts.slice(-50);
        }
        
        return alerts;
    }

    // 메모리 트렌드 계산
    calculateMemoryTrend(samples) {
        if (samples.length < 2) return 0;
        
        const first = samples[0];
        const last = samples[samples.length - 1];
        
        const timeDiff = (new Date(last.timestamp) - new Date(first.timestamp)) / 1000 / 60; // 분
        const memoryDiff = last.memory.heapUsed - first.memory.heapUsed;
        
        return timeDiff > 0 ? memoryDiff / timeDiff : 0;
    }

    // 통계 계산
    getStatistics() {
        if (this.metrics.samples.length === 0) {
            return null;
        }
        
        const samples = this.metrics.samples;
        const memoryValues = samples.map(s => s.memory.heapUsed);
        const cpuValues = samples.map(s => s.cpu.total);
        
        return {
            sampleCount: samples.length,
            duration: Math.round((Date.now() - this.metrics.startTime) / 1000),
            memory: {
                current: memoryValues[memoryValues.length - 1],
                average: Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length * 100) / 100,
                min: Math.min(...memoryValues),
                max: Math.max(...memoryValues)
            },
            cpu: {
                current: cpuValues[cpuValues.length - 1],
                average: Math.round(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length * 100) / 100,
                min: Math.min(...cpuValues),
                max: Math.max(...cpuValues)
            },
            alerts: {
                total: this.metrics.alerts.length,
                warnings: this.metrics.alerts.filter(a => a.level === 'warning').length,
                critical: this.metrics.alerts.filter(a => a.level === 'critical').length
            }
        };
    }

    // 모니터링 시작
    start(interval = 5000) {
        if (this.isRunning) {
            console.log('⚠️  모니터링이 이미 실행 중입니다.');
            return;
        }
        
        console.log(`🔍 성능 모니터링 시작 (${interval/1000}초 간격)`);
        this.isRunning = true;
        
        this.intervalId = setInterval(async () => {
            try {
                const sample = await this.collectMetrics();
                
                // 실시간 출력
                console.log(`\n📊 [${sample.timestamp.split('T')[1].split('.')[0]}]`);
                console.log(`   메모리: ${sample.memory.heapUsed}MB (RSS: ${sample.memory.rss}MB)`);
                console.log(`   CPU: ${sample.cpu.total}% (User: ${sample.cpu.user}%, System: ${sample.cpu.system}%)`);
                console.log(`   업타임: ${sample.uptime}초`);
                
                // 새로운 알림 출력
                const newAlerts = this.checkAlerts(sample);
                newAlerts.forEach(alert => {
                    const icon = alert.level === 'critical' ? '🚨' : '⚠️';
                    console.log(`${icon} ${alert.message}`);
                });
                
            } catch (error) {
                console.error(`❌ 메트릭 수집 오류: ${error.message}`);
            }
        }, interval);
    }

    // 모니터링 중지
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  모니터링이 실행되고 있지 않습니다.');
            return;
        }
        
        clearInterval(this.intervalId);
        this.isRunning = false;
        
        console.log('\n🛑 성능 모니터링 중지');
        
        // 최종 통계 출력
        const stats = this.getStatistics();
        if (stats) {
            console.log('\n📈 최종 성능 통계:');
            console.log(`   모니터링 시간: ${stats.duration}초`);
            console.log(`   샘플 수: ${stats.sampleCount}개`);
            console.log(`   메모리 사용량: 평균 ${stats.memory.average}MB (최소 ${stats.memory.min}MB, 최대 ${stats.memory.max}MB)`);
            console.log(`   CPU 사용률: 평균 ${stats.cpu.average}% (최소 ${stats.cpu.min}%, 최대 ${stats.cpu.max}%)`);
            console.log(`   알림: 총 ${stats.alerts.total}개 (경고 ${stats.alerts.warnings}개, 심각 ${stats.alerts.critical}개)`);
        }
    }

    // 보고서 저장
    saveReport(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = filename || `performance-report-${timestamp}.json`;
        const reportPath = path.join(__dirname, 'temp', reportFile);
        
        // temp 디렉토리 생성
        const tempDir = path.dirname(reportPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                duration: Math.round((Date.now() - this.metrics.startTime) / 1000),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            },
            statistics: this.getStatistics(),
            samples: this.metrics.samples,
            alerts: this.metrics.alerts
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`💾 성능 보고서 저장: ${reportPath}`);
        
        return reportPath;
    }
}

// 메인 실행 함수
async function main() {
    const monitor = new PerformanceMonitor();
    
    console.log('🚀 MVP v7.2 AI 성능 모니터링 도구');
    console.log('=' .repeat(50));
    
    // 초기 시스템 정보
    console.log('💻 시스템 정보:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   플랫폼: ${process.platform} ${process.arch}`);
    console.log(`   PID: ${process.pid}`);
    
    // 명령행 인수 처리
    const args = process.argv.slice(2);
    const duration = args.includes('--duration') ? parseInt(args[args.indexOf('--duration') + 1]) || 60 : 60;
    const interval = args.includes('--interval') ? parseInt(args[args.indexOf('--interval') + 1]) || 5 : 5;
    
    console.log(`\n⏱️  모니터링 설정: ${duration}초 동안 ${interval}초 간격으로 실행`);
    
    // 모니터링 시작
    monitor.start(interval * 1000);
    
    // 지정된 시간 후 중지
    setTimeout(() => {
        monitor.stop();
        
        // 보고서 저장
        const reportPath = monitor.saveReport();
        
        console.log('\n✨ 성능 모니터링 완료!');
        console.log(`📋 상세 보고서: ${reportPath}`);
        
        process.exit(0);
    }, duration * 1000);
    
    // 강제 종료 처리
    process.on('SIGINT', () => {
        console.log('\n\n🛑 사용자에 의해 중단됨');
        monitor.stop();
        monitor.saveReport();
        process.exit(0);
    });
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PerformanceMonitor };