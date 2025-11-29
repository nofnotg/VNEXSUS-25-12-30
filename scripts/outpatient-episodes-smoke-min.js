// Minimal smoke focusing on scenarios 2 & 3 to inspect failures.
import CrossDateCorrelationAnalyzer from '../src/preprocessing-ai/crossDateCorrelationAnalyzer.js';

const analyzer = new CrossDateCorrelationAnalyzer();

function run(name, records, options, expectFn) {
  try {
    const { episodes, stats } = analyzer.groupOutpatientEpisodes(records, options);
    const ok = expectFn({ episodes, stats });
    console.log(JSON.stringify({ scenario: name, ok, episodes, stats }));
  } catch (e) {
    console.log(JSON.stringify({ scenario: name, ok: false, error: e.message }));
  }
}

run(
  'no_merge_different_groups',
  [
    { date: '2024-02-02', hospital: 'XYZ Hospital', reason: '복통과 속쓰림', diagnosis: '위염' },
    { date: '2024-02-05', hospital: 'XYZ Hospital', reason: '가슴 통증과 숨가쁨', diagnosis: '천식 의심' }
  ],
  { windowDays: 28, minCorrelationScore: 0.6 },
  ({ episodes }) => episodes.length === 2
);

run(
  'same_hospital_boost',
  [
    { date: '2024-03-01', hospital: 'SameCare', reason: '주호소: 혈압 상승', diagnosis: '고혈압' },
    { date: '2024-03-05', hospital: 'SameCare', reason: '경과관찰 및 처방 지속', diagnosis: '고혈압 경과' }
  ],
  { windowDays: 14, minCorrelationScore: 0.65, userWeightConfig: { sameHospitalBoost: 0.1 } },
  ({ episodes }) => episodes.length === 1 && episodes[0].recordCount === 2 && episodes[0].diagnosticGroup === 'cardiovascular'
);

