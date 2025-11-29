// Case Sample Outpatient Episode Analysis Runner (ESM)
// Parses text files under src/rag/case_sample, extracts dated outpatient records,
// and groups them into episodes using CrossDateCorrelationAnalyzer.

import fs from 'fs';
import path from 'path';
import CrossDateCorrelationAnalyzer from '../src/preprocessing-ai/crossDateCorrelationAnalyzer.js';
import { logger } from '../src/shared/logging/logger.js';
import { extractHospitalNormalized, extractDiagnosisNormalized, consolidateSameDayRecords } from '../src/shared/utils/medicalText.js';

const CASE_DIR = path.join(process.cwd(), 'src', 'rag', 'case_sample');
const RESULT_DIR = path.join(process.cwd(), 'results');
const RESULT_FILE = path.join(RESULT_DIR, 'outpatient-episodes-case-sample.json');

// Lightweight patterns adapted from src/lib/ocrParser.ts
const datePatterns = [
  /\b(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/, // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  /\b(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/,   // YY-MM-DD, YY.MM.DD, YY/MM/DD
  /\b(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/, // YYYY년 MM월 DD일
  /\b(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\b/,   // YY년 MM월 DD일
  /\b(\d{1,2})월\s*(\d{1,2})일\s*[,\s]*(20\d{2})\b/, // MM월 DD일, YYYY
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,          // MM/DD/YYYY
  /\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/             // MM-DD-YYYY
];

// Hospital extraction normalized via shared utils

function normalizeDateFromMatch(match, patternIndex) {
  let year, month, day;
  switch (patternIndex) {
    case 0: // YYYY-MM-DD
      year = match[1]; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0');
      break;
    case 1: // YY-MM-DD → assume 2000+
      year = `20${match[1]}`; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0');
      break;
    case 2: // YYYY년 MM월 DD일
      year = match[1]; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0');
      break;
    case 3: // YY년 MM월 DD일
      year = `20${match[1]}`; month = match[2].padStart(2, '0'); day = match[3].padStart(2, '0');
      break;
    case 4: // MM월 DD일, YYYY
      month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3];
      break;
    case 5: // MM/DD/YYYY
      month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3];
      break;
    case 6: // MM-DD-YYYY
      month = match[1].padStart(2, '0'); day = match[2].padStart(2, '0'); year = match[3];
      break;
    default:
      return null;
  }
  const iso = `${year}-${month}-${day}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? iso : null;
}

function extractReason(text) {
  // Heuristic: pick lines after "주호소" or "주증상"
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

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const d = findDate(line);
    if (d) {
      if (current) events.push(current);
      current = { date: d.iso, originalDateString: d.original, rawText: line };
      const hosp = extractHospitalNormalized(line);
      if (hosp) current.hospital = hosp;
    } else if (current) {
      current.rawText += '\n' + line;
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
    content: ev.rawText
  }));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim() !== '') val = num;
    opts[key] = val;
  }
  const analyzerOptions = {};
  if (typeof opts.windowDays === 'number') analyzerOptions.windowDays = opts.windowDays;
  if (typeof opts.maxMergeGapDays === 'number') analyzerOptions.maxMergeGapDays = opts.maxMergeGapDays;
  if (typeof opts.minCorrelationScore === 'number') analyzerOptions.minCorrelationScore = opts.minCorrelationScore;
  const uw = {};
  if (typeof opts.primarySymptomBoost === 'number') uw.primarySymptomBoost = opts.primarySymptomBoost;
  if (typeof opts.secondarySymptomBoost === 'number') uw.secondarySymptomBoost = opts.secondarySymptomBoost;
  if (typeof opts.treatmentContinuityBoost === 'number') uw.treatmentContinuityBoost = opts.treatmentContinuityBoost;
  if (typeof opts.sameHospitalBoost === 'number') uw.sameHospitalBoost = opts.sameHospitalBoost;
  if (Object.keys(uw).length) analyzerOptions.userWeightConfig = uw;
  return analyzerOptions;
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
    const summary = [];
    const perCase = {};
    const analyzerOptions = parseArgs();
    const consolidate = analyzerOptions.consolidateSameDay !== false; // default true

    for (const file of files) {
      const fullPath = path.join(CASE_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      let records = parseEventsFromText(content);
      if (consolidate) {
        records = consolidateSameDayRecords(records);
      }

      const { episodes, stats } = analyzer.groupOutpatientEpisodes(records, analyzerOptions);

      perCase[file] = { episodes, stats };
      summary.push({
        file,
        records: records.length,
        episodes: episodes.length,
        diagnosticGroups: episodes.map(e => e.diagnosticGroup).filter(Boolean),
        hospitals: [...new Set(episodes.flatMap(e => e.hospitals))]
      });

      logger.info({
        event: 'case_sample_episode_grouping',
        file,
        recordCount: records.length,
        episodeCount: episodes.length,
        diagnosticGroups: episodes.map(e => e.diagnosticGroup).filter(Boolean)
      });
    }

    const output = { generatedAt: new Date().toISOString(), summary, perCase };
    fs.writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2), 'utf8');
    const agg = buildAggregateSummary(summary);
    const SUMMARY_FILE = path.join(RESULT_DIR, 'outpatient-episodes-case-sample-summary.json');
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify({ generatedAt: output.generatedAt, aggregate: agg }, null, 2), 'utf8');
    logger.info({ event: 'case_sample_episode_grouping_complete', resultFile: RESULT_FILE, summaryFile: SUMMARY_FILE, files: files.length, totals: agg.totals });
  } catch (err) {
    logger.error({ event: 'case_sample_episode_grouping_error', message: err?.message });
    process.exit(1);
  }
}

run();
