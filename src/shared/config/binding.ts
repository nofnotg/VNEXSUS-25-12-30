export const BINDING_CONFIG = {
  radius: process.env.BIND_RADIUS ? Number(process.env.BIND_RADIUS) : 0.08,
  maxEvidence: process.env.BIND_MAX_EVIDENCE ? Number(process.env.BIND_MAX_EVIDENCE) : 5,
  tableRowTolerance: process.env.BIND_TABLE_TOL ? Number(process.env.BIND_TABLE_TOL) : 0.015,
};

