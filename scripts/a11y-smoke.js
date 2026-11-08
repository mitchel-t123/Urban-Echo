// Accessibility and SEO basics for the public pages.
// Expects docs/ to be served on http://localhost:9876 (override with BASE).
//
// Runs the axe-core engine in a real browser and fails on any violation EXCEPT colour contrast,
// which needs a design decision (brand colours) and is tracked separately. Needs axe-core:
//   npm install --no-save axe-core@4.10.2        (or set AXE_PATH to axe.min.js)
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:9876';
const AXE_PATH = process.env.AXE_PATH || require.resolve('axe-core/axe.min.js');
let failed = false;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   <-- ' + JSON.stringify(detail)));
  if (!ok) failed = true;
}

// public pages get the full SEO checks; the private-ish page only needs to be sound
const PAGES = [
  { url: '/index.html', name: 'home', seo: true },
  { url: '/careers/index.html', name: 'careers', seo: true },
  { url: '/soundhire/index.html', name: 'soundhire', seo: true },
  { url: '/problems.html', name: 'problems', seo: true },
  { url: '/externalhires.html', name: 'externalhires', seo: false },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const p of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route(u => new URL(u).hostname !== 'localhost', r => r.abort());
    await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    // a visitor dismisses the first-visit popup, so test what is behind it too
    await page.evaluate(() => { const el = document.getElementById('schoolPopup'); if (el) el.remove(); });
    await page.addScriptTag({ path: AXE_PATH });

    const violations = await page.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
        rules: { 'color-contrast': { enabled: false } },
      });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, e: v.nodes.slice(0, 2).map(n => n.target.join(' ').slice(0, 80)) }));
    });
    check(p.name + ': no accessibility violations (colour contrast aside)', violations.length === 0, violations);

    const basics = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      viewport: !!document.querySelector('meta[name=viewport]'),
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      imgsWithoutAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length,
      skipLink: !!document.querySelector('a.skip-link[href^="#"]'),
      skipTarget: (() => { const a = document.querySelector('a.skip-link'); return !!(a && document.getElementById(a.getAttribute('href').slice(1))); })(),
    }));
    check(p.name + ': has lang, viewport, one h1, one main, alt on every image, working skip link',
      basics.lang === 'en' && basics.viewport && basics.h1 === 1 && basics.main === 1 && basics.imgsWithoutAlt === 0 && basics.skipLink && basics.skipTarget, basics);

    // keyboard: the skip link is the first Tab stop, and Enter moves focus into the page content
    await page.keyboard.press('Tab');
    const firstStop = await page.evaluate(() => document.activeElement.classList.contains('skip-link'));
    await page.keyboard.press('Enter');
    const moved = await page.evaluate(() => { const a = document.activeElement; return !!(a && (a.closest('main') || a.id === 'main-content')); });
    check(p.name + ': skip link is the first Tab stop and Enter moves focus into the content', firstStop && moved, { firstStop, moved });

    if (p.seo) {
      const seo = await page.evaluate(() => {
        const meta = n => (document.querySelector(`meta[name="${n}"], meta[property="${n}"]`) || {}).content || '';
        const canon = (document.querySelector('link[rel=canonical]') || {}).href || '';
        return { title: document.title, desc: meta('description'), ogTitle: meta('og:title'), twTitle: meta('twitter:title'), canon, robots: meta('robots') };
      });
      check(p.name + ': title is 10 to 65 characters and names the brand', seo.title.length >= 10 && seo.title.length <= 65 && /Urban Echo/.test(seo.title), seo.title);
      check(p.name + ': description is 70 to 160 characters', seo.desc.length >= 70 && seo.desc.length <= 160, seo.desc.length);
      check(p.name + ': social titles match the page title', seo.ogTitle === seo.title && seo.twTitle === seo.title, seo);
      check(p.name + ': canonical points at the live site and is not set to noindex', /^https:\/\/urbanecho\.com\.au/.test(seo.canon) && !/noindex/i.test(seo.robots), seo);
    } else {
      const robots = await page.evaluate(() => (document.querySelector('meta[name=robots]') || {}).content || '');
      check(p.name + ': kept out of search results', /noindex/.test(robots), robots);
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
