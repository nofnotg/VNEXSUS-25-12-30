/**
 * Report Subset Validator
 * 
 * 목적: "report ⊆ vnexsus" 자동 검증
 * - Report에 있는 핵심 정보(날짜/ICD/병원)가 VNEXSUS 결과에 포함되는지 확인
 * - 누락 항목 리포트 생성
 * - 베이스라인 메트릭 측정
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeHospitalName as normalizeHospitalShared, extractHospitalNormalized, extractIcdCodes } from '../../src/shared/utils/medicalText.js';
import { HOSPITAL_STOPWORDS } from '../../src/shared/constants/medicalNormalization.js';

class ReportSubsetValidator {
    constructor(options = {}) {
        this.options = {
            dateMatchThreshold: options.dateMatchThreshold || 0.95,
            icdMatchThreshold: options.icdMatchThreshold || 0.95,
            hospitalMatchThreshold: options.hospitalMatchThreshold || 0.60,
            dateToleranceDays: options.dateToleranceDays || 3,
            ...options
        };

        this.results = {
            totalCases: 0,
            casesWithBoth: 0,
            dateMatchRate: 0,
            icdMatchRate: 0,
            hospitalMatchRate: 0,
            missingEvents: [],
            summary: {}
        };
    }

    /**
     * 날짜 추출 (YYYY-MM-DD 형식)
     */
    extractDates(text) {
        if (!text) return [];

        const datePatterns = [
            /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/g,  // 2024-04-09, 2024.04.09
            /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
            /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g  // 2024년 4월 9일
        ];

        const dates = new Set();

        datePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const year = match[1];
                const month = match[2].padStart(2, '0');
                const day = match[3].padStart(2, '0');
                dates.add(`${year}-${month}-${day}`);
            }
        });

        return Array.from(dates).sort();
    }

    /**
     * ICD/KCD 코드 추출
     */
    extractICDCodes(text) {
        if (!text) return [];
        return extractIcdCodes(text);
    }

    /**
     * 병원명 추출 및 정규화
     */
    extractHospitals(text) {
        if (!text) return [];
        const hospitalKeywords = ['병원','의원','클리닉','센터','한의원','치과'];
        const hospitals = new Set();
        const lines = text.split('\n');
        lines.forEach(line => {
            hospitalKeywords.forEach(keyword => {
                if (line.includes(keyword)) {
                    const name = extractHospitalNormalized(line);
                    const hospitalName = this.normalizeHospitalName(name);
                    if (hospitalName) hospitals.add(hospitalName);
                }
            });
        });
        return Array.from(hospitals).sort();
    }

    /**
     * 병원명 정규화
     */
    normalizeHospitalName(name) {
        if (!name) return '';
        const norm = normalizeHospitalShared(String(name));
        if (!norm) return '';
        const base = norm.trim();
        const suffixOnly = ['병원','의원','클리닉','센터','한의원','치과'];
        if (!base || suffixOnly.includes(base)) return '';
        if (HOSPITAL_STOPWORDS.includes(base)) return '';
        return base;
    }

    tokenizeHospital(name) {
        const n = this.normalizeHospitalName(name);
        if (!n) return [];
        return n
            .replace(/병원|의원|클리닉|센터|한의원|치과/g, '')
            .split(/[^가-힣a-z0-9]+/)
            .filter(Boolean);
    }

    jaccardTokens(a, b) {
        const ta = new Set(this.tokenizeHospital(a));
        const tb = new Set(this.tokenizeHospital(b));
        if (ta.size === 0 || tb.size === 0) return 0;
        let inter = 0;
        for (const t of ta) if (tb.has(t)) inter += 1;
        const union = new Set([...ta, ...tb]).size;
        return union ? inter / union : 0;
    }

    /**
     * 날짜 매칭
     */
    matchDates(reportDates, vnexsusDates) {
        const matched = [];
        const missing = [];

        const parseDate = (s) => {
            const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return null;
            const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
            return Number.isFinite(d.getTime()) ? d : null;
        };
        const toEpochDay = (d) => Math.floor(d.getTime() / 86400000);
        const vnDays = new Set(
            vnexsusDates
                .map(parseDate)
                .filter(Boolean)
                .map(toEpochDay)
        );
        const tol = Math.max(0, Math.floor(this.options.dateToleranceDays));
        for (const rd of reportDates) {
            const d = parseDate(rd);
            if (!d) { missing.push(rd); continue; }
            const day = toEpochDay(d);
            let ok = vnDays.has(day);
            if (!ok && tol > 0) {
                for (let k = -tol; k <= tol; k++) {
                    if (vnDays.has(day + k)) { ok = true; break; }
                }
            }
            if (ok) matched.push(rd); else missing.push(rd);
        }

        const matchRate = reportDates.length > 0
            ? matched.length / reportDates.length
            : 1.0;

        return { matched, missing, matchRate };
    }

    /**
     * ICD 코드 매칭 (prefix 매칭 포함)
     */
    matchICDCodes(reportCodes, vnexsusCodes) {
        const matched = [];
        const missing = [];
        const toNorm = (s) => {
            const x = String(s || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
            if (/^[A-Z][0-9]{2}(?:\.[0-9]{1,2})?$/.test(x)) return x;
            const m = x.match(/^([A-Z])([0-9]{2})([0-9]{1,2})$/);
            if (m) return `${m[1]}${m[2]}.${m[3]}`;
            return x.replace(/\.+/, '.');
        };
        const vnNormSet = new Set(vnexsusCodes.map(toNorm));
        reportCodes.forEach(code => {
            const rc = toNorm(code);
            if (vnNormSet.has(rc)) {
                matched.push(rc);
                return;
            }
            const hasPrefix = Array.from(vnNormSet).some(v =>
                rc.startsWith(v) || v.startsWith(rc)
            );
            if (hasPrefix) matched.push(rc); else missing.push(rc);
        });
        const matchRate = reportCodes.length > 0 ? matched.length / reportCodes.length : 1.0;
        return { matched, missing, matchRate };
    }

    /**
     * 병원 매칭
     */
    matchHospitals(reportHospitals, vnexsusHospitals) {
        const matched = [];
        const missing = [];

        const normalizedVnexsus = vnexsusHospitals.map(h => this.normalizeHospitalName(h));

        reportHospitals.forEach(reportHospital => {
            const normalized = this.normalizeHospitalName(reportHospital);

            if (normalizedVnexsus.includes(normalized)) {
                matched.push(reportHospital);
            } else {
                const ok = normalizedVnexsus.some(v => this.jaccardTokens(normalized, v) >= this.options.hospitalMatchThreshold);
                if (ok) matched.push(reportHospital); else missing.push(reportHospital);
            }
        });

        const matchRate = reportHospitals.length > 0
            ? matched.length / reportHospitals.length
            : 1.0;

        return { matched, missing, matchRate };
    }

    /**
     * 단일 케이스 검증
     */
    validateCase(caseId, reportText, vnexsusText) {
        // 데이터 추출
        const reportDates = this.extractDates(reportText);
        const reportICDs = this.extractICDCodes(reportText);
        const reportHospitals = this.extractHospitals(reportText);

        const vnexsusDates = this.extractDates(vnexsusText);
        const vnexsusICDs = this.extractICDCodes(vnexsusText);
        const vnexsusHospitals = this.extractHospitals(vnexsusText);

        // 매칭
        const dateMatch = this.matchDates(reportDates, vnexsusDates);
        const icdMatch = this.matchICDCodes(reportICDs, vnexsusICDs);
        const hospitalMatch = this.matchHospitals(reportHospitals, vnexsusHospitals);

        const result = {
            caseId,
            report: {
                dates: reportDates,
                icds: reportICDs,
                hospitals: reportHospitals
            },
            vnexsus: {
                dates: vnexsusDates,
                icds: vnexsusICDs,
                hospitals: vnexsusHospitals
            },
            matching: {
                dates: dateMatch,
                icds: icdMatch,
                hospitals: hospitalMatch
            },
            hasMissing: dateMatch.missing.length > 0 ||
                icdMatch.missing.length > 0 ||
                hospitalMatch.missing.length > 0
        };

        return result;
    }

    /**
     * 전체 케이스 검증
     */
    async validateAll(casesDir) {
        console.log('🔍 Report Subset Validator 시작...\n');

        if (!fs.existsSync(casesDir)) {
            throw new Error(`케이스 디렉토리를 찾을 수 없습니다: ${casesDir}`);
        }

        const dirents = fs.readdirSync(casesDir, { withFileTypes: true });
        const hasDirs = dirents.some(d => d.isDirectory());
        let cases = [];
        let filePairs = [];

        if (hasDirs) {
            cases = dirents.filter(d => d.isDirectory()).map(d => d.name);
        } else {
            const reports = dirents
                .filter(d => d.isFile())
                .map(d => d.name)
                .filter(n => /Case\d+_report\.txt$/i.test(n));
            const vnexsus = new Set(
                dirents
                    .filter(d => d.isFile())
                    .map(d => d.name)
                    .filter(n => /Case\d+_vne[x|s]sus\.txt$/i.test(n) || /Case\d+_vnexus\.txt$/i.test(n))
            );
            filePairs = reports
                .map(r => {
                    const id = (r.match(/Case(\d+)_report\.txt/i) || [])[1];
                    if (!id) return null;
                    const vnNameCandidates = [
                        `Case${id}_vnexsus.txt`,
                        `Case${id}_vnexus.txt`,
                        `Case${id}_vnesus.txt`
                    ];
                    const vnFile = vnNameCandidates.find(n => vnexsus.has(n));
                    if (!vnFile) return null;
                    return { caseId: `Case${id}`, reportPath: path.join(casesDir, r), vnexsusPath: path.join(casesDir, vnFile) };
                })
                .filter(Boolean);
        }

        console.log(`📁 총 ${hasDirs ? cases.length : filePairs.length}개 케이스 발견\n`);

        const validationResults = [];
        let totalDateMatchRate = 0;
        let totalICDMatchRate = 0;
        let totalHospitalMatchRate = 0;
        let casesWithBoth = 0;

        if (hasDirs) {
            for (const caseId of cases) {
                const caseDir = path.join(casesDir, caseId);
                const reportPath = path.join(caseDir, 'report.txt');
                const vnexsusPath = path.join(caseDir, 'vnexsus.txt');

                if (!fs.existsSync(reportPath) || !fs.existsSync(vnexsusPath)) {
                    console.log(`⏭️  ${caseId}: report 또는 vnexsus 파일 없음 (건너뜀)`);
                    continue;
                }

                casesWithBoth++;

                const reportText = fs.readFileSync(reportPath, 'utf-8');
                const vnexsusText = fs.readFileSync(vnexsusPath, 'utf-8');

                const result = this.validateCase(caseId, reportText, vnexsusText);
                validationResults.push(result);

                totalDateMatchRate += result.matching.dates.matchRate;
                totalICDMatchRate += result.matching.icds.matchRate;
                totalHospitalMatchRate += result.matching.hospitals.matchRate;

                const status = result.hasMissing ? '❌' : '✅';
                console.log(`${status} ${caseId}:`);
                console.log(`   날짜: ${result.matching.dates.matched.length}/${result.report.dates.length} (${(result.matching.dates.matchRate * 100).toFixed(1)}%)`);
                console.log(`   ICD: ${result.matching.icds.matched.length}/${result.report.icds.length} (${(result.matching.icds.matchRate * 100).toFixed(1)}%)`);
                console.log(`   병원: ${result.matching.hospitals.matched.length}/${result.report.hospitals.length} (${(result.matching.hospitals.matchRate * 100).toFixed(1)}%)`);

                if (result.hasMissing) {
                    if (result.matching.dates.missing.length > 0) {
                        console.log(`   누락 날짜: ${result.matching.dates.missing.join(', ')}`);
                    }
                    if (result.matching.icds.missing.length > 0) {
                        console.log(`   누락 ICD: ${result.matching.icds.missing.join(', ')}`);
                    }
                    if (result.matching.hospitals.missing.length > 0) {
                        console.log(`   누락 병원: ${result.matching.hospitals.missing.join(', ')}`);
                    }
                }
                console.log('');
            }
        } else {
            for (const pair of filePairs) {
                const { caseId, reportPath, vnexsusPath } = pair;
                if (!fs.existsSync(reportPath) || !fs.existsSync(vnexsusPath)) {
                    console.log(`⏭️  ${caseId}: report 또는 vnexsus 파일 없음 (건너뜀)`);
                    continue;
                }
                casesWithBoth++;
                const reportText = fs.readFileSync(reportPath, 'utf-8');
                const vnexsusText = fs.readFileSync(vnexsusPath, 'utf-8');
                const result = this.validateCase(caseId, reportText, vnexsusText);
                validationResults.push(result);
                totalDateMatchRate += result.matching.dates.matchRate;
                totalICDMatchRate += result.matching.icds.matchRate;
                totalHospitalMatchRate += result.matching.hospitals.matchRate;
                const status = result.hasMissing ? '❌' : '✅';
                console.log(`${status} ${caseId}:`);
                console.log(`   날짜: ${result.matching.dates.matched.length}/${result.report.dates.length} (${(result.matching.dates.matchRate * 100).toFixed(1)}%)`);
                console.log(`   ICD: ${result.matching.icds.matched.length}/${result.report.icds.length} (${(result.matching.icds.matchRate * 100).toFixed(1)}%)`);
                console.log(`   병원: ${result.matching.hospitals.matched.length}/${result.report.hospitals.length} (${(result.matching.hospitals.matchRate * 100).toFixed(1)}%)`);
                if (result.hasMissing) {
                    if (result.matching.dates.missing.length > 0) {
                        console.log(`   누락 날짜: ${result.matching.dates.missing.join(', ')}`);
                    }
                    if (result.matching.icds.missing.length > 0) {
                        console.log(`   누락 ICD: ${result.matching.icds.missing.join(', ')}`);
                    }
                    if (result.matching.hospitals.missing.length > 0) {
                        console.log(`   누락 병원: ${result.matching.hospitals.missing.join(', ')}`);
                    }
                }
                console.log('');
            }
        }

        // 전체 통계
        this.results = {
            totalCases: hasDirs ? cases.length : filePairs.length,
            casesWithBoth,
            dateMatchRate: casesWithBoth > 0 ? totalDateMatchRate / casesWithBoth : 0,
            icdMatchRate: casesWithBoth > 0 ? totalICDMatchRate / casesWithBoth : 0,
            hospitalMatchRate: casesWithBoth > 0 ? totalHospitalMatchRate / casesWithBoth : 0,
            validationResults,
            missingEvents: validationResults.filter(r => r.hasMissing),
            timestamp: new Date().toISOString()
        };

        return this.results;
    }

    enrichWithLabels(result) {
        const totalItems =
            (result.report.dates?.length || 0) +
            (result.report.icds?.length || 0) +
            (result.report.hospitals?.length || 0);
        const matchedItems =
            (result.matching.dates?.matched.length || 0) +
            (result.matching.icds?.matched.length || 0) +
            (result.matching.hospitals?.matched.length || 0);
        const labelScore = totalItems > 0 ? matchedItems / totalItems : 1.0;
        return {
            ...result,
            labels: {
                dateInReport: result.matching.dates.matched,
                icdInReport: result.matching.icds.matched,
                hospitalInReport: result.matching.hospitals.matched
            },
            labelScore
        };
    }

    generateHTMLReport(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const pct = (v) => `${(v * 100).toFixed(1)}%`;
        const rows = this.results.validationResults.map(r => {
            const e = this.enrichWithLabels(r);
            return `
            <tr>
              <td>${e.caseId}</td>
              <td>${pct(e.matching.dates.matchRate)}</td>
              <td>${pct(e.matching.icds.matchRate)}</td>
              <td>${pct(e.matching.hospitals.matchRate)}</td>
              <td>${pct(e.labelScore)}</td>
              <td>${e.labels.dateInReport.join(', ') || '-'}</td>
              <td>${e.labels.icdInReport.join(', ') || '-'}</td>
              <td>${e.labels.hospitalInReport.join(', ') || '-'}</td>
            </tr>`;
        }).join('\n');
        const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Report ⊆ VNEXSUS 검증 리포트</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#0f172a;margin:0}
.wrap{max-width:1100px;margin:0 auto;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.hd{background:linear-gradient(135deg,#334155,#0ea5e9);color:#fff;padding:20px}
.hd h1{margin:0;font-size:20px}
.meta{font-size:12px;opacity:.9;margin-top:4px}
.ct{padding:16px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#fff}
.bar{height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-top:6px}
.bar>span{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#84cc16);width:0%}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px;vertical-align:top}
.muted{color:#64748b;font-size:12px}
</style></head><body>
<div class="wrap">
 <div class="hd"><h1>Report ⊆ VNEXSUS 검증 리포트</h1>
 <div class="meta">생성 시각: ${new Date(this.results.timestamp || Date.now()).toLocaleString('ko-KR')}</div></div>
 <div class="ct">
  <div class="cards">
   <div class="card">
     <div>평균 날짜 매칭률: ${pct(this.results.dateMatchRate)}</div>
     <div class="bar"><span style="width:${pct(this.results.dateMatchRate)}"></span></div>
     <div style="margin-top:6px">평균 ICD 매칭률: ${pct(this.results.icdMatchRate)}</div>
     <div class="bar"><span style="width:${pct(this.results.icdMatchRate)}"></span></div>
     <div style="margin-top:6px">평균 병원 매칭률: ${pct(this.results.hospitalMatchRate)}</div>
     <div class="bar"><span style="width:${pct(this.results.hospitalMatchRate)}"></span></div>
   </div>
   <div class="card">
     <div>총 케이스: ${this.results.totalCases}</div>
     <div>검증 케이스: ${this.results.casesWithBoth}</div>
     <div>누락 있는 케이스: ${this.results.missingEvents.length}</div>
     <div class="muted" style="margin-top:6px">목표: 날짜/ICD 95%+, 병원 80%+</div>
   </div>
  </div>
  <table>
   <thead><tr>
    <th>케이스</th><th>날짜</th><th>ICD</th><th>병원</th><th>LabelScore</th>
    <th>날짜 포함</th><th>ICD 포함</th><th>병원 포함</th>
   </tr></thead>
   <tbody>${rows}</tbody>
  </table>
 </div>
</div>
</body></html>`;
        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`📄 HTML 리포트 저장: ${outputPath}`);
    }

    generateLabelingStatsHTML(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const results = this.results.validationResults;
        let dateMatched = 0, dateTotal = 0;
        let icdMatched = 0, icdTotal = 0;
        let hospMatched = 0, hospTotal = 0;
        const missDate = new Map();
        const missICD = new Map();
        const missHosp = new Map();
        const scores = [];
        results.forEach(r => {
            dateMatched += r.matching.dates.matched.length;
            dateTotal += r.report.dates.length;
            icdMatched += r.matching.icds.matched.length;
            icdTotal += r.report.icds.length;
            hospMatched += r.matching.hospitals.matched.length;
            hospTotal += r.report.hospitals.length;
            r.matching.dates.missing.forEach(v => missDate.set(v, (missDate.get(v) || 0) + 1));
            r.matching.icds.missing.forEach(v => missICD.set(v, (missICD.get(v) || 0) + 1));
            r.matching.hospitals.missing.forEach(v => missHosp.set(v, (missHosp.get(v) || 0) + 1));
            const e = this.enrichWithLabels(r);
            scores.push(e.labelScore);
        });
        const avgDate = dateTotal ? dateMatched / dateTotal : 1;
        const avgICD = icdTotal ? icdMatched / icdTotal : 1;
        const avgHosp = hospTotal ? hospMatched / hospTotal : 1;
        const sortedScores = scores.slice().sort((a, b) => a - b);
        const q = (p) => sortedScores.length ? sortedScores[Math.floor((sortedScores.length - 1) * p)] : 0;
        const p50 = q(0.5), p95 = q(0.95);
        const pct = (v) => `${(v * 100).toFixed(1)}%`;
        const topN = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topDate = topN(missDate).map(([k, c]) => `<tr><td>${k}</td><td>${c}</td></tr>`).join('');
        const topICD = topN(missICD).map(([k, c]) => `<tr><td>${k}</td><td>${c}</td></tr>`).join('');
        const topHosp = topN(missHosp).map(([k, c]) => `<tr><td>${k}</td><td>${c}</td></tr>`).join('');
        const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>Event 라벨링 통계</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#0f172a;margin:0}
.wrap{max-width:1100px;margin:0 auto;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.hd{background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#fff;padding:20px}
.hd h1{margin:0;font-size:20px}
.meta{font-size:12px;opacity:.9;margin-top:4px}
.ct{padding:16px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#fff}
.bar{height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-top:6px}
.bar>span{display:block;height:100%;background:linear-gradient(90deg,#0ea5e9,#22c55e);width:0%}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px;vertical-align:top}
.muted{color:#64748b;font-size:12px}
</style></head><body>
<div class="wrap">
 <div class="hd"><h1>Event 라벨링 통계</h1>
 <div class="meta">생성 시각: ${new Date(this.results.timestamp || Date.now()).toLocaleString('ko-KR')}</div></div>
 <div class="ct">
  <div class="cards">
   <div class="card">
     <div>평균 날짜 포함률: ${pct(avgDate)}</div>
     <div class="bar"><span style="width:${pct(avgDate)}"></span></div>
     <div style="margin-top:6px">평균 ICD 포함률: ${pct(avgICD)}</div>
     <div class="bar"><span style="width:${pct(avgICD)}"></span></div>
     <div style="margin-top:6px">평균 병원 포함률: ${pct(avgHosp)}</div>
     <div class="bar"><span style="width:${pct(avgHosp)}"></span></div>
   </div>
   <div class="card">
     <div>LabelScore 평균: ${pct(scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 1)}</div>
     <div>LabelScore 분포 P50: ${pct(p50)} · P95: ${pct(p95)}</div>
     <div class="muted" style="margin-top:6px">목표: 날짜/ICD 95%+, 병원 80%+</div>
   </div>
  </div>
  <div class="cards" style="margin-top:12px">
   <div class="card">
     <div>Top 누락 날짜</div>
     <table><thead><tr><th>날짜</th><th>빈도</th></tr></thead><tbody>${topDate}</tbody></table>
   </div>
   <div class="card">
     <div>Top 누락 ICD</div>
     <table><thead><tr><th>코드</th><th>빈도</th></tr></thead><tbody>${topICD}</tbody></table>
   </div>
  </div>
  <div class="card" style="margin-top:12px">
     <div>Top 누락 병원</div>
     <table><thead><tr><th>병원</th><th>빈도</th></tr></thead><tbody>${topHosp}</tbody></table>
  </div>
 </div>
</div>
</body></html>`;
        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`📄 Event 라벨링 HTML 저장: ${outputPath}`);
    }

    /**
     * 결과 저장
     */
    saveResults(outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2), 'utf-8');
        console.log(`\n💾 결과 저장: ${outputPath}`);
    }

    /**
     * 요약 리포트 출력
     */
    printSummary() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Report Subset Validation 요약');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`총 케이스: ${this.results.totalCases}`);
        console.log(`검증 케이스 (report + vnexsus 모두 존재): ${this.results.casesWithBoth}\n`);

        console.log(`평균 날짜 매칭률: ${(this.results.dateMatchRate * 100).toFixed(1)}%`);
        console.log(`평균 ICD 매칭률: ${(this.results.icdMatchRate * 100).toFixed(1)}%`);
        console.log(`평균 병원 매칭률: ${(this.results.hospitalMatchRate * 100).toFixed(1)}%\n`);

        const failedCases = this.results.missingEvents.length;
        const passRate = this.results.casesWithBoth > 0
            ? ((this.results.casesWithBoth - failedCases) / this.results.casesWithBoth * 100).toFixed(1)
            : 0;

        console.log(`누락 있는 케이스: ${failedCases}/${this.results.casesWithBoth} (통과율: ${passRate}%)\n`);

        // 목표 대비 현황
        console.log('🎯 목표 대비 현황:');
        console.log(`   날짜: ${(this.results.dateMatchRate * 100).toFixed(1)}% / 95% ${this.results.dateMatchRate >= 0.95 ? '✅' : '❌'}`);
        console.log(`   ICD: ${(this.results.icdMatchRate * 100).toFixed(1)}% / 95% ${this.results.icdMatchRate >= 0.95 ? '✅' : '❌'}`);
        console.log(`   병원: ${(this.results.hospitalMatchRate * 100).toFixed(1)}% / 80% ${this.results.hospitalMatchRate >= 0.80 ? '✅' : '❌'}`);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}

// CLI 실행
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
    const validator = new ReportSubsetValidator();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const casesDir = process.argv[2] || path.join(__dirname, '../../case_sample');
    const outputPath = path.join(__dirname, 'output/baseline_metrics.json');
    const htmlPath = path.join(__dirname, '../../temp/reports/Report_Subset_Validation.html');
    const statsHtmlPath = path.join(__dirname, '../../temp/reports/Event_Labeling_Stats.html');
    validator.validateAll(casesDir)
        .then(results => {
            validator.printSummary();
            validator.saveResults(outputPath);
            validator.generateHTMLReport(htmlPath);
            validator.generateLabelingStatsHTML(statsHtmlPath);
            const baselineMetrics = {
                timestamp: results.timestamp,
                casesWithBoth: results.casesWithBoth,
                dateMatchRate: results.dateMatchRate,
                icdMatchRate: results.icdMatchRate,
                hospitalMatchRate: results.hospitalMatchRate,
                missingCasesCount: results.missingEvents.length
            };
            const baselinePath = path.join(__dirname, '../..', 'VNEXSUS_dev_plan_tasks/baseline_metrics.json');
            fs.writeFileSync(baselinePath, JSON.stringify(baselineMetrics, null, 2), 'utf-8');
            console.log(`📊 베이스라인 메트릭 저장: ${baselinePath}\n`);
        })
        .catch(error => {
            console.error('❌ 검증 실패:', error.message);
            process.exit(1);
        });
}

export default ReportSubsetValidator;
