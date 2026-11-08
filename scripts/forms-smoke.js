// Public forms smoke test (enquiry and catch-up forms on the home page).
// Expects docs/ to be served on http://localhost:9876 (override with BASE).
// Requests to Formspree and ClickUp are answered inside the page, so nothing is ever sent.
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:9876';
let failed = false;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   <-- ' + JSON.stringify(detail)));
  if (!ok) failed = true;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.clock.install(); // before the page loads, so the page's own timers can be fast-forwarded
  const pageErrors = [], dialogs = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await page.route(u => new URL(u).hostname !== 'localhost', r => r.abort());

  await page.addInitScript(() => {
    const realFetch = window.fetch.bind(window);
    window.__sent = [];
    window.__mode = 'ok';
    window.fetch = function (url, init) {
      const u = String(url);
      if (!/formspree\.io|workers\.dev/.test(u)) return realFetch(url, init);
      const body = init && init.body;
      let rec = null;
      if (body instanceof FormData) rec = Object.fromEntries(body.entries());
      else if (typeof body === 'string') { try { rec = JSON.parse(body); } catch (e) { rec = body; } }
      window.__sent.push({ url: u, body: rec, hasSignal: !!(init && init.signal) });
      if (/workers\.dev/.test(u)) return Promise.resolve(new Response('{}', { status: 200 }));
      const m = window.__mode;
      if (m === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      if (m === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      const status = m === 'ok' ? 200 : Number(m);
      return Promise.resolve(new Response(JSON.stringify({ ok: status === 200 }), { status }));
    };
  });

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#contactForm');
  // first-visit popup: a visitor picks an option before using the page
  await page.locator('#popupYes').click();
  await page.waitForFunction(() => !document.getElementById('schoolPopup'));

  // ── Enquiry form ──────────────────────────────────────────────
  const E = sel => '#contactForm ' + sel;
  const state = () => page.evaluate(() => ({
    errVisible: !document.getElementById('formError').hidden,
    err: document.getElementById('formError').textContent,
    mailto: !!document.querySelector('#formError a[href^="mailto:mitchel@urbanecho.com.au"]'),
    focus: document.activeElement && document.activeElement.id,
    invalid: [...document.querySelectorAll('#contactForm [aria-invalid=true]')].map(e => e.id).join(),
    sent: window.__sent.filter(s => /formspree/.test(s.url)).length,
    clickup: window.__sent.filter(s => /workers\.dev/.test(s.url)).length,
    formShown: getComputedStyle(document.getElementById('contactForm')).display !== 'none',
    success: getComputedStyle(document.getElementById('formSuccess')).display !== 'none',
    btn: document.querySelector('#contactForm button[type=submit]').textContent,
    btnDisabled: document.querySelector('#contactForm button[type=submit]').disabled,
  }));
  const submit = () => page.locator(E('button[type=submit]')).click();

  await submit();
  let r = await state();
  check('blank enquiry: asks for the name, sends nothing, no pop-up',
    r.errVisible && r.err === 'Please enter your name.' && r.focus === 'name' && r.invalid === 'name' && r.sent === 0 && dialogs.length === 0, { r, dialogs });
  r = await page.evaluate((sel) => { const b = document.querySelector(sel); return { color: getComputedStyle(b).color, wide: b.getBoundingClientRect().width >= b.parentElement.getBoundingClientRect().width - 1 }; }, '#formError');
  check('enquiry form: error text is dark and as wide as the form', r.color === 'rgb(138, 42, 13)' && r.wide, r);

  await page.locator(E('#name')).fill('     ');
  await submit();
  r = await state();
  check('a name of only spaces is treated as blank', r.err === 'Please enter your name.' && r.sent === 0, r);

  await page.locator(E('#name')).fill('Jane');
  await submit();
  r = await state();
  check('missing school is called out', r.err === 'Please enter your school name.' && r.focus === 'school' && r.invalid === 'school', r);

  await page.locator(E('#school')).fill('Wesley College');
  for (const bad of ['abc', 'a@b', 'jane@school', 'jane smith@school.wa.edu.au', 'a@b.c', '<x>@y.com']) {
    await page.locator(E('#email')).fill(bad);
    await submit();
    r = await state();
    check('rejects the email "' + bad + '"', /valid email address/.test(r.err) && r.focus === 'email' && r.invalid === 'email' && r.sent === 0, r);
  }

  // failures from the server or network keep what was typed and say so inline
  await page.locator(E('#email')).fill('jane@school.wa.edu.au');
  const failures = [
    ['500', /^Sorry, that did not send\. Please try again, or email mitchel@urbanecho\.com\.au\.$/],
    ['422', /^That did not go through\. Please check your email address/],
    ['429', /^Too many attempts/],
    ['network', /^Sorry, that did not send/],
  ];
  for (const [mode, re] of failures) {
    await page.evaluate(m => { window.__mode = m; }, mode);
    await submit();
    await page.waitForFunction(() => !document.getElementById('formError').hidden && !document.querySelector('#contactForm button[type=submit]').disabled);
    r = await state();
    const kept = await page.locator(E('#name')).inputValue();
    check('server says ' + mode + ': inline message with a mailto link, form and typing kept',
      re.test(r.err) && r.mailto && r.formShown && !r.success && r.btn === 'Send Enquiry' && !r.btnDisabled && kept === 'Jane' && r.clickup === 0 && dialogs.length === 0, { r, kept });
  }
  await context.setOffline(true);
  await page.evaluate(() => { window.__mode = 'network'; });
  await submit();
  await page.waitForFunction(() => /offline/.test(document.getElementById('formError').textContent));
  await context.setOffline(false);
  check('offline: says so', true);

  // a long message is cut to the limit, and the counter shows it
  await page.locator(E('#message')).fill('y'.repeat(1700));
  r = await page.evaluate(() => document.getElementById('messageCount').textContent);
  check('the counter appears near the limit', r === '1700 / 2000', r);
  await page.locator(E('#message')).click();
  await page.keyboard.press('End');
  await page.keyboard.type('z'.repeat(400));
  r = await page.evaluate(() => ({ len: document.getElementById('message').value.length, count: document.getElementById('messageCount').textContent }));
  check('typing stops at 2000 characters', r.len === 2000 && r.count === '2000 / 2000', r);
  await page.evaluate(() => { document.getElementById('message').value = 'line one\r\nline two ' + 'x'.repeat(5000); });

  // special characters and spacing go through as plain text
  await page.locator(E('#name')).fill('  Zoë "Z" <b>O\'Brien</b> & Co  ');
  await page.locator(E('#school')).fill("  St Mary's <i>College</i>  ");
  await page.locator(E('#email')).fill("  O'Brien@school.wa.edu.au ");
  await page.locator(E('#phone')).fill(' 0412 345 678 ');
  await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
  await submit();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('formSuccess')).display !== 'none');
  r = await page.evaluate(() => ({
    sent: window.__sent,
    successName: document.getElementById('successName').textContent,
    successEmail: document.getElementById('successEmail').textContent,
    injected: document.querySelectorAll('#formSuccess b, #formSuccess i, #formSuccess img').length,
  }));
  const fs = r.sent.find(s => /formspree/.test(s.url));
  const cu = r.sent.find(s => /workers\.dev/.test(s.url));
  check('what is sent is tidied: trimmed, kept as plain text, message cut to 2000',
    fs && fs.body.name === 'Zoë "Z" <b>O\'Brien</b> & Co' && fs.body.school === "St Mary's <i>College</i>" && fs.body.email === "O'Brien@school.wa.edu.au" &&
    fs.body.phone === '0412 345 678' && fs.body._replyto === "O'Brien@school.wa.edu.au" && fs.body.message.length === 2000 && /^line one\nline two /.test(fs.body.message) && fs.hasSignal, fs && { ...fs, body: { ...fs.body, message: fs.body.message.length } });
  check('the team record (ClickUp) gets the same tidy values', cu && cu.body.school === "St Mary's <i>College</i>" && cu.body.email === "O'Brien@school.wa.edu.au" && cu.body.phone === '0412 345 678', cu);
  check('success card shows the first name as text only', r.successName === 'Zoë' && r.successEmail === "O'Brien@school.wa.edu.au" && r.injected === 0, r);

  await page.locator('#formSuccessBack').click();
  r = await state();
  const emptied = await page.evaluate(() => document.getElementById('name').value === '' && document.getElementById('messageCount').textContent === '');
  check('"send another" brings back an empty form with no old errors', r.formShown && !r.success && !r.errVisible && !r.btnDisabled && emptied, { r, emptied });

  // the hidden trap field: looks fine to a bot, sends nothing
  await page.locator(E('#name')).fill('Bot');
  await page.locator(E('#school')).fill('Bots Inc');
  await page.locator(E('#email')).fill('bot@example.com');
  await page.evaluate(() => { window.__sent.length = 0; document.querySelector('#contactForm [name=_gotcha]').value = 'gotcha'; });
  await submit();
  r = await state();
  check('hidden trap field filled: shows success but sends nothing', r.success && r.sent === 0 && r.clickup === 0, r);
  await page.locator('#formSuccessBack').click();

  // a double click sends once
  await page.locator(E('#name')).fill('Pat');
  await page.locator(E('#school')).fill('Hale School');
  await page.locator(E('#email')).fill('pat@hale.wa.edu.au');
  await page.evaluate(() => { window.__sent.length = 0; });
  await page.locator(E('button[type=submit]')).dblclick();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('formSuccess')).display !== 'none');
  r = await state();
  check('double click sends only once', r.sent === 1, r);
  await page.locator('#formSuccessBack').click();

  // a hung request is given up on after 20 seconds
  await page.locator(E('#name')).fill('Sam');
  await page.locator(E('#school')).fill('Scotch College');
  await page.locator(E('#email')).fill('sam@scotch.wa.edu.au');
  await page.evaluate(() => { window.__mode = 'hang'; });
  await submit();
  r = await state();
  check('while waiting the button says Sending', r.btn === 'Sending…' && r.btnDisabled, r);
  await page.clock.fastForward(21000);
  await page.waitForFunction(() => !document.getElementById('formError').hidden);
  r = await state();
  check('after 20 seconds it gives up with a clear message and a working button', /^Sorry, that did not send/.test(r.err) && !r.btnDisabled && r.btn === 'Send Enquiry', r);
  await page.evaluate(() => { window.__mode = 'ok'; });

  // the small reviews strip on the home page moves on by itself (it used to throw every 7 seconds)
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.mini-review-card')].map((c, i) => c.classList.contains('hidden') ? '' : i).filter(x => x !== '').join());
  const before = await shown();
  await page.clock.runFor(8000);
  const after = await shown();
  check('the home page review strip moves on by itself', before !== after && pageErrors.length === 0, { before, after, pageErrors });

  // ── Catch-up form ─────────────────────────────────────────────
  const M = sel => '#meetForm ' + sel;
  const mstate = () => page.evaluate(() => ({
    errVisible: !document.getElementById('meetError').hidden,
    err: document.getElementById('meetError').textContent,
    mailto: !!document.querySelector('#meetError a[href^="mailto:mitchel@urbanecho.com.au"]'),
    focus: document.activeElement && document.activeElement.id,
    sent: window.__sent.filter(s => /formspree/.test(s.url)).length,
    formShown: getComputedStyle(document.getElementById('meetForm')).display !== 'none',
    success: getComputedStyle(document.getElementById('meetSuccess')).display !== 'none',
    btn: document.getElementById('meetSubmitBtn').textContent,
    btnDisabled: document.getElementById('meetSubmitBtn').disabled,
  }));
  await page.evaluate(() => { window.__sent.length = 0; });
  await page.locator('label.drink-card-label', { hasText: 'Coffee' }).click();
  await page.waitForSelector('#meetFormExpand.open');
  await page.locator('#meetSubmitBtn').click();
  r = await mstate();
  check('blank catch-up: asks for the name, no pop-up, sends nothing', r.err === 'Please enter your name.' && r.focus === 'meetName' && r.sent === 0 && dialogs.length === 0, { r, dialogs });
  r = await page.evaluate((sel) => { const b = document.querySelector(sel); return { color: getComputedStyle(b).color, wide: b.getBoundingClientRect().width >= b.parentElement.getBoundingClientRect().width - 1 }; }, '#meetError');
  check('catch-up form: error text is dark and as wide as the form', r.color === 'rgb(138, 42, 13)' && r.wide, r);
  await page.locator('#meetName').fill('https://evil.example/pay Smith');
  await page.locator('#meetEmail').fill('not-an-email');
  await page.locator('#meetSubmitBtn').click();
  r = await mstate();
  check('catch-up rejects a bad email', /valid email address/.test(r.err) && r.focus === 'meetEmail' && r.sent === 0, r);
  await page.locator('#meetEmail').fill('pat@hale.wa.edu.au');
  await page.evaluate(() => { window.__mode = '500'; });
  await page.locator('#meetSubmitBtn').click();
  await page.waitForFunction(() => !document.getElementById('meetError').hidden && !document.getElementById('meetSubmitBtn').disabled);
  r = await mstate();
  check('catch-up server failure: inline message with mailto link, form kept', /^Sorry, that did not send/.test(r.err) && r.mailto && r.formShown && !r.success && r.btn.startsWith('Request a Catch-Up') && dialogs.length === 0, r);
  await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
  await page.locator('#meetSubmitBtn').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('meetSuccess')).display !== 'none');
  r = await page.evaluate(() => ({ sent: window.__sent.find(s => /formspree/.test(s.url)), name: document.getElementById('meetSuccessName').textContent, hasLink: !!document.querySelector('#meetSuccess a[href*="evil"]') }));
  const pb = r.sent && r.sent.body;
  check('catch-up success: the auto-reply greeting holds letters only, no link text',
    pb && pb._autoresponse.startsWith('Hi httpsevilexamplepay! ') && !/evil\.example/.test(pb._autoresponse) && pb._replyto === 'pat@hale.wa.edu.au' && /COFFEE MEETING REQUEST/.test(pb.message), pb && { auto: pb._autoresponse.slice(0, 60), reply: pb._replyto });
  check('catch-up success card shows the name as plain text', r.name === 'https://evil.example/pay ' && !r.hasLink, r);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors);
  check('no pop-up dialogs at any point', dialogs.length === 0, dialogs);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
