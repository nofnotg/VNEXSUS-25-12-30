import fs from 'fs';
import path from 'path';

const tempDir = path.join(process.cwd(), 'temp');

console.log('=== 하이브리드 시스템 결과 분석 ===\n');

// 결과 파일들 확인
const resultFiles = [
    'case1_simple_test_result.json',
    'hybrid_test_result.json',
    'case1_hybrid_result.json',
    'case1_hybrid_final_result.json'
];

const results = {};

for (const filename of resultFiles) {
    const filepath = path.join(tempDir, filename);
    if (fs.existsSync(filepath)) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            results[filename] = JSON.parse(content);
            console.log(`✓ ${filename} 로드됨`);
        } catch (error) {
            console.log(`✗ ${filename} 로드 실패: ${error.message}`);
        }
    } else {
        console.log(`- ${filename} 파일 없음`);
    }
}

console.log(`\n총 ${Object.keys(results).length}개의 결과 파일 분석\n`);

// 각 결과 분석
for (const [filename, data] of Object.entries(results)) {
    console.log(`=== ${filename} 분석 ===`);
    
    if (data.success) {
        console.log(`✓ 처리 성공 (${data.processingTime}ms)`);
        
        // 날짜 분석
        if (data.result?.dates && data.result.dates.length > 0) {
            console.log(`📅 추출된 날짜: ${data.result.dates.length}개`);
            data.result.dates.forEach(date => {
                console.log(`  - ${date.date} (신뢰도: ${date.confidence.toFixed(2)}, 타입: ${date.type})`);
            });
        } else {
            console.log('📅 추출된 날짜 없음');
        }
        
        // 의료 정보 분석
        if (data.result?.medical) {
            const medical = data.result.medical;
            console.log(`🏥 의료 정보:`);
            console.log(`  - 질병/상태: ${medical.conditions?.length || 0}개`);
            console.log(`  - 약물: ${medical.medications?.length || 0}개`);
            console.log(`  - 시술/검사: ${medical.procedures?.length || 0}개`);
            console.log(`  - 증상: ${medical.symptoms?.length || 0}개`);
            
            // 상세 정보 출력
            if (medical.conditions?.length > 0) {
                console.log('  질병/상태 상세:');
                medical.conditions.forEach(condition => {
                    console.log(`    - ${condition.name} (신뢰도: ${condition.confidence?.toFixed(2) || 'N/A'})`);
                });
            }
        }
        
        // 엔티티 분석
        if (data.result?.entities && data.result.entities.length > 0) {
            console.log(`🏷️ 추출된 엔티티: ${data.result.entities.length}개`);
            data.result.entities.forEach(entity => {
                console.log(`  - ${entity.text} [${entity.type}] (신뢰도: ${entity.confidence?.toFixed(2) || 'N/A'})`);
            });
        }
        
        // 성능 정보
        if (data.result?.performance || data.performance) {
            const perf = data.result?.performance || data.performance;
            console.log(`⚡ 성능 정보:`);
            console.log(`  - 총 처리 시간: ${perf.totalPipelineTime || data.processingTime}ms`);
            if (perf.validation) {
                console.log(`  - 검증 상태: ${perf.validation.status}`);
            }
        }
        
    } else {
        console.log('✗ 처리 실패');
        if (data.error) {
            console.log(`  오류: ${data.error}`);
        }
    }
    
    console.log('');
}

// 종합 분석
console.log('=== 종합 분석 ===');

const allDates = [];
const allMedical = {
    conditions: [],
    medications: [],
    procedures: [],
    symptoms: []
};
const allEntities = [];

for (const data of Object.values(results)) {
    if (data.success && data.result) {
        // 날짜 수집
        if (data.result.dates) {
            allDates.push(...data.result.dates);
        }
        
        // 의료 정보 수집
        if (data.result.medical) {
            const medical = data.result.medical;
            if (medical.conditions) allMedical.conditions.push(...medical.conditions);
            if (medical.medications) allMedical.medications.push(...medical.medications);
            if (medical.procedures) allMedical.procedures.push(...medical.procedures);
            if (medical.symptoms) allMedical.symptoms.push(...medical.symptoms);
        }
        
        // 엔티티 수집
        if (data.result.entities) {
            allEntities.push(...data.result.entities);
        }
    }
}

// 중복 제거 및 정렬
const uniqueDates = [...new Set(allDates.map(d => d.date))].sort();
console.log(`📅 전체 고유 날짜: ${uniqueDates.length}개`);
uniqueDates.forEach(date => console.log(`  - ${date}`));

console.log(`\n🏥 전체 의료 정보:`);
console.log(`  - 질병/상태: ${allMedical.conditions.length}개`);
console.log(`  - 약물: ${allMedical.medications.length}개`);
console.log(`  - 시술/검사: ${allMedical.procedures.length}개`);
console.log(`  - 증상: ${allMedical.symptoms.length}개`);

console.log(`\n🏷️ 전체 엔티티: ${allEntities.length}개`);

// 결과 요약 저장
const summary = {
    timestamp: new Date().toISOString(),
    totalResults: Object.keys(results).length,
    successfulResults: Object.values(results).filter(r => r.success).length,
    dates: {
        total: allDates.length,
        unique: uniqueDates.length,
        list: uniqueDates
    },
    medical: {
        conditions: allMedical.conditions.length,
        medications: allMedical.medications.length,
        procedures: allMedical.procedures.length,
        symptoms: allMedical.symptoms.length
    },
    entities: allEntities.length,
    detailedResults: results
};

const summaryPath = path.join(tempDir, 'hybrid_analysis_summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`\n📊 분석 요약이 저장되었습니다: ${summaryPath}`);

console.log('\n=== 분석 완료 ===');