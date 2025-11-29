// Claims record/event schemas (ESM)
// Single-source types for claims-related record processing

import { z } from 'zod';

export const ClaimRecord = z.object({
  date: z.string().min(1), // ISO date (YYYY-MM-DD)
  hospital: z.string().optional(),
  reason: z.string().optional(),
  diagnosis: z.string().optional(),
  content: z.string().optional(),
  isClaim: z.boolean().optional()
});

export const ClaimRecordSet = z.array(ClaimRecord);

export default {
  ClaimRecord,
  ClaimRecordSet
};

