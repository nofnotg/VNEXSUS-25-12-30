function asDateString(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const periodFilter = {
  async filter(parsedEvents, enrollmentDate, options = {}) {
    const events = Array.isArray(parsedEvents) ? parsedEvents : [];
    const minConfidence = typeof options.minConfidence === 'number' ? options.minConfidence : 0;
    const includeTags = Array.isArray(options.includeTags) ? options.includeTags : [];
    const excludeTags = Array.isArray(options.excludeTags) ? options.excludeTags : [];
    const startDate = asDateString(options.startDate);
    const endDate = asDateString(options.endDate);
    const enroll = asDateString(enrollmentDate);
    const includeBeforeEnrollment = options.includeBeforeEnrollment !== false;

    const beforeEnrollment = [];
    const filteredOut = [];
    const filtered = [];

    for (const ev of events) {
      const confidence = typeof ev?.confidence === 'number' ? ev.confidence : 0;
      const evTags = Array.isArray(ev?.tags) ? ev.tags : [];
      const evDate = asDateString(ev?.date);

      if (enroll && evDate && evDate < enroll && !includeBeforeEnrollment) {
        beforeEnrollment.push(ev);
        continue;
      }
      if (enroll && evDate && evDate < enroll && includeBeforeEnrollment) {
        beforeEnrollment.push(ev);
      }
      if (confidence < minConfidence) {
        filteredOut.push(ev);
        continue;
      }
      if (excludeTags.length && evTags.some((t) => excludeTags.includes(t))) {
        filteredOut.push(ev);
        continue;
      }
      if (includeTags.length && !evTags.some((t) => includeTags.includes(t))) {
        filteredOut.push(ev);
        continue;
      }
      if (startDate && evDate && evDate < startDate) {
        filteredOut.push(ev);
        continue;
      }
      if (endDate && evDate && evDate > endDate) {
        filteredOut.push(ev);
        continue;
      }
      filtered.push(ev);
    }

    return { filtered, beforeEnrollment, filteredOut };
  },
};

