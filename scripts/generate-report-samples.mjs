import fs from 'node:fs';
import path from 'node:path';
import ReportTemplateEngine from '../backend/postprocess/reportTemplateEngine.js';

const outDir = path.join(process.cwd(), 'dist', 'reports');
fs.mkdirSync(outDir, { recursive: true });

const sampleData = {
  header: { title: '의료 경과보고서', subtitle: 'Medical Progress Report' },
  patientInfo: { name: '홍길동', id: 'P-0001' },
  timeline: [
    { date: '2024-04-20', event: '초진', hospital: '서울병원' },
    { date: '2024-05-05', event: '재진', hospital: '부산병원' },
  ],
};

async function generate(locale, fileName) {
  const engine = new ReportTemplateEngine();
  const { report } = await engine.generateBasicReport(sampleData, { format: 'html', locale });
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, report, 'utf-8');
  return outPath;
}

const run = async () => {
  await generate('ko', 'basic-ko.html');
  await generate('en', 'basic-en.html');
  process.stdout.write(outDir);
};

run().catch(err => {
  process.stderr.write(String(err?.stack || err));
  process.exit(1);
});

