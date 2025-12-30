/**
 * Reports Module – Structured Output Schemas
 * Definition of Ready: central type source for report/timeline structures
 */

import { z } from 'zod';

// ISO date string validator (YYYY-MM-DD or full ISO 8601)
const IsoDateString = z
  .string()
  .min(4)
  .refine(
    (s) => {
      // Accept YYYY-MM-DD or ISO 8601
      const basic = /^\d{4}-\d{2}-\d{2}$/;
      const iso = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
      return basic.test(s) || iso.test(s);
    },
    { message: 'date must be ISO string (YYYY-MM-DD or ISO 8601)' }
  );

// Timeline event schema – single source of truth
export const TimelineEventSchema = z.object({
  label: z.string().min(1),
  date: IsoDateString,
  confidence: z.number().min(0).max(1),
  hospital: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // optional identifiers and payloads
  id: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

// Timeline schema – used after grouping
export const TimelineSchema = z.object({
  events: z.array(TimelineEventSchema),
  // optional grouping metadata
  groups: z
    .array(
      z.object({
        key: z.string().optional(),
        label: z.string().optional(),
        count: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
});

// Structured report schema – kept minimal for current MVP
export const StructuredReportSchema = z.object({
  timeline: TimelineSchema,
  stats: z
    .object({
      total: z.number().int().nonnegative(),
      filtered: z.number().int().nonnegative(),
      beforeEnrollment: z.number().int().nonnegative(),
      timeline: z.number().int().nonnegative(),
    })
    .optional(),
  classification: z
    .object({ label: z.string(), tags: z.array(z.string()).optional() })
    .optional(),
});

// Helper: validate timeline and return issues
export const validateTimeline = (timeline) => {
  const parsed = TimelineSchema.safeParse(timeline);
  return parsed;
};

// API Request schema for postprocess report endpoint
export const ReportRequestSchema = z.object({
  jobId: z.string().min(1),
  parsedEvents: z.array(TimelineEventSchema),
  patientInfo: z.record(z.any()).optional(),
  insuranceInfo: z.record(z.any()).optional(),
  filterResult: z.record(z.any()).optional(),
  options: z
    .object({
      startDate: IsoDateString.optional(),
      endDate: IsoDateString.optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      includeTags: z.array(z.string()).optional(),
      excludeTags: z.array(z.string()).optional(),
      includeBeforeEnrollment: z.boolean().optional(),
      vectorWeights: z
        .object({ semantic: z.number(), time: z.number(), confidence: z.number() })
        .optional(),
      traceId: z.string().optional(),
    })
    .optional(),
});

export const validateReportRequest = (body) => ReportRequestSchema.safeParse(body);

// API Response schema
export const ReportResponseSchema = z.object({
  success: z.boolean(),
  reportPath: z.string().min(1).optional(),
  error: z.string().optional(),
  stats: z
    .object({
      total: z.number().int().nonnegative(),
      filtered: z.number().int().nonnegative(),
      beforeEnrollment: z.number().int().nonnegative(),
      timeline: z.number().int().nonnegative(),
    })
    .optional(),
  classification: z
    .object({ label: z.string(), tags: z.array(z.string()).optional() })
    .optional(),
});

export const validateReportResponse = (resp) => ReportResponseSchema.safeParse(resp);

export const MedicalEventSchema = z.object({
  id: z.string().min(1),
  date: IsoDateString,
  hospital: z.string().optional(),
  eventType: z.string().min(1),
  description: z.string().optional(),
  diagnosis: z
    .object({
      name: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  procedures: z
    .array(
      z.object({
        name: z.string().min(1),
        code: z.string().optional(),
      })
    )
    .optional(),
  medications: z
    .array(
      z.object({
        name: z.string().min(1),
        dose: z.string().optional(),
      })
    )
    .optional(),
  anchors: z
    .object({
      position: z
        .object({
          page: z.number().int().positive().optional(),
          xMin: z.number().optional(),
          yMin: z.number().optional(),
          xMax: z.number().optional(),
          yMax: z.number().optional(),
        })
        .optional(),
      sourceSpan: z
        .object({
          blockIndex: z.number().int().nonnegative().optional(),
        })
        .optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
  payload: z.record(z.any()).optional(),
});

export default {
  TimelineEventSchema,
  TimelineSchema,
  StructuredReportSchema,
  validateTimeline,
  ReportRequestSchema,
  validateReportRequest,
  ReportResponseSchema,
  validateReportResponse,
  MedicalEventSchema,
};
