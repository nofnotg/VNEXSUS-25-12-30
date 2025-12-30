const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5500/VNEXSUS_A-B-C_Execution_Plan/app_progress_report.html', { waitUntil: 'networkidle' });
  const doingTitles = await page.$$eval('#doing-list .row .title', els => els.map(e => e.textContent.trim()));
  const doneTitles = await page.$$eval('#done-container .row .title', els => els.map(e => e.textContent.trim()));
  const consolidationHeads = await page.$$eval('#plan-consolidation .note', els => els.map(e => e.textContent.trim()));
  const isDoneLast = await page.evaluate(() => {
    const grid = document.querySelector('#grid-root');
    const done = document.querySelector('#card-done');
    if (!grid || !done) return null;
    const cards = Array.from(grid.children).filter(el => el.classList && el.classList.contains('card'));
    return cards.length > 0 && cards[cards.length - 1] === done;
  });
  const isPreviewCompletedLast = await page.evaluate(() => {
    const preview = document.querySelector('#preview-card .preview');
    const completedList = document.getElementById('preview-completed');
    const section = completedList ? completedList.parentElement : null;
    if (!preview || !section) return null;
    const sections = Array.from(preview.children).filter(el => el.classList && el.classList.contains('section'));
    return sections.length > 0 && sections[sections.length - 1] === section;
  });
  const absorbAutos = await page.$$eval('#plan-consolidation .row .pill', els => els.map(e => e.textContent.trim()).filter(t => t === '자동흡수').length);
  const hasDeletionSection = await page.$$eval('#plan-consolidation .note', els => els.some(e => e.textContent.includes('삭제 고려')));
  const hasSummarySection = await page.$$eval('#plan-consolidation .note', els => els.some(e => e.textContent.includes('흡수 요약')));
  const planBadgesText = await page.$eval('#plan-summary-badges', el => el.textContent.trim());
  const kpiBadgesText = await page.$eval('#kpi-plan-badges', el => el.textContent.trim());
  const badgesMatch = (planBadgesText || '').replace(/\s+/g,'') === (kpiBadgesText || '').replace(/\s+/g,'');
  const hasScheduleCard = await page.$('#schedule-card') !== null;
  const scheduleNotes = await page.$$eval('#schedule-list .note', els => els.map(e => e.textContent.trim()));
  const hasThisWeek = scheduleNotes.some(t => t.includes('이번주 진행'));
  const hasNextWeek = scheduleNotes.some(t => t.includes('다음주 예정'));
  const hasReviewSoon = scheduleNotes.some(t => t.includes('이번주 리뷰 예정'));
  await page.screenshot({ path: 'app_progress_report.png', fullPage: true });
  await browser.close();
  const result = {
    doingTop: doingTitles[0] || '',
    doingCount: doingTitles.length,
    doneTop: doneTitles[0] || '',
    doneCount: doneTitles.length,
    consolidationSections: consolidationHeads,
    doneCardIsLast: isDoneLast,
    previewCompletedIsLast: isPreviewCompletedLast,
    autoAbsorbBadgeCount: absorbAutos,
    hasDeletionSection,
    hasSummarySection,
    planBadgesText,
    kpiBadgesText,
    badgesMatch,
    hasScheduleCard,
    hasThisWeek,
    hasNextWeek,
    hasReviewSoon
  };
  console.log(JSON.stringify(result, null, 2));
}

run().catch(err => {
  console.error(err && err.message || err);
  process.exit(1);
});
