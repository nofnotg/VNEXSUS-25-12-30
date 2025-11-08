// TextArrayDateControllerComplete.generatePerformanceReport unit tests
// ESM/Jest environment

import { TextArrayDateController } from '../../src/dna-engine/core/textArrayDateControllerComplete.js';

describe('TextArrayDateControllerComplete.generatePerformanceReport', () => {
  test('returns basic structure with defaults', () => {
    const ctrl = new TextArrayDateController();
    const report = ctrl.generatePerformanceReport();

    expect(typeof report.version).toBe('string');
    expect(report.version.length).toBeGreaterThan(0);

    expect(report).toHaveProperty('metrics');
    expect(report.metrics).toHaveProperty('cacheHitRate');
    expect(report).toHaveProperty('cacheStats');
    expect(report.cacheStats).toHaveProperty('hits');
    expect(report.cacheStats).toHaveProperty('misses');
    expect(report.cacheStats).toHaveProperty('hitRate');
    expect(report).toHaveProperty('cacheInfo');
    expect(report.cacheInfo).toHaveProperty('preprocessCacheSize');
    expect(report.cacheInfo).toHaveProperty('datePatternCacheSize');
    expect(report.cacheInfo).toHaveProperty('medicalKeywordCacheSize');
    expect(report).toHaveProperty('timestamp');
  });

  test('computes hitRate correctly when hits and misses present', () => {
    const ctrl = new TextArrayDateController();
    ctrl.cacheStats.hits = 3;
    ctrl.cacheStats.misses = 1;

    const report = ctrl.generatePerformanceReport();
    expect(report.cacheStats.hitRate).toBeCloseTo(0.75, 5);
  });

  test('hitRate is 0 when no cache operations', () => {
    const ctrl = new TextArrayDateController();
    ctrl.cacheStats.hits = 0;
    ctrl.cacheStats.misses = 0;

    const report = ctrl.generatePerformanceReport();
    expect(report.cacheStats.hitRate).toBe(0);
  });

  test('reports cache sizes based on internal maps', () => {
    const ctrl = new TextArrayDateController();
    ctrl.preprocessCache.set('a', 'x');
    ctrl.preprocessCache.set('b', 'y');
    ctrl.datePatternCache.set('d', [/\d{4}-\d{2}-\d{2}/]);
    ctrl.medicalKeywordCache.set('m', ['진단']);

    const report = ctrl.generatePerformanceReport();
    expect(report.cacheInfo.preprocessCacheSize).toBe(2);
    expect(report.cacheInfo.datePatternCacheSize).toBe(1);
    expect(report.cacheInfo.medicalKeywordCacheSize).toBe(1);
  });
});

