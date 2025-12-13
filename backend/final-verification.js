/**
 * VNEXSUS Final Project Verification
 * 
 * 모든 파이프라인(Extraction -> Graph -> Reasoning -> Reporting)을
 * 전체 케이스(Case1 ~ Case46)에 대해 실행하고,
 * 시스템의 안정성과 데이터 커버리지를 검증합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import RegexPatterns from './utils/RegexPatterns.js';
import FuzzyMatcher from './utils/FuzzyMatcher.js';
import CrossValidator from './utils/CrossValidator.js';
import ConfidenceScorer from './utils/ConfidenceScorer.js';
import EntityRelationMapper from './utils/EntityRelationMapper.js';
import ReasoningEngine from './utils/ReasoningEngine.js';
import InvestigationReporter from './utils/InvestigationReporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 통합 추출기
class SimpleHybridExtractor {
    constructor() {
        this.regex = new RegexPatterns();
        this.fuzzy = new FuzzyMatcher();
    }

    extract(text) {
        if (!text) return { success: false };
        const dates = this.regex.extractDates(text);
        const hospitals = this.regex.extractHospitals(text);
        const icdCodes = this.regex.extractICDCodes(text);
        const diagnoses = this.regex.extractDiagnoses(text);

        const hospitalsMatched = hospitals.map(h => ({ ...h, ...this.fuzzy.matchHospital(h.name) }));
        const diagnosesMatched = diagnoses.map(d => ({ ...d, ...this.fuzzy.matchDiagnosis(d.diagnosis) }));

        return {
            success: true,
            fields: { dates, hospitals: hospitalsMatched, icdCodes, diagnoses: diagnosesMatched }
        };
    }
}

const extractor = new SimpleHybridExtractor();
const mapper = new EntityRelationMapper();
const reporter = new InvestigationReporter();
const caseSampleDir = path.join(__dirname, '..', 'src', 'rag', 'case_sample');

async function runFinalVerification() {
    console.log('='.repeat(60));
    console.log('VNEXSUS Final Project Verification');
    console.log('='.repeat(60));

    const files = fs.readdirSync(caseSampleDir)
        .filter(f => /^Case\d+\.txt$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    console.log(`Total Cases: ${files.length}`);

    const results = [];
    let totalNodes = 0;
    let totalRisks = 0;
    let successCount = 0;

    for (const file of files) {
        const caseName = file.replace('.txt', '');
        const sourceFile = path.join(caseSampleDir, file);
        const reportFile = path.join(caseSampleDir, `${caseName}_report.txt`);

        const sourceText = fs.readFileSync(sourceFile, 'utf-8');
        const reportText = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, 'utf-8') : '';

        try {
            // 1. Extraction
            const extracted = extractor.extract(sourceText);

            // 2. Graph Mapping
            const graph = mapper.map(extracted);
            totalNodes += graph.nodes.length;

            // 3. Reasoning (Simulation)
            // 가입일을 2025-01-01로 가정하여 일괄 테스트
            const engine = new ReasoningEngine(graph);
            const reasoningResult = engine.investigate({
                targetDiagnosis: extracted.fields.diagnoses[0]?.diagnosis,
                contractDate: '2025-01-01',
                shoppingThreshold: 3
            });

            // 4. Reporting
            const report = reporter.generateReport(reasoningResult, { caseId: caseName });

            if (report.riskLevel === 'HIGH' || report.riskLevel === 'MEDIUM') {
                totalRisks++;
            }

            // 5. Verification against Ground Truth (Simple Keyword Match)
            // 추출된 진단명이 실제 리포트(CaseX_report.txt)에 포함되어 있는지 확인
            let matchCount = 0;
            extracted.fields.diagnoses.forEach(d => {
                if (reportText.includes(d.diagnosis)) matchCount++;
            });
            const coverage = extracted.fields.diagnoses.length > 0 ? (matchCount / extracted.fields.diagnoses.length) : 0;

            results.push({
                case: caseName,
                nodes: graph.nodes.length,
                riskLevel: report.riskLevel,
                diagnosisCount: extracted.fields.diagnoses.length,
                matchCount: matchCount,
                coverage: coverage
            });

            successCount++;
            process.stdout.write('.'); // Progress indicator

        } catch (error) {
            console.error(`\nError processing ${caseName}:`, error.message);
            results.push({ case: caseName, error: error.message });
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Processing Complete.`);
    console.log(`- Success Rate: ${Math.round(successCount / files.length * 100)}%`);
    console.log(`- Total Graph Nodes: ${totalNodes}`);
    console.log(`- High/Medium Risk Cases Detected: ${totalRisks}`);
    console.log('='.repeat(60));

    // Save detailed results
    fs.writeFileSync(path.join(__dirname, 'final-verification-result.json'), JSON.stringify(results, null, 2));
    console.log('Saved detailed results to final-verification-result.json');
}

runFinalVerification().catch(console.error);
