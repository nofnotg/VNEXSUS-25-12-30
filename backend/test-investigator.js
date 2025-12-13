/**
 * Phase 4 Investigator AI 검증 테스트
 * 
 * Reasoning Engine과 Investigation Reporter를 사용하여
 * 복합적인 조사 시나리오(고지의무 위반, 의료쇼핑, 진행성)를 검증합니다.
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

// 통합 추출기 (HybridExtractor 로직 재사용)
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

async function runTest() {
    console.log('='.repeat(60));
    console.log('VNEXSUS Phase 4 Investigator AI 검증 테스트');
    console.log('='.repeat(60));

    // 테스트용 시나리오 케이스 선택
    // Case 1: 고지의무 위반 테스트 (가입일: 2025-03-01로 가정 -> 2025-02-18 진단 발견되어야 함)
    await testScenario('Case1', '2025-03-01', 'Other specified cerebrovascular diseases');

    // Case 9: 의료쇼핑 테스트 (대림성모병원 등 다수 방문 예상)
    await testScenario('Case9', '2025-01-01', '고지혈증');

    // Case 4: 진행성 질환 테스트 (Ascending colon cancer)
    await testScenario('Case4', '2025-01-01', 'Ascending colon cancer');
}

async function testScenario(caseName, contractDate, targetDiagnosis) {
    console.log(`\n[Testing ${caseName}] Scenario: Contract Date ${contractDate}, Target: ${targetDiagnosis}`);

    const sourceFile = path.join(caseSampleDir, `${caseName}.txt`);
    if (!fs.existsSync(sourceFile)) {
        console.log('File not found, skipping.');
        return;
    }

    const sourceText = fs.readFileSync(sourceFile, 'utf-8');

    // 1. 추출 & 그래프 매핑
    const extracted = extractor.extract(sourceText);
    const graph = mapper.map(extracted);

    // 2. 추론 (Reasoning)
    const engine = new ReasoningEngine(graph);
    const reasoningResult = engine.investigate({
        targetDiagnosis: targetDiagnosis,
        contractDate: contractDate,
        shoppingThreshold: 2 // 테스트를 위해 낮게 설정
    });

    // 3. 보고서 생성 (Reporting)
    const report = reporter.generateReport(reasoningResult, { caseId: caseName });

    // 결과 출력
    console.log(`- Risk Level: ${report.riskLevel}`);
    console.log(`- Summary: ${report.summary}`);

    if (report.details.disclosure.hasViolation) {
        console.log(`  ⚠️ Disclosure Violation: Found ${report.details.disclosure.violationCount} records.`);
        report.details.disclosure.violations.forEach(v => {
            console.log(`    -> [${v.date}] ${v.hospital}: ${v.details}`);
        });
    }

    if (report.details.doctorShopping.isSuspicious) {
        console.log(`  🏥 Doctor Shopping: Max ${report.details.doctorShopping.maxHospitals} hospitals in 30 days.`);
    }

    if (report.details.progressivity.status === 'PROGRESSIVE/CHRONIC') {
        console.log(`  📈 Progressivity: Confirmed (${report.details.progressivity.timeline})`);
    }

    // 결과 저장
    const resultPath = path.join(__dirname, `investigation_${caseName}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
}

runTest().catch(console.error);
