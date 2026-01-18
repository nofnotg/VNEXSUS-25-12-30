#!/usr/bin/env tsx
/**
 * 28개 케이스 전체 검증 스크립트
 * - gpt-4o-mini로 전체 실행
 * - offline_ocr.json + blocks.csv 모두 지원
 * - 날짜 검증 및 절대적 기준 분류
 */
import fs from "fs";
import path from "path";
import { loadBindInputFromFile } from "../src/modules/medical-events/service/preparedOcrLoader";
import { runMedicalEventReport } from "../src/modules/medical-events/service/pipelineAdapter";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "validation-28");
const CASES_JSON = path.join(process.cwd(), "validation_cases_28.json");

interface CaseInfo {
  name: string;
  type: "Case" | "Named";
  ocr_file: string;
  baseline_file: string;
  timestamp: string;
}

interface ValidationResult {
  case: string;
  type: string;
  success: boolean;
  error?: string;
  output_dir?: string;
  execution_time?: number;
  event_count?: number;
}

const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
const readText = (p: string) => fs.readFileSync(p, "utf-8");
const writeText = (p: string, s: string) => fs.writeFileSync(p, s, "utf-8");
const exists = (p: string) => fs.existsSync(p);

async function processSingleCase(caseInfo: CaseInfo): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Processing: ${caseInfo.name}`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Type: ${caseInfo.type}`);
    console.log(`OCR File: ${path.basename(caseInfo.ocr_file)}`);
    console.log(`Baseline: ${path.basename(caseInfo.baseline_file)}`);

    // Check files exist
    if (!exists(caseInfo.ocr_file)) {
      throw new Error(`OCR file not found: ${caseInfo.ocr_file}`);
    }
    if (!exists(caseInfo.baseline_file)) {
      throw new Error(`Baseline file not found: ${caseInfo.baseline_file}`);
    }

    // Load OCR data
    console.log("\n📥 Loading OCR data...");
    const bindInput = loadBindInputFromFile(caseInfo.ocr_file);
    console.log(`  - Blocks loaded: ${bindInput.blocks?.length || 0}`);
    console.log(`  - Dates loaded: ${bindInput.dates?.length || 0}`);

    // Extract merged text
    const mergedText = bindInput.blocks?.map(b => b.text).join("\n") || "";
    console.log(`  - Merged text length: ${mergedText.length} chars`);

    // Prepare output directory
    const outputDir = path.join(OUTPUT_DIR, caseInfo.name);
    ensureDir(outputDir);

    // Extract patient info (if available)
    const patientInfo = {
      name: caseInfo.name,
      contractDate: bindInput.contractDate,
    };

    // Run pipeline
    console.log("\n⚙️  Running medical event pipeline...");
    const result = await runMedicalEventReport(bindInput, {
      outputFormat: "all",
      savePath: outputDir,
    });

    console.log(`  - Events generated: ${result.events?.length || 0}`);
    console.log(`  - Output saved to: ${outputDir}`);

    // Save merged text for reference
    const mergedPath = path.join(outputDir, `${caseInfo.name}_merged.txt`);
    writeText(mergedPath, mergedText);

    // Copy baseline for comparison
    const baselineCopyPath = path.join(outputDir, `${caseInfo.name}_baseline.txt`);
    fs.copyFileSync(caseInfo.baseline_file, baselineCopyPath);

    const executionTime = Date.now() - startTime;
    console.log(`\n✅ Completed in ${(executionTime / 1000).toFixed(2)}s`);

    return {
      case: caseInfo.name,
      type: caseInfo.type,
      success: true,
      output_dir: outputDir,
      execution_time: executionTime,
      event_count: result.events?.length || 0,
    };

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`\n❌ Error: ${error.message}`);

    return {
      case: caseInfo.name,
      type: caseInfo.type,
      success: false,
      error: error.message,
      execution_time: executionTime,
    };
  }
}

async function main() {
  console.log("=" * 80);
  console.log("28개 케이스 전체 검증 시작");
  console.log("=" * 80);
  console.log(`Model: gpt-4o-mini`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log();

  // Load cases
  if (!exists(CASES_JSON)) {
    throw new Error(`Cases file not found: ${CASES_JSON}`);
  }

  const cases: CaseInfo[] = JSON.parse(readText(CASES_JSON));
  console.log(`Total cases: ${cases.length}`);
  console.log(`  - Case numbers: ${cases.filter(c => c.type === "Case").length}`);
  console.log(`  - Named cases: ${cases.filter(c => c.type === "Named").length}`);
  console.log();

  // Ensure output directory
  ensureDir(OUTPUT_DIR);

  // Process each case
  const results: ValidationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const caseInfo = cases[i];
    console.log(`\n[${i + 1}/${cases.length}] Processing: ${caseInfo.name}`);

    const result = await processSingleCase(caseInfo);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay to avoid rate limits
    if (i < cases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("실행 완료");
  console.log("=".repeat(80));
  console.log(`\n총 케이스: ${cases.length}`);
  console.log(`성공: ${successCount} (${(successCount / cases.length * 100).toFixed(1)}%)`);
  console.log(`실패: ${failCount} (${(failCount / cases.length * 100).toFixed(1)}%)`);

  const totalTime = results.reduce((sum, r) => sum + (r.execution_time || 0), 0);
  const avgTime = totalTime / results.length;
  console.log(`\n총 실행 시간: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`평균 실행 시간: ${(avgTime / 1000).toFixed(2)}s/case`);

  const totalEvents = results.reduce((sum, r) => sum + (r.event_count || 0), 0);
  console.log(`\n총 이벤트 생성: ${totalEvents}개`);
  console.log(`평균 이벤트/케이스: ${(totalEvents / successCount).toFixed(1)}개`);

  // Save results
  const resultsPath = path.join(OUTPUT_DIR, "execution_results.json");
  writeText(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 결과 저장: ${resultsPath}`);

  if (failCount > 0) {
    console.log("\n⚠️  실패한 케이스:");
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.case}: ${r.error}`);
    });
  }

  console.log("\n다음 단계:");
  console.log("  1. python3 scripts/validate-dates-28.py");
  console.log("  2. 절대적 기준 분류 (상/중/하)");
  console.log("  3. RCA (근본 원인 분석)");
  console.log();

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
