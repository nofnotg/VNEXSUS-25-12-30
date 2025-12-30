const { describe, test, expect } = require('@jest/globals');

describe('MedicalEventModel.normalizeDate (backend wrapper)', () => {
  test('normalizes YYYY-MM-DD', async () => {
    const mod = await import('../../postprocess/medicalEventModel.js');
    const medicalEventModel = mod.default || mod;
    expect(medicalEventModel.normalizeDate('2025-12-27')).toBe('2025-12-27');
  });

  test('normalizes Korean date', async () => {
    const mod = await import('../../postprocess/medicalEventModel.js');
    const medicalEventModel = mod.default || mod;
    expect(medicalEventModel.normalizeDate('2025년 12월 27일')).toBe('2025-12-27');
  });

  test('normalizes dotted date', async () => {
    const mod = await import('../../postprocess/medicalEventModel.js');
    const medicalEventModel = mod.default || mod;
    expect(medicalEventModel.normalizeDate('2025.12.27')).toBe('2025-12-27');
  });

  test('normalizes slashed date', async () => {
    const mod = await import('../../postprocess/medicalEventModel.js');
    const medicalEventModel = mod.default || mod;
    expect(medicalEventModel.normalizeDate('12/27/2025')).toBe('2025-12-27');
  });

  test('returns input string if not parseable', async () => {
    const mod = await import('../../postprocess/medicalEventModel.js');
    const medicalEventModel = mod.default || mod;
    expect(medicalEventModel.normalizeDate('invalid-date')).toBe('invalid-date');
  });
});
