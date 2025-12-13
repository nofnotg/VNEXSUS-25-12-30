import CoreEngineService from './backend/services/coreEngineService.js';

async function runPhase2Verification() {
    console.log("🚀 Starting Phase 2 Verification: Judgment Logic");

    try {
        const service = CoreEngineService;
        const contractDate = "2024-01-01";

        console.log(`📅 Contract Date: ${contractDate}`);

        // Test Case 1: Pre-contract Diagnosis (Violation Risk)
        const event1 = {
            date: "2023-12-01",
            content: { diagnosis: "고혈압 진단" }
        };
        console.log(`\n🧪 Test 1: Pre-contract Event (${event1.date})`);
        const result1 = service.checkJudgment(event1, contractDate);
        console.log(`   Result: [${result1.type}] ${result1.message}`);

        if (result1.type === 'VIOLATION_RISK' && result1.dDay < 0) {
            console.log("✅ PASSED: Correctly identified pre-contract violation risk.");
        } else {
            console.error("❌ FAILED: Failed to identify pre-contract risk.");
        }

        // Test Case 2: Cancer Diagnosis within 90 days (Exemption)
        const event2 = {
            date: "2024-02-01", // +31 days
            content: { diagnosis: "위암 진단" } // Keyword "암"
        };
        console.log(`\n🧪 Test 2: Cancer Diagnosis within 90 days (${event2.date})`);
        const result2 = service.checkJudgment(event2, contractDate);
        console.log(`   Result: [${result2.type}] ${result2.message}`);

        if (result2.type === 'EXEMPTION') {
            console.log("✅ PASSED: Correctly identified cancer exemption period.");
        } else {
            console.error("❌ FAILED: Failed to identify cancer exemption.");
        }

        // Test Case 3: Safe Event
        const event3 = {
            date: "2024-06-01", // +150 days
            content: { diagnosis: "감기" }
        };
        console.log(`\n🧪 Test 3: Safe Event (${event3.date})`);
        const result3 = service.checkJudgment(event3, contractDate);
        console.log(`   Result: [${result3.type}] ${result3.message}`);

        if (result3.type === 'SAFE') {
            console.log("✅ PASSED: Correctly identified safe event.");
        } else {
            console.error("❌ FAILED: Failed to identify safe event.");
        }

    } catch (error) {
        console.error("❌ Verification Failed:", error);
        console.error(error.stack);
    }
}

runPhase2Verification();
