// Jest test for CLI function generateCsvFromFile
import { writeFile, readFile, mkdir } from 'fs/promises';
import { generateCsvFromFile } from '../../src/scripts/generateComparisonCsv.js';

describe('CLI generateComparisonCsv', () => {
  test('writes CSV file from sample comparison JSON', async () => {
    const inputPath = 'temp/sessions/sample-comparison.json';
    const outputPath = 'temp/sessions/sample-comparison.csv';
    await mkdir('temp/sessions', { recursive: true });
    const sample = {
      results: [
        {
          name: 'baseline',
          summary: [
            {
              file: 'CaseX.txt',
              records: 12,
              episodes: 9,
              diagnosticGroups: ['digestive', 'respiratory'],
              hospitals: ['서울대학교병원 내원', '분당서울대학교병원 방문']
            }
          ]
        }
      ]
    };
    await writeFile(inputPath, JSON.stringify(sample), 'utf-8');

    const { bytes } = await generateCsvFromFile(inputPath, outputPath, { includeHospitalsNormalized: true });
    expect(bytes).toBeGreaterThan(0);
    const csv = await readFile(outputPath, 'utf-8');
    expect(csv).toMatch(/config,file,records,episodes,groups_total/);
    expect(csv).toMatch(/groups_digestive/);
    expect(csv).toMatch(/groups_respiratory/);
    // Header should include claim metrics columns
    expect(csv).toMatch(/claim_within_window/);
    expect(csv).toMatch(/claim_total/);
    // Header should include disease validation columns
    expect(csv).toMatch(/disease_anchors/);
    expect(csv).toMatch(/disease_tests_within_timeframe/);
    expect(csv).toMatch(/서울대병원; 분당서울대병원/);
  });
});
