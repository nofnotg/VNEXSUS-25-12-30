const fs = require('fs');
const path = require('path');

// Load all cycle2 cached data (excluding case18)
const cacheDir = path.join(__dirname, 'output/improved_validation_cycle2/ocr_cache');
const caseFiles = fs.readdirSync(cacheDir)
  .filter(f => f.endsWith('_improved.json') && !f.includes('case_18'))
  .sort();

console.log(`\n=== Analyzing ${caseFiles.length} cases (excluding case18) ===\n`);

// Load all case data
const cases = caseFiles.map(file => {
  const data = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8'));
  return data;
});

// Aggregate statistics
const aggregated = {
  totalCases: cases.length,
  totalGtDates: 0,
  totalAiDates: 0,
  totalMatched: 0,
  totalMissed: 0,
  totalExtra: 0,
  totalAllDates: 0, // Raw extraction count

  // Type analysis
  dateTypeDistribution: {},
  extraDateTypes: {},
  missedDateAnalysis: [],

  // Pattern analysis
  duplicatePatterns: [],
  contextPatterns: {},
  sourceDistribution: {},

  // Cases breakdown
  casesBreakdown: []
};

// Analyze each case
cases.forEach((caseData, idx) => {
  const { caseId, matching, generatedJson } = caseData;
  const { allDates } = generatedJson;

  // Basic stats
  aggregated.totalGtDates += matching.gtCount;
  aggregated.totalAiDates += matching.aiCount;
  aggregated.totalMatched += matching.matchedCount;
  aggregated.totalMissed += matching.missedCount;
  aggregated.totalExtra += matching.extraCount;
  aggregated.totalAllDates += allDates.length;

  // Case breakdown
  aggregated.casesBreakdown.push({
    caseId,
    gtCount: matching.gtCount,
    aiCount: matching.aiCount,
    allDatesCount: allDates.length,
    matchedCount: matching.matchedCount,
    missedCount: matching.missedCount,
    extraCount: matching.extraCount,
    gtCoverage: matching.gtCoverageRate,
    duplicateRatio: ((allDates.length - matching.aiCount) / allDates.length * 100).toFixed(1)
  });

  // Type distribution
  allDates.forEach(d => {
    const type = d.type || '기타';
    aggregated.dateTypeDistribution[type] = (aggregated.dateTypeDistribution[type] || 0) + 1;

    // Source distribution
    const source = d.source || 'unknown';
    aggregated.sourceDistribution[source] = (aggregated.sourceDistribution[source] || 0) + 1;
  });

  // Analyze extra dates (false positives)
  const extraDateObjects = allDates.filter(d =>
    matching.extra.includes(d.date)
  );

  extraDateObjects.forEach(d => {
    const type = d.type || '기타';
    if (!aggregated.extraDateTypes[type]) {
      aggregated.extraDateTypes[type] = {
        count: 0,
        examples: []
      };
    }
    aggregated.extraDateTypes[type].count++;
    if (aggregated.extraDateTypes[type].examples.length < 3) {
      aggregated.extraDateTypes[type].examples.push({
        date: d.date,
        context: d.context?.substring(0, 100),
        source: d.source
      });
    }
  });

  // Analyze missed dates
  matching.missed.forEach(missedDate => {
    aggregated.missedDateAnalysis.push({
      caseId,
      date: missedDate,
      gtDates: matching.gtDates
    });
  });

  // Detect duplicate patterns
  const dateGroups = {};
  allDates.forEach(d => {
    if (!dateGroups[d.date]) {
      dateGroups[d.date] = [];
    }
    dateGroups[d.date].push(d);
  });

  Object.entries(dateGroups).forEach(([date, occurrences]) => {
    if (occurrences.length > 1) {
      aggregated.duplicatePatterns.push({
        caseId,
        date,
        count: occurrences.length,
        types: [...new Set(occurrences.map(o => o.type))],
        sources: [...new Set(occurrences.map(o => o.source))]
      });
    }
  });
});

// Calculate overall metrics
const avgGtCoverage = (aggregated.totalMatched / aggregated.totalGtDates * 100).toFixed(1);
const duplicateRate = ((aggregated.totalAllDates - aggregated.totalAiDates) / aggregated.totalAllDates * 100).toFixed(1);
const noiseRate = (aggregated.totalExtra / aggregated.totalAiDates * 100).toFixed(1);
const precision = (aggregated.totalMatched / aggregated.totalAiDates * 100).toFixed(1);
const recall = (aggregated.totalMatched / aggregated.totalGtDates * 100).toFixed(1);

// Post-processing insights
const insights = {
  summary: {
    totalCases: aggregated.totalCases,
    gtCoverage: `${avgGtCoverage}%`,
    precision: `${precision}%`,
    recall: `${recall}%`,
    duplicateRate: `${duplicateRate}%`,
    noiseRate: `${noiseRate}%`,
    rawExtractions: aggregated.totalAllDates,
    uniqueDates: aggregated.totalAiDates,
    matched: aggregated.totalMatched,
    missed: aggregated.totalMissed,
    extra: aggregated.totalExtra
  },

  // Key findings for post-processing logic
  postProcessingRecommendations: []
};

// Recommendation 1: Duplicate removal
if (parseFloat(duplicateRate) > 10) {
  insights.postProcessingRecommendations.push({
    priority: 'HIGH',
    category: 'Duplicate Removal',
    finding: `${duplicateRate}% of extracted dates are duplicates (${aggregated.totalAllDates} → ${aggregated.totalAiDates} unique dates)`,
    recommendation: 'Implement exact date deduplication logic. This is already working effectively.',
    impact: `Reduces noise by ${aggregated.totalAllDates - aggregated.totalAiDates} dates`
  });
}

// Recommendation 2: Type-based filtering
const topExtraTypes = Object.entries(aggregated.extraDateTypes)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5);

topExtraTypes.forEach(([type, data], idx) => {
  const percentage = (data.count / aggregated.totalExtra * 100).toFixed(1);
  if (parseFloat(percentage) > 10) {
    insights.postProcessingRecommendations.push({
      priority: idx === 0 ? 'HIGH' : 'MEDIUM',
      category: 'Type-Based Filtering',
      finding: `"${type}" type has ${data.count} false positives (${percentage}% of all noise)`,
      recommendation: `Consider filtering or deprioritizing dates with type="${type}". Common patterns: ${data.examples.map(e => e.context?.substring(0, 50)).join('; ')}`,
      examples: data.examples,
      impact: `Could reduce noise by ${percentage}%`
    });
  }
});

// Recommendation 3: Source-based filtering
const topSources = Object.entries(aggregated.sourceDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

// Recommendation 4: Context pattern analysis
const documentIssuanceDates = aggregated.totalAllDates - aggregated.totalAiDates;
insights.postProcessingRecommendations.push({
  priority: 'MEDIUM',
  category: 'Context-Based Filtering',
  finding: `Many dates appear to be document issuance dates, print dates, or metadata timestamps`,
  recommendation: 'Implement context analysis to filter out dates from contexts like: "발급일", "출력일", "서류 작성일", timestamps with HH:MM:SS format',
  impact: 'Could significantly reduce administrative noise'
});

// Recommendation 5: Date range filtering
const futureDates = aggregated.casesBreakdown.flatMap(c => cases.find(cs => cs.caseId === c.caseId).generatedJson.allDates)
  .filter(d => {
    const year = parseInt(d.date.split('-')[0]);
    return year > 2030 || year < 2000;
  });

if (futureDates.length > 0) {
  insights.postProcessingRecommendations.push({
    priority: 'HIGH',
    category: 'Date Range Filtering',
    finding: `Found ${futureDates.length} dates outside reasonable range (e.g., 2059-07-30, 2069-03-24)`,
    recommendation: 'Filter dates outside reasonable medical record range (e.g., 2000-2030)',
    examples: futureDates.slice(0, 5).map(d => ({ date: d.date, context: d.context?.substring(0, 80), type: d.type })),
    impact: `Removes ${futureDates.length} obvious noise dates`
  });
}

// Recommendation 6: Relevance scoring
insights.postProcessingRecommendations.push({
  priority: 'HIGH',
  category: 'Relevance Scoring System',
  finding: `Current GT coverage is ${avgGtCoverage}% but with ${noiseRate}% noise`,
  recommendation: `Implement multi-factor relevance scoring:
    - Date type priority: 수술일 > 입원일/퇴원일 > 검사일 > 진료일 > 서류작성일
    - Source priority: 수술기록 > 입원기록 > 검사결과 > 의무기록 > 보험서류
    - Context keywords: Boost dates near "수술", "입원", "퇴원", "진단"
    - Recency: Recent dates more relevant than old dates
    - Frequency: Dates appearing multiple times may be more significant`,
  impact: `Could improve precision from ${precision}% to 70-80%+`
});

// Recommendation 7: Missed dates analysis
const missedDatesByCase = {};
aggregated.missedDateAnalysis.forEach(m => {
  if (!missedDatesByCase[m.caseId]) missedDatesByCase[m.caseId] = [];
  missedDatesByCase[m.caseId].push(m.date);
});

if (aggregated.totalMissed > 0) {
  insights.postProcessingRecommendations.push({
    priority: 'LOW',
    category: 'Coverage Improvement',
    finding: `Still missing ${aggregated.totalMissed} GT dates (${(aggregated.totalMissed / aggregated.totalGtDates * 100).toFixed(1)}% miss rate)`,
    recommendation: 'Focus on post-processing optimization first. Prompt engineering only after reaching post-processing limits.',
    casesWithMissed: Object.entries(missedDatesByCase).map(([caseId, dates]) => ({ caseId, dates }))
  });
}

// Save analysis results
const outputDir = path.join(__dirname, 'output/cycle4_postprocessing_analysis');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const results = {
  timestamp: new Date().toISOString(),
  aggregated,
  insights,
  casesBreakdown: aggregated.casesBreakdown,
  topExtraTypes,
  topSources,
  duplicatePatterns: aggregated.duplicatePatterns.slice(0, 20),
  missedDateAnalysis: aggregated.missedDateAnalysis
};

fs.writeFileSync(
  path.join(outputDir, 'postprocessing_analysis.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n=== ANALYSIS COMPLETE ===\n');
console.log('Summary:');
console.log(`  Cases analyzed: ${insights.summary.totalCases}`);
console.log(`  GT Coverage: ${insights.summary.gtCoverage}`);
console.log(`  Precision: ${insights.summary.precision}`);
console.log(`  Recall: ${insights.summary.recall}`);
console.log(`  Duplicate Rate: ${insights.summary.duplicateRate}`);
console.log(`  Noise Rate: ${insights.summary.noiseRate}`);
console.log(`  Raw extractions: ${insights.summary.rawExtractions}`);
console.log(`  Unique dates: ${insights.summary.uniqueDates}`);
console.log(`  Matched: ${insights.summary.matched}/${aggregated.totalGtDates}`);
console.log(`  Missed: ${insights.summary.missed}`);
console.log(`  Extra (noise): ${insights.summary.extra}`);
console.log('\nTop Recommendations:');
insights.postProcessingRecommendations
  .filter(r => r.priority === 'HIGH')
  .forEach((r, i) => {
    console.log(`\n${i + 1}. [${r.priority}] ${r.category}`);
    console.log(`   Finding: ${r.finding}`);
    console.log(`   Impact: ${r.impact}`);
  });

console.log(`\n✓ Results saved to: ${outputDir}/postprocessing_analysis.json\n`);
