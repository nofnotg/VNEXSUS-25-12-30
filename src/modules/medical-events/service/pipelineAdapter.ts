import { DateBindingV3 } from "./dateBindingV3";
import { packEventSlots } from "./eventPacking";
import { scoreEvent, computeRelations } from "./scoring";
import { TenItemReportGenerator } from "../../../../backend/services/tenItemReportGenerator";
import { BindInput, BindOutput, MedicalEvent } from "../types/index";

export type AdapterInput = BindInput & {
  claimKeywords?: string[];
};

export type AdapterResult = {
  events: MedicalEvent[];
  report: {
    json: unknown;
    markdown: string;
    html: string;
  };
};

export const runMedicalEventReport = (input: AdapterInput, opts?: { outputPath?: string; radius?: number; maxEvidence?: number }) => {
  const bound: BindOutput = DateBindingV3.bindDatesToEvents(input, { radius: opts?.radius, maxEvidence: opts?.maxEvidence });
  let events = bound.events.map(e => packEventSlots(e));
  events = events.map(e => ({
    ...e,
    meta: { ...(e.meta || {}), score: scoreEvent(e, events, { contractDate: input.contractDate, claimKeywords: input.claimKeywords }) },
  }));
  events = computeRelations(events);
  const report = TenItemReportGenerator.build(events, { outputPath: opts?.outputPath });
  return { events, report } as AdapterResult;
};

