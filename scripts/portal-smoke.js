// Portal smoke test. Expects docs/ to be served on http://localhost:9876.
const { chromium } = require('playwright');

const BASE = 'http://localhost:9876/portal.html';
// [trigger button id, modal id]. Real mouse clicks, so a button covered by another element fails too.
const TRIGGERS = [
  ['openRiskBtn', 'riskModal'],
  ['openIncidentBtn', 'incidentModal'],
  ['openContactsBtn', 'contactsModal'],
  ['openInductionBtn', 'inductionModal'],
  ['openFeedback', 'feedbackModal'],
  ['openPortalHelp', 'portalHelpModal'],
];
const NEEDS_INLINE_ONCLICK = ['openRiskBtn', 'openIncidentBtn', 'openContactsBtn', 'openInductionBtn'];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  // Localhost only: no Clerk redirect to /login mid-run and no flaky CDN calls.
  await page.route(u => u.hostname !== 'localhost', r => r.abort());
  await page.goto(BASE);
  await page.evaluate(() => {
    document.body.classList.remove('auth-pending');
    const loader = document.getElementById('authLoader');
    if (loader) { loader.classList.remove('show'); loader.style.display = 'none'; }
  });
  await page.waitForTimeout(400);

  let failed = false;
  const report = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };

  // A modal nested in another modal or in a display:none element can never be shown.
  const problems = await page.evaluate(() => {
    const out = [];
    for (const m of document.querySelectorAll('.modal-overlay, .hb-modal')) {
      for (let p = m.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.matches('.modal-overlay, .hb-modal')) out.push('#' + m.id + ' is nested inside modal #' + p.id);
        else if (getComputedStyle(p).display === 'none') out.push('#' + m.id + ' is inside a display:none element (' + (p.id ? '#' + p.id : p.tagName) + ')');
      }
    }
    const seen = {};
    for (const el of document.querySelectorAll('[id]')) seen[el.id] = (seen[el.id] || 0) + 1;
    for (const id in seen) if (seen[id] > 1) out.push('duplicate id "' + id + '" x' + seen[id]);
    return out;
  });
  problems.forEach(p => report(false, p));
  if (!problems.length) report(true, 'modals are top-level and ids are unique');

  for (const [btnId, modalId] of TRIGGERS) {
    try {
      if (NEEDS_INLINE_ONCLICK.includes(btnId)) {
        const has = await page.evaluate(id => { const b = document.getElementById(id); return !!(b && b.getAttribute('onclick')); }, btnId);
        if (!has) { report(false, btnId + ' has no inline onclick'); continue; }
      }
      const btn = page.locator('#' + btnId);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(200);
      const shown = await page.evaluate(id => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return r.width > 0 && r.height > 0 && !!hit && el.contains(hit);
      }, modalId);
      report(shown, btnId + ' => ' + modalId + (shown ? ' is visible' : ' did not become visible'));
      await page.evaluate(id => document.getElementById(id).classList.remove('open'), modalId);
    } catch (e) {
      report(false, btnId + ' => ' + modalId + ': ' + e.message.split('\n')[0]);
    }
  }

  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
