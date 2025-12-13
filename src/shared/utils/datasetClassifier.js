// Dataset classification utility (ESM)
// Heuristics to label datasets for 3D vector modeling and storage

export function classifyDataset(parsedEvents = [], patientInfo = {}) {
  const tags = new Set();
  let label = 'general';

  for (const ev of parsedEvents) {
    const t = (ev?.type || '').toLowerCase();
    const tagArr = Array.isArray(ev?.tags) ? ev.tags : [];
    for (const tg of tagArr) tags.add(String(tg).toLowerCase());

    if (t.includes('claim') || tags.has('claim') || tags.has('insurance')) {
      label = 'claims';
    }
    if (t.includes('diagnosis') || t.includes('procedure') || tags.has('diagnosis') || tags.has('procedure')) {
      label = 'medical_timeline';
    }
    if (t.includes('genetic') || tags.has('genetic') || tags.has('dna')) {
      label = 'genetic';
    }
  }

  if (!parsedEvents.length && (patientInfo?.dna || patientInfo?.genetic)) {
    label = 'genetic';
    tags.add('genetic');
  }

  const tagList = Array.from(tags);
  return {
    label,
    tags: tagList,
    summary: {
      eventCount: parsedEvents.length,
      hospitals: uniqueValues(parsedEvents.map(e => e?.hospital).filter(Boolean)),
      dates: uniqueValues(parsedEvents.map(e => e?.date).filter(Boolean)).slice(0, 50),
    }
  };
}

function uniqueValues(arr) {
  const s = new Set(arr.map(v => String(v)));
  return Array.from(s);
}

