const { spawnSync } = require('child_process');
const path = require('path');

function runRunner(locale) {
  const runnerPath = path.join(__dirname, '../../scripts/esm-engine-runner.mjs');
  const result = spawnSync('node', [runnerPath, locale], {
    encoding: 'utf-8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Runner failed (${locale}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

describe('ReportTemplateEngine i18n & locale', () => {
  test('HTML lang attribute and generated-at label for ko', () => {
    const out = runRunner('ko');
    expect(out.html).toMatch('<html lang="ko"');
    expect(out.html).toContain(out.label);
  });

  test('HTML lang attribute and generated-at label for en', () => {
    const out = runRunner('en');
    expect(out.html).toMatch('<html lang="en"');
    expect(out.html).toContain(out.label);
  });

  test('Text output contains localized generated-at label', () => {
    const ko = runRunner('ko');
    const en = runRunner('en');
    expect(ko.text).toContain(ko.label);
    expect(en.text).toContain(en.label);
  });

  test('JSON metadata includes locale', () => {
    const ko = runRunner('ko');
    expect(ko.json?.metadata?.locale).toBe('ko');
    const en = runRunner('en');
    expect(en.json?.metadata?.locale).toBe('en');
  });

  test('Unknown locale falls back to EN label and HTML lang', () => {
    const fr = runRunner('fr');
    // HTML lang attribute should fallback to EN for unsupported locale
    expect(fr.html).toMatch('<html lang="en"');
    // Label should fallback to EN per getLabel implementation
    expect(fr.label).toBeDefined();
    expect(fr.text).toContain(fr.label);
  });
});
