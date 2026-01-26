const fs = require('fs');
const path = require('path');

// Load all cycle4 topdown cached data (excluding case18)
const cacheDir = path.join(__dirname, 'output/cycle4_topdown/ocr_cache');
const caseFiles = fs.readdirSync(cacheDir)
  .filter(f => f.endsWith('_topdown.json') && !f.includes('case_18'))
  .sort();

console.log(`\n${'='.repeat(80)}`);
console.log(`Cycle 4 Top-Down: Post-Processing Logic Insights Analysis`);
console.log(`${'='.repeat(80)}\n`);
console.log(`Analyzing ${caseFiles.length} cases (excluding case18)\n`);

// Load cycle4 results which contains matching data including GT dates
const resultsPath = path.join(__dirname, 'output/cycle4_topdown/cycle4_topdown_results.json');
const cycle4Results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Load all case data
const cases = caseFiles.map(file => {
  const data = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8'));
  return data;
});

// Aggregate statistics
const analysis = {
  metadata: {
    totalCases: cases.length,
    analysisDate: new Date().toISOString(),
    approach: 'top-down-over-extraction'
  },

  basicStats: {
    totalGtDates: 0,
    totalExtracted: 0, // Raw extractions (with duplicates)
    totalUnique: 0, // After deduplication
    totalMatched: 0,
    totalMissed: 0,
    totalExtra: 0
  },

  // Key insight categories
  insights: {
    duplicateAnalysis: {
      totalDuplicates: 0,
      duplicateRate: 0,
      caseBreakdown: []
    },

    typeDistribution: {
      extracted: {},
      noise: {},
      matched: {}
    },

    contextPatterns: {
      timestampPatterns: [], // HH:MM:SS timestamps
      documentDates: [], // 발급일, 출력일, 서류작성일
      futureOrInvalidDates: [], // 2030+, 2059, 2069 등
      comparisonDates: [], // "비교하여", "compared with" 등
    },

    noiseCharacteristics: {
      topNoiseTypes: [],
      commonNoisePatterns: []
    },

    missedDateAnalysis: {
      totalMissed: 0,
      missedByCase: []
    }
  },

  postProcessingRecommendations: []
};

// Analyze each case
cases.forEach((caseData) => {
  const { caseId, caseNum, generatedJson } = caseData;
  const { allExtractedDates, dateRanges, insuranceDates } = generatedJson;

  // Find GT data for this case from cycle4Results
  const resultEntry = cycle4Results.results.find(r => r.caseId === caseId);
  if (!resultEntry || !resultEntry.matching) {
    console.warn(`Warning: No matching data for ${caseId}`);
    return;
  }

  const gtDates = resultEntry.matching.gtDates || [];
  analysis.basicStats.totalGtDates += gtDates.length;

  // Extract unique dates
  const extractedDates = allExtractedDates.map(d => d.date);
  const uniqueDates = [...new Set(extractedDates)];

  analysis.basicStats.totalExtracted += extractedDates.length;
  analysis.basicStats.totalUnique += uniqueDates.length;

  // Match with GT
  const matched = uniqueDates.filter(d => gtDates.includes(d));
  const missed = gtDates.filter(d => !uniqueDates.includes(d));
  const extra = uniqueDates.filter(d => !gtDates.includes(d));

  analysis.basicStats.totalMatched += matched.length;
  analysis.basicStats.totalMissed += missed.length;
  analysis.basicStats.totalExtra += extra.length;

  // Duplicate analysis
  const duplicateCount = extractedDates.length - uniqueDates.length;
  analysis.insights.duplicateAnalysis.totalDuplicates += duplicateCount;
  analysis.insights.duplicateAnalysis.caseBreakdown.push({
    caseId,
    rawCount: extractedDates.length,
    uniqueCount: uniqueDates.length,
    duplicates: duplicateCount,
    duplicateRate: ((duplicateCount / extractedDates.length) * 100).toFixed(1) + '%'
  });

  // Type distribution analysis
  allExtractedDates.forEach(d => {
    const type = d.type || '미분류';

    // Overall type distribution
    analysis.insights.typeDistribution.extracted[type] =
      (analysis.insights.typeDistribution.extracted[type] || 0) + 1;

    // Matched types
    if (matched.includes(d.date)) {
      analysis.insights.typeDistribution.matched[type] =
        (analysis.insights.typeDistribution.matched[type] || 0) + 1;
    }

    // Noise types
    if (extra.includes(d.date)) {
      analysis.insights.typeDistribution.noise[type] =
        (analysis.insights.typeDistribution.noise[type] || 0) + 1;
    }
  });

  // Context pattern analysis
  allExtractedDates.forEach(d => {
    const context = d.context || '';
    const lowerContext = context.toLowerCase();

    // Timestamp pattern (HH:MM:SS)
    if (/\d{2}:\d{2}:\d{2}/.test(context)) {
      analysis.insights.contextPatterns.timestampPatterns.push({
        caseId,
        date: d.date,
        context: context.substring(0, 80),
        isNoise: extra.includes(d.date)
      });
    }

    // Document issuance dates
    if (/(발급|출력|서류|작성|발행)/.test(context) ||
        /(issue|print|document|created)/.test(lowerContext)) {
      analysis.insights.contextPatterns.documentDates.push({
        caseId,
        date: d.date,
        context: context.substring(0, 80),
        isNoise: extra.includes(d.date)
      });
    }

    // Future or invalid dates
    const year = parseInt(d.date.split('-')[0]);
    if (year > 2030 || year < 2000) {
      analysis.insights.contextPatterns.futureOrInvalidDates.push({
        caseId,
        date: d.date,
        year,
        context: context.substring(0, 80),
        isNoise: extra.includes(d.date)
      });
    }

    // Comparison dates ("비교하여", "compared with")
    if (/(비교|compared|previous)/.test(lowerContext)) {
      analysis.insights.contextPatterns.comparisonDates.push({
        caseId,
        date: d.date,
        context: context.substring(0, 80),
        isNoise: extra.includes(d.date)
      });
    }
  });

  // Missed date analysis
  if (missed.length > 0) {
    analysis.insights.missedDateAnalysis.missedByCase.push({
      caseId,
      missed,
      gtCount: gtDates.length,
      coverage: ((matched.length / gtDates.length) * 100).toFixed(1) + '%'
    });
  }
});

// Calculate overall metrics
const dupRate = (analysis.insights.duplicateAnalysis.totalDuplicates / analysis.basicStats.totalExtracted * 100).toFixed(1);
analysis.insights.duplicateAnalysis.duplicateRate = dupRate + '%';

const gtCoverage = (analysis.basicStats.totalMatched / analysis.basicStats.totalGtDates * 100).toFixed(1);
const precision = (analysis.basicStats.totalMatched / analysis.basicStats.totalUnique * 100).toFixed(1);
const recall = (analysis.basicStats.totalMatched / analysis.basicStats.totalGtDates * 100).toFixed(1);
const noiseRate = (analysis.basicStats.totalExtra / analysis.basicStats.totalUnique * 100).toFixed(1);

// Top noise types
const noiseTypes = Object.entries(analysis.insights.typeDistribution.noise)
  .map(([type, count]) => ({
    type,
    count,
    percentage: ((count / analysis.basicStats.totalExtra) * 100).toFixed(1) + '%'
  }))
  .sort((a, b) => b.count - a.count);

analysis.insights.noiseCharacteristics.topNoiseTypes = noiseTypes;

// ========== POST-PROCESSING RECOMMENDATIONS ==========

// 1. Duplicate Removal (CRITICAL - Already implemented)
analysis.postProcessingRecommendations.push({
  priority: 'IMPLEMENTED',
  category: '1. Duplicate Removal',
  status: '✓ Already working',
  finding: `${dupRate}% of raw extractions are duplicates (${analysis.basicStats.totalExtracted} → ${analysis.basicStats.totalUnique} unique)`,
  impact: `Eliminates ${analysis.insights.duplicateAnalysis.totalDuplicates} duplicate dates`,
  recommendation: 'Current deduplication logic is effective. No action needed.',
  implementation: 'Continue using Set-based deduplication or similar approach'
});

// 2. Type-Based Filtering/Scoring
const topNoiseType = noiseTypes[0];
if (topNoiseType && parseFloat(topNoiseType.percentage) > 15) {
  analysis.postProcessingRecommendations.push({
    priority: 'HIGH',
    category: '2. Type-Based Relevance Scoring',
    finding: `"${topNoiseType.type}" type accounts for ${topNoiseType.count} false positives (${topNoiseType.percentage} of noise)`,
    impact: `Could reduce noise by ${topNoiseType.percentage}`,
    recommendation: `Implement multi-tier type scoring system:
      TIER 1 (High Priority): 수술, 입원, 퇴원, 진단
      TIER 2 (Medium Priority): 검사, 처방
      TIER 3 (Low Priority): 진료일, 방문일
      TIER 4 (Filter/Deprioritize): 서류작성일, 발급일, 출력일, 기타`,
    implementation: `
      - Assign relevance scores: TIER1=100, TIER2=70, TIER3=40, TIER4=10
      - Filter out dates with score < threshold (e.g., 30)
      - Or rank dates by score for claims review`
  });
}

// 3. Context-Based Filtering
const timestampCount = analysis.insights.contextPatterns.timestampPatterns.length;
const timestampNoise = analysis.insights.contextPatterns.timestampPatterns.filter(t => t.isNoise).length;
const timestampNoiseRate = timestampCount > 0 ? ((timestampNoise / timestampCount) * 100).toFixed(1) : 0;

if (timestampCount > 20) {
  analysis.postProcessingRecommendations.push({
    priority: 'MEDIUM',
    category: '3. Timestamp Context Filtering',
    finding: `${timestampCount} dates have HH:MM:SS timestamps, ${timestampNoise} (${timestampNoiseRate}%) are noise`,
    impact: `Could reduce noise by filtering timestamp-only dates`,
    recommendation: `Filter dates that appear only as timestamps (HH:MM:SS) without meaningful medical context`,
    implementation: `
      - Detect pattern: /\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}/
      - Check if context has medical keywords (수술, 입원, 퇴원, 진단, 검사)
      - If no medical keywords, mark as low-relevance timestamp`,
    examples: analysis.insights.contextPatterns.timestampPatterns.slice(0, 5)
  });
}

// 4. Document Date Filtering
const docDateCount = analysis.insights.contextPatterns.documentDates.length;
const docDateNoise = analysis.insights.contextPatterns.documentDates.filter(d => d.isNoise).length;
const docDateNoiseRate = docDateCount > 0 ? ((docDateNoise / docDateCount) * 100).toFixed(1) : 0;

if (docDateCount > 10) {
  analysis.postProcessingRecommendations.push({
    priority: 'HIGH',
    category: '4. Document Metadata Filtering',
    finding: `${docDateCount} dates identified as document metadata, ${docDateNoise} (${docDateNoiseRate}%) are noise`,
    impact: `Could reduce noise by ${docDateNoiseRate}%`,
    recommendation: `Filter or deprioritize dates with document issuance context`,
    implementation: `
      - Detect keywords: 발급, 출력, 서류, 작성, 발행, issue, print, document
      - Assign low relevance score (10-20)
      - These are rarely relevant for claims analysis`,
    examples: analysis.insights.contextPatterns.documentDates.slice(0, 5)
  });
}

// 5. Date Range Validation
const invalidDateCount = analysis.insights.contextPatterns.futureOrInvalidDates.length;
if (invalidDateCount > 0) {
  analysis.postProcessingRecommendations.push({
    priority: 'CRITICAL',
    category: '5. Date Range Validation',
    finding: `${invalidDateCount} dates outside reasonable medical record range (before 2000 or after 2030)`,
    impact: `Eliminates ${invalidDateCount} obvious invalid dates`,
    recommendation: `Hard filter dates outside reasonable range`,
    implementation: `
      - MIN_YEAR: 2000 (or patient birth year - 10)
      - MAX_YEAR: 2030 (current year + 5)
      - Remove dates outside this range`,
    examples: analysis.insights.contextPatterns.futureOrInvalidDates
  });
}

// 6. Comparison Context Filtering
const comparisonCount = analysis.insights.contextPatterns.comparisonDates.length;
const comparisonNoise = analysis.insights.contextPatterns.comparisonDates.filter(c => c.isNoise).length;
const comparisonNoiseRate = comparisonCount > 0 ? ((comparisonNoise / comparisonCount) * 100).toFixed(1) : 0;

if (comparisonCount > 10) {
  analysis.postProcessingRecommendations.push({
    priority: 'MEDIUM',
    category: '6. Historical Reference Date Filtering',
    finding: `${comparisonCount} dates appear in comparison/reference contexts, ${comparisonNoise} (${comparisonNoiseRate}%) are noise`,
    impact: `Could improve precision by handling reference dates`,
    recommendation: `Mark dates in comparison contexts (e.g., "compared with 2020-06-20") as historical references`,
    implementation: `
      - Detect patterns: "비교", "compared", "previous", "과 비교하여"
      - These dates may be relevant but lower priority than current diagnosis dates
      - Assign medium-low relevance score (30-50)`,
    examples: analysis.insights.contextPatterns.comparisonDates.slice(0, 5)
  });
}

// 7. Multi-Factor Relevance Scoring System (COMPREHENSIVE)
analysis.postProcessingRecommendations.push({
  priority: 'HIGH',
  category: '7. Comprehensive Relevance Scoring System',
  finding: `Current system: ${gtCoverage}% coverage, ${precision}% precision, ${noiseRate}% noise rate`,
  impact: `Could improve precision from ${precision}% to 70-80%+ while maintaining ${gtCoverage}% coverage`,
  recommendation: `Implement multi-factor scoring algorithm combining all above insights`,
  implementation: `
    SCORING FORMULA:
    score = typeScore + contextScore + recencyScore + frequencyScore

    1. TYPE SCORE (0-100):
       - 수술: 100
       - 입원/퇴원: 90
       - 진단: 80
       - 검사: 60
       - 진료: 40
       - 보험계약일: 30
       - 서류/발급: 10
       - 기타: 20

    2. CONTEXT SCORE (-50 to +50):
       - Medical keywords (수술, 입원, 진단, 치료): +30
       - Document keywords (발급, 출력, 작성): -30
       - Timestamp only (HH:MM:SS without context): -20
       - Comparison context (비교, compared): -10
       - Insurance context: +20

    3. RECENCY SCORE (0-20):
       - Recent dates (within 2 years): +20
       - 2-5 years: +10
       - 5-10 years: +5
       - 10+ years: 0

    4. FREQUENCY SCORE (0-30):
       - Appears 3+ times: +30
       - Appears 2 times: +15
       - Appears once: 0

    FILTERING THRESHOLDS:
       - score >= 70: HIGH relevance (show first)
       - score >= 40: MEDIUM relevance (show second)
       - score >= 20: LOW relevance (show last)
       - score < 20: FILTER OUT (noise)
  `
});

// 8. Coverage Improvement (Secondary Priority)
analysis.postProcessingRecommendations.push({
  priority: 'LOW',
  category: '8. Coverage Improvement (Prompt Engineering)',
  finding: `Still missing ${analysis.basicStats.totalMissed} GT dates (${(100 - parseFloat(recall)).toFixed(1)}% miss rate)`,
  impact: `Could improve coverage from ${gtCoverage}% toward 80-90%`,
  recommendation: `Only pursue after post-processing optimization is complete`,
  implementation: `
    CURRENT PRIORITY: Focus on post-processing to reduce noise
    FUTURE WORK:
      - Analyze missed dates patterns
      - Enhance VisionLLM prompt if needed
      - Consider multi-pass extraction for critical date types`,
  missedCases: analysis.insights.missedDateAnalysis.missedByCase
});

// Save results
const outputDir = path.join(__dirname, 'output/cycle4_postprocessing_insights');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const results = {
  ...analysis,
  summary: {
    cases: analysis.metadata.totalCases,
    gtCoverage: gtCoverage + '%',
    precision: precision + '%',
    recall: recall + '%',
    noiseRate: noiseRate + '%',
    duplicateRate: dupRate + '%',
    rawExtractions: analysis.basicStats.totalExtracted,
    uniqueDates: analysis.basicStats.totalUnique,
    matched: analysis.basicStats.totalMatched,
    missed: analysis.basicStats.totalMissed,
    extra: analysis.basicStats.totalExtra
  }
};

fs.writeFileSync(
  path.join(outputDir, 'insights.json'),
  JSON.stringify(results, null, 2)
);

// Console output
console.log(`\n${'='.repeat(80)}`);
console.log('SUMMARY');
console.log(`${'='.repeat(80)}\n`);
console.log(`Cases Analyzed: ${results.summary.cases}`);
console.log(`GT Coverage: ${results.summary.gtCoverage}`);
console.log(`Precision: ${results.summary.precision}`);
console.log(`Recall: ${results.summary.recall}`);
console.log(`Noise Rate: ${results.summary.noiseRate}`);
console.log(`Duplicate Rate: ${results.summary.duplicateRate}`);
console.log(`\nRaw Extractions: ${results.summary.rawExtractions}`);
console.log(`Unique Dates: ${results.summary.uniqueDates}`);
console.log(`Matched: ${results.summary.matched}/${analysis.basicStats.totalGtDates}`);
console.log(`Missed: ${results.summary.missed}`);
console.log(`Extra (Noise): ${results.summary.extra}`);

console.log(`\n${'='.repeat(80)}`);
console.log('POST-PROCESSING RECOMMENDATIONS (Priority Order)');
console.log(`${'='.repeat(80)}\n`);

results.postProcessingRecommendations.forEach((rec, idx) => {
  console.log(`${idx + 1}. [${rec.priority}] ${rec.category}`);
  console.log(`   Finding: ${rec.finding}`);
  if (rec.impact) console.log(`   Impact: ${rec.impact}`);
  if (rec.status) console.log(`   Status: ${rec.status}`);
  console.log('');
});

console.log(`\n✓ Results saved to: ${outputDir}/insights.json`);
console.log(`✓ Ready for HTML report generation\n`);
