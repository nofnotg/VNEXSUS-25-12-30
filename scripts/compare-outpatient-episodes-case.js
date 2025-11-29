// Compare Outpatient Episode Grouping Across Parameter Profiles (ESM)
// Reads case_sample text files, parses records, runs analyzer with multiple
// parameter sets, and writes a comparison summary to results/.

import fs from 'fs';
import path from 'path';
import CrossDateCorrelationAnalyzer from '../src/preprocessing-ai/crossDateCorrelationAnalyzer.js';
import { logger } from '../src/shared/logging/logger.js';
import { extractHospitalNormalized, extractDiagnosisNormalized, consolidateSameDayRecords } from '../src/shared/utils/medicalText.js';
import { generateCsvFromFile } from '../src/scripts/generateComparisonCsv.js';
import { generateHtmlFromFile } from '../src/scripts/generateComparisonHtml.js';
import { isClaimSectionHeader, isAnySectionHeader } from '../src/shared/utils/claimSectionTagger.js';
import { filterClaimsByWindow } from '../src/modules/claims/service/disclosureWindowService.js';
import { validateDiseaseRequiredTests } from '../src/modules/claims/service/diseaseTestValidationService.js';
import { DISCLOSURE_WINDOW_RULES, DISEASE_TEST_RULES } from '../src/shared/constants/claimsRules.js';

const CASE_DIR = path.join(process.cwd(), 'src', 'rag', 'case_sample');
const RESULT_DIR = path.join(process.cwd(), 'results');
const RESULT_FILE = path.join(RESULT_DIR, 'outpatient-episodes-case-comparison.json');
const REPORT_DIR = path.join(process.cwd(), 'reports');
const REPORT_CSV = path.join(REPORT_DIR, 'outpatient-episodes-case-comparison.csv');
const REPORT_HTML = path.join(REPORT_DIR, 'outpatient-episodes-case-comparison.html');

const datePatterns = [
  /\b(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/,
  /\b(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/,
  /\b(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/,
  /\b(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/,
  /\b(\d{1,2})월\s*(\d{1,2})일\s*[,\s]*(20\d{2})\b/,
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
  /\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/
];

function normalizeDateFromMatch(match, patternIndex) {
  let year, month, day;
  switch (patternIndex) {
    case 0: year = match[1]; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0'); break;
    case 1: year = `20${match[1]}`; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0'); break;
    case 2: year = match[1]; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0'); break;
    case 3: year = `20${match[1]}`; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0'); break;
    case 4: month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3]; break;
    case 5: month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3]; break;
    case 6: month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3]; break;
    default: return null;
  }
  const iso = `${year}-${month}-${day}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? iso : null;
}

function extractReason(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/주호소|주증상/.test(line)) {
      const next = lines[i + 1]?.trim();
      if (next) return next.replace(/^[\-#*\s]+/, '');
    }
  }
  return undefined;
}

function parseEventsFromText(text) {
  const lines = text.split('\n');
  const events = [];
  let current = null;
  let inClaimSection = false;

  const findDate = (line) => {
    for (let idx = 0; idx < datePatterns.length; idx++) {
      const pattern = datePatterns[idx];
      const match = line.match(pattern);
      if (match) {
        const iso = normalizeDateFromMatch(match, idx);
        if (iso) return { iso, original: match[0] };
      }
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    // Toggle claim section state at section headers
    if (isAnySectionHeader(line)) {
      inClaimSection = isClaimSectionHeader(line);
      continue; // headers themselves do not constitute events
    }
    const d = findDate(line);
    if (d) {
      if (current) events.push(current);
      current = { date: d.iso, originalDateString: d.original, rawText: line, isClaimFlag: inClaimSection };
      const hosp = extractHospitalNormalized(line);
      if (hosp) current.hospital = hosp;
    } else if (current) {
      current.rawText += '\n' + line;
      // If any line inside the event occurs under claim section, mark the event
      if (inClaimSection) current.isClaimFlag = true;
      if (!current.hospital) {
        const hosp = extractHospitalNormalized(line);
        if (hosp) current.hospital = hosp;
      }
    }
  }
  if (current) events.push(current);

  return events.map(ev => ({
    date: ev.date,
    hospital: ev.hospital,
    reason: extractReason(ev.rawText),
    diagnosis: extractDiagnosisNormalized(ev.rawText),
    content: ev.rawText,
    isClaim: Boolean(ev.isClaimFlag)
  }));
}

function buildAggregateSummary(summary) {
  const totals = summary.reduce((acc, s) => {
    acc.records += s.records;
    acc.episodes += s.episodes;
    return acc;
  }, { records: 0, episodes: 0 });
  const groupCounts = new Map();
  for (const s of summary) {
    for (const g of s.diagnosticGroups || []) {
      groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
    }
  }
  const topGroups = Array.from(groupCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([group, count]) => ({ group, count }));
  return { cases: summary.length, totals, topGroups };
}

async function run() {
  try {
    if (!fs.existsSync(CASE_DIR)) {
      logger.error({ event: 'case_sample_missing', path: CASE_DIR });
      process.exit(1);
    }
    if (!fs.existsSync(RESULT_DIR)) fs.mkdirSync(RESULT_DIR, { recursive: true });
    const files = fs.readdirSync(CASE_DIR).filter(f => f.endsWith('.txt')).sort();
    const analyzer = new CrossDateCorrelationAnalyzer();

    const profiles = [
      {
        name: 'baseline',
        options: { },
        consolidateSameDay: true
      },
      {
        name: 'merge_plus',
        options: { windowDays: 21, maxMergeGapDays: 10, minCorrelationScore: 0.6, userWeightConfig: { sameHospitalBoost: 0.2, treatmentContinuityBoost: 0.25 } },
        consolidateSameDay: true
      },
      {
        name: 'merge_aggressive',
        options: { windowDays: 28, maxMergeGapDays: 14, minCorrelationScore: 0.55, userWeightConfig: { sameHospitalBoost: 0.25, treatmentContinuityBoost: 0.3 } },
        consolidateSameDay: true
      }
    ];

    const results = [];

    for (const profile of profiles) {
      const summary = [];
      const perCase = {};

      for (const file of files) {
        const fullPath = path.join(CASE_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        let records = parseEventsFromText(content);
        if (profile.consolidateSameDay !== false) {
          records = consolidateSameDayRecords(records);
        }
        // Compute claim-window metrics based on configured rules
        const claimStats = filterClaimsByWindow(records, DISCLOSURE_WINDOW_RULES);
        const diseaseValidation = validateDiseaseRequiredTests(records, DISEASE_TEST_RULES);
        const diseaseTestsWithinTimeframe = diseaseValidation.perRule.reduce((acc, r) => acc + r.coverage.reduce((a, c) => a + (c.testsFoundWithinTimeframe || 0), 0), 0);
        const diseaseAnchors = diseaseValidation.summary.anchorsTotal;
        const { episodes, stats } = analyzer.groupOutpatientEpisodes(records, profile.options);
        perCase[file] = { episodes, stats };
        summary.push({
          file,
          records: records.length,
          episodes: episodes.length,
          diagnosticGroups: episodes.map(e => e.diagnosticGroup).filter(Boolean),
          hospitals: [...new Set(episodes.flatMap(e => e.hospitals))],
          claimWithinWindowRecords: claimStats.stats.within,
          claimTotalRecords: claimStats.stats.claimTotal,
          diseaseAnchors,
          diseaseTestsWithinTimeframe: diseaseTestsWithinTimeframe
        });
      }

      const aggregate = buildAggregateSummary(summary);
      logger.info({ event: 'compare_profile_done', name: profile.name, totals: aggregate.totals });
      results.push({ name: profile.name, options: profile.options, consolidateSameDay: profile.consolidateSameDay !== false, aggregate, summary });
    }

    const output = { generatedAt: new Date().toISOString(), results };
    fs.writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2), 'utf8');
    logger.info({ event: 'compare_profiles_complete', resultFile: RESULT_FILE, profileCount: results.length });

    // Auto-generate reports (CSV and HTML) after comparison completes
    await generateCsvFromFile(RESULT_FILE, REPORT_CSV, { includeHospitalsNormalized: true });
    await generateHtmlFromFile(RESULT_FILE, REPORT_HTML, { title: 'Outpatient Episodes Comparison', csvPath: 'reports/outpatient-episodes-case-comparison.csv' });
    logger.info({ event: 'reports_generated', csv: REPORT_CSV, html: REPORT_HTML });
  } catch (err) {
    logger.error({ event: 'compare_profiles_error', message: err?.message });
    process.exit(1);
  }
}

run();
