// Claims rules schemas (ESM)
// Zod-based single source of truth for claims-related rules
// - Disclosure window rules
// - Disease-specific test application rules
// - Summary field rules (for final reporting)

import { z } from 'zod';

export const DisclosureWindowRule = z.object({
  name: z.string().min(1),
  eventType: z.enum(['diagnosis', 'treatment', 'claim']),
  windowDays: z.number().int().positive(),
  anchorField: z.enum(['date', 'diagnosisDate', 'treatmentStartDate']).default('date')
});
export const DisclosureWindowRuleSet = z.array(DisclosureWindowRule);

export const RequiredTest = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  timeframeDays: z.number().int().positive().optional()
});
export const DiseaseTestRule = z.object({
  name: z.string().min(1),
  diseaseCodePattern: z.string().min(1), // e.g., /^I2\d/ for ischemic heart disease
  requiredTests: z.array(RequiredTest).min(1),
  severityLevel: z.enum(['low', 'moderate', 'high']).optional()
});
export const DiseaseTestRuleSet = z.array(DiseaseTestRule);

export const SummaryFieldRule = z.object({
  field: z.enum(['cases', 'records', 'episodes', 'hospitalsUnique', 'topGroups']),
  includeIfClaim: z.boolean().optional(),
  includeIfNotClaim: z.boolean().optional(),
  compute: z.enum(['aggregateMetric', 'listTopGroups']).default('aggregateMetric')
});
export const SummaryFieldRuleSet = z.array(SummaryFieldRule);

export default {
  DisclosureWindowRule,
  DisclosureWindowRuleSet,
  DiseaseTestRule,
  DiseaseTestRuleSet,
  RequiredTest,
  SummaryFieldRule,
  SummaryFieldRuleSet
};

