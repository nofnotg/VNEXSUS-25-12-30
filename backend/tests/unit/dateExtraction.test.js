import { CoreEngineService } from '../../services/coreEngineService.js';

describe('runRegexExtraction - 날짜 추출 정확도', () => {
  let service;

  beforeAll(() => {
    service = new CoreEngineService();
  });

  test('ISO 및 한국어 날짜 형식을 모두 추출', () => {
    const text = [
      '2024-01-15 외래 방문',
      '2024.02.03 검사 시행',
      '2024년 3월 7일 진단서 발급'
    ].join('\n');

    const records = service.runRegexExtraction(text);
    const dates = records.map(r => r.date);

    expect(dates).toContain('2024-01-15');
    expect(dates).toContain('2024-02-03');
    expect(dates).toContain('2024-03-07');
  });
});
