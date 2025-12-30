import hospitalTemplateCache from '../../backend/postprocess/hospitalTemplateCache.js';

describe('HospitalTemplateCache normalization integration', () => {
  test('canonicalizes 신촌세브란스병원 to 세브란스병원', async () => {
    const text = '신촌세브란스병원 외래 방문';
    const result = await hospitalTemplateCache.processDocument(text);
    expect(result.success).toBe(true);
    expect(result.hospitalDetected).toBe(true);
    expect(result.hospitalInfo.id).toBe('세브란스병원');
    expect(result.hospitalInfo.name).toBe('세브란스병원');
  });

  test('canonicalizes SAMSUNG 강북삼성병원 to 강북삼성병원', async () => {
    const text = 'SAMSUNG 강북삼성병원 내원';
    const result = await hospitalTemplateCache.processDocument(text);
    expect(result.success).toBe(true);
    expect(result.hospitalDetected).toBe(true);
    expect(result.hospitalInfo.id).toBe('강북삼성병원');
    expect(result.hospitalInfo.name).toBe('강북삼성병원');
  });

  test('canonicalizes 서울대학교병원 to 서울대병원', async () => {
    const text = '서울대학교병원 입원';
    const result = await hospitalTemplateCache.processDocument(text);
    expect(result.success).toBe(true);
    expect(result.hospitalDetected).toBe(true);
    expect(result.hospitalInfo.id).toBe('서울대병원');
    expect(result.hospitalInfo.name).toBe('서울대병원');
  });

  test('canonicalizes 아산병원 to 서울아산병원', async () => {
    const text = '아산병원 응급 방문';
    const result = await hospitalTemplateCache.processDocument(text);
    expect(result.success).toBe(true);
    expect(result.hospitalDetected).toBe(true);
    expect(result.hospitalInfo.id).toBe('서울아산병원');
    expect(result.hospitalInfo.name).toBe('서울아산병원');
  });
});
