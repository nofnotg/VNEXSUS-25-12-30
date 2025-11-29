// Disclosure window filter service (ESM)
// Filters claim records based on configured disclosure window rules.

import { ClaimRecordSet } from '../types/events.js';
import { DisclosureWindowRuleSet } from '../types/rules.js';
import { DISCLOSURE_WINDOW_RULES } from '../../../shared/constants/claimsRules.js';
import { tagEventsWithClaimFlag } from '../../../shared/utils/claimSectionTagger.js';
import { logger } from '../../../shared/logging/logger.js';

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Filter records to include only claim-related events within disclosure window.
 * @param {Array} records - records with { date, content, isClaim? }
 * @param {Array} rules - disclosure rules; defaults to DISCLOSURE_WINDOW_RULES
 * @param {Date} now - reference date; defaults to new Date()
 * @returns {{ filtered: Array, stats: { total:number, claimTotal:number, within:number, outside:number } }}
 */
export function filterClaimsByWindow(records, rules = DISCLOSURE_WINDOW_RULES, now = new Date()) {
  try {
    const parsedRecords = ClaimRecordSet.parse(records);
    const parsedRules = DisclosureWindowRuleSet.parse(rules);

    // Pick the active claim rule
    const claimRule = parsedRules.find(r => r.eventType === 'claim');
    if (!claimRule) {
      logger.warn({ event: 'claims_window_no_rule', message: 'No claim rule found; returning unfiltered', count: parsedRecords.length });
      return { filtered: parsedRecords, stats: { total: parsedRecords.length, claimTotal: parsedRecords.length, within: parsedRecords.length, outside: 0 } };
    }

    const windowDays = claimRule.windowDays;
    const within = [];
    let claimTotal = 0;
    let outsideCount = 0;

    for (const rec of parsedRecords) {
      // Determine claim flag (prefer explicit, else fallback via content keyword tagging)
      let isClaim = rec.isClaim === true;
      if (!isClaim) {
        const tagged = tagEventsWithClaimFlag([rec], rec.content || '');
        isClaim = tagged[0]?.isClaim === true;
      }

      if (!isClaim) continue; // only filter claim events
      claimTotal++;

      const date = new Date(rec.date);
      if (Number.isNaN(date.getTime())) {
        outsideCount++;
        logger.warn({ event: 'claims_window_invalid_date', value: rec.date });
        continue;
      }

      const diff = daysBetween(now, date);
      if (diff <= windowDays) {
        within.push({ ...rec, isClaim: true });
      } else {
        outsideCount++;
      }
    }

    const result = { filtered: within, stats: { total: parsedRecords.length, claimTotal, within: within.length, outside: outsideCount } };
    logger.info({ event: 'claims_window_filter_done', windowDays, stats: result.stats });
    return result;
  } catch (error) {
    logger.error({ event: 'claims_window_filter_error', message: error.message });
    throw new Error('claims_window_filter_failed');
  }
}

export default { filterClaimsByWindow };

