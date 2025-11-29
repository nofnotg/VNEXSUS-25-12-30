/**
 * @jest-environment node
 */
import { DisclosureWindowRuleSet, DiseaseTestRuleSet, SummaryFieldRuleSet } from '../../src/modules/claims/types/rules.js';
import { DISCLOSURE_WINDOW_RULES, DISEASE_TEST_RULES, SUMMARY_FIELD_RULES } from '../../src/shared/constants/claimsRules.js';

describe('claims rules schemas', () => {
  test('disclosure window rules conform to schema', () => {
    const parsed = DisclosureWindowRuleSet.safeParse(DISCLOSURE_WINDOW_RULES);
    expect(parsed.success).toBe(true);
  });

  test('disease test rules conform to schema', () => {
    const parsed = DiseaseTestRuleSet.safeParse(DISEASE_TEST_RULES);
    expect(parsed.success).toBe(true);
  });

  test('summary field rules conform to schema', () => {
    const parsed = SummaryFieldRuleSet.safeParse(SUMMARY_FIELD_RULES);
    expect(parsed.success).toBe(true);
  });
});

