/**
 * 전체 케이스 분석 결과에서 누락 패턴 추출
 */

const data = require('./case_comparison_analysis.json');

const allMissing = {
    hospitals: new Set(),
    diagnoses: new Set(),
    dates: [],
    noiseCount: 0
};

// 모든 케이스에서 누락 항목 수집
data.results.forEach(r => {
    if (r.comparison) {
        r.comparison.hospitalMatch?.missing?.forEach(h => allMissing.hospitals.add(h));
        r.comparison.diagnosisMatch?.missing?.forEach(d => allMissing.diagnoses.add(d));
        allMissing.dates.push(...(r.comparison.dateMatch?.missing || []));
        allMissing.noiseCount += r.comparison.issues?.length || 0;
    }
});

console.log('='.repeat(60));
console.log('전체 케이스 분석 인사이트');
console.log('='.repeat(60));

console.log('\n📊 분석 요약:');
console.log(`  - 분석된 케이스: ${data.results.length}개`);
console.log(`  - 총 노이즈 발견: ${allMissing.noiseCount}건`);

console.log('\n🏥 누락된 병원명 목록:');
[...allMissing.hospitals].forEach(h => console.log(`  - ${h}`));

console.log('\n🩺 누락된 ICD 코드 목록:');
const icdCodes = [...allMissing.diagnoses];
console.log(`  총 ${icdCodes.length}개 고유 코드: ${icdCodes.slice(0, 20).join(', ')}${icdCodes.length > 20 ? '...' : ''}`);

// 카테고리별 분류
const icdCategories = {};
icdCodes.forEach(code => {
    const cat = code.charAt(0);
    if (!icdCategories[cat]) icdCategories[cat] = [];
    icdCategories[cat].push(code);
});

console.log('\n  카테고리별:');
for (const [cat, codes] of Object.entries(icdCategories)) {
    const catNames = {
        'A': '감염성', 'B': '감염성', 'C': '종양', 'D': '종양/혈액',
        'E': '내분비', 'F': '정신과', 'G': '신경계', 'H': '감각기관',
        'I': '순환계', 'J': '호흡기', 'K': '소화기', 'L': '피부',
        'M': '근골격', 'N': '비뇨생식', 'O': '산과', 'P': '주산기',
        'Q': '선천성', 'R': '증상', 'S': '외상', 'T': '외상', 'Z': '건강상태요인'
    };
    console.log(`    ${cat} (${catNames[cat] || '기타'}): ${codes.join(', ')}`);
}

console.log('\n📅 날짜 누락 통계:');
console.log(`  총 ${allMissing.dates.length}개 날짜 누락`);
const uniqueDates = [...new Set(allMissing.dates)];
console.log(`  고유 날짜: ${uniqueDates.length}개`);

// 연도별 분포
const yearDist = {};
uniqueDates.forEach(d => {
    const year = d.split('-')[0];
    yearDist[year] = (yearDist[year] || 0) + 1;
});
console.log('  연도별 분포:', yearDist);

// 추천사항 출력
console.log('\n💡 추가 권장 개선사항:');
console.log('  1. 다음 병원명을 knownHospitals에 추가:');
[...allMissing.hospitals].filter(h => !h.includes('치료') && !h.includes('미확인')).forEach(h => console.log(`     "${h}",`));

console.log('\n  2. 다음 ICD 코드에 대한 한글 진단명을 koreanDiseases에 추가:');
icdCodes.slice(0, 15).forEach(code => console.log(`     '${code}': { icd: '${code}', category: '${icdCategories[code.charAt(0)] ? '...' : 'unknown'}' },`));
