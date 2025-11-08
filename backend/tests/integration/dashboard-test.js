/**
 * 대시보드 API 통합 테스트
 * 실시간 모니터링, 성능 메트릭, 알림 시스템 검증
 */

import fetch from 'node-fetch';
import { createLogger } from '../../utils/enhancedLogger.js';

const logger = createLogger('DashboardTest');
const BASE_URL = 'http://localhost:3030';

class DashboardIntegrationTest {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
    }

    /**
     * 모든 대시보드 테스트 실행
     */
    async runAllTests() {
        console.log('🧪 대시보드 통합 테스트 시작...\n');
        
        try {
            await this.testMetricsAPI();
            await this.testAlertsAPI();
            await this.testPerformanceComparisonAPI();
            await this.testLogsAPI();
            await this.testRealTimeUpdates();
            
            this.printTestResults();
        } catch (error) {
            console.error('❌ 테스트 실행 중 오류:', error);
        }
    }

    /**
     * 메트릭 API 테스트
     */
    async testMetricsAPI() {
        console.log('📊 메트릭 API 테스트...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/metrics`);
            const data = await response.json();
            
            // 응답 구조 검증
            const requiredFields = ['processing', 'cache', 'memory', 'engines', 'routing', 'optimization'];
            const missingFields = requiredFields.filter(field => !data.data[field]);
            
            if (response.status === 200 && data.success && missingFields.length === 0) {
                this.addTestResult('메트릭 API', true, '모든 필수 필드 포함');
                console.log('  ✅ 메트릭 API 정상 작동');
                console.log(`  📈 처리 시간: ${data.data.processing.averageTime}ms`);
                console.log(`  🔄 처리량: ${data.data.processing.throughput} req/min`);
            } else {
                this.addTestResult('메트릭 API', false, `누락된 필드: ${missingFields.join(', ')}`);
                console.log('  ❌ 메트릭 API 응답 구조 오류');
            }
        } catch (error) {
            this.addTestResult('메트릭 API', false, error.message);
            console.log('  ❌ 메트릭 API 호출 실패:', error.message);
        }
    }

    /**
     * 알림 API 테스트
     */
    async testAlertsAPI() {
        console.log('🚨 알림 API 테스트...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/alerts`);
            const data = await response.json();
            
            if (response.status === 200 && data.success && Array.isArray(data.data)) {
                this.addTestResult('알림 API', true, `${data.data.length}개 알림 조회`);
                console.log('  ✅ 알림 API 정상 작동');
                console.log(`  📢 활성 알림: ${data.data.length}개`);
            } else {
                this.addTestResult('알림 API', false, '응답 형식 오류');
                console.log('  ❌ 알림 API 응답 오류');
            }
        } catch (error) {
            this.addTestResult('알림 API', false, error.message);
            console.log('  ❌ 알림 API 호출 실패:', error.message);
        }
    }

    /**
     * 성능 비교 API 테스트
     */
    async testPerformanceComparisonAPI() {
        console.log('⚡ 성능 비교 API 테스트...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/performance-comparison`);
            const data = await response.json();
            
            const hasEngines = data.data && data.data.engines;
            const hasRecommendations = data.data && data.data.recommendations;
            
            if (response.status === 200 && data.success && hasEngines && hasRecommendations) {
                this.addTestResult('성능 비교 API', true, '엔진 비교 데이터 포함');
                console.log('  ✅ 성능 비교 API 정상 작동');
                console.log(`  🏎️ 엔진 수: ${Object.keys(data.data.engines).length}개`);
            } else {
                this.addTestResult('성능 비교 API', false, '필수 데이터 누락');
                console.log('  ❌ 성능 비교 API 데이터 오류');
            }
        } catch (error) {
            this.addTestResult('성능 비교 API', false, error.message);
            console.log('  ❌ 성능 비교 API 호출 실패:', error.message);
        }
    }

    /**
     * 로그 스트림 API 테스트
     */
    async testLogsAPI() {
        console.log('📝 로그 스트림 API 테스트...');
        
        try {
            const response = await fetch(`${BASE_URL}/api/dashboard/logs`);
            
            if (response.status === 200 && response.headers.get('content-type').includes('text/event-stream')) {
                this.addTestResult('로그 스트림 API', true, 'SSE 연결 성공');
                console.log('  ✅ 로그 스트림 API 정상 작동');
                
                // 연결 즉시 종료 (테스트 목적)
                response.body.destroy();
            } else {
                this.addTestResult('로그 스트림 API', false, 'SSE 헤더 누락');
                console.log('  ❌ 로그 스트림 API 헤더 오류');
            }
        } catch (error) {
            this.addTestResult('로그 스트림 API', false, error.message);
            console.log('  ❌ 로그 스트림 API 호출 실패:', error.message);
        }
    }

    /**
     * 실시간 업데이트 테스트
     */
    async testRealTimeUpdates() {
        console.log('🔄 실시간 업데이트 테스트...');
        
        try {
            // 연속 3회 메트릭 호출로 실시간 업데이트 확인
            const responses = [];
            for (let i = 0; i < 3; i++) {
                const response = await fetch(`${BASE_URL}/api/dashboard/metrics`);
                const data = await response.json();
                responses.push(data.timestamp);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            }
            
            // 타임스탬프가 모두 다른지 확인 (실시간 업데이트 증명)
            const uniqueTimestamps = new Set(responses);
            
            if (uniqueTimestamps.size === 3) {
                this.addTestResult('실시간 업데이트', true, '타임스탬프 변경 확인');
                console.log('  ✅ 실시간 업데이트 정상 작동');
            } else {
                this.addTestResult('실시간 업데이트', false, '타임스탬프 미변경');
                console.log('  ❌ 실시간 업데이트 오류');
            }
        } catch (error) {
            this.addTestResult('실시간 업데이트', false, error.message);
            console.log('  ❌ 실시간 업데이트 테스트 실패:', error.message);
        }
    }

    /**
     * 테스트 결과 추가
     */
    addTestResult(testName, passed, details) {
        this.testResults.push({
            name: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 테스트 결과 출력
     */
    printTestResults() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.passed).length;
        const failedTests = totalTests - passedTests;
        const duration = Date.now() - this.startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log('📋 대시보드 통합 테스트 결과');
        console.log('='.repeat(60));
        console.log(`⏱️  총 실행 시간: ${duration}ms`);
        console.log(`✅ 성공: ${passedTests}/${totalTests}`);
        console.log(`❌ 실패: ${failedTests}/${totalTests}`);
        console.log(`📊 성공률: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        console.log('\n📝 상세 결과:');
        this.testResults.forEach((test, index) => {
            const status = test.passed ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${test.name}: ${test.details}`);
        });
        
        if (passedTests === totalTests) {
            console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!');
        } else {
            console.log('\n⚠️  일부 테스트가 실패했습니다. 로그를 확인해주세요.');
        }
        
        console.log('='.repeat(60));
    }
}

// 테스트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new DashboardIntegrationTest();
    tester.runAllTests().catch(console.error);
}

export default DashboardIntegrationTest;