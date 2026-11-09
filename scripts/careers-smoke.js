// Careers application form smoke test. Expects docs/ to be served on http://localhost:9876 (override with BASE).
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
      if (body instanceof FormData) {
        rec = {};
        for (const [k, v] of body.entries()) rec[k] = typeof v === 'string' ? v : { file: v.name, size: v.size };
      } else if (typeof body === 'string') { try { rec = JSON.parse(body); } catch (e) { rec = body; } }
      window.__sent.push({ url: u, body: rec, hasSignal: !!(init && init.signal) });
      if (/workers\.dev/.test(u)) return Promise.resolve(new Response('{}', { status: 200 }));
      const m = window.__mode;
      if (m === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      if (m === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      const status = m === 'ok' ? 200 : Number(m);
      return Promise.resolve(new Response(JSON.stringify({ ok: status === 200 }), { status }));
    };
  });

  await page.goto(BASE + '/careers/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#appForm');

  const state = () => page.evaluate(() => ({
    errVisible: !document.getElementById('appError').hidden,
    err: document.getElementById('appError').textContent,
    focus: document.activeElement && document.activeElement.id,
    invalid: [...document.querySelectorAll('#appForm [aria-invalid=true]')].map(e => e.id).join(),
    sent: window.__sent.filter(s => /formspree/.test(s.url)).length,
    clickup: window.__sent.filter(s => /workers\.dev/.test(s.url)).length,
    formShown: getComputedStyle(document.getElementById('appForm')).display !== 'none',
    success: getComputedStyle(document.getElementById('appSuccess')).display !== 'none',
    btn: document.getElementById('appBtnLabel').textContent,
    btnDisabled: document.getElementById('appSubmit').disabled,
    fallback: document.getElementById('appFallback').hidden ? '' : document.getElementById('appMailtoLink').getAttribute('href'),
    // is the message on screen (clear of the sticky nav bar), and is the flagged box on screen with it?
    errInView: (() => { const r = document.getElementById('appError').getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect().bottom; return r.height > 0 && r.top >= nav && r.bottom <= innerHeight; })(),
    fieldInView: (() => { const f = document.activeElement.getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect().bottom; return f.height > 0 && f.top >= nav && f.bottom <= innerHeight; })(),
    // the message sits directly under the flagged box (or above the button when the whole form is the problem)
    errUnderField: (() => { const e = document.getElementById('appError'), p = e.parentElement, a = document.activeElement; return p.classList.contains('field') && a !== document.body && p.contains(a) && e.getBoundingClientRect().top >= a.getBoundingClientRect().bottom - 1; })(),
    errAboveSubmit: (() => { const n = document.getElementById('appError').nextElementSibling; return !!n && n.id === 'appSubmit'; })(),
  }));
  const submit = () => page.locator('#appSubmit').click();
  const ok = (r, text, id) => r.errVisible && r.err === text && r.focus === id && r.invalid === id && r.sent === 0 && !r.success && dialogs.length === 0 && r.errInView && r.fieldInView && r.errUnderField;
  // the message does not touch or cover anything: a gap under the flagged box, and no other label, box or button overlaps it
  const gaps = () => page.evaluate(() => {
    const e = document.getElementById('appError'), er = e.getBoundingClientRect(), f = document.activeElement.getBoundingClientRect();
    const overlaps = [...document.querySelectorAll('#appForm input, #appForm select, #appForm textarea, #appForm label, #appForm button')]
      .filter(x => x !== document.activeElement && !e.contains(x))
      .filter(x => { const r = x.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.left < er.right && r.right > er.left && r.top < er.bottom && r.bottom > er.top; })
      .map(x => x.id || x.name || x.tagName);
    return { above: Math.round(er.top - f.bottom), overlaps, narrower: Math.round(e.parentElement.getBoundingClientRect().width - er.width) };
  });

  // required fields, in order, each with its own message
  await submit();
  let r = await state();
  check('blank application: asks for the first name, sends nothing', ok(r, 'Please enter your first name.', 'app-first'), r);
  r = await page.evaluate((sel) => { const b = document.querySelector(sel); return { color: getComputedStyle(b).color, wide: b.getBoundingClientRect().width >= b.parentElement.getBoundingClientRect().width - 1 }; }, '#appError');
  check('careers form: error text is dark and fills the width it is given', r.color === 'rgb(138, 42, 13)' && r.wide, r);
  r = await gaps();
  check('the message sits under the flagged box and covers nothing', r.above >= 4 && r.overlaps.length === 0 && r.narrower <= 1, r);
  await page.locator('#app-first').fill('   ');
  await submit();
  r = await state();
  check('a first name of only spaces counts as blank', ok(r, 'Please enter your first name.', 'app-first'), r);
  await page.locator('#app-first').fill('Zoë');
  await submit();
  r = await state();
  check('then the last name', ok(r, 'Please enter your last name.', 'app-last'), r);
  await page.locator('#app-last').fill("O'Brien");
  for (const bad of ['', 'abc', 'a@b', 'jane smith@x.com']) {
    await page.locator('#app-email').fill(bad);
    await submit();
    r = await state();
    check('rejects the email "' + bad + '"', ok(r, 'Please enter a valid email address, like jane@example.com.', 'app-email'), r);
  }
  await page.locator('#app-email').fill("zoe.o'brien@example.com");
  for (const bad of ['', '123', '04 12']) {
    await page.locator('#app-phone').fill(bad);
    await submit();
    r = await state();
    check('rejects the phone "' + bad + '"', ok(r, 'Please enter a phone number we can reach you on.', 'app-phone'), r);
  }
  await page.locator('#app-phone').fill('+61 412 345 678');
  await page.locator('#app-dob').fill('2999-01-01');
  await submit();
  r = await state();
  check('a date of birth in the future is refused', ok(r, 'Please check your date of birth.', 'app-dob'), r);
  await page.locator('#app-dob').fill('');
  await submit();
  r = await state();
  check('then the experience level', ok(r, 'Please choose your experience level.', 'app-exp-level'), r);
  await page.locator('#app-exp-level').selectOption({ index: 1 });

  // files
  await page.locator('#app-resume').setInputFiles({ name: 'resume.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  await submit();
  r = await state();
  check('a resume that is not PDF or Word is refused', ok(r, 'The file for your resume needs to be a PDF or Word document.', 'app-resume'), r);
  await page.locator('#app-resume').setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await submit();
  r = await state();
  check('files over 10 MB in total are refused with a clear message', r.errVisible && /add up to 11\.0 MB, and the limit is 10 MB/.test(r.err) && r.sent === 0 && !r.success, r);
  await page.locator('#app-resume').setInputFiles([]);
  // a big file left in a section that does not apply must not count or be sent
  await page.locator('#police-card').setInputFiles({ name: 'police.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });

  // failures keep the form and everything typed, never show success
  await page.locator('#app-exp-detail').fill('Ran FOH for a school musical. <script>alert(1)</script> \u{1F3A4}');
  const failures = [
    ['500', /^Sorry, your application did not send\. Please try again, or email mitchel@urbanecho\.com\.au\.$/],
    ['422', /^Something in the form was not accepted/],
    ['413', /^Your files are too large/],
    ['429', /^Too many attempts/],
    ['network', /^Sorry, your application did not send/],
  ];
  for (const [mode, re] of failures) {
    await page.evaluate(m => { window.__mode = m; }, mode);
    await submit();
    await page.waitForFunction(() => !document.getElementById('appError').hidden && !document.getElementById('appSubmit').disabled);
    r = await state();
    const kept = await page.locator('#app-first').inputValue();
    check('server says ' + mode + ': clear message, no false success, form and typing kept, email option offered',
      re.test(r.err) && r.errInView && r.errAboveSubmit && r.formShown && !r.success && r.btn === 'Submit Application →' && !r.btnDisabled && kept === 'Zoë' &&
      /^mailto:mitchel@urbanecho\.com\.au\?subject=/.test(r.fallback) && decodeURIComponent(r.fallback).includes('Name: Zoë O\'Brien') && r.clickup === 0 && dialogs.length === 0, { r, kept });
  }
  await context.setOffline(true);
  await page.evaluate(() => { window.__mode = 'network'; });
  await submit();
  await page.waitForFunction(() => /offline/.test(document.getElementById('appError').textContent));
  await context.setOffline(false);
  check('offline: says so', true);

  // success: tidy text, long text cut, hidden upload dropped
  await page.locator('#app-exp-detail').fill('x'.repeat(5000));
  await page.locator('#app-notes').fill('  line one\r\nline two  ');
  await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
  await submit();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('appSuccess')).display !== 'none');
  r = await state();
  const sent = await page.evaluate(() => window.__sent);
  const fs = sent.find(s => /formspree/.test(s.url));
  const cu = sent.find(s => /workers\.dev/.test(s.url));
  check('success: shows the thank-you, hides the form, sends once', r.success && !r.formShown && r.sent === 1, r);
  check('success: the message box is back above the button and empty', r.errAboveSubmit && !r.errVisible && r.err === '', r);
  check('what is sent is tidy: names kept as typed, long text cut to 2000, notes trimmed',
    fs && fs.body.first_name === 'Zoë' && fs.body.last_name === "O'Brien" && fs.body.experience_detail.length === 2000 && fs.body.notes === 'line one\nline two' && fs.hasSignal, fs && { ...fs, body: { ...fs.body, experience_detail: fs.body.experience_detail.length } });
  check('a file left in a section that does not apply is not sent', fs && !('police_card' in fs.body), fs && Object.keys(fs.body));
  check('the team record (ClickUp) gets the same values', cu && cu.body.first_name === 'Zoë' && cu.body.email === "zoe.o'brien@example.com" && cu.body.experience_detail.length === 2000, cu);

  // reload for the remaining cases
  await page.goto(BASE + '/careers/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#appForm');
  const fillValid = async () => {
    await page.locator('#app-first').fill('Pat');
    await page.locator('#app-last').fill('Lee');
    await page.locator('#app-email').fill('pat@example.com');
    await page.locator('#app-phone').fill('0412 345 678');
    await page.locator('#app-exp-level').selectOption({ index: 2 });
  };
  await fillValid();
  await page.evaluate(() => { document.querySelector('#appForm [name=_gotcha]').value = 'gotcha'; });
  await submit();
  r = await state();
  check('hidden trap field filled: shows success but sends nothing', r.success && r.sent === 0 && r.clickup === 0, r);

  await page.goto(BASE + '/careers/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#appForm');
  await fillValid();
  await page.locator('#appSubmit').dblclick();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('appSuccess')).display !== 'none');
  r = await state();
  check('double click sends only once', r.sent === 1, r);

  await page.goto(BASE + '/careers/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#appForm');
  await fillValid();
  await page.evaluate(() => { window.__mode = 'hang'; });
  await submit();
  r = await state();
  check('while waiting the button says Sending', r.btn === 'Sending…' && r.btnDisabled, r);
  await page.clock.fastForward(61000);
  await page.waitForFunction(() => !document.getElementById('appError').hidden);
  r = await state();
  check('after 60 seconds it gives up with a clear message and a working button', /^Sorry, your application did not send/.test(r.err) && !r.btnDisabled && r.btn === 'Submit Application →' && r.formShown && !r.success, r);

  // WWC card number: asked instead of a photo of the card
  const fresh = async () => {
    await page.goto(BASE + '/careers/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#appForm');
    await fillValid();
  };
  const pick = (name, value) => page.locator('input[name="' + name + '"][value="' + value + '"]').check();
  const numberBoxShown = () => page.evaluate(() => getComputedStyle(document.getElementById('wwc-number-field')).display !== 'none');
  const sendOk = async () => {
    await page.evaluate(() => { window.__mode = 'ok'; window.__sent.length = 0; });
    await submit();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('appSuccess')).display !== 'none');
    const all = await page.evaluate(() => window.__sent);
    return { fs: all.find(s => /formspree/.test(s.url)), cu: all.find(s => /workers\.dev/.test(s.url)) };
  };

  await fresh();
  const gone = await page.evaluate(() => ({ file: !!document.querySelector('[name=wwc_card], #wwc-card'), type: (document.getElementById('app-wwc-number') || {}).type }));
  check('the WWC question asks for a number, not a file', !gone.file && gone.type === 'text', gone);
  if (gone.type !== 'text') { await browser.close(); process.exit(1); } // nothing below can work without the number box
  check('the number box starts hidden', !(await numberBoxShown()));
  await pick('wwc', 'Yes, current');
  check('"Yes, current" shows the number box, and it has a label', (await numberBoxShown()) && (await page.getByLabel('WWC card number').count()) === 1);
  await pick('wwc', 'No, willing to get one');
  check('any other answer hides it again', !(await numberBoxShown()));
  await pick('wwc', 'Yes, current');
  const wwcMessage = 'Please check your WWC card number. It should only use letters and numbers. If you do not have it handy, leave it blank.';
  for (const bad of ['!!!', '12', 'ABCDEFGH', '<script>alert(1)</script>', "1234'; DROP TABLE x;--"]) {
    await page.locator('#app-wwc-number').fill(bad);
    await submit();
    r = await state();
    check('rejects the WWC number "' + bad + '", sends nothing', ok(r, wwcMessage, 'app-wwc-number'), r);
  }
  r = await gaps();
  check('the WWC message sits under the number box and covers nothing', r.above >= 4 && r.overlaps.length === 0 && r.narrower <= 1, r);
  await page.locator('#app-wwc-number').fill('  wwc 0123456e  ');
  let out = await sendOk();
  check('a valid number is tidied (spaces, capitals) and sent with the application',
    out.fs && out.fs.body.wwc === 'Yes, current' && out.fs.body.wwc_number === 'WWC 0123456E' && !('wwc_card' in out.fs.body), out.fs && out.fs.body);
  check('the team record (ClickUp) gets the number too', out.cu && out.cu.body.wwc_number === 'WWC 0123456E' && out.cu.body.wwc === 'Yes, current', out.cu);

  await fresh();
  await pick('wwc', 'Yes, current');
  await page.locator('#app-wwc-number').fill('!!!');
  await pick('wwc', 'No, willing to get one');
  out = await sendOk();
  check('a number typed and then not needed is neither checked nor sent',
    out.fs && !('wwc_number' in out.fs.body) && out.cu && out.cu.body.wwc_number === '' && out.cu.body.wwc === 'No, willing to get one', out);

  await fresh();
  await pick('wwc', 'Yes, current');
  out = await sendOk();
  check('a blank number is allowed, because it is optional', out.fs && out.fs.body.wwc === 'Yes, current' && out.fs.body.wwc_number === '', out.fs && out.fs.body);

  await fresh();
  await pick('wwc', 'Yes, current');
  await page.locator('#app-wwc-number').fill('9'.repeat(100));
  out = await sendOk();
  check('a very long number is cut to 30 characters', out.fs && (out.fs.body.wwc_number || '').length === 30, out.fs && out.fs.body.wwc_number);

  await fresh();
  await pick('wwc', 'Yes, current');
  await page.locator('#app-wwc-number').fill('WWC 0123456E');
  await page.evaluate(() => { window.__mode = '500'; });
  await submit();
  await page.waitForFunction(() => !document.getElementById('appError').hidden && !document.getElementById('appSubmit').disabled);
  r = await state();
  check('if sending fails, the email fallback carries the number too', decodeURIComponent(r.fallback).includes('WWC card number: WWC 0123456E'), r.fallback);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors);
  check('no pop-up dialogs at any point', dialogs.length === 0, dialogs);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
