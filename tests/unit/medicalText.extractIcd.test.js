import { normalizeIcdCode, extractIcdCodes } from '../../src/shared/utils/medicalText.js';

describe('medicalText.extractIcd and normalizeIcd', () => {
  test('normalizes misformatted codes', () => {
    expect(normalizeIcdCode('I20).9')).toBe('I20.9');
    expect(normalizeIcdCode('E1168')).toBe('E11.68');
    expect(normalizeIcdCode('R074')).toBe('R07.4');
    expect(normalizeIcdCode('J0190')).toBe('J01.90');
    expect(normalizeIcdCode('K35.8')).toBe('K35.8');
  });

  test('extracts codes from text with misformats', () => {
    const text = '진단명: 협심증(I20).9), 상병: E1168 및 R074';
    const codes = extractIcdCodes(text);
    expect(codes).toEqual(['E11.68', 'I20.9', 'R07.4']);
  });

  test('extracts canonical codes and sorts', () => {
    const text = '진단: J01.90, H10.3, G47.0';
    const codes = extractIcdCodes(text);
    expect(codes).toEqual(['G47.0', 'H10.3', 'J01.90']);
  });

  test('deduplicates equivalent formats', () => {
    const text = 'ICD: K35.8, K358';
    const codes = extractIcdCodes(text);
    expect(codes).toEqual(['K35.8']);
  });

  test('handles empty and keeps canonical', () => {
    expect(extractIcdCodes('')).toEqual([]);
    expect(normalizeIcdCode('')).toBeUndefined();
    expect(normalizeIcdCode('G47.00')).toBe('G47.00');
  });
});

