// SoundHire enquiry form and the problems page forms (suggest an issue, flag a step).
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
  await page.clock.install();
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
      if (typeof body === 'string') { try { rec = JSON.parse(body); } catch (e) { rec = body; } }
      window.__sent.push({ url: u, body: rec, hasSignal: !!(init && init.signal) });
      if (/workers\.dev/.test(u)) return Promise.resolve(new Response('{}', { status: 200 }));
      const m = window.__mode;
      if (m === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      if (m === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      const status = m === 'ok' ? 200 : Number(m);
      return Promise.resolve(new Response(JSON.stringify({ ok: status === 200 }), { status }));
    };
  });

  // ── SoundHire ─────────────────────────────────────────────────
  await page.goto(BASE + '/soundhire/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#eqForm');
  const sh = () => page.evaluate(() => ({
    errVisible: !document.getElementById('eqError').hidden,
    err: document.getElementById('eqError').textContent,
    mailto: !!document.querySelector('#eqError a[href^="mailto:mitchel@urbanecho.com.au"]'),
    focus: document.activeElement && document.activeElement.id,
    sent: window.__sent.filter(s => /formspree/.test(s.url)).length,
    clickup: window.__sent.filter(s => /workers\.dev/.test(s.url)).length,
    formShown: getComputedStyle(document.getElementById('eqForm')).display !== 'none',
    success: getComputedStyle(document.getElementById('eqSuccess')).display !== 'none',
    btn: document.querySelector('#eqForm button[type=submit]').textContent,
    btnDisabled: document.querySelector('#eqForm button[type=submit]').disabled,
  }));
  const shSubmit = () => page.locator('#eqForm button[type=submit]').click();

  await shSubmit();
  let r = await sh();
  check('SoundHire blank: asks for the name, sends nothing', r.err === 'Please enter your name.' && r.focus === 'eq-name' && r.sent === 0 && !r.success, r);
  r = await page.evaluate((sel) => { const b = document.querySelector(sel); return { color: getComputedStyle(b).color, wide: b.getBoundingClientRect().width >= b.parentElement.getBoundingClientRect().width - 1 }; }, '#eqError');
  check('SoundHire form: error text is dark and as wide as the form', r.color === 'rgb(138, 42, 13)' && r.wide, r);
  await page.locator('#eq-name').fill('Jane');
  await page.locator('#eq-email').fill('jane@');
  await shSubmit();
  r = await sh();
  check('SoundHire bad email is refused', /valid email address/.test(r.err) && r.focus === 'eq-email' && r.sent === 0, r);
  await page.locator('#eq-email').fill('jane@example.com');
  await shSubmit();
  r = await sh();
  check('SoundHire needs a service chosen', r.err === 'Please choose what you need.' && r.focus === 'eq-service' && r.sent === 0, r);
  await page.locator('#eq-service').selectOption({ index: 2 });

  await page.evaluate(() => { window.__mode = '500'; });
  await shSubmit();
  await page.waitForFunction(() => !document.getElementById('eqError').hidden && !document.querySelector('#eqForm button[type=submit]').disabled);
  r = await sh();
  check('SoundHire server failure: clear message with mailto link, form kept, button restored',
    /^Sorry, that did not send\. Please try again, or email mitchel@urbanecho\.com\.au\.$/.test(r.err) && r.mailto && r.formShown && !r.success && r.btn === 'Send Enquiry →' && !r.btnDisabled && r.clickup === 0, r);
  await context.setOffline(true);
  await page.evaluate(() => { window.__mode = 'network'; });
  await shSubmit();
  await page.waitForFunction(() => /offline/.test(document.getElementById('eqError').textContent));
  await context.setOffline(false);
  check('SoundHire offline: says so', true);

  await page.locator('#eq-name').fill('  Zoë <b>O\'Brien</b>  ');
  await page.locator('#eq-org').fill('  The "Rechabite" & Co  ');
  await page.locator('#eq-notes').fill('n'.repeat(5000));
  await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
  await shSubmit();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('eqSuccess')).display !== 'none');
  const sent = await page.evaluate(() => window.__sent);
  const fs = sent.find(s => /formspree/.test(s.url)), cu = sent.find(s => /workers\.dev/.test(s.url));
  check('SoundHire success: values tidied, long notes cut, trap field not sent',
    fs && fs.body.name === 'Zoë <b>O\'Brien</b>' && fs.body.organisation === 'The "Rechabite" & Co' && fs.body.notes.length === 2000 && !('_gotcha' in fs.body) && fs.hasSignal, fs && { ...fs, body: { ...fs.body, notes: fs.body.notes.length } });
  check('SoundHire team record (ClickUp) is created once', sent.filter(s => /workers\.dev/.test(s.url)).length === 1 && cu.body.client_name === 'Zoë <b>O\'Brien</b>', cu);

  await page.goto(BASE + '/soundhire/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#eqForm');
  await page.locator('#eq-name').fill('Bot');
  await page.locator('#eq-email').fill('bot@example.com');
  await page.locator('#eq-service').selectOption({ index: 1 });
  await page.evaluate(() => { document.querySelector('#eqForm [name=_gotcha]').value = 'x'; });
  await shSubmit();
  r = await sh();
  check('SoundHire trap field filled: shows success but sends nothing', r.success && r.sent === 0, r);

  await page.goto(BASE + '/soundhire/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#eqForm');
  await page.locator('#eq-name').fill('Sam');
  await page.locator('#eq-email').fill('sam@example.com');
  await page.locator('#eq-service').selectOption({ index: 1 });
  await page.evaluate(() => { window.__mode = 'hang'; });
  await shSubmit();
  r = await sh();
  check('SoundHire while waiting the button says Sending', r.btn === 'Sending…' && r.btnDisabled, r);
  await page.clock.fastForward(21000);
  await page.waitForFunction(() => !document.getElementById('eqError').hidden);
  r = await sh();
  check('SoundHire gives up after 20 seconds with a clear message', /^Sorry, that did not send/.test(r.err) && !r.btnDisabled && r.formShown, r);

  // ── Problems page ─────────────────────────────────────────────
  await page.goto(BASE + '/problems.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#suggestForm');
  const sg = (formSel) => page.evaluate((f) => {
    const form = document.querySelector(f);
    const box = form.querySelector('.form-error');
    return {
      errVisible: !box.hidden, err: box.textContent,
      mailto: !!box.querySelector('a[href^="mailto:mitchel@urbanecho.com.au"]'),
      focus: document.activeElement && (document.activeElement.name || document.activeElement.id),
      sent: window.__sent.filter(s => /formspree/.test(s.url)).length,
      formShown: getComputedStyle(form).display !== 'none',
      btn: form.querySelector('button[type=submit]').textContent.trim(),
      btnDisabled: form.querySelector('button[type=submit]').disabled,
    };
  }, formSel);
  const labelsTied = (formSel) => page.evaluate((f) => [...document.querySelectorAll(f + ' label[for]')].every(l => document.getElementById(l.htmlFor)) && document.querySelectorAll(f + ' label[for]').length === 3, formSel);

  for (const [sel, ok] of [['#suggestForm', 'page bottom'], ['#suggestModalForm', 'pop-up']]) {
    if (sel === '#suggestModalForm') {
      await page.locator('.skill-btn[data-level="beginner"]').click();
      await page.locator('.open-suggest-modal').first().click();
      await page.waitForFunction(() => getComputedStyle(document.getElementById('suggestModal')).display === 'flex');
    }
    const submitBtn = page.locator(sel + ' button[type=submit]');
    check('suggest form (' + ok + '): every label is tied to its field', await labelsTied(sel), null);
    await page.evaluate(() => { window.__sent.length = 0; window.__mode = 'ok'; });
    await submitBtn.click();
    r = await sg(sel);
    check('suggest form (' + ok + ') blank: says what is missing, sends nothing, no pop-up', r.err === 'Please enter your name.' && r.focus === 'name' && r.sent === 0 && dialogs.length === 0, { r, dialogs });
    r = await page.evaluate((f) => { const b = document.querySelector(f + ' .form-error'); return { color: getComputedStyle(b).color, wide: b.getBoundingClientRect().width >= b.parentElement.getBoundingClientRect().width - 1 }; }, sel);
    check('suggest form (' + ok + '): error text is dark and as wide as the form', r.color === 'rgb(138, 42, 13)' && r.wide, r);
    await page.locator(sel + ' [name=name]').fill('Sarah');
    await page.locator(sel + ' [name=email]').fill('sarah@school');
    await submitBtn.click();
    r = await sg(sel);
    check('suggest form (' + ok + ') bad email is refused', /valid email address/.test(r.err) && r.focus === 'email' && r.sent === 0, r);
    await page.locator(sel + ' [name=email]').fill('sarah@school.edu.au');
    await submitBtn.click();
    r = await sg(sel);
    check('suggest form (' + ok + ') needs a description', /describe the issue/.test(r.err) && r.focus === 'description' && r.sent === 0, r);
    await page.locator(sel + ' [name=description]').fill('   \n   ');
    await submitBtn.click();
    r = await sg(sel);
    check('suggest form (' + ok + ') a description of only spaces counts as empty', /describe the issue/.test(r.err) && r.sent === 0, r);
    await page.locator(sel + ' [name=description]').fill('Hum <i>when</i> the projector is on. ' + 'd'.repeat(5000));
    await page.evaluate(() => { window.__mode = '500'; });
    await submitBtn.click();
    await page.waitForFunction((f) => !document.querySelector(f + ' button[type=submit]').disabled, sel);
    r = await sg(sel);
    check('suggest form (' + ok + ') server failure: inline message with mailto link, button restored, no pop-up',
      /^Sorry, that did not send/.test(r.err) && r.mailto && r.formShown && r.btn === 'Suggest this issue →' && dialogs.length === 0, { r, dialogs });
    await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
    await submitBtn.click();
    await page.waitForFunction((f) => getComputedStyle(document.querySelector(f)).display === 'none', sel);
    const s2 = await page.evaluate(() => window.__sent.filter(s => /formspree/.test(s.url)));
    check('suggest form (' + ok + ') success: tidy values, description cut to 2000, sent once',
      s2.length === 1 && s2[0].body.name === 'Sarah' && s2[0].body.suggestion.startsWith('Hum <i>when</i> the projector is on. ') && s2[0].body.suggestion.length === 2000 && s2[0].hasSignal && !('_gotcha' in s2[0].body), s2[0] && { ...s2[0], body: { ...s2[0].body, suggestion: s2[0].body.suggestion.length } });
    if (sel === '#suggestModalForm') await page.locator('#closeSuggestModal').click();
  }

  // trap field on the page-bottom form
  await page.goto(BASE + '/problems.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#suggestForm');
  await page.locator('#suggestForm [name=name]').fill('Bot');
  await page.locator('#suggestForm [name=email]').fill('bot@example.com');
  await page.locator('#suggestForm [name=description]').fill('spam');
  await page.evaluate(() => { document.querySelector('#suggestForm [name=_gotcha]').value = 'x'; });
  await page.locator('#suggestForm button[type=submit]').click();
  r = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('suggestSuccess')).display !== 'none', sent: window.__sent.length }));
  check('suggest form trap field filled: shows success but sends nothing', r.shown && r.sent === 0, r);

  // flag a step: success only when it really sent
  await page.locator('.skill-btn[data-level="beginner"]').click();
  await page.locator('.category-btn[data-cat="sound"]').click();
  await page.locator('.problem-btn[data-problem="speaker-feedback"]').click();
  await page.locator('#diagFlagBtn').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('flagModal')).display === 'flex');
  await page.locator('#flagComment').fill('step looks wrong <b>here</b> ' + 'c'.repeat(3000));
  await page.evaluate(() => { window.__mode = '500'; window.__sent.length = 0; });
  await page.locator('#flagModalSubmit').click();
  await page.waitForFunction(() => !document.getElementById('flagError').hidden);
  r = await page.evaluate(() => ({
    err: document.getElementById('flagError').textContent,
    flagged: document.getElementById('diagFlagBtn').classList.contains('flagged'),
    thanks: getComputedStyle(document.getElementById('flagModalSuccess')).display !== 'none',
    buttons: !document.getElementById('flagModalSubmit').disabled && !document.getElementById('flagModalSkip').disabled,
  }));
  check('flag a step: when sending fails it says so and does not claim thanks', r.err === 'Sorry, that did not send. Please try again.' && !r.flagged && !r.thanks && r.buttons, r);
  await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
  await page.locator('#flagModalSubmit').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('flagModalSuccess')).display !== 'none');
  const fl = await page.evaluate(() => ({ sent: window.__sent.filter(s => /formspree/.test(s.url)), flagged: document.getElementById('diagFlagBtn').classList.contains('flagged') }));
  check('flag a step: thanks only after it sent, comment tidied and cut to 1000', fl.sent.length === 1 && fl.flagged && fl.sent[0].body.comment.length === 1000 && fl.sent[0].body.comment.startsWith('step looks wrong <b>here</b> '), fl);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors);
  check('no pop-up dialogs at any point', dialogs.length === 0, dialogs);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
