
import coreEngineService from './backend/services/coreEngineService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyVectorModel() {
    console.log('🚀 Starting 3D Vector Model Verification (Anchor Points)\n');

    const scenarios = [
        {
            id: 'Scenario A (Cancer)',
            file: 'Case15.txt',
            contractDate: '2020-01-01',
            expected: {
                xRange: [9, 10], // High Severity
                yRange: [1, 10], // Post-contract
                zRange: [9, 10], // High Certainty (Biopsy/Surgery)
                type: 'PAYMENT_TARGET'
            }
        },
        {
            id: 'Scenario B (Brain)',
            file: 'Case1.txt',
            contractDate: '2020-01-01',
            expected: {
                xRange: [9, 10], // High Severity
                yRange: [1, 10], // Post-contract
                zRange: [7, 10], // High Certainty (MRI/Medication)
                type: 'PAYMENT_TARGET'
            }
        },
        {
            id: 'Scenario C (Disclosure)',
            file: 'Case9.txt',
            contractDate: '2024-02-26',
            expected: {
                xRange: [8, 10], // High Severity (Brain/Vascular)
                yRange: [-10, -1], // Pre-contract
                zRange: [7, 10], // High Certainty (Admission/Angio)
                type: 'VIOLATION_RISK'
            }
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🧪 Testing ${scenario.id}`);
        const filePath = path.join(process.cwd(), 'src/rag/case_sample', scenario.file);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            continue;
        }

        try {
            // Analyze File
            console.log(`   Reading file: ${scenario.file}...`);
            const result = await coreEngineService.analyze({
                filePath: filePath,
                contractDate: scenario.contractDate,
                options: {
                    chunkSize: 1024 * 50
                }
            });

            const vector = result.vectorEvaluation;

            if (!vector) {
                console.error('   ❌ No vector evaluation result found.');
                continue;
            }

            console.log(`   Vector Result: [X=${vector.x}, Y=${vector.y}, Z=${vector.z}]`);
            console.log(`   Vector Type: ${vector.vectorType}`);
            console.log(`   Significant Event: ${vector.significantEvent ? vector.significantEvent.content : 'None'}`);

            if (result.generatedReport) {
                console.log(`   📝 Generated Report Preview:\n${result.generatedReport.substring(0, 200)}...`);
            } else {
                console.log(`   ❌ Generated Report: Missing`);
            }

            // Verify X (Severity)
            if (vector.x >= scenario.expected.xRange[0] && vector.x <= scenario.expected.xRange[1]) {
                console.log(`   ✅ X-Axis (Severity): Passed (${vector.x})`);
            } else {
                console.log(`   ❌ X-Axis (Severity): Failed (Expected ${scenario.expected.xRange[0]}-${scenario.expected.xRange[1]}, Got ${vector.x})`);
            }

            // Verify Y (Temporal)
            if (vector.y >= scenario.expected.yRange[0] && vector.y <= scenario.expected.yRange[1]) {
                console.log(`   ✅ Y-Axis (Temporal): Passed (${vector.y})`);
            } else {
                console.log(`   ❌ Y-Axis (Temporal): Failed (Expected ${scenario.expected.yRange[0]}-${scenario.expected.yRange[1]}, Got ${vector.y})`);
            }

            // Verify Z (Certainty)
            if (vector.z >= scenario.expected.zRange[0] && vector.z <= scenario.expected.zRange[1]) {
                console.log(`   ✅ Z-Axis (Certainty): Passed (${vector.z})`);
            } else {
                console.log(`   ❌ Z-Axis (Certainty): Failed (Expected ${scenario.expected.zRange[0]}-${scenario.expected.zRange[1]}, Got ${vector.z})`);
            }

            // Verify Type
            if (vector.vectorType === scenario.expected.type) {
                console.log(`   ✅ Vector Type: Passed (${vector.vectorType})`);
            } else {
                console.log(`   ❌ Vector Type: Failed (Expected ${scenario.expected.type}, Got ${vector.vectorType})`);
            }

        } catch (error) {
            console.error(`   ❌ Error:`, error.message);
        }
    }
}

verifyVectorModel();
