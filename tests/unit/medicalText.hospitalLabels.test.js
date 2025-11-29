import { extractHospitalWithLabels } from '../../src/shared/utils/medicalText.js';

describe('medicalText.hospital labels (ICU/센터/클리닉)', () => {
  test('detects ICU label (MICU) and normalizes hospital', () => {
    const r = extractHospitalWithLabels('서울대병원 MICU 입원');
    expect(r.name).toBe('서울대병원');
    expect(r.labels).toContain('ICU');
  });

  test('detects 센터 label near hospital mention', () => {
    const r = extractHospitalWithLabels('고려대학교안암병원 암센터 외래');
    expect(r.name).toBe('고려대안암병원');
    expect(r.labels).toContain('센터');
  });

  test('detects 클리닉 label near hospital mention', () => {
    const r = extractHospitalWithLabels('세브란스병원 심장클리닉 방문');
    expect(r.name).toBe('세브란스병원');
    expect(r.labels).toContain('클리닉');
  });

  test('detects multiple labels (센터 + ICU)', () => {
    const r = extractHospitalWithLabels('분당서울대학교병원 심장센터 ICU 입원');
    expect(r.name).toBe('분당서울대병원');
    expect(r.labels).toEqual(expect.arrayContaining(['센터', 'ICU']));
  });

  test('labels can be detected even if hospital is stopword-only', () => {
    const r = extractHospitalWithLabels('응급센터 방문');
    expect(r.name).toBeUndefined();
    expect(r.labels).toContain('센터');
  });
});

