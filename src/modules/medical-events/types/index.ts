import { z } from "zod";

export const BoundingBox = z.object({
  page: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

export const DateBox = z.object({
  text: z.string(),
  bbox: BoundingBox,
  confidence: z.number().min(0).max(1),
  kind: z.enum(["visit", "surgery", "exam", "report", "read", "admission", "discharge"]).optional(),
});
export type DateBox = z.infer<typeof DateBox>;

export const TextBlock = z.object({
  text: z.string(),
  bbox: BoundingBox,
  page: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
});
export type TextBlock = z.infer<typeof TextBlock>;

export const Evidence = z.object({
  page: z.number().int().nonnegative(),
  bbox: BoundingBox,
  snippet: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Evidence = z.infer<typeof Evidence>;

export const EventSlot = z.object({
  visitDate: z.string().optional(),
  visitReason: z.string().optional(),
  diagnosis: z.array(z.string()).optional(),
  examination: z.array(z.string()).optional(),
  pathology: z.array(z.string()).optional(),
  treatment: z.array(z.string()).optional(),
  outpatientPeriod: z.string().optional(),
  admissionPeriod: z.string().optional(),
  pastHistory: z.array(z.string()).optional(),
  doctorOpinion: z.string().optional(),
});
export type EventSlot = z.infer<typeof EventSlot>;

export const EventMeta = z.object({
  evidence: z.array(Evidence).optional(),
  tags: z.array(z.string()).optional(),
  needsReview: z.array(z.string()).optional(),
  score: z.number().min(0).max(1).optional(),
  relEdges: z
    .array(
      z.object({
        toDate: z.string(),
        rel: z.number().min(0).max(1),
      }),
    )
    .optional(),
});
export type EventMeta = z.infer<typeof EventMeta>;

export const MedicalEvent = z.object({
  date: z.string(),
  slots: EventSlot,
  meta: EventMeta.optional(),
});
export type MedicalEvent = z.infer<typeof MedicalEvent>;

export const BindInput = z.object({
  dates: z.array(DateBox),
  blocks: z.array(TextBlock),
  contractDate: z.string().optional(),
});
export type BindInput = z.infer<typeof BindInput>;

export const BindOutput = z.object({
  events: z.array(MedicalEvent),
});
export type BindOutput = z.infer<typeof BindOutput>;

