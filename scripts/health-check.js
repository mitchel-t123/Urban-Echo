#!/usr/bin/env node
// Daily health check for urbanecho.com.au
// Run: node scripts/health-check.js
// Requires: @playwright/test installed (npx playwright install chromium)

const { chromium } = require('playwright');

const SITE = process.env.SITE_URL || 'https://urbanecho.com.au';

const results = [];
let browser;

function pass(name) {
  results.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}

function fail(name, reason) {
  results.push({ name, ok: false, reason });
  console.error(`  ✗ ${name}: ${reason}`);
}

async function run() {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  page.on('pageerror', err => fail('No JS errors', err.message));

  let jsErrors = 0;
  page.on('pageerror', () => jsErrors++);

  console.log(`\nChecking ${SITE}\n`);

  // ── Load ─────────────────────────────────────────────────────────────────
  try {
    const res = await page.goto(SITE, { waitUntil: 'networkidle', timeout: 20000 });
    res.status() < 400 ? pass('Page loads (HTTP 2xx)') : fail('Page loads', `HTTP ${res.status()}`);
  } catch (e) {
    fail('Page loads', e.message);
    await browser.close();
    return summarise();
  }

  // ── No JS errors ─────────────────────────────────────────────────────────
  // (collected via pageerror listener above — checked at end)

  // ── Navigation links ─────────────────────────────────────────────────────
  for (const label of ['Packages', 'Reviews', 'Contact']) {
    const link = page.locator(`.nav a:has-text("${label}")`).first();
    try {
      await link.waitFor({ timeout: 3000 });
      pass(`Nav link "${label}" present`);
    } catch {
      fail(`Nav link "${label}" present`, 'not found');
    }
  }

  // ── Hero checklist clickable ──────────────────────────────────────────────
  const check = page.locator('.hero-check').first();
  try {
    await check.waitFor({ timeout: 3000 });
    await check.click({ timeout: 3000 });
    const checked = await check.evaluate(el => el.classList.contains('checked'));
    checked ? pass('Hero checklist item clickable') : fail('Hero checklist item clickable', 'click had no effect — class not added');
  } catch (e) {
    fail('Hero checklist item clickable', e.message);
  }

  // ── Stress meter emoji clickable ──────────────────────────────────────────
  const face = page.locator('.stress-face[data-lvl="2"]');
  try {
    await face.waitFor({ timeout: 3000 });
    await face.click({ timeout: 3000 });
    const active = await face.evaluate(el => el.classList.contains('active'));
    active ? pass('Stress meter emoji clickable') : fail('Stress meter emoji clickable', 'click had no effect');
  } catch (e) {
    fail('Stress meter emoji clickable', e.message);
  }

  // ── Contact form present & has submit button ──────────────────────────────
  try {
    const form = page.locator('#contactForm');
    await form.waitFor({ timeout: 3000 });
    const btn = form.locator('button[type=submit]');
    await btn.waitFor({ timeout: 2000 });
    pass('Contact form + submit button present');
  } catch (e) {
    fail('Contact form + submit button present', e.message);
  }

  // ── Formspree action present ──────────────────────────────────────────────
  try {
    // Formspree ID should be in the JS — check it's non-placeholder
    const src = await page.content();
    src.includes('formspree.io/f/mlgyjyej') ? pass('Formspree ID present') : fail('Formspree ID present', 'ID not found in page source');
  } catch (e) {
    fail('Formspree ID present', e.message);
  }

  // ── Anchor scroll works ───────────────────────────────────────────────────
  try {
    const before = await page.evaluate(() => window.scrollY);
    await page.locator('a[href="#contact"]').first().click();
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.scrollY);
    after > before + 200 ? pass('Anchor scroll (#contact) works') : fail('Anchor scroll (#contact) works', `scrollY only moved ${after - before}px`);
  } catch (e) {
    fail('Anchor scroll (#contact) works', e.message);
  }

  // ── Enquire page loads ────────────────────────────────────────────────────
  try {
    const res = await page.goto(SITE + '/enquire.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
    res.status() < 400 ? pass('enquire.html loads') : fail('enquire.html loads', `HTTP ${res.status()}`);
  } catch (e) {
    fail('enquire.html loads', e.message);
  }

  // ── JS errors (collected throughout) ─────────────────────────────────────
  jsErrors === 0 ? pass('No JS errors on load') : fail('No JS errors on load', `${jsErrors} error(s) detected`);

  await browser.close();
  return summarise();
}

function summarise() {
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`  ${passed}/${results.length} checks passed`);
  if (failed.length) {
    console.log(`\n  FAILURES:`);
    failed.forEach(r => console.log(`    • ${r.name}: ${r.reason}`));
  } else {
    console.log(`  All clear ✓`);
  }
  console.log(`${'─'.repeat(48)}\n`);
  return { passed, total: results.length, failed };
}

run().then(({ failed }) => {
  process.exit(failed.length > 0 ? 1 : 0);
}).catch(err => {
  console.error('Health check crashed:', err);
  if (browser) browser.close();
  process.exit(1);
});
