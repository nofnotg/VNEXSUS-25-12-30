import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CoreEngineService from './backend/services/coreEngineService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
    console.log("🚀 Starting Phase 1 Verification: Fact Extraction");

    try {
        // 1. Load Case 1 Raw Text
        const case1Path = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
        if (!fs.existsSync(case1Path)) {
            throw new Error(`Case 1 file not found at ${case1Path}`);
        }
        const rawText = fs.readFileSync(case1Path, 'utf8');
        console.log(`✅ Loaded Case 1 (${rawText.length} bytes)`);

        // 2. Initialize Core Engine
        // Note: CoreEngineService might need dependencies mocked if it does heavy initialization.
        // But for extractDates/extractHospitals which are pure functions (mostly), it should be fine.
        // If the constructor fails due to env vars or DB connections, we might need to mock.
        // Let's try instantiating it.

        // Mocking process.env if needed
        if (!process.env.USE_CORE_ENGINE) process.env.USE_CORE_ENGINE = 'true';

        // CoreEngineService exports a singleton instance by default
        const service = CoreEngineService;

        // 3. Test Date Extraction
        console.log("\n📅 Verifying Date Extraction...");
        const dates = service.extractDates(rawText);
        console.log(`   Extracted ${dates.length} dates.`);
        console.log(`   Sample: ${dates.slice(0, 5).join(', ')}`);

        if (dates.length === 0) {
            console.error("❌ FAILED: No dates extracted!");
        } else {
            console.log("✅ PASSED: Dates extracted successfully.");
        }

        // 4. Test Hospital Extraction
        console.log("\n🏥 Verifying Hospital Extraction...");
        const hospitals = service.extractHospitals(rawText);
        console.log(`   Extracted ${hospitals.length} hospitals.`);
        console.log(`   Sample: ${hospitals.join(', ')}`);

        if (hospitals.some(h => h.includes('강남성심병원'))) {
            console.log("✅ PASSED: '강남성심병원' found and normalized.");
        } else {
            console.warn("⚠️ WARNING: '강남성심병원' not found. Check normalization logic.");
        }

        // 5. Output Results
        const result = {
            caseId: 'Case1',
            dates: dates,
            hospitals: hospitals,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync('phase1_verification_result.json', JSON.stringify(result, null, 2));
        console.log("\n✨ Verification Complete. Results saved to 'phase1_verification_result.json'");

    } catch (error) {
        console.error("❌ Verification Failed:", error);
        console.error(error.stack);
    }
}

runVerification();
