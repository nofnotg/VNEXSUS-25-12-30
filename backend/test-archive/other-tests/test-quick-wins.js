/**
 * Quick Wins 모듈 테스트 스크립트 (ESM)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import RegexPatterns from './utils/RegexPatterns.js';
import FuzzyMatcher from './utils/FuzzyMatcher.js';
import CrossValidator from './utils/CrossValidator.js';
import ConfidenceScorer from './utils/ConfidenceScorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 통합 추출기
class SimpleHybridExtractor {
    constructor() {
        this.regex = new RegexPatterns();
        this.fuzzy = new FuzzyMatcher();
        this.validator = new CrossValidator();
        this.scorer = new ConfidenceScorer();
    }

    extract(text) {
        if (!text) return { success: false, error: 'No input' };

        const dates = this.regex.extractDates(text);
        const hospitals = this.regex.extractHospitals(text);
        const icdCodes = this.regex.extractICDCodes(text);
        const diagnoses = this.regex.extractDiagnoses(text);

        const validatedHospitals = hospitals.map(h => ({
            ...h,
            fuzzy: this.fuzzy.matchHospital(h.name),
            validation: this.validator.validateHospital(h.name)
        }));

        const validatedICD = icdCodes.map(c => ({
            ...c,
            validation: this.validator.validateICD(c.code)
        }));

        const validatedDates = dates.map(d => this.validator.validateDateRange(d.normalized));

        const scores = [];
        if (validatedHospitals.length) scores.push(validatedHospitals.reduce((s, h) => s + (h.validation?.confidence || 0), 0) / validatedHospitals.length);
        if (validatedICD.length) scores.push(validatedICD.reduce((s, c) => s + (c.validation?.confidence || 0), 0) / validatedICD.length);
        if (validatedDates.length) scores.push(validatedDates.reduce((s, d) => s + (d.confidence || 0), 0) / validatedDates.length);

        const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        return {
            success: true,
            summary: {
                totalDates: dates.length,
                validatedDates: validatedDates.filter(d => d.valid).length,
                totalHospitals: hospitals.length,
                validatedHospitals: validatedHospitals.filter(h => h.validation?.confidence >= 70).length,
                totalICDCodes: icdCodes.length,
                validatedICDCodes: validatedICD.filter(c => c.validation?.confidence >= 70).length,
                totalDiagnoses: diagnoses.length
            },
            confidence: {
                overall,
                level: this.scorer.getLevel(overall),
                requiresReview: overall < 80
            }
        };
    }
}

const extractor = new SimpleHybridExtractor();
const caseSampleDir = path.join(__dirname, '..', 'src', 'rag', 'case_sample');

console.log('='.repeat(60));
console.log('VNEXSUS Quick Wins 정확도 테스트');
console.log('='.repeat(60));

const results = [];
const files = fs.readdirSync(caseSampleDir)
    .filter(f => /^Case\d+\.txt$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

console.log(`발견된 케이스: ${files.length}개\n`);

for (const file of files) {
    const caseName = file.replace('.txt', '');
    const sourceFile = path.join(caseSampleDir, file);

    try {
        const sourceText = fs.readFileSync(sourceFile, 'utf-8');
        const extracted = extractor.extract(sourceText);
        const { summary, confidence } = extracted;

        console.log(`[${caseName}] 날짜:${summary.totalDates} 병원:${summary.totalHospitals} ICD:${summary.totalICDCodes} 진단:${summary.totalDiagnoses} | 신뢰도:${confidence.overall}%`);

        results.push({ case: caseName, ...summary, confidence: confidence.overall });
    } catch (e) {
        console.error(`[${caseName}] 오류: ${e.message}`);
    }
}

const avgConfidence = results.length ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length) : 0;
console.log('\n' + '='.repeat(60));
console.log(`평균 신뢰도: ${avgConfidence}%`);
console.log('='.repeat(60));

fs.writeFileSync(path.join(__dirname, 'quick-wins-result.json'), JSON.stringify({ avgConfidence, results }, null, 2));
console.log('결과 저장: quick-wins-result.json');
