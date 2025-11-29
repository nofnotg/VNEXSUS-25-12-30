// Jest unit tests for medicalText normalization utilities (ESM)
import { normalizeHospitalName, extractHospitalNormalized, normalizeDiagnosisLine } from '../../src/shared/utils/medicalText.js';

describe('medicalText.normalizeHospital', () => {
  test('filters generic hospital stopwords', () => {
    const t1 = '본 자료는 병·의원';
    const t2 = '순번 진료시작일 병·의원';
    expect(extractHospitalNormalized(t1)).toBeUndefined();
    expect(extractHospitalNormalized(t2)).toBeUndefined();
  });

  test('canonicalizes noisy hospital variants', () => {
    const h1 = extractHospitalNormalized('SAMSUNG 강북삼성병원 내원');
    const h2 = extractHospitalNormalized('신촌세브란스병원 외래 방문');
    const h3 = extractHospitalNormalized('EUMC 이대목동병원 진료');
    expect(h1).toBe('강북삼성병원');
    expect(h2).toBe('세브란스병원');
    expect(h3).toBe('이대목동병원');
  });

  test('canonicalizes additional major hospital variants', () => {
    const s1 = extractHospitalNormalized('서울대학교병원 내원');
    const s2 = extractHospitalNormalized('분당서울대학교병원 방문');
    const a1 = extractHospitalNormalized('아산병원 응급');
    const y1 = extractHospitalNormalized('강남세브란스병원 외래');
    expect(s1).toBe('서울대병원');
    expect(s2).toBe('분당서울대병원');
    expect(a1).toBe('서울아산병원');
    expect(y1).toBe('세브란스병원');
  });

  test('normalizeHospitalName applies canonical map when direct name provided', () => {
    expect(normalizeHospitalName('한림강남성심병원')).toBe('강남성심병원');
    expect(normalizeHospitalName('가톨릭서울성모병원')).toBe('서울성모병원');
  });
});

describe('medicalText.normalizeDiagnosisLine', () => {
  test('maps common Korean diagnosis tokens to normalized English', () => {
    expect(normalizeDiagnosisLine('진단명: 당뇨')).toMatch(/diabetes/);
    expect(normalizeDiagnosisLine('Assessment: 역류성 식도염')).toMatch(/gerd/);
    expect(normalizeDiagnosisLine('상병명: 위염 (K29.7)')).toMatch(/ICD: K29\.7/);
  });

  test('maps expanded diagnosis synonyms', () => {
    expect(normalizeDiagnosisLine('상병명: 고지혈증')).toMatch(/dyslipidemia/);
    expect(normalizeDiagnosisLine('상병명: 이상지질혈증')).toMatch(/dyslipidemia/);
    expect(normalizeDiagnosisLine('상병명: HTN')).toMatch(/hypertension/);
    expect(normalizeDiagnosisLine('상병명: DM')).toMatch(/diabetes/);
    expect(normalizeDiagnosisLine('상병명: 만성폐쇄성폐질환')).toMatch(/copd/);
    expect(normalizeDiagnosisLine('상병명: GERD')).toMatch(/gerd/);
    expect(normalizeDiagnosisLine('상병명: 갑상선기능저하증')).toMatch(/hypothyroidism/);
    expect(normalizeDiagnosisLine('상병명: 만성콩팥병')).toMatch(/ckd/);
    expect(normalizeDiagnosisLine('상병명: 디스크')).toMatch(/ldh/);
  });
});
