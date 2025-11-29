import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { logger } from "../logging/logger.js";

export function loadMedicalDictionaries() {
  const path = resolve(process.cwd(), "src/shared/constants/medical/dictionaries.json");
  try {
    if (!existsSync(path)) {
      logger.warn({ event: "medical_dict_missing", path });
      return {};
    }
    const raw = readFileSync(path, "utf-8");
    const json = JSON.parse(raw);
    const { hospitalStopwords, hospitalCanonicalMap, diagnosisSynonyms } = json;
    return { hospitalStopwords, hospitalCanonicalMap, diagnosisSynonyms };
  } catch (err) {
    logger.error({ event: "medical_dict_load_error", message: err?.message });
    return {};
  }
}

