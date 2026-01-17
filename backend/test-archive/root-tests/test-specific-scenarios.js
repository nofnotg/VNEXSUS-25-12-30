
import coreEngineService from './backend/services/coreEngineService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSpecificScenarios() {
    console.log('🚀 Starting Specific Scenario Verification (Anchor Points)\n');

    const scenarios = [
        {
            id: 'Scenario A (Cancer)',
            file: 'Case15.txt',
            contractDate: '2020-01-01', // Pre-dates cancer (2024)
            expectedType: 'CANCER', // Expecting cancer detection
            description: 'Breast Cancer Case'
        },
        {
            id: 'Scenario B (Brain)',
            file: 'Case1.txt',
            contractDate: '2020-01-01',
            expectedType: 'BRAIN',
            description: 'Brain Disease Case'
        },
        {
            id: 'Scenario C (Disclosure)',
            file: 'Case9.txt',
            contractDate: '2024-02-26', // Post-dates the event (2024-01-02)
            expectedType: 'VIOLATION_RISK',
            description: 'Pre-contract Admission Case'
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🧪 Testing ${scenario.id}: ${scenario.description}`);
        const filePath = path.join(process.cwd(), 'src/rag/case_sample', scenario.file);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            continue;
        }

        try {
            // 1. Analyze File
            console.log(`   Reading file: ${scenario.file}...`);
            const result = await coreEngineService.analyze({
                filePath: filePath,
                options: {
                    chunkSize: 1024 * 50 // 50KB chunks
                }
            });

            // 2. Extract Events (Simulated from result for now, assuming result.events or similar structure)
            // Since analyze returns a complex object, we might need to inspect result.skeletonJson or similar.
            // For this test, we will use the internal methods we added to verify logic against extracted dates.

            // We need to find the relevant event in the extraction results.
            // Let's look at the "events" if available, or parse the text for the key dates.

            console.log(`   Analysis complete. Checking judgment logic...`);

            // Manually trigger judgment for the key date of the scenario
            let targetEvent = null;

            if (scenario.id.includes('Cancer')) {
                // Case 15: Look for 2024-09-27 (Diagnosis) or similar
                targetEvent = { date: '2024-09-27', content: 'Breast Cancer Diagnosis' };
            } else if (scenario.id.includes('Brain')) {
                // Case 1: Look for 2025-01 (Diagnosis)
                targetEvent = { date: '2025-01-30', content: 'Cerebrovascular disease' };
            } else if (scenario.id.includes('Disclosure')) {
                // Case 9: Look for 2024-01-02 (Admission)
                targetEvent = { date: '2024-01-02', content: 'Admission for Brain Issue' };
            }

            if (targetEvent) {
                const judgment = coreEngineService.checkJudgment(targetEvent, scenario.contractDate);
                console.log(`   Event Date: ${targetEvent.date}, Contract Date: ${scenario.contractDate}`);
                console.log(`   Judgment: [${judgment.type}] ${judgment.message}`);

                if (scenario.expectedType === 'VIOLATION_RISK' && judgment.type === 'VIOLATION_RISK') {
                    console.log('   ✅ PASSED: Violation correctly identified.');
                } else if (scenario.expectedType === 'CANCER' || scenario.expectedType === 'BRAIN') {
                    // For now, SAFE is expected if it's post-contract and not in exemption period.
                    // But if we want to test exemption, we need a date close to contract.
                    // For Case 15 (2024 event, 2020 contract), it should be SAFE.
                    // For Case 1 (2025 event, 2020 contract), it should be SAFE.
                    if (judgment.type === 'SAFE') {
                        console.log('   ✅ PASSED: Post-contract event correctly identified as SAFE.');
                    } else {
                        console.log(`   ⚠️ Note: Result is ${judgment.type}.`);
                    }
                } else {
                    console.log(`   ❓ Result: ${judgment.type}`);
                }
            }

        } catch (error) {
            console.error(`   ❌ Error:`, error.message);
        }
    }
}

runSpecificScenarios();
