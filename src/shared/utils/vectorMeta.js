// VectorMeta computation utility (ESM)
// Quantizes weights to one decimal place and produces lightweight 3D coords

/**
 * Quantize weight to one decimal place [0.0 .. 1.0]
 * Normalizes the set so their sum is 1.0 (to one decimal tolerance).
 */
export function quantizeWeights(weights) {
  const q = {
    semantic: clamp01(round1(weights.semantic ?? 0.3)),
    time: clamp01(round1(weights.time ?? 0.3)),
    confidence: clamp01(round1(weights.confidence ?? 0.4)),
  };
  const s = q.semantic + q.time + q.confidence;
  if (s === 0) return { semantic: 0.3, time: 0.3, confidence: 0.4 };
  // Normalize with one-decimal rounding while keeping proportions
  const semantic = round1((q.semantic / s));
  const time = round1((q.time / s));
  const confidence = round1((q.confidence / s));
  // Final adjust to ensure sum is 1.0 within one-decimal precision
  const sum = round1(semantic + time + confidence);
  if (sum !== 1.0) {
    const diff = round1(1.0 - sum);
    // Add diff to the largest weight
    const arr = [
      { k: 'semantic', v: semantic },
      { k: 'time', v: time },
      { k: 'confidence', v: confidence },
    ].sort((a, b) => b.v - a.v);
    arr[0].v = round1(arr[0].v + diff);
    return {
      semantic: arr.find(a => a.k === 'semantic')?.v ?? semantic,
      time: arr.find(a => a.k === 'time')?.v ?? time,
      confidence: arr.find(a => a.k === 'confidence')?.v ?? confidence,
    };
  }
  return { semantic, time, confidence };
}

/**
 * Build a VectorMeta summary for preview. Semantic is placeholder (0) until embeddings.
 */
export function buildVectorMeta({ organizedData, massiveDateResult, finalReport, weights }) {
  const w = quantizeWeights(weights ?? {});
  const confidenceScalar = safeNumber(massiveDateResult?.statistics?.averageConfidence, 0.6);
  const coverageScalar = estimateCoverageScalar(organizedData, finalReport);
  const temporalScalar = estimateTemporalScalar(massiveDateResult);

  const semanticScalar = 0.0; // Placeholder until embedding pipeline lands

  const projection3D = [
    round1(w.semantic * semanticScalar),
    round1(w.time * temporalScalar),
    round1(w.confidence * normalize01((confidenceScalar + coverageScalar) / 2)),
  ];

  return {
    weights: w,
    projection3D,
    components: {
      semantic: semanticScalar,
      time: temporalScalar,
      confidence: normalize01((confidenceScalar + coverageScalar) / 2),
    },
    meta: {
      coverageScalar,
      confidenceScalar,
      events: summarizeEvents(massiveDateResult),
    },
  };
}

export function isometricProject([x, y, z]) {
  const deg = Math.PI / 6; // 30°
  const isoX = (x - z) * Math.cos(deg);
  const isoY = y + (x + z) * Math.sin(deg);
  return [round2(isoX), round2(isoY)];
}

function estimateCoverageScalar(organizedData, finalReport) {
  try {
    const groups = Array.isArray(organizedData?.groupedData)
      ? organizedData.groupedData.length
      : Array.isArray(organizedData)
      ? organizedData.length
      : 1;
    const sections = Array.isArray(finalReport?.sections)
      ? finalReport.sections.length
      : Object.keys(finalReport ?? {}).length || 1;
    const raw = groups / Math.max(sections, 1);
    return normalize01(raw);
  } catch {
    return 0.5;
  }
}

function estimateTemporalScalar(massiveDateResult) {
  try {
    const groups = massiveDateResult?.structuredGroups ?? [];
    const dates = groups
      .map(g => toDate(g?.date))
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length) return 0.5;
    const spanDays = (dates.at(-1).getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
    // Normalize span over a 5-year window baseline
    const baselineDays = 365 * 5;
    return clamp01(spanDays / baselineDays);
  } catch {
    return 0.5;
  }
}

function summarizeEvents(massiveDateResult) {
  const groups = massiveDateResult?.structuredGroups ?? [];
  return groups.slice(0, 50).map(g => ({
    label: g?.label ?? g?.type ?? 'event',
    date: g?.date ?? null,
    confidence: safeNumber(g?.confidence, null),
  }));
}

function toDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
}

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clamp01(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }
function normalize01(n) { return clamp01(n); }
function safeNumber(n, def) { return typeof n === 'number' && Number.isFinite(n) ? n : (def ?? null); }

