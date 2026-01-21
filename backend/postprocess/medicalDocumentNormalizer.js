/**
 * Medical Document Normalizer Stub
 */

export class MedicalDocumentNormalizer {
  normalize(document) {
    return {
      success: true,
      normalized: document,
      metadata: {
        normalizer: 'stub',
        timestamp: new Date().toISOString()
      }
    };
  }

  async normalizeAsync(document) {
    return this.normalize(document);
  }
}

export default new MedicalDocumentNormalizer();
