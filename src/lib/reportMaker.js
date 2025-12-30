import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function flattenTimelineEvents(timeline) {
  const top = toArray(timeline?.events);
  if (top.length === 0) return [];

  const flat = [];
  for (const item of top) {
    const nested = toArray(item?.events);
    if (nested.length > 0) {
      for (const e of nested) flat.push(e);
      continue;
    }
    flat.push(item);
  }
  return flat;
}

function pickString(value) {
  return typeof value === 'string' ? value : '';
}

class ReportMaker {
  async createReport(timeline, filterResult, options = {}) {
    const outputDir = options.outputPath
      ? String(options.outputPath)
      : options.outputDir
        ? String(options.outputDir)
        : path.resolve(process.cwd(), 'outputs');

    await fs.mkdir(outputDir, { recursive: true });

    const format = typeof options.format === 'string' ? options.format : 'excel';
    const normalizedFilterResult = filterResult ?? {};
    const patientInfo = options.patientInfo ?? timeline?.patientInfo ?? {};

    if (format === 'json') {
      const fileName = `report_${Date.now()}_${randomUUID().slice(0, 8)}.json`;
      const filePath = path.join(outputDir, fileName);
      const payload = {
        generatedAt: new Date().toISOString(),
        patientInfo,
        filterResult: normalizedFilterResult,
        timeline: timeline ?? {},
      };
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
      return {
        success: true,
        reportPath: filePath,
        stats: {
          totalEvents: flattenTimelineEvents(timeline).length,
        },
      };
    }

    const fileName = `medical_report_${randomUUID().slice(0, 8)}.xlsx`;
    const filePath = path.join(outputDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VNEXSUS';
    workbook.created = new Date();
    workbook.modified = new Date();

    const infoSheet = workbook.addWorksheet('환자 정보');
    infoSheet.columns = [
      { header: 'Key', key: 'key', width: 22 },
      { header: 'Value', key: 'value', width: 60 },
    ];
    infoSheet.addRows([
      { key: 'name', value: pickString(patientInfo?.name) },
      { key: 'birthDate', value: pickString(patientInfo?.birthDate) },
      { key: 'insuranceDate', value: pickString(patientInfo?.insuranceDate ?? patientInfo?.enrollmentDate) },
      { key: 'generatedAt', value: new Date().toISOString() },
    ]);

    const allEvents = flattenTimelineEvents(timeline);
    const eventsSheet = workbook.addWorksheet('전체 진료기록');
    eventsSheet.columns = [
      { header: 'date', key: 'date', width: 14 },
      { header: 'hospital', key: 'hospital', width: 26 },
      { header: 'diagnosis', key: 'diagnosis', width: 34 },
      { header: 'icd', key: 'icd', width: 12 },
      { header: 'procedures', key: 'procedures', width: 34 },
      { header: 'confidence', key: 'confidence', width: 10 },
      { header: 'rawText', key: 'rawText', width: 80 },
    ];
    for (const e of allEvents) {
      const procedures = toArray(e?.procedures)
        .map((p) => pickString(p?.name || p))
        .filter(Boolean)
        .join(', ');
      eventsSheet.addRow({
        date: pickString(e?.date),
        hospital: pickString(e?.hospital),
        diagnosis: pickString(e?.diagnosis?.name ?? e?.diagnosis),
        icd: pickString(e?.diagnosis?.code ?? e?.icd),
        procedures,
        confidence: typeof e?.confidence === 'number' ? e.confidence : null,
        rawText: pickString(e?.rawText),
      });
    }

    const filteredEvents = toArray(normalizedFilterResult?.filtered ?? normalizedFilterResult?.events);
    if (filteredEvents.length > 0) {
      const filteredSheet = workbook.addWorksheet('필터링 진료기록');
      filteredSheet.columns = eventsSheet.columns;
      for (const e of filteredEvents) {
        const procedures = toArray(e?.procedures)
          .map((p) => pickString(p?.name || p))
          .filter(Boolean)
          .join(', ');
        filteredSheet.addRow({
          date: pickString(e?.date),
          hospital: pickString(e?.hospital),
          diagnosis: pickString(e?.diagnosis?.name ?? e?.diagnosis),
          icd: pickString(e?.diagnosis?.code ?? e?.icd),
          procedures,
          confidence: typeof e?.confidence === 'number' ? e.confidence : null,
          rawText: pickString(e?.rawText),
        });
      }
    }

    await workbook.xlsx.writeFile(filePath);
    return {
      success: true,
      reportPath: filePath,
      stats: {
        totalEvents: allEvents.length,
        filteredEvents: filteredEvents.length || undefined,
      },
    };
  }
}

export const reportMaker = new ReportMaker();
