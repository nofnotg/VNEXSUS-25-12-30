import * as Mod from '../backend/services/nineItemReportGenerator.js';
const Gen = Mod.default || Mod.NineItemReportGenerator;
const g = new Gen();
const out = g.formatDiagnosisWithKCD({ items: [
  'C50.9 침윤성 유관암',
  'R074 흉통',
  'E11.68 당뇨병',
  '침윤성 유관암',
  'I209 협심증((ICD: I20).9)'
] });
console.log(out);
