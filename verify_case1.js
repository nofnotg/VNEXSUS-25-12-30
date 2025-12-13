import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyCase1() {
    try {
        const case1Path = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
        console.log(`Reading Case1 from: ${case1Path}`);

        if (!fs.existsSync(case1Path)) {
            throw new Error(`File not found: ${case1Path}`);
        }

        const case1Text = fs.readFileSync(case1Path, 'utf8');
        console.log(`Read ${case1Text.length} characters.`);

        console.log('Sending to API...');
        const response = await fetch('http://localhost:3030/api/generate-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: case1Text,
                sessionId: 'verify_case1_' + Date.now(),
                options: {
                    skipLLM: false,
                    useNineItem: true,
                    enableTranslationEnhancement: true
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('API Response received.');

        // Save full JSON result
        fs.writeFileSync('Case1_verification_result.json', JSON.stringify(result, null, 2));
        console.log('Saved Case1_verification_result.json');

        // Extract and save report text
        let reportText = '';
        if (result.processedText) {
            reportText = result.processedText;
        } else if (result.skeletonJson) {
            reportText = JSON.stringify(result.skeletonJson, null, 2);
        } else {
            reportText = "No processed text or skeleton JSON found.";
        }

        fs.writeFileSync('Case1_verification_report.txt', reportText);
        console.log('Saved Case1_verification_report.txt');

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyCase1();
