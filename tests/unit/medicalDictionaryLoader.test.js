import { loadMedicalDictionaries } from "../../src/shared/constants/medicalDictionaryLoader.js";

describe("medical dictionary loader", () => {
  it("loads external dictionaries and has expected keys", () => {
    const dicts = loadMedicalDictionaries();
    expect(dicts).toBeTruthy();
    expect(Array.isArray(dicts.hospitalStopwords)).toBe(true);
    expect(dicts.hospitalStopwords.length).toBeGreaterThan(10);
    expect(typeof dicts.hospitalCanonicalMap).toBe("object");
    expect(dicts.hospitalCanonicalMap["서울대학교병원"]).toBe("서울대병원");
    expect(typeof dicts.diagnosisSynonyms).toBe("object");
    expect(dicts.diagnosisSynonyms["고지혈증"]).toBe("dyslipidemia");
  });
});

