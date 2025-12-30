import { CoreEngineService } from '../../services/coreEngineService.js';

describe('CoreEngineService - Preprocessor Confidence Filtering', () => {
  let service;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.CORE_ENGINE_MIN_PREPROCESS_CONFIDENCE = '0.5';
    service = new CoreEngineService();
  });

  afterAll(() => {
    delete process.env.CORE_ENGINE_MIN_PREPROCESS_CONFIDENCE;
  });

  test('filters low-confidence preprocessor sections', async () => {
    const text = [
      '검사 결과 요약',
      '세부 내용 없음',
      '2024-01-10 서울아산병원 수술 및 처방 내역',
      '환자는 수술 후 처방을 받음'
    ].join('\n');

    const result = await service.analyze({
      text,
      options: { minPreprocessConfidence: 0.5 }
    });

    const records = Array.isArray(result.parsedRecords) ? result.parsedRecords : [];
    const hasLowConfidenceSection = records.some(
      (r) => typeof r?.rawText === 'string' && r.rawText.includes('검사 결과 요약')
    );
    expect(hasLowConfidenceSection).toBe(false);
  });
});
