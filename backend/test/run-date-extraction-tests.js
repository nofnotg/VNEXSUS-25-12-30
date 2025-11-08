/**
 * 날짜 추출 테스트 실행 스크립트
 * 20종 테스트 케이스로 80% 추출률 달성 검증
 */

import axios from 'axios';
import { dateExtractionTestCases } from './date-extraction-test-cases.js';

class DateExtractionTester {
    constructor(baseUrl = 'http://localhost:3030') {
        this.baseUrl = baseUrl;
    }

    async runAllTests() {
        console.log('🧪 날짜 추출 테스트 시작...');
        console.log(`📊 총 ${dateExtractionTestCases.length}개 테스트 케이스 실행`);
        console.log('=' .repeat(60));

        const results = {
            total: dateExtractionTestCases.length,
            passed: 0,
            failed: 0,
            extractionRate: 0,
            details: [],
            categoryStats: {},
            startTime: Date.now()
        };

        for (let i = 0; i < dateExtractionTestCases.length; i++) {
            const testCase = dateExtractionTestCases[i];
            console.log(`\n[${i + 1}/${dateExtractionTestCases.length}] 테스트: ${testCase.id}`);
            console.log(`📝 텍스트: ${testCase.text}`);
            
            try {
                const response = await this.processText(testCase.text);
                const result = this.evaluateResult(testCase, response);
                
                results.details.push(result);
                
                if (result.success) {
                    results.passed++;
                    console.log(`✅ 성공 - 추출률: ${(result.extractionRate * 100).toFixed(1)}%`);
                } else {
                    results.failed++;
                    console.log(`❌ 실패 - 추출률: ${(result.extractionRate * 100).toFixed(1)}%`);
                }
                
                console.log(`📅 추출된 날짜: ${result.extracted}개 / 예상: ${result.expected}개`);
                
                if (result.dates && result.dates.length > 0) {
                    result.dates.forEach(date => {
                        console.log(`   - ${date.date || date.value} (${date.type || 'unknown'}, 신뢰도: ${date.confidence || 'N/A'})`);
                    });
                }

            } catch (error) {
                results.failed++;
                const errorResult = {
                    id: testCase.id,
                    category: testCase.category,
                    success: false,
                    error: error.message,
                    expected: testCase.expectedDates.length,
                    extracted: 0,
                    extractionRate: 0
                };
                
                results.details.push(errorResult);
                console.log(`❌ 오류: ${error.message}`);
            }

            // 서버 부하 방지를 위한 지연
            await this.delay(100);
        }

        results.extractionRate = results.passed / results.total;
        results.endTime = Date.now();
        results.duration = results.endTime - results.startTime;
        results.categoryStats = this.analyzeCategoryStats(results.details);

        this.printSummary(results);
        return results;
    }

    async processText(text) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/hybrid/process`, {
                document: { text }
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`HTTP ${error.response.status}: ${error.response.data?.error || 'Unknown error'}`);
            } else if (error.request) {
                throw new Error('서버에 연결할 수 없습니다');
            } else {
                throw new Error(`요청 오류: ${error.message}`);
            }
        }
    }

    evaluateResult(testCase, response) {
        const extractedDates = response.result?.dates || [];
        const expectedCount = testCase.expectedDates.length;
        const extractedCount = extractedDates.length;
        
        // 80% 기준으로 성공 판정
        const threshold = 0.8;
        const extractionRate = extractedCount / expectedCount;
        const isSuccess = extractionRate >= threshold;

        return {
            id: testCase.id,
            category: testCase.category,
            success: isSuccess,
            expected: expectedCount,
            extracted: extractedCount,
            extractionRate: extractionRate,
            dates: extractedDates,
            processingTime: response.processingTime,
            confidence: response.result?.confidence || 0
        };
    }

    analyzeCategoryStats(details) {
        const categoryStats = {};
        
        details.forEach(detail => {
            if (!categoryStats[detail.category]) {
                categoryStats[detail.category] = {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    extractionRate: 0,
                    avgConfidence: 0
                };
            }
            
            const stats = categoryStats[detail.category];
            stats.total++;
            
            if (detail.success) {
                stats.passed++;
            } else {
                stats.failed++;
            }
            
            stats.avgConfidence += detail.confidence || 0;
        });

        // 평균 계산
        Object.keys(categoryStats).forEach(category => {
            const stats = categoryStats[category];
            stats.extractionRate = stats.passed / stats.total;
            stats.avgConfidence = stats.avgConfidence / stats.total;
        });

        return categoryStats;
    }

    printSummary(results) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 날짜 추출 테스트 결과 요약');
        console.log('='.repeat(60));
        
        console.log(`\n🎯 전체 결과:`);
        console.log(`   총 테스트: ${results.total}개`);
        console.log(`   성공: ${results.passed}개`);
        console.log(`   실패: ${results.failed}개`);
        console.log(`   전체 추출률: ${(results.extractionRate * 100).toFixed(1)}%`);
        console.log(`   실행 시간: ${(results.duration / 1000).toFixed(2)}초`);
        
        const targetRate = 80;
        const achieved = results.extractionRate * 100;
        
        if (achieved >= targetRate) {
            console.log(`\n🎉 목표 달성! (${achieved.toFixed(1)}% >= ${targetRate}%)`);
        } else {
            console.log(`\n⚠️  목표 미달성 (${achieved.toFixed(1)}% < ${targetRate}%)`);
        }

        console.log(`\n📈 카테고리별 성능:`);
        Object.entries(results.categoryStats).forEach(([category, stats]) => {
            const rate = (stats.extractionRate * 100).toFixed(1);
            const confidence = (stats.avgConfidence * 100).toFixed(1);
            console.log(`   ${category}: ${rate}% (${stats.passed}/${stats.total}) - 평균 신뢰도: ${confidence}%`);
        });

        console.log(`\n🔍 실패한 테스트:`);
        const failedTests = results.details.filter(d => !d.success);
        if (failedTests.length === 0) {
            console.log('   없음 - 모든 테스트 통과! 🎉');
        } else {
            failedTests.forEach(test => {
                console.log(`   - ${test.id} (${test.category}): ${(test.extractionRate * 100).toFixed(1)}%`);
                if (test.error) {
                    console.log(`     오류: ${test.error}`);
                }
            });
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 스크립트 직접 실행 시
const tester = new DateExtractionTester();

tester.runAllTests()
    .then(results => {
        const exitCode = results.extractionRate >= 0.8 ? 0 : 1;
        process.exit(exitCode);
    })
    .catch(error => {
        console.error('❌ 테스트 실행 중 오류 발생:', error.message);
        process.exit(1);
    });

export default DateExtractionTester;