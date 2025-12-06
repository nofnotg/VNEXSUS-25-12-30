/**
 * ICD Code Preservation Test (Phase 4 - T08)
 */

import codeExtractor from '../postprocess/codeExtractor.js';
import medicalEventModel from '../postprocess/medicalEventModel.js';

console.log('🧪 ICD Code Preservation Test\n');

// 1. CodeExtractor 테스트
console.log('1. CodeExtractor Test');
const text = "환자는 위암(C16.9) 진단을 받았으며, 과거 고혈압(I10) 병력이 있음.";
const codes = codeExtractor.extractCodes(text);
console.log(`   Text: "${text}"`);
console.log(`   Extracted: ${JSON.stringify(codes.map(c => c.code))}`);

if (codes.length === 2 && codes[0].code === 'C16.9' && codes[1].code === 'I10') {
    console.log('   ✅ Extraction Success');
} else {
    console.error('   ❌ Extraction Failed');
    process.exit(1);
}

// 2. Merge Logic 테스트
console.log('\n2. Merge Logic Test');
const event1 = {
    id: 'E1', date: '2024-01-01', hospital: 'A병원',
    diagnosis: { name: '위암', code: 'C16' }, // 덜 구체적
    procedures: [], treatments: [], confidence: 0.8
};

const event2 = {
    id: 'E2', date: '2024-01-01', hospital: 'A병원',
    diagnosis: { name: '상세불명의 위암', code: 'C16.9' }, // 더 구체적
    procedures: [], treatments: [], confidence: 0.9
};

const merged = medicalEventModel.mergeEvents(event1, event2);
console.log(`   Event 1 Code: ${event1.diagnosis.code}`);
console.log(`   Event 2 Code: ${event2.diagnosis.code}`);
console.log(`   Merged Code: ${merged.diagnosis.code}`);
console.log(`   Related Codes: ${JSON.stringify(merged.relatedCodes)}`);

if (merged.diagnosis.code === 'C16.9' && merged.relatedCodes.includes('C16')) {
    console.log('   ✅ Merge Success (Specific code preserved)');
} else {
    console.error('   ❌ Merge Failed');
    process.exit(1);
}

console.log('\n✅ All Tests Passed!');
