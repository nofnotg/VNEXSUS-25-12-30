import ReportTemplateEngine from '../backend/postprocess/reportTemplateEngine.js';
import { getLabel } from '../src/shared/utils/i18n.js';

const sampleData = {
  header: { title: '의료 경과보고서', subtitle: 'Medical Progress Report' },
  patientInfo: {},
  timeline: [],
};

async function run(locale) {
  const engine = new ReportTemplateEngine();
  const htmlRes = await engine.generateBasicReport(sampleData, { format: 'html', locale });
  const textRes = await engine.generateBasicReport(sampleData, { format: 'text', locale });
  const jsonStr = engine.createJsonTemplate(sampleData, { locale });
  const jsonObj = JSON.parse(jsonStr);

  const out = {
    locale,
    label: getLabel('meta_generated_at', locale),
    html: htmlRes.report,
    text: textRes.report,
    json: jsonObj,
  };

  process.stdout.write(JSON.stringify(out));
}

const localeArg = process.argv[2] || 'ko';
run(localeArg).catch(err => {
  process.stderr.write(String(err?.stack || err));
  process.exit(1);
});
