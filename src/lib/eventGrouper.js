function safeString(v) {
  return typeof v === 'string' ? v : '';
}

function mergeGroup(group) {
  if (group.length === 1) return group[0];
  const base = group[0];
  const merged = {
    ...base,
    rawText: group.map((e) => safeString(e?.rawText)).filter(Boolean).join('\n\n'),
    blocks: group.flatMap((e) => (Array.isArray(e?.blocks) ? e.blocks : [])),
    pageIndices: Array.from(
      new Set(group.flatMap((e) => (Array.isArray(e?.pageIndices) ? e.pageIndices : [])))
    ).sort((a, b) => a - b),
    tags: Array.from(
      new Set(group.flatMap((e) => (Array.isArray(e?.tags) ? e.tags : [])))
    ),
    mergedCount: group.length,
    sourceEvents: group.map((e) => ({ ...e })),
  };
  return merged;
}

export const eventGrouper = {
  async createTimeline(events, options = {}) {
    const list = Array.isArray(events) ? events : [];
    const groupByDate = options.groupByDate !== false;
    const groupByHospital = options.groupByHospital !== false;

    const sorted = [...list].sort((a, b) => safeString(a?.date).localeCompare(safeString(b?.date)));
    if (!groupByDate && !groupByHospital) return { events: sorted };

    const out = [];
    let cur = [];

    const keyOf = (e) => {
      const date = groupByDate ? safeString(e?.date) : '';
      const hosp = groupByHospital ? safeString(e?.hospital) : '';
      return `${date}__${hosp}`;
    };

    for (const ev of sorted) {
      if (cur.length === 0) {
        cur = [ev];
        continue;
      }
      if (keyOf(cur[0]) === keyOf(ev)) {
        cur.push(ev);
        continue;
      }
      out.push(mergeGroup(cur));
      cur = [ev];
    }
    if (cur.length) out.push(mergeGroup(cur));

    return { events: out };
  },
};

