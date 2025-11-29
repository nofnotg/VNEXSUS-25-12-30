import { readFileSync } from "fs";
import { resolve } from "path";
import { normalizeHospitalName } from "../utils/medicalText.js";
import { REPORT_COLUMNS } from "../constants/reportColumns.js";
import { REPORT_LABELS } from "../constants/reportLabels.js";
import { getLabel } from "../utils/i18n.js";

export function generateComparisonHTML(input, options = {}) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  const locale = typeof options.locale === 'string' ? options.locale : 'en';
  const title = options.title ?? getLabel('title_default', locale);
  const generatedAt = data.generatedAt ?? new Date().toISOString();
  const results = normalizeInputToResults(data);
  const { summary: flatSummary, aggregate } = buildAggregateFromResults(results);
  const langCandidate = String(locale || 'en').toLowerCase().slice(0, 2);
  const htmlLang = (langCandidate === 'ko' || langCandidate === 'en') ? langCandidate : 'en';

  const css = `
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
    th { background: #f5f7fa; text-align: left; }
    tr:nth-child(even) { background: #fafafa; }
    .high { background: #fff3cd; }
    .tag { display: inline-block; padding: 2px 6px; border-radius: 10px; background: #eef2ff; color: #334155; margin-right: 6px; font-size: 12px; }
    details { cursor: pointer; }
    .section { margin-top: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .card h3 { margin: 0 0 8px; font-size: 14px; }
    .controls { display: flex; gap: 12px; align-items: center; margin: 10px 0; }
    .controls .spacer { flex: 1; }
    .controls select, .controls button { font-size: 12px; padding: 4px 8px; }
  `;

  const topGroupsHtml = (() => {
    const list = aggregate.topGroups ?? [];
    if (!Array.isArray(list) || list.length === 0) return `<em>${escapeHtml(getLabel('no_top_groups', locale))}</em>`;
    const items = list.map(g => `<span class="tag">${escapeHtml(String(g.name ?? g.group ?? "unknown"))}: ${Number(g.count ?? g.value ?? 0)}</span>`).join("\n");
    return `<div>${items}</div>`;
  })();

  const rows = flatSummary.map(item => {
    const config = escapeCsvCell(item.config ?? "unknown");
    const file = escapeCsvCell(item.file ?? "unknown");
    const records = Number(item.records ?? 0);
    const episodes = Number(item.episodes ?? 0);
    const claimWithin = Number(item.claimWithinWindowRecords ?? 0);
    const claimTotal = Number(item.claimTotalRecords ?? 0);
    const diseaseAnchors = Number(item.diseaseAnchors ?? 0);
    const diseaseTestsWithin = Number(item.diseaseTestsWithinTimeframe ?? 0);
    const dg = item.diagnosticGroups ?? {};
    const groupsTotal = Array.isArray(dg) ? dg.length : typeof dg === "object" ? Object.keys(dg).length : Number(item.groups_total ?? 0);
    const hospitals = Array.isArray(item.hospitals) ? item.hospitals : [];
    const hospitalsNormalized = hospitals.map(h => normalizeHospitalName(h)).filter(Boolean);
    const hospitalsTotal = hospitalsNormalized.length;
    const highlight = episodes > (options.episodesHigh ?? 300) || hospitalsTotal > (options.hospitalsHigh ?? 20);
    const hospitalPreview = hospitalsNormalized.slice(0, 6).join("; ");
    const hospitalDetails = hospitalsNormalized.join("; ");
    return `
      <tr class="${highlight ? "high" : ""}">
        <td>${config}</td>
        <td>${file}</td>
        <td>${records}</td>
        <td>${episodes}</td>
        <td>${groupsTotal}</td>
        <td>${hospitalsTotal}</td>
        <td>${claimWithin}</td>
        <td>${claimTotal}</td>
        <td>${diseaseAnchors}</td>
        <td>${diseaseTestsWithin}</td>
        <td>
          <details>
            <summary>${escapeHtml(hospitalPreview)}${hospitalsNormalized.length > 6 ? " …" : ""}</summary>
            <div>${escapeHtml(hospitalDetails)}</div>
          </details>
        </td>
      </tr>
    `;
  }).join("\n");

  const csvLink = options.csvPath ?? "reports/outpatient-episodes-case-comparison.csv";

  return `<!doctype html>
  <html lang="${htmlLang}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>${css}</style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(getLabel('meta_generated_at', locale))} ${escapeHtml(generatedAt)}</div>

      <div class="section grid">
        <div class="card">
          <h3>${escapeHtml(getLabel('section_aggregate', locale))}</h3>
          <div>${escapeHtml(getLabel('metric_cases', locale))}: ${Number(aggregate.cases ?? 0)}</div>
          <div>${escapeHtml(getLabel('metric_total_episodes', locale))}: ${Number(aggregate.totals?.episodes ?? 0)}</div>
          <div>${escapeHtml(getLabel('metric_total_records', locale))}: ${Number(aggregate.totals?.records ?? 0)}</div>
          <div>${escapeHtml(getLabel('metric_claims_within_window', locale))}: ${Number(aggregate.totals?.claimWithinWindowRecords ?? 0)}</div>
          <div>${escapeHtml(getLabel('metric_disease_anchors', locale))}: ${Number(aggregate.totals?.diseaseAnchors ?? 0)}</div>
          <div>${escapeHtml(getLabel('metric_tests_within_timeframe', locale))}: ${Number(aggregate.totals?.diseaseTestsWithinTimeframe ?? 0)}</div>
        </div>
        <div class="card">
          <h3>${escapeHtml(getLabel('section_top_groups', locale))}</h3>
          ${topGroupsHtml}
        </div>
        <div class="card">
          <h3>${escapeHtml(getLabel('section_exports', locale))}</h3>
          <a href="${csvLink}">${escapeHtml(getLabel('export_download_csv', locale))}</a>
        </div>
      </div>

      <div class="section">
        <h3>${escapeHtml(getLabel('section_summary_by_config', locale))}</h3>
        <div class="controls">
          <label>${escapeHtml(getLabel('controls_page_size', locale))}
            <select id="pageSize">
              <option value="10">10</option>
              <option value="25" selected>25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </select>
          </label>
          <div class="spacer"></div>
          <button id="prev">${escapeHtml(getLabel('controls_prev', locale))}</button>
          <span id="pageInfo">${escapeHtml(getLabel('controls_page_label', locale))}</span>
          <button id="next">${escapeHtml(getLabel('controls_next', locale))}</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>${REPORT_COLUMNS.config}</th>
              <th>${REPORT_COLUMNS.file}</th>
              <th>${REPORT_COLUMNS.records}</th>
              <th>${REPORT_COLUMNS.episodes}</th>
              <th>${REPORT_COLUMNS.groups_total}</th>
              <th>${REPORT_COLUMNS.hospitals_total}</th>
              <th>${REPORT_COLUMNS.claim_within_window}</th>
              <th>${REPORT_COLUMNS.claim_total}</th>
              <th>${REPORT_COLUMNS.disease_anchors}</th>
              <th>${REPORT_COLUMNS.disease_tests_within_timeframe}</th>
              <th>${REPORT_COLUMNS.hospitals_normalized}</th>
            </tr>
          </thead>
          <tbody id="summaryBody">
            ${rows}
          </tbody>
        </table>
      </div>
      <script>
        (function(){
          var tbody = document.getElementById('summaryBody');
          if (!tbody) return;
          var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
          var select = document.getElementById('pageSize');
          var prev = document.getElementById('prev');
          var next = document.getElementById('next');
          var info = document.getElementById('pageInfo');
          var pageSize = 25;
          var page = 1;
          var labelPage = '${escapeHtml(getLabel('controls_page_label', locale))}';
          var labelRows = '${escapeHtml(getLabel('controls_rows_label', locale))}';

          function totalPages(){
            if (pageSize === -1) return 1;
            return Math.max(1, Math.ceil(rows.length / pageSize));
          }

          function render(){
            var tp = totalPages();
            if (page > tp) page = tp;
            for (var i = 0; i < rows.length; i++){
              var visible = (pageSize === -1) || (i >= (page - 1) * pageSize && i < page * pageSize);
              rows[i].style.display = visible ? '' : 'none';
            }
            info.textContent = labelPage + ' ' + page + ' / ' + tp + ' · ' + labelRows + ' ' + rows.length;
            prev.disabled = page <= 1;
            next.disabled = page >= tp;
          }

          select.addEventListener('change', function(e){
            var val = String(e.target.value);
            pageSize = (val === 'all') ? -1 : parseInt(val, 10);
            page = 1;
            render();
          });
          prev.addEventListener('click', function(){ if (page > 1) { page--; render(); } });
          next.addEventListener('click', function(){ page++; render(); });
          render();
        })();
      </script>
    </body>
  </html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCsvCell(s) {
  return escapeHtml(String(s));
}

function normalizeInputToResults(input) {
  if (!input) return [];
  if (Array.isArray(input.results)) {
    return input.results;
  }
  if (typeof input === 'object' && Array.isArray(input.summary)) {
    return [input];
  }
  if (Array.isArray(input)) {
    return [{ name: 'unknown', summary: input }];
  }
  return [];
}

function buildAggregateFromResults(results) {
  const summary = [];
  const totals = { records: 0, episodes: 0, claimWithinWindowRecords: 0 };
  totals.diseaseAnchors = 0;
  totals.diseaseTestsWithinTimeframe = 0;
  const groupCounts = new Map();

  for (const r of results) {
    const config = r.name ?? 'unknown';
    for (const item of r.summary ?? []) {
      summary.push({ ...item, config });
      totals.records += Number(item.records ?? 0);
      totals.episodes += Number(item.episodes ?? 0);
      totals.claimWithinWindowRecords += Number(item.claimWithinWindowRecords ?? 0);
      totals.diseaseAnchors += Number(item.diseaseAnchors ?? 0);
      totals.diseaseTestsWithinTimeframe += Number(item.diseaseTestsWithinTimeframe ?? 0);
      const groups = Array.isArray(item.diagnosticGroups) ? item.diagnosticGroups : [];
      for (const g of groups) {
        if (!g) continue;
        groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
      }
    }
  }

  const topGroups = Array.from(groupCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([group, count]) => ({ group, count }));

  return { summary, aggregate: { cases: summary.length, totals, topGroups } };
}
