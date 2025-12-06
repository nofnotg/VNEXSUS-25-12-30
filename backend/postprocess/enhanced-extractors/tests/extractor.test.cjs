/**
 * Enhanced Extractors Test Suite
 * 
 * 향상된 추출기 모듈 테스트
 * 
 * 실행: node tests/extractor.test.js
 */

const path = require('path');
const fs = require('fs');

// 모듈 로드
const { ExtractorAdapter, NaNGuard, checkForNaN } = require('../index.cjs');

// 색상 출력
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`
};

// 테스트 결과 추적
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(colors.green(`  ✓ ${name}`));
        passed++;
    } catch (error) {
        console.log(colors.red(`  ✗ ${name}`));
        console.log(colors.red(`    Error: ${error.message}`));
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertFalse(condition, message) {
    if (condition) {
        throw new Error(message || 'Assertion failed (expected false)');
    }
}

// ============ NaNGuard 테스트 ============

console.log(colors.blue('\n📋 NaNGuard Tests\n'));

test('clean() handles undefined', () => {
    assertEqual(NaNGuard.clean(undefined), '');
    assertEqual(NaNGuard.clean(undefined, 'default'), 'default');
});

test('clean() handles null', () => {
    assertEqual(NaNGuard.clean(null), '');
    assertEqual(NaNGuard.clean(null, 'default'), 'default');
});

test('clean() handles NaN number', () => {
    assertEqual(NaNGuard.clean(NaN), '');
    assertEqual(NaNGuard.clean(NaN, 0), 0);
});

test('clean() handles "NaN" string', () => {
    assertEqual(NaNGuard.clean('NaN'), '');
});

test('clean() preserves valid values', () => {
    assertEqual(NaNGuard.clean('hello'), 'hello');
    assertEqual(NaNGuard.clean(42), 42);
    assertEqual(NaNGuard.clean(0), 0);
});

test('cleanNumber() returns number or default', () => {
    assertEqual(NaNGuard.cleanNumber(42), 42);
    assertEqual(NaNGuard.cleanNumber('100'), 100);
    assertEqual(NaNGuard.cleanNumber('abc'), 0);
    assertEqual(NaNGuard.cleanNumber(null, 999), 999);
});

test('cleanArray() cleans each element', () => {
    const arr = [1, null, 'hello', undefined, NaN];
    const cleaned = NaNGuard.cleanArray(arr);
    assertEqual(cleaned.length, 5);
    assertEqual(cleaned[1], '');
    assertEqual(cleaned[3], '');
});

test('cleanObject() recursively cleans', () => {
    const obj = {
        name: 'test',
        value: NaN,
        nested: {
            inner: undefined
        }
    };
    const cleaned = NaNGuard.cleanObject(obj);
    assertEqual(cleaned.value, '');
    assertEqual(cleaned.nested.inner, '');
    assertEqual(cleaned.name, 'test');
});

test('cleanMedicalRecord() applies proper defaults', () => {
    const record = { date: null, hospital: undefined };
    const cleaned = NaNGuard.cleanMedicalRecord(record);
    assertEqual(cleaned.date, '');
    assertEqual(cleaned.hospital, '미확인 의료기관');
    assertEqual(cleaned.diagnosis, '미확인');
});

test('findNaNLocations() finds all NaN locations', () => {
    const obj = {
        a: NaN,
        b: {
            c: 'NaN',
            d: 42
        },
        e: [1, NaN, 3]
    };
    const locations = NaNGuard.findNaNLocations(obj);
    assertTrue(locations.includes('a'));
    assertTrue(locations.includes('b.c'));
    assertTrue(locations.includes('e[1]'));
    assertEqual(locations.length, 3);
});

test('hasNaN() returns boolean', () => {
    assertTrue(NaNGuard.hasNaN({ a: NaN }));
    assertFalse(NaNGuard.hasNaN({ a: 1, b: 'test' }));
});

// ============ ExtractorAdapter 테스트 ============

console.log(colors.blue('\n📋 ExtractorAdapter Tests\n'));

test('ExtractorAdapter initializes correctly', () => {
    const adapter = new ExtractorAdapter({ useEnhanced: true });
    assertTrue(adapter !== null);
    assertTrue(adapter.options.useEnhanced === true);
});

test('ExtractorAdapter.genesToText() converts genes array', () => {
    const adapter = new ExtractorAdapter();
    const genes = [
        { content: 'Hello' },
        { raw_text: 'World' },
        { content: '' }
    ];
    const text = adapter.genesToText(genes);
    assertTrue(text.includes('Hello'));
    assertTrue(text.includes('World'));
});

test('ExtractorAdapter.getExtractors() returns all extractors', () => {
    const adapter = new ExtractorAdapter();
    const extractors = adapter.getExtractors();

    assertTrue(extractors.visitDates !== undefined);
    assertTrue(extractors.diagnoses !== undefined);
    assertTrue(extractors.examinations !== undefined);
    assertTrue(extractors.visitReasons !== undefined);
    assertTrue(extractors.admissionPeriods !== undefined);
    assertTrue(extractors.treatments !== undefined);
    assertTrue(extractors.pastHistory !== undefined);
    assertTrue(extractors.doctorOpinion !== undefined);
});

test('Legacy diagnosis extract works', async () => {
    const adapter = new ExtractorAdapter({ useEnhanced: false });
    const genes = [
        { content: '진단: 고혈압', confidence: 0.9 },
        { content: '병명: 당뇨병', confidence: 0.85 }
    ];

    const result = await adapter.extractDiagnosis(genes, {}, {});
    assertTrue(result.summary !== undefined);
    assertTrue(result.items !== undefined);
    assertTrue(result.confidence > 0);
});

test('Legacy visit dates extract works', async () => {
    const adapter = new ExtractorAdapter({ useEnhanced: false });
    const genes = [
        { content: '진료일: 2024-01-15', confidence: 0.9 },
        { content: '내원일: 2024-02-20', confidence: 0.85 }
    ];

    const result = await adapter.extractVisitDates(genes, {}, {});
    assertTrue(result.dates.length > 0);
    assertTrue(result.dates.includes('2024-01-15') || result.dates.includes('2024-02-20'));
});

test('Facility noise filtering works', () => {
    const adapter = new ExtractorAdapter();

    // _filterFacilityNoise 직접 테스트
    const facilities = [
        { name: '서울대학교병원' },
        { name: '========== 파일: test.pdf ==========' },
        { name: '1/9 빈경환' },
        { name: '강남성심병원' }
    ];

    const filtered = adapter._filterFacilityNoise(facilities);
    assertEqual(filtered.length, 2);
    assertTrue(filtered.some(f => f.name.includes('서울대학교병원')));
    assertTrue(filtered.some(f => f.name.includes('강남성심병원')));
});

// ============ 통합 테스트 ============

console.log(colors.blue('\n📋 Integration Tests\n'));

test('checkForNaN helper works', () => {
    const result1 = checkForNaN({ a: 1, b: 'test' });
    assertFalse(result1.hasNaN);

    const result2 = checkForNaN({ a: NaN, b: 'test' });
    assertTrue(result2.hasNaN);
    assertTrue(result2.locations.includes('a'));
});

test('Full extraction pipeline with NaN guard', async () => {
    const adapter = new ExtractorAdapter({
        useEnhanced: false,
        enableNaNGuard: true
    });

    const genes = [
        { content: '진단: 고혈압 (I10)', confidence: 0.9 },
        { content: '진료일: 2024-01-15', confidence: undefined } // NaN source
    ];

    const diagnosis = await adapter.extractDiagnosis(genes, {}, {});
    const dates = await adapter.extractVisitDates(genes, {}, {});

    // NaN이 없어야 함
    assertFalse(NaNGuard.hasNaN(diagnosis));
    assertFalse(NaNGuard.hasNaN(dates));
});

// ============ 결과 출력 ============

console.log(colors.blue('\n' + '='.repeat(50)));
console.log(colors.blue('Test Results'));
console.log(colors.blue('='.repeat(50)));
console.log(colors.green(`  Passed: ${passed}`));
if (failed > 0) {
    console.log(colors.red(`  Failed: ${failed}`));
} else {
    console.log(`  Failed: ${failed}`);
}
console.log(colors.blue(`  Total:  ${passed + failed}`));
console.log(colors.blue('='.repeat(50) + '\n'));

// 종료 코드
process.exit(failed > 0 ? 1 : 0);
