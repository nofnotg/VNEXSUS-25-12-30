import { describe, test, expect } from '@jest/globals';
import medicalEventModelMod from '../../backend/postprocess/medicalEventModel.js';

const medicalEventModel = medicalEventModelMod.default || medicalEventModelMod;

describe('MedicalEventModel unifyDuplicateEvents', () => {
  test('merges duplicate events by date+hospital and preserves codes/procedures', () => {
    const e1 = {
      id: 'evt_20250101_0001',
      date: '2025-01-01',
      hospital: '서울병원',
      diagnosis: { name: '복부통증', code: 'R10' },
      procedures: [{ name: 'CT' }],
      treatments: [{ name: '진통제' }],
      confidence: 0.6,
    };
    const e2 = {
      id: 'evt_20250101_0002',
      date: '2025-01-01',
      hospital: '서울병원',
      diagnosis: { name: '복부통증 상세', code: 'R10.2' },
      procedures: [{ name: 'MRI' }, { name: 'CT' }],
      treatments: [{ name: '수액' }],
      confidence: 0.9,
    };
    const merged = medicalEventModel.unifyDuplicateEvents([e1, e2]);
    expect(Array.isArray(merged)).toBe(true);
    expect(merged.length).toBe(1);
    const ev = merged[0];
    expect(ev.date).toBe('2025-01-01');
    expect(ev.hospital).toBe('서울병원');
    expect(ev.diagnosis.code).toBe('R10.2');
    expect(ev.diagnosis.name.includes('복부통증')).toBe(true);
    const procNames = (ev.procedures || []).map(p => p.name).sort();
    expect(procNames).toEqual(['CT', 'MRI']);
    const treatNames = (ev.treatments || []).map(t => t.name).sort();
    expect(treatNames).toEqual(['수액', '진통제']);
    expect(ev.relatedCodes).toContain('R10');
    expect(ev.relatedCodes).toContain('R10.2');
    expect(ev.confidence).toBeCloseTo(0.9, 5);
  });
});

