import medicalEventModel from '../../backend/postprocess/medicalEventModel.js';

describe('MedicalEventModel.normalizeDate', () => {
  test('normalizes YYYY-MM-DD', () => {
    expect(medicalEventModel.normalizeDate('2025-12-27')).toBe('2025-12-27');
  });

  test('normalizes Korean date', () => {
    expect(medicalEventModel.normalizeDate('2025년 12월 27일')).toBe('2025-12-27');
  });

  test('normalizes dotted date', () => {
    expect(medicalEventModel.normalizeDate('2025.12.27')).toBe('2025-12-27');
  });

  test('normalizes slashed date', () => {
    expect(medicalEventModel.normalizeDate('12/27/2025')).toBe('2025-12-27');
  });

  test('returns input string if not parseable', () => {
    expect(medicalEventModel.normalizeDate('invalid-date')).toBe('invalid-date');
  });
});

