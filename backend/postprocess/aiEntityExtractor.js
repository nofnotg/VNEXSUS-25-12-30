/**
 * AI Entity Extractor Stub
 * Temporary stub to allow server to start
 */

export async function extractEntities(text) {
  return {
    dates: [],
    names: [],
    organizations: [],
    locations: []
  };
}

export async function extractMedicalEntities(text) {
  return {
    diagnoses: [],
    medications: [],
    procedures: [],
    symptoms: []
  };
}

export default {
  extractEntities,
  extractMedicalEntities
};
