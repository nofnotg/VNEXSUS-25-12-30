/**
 * PII Masking Test (Phase 5 - T12)
 */

import piiMasker from '../postprocess/piiMasker.js';

console.log('🧪 PII Masking Test\n');

// 1. SSN Masking Test
console.log('1. SSN Masking Test');
const testSSN = [
    { input: '900101-1234567', expected: '900101-*******' },
    { input: '주민번호: 850315-2345678', expected: '주민번호: 850315-*******' }
];

testSSN.forEach(tc => {
    const result = piiMasker.maskSSN(tc.input);
    console.log(`   Input: "${tc.input}"`);
    console.log(`   Output: "${result}"`);
    console.log(`   ${result.includes('*******') ? '✅' : '❌'} Pass\n`);
});

// 2. Phone Masking Test
console.log('2. Phone Masking Test');
const testPhone = [
    { input: '010-1234-5678', expected: '010-****-5678' },
    { input: '연락처: 02-123-4567', expected: '연락처: 02-****-4567' }
];

testPhone.forEach(tc => {
    const result = piiMasker.maskPhone(tc.input);
    console.log(`   Input: "${tc.input}"`);
    console.log(`   Output: "${result}"`);
    console.log(`   ${result.includes('****') ? '✅' : '❌'} Pass\n`);
});

// 3. Name Masking Test
console.log('3. Name Masking Test');
const testNames = [
    { input: '홍길동', expected: '홍*동' },
    { input: '김철수', expected: '김*수' },
    { input: '이영희', expected: '이*희' }
];

testNames.forEach(tc => {
    const result = piiMasker.maskName(tc.input);
    console.log(`   Input: "${tc.input}"`);
    console.log(`   Output: "${result}"`);
    console.log(`   ${result === tc.expected ? '✅' : '❌'} Pass\n`);
});

// 4. maskAll Test
console.log('4. maskAll Test');
const testText = `환자명: 홍길동
주민번호: 900101-1234567
연락처: 010-1234-5678
이메일: hong@example.com`;

const maskedText = piiMasker.maskAll(testText);
console.log('   Original:');
console.log(testText.split('\n').map(l => `     ${l}`).join('\n'));
console.log('\n   Masked:');
console.log(maskedText.split('\n').map(l => `     ${l}`).join('\n'));

const hasSSNMasked = maskedText.includes('*******');
const hasPhoneMasked = maskedText.includes('****');
console.log(`\n   SSN Masked: ${hasSSNMasked ? '✅' : '❌'}`);
console.log(`   Phone Masked: ${hasPhoneMasked ? '✅' : '❌'}`);

// 5. Patient Info Masking Test
console.log('\n5. Patient Info Masking Test');
const patientInfo = {
    name: '홍길동',
    ssn: '900101-1234567',
    phone: '010-1234-5678',
    email: 'hong@example.com'
};

const maskedPatient = piiMasker.maskPatientInfo(patientInfo, { maskName: true });
console.log('   Original:', JSON.stringify(patientInfo, null, 2));
console.log('   Masked:', JSON.stringify(maskedPatient, null, 2));
console.log(`   ${maskedPatient.name.includes('*') ? '✅' : '❌'} Name Masked`);
console.log(`   ${maskedPatient.ssn.includes('*') ? '✅' : '❌'} SSN Masked`);

console.log('\n✅ All PII Masking Tests Completed!');
