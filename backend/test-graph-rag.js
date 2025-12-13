/**
 * Phase 3 Graph-RAG 검증 테스트
 * 
 * 45개 케이스 전체에 대해 그래프를 구축하고,
 * 문맥적 질의(Context Query)를 수행하여 답변 정확도를 측정합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import RegexPatterns from './utils/RegexPatterns.js';
import FuzzyMatcher from './utils/FuzzyMatcher.js';
import CrossValidator from './utils/CrossValidator.js';
import ConfidenceScorer from './utils/ConfidenceScorer.js';
import EntityRelationMapper from './utils/EntityRelationMapper.js';
import ContextQueryEngine from './utils/ContextQueryEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 통합 추출기 (HybridExtractor 로직 재사용)
class SimpleHybridExtractor {
    constructor() {
        this.regex = new RegexPatterns();
        this.fuzzy = new FuzzyMatcher();
        this.validator = new CrossValidator();
        this.scorer = new ConfidenceScorer();
    }

    extract(text) {
        if (!text) return { success: false };

        const dates = this.regex.extractDates(text);
        const hospitals = this.regex.extractHospitals(text);
        const icdCodes = this.regex.extractICDCodes(text);
        const diagnoses = this.regex.extractDiagnoses(text);

        // Fuzzy Matching 적용
        const hospitalsMatched = hospitals.map(h => ({ ...h, ...this.fuzzy.matchHospital(h.name) }));
        const diagnosesMatched = diagnoses.map(d => ({ ...d, ...this.fuzzy.matchDiagnosis(d.diagnosis) }));

        return {
            success: true,
            fields: {
                dates,
                hospitals: hospitalsMatched,
                icdCodes,
                diagnoses: diagnosesMatched
            }
        };
    }
}

const extractor = new SimpleHybridExtractor();
const mapper = new EntityRelationMapper();
const caseSampleDir = path.join(__dirname, '..', 'src', 'rag', 'case_sample');

async function runTest() {
    console.log('='.repeat(60));
    console.log('VNEXSUS Phase 3 Graph-RAG 검증 테스트');
    console.log('='.repeat(60));

    const files = fs.readdirSync(caseSampleDir)
        .filter(f => /^Case\d+\.txt$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    console.log(`대상 케이스: ${files.length}개\n`);

    const results = [];
    let totalQueries = 0;
    let successfulQueries = 0;

    for (const file of files) {
        const caseName = file.replace('.txt', '');
        const sourceFile = path.join(caseSampleDir, file);
        const sourceText = fs.readFileSync(sourceFile, 'utf-8');

        // 1. 추출 (Extraction)
        const extracted = extractor.extract(sourceText);

        // 2. 그래프 매핑 (Graph Mapping)
        const graph = mapper.map(extracted);
        const engine = new ContextQueryEngine(graph);

        // 3. 질의 테스트 (Query Testing)
        // 시나리오: 추출된 진단명 중 하나를 골라 "최초 진단일"을 물어봄
        const targetDiagnosis = extracted.fields.diagnoses[0]?.diagnosis; // 첫 번째 진단명
        let queryResult = null;

        if (targetDiagnosis) {
            queryResult = engine.query('FIRST_DIAGNOSIS', { diagnosisName: targetDiagnosis });
            totalQueries++;
            if (queryResult.found) successfulQueries++;
        }

        // 시나리오: 추출된 병원 중 하나를 골라 "방문 이력"을 물어봄
        const targetHospital = extracted.fields.hospitals[0]?.name; // 첫 번째 병원
        let hospResult = null;

        if (targetHospital) {
            hospResult = engine.query('HOSPITAL_HISTORY', { hospitalName: targetHospital });
            totalQueries++;
            if (hospResult.found) successfulQueries++;
        }

        console.log(`[${caseName}] Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
        if (targetDiagnosis) console.log(`  Q: "${targetDiagnosis}" 최초 진단일? -> ${queryResult.found ? queryResult.date : 'Not Found'}`);
        if (targetHospital) console.log(`  Q: "${targetHospital}" 방문 이력? -> ${hospResult.found ? hospResult.count + '회' : 'Not Found'}`);

        results.push({
            case: caseName,
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            queries: {
                diagnosis: { q: targetDiagnosis, r: queryResult },
                hospital: { q: targetHospital, r: hospResult }
            }
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`총 질의: ${totalQueries}건`);
    console.log(`성공 답변: ${successfulQueries}건`);
    console.log(`질의 성공률: ${totalQueries > 0 ? Math.round(successfulQueries / totalQueries * 100) : 0}%`);
    console.log('='.repeat(60));

    fs.writeFileSync(path.join(__dirname, 'phase3-test-result.json'), JSON.stringify({
        testedAt: new Date().toISOString(),
        summary: { totalQueries, successfulQueries, successRate: Math.round(successfulQueries / totalQueries * 100) },
        results
    }, null, 2));
    console.log('결과 저장: phase3-test-result.json');
}

runTest().catch(console.error);
