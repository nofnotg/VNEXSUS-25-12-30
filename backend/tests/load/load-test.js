/**
 * VNEXSUS 하이브리드 시스템 부하 테스트
 * 동시 사용자 100명 이상, 24시간 연속 운영 시뮬레이션
 */

import fetch from 'node-fetch';
import { createLogger } from '../../utils/enhancedLogger.js';

const logger = createLogger('LoadTest');
const BASE_URL = 'http://localhost:3030';

class LoadTestRunner {
    constructor() {
        this.testConfig = {
            maxConcurrentUsers: 100,
            testDurationMinutes: 5, // 실제 운영에서는 24시간 (1440분)
            requestIntervalMs: 1000,
            endpoints: [
                '/api/dashboard/metrics',
                '/api/dashboard/alerts',
                '/api/dashboard/performance-comparison'
            ]
        };
        
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: [],
            startTime: null,
            endTime: null
        };
        
        this.activeUsers = 0;
        this.isRunning = false;
    }

    /**
     * 부하 테스트 시작
     */
    async startLoadTest() {
        console.log('🚀 VNEXSUS 부하 테스트 시작...');
        console.log(`👥 동시 사용자: ${this.testConfig.maxConcurrentUsers}명`);
        console.log(`⏱️  테스트 시간: ${this.testConfig.testDurationMinutes}분`);
        console.log(`🔄 요청 간격: ${this.testConfig.requestIntervalMs}ms\n`);
        
        this.metrics.startTime = Date.now();
        this.isRunning = true;
        
        // 동시 사용자 시뮬레이션
        const userPromises = [];
        for (let i = 0; i < this.testConfig.maxConcurrentUsers; i++) {
            userPromises.push(this.simulateUser(i + 1));
        }
        
        // 테스트 시간 제한
        const testTimeout = setTimeout(() => {
            this.isRunning = false;
            console.log('\n⏰ 테스트 시간 종료');
        }, this.testConfig.testDurationMinutes * 60 * 1000);
        
        // 실시간 모니터링
        const monitoringInterval = setInterval(() => {
            this.printRealTimeStats();
        }, 10000); // 10초마다 출력
        
        try {
            await Promise.allSettled(userPromises);
        } catch (error) {
            console.error('❌ 부하 테스트 중 오류:', error);
        } finally {
            clearTimeout(testTimeout);
            clearInterval(monitoringInterval);
            this.metrics.endTime = Date.now();
            this.printFinalResults();
        }
    }

    /**
     * 개별 사용자 시뮬레이션
     */
    async simulateUser(userId) {
        this.activeUsers++;
        
        while (this.isRunning) {
            try {
                // 랜덤 엔드포인트 선택
                const endpoint = this.testConfig.endpoints[
                    Math.floor(Math.random() * this.testConfig.endpoints.length)
                ];
                
                await this.makeRequest(endpoint, userId);
                
                // 요청 간격 대기 (약간의 랜덤성 추가)
                const waitTime = this.testConfig.requestIntervalMs + 
                    (Math.random() * 500 - 250); // ±250ms 랜덤
                await this.sleep(waitTime);
                
            } catch (error) {
                this.recordError(error, userId);
            }
        }
        
        this.activeUsers--;
    }

    /**
     * API 요청 실행
     */
    async makeRequest(endpoint, userId) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                timeout: 10000 // 10초 타임아웃
            });
            
            const responseTime = Date.now() - startTime;
            this.metrics.responseTimes.push(responseTime);
            
            if (response.ok) {
                this.metrics.successfulRequests++;
            } else {
                this.metrics.failedRequests++;
                this.recordError(`HTTP ${response.status}`, userId, endpoint);
            }
            
        } catch (error) {
            this.metrics.failedRequests++;
            this.recordError(error.message, userId, endpoint);
        }
    }

    /**
     * 오류 기록
     */
    recordError(error, userId, endpoint = 'unknown') {
        this.metrics.errors.push({
            error: error.toString(),
            userId,
            endpoint,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 실시간 통계 출력
     */
    printRealTimeStats() {
        const runtime = (Date.now() - this.metrics.startTime) / 1000;
        const successRate = this.metrics.totalRequests > 0 ? 
            (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) : 0;
        const avgResponseTime = this.metrics.responseTimes.length > 0 ?
            (this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length).toFixed(2) : 0;
        const requestsPerSecond = (this.metrics.totalRequests / runtime).toFixed(2);
        
        console.log(`📊 [${Math.floor(runtime)}초] 활성 사용자: ${this.activeUsers}, 총 요청: ${this.metrics.totalRequests}, 성공률: ${successRate}%, 평균 응답시간: ${avgResponseTime}ms, RPS: ${requestsPerSecond}`);
    }

    /**
     * 최종 결과 출력
     */
    printFinalResults() {
        const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000;
        const successRate = this.metrics.totalRequests > 0 ? 
            (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) : 0;
        
        // 응답 시간 통계
        const responseTimes = this.metrics.responseTimes.sort((a, b) => a - b);
        const avgResponseTime = responseTimes.length > 0 ?
            (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) : 0;
        const p50 = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.5)] : 0;
        const p95 = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;
        const p99 = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0;
        const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
        
        const requestsPerSecond = (this.metrics.totalRequests / totalDuration).toFixed(2);
        
        console.log('\n' + '='.repeat(80));
        console.log('📋 VNEXSUS 부하 테스트 최종 결과');
        console.log('='.repeat(80));
        console.log(`⏱️  총 실행 시간: ${totalDuration.toFixed(2)}초`);
        console.log(`👥 최대 동시 사용자: ${this.testConfig.maxConcurrentUsers}명`);
        console.log(`📊 총 요청 수: ${this.metrics.totalRequests}`);
        console.log(`✅ 성공한 요청: ${this.metrics.successfulRequests}`);
        console.log(`❌ 실패한 요청: ${this.metrics.failedRequests}`);
        console.log(`📈 성공률: ${successRate}%`);
        console.log(`🚀 초당 요청 수 (RPS): ${requestsPerSecond}`);
        
        console.log('\n📊 응답 시간 통계:');
        console.log(`   평균: ${avgResponseTime}ms`);
        console.log(`   P50 (중간값): ${p50}ms`);
        console.log(`   P95: ${p95}ms`);
        console.log(`   P99: ${p99}ms`);
        console.log(`   최대: ${maxResponseTime}ms`);
        
        // 성능 평가
        console.log('\n🎯 성능 평가:');
        if (parseFloat(successRate) >= 99.5) {
            console.log('   ✅ 우수: 성공률 99.5% 이상');
        } else if (parseFloat(successRate) >= 95) {
            console.log('   ⚠️  양호: 성공률 95% 이상');
        } else {
            console.log('   ❌ 개선 필요: 성공률 95% 미만');
        }
        
        if (parseFloat(avgResponseTime) <= 1000) {
            console.log('   ✅ 우수: 평균 응답시간 1초 이하');
        } else if (parseFloat(avgResponseTime) <= 3000) {
            console.log('   ⚠️  양호: 평균 응답시간 3초 이하');
        } else {
            console.log('   ❌ 개선 필요: 평균 응답시간 3초 초과');
        }
        
        if (parseFloat(requestsPerSecond) >= 100) {
            console.log('   ✅ 우수: 초당 100 요청 이상 처리');
        } else if (parseFloat(requestsPerSecond) >= 50) {
            console.log('   ⚠️  양호: 초당 50 요청 이상 처리');
        } else {
            console.log('   ❌ 개선 필요: 초당 50 요청 미만');
        }
        
        // 오류 분석
        if (this.metrics.errors.length > 0) {
            console.log('\n❌ 오류 분석:');
            const errorCounts = {};
            this.metrics.errors.forEach(error => {
                errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
            });
            
            Object.entries(errorCounts).forEach(([error, count]) => {
                console.log(`   ${error}: ${count}회`);
            });
        }
        
        console.log('='.repeat(80));
        
        // 24시간 운영 예측
        const dailyRequests = parseFloat(requestsPerSecond) * 86400; // 24시간 = 86400초
        console.log('\n🔮 24시간 연속 운영 예측:');
        console.log(`   예상 일일 요청 수: ${dailyRequests.toLocaleString()}회`);
        console.log(`   예상 성공 요청: ${(dailyRequests * parseFloat(successRate) / 100).toLocaleString()}회`);
        console.log(`   예상 실패 요청: ${(dailyRequests * (100 - parseFloat(successRate)) / 100).toLocaleString()}회`);
    }

    /**
     * 대기 함수
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 메모리 사용량 모니터링
function startMemoryMonitoring() {
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsageMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
        
        console.log(`💾 메모리 사용량 - RSS: ${memUsageMB.rss}MB, Heap: ${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB`);
    }, 30000); // 30초마다 출력
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🔧 메모리 모니터링 시작...');
    startMemoryMonitoring();
    
    const loadTester = new LoadTestRunner();
    loadTester.startLoadTest().catch(console.error);
}

export default LoadTestRunner;