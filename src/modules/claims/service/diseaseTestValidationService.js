// Disease-specific required test validation service (ESM)
// Validates whether records around disease-diagnosis anchors contain required tests
// within the configured timeframe.

import { ClaimRecordSet } from '../types/events.js';
import { DiseaseTestRuleSet } from '../types/rules.js';
import { DISEASE_TEST_RULES } from '../../../shared/constants/claimsRules.js';
import { logger } from '../../../shared/logging/logger.js';

function daysBetweenAbsolute(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function extractIcdFromDiagnosis(diagnosis) {
  if (!diagnosis) return undefined;
  const m = diagnosis.match(/\(ICD:\s*([A-Z]\d{2}(?:\.\d{1,2})?)\)/);
  return m?.[1];
}

function recordContainsTest(rec, testName) {
  const needle = String(testName).toLowerCase();
  const inContent = (rec.content || '').toLowerCase().includes(needle);
  const inReason = (rec.reason || '').toLowerCase().includes(needle);
  const inDiagnosis = (rec.diagnosis || '').toLowerCase().includes(needle);
  return inContent || inReason || inDiagnosis;
}

/**
 * Validate disease-specific required tests against claim records.
 * Timeframe semantics: if timeframeDays is provided, tests within ±timeframeDays around
 * the anchor date are counted as withinTimeframe; otherwise only same-day matches are counted.
 * Uncertainty note: directionality (before vs. after anchor) is not specified in rules; we assume symmetric window.
 *
 * @param {Array} records - claim records with { date, diagnosis, content, reason }
 * @param {Array} rules - disease test rules; defaults to DISEASE_TEST_RULES
 * @returns {{ perRule: Array, summary: { rulesApplied:number, anchorsTotal:number } }}
 */
export function validateDiseaseRequiredTests(records, rules = DISEASE_TEST_RULES) {
  try {
    const parsedRecords = ClaimRecordSet.parse(records);
    const parsedRules = DiseaseTestRuleSet.parse(rules);

    const perRule = [];
    let anchorsTotal = 0;

    for (const rule of parsedRules) {
      const diseaseRe = new RegExp(rule.diseaseCodePattern);
      const anchors = parsedRecords.filter(r => {
        const icd = extractIcdFromDiagnosis(r.diagnosis || '');
        return icd ? diseaseRe.test(icd) : false;
      });

      anchorsTotal += anchors.length;

      const coverage = rule.requiredTests.map(rt => {
        let anchorsCovered = 0;
        let testsFoundTotal = 0;
        let testsFoundWithinTimeframe = 0;

        for (const anchor of anchors) {
          const anchorDate = new Date(anchor.date);
          const anchorDateValid = !Number.isNaN(anchorDate.getTime());
          if (!anchorDateValid) {
            logger.warn({ event: 'disease_validation_invalid_date', value: anchor.date });
          }

          // Scan all records for tests mentioning the required test name
          let foundForAnchor = false;
          for (const rec of parsedRecords) {
            if (!recordContainsTest(rec, rt.name)) continue;
            testsFoundTotal++;
            const recDate = new Date(rec.date);
            if (Number.isNaN(recDate.getTime())) continue;
            const diff = anchorDateValid ? daysBetweenAbsolute(anchorDate, recDate) : Number.POSITIVE_INFINITY;
            const within = anchorDateValid ? (rt.timeframeDays != null ? diff <= rt.timeframeDays : diff === 0) : false;
            if (within) {
              testsFoundWithinTimeframe++;
              foundForAnchor = true;
              // do not break; count multiple within-timeframe occurrences but mark anchor covered
            }
          }
          if (foundForAnchor) anchorsCovered++;
        }

        return {
          testName: rt.name,
          timeframeDays: rt.timeframeDays,
          anchorsCovered,
          anchorsMissing: Math.max(anchors.length - anchorsCovered, 0),
          testsFoundTotal,
          testsFoundWithinTimeframe
        };
      });

      perRule.push({
        ruleName: rule.name,
        diseaseCodePattern: rule.diseaseCodePattern,
        severityLevel: rule.severityLevel,
        anchorsCount: anchors.length,
        coverage
      });
    }

    const result = { perRule, summary: { rulesApplied: parsedRules.length, anchorsTotal } };
    logger.info({ event: 'disease_validation_done', rulesApplied: parsedRules.length, anchorsTotal });
    return result;
  } catch (error) {
    logger.error({ event: 'disease_validation_error', message: error.message });
    throw new Error('disease_validation_failed');
  }
}

export default { validateDiseaseRequiredTests };
