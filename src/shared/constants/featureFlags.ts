export const FEATURE_FLAGS = {
  dateBindingV3: process.env.FEAT_BIND_V3 === "true",
  tenItemReport: process.env.FEAT_TEN_ITEM === "true",
  scoring: process.env.FEAT_SCORE === "true",
  relations: process.env.FEAT_REL === "true",
  ragLookup: process.env.FEAT_RAG === "true",
};

