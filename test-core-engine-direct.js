// test-core-engine-direct.js - Direct Core Engine Test
import coreEngineService from './backend/services/coreEngineService.js';

const testText = `진료기록부

환자명: 김철수
주민등록번호: 850315-1******
진료일자: 2024년 11월 15일

주호소: 복통 및 구토

현병력:
환자는 2024년 11월 14일 저녁부터 시작된 우하복부 통증을 주소로 내원하였습니다.
통증은 지속적이며 움직일 때 악화되는 양상을 보였습니다.
구토 3회 있었으며, 발열(38.5도)이 동반되었습니다.

과거력:
- 2020년: 고혈압 진단 (현재 약물 복용 중)
- 2018년: 당뇨병 진단 (인슐린 치료 중)

신체검사:
- 활력징후: 혈압 140/90 mmHg, 맥박 88회/분, 호흡수 18회/분, 체온 38.5도
- 복부: 우하복부 압통 및 반발통 양성, 장음 감소

검사 소견:
- 혈액검사: WBC 15,000/μL (증가), CRP 8.5 mg/dL (증가)
- 복부 CT: 충수돌기 비후 및 주변 염증 소견

진단: 급성 충수염 (Acute Appendicitis, K35.8)

치료 계획:
1. 응급 충수절제술 시행 예정
2. 항생제 투여 (Ceftriaxone 2g IV q24h)
3. 금식 및 수액 요법

담당의사: 홍길동
면허번호: 123456
`;

async function testCoreEngine() {
    console.log('🔬 Core Engine Direct Test\n');
    console.log('================================================================================');
    console.log('Testing Core Engine Service...\n');

    try {
        // Check if Core Engine is enabled
        console.log('1. Checking Core Engine status...');
        const isEnabled = coreEngineService.isEnabled;
        console.log(`   Core Engine enabled: ${isEnabled}`);

        if (!isEnabled) {
            console.log('   ❌ Core Engine is disabled. Exiting test.');
            process.exit(1);
        }

        // Test analyze method
        console.log('\n2. Running Core Engine analysis...');
        const startTime = Date.now();

        const result = await coreEngineService.analyze({ text: testText });

        const endTime = Date.now();
        console.log(`   ✅ Analysis completed in ${endTime - startTime}ms\n`);

        // Display results
        console.log('================================================================================');
        console.log('📊 Analysis Results:\n');

        if (result.skeletonJson) {
            console.log('✅ Skeleton JSON generated');
            console.log(`   Report Items: ${result.skeletonJson.reportItems?.length || 0}`);
            console.log(`   Quality Score: ${result.skeletonJson.metadata?.qualityScore || 'N/A'}`);
            console.log(`   Confidence: ${result.skeletonJson.metadata?.confidence || 'N/A'}`);
        } else {
            console.log('❌ No skeleton JSON in result');
        }

        if (result.executionMetadata) {
            console.log('\n📈 Execution Metadata:');
            console.log(`   Processing Time: ${result.executionMetadata.processingTimeMs}ms`);
            console.log(`   Quality Gate: ${result.executionMetadata.qualityGate}`);
            console.log(`   Fallback Used: ${result.executionMetadata.fallbackUsed}`);
            console.log(`   Cache Used: ${result.executionMetadata.cacheUsed}`);

            if (result.executionMetadata.stateHistory) {
                console.log(`\n   State History (${result.executionMetadata.stateHistory.length} states):`);
                result.executionMetadata.stateHistory.forEach(state => {
                    console.log(`     - ${state.state}: ${state.executionTimeMs}ms (${state.success ? '✅' : '❌'})`);
                });
            }

            if (result.executionMetadata.errors && result.executionMetadata.errors.length > 0) {
                console.log(`\n   ⚠️  Errors (${result.executionMetadata.errors.length}):`);
                result.executionMetadata.errors.forEach(err => {
                    console.log(`     - ${err}`);
                });
            }
        }

        console.log('\n================================================================================');
        console.log('✅ Test completed successfully\n');

        // Save full result to file
        const fs = await import('fs');
        fs.writeFileSync(
            'core-engine-test-result.json',
            JSON.stringify(result, null, 2)
        );
        console.log('📁 Full result saved to: core-engine-test-result.json\n');

        process.exit(0);

    } catch (error) {
        console.log('\n================================================================================');
        console.log('❌ Test failed with error:\n');
        console.error(error);
        console.log('\n================================================================================\n');
        process.exit(1);
    }
}

testCoreEngine();
