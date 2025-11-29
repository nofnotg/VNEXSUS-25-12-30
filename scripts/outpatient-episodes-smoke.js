// Lightweight smoke tests for CrossDateCorrelationAnalyzer.groupOutpatientEpisodes
// Runs a few scenarios and prints concise results for verification.

import CrossDateCorrelationAnalyzer from '../src/preprocessing-ai/crossDateCorrelationAnalyzer.js';

const analyzer = new CrossDateCorrelationAnalyzer();

function runScenario(name, records, options, expectFn) {
  try {
    const { episodes, stats } = analyzer.groupOutpatientEpisodes(records, options);
    const result = expectFn({ episodes, stats });
    const ok = result === true;
    console.log(JSON.stringify({
      scenario: name,
      ok,
      episodes,
      stats
    }));
    return ok;
  } catch (e) {
    console.log(JSON.stringify({ scenario: name, ok: false, error: e.message }));
    return false;
  }
}

let passCount = 0;
let total = 0;

// 1) merges similar respiratory visits within window
total++;
passCount += runScenario(
  'respiratory_merge_within_window',
  [
    { date: '2024-01-03', hospital: 'ABC Clinic', reason: 'Chief complaint: cough and wheezing', diagnosis: '천식 의심' },
    { date: '2024-01-10', hospital: 'ABC Clinic', reason: '재진. 약물 처방 조정', diagnosis: '천식 경과관찰' }
  ],
  { windowDays: 28, minCorrelationScore: 0.5 },
  ({ episodes }) => episodes.length === 1 && episodes[0].recordCount === 2 && episodes[0].diagnosticGroup === 'respiratory'
);

// 2) does not merge different diagnostic groups
total++;
passCount += runScenario(
  'no_merge_different_groups',
  [
    { date: '2024-02-02', hospital: 'XYZ Hospital', reason: '복통과 속쓰림', diagnosis: '위염' },
    { date: '2024-02-05', hospital: 'XYZ Hospital', reason: '가슴 통증과 숨가쁨', diagnosis: '천식 의심' }
  ],
  { windowDays: 28, minCorrelationScore: 0.6 },
  ({ episodes }) => episodes.length === 2
);

// 3) applies same hospital boost to help merge borderline cases
total++;
passCount += runScenario(
  'same_hospital_boost',
  [
    { date: '2024-03-01', hospital: 'SameCare', reason: '주호소: 혈압 상승', diagnosis: '고혈압' },
    { date: '2024-03-05', hospital: 'SameCare', reason: '경과관찰 및 처방 지속', diagnosis: '고혈압 경과' }
  ],
  { windowDays: 14, minCorrelationScore: 0.65, userWeightConfig: { sameHospitalBoost: 0.1 } },
  ({ episodes }) => episodes.length === 1 && episodes[0].recordCount === 2 && episodes[0].diagnosticGroup === 'cardiovascular'
);

// 4) boosts treatment continuity for follow-up prescriptions
total++;
passCount += runScenario(
  'treatment_continuity_boost',
  [
    { date: '2024-04-10', hospital: 'CareOne', reason: 'Chief complaint: chronic cough', diagnosis: '천식' },
    { date: '2024-04-17', hospital: 'CareOne', reason: '처방 조정 및 경과관찰', diagnosis: '천식 경과' }
  ],
  { windowDays: 28, minCorrelationScore: 0.6, userWeightConfig: { treatmentContinuityBoost: 0.2 } },
  ({ episodes }) => episodes.length === 1 && episodes[0].recordCount === 2
);

// 5) respects windowDays boundary and does not merge far apart visits
total++;
passCount += runScenario(
  'respect_window_boundary',
  [
    { date: '2024-05-01', hospital: 'General', reason: '고혈압 확인', diagnosis: '고혈압' },
    { date: '2024-06-20', hospital: 'General', reason: '재진. 혈압약 처방', diagnosis: '고혈압' }
  ],
  { windowDays: 28, minCorrelationScore: 0.5 },
  ({ episodes }) => episodes.length === 2
);

console.log(JSON.stringify({ summary: { passCount, total } }));
process.exit(passCount === total ? 0 : 1);

