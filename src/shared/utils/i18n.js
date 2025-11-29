import { REPORT_LABELS_EN } from "../constants/i18n/reportLabels.en.js";
import { REPORT_LABELS_KO } from "../constants/i18n/reportLabels.ko.js";

const DICTS = {
  en: REPORT_LABELS_EN,
  ko: REPORT_LABELS_KO,
};

export const getLabel = (key, locale = "en") => {
  const dict = DICTS[locale] ?? REPORT_LABELS_EN;
  return (dict[key] ?? REPORT_LABELS_EN[key] ?? key);
};

