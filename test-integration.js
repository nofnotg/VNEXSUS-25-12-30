import fetch from 'node-fetch';

// DNA 분석 파이프라인 통합 테스트
async function testDnaAnalysisPipeline() {
    console.log('🧬 DNA 분석 파이프라인 통합 테스트 시작');
    
    const testData = {
        text: `2023년 1월 15일 서울대학교병원 내과 진료
환자명: 김철수
진단명: 고혈압, 당뇨병
처방: 메트포르민 500mg 1일 2회

2023년 2월 20일 재진
혈압: 140/90 mmHg
혈당: 180 mg/dL
추가처방: 리시노프릴 10mg 1일 1회`
    };
    
    const tests = [
        {
            name: '강화된 DNA 검증 분석',
            url: 'http://localhost:3030/api/enhanced-dna-validation/analyze',
            method: 'POST',
            body: testData
        },
        {
            name: 'Developer Studio 전처리',
            url: 'http://localhost:3030/api/dev/studio/preprocess-text',
            method: 'POST',
            body: testData
        },
        {
            name: 'Developer Studio 날짜 분석',
            url: 'http://localhost:3030/api/dev/studio/date-analysis/analyze',
            method: 'POST',
            body: testData
        },
        {
            name: '후처리 파이프라인',
            url: 'http://localhost:3030/api/postprocess',
            method: 'POST',
            body: { text: testData.text, options: { includeProcessedData: true } }
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`\n📋 테스트: ${test.name}`);
        const startTime = Date.now();
        
        try {
            const response = await fetch(test.url, {
                method: test.method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(test.body)
            });
            
            const responseTime = Date.now() - startTime;
            const data = await response.json();
            
            const result = {
                test: test.name,
                status: response.ok ? '성공' : '실패',
                responseTime: `${responseTime}ms`,
                statusCode: response.status,
                success: data.success !== false,
                dataSize: JSON.stringify(data).length
            };
            
            if (response.ok && data.success !== false) {
                console.log(`✅ 성공 (${responseTime}ms)`);
                if (data.statistics) {
                    console.log(`   📊 통계: ${JSON.stringify(data.statistics)}`);
                }
                if (data.processingTime) {
                    console.log(`   ⏱️  처리시간: ${data.processingTime}`);
                }
            } else {
                console.log(`❌ 실패 (${responseTime}ms): ${data.error || '알 수 없는 오류'}`);
                result.error = data.error || '알 수 없는 오류';
            }
            
            results.push(result);
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.log(`💥 오류 (${responseTime}ms): ${error.message}`);
            results.push({
                test: test.name,
                status: '오류',
                responseTime: `${responseTime}ms`,
                error: error.message
            });
        }
        
        // 테스트 간 간격
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 결과 요약
    console.log('\n📈 테스트 결과 요약:');
    console.log('=' .repeat(50));
    
    const successful = results.filter(r => r.status === '성공').length;
    const failed = results.filter(r => r.status === '실패').length;
    const errors = results.filter(r => r.status === '오류').length;
    
    console.log(`총 테스트: ${results.length}`);
    console.log(`성공: ${successful}`);
    console.log(`실패: ${failed}`);
    console.log(`오류: ${errors}`);
    
    results.forEach(result => {
        const icon = result.status === '성공' ? '✅' : result.status === '실패' ? '❌' : '💥';
        console.log(`${icon} ${result.test}: ${result.status} (${result.responseTime})`);
        if (result.error) {
            console.log(`   오류: ${result.error}`);
        }
    });
    
    return results;
}

// 성능 모니터링
async function monitorPerformance() {
    console.log('\n🔍 성능 모니터링 시작');
    
    try {
        const response = await fetch('http://localhost:3030/api/dev/studio/metrics');
        const metrics = await response.json();
        
        console.log('📊 현재 시스템 메트릭스:');
        console.log(`   메모리 사용량: ${JSON.stringify(metrics.memoryUsage)}`);
        console.log(`   업타임: ${metrics.uptime}초`);
        console.log(`   평균 처리시간: ${metrics.averageProcessingTime}ms`);
        console.log(`   총 분석 횟수: ${metrics.totalAnalyses}`);
        
        return metrics;
    } catch (error) {
        console.log(`❌ 메트릭스 조회 실패: ${error.message}`);
        return null;
    }
}

// 메인 실행
async function main() {
    console.log('🚀 MVP v7.2 AI 통합 테스트 및 성능 모니터링');
    console.log('=' .repeat(60));
    
    // 성능 모니터링 (테스트 전)
    const beforeMetrics = await monitorPerformance();
    
    // 통합 테스트 실행
    const testResults = await testDnaAnalysisPipeline();
    
    // 성능 모니터링 (테스트 후)
    console.log('\n🔍 테스트 후 성능 모니터링');
    const afterMetrics = await monitorPerformance();
    
    // 최종 보고서
    console.log('\n📋 최종 통합 테스트 보고서');
    console.log('=' .repeat(60));
    
    const overallSuccess = testResults.filter(r => r.status === '성공').length;
    const overallTotal = testResults.length;
    const successRate = ((overallSuccess / overallTotal) * 100).toFixed(1);
    
    console.log(`전체 성공률: ${successRate}% (${overallSuccess}/${overallTotal})`);
    
    if (beforeMetrics && afterMetrics && beforeMetrics.memoryUsage && afterMetrics.memoryUsage) {
        console.log(`메모리 변화: ${beforeMetrics.memoryUsage.heapUsed} → ${afterMetrics.memoryUsage.heapUsed}`);
        console.log(`분석 횟수 증가: ${afterMetrics.totalAnalyses - beforeMetrics.totalAnalyses}`);
    } else {
        console.log('메모리 변화: 메트릭스 정보 없음');
    }
    
    console.log('\n🎯 다음 단계 권장사항:');
    if (successRate < 100) {
        console.log('- 실패한 API 엔드포인트 디버깅 필요');
        console.log('- 오류 로그 분석 및 수정');
    }
    if (successRate >= 80) {
        console.log('- 성능 최적화 진행 가능');
        console.log('- 프로덕션 배포 준비 시작');
    }
    
    console.log('\n✨ 통합 테스트 완료!');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testDnaAnalysisPipeline, monitorPerformance };