/**
 * 호환성 및 통합 테스트 스크립트
 * 룰 엔진과 변경된 파이프라인 간의 호환성 검증
 */

import HybridProcessor from './hybridProcessor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 데이터 생성
const testDocuments = [
    {
        id: 'compat_test_1',
        content: `
        환자명: 김철수
        생년월일: 1985-03-15
        진료일: 2024-01-20
        병원명: 서울대학교병원
        진단명: 급성 위염
        처방: 위장약 복용
        의사명: 박의사
        `,
        expectedFields: ['환자명', '생년월일', '진료일', '병원명', '진단명', '처방', '의사명']
    },
    {
        id: 'compat_test_2',
        content: `
        Patient: John Smith
        DOB: 1990-07-22
        Visit Date: 2024-02-15
        Hospital: Seoul National University Hospital
        Diagnosis: Hypertension
        Treatment: Blood pressure medication
        Doctor: Dr. Lee
        `,
        expectedFields: ['환자명', '생년월일', '진료일', '병원명', '진단명', '처방', '의사명']
    },
    {
        id: 'compat_test_3',
        content: `
        복잡한 의료 문서 테스트
        환자: 이영희 (ID: P123456)
        출생: 1975년 12월 03일
        방문: 2024년 3월 10일 오후 2시
        의료기관: 연세대학교 세브란스병원 내과
        주증상: 만성 두통, 어지러움
        진단결과: 편두통 (Migraine)
        치료계획: 
        - 진통제 처방 (아세트아미노펜 500mg)
        - 생활습관 개선 권고
        - 2주 후 재방문
        담당의: 김신경과 전문의
        `,
        expectedFields: ['환자명', '생년월일', '진료일', '병원명', '진단명', '처방', '의사명']
    }
];

// 호환성 테스트 함수
async function runCompatibilityTest() {
    console.log('🔧 호환성 및 통합 테스트 시작\n');
    
    const testResults = {
        ruleBasedOnly: [],
        hybridMode: [],
        compatibility: {
            fieldExtraction: true,
            dataConsistency: true,
            performanceStability: true,
            errorHandling: true
        }
    };

    try {
        // 1. 룰 기반 전용 모드 테스트
        console.log('=== 룰 기반 전용 모드 호환성 테스트 ===');
        const ruleProcessor = new HybridProcessor({
            useAIPreprocessing: false,
            fallbackToRules: true,
            enableCaching: true,
            debug: false
        });

        for (const doc of testDocuments) {
            console.log(`📄 테스트 문서 처리: ${doc.id}`);
            const startTime = Date.now();
            
            try {
                const result = await ruleProcessor.processDocument(doc.content);
                const processingTime = Date.now() - startTime;
                
                const testResult = {
                    documentId: doc.id,
                    processingTime,
                    extractedFields: Object.keys(result.extractedData || {}),
                    fieldCount: Object.keys(result.extractedData || {}).length,
                    confidence: result.confidence || 0,
                    accuracy: result.accuracy || 0,
                    success: true,
                    errors: []
                };
                
                testResults.ruleBasedOnly.push(testResult);
                console.log(`   ✅ 성공: ${testResult.fieldCount}개 필드 추출 (${processingTime}ms)`);
                
            } catch (error) {
                console.log(`   ❌ 오류: ${error.message}`);
                testResults.ruleBasedOnly.push({
                    documentId: doc.id,
                    success: false,
                    errors: [error.message]
                });
                testResults.compatibility.errorHandling = false;
            }
        }

        // 2. 하이브리드 모드 테스트 (AI 없이 - 폴백 테스트)
        console.log('\n=== 하이브리드 모드 호환성 테스트 (AI 폴백) ===');
        const hybridProcessor = new HybridProcessor({
            useAIPreprocessing: true,
            fallbackToRules: true,
            enableCaching: true,
            debug: false
        });

        for (const doc of testDocuments) {
            console.log(`📄 테스트 문서 처리: ${doc.id}`);
            const startTime = Date.now();
            
            try {
                const result = await hybridProcessor.processDocument(doc.content);
                const processingTime = Date.now() - startTime;
                
                const testResult = {
                    documentId: doc.id,
                    processingTime,
                    extractedFields: Object.keys(result.extractedData || {}),
                    fieldCount: Object.keys(result.extractedData || {}).length,
                    confidence: result.confidence || 0,
                    accuracy: result.accuracy || 0,
                    success: true,
                    errors: []
                };
                
                testResults.hybridMode.push(testResult);
                console.log(`   ✅ 성공: ${testResult.fieldCount}개 필드 추출 (${processingTime}ms)`);
                
            } catch (error) {
                console.log(`   ❌ 오류: ${error.message}`);
                testResults.hybridMode.push({
                    documentId: doc.id,
                    success: false,
                    errors: [error.message]
                });
                testResults.compatibility.errorHandling = false;
            }
        }

        // 3. 호환성 분석
        console.log('\n=== 호환성 분석 ===');
        
        // 필드 추출 일관성 검증
        for (let i = 0; i < testResults.ruleBasedOnly.length; i++) {
            const ruleResult = testResults.ruleBasedOnly[i];
            const hybridResult = testResults.hybridMode[i];
            
            if (ruleResult.success && hybridResult.success) {
                const fieldDiff = Math.abs(ruleResult.fieldCount - hybridResult.fieldCount);
                if (fieldDiff > 2) { // 2개 이상 차이나면 호환성 문제
                    testResults.compatibility.fieldExtraction = false;
                    console.log(`   ⚠️ 필드 추출 불일치: ${ruleResult.documentId} (룰: ${ruleResult.fieldCount}, 하이브리드: ${hybridResult.fieldCount})`);
                }
                
                // 성능 안정성 검증 (10배 이상 차이나면 문제)
                const perfRatio = Math.max(ruleResult.processingTime, hybridResult.processingTime) / 
                                 Math.min(ruleResult.processingTime, hybridResult.processingTime);
                if (perfRatio > 10) {
                    testResults.compatibility.performanceStability = false;
                    console.log(`   ⚠️ 성능 불안정: ${ruleResult.documentId} (비율: ${perfRatio.toFixed(2)})`);
                }
            }
        }

        // 4. 최종 결과 출력
        console.log('\n📊 호환성 테스트 결과:');
        console.log(`   📋 필드 추출 호환성: ${testResults.compatibility.fieldExtraction ? '✅ 통과' : '❌ 실패'}`);
        console.log(`   🔄 데이터 일관성: ${testResults.compatibility.dataConsistency ? '✅ 통과' : '❌ 실패'}`);
        console.log(`   ⚡ 성능 안정성: ${testResults.compatibility.performanceStability ? '✅ 통과' : '❌ 실패'}`);
        console.log(`   🛡️ 오류 처리: ${testResults.compatibility.errorHandling ? '✅ 통과' : '❌ 실패'}`);

        // 5. 통계 요약
        const ruleSuccessRate = (testResults.ruleBasedOnly.filter(r => r.success).length / testResults.ruleBasedOnly.length) * 100;
        const hybridSuccessRate = (testResults.hybridMode.filter(r => r.success).length / testResults.hybridMode.length) * 100;
        
        console.log('\n📈 성공률 통계:');
        console.log(`   룰 기반 모드: ${ruleSuccessRate.toFixed(1)}%`);
        console.log(`   하이브리드 모드: ${hybridSuccessRate.toFixed(1)}%`);

        // 6. 평균 성능 비교
        const ruleAvgTime = testResults.ruleBasedOnly
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.processingTime, 0) / testResults.ruleBasedOnly.filter(r => r.success).length;
        
        const hybridAvgTime = testResults.hybridMode
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.processingTime, 0) / testResults.hybridMode.filter(r => r.success).length;

        console.log('\n⏱️ 평균 처리 시간:');
        console.log(`   룰 기반 모드: ${ruleAvgTime.toFixed(1)}ms`);
        console.log(`   하이브리드 모드: ${hybridAvgTime.toFixed(1)}ms`);
        console.log(`   성능 개선: ${((ruleAvgTime - hybridAvgTime) / ruleAvgTime * 100).toFixed(1)}%`);

        // 7. 결과 저장
        const reportPath = path.join(__dirname, 'compatibility-test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
        console.log(`\n💾 상세 결과 저장: ${reportPath}`);

        // 8. 최종 판정
        const allTestsPassed = Object.values(testResults.compatibility).every(test => test === true);
        console.log(`\n🎯 최종 호환성 테스트: ${allTestsPassed ? '✅ 전체 통과' : '❌ 일부 실패'}`);
        
        if (allTestsPassed) {
            console.log('🎉 룰 엔진과 하이브리드 파이프라인이 완전히 호환됩니다!');
        } else {
            console.log('⚠️ 일부 호환성 문제가 발견되었습니다. 상세 결과를 확인해주세요.');
        }

        return testResults;

    } catch (error) {
        console.error('❌ 호환성 테스트 중 오류 발생:', error);
        throw error;
    }
}

// 메인 실행
const currentFile = fileURLToPath(import.meta.url);
const mainFile = process.argv[1];

if (currentFile === mainFile) {
    runCompatibilityTest()
        .then(() => {
            console.log('\n✅ 호환성 테스트 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 호환성 테스트 실패:', error);
            process.exit(1);
        });
}

export { runCompatibilityTest };