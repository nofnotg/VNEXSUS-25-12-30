// Jest unit tests for outpatient episode grouping
import CrossDateCorrelationAnalyzer from '../../src/preprocessing-ai/crossDateCorrelationAnalyzer.js';

describe('CrossDateCorrelationAnalyzer.groupOutpatientEpisodes', () => {
  test('merges similar respiratory visits within window', () => {
    const analyzer = new CrossDateCorrelationAnalyzer();
    const records = [
      { date: '2024-01-03', hospital: 'ABC Clinic', reason: 'Chief complaint: cough and wheezing', diagnosis: '천식 의심' },
      { date: '2024-01-10', hospital: 'ABC Clinic', reason: '재진. 약물 처방 조정', diagnosis: '천식 경과관찰' }
    ];
    const { episodes, stats } = analyzer.groupOutpatientEpisodes(records, { windowDays: 28, minCorrelationScore: 0.5 });
    expect(episodes.length).toBe(1);
    expect(episodes[0].recordCount).toBe(2);
    expect(episodes[0].diagnosticGroup).toBe('respiratory');
    expect(stats.totalRecords).toBe(2);
  });

  test('does not merge different diagnostic groups', () => {
    const analyzer = new CrossDateCorrelationAnalyzer();
    const records = [
      { date: '2024-02-02', hospital: 'XYZ Hospital', reason: '복통과 속쓰림', diagnosis: '위염' },
      { date: '2024-02-05', hospital: 'XYZ Hospital', reason: '가슴 통증과 숨가쁨', diagnosis: '천식 의심' }
    ];
    const { episodes } = analyzer.groupOutpatientEpisodes(records, { windowDays: 28, minCorrelationScore: 0.6 });
    expect(episodes.length).toBe(2);
  });

  test('applies same hospital boost to help merge borderline cases', () => {
    const analyzer = new CrossDateCorrelationAnalyzer();
    const records = [
      { date: '2024-03-01', hospital: 'SameCare', reason: '주호소: 혈압 상승', diagnosis: '고혈압' },
      { date: '2024-03-05', hospital: 'SameCare', reason: '경과관찰 및 처방 지속', diagnosis: '고혈압 경과' }
    ];
    const { episodes } = analyzer.groupOutpatientEpisodes(records, {
      windowDays: 14,
      minCorrelationScore: 0.65,
      userWeightConfig: { sameHospitalBoost: 0.1 }
    });
    expect(episodes.length).toBe(1);
    expect(episodes[0].recordCount).toBe(2);
    expect(episodes[0].diagnosticGroup).toBe('cardiovascular');
  });

  test('boosts treatment continuity for follow-up prescriptions', () => {
    const analyzer = new CrossDateCorrelationAnalyzer();
    const records = [
      { date: '2024-04-10', hospital: 'CareOne', reason: 'Chief complaint: chronic cough', diagnosis: '천식' },
      { date: '2024-04-17', hospital: 'CareOne', reason: '처방 조정 및 경과관찰', diagnosis: '천식 경과' }
    ];
    const { episodes } = analyzer.groupOutpatientEpisodes(records, {
      windowDays: 28,
      minCorrelationScore: 0.6,
      userWeightConfig: { treatmentContinuityBoost: 0.2 }
    });
    expect(episodes.length).toBe(1);
    expect(episodes[0].recordCount).toBe(2);
  });

  test('respects windowDays boundary and does not merge far apart visits', () => {
    const analyzer = new CrossDateCorrelationAnalyzer();
    const records = [
      { date: '2024-05-01', hospital: 'General', reason: '고혈압 확인', diagnosis: '고혈압' },
      { date: '2024-06-20', hospital: 'General', reason: '재진. 혈압약 처방', diagnosis: '고혈압' }
    ];
    const { episodes } = analyzer.groupOutpatientEpisodes(records, { windowDays: 28, minCorrelationScore: 0.5 });
    expect(episodes.length).toBe(2);
  });
});

