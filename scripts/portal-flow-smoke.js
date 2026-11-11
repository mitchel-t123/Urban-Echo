// Onboarding Flow smoke test. Expects docs/ to be served on http://localhost:9876.
// Uses a fake in-memory database, so it needs no login and touches no real data.
const { chromium } = require('playwright');

const BASE = 'http://localhost:9876/portal.html';
let failed = false;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   <-- ' + JSON.stringify(detail)));
  if (!ok) failed = true;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.route(u => u.hostname !== 'localhost', r => r.abort());
  await page.goto(BASE);
  await page.evaluate(() => {
    document.body.classList.remove('auth-pending');
    const l = document.getElementById('authLoader');
    if (l) { l.classList.remove('show'); l.style.display = 'none'; }
  });
  await page.waitForFunction(() => typeof obMountFlow === 'function');

  // open a step the way a person would, by clicking its heading, if it is closed
  const ensureOpen = async n => {
    if (!(await page.evaluate(n => document.getElementById('obStep' + n).classList.contains('is-open'), n))) await page.locator('#obStep' + n + ' .ob-step-head').click();
  };

  // a normal crew member must never see the view or its button
  await page.evaluate(() => { location.hash = '#onboarding'; });
  await page.waitForFunction(() => location.hash === '#onboarding');
  let r = await page.evaluate(() => ({
    view: document.body.classList.contains('view-onboarding'),
    btn: getComputedStyle(document.getElementById('obFlowBtn')).display,
  }));
  check('non-admin: #onboarding is ignored and the button is hidden', !r.view && r.btn === 'none', r);
  await page.evaluate(() => { location.hash = ''; });

  // become super admin with a fake database
  await page.evaluate(() => {
    window.__log = [];
    window.__people = [
      { id: 'p1', first_name: 'sam', last_name: 'Lee', email: 'sam@example.com', role: 'team', wwc_number: 'WWC123', police_ref: null, onboarding_checklist: { contract: true } },
      { id: 'p2', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', role: 'team', wwc_number: null, police_ref: null, onboarding_checklist: {} },
      { id: 'p3', first_name: 'Alex', last_name: 'Done', email: 'alex@example.com', role: 'team', wwc_number: 'W9', police_ref: 'P9',
        onboarding_checklist: { contract: true, conduct: true, slack_main: true, slack_team: true, coffee: true, induction: true, shadow: true, rentman: true, portal: true, payroll: true } },
    ];
    window.supabaseClient = { from() {
      const st = { op: 'select', filter: null, payload: null, single: false };
      const b = {
        select() { return b; },
        update(p) { st.op = 'update'; st.payload = p; return b; },
        order() { return b; },
        eq(k, v) { st.filter = v; return b; },
        single() { st.single = true; return b; },
        then(res, rej) {
          let out;
          const row = window.__people.find(p => p.id === st.filter);
          if (st.op === 'update') {
            if (window.__failNext) { window.__failNext = false; out = { error: { message: 'boom' } }; }
            else { Object.assign(row, st.payload); window.__log.push({ id: st.filter, payload: JSON.parse(JSON.stringify(st.payload)) }); out = { error: null }; }
          } else if (st.single) out = { data: row ? { onboarding_checklist: JSON.parse(JSON.stringify(row.onboarding_checklist)) } : null, error: null };
          else out = { data: JSON.parse(JSON.stringify(window.__people)), error: null };
          return new Promise(x => setTimeout(x, 30)).then(() => out).then(res, rej);
        },
      };
      return b;
    } };
    document.body.classList.add('portal-super-admin');
    obMountFlow();
    document.getElementById('addCrewSection').style.display = 'block';
  });
  r = await page.evaluate(() => ({
    go: getComputedStyle(document.getElementById('obFlowBtn')).display,
    sops: !!document.getElementById('sopsSection').closest('#onboardingView'),
    add: !!document.getElementById('addCrewSection').closest('#onboardingView'),
  }));
  check('admin: button shown and resources / add-crew moved into the flow', r.go !== 'none' && r.sops && r.add, r);

  // real click opens the view
  await page.locator('#obFlowBtn').click();
  await page.waitForSelector('.ob-person');
  r = await page.evaluate(() => ({
    hash: location.hash,
    cls: document.body.classList.contains('view-onboarding'),
    title: [...document.querySelectorAll('.portal-header h1')].filter(h => h.offsetParent).map(h => h.textContent).join(),
    mainVisible: [...document.querySelectorAll('main > section')].filter(s => s.id !== 'onboardingView').some(s => s.offsetParent),
  }));
  check('click opens the Onboarding Flow view and hides the main portal', r.hash === '#onboarding' && r.cls && r.title === 'Onboarding Flow' && !r.mainVisible, r);

  // every ClickUp button in the flow goes straight to the Applications list, in a new tab
  r = await page.evaluate(() => [...document.querySelectorAll('#onboardingView a[data-ql="task_mgmt"]')].map(a => ({ href: a.href, text: a.textContent.trim(), target: a.target, rel: a.rel })));
  check('every "Open ClickUp" button in the flow opens the Applications list in a new tab',
    r.length > 0 && r.every(a => a.href === 'https://app.clickup.com/9016776291/v/l/li/901617712363' && a.text === 'Open ClickUp' && a.target === '_blank' && /noopener/.test(a.rel)), r);

  // people listed inline
  r = await page.evaluate(() => ({
    summary: document.getElementById('obSummary').textContent,
    names: [...document.querySelectorAll('.ob-person-name')].map(e => e.textContent).sort().join('|'),
    decline: !!document.querySelector('#obDeclineWrap > summary').offsetParent,
  }));
  check('everyone is listed inline with a summary', r.names === 'Alex Done|Jane Smith|sam Lee' && /3 crew/.test(r.summary), r);
  check('decline card is visible with nobody selected', r.decline, r);
  r = await page.evaluate(() => { const h = document.getElementById('obToolsHome'); return { decline: document.getElementById('obDeclineWrap').parentElement.id, invite: document.getElementById('obAddCrewWrap').parentElement.id, homeShown: !!h && !h.hidden }; });
  check('with nobody picked, the invite and decline cards wait above the list', r.decline === 'obToolsHome' && r.invite === 'obToolsHome' && r.homeShown, r);

  // select Sam: steps reflect saved data
  await page.locator('.ob-person[data-id="p1"]').click();
  await page.waitForSelector('#obPanel:not([hidden])');
  r = await page.evaluate(() => ({
    decline: !!document.getElementById('obDeclineWrap').closest('#obStep2Body'),
    invite: !!document.getElementById('obAddCrewWrap').closest('#obStep9Body'),
    form: !!document.getElementById('inviteEmail').closest('#obStep9Body'),
    homeEmpty: (() => { const h = document.getElementById('obToolsHome'); return !!h && h.children.length === 0 && h.hidden; })(),
  }));
  check('with someone picked, the decline card is in step 2 and the invite card is in step 9, and nothing is left above', r.decline && r.invite && r.form && r.homeEmpty, r);
  r = await page.evaluate(() => ({
    name: document.getElementById('obPName').textContent,
    next: document.getElementById('obNext').textContent.replace(/\s+/g, ' '),
    s3: document.getElementById('obStep3').className,
    s4: document.getElementById('obStep4').className,
    contract: document.querySelector('#obStep3 input[data-key=contract]').checked,
    wwc: document.querySelector('input[data-key=wwc]').checked && document.querySelector('input[data-key=wwc]').disabled,
    police: document.querySelector('input[data-key=police]').checked,
  }));
  check('panel shows the person, the next step, and saved ticks', r.name === 'sam Lee' && /Next step: 4\. Confirm compliance checks/.test(r.next) && r.contract && r.wwc && !r.police, r);
  const lines = await page.evaluate(() => [1, 2, 3, 4, 5].map(n => getComputedStyle(document.getElementById('obStep' + n), '::before').display));
  check('a finished step shows just the green tick with no line below it, and steps still to do keep their line', lines.join() === 'none,none,none,block,block', lines);
  check('done steps collapse, the current step is open',/is-done/.test(r.s3) && !/is-open/.test(r.s3) && /is-current/.test(r.s4) && /is-open/.test(r.s4), r);

  // ticking saves instantly and merges with existing data
  await page.locator('#obStep6 label.ob-check').click();
  await page.waitForFunction(() => window.__log.length >= 1);
  r = await page.evaluate(() => ({ log: window.__log[0], card: document.querySelector('.ob-person[data-id="p1"] .ob-person-next').textContent }));
  check('tick saves with the existing checklist merged in', r.log.payload.onboarding_checklist.coffee === true && r.log.payload.onboarding_checklist.contract === true, r);
  check('the person card updates immediately (3 of 12)', /3 of 12/.test(r.card), r);
  await page.waitForFunction(() => document.getElementById('obSave').classList.contains('ok'));

  // a failed save reverts the tick and says so
  await page.evaluate(() => { window.__failNext = true; });
  await page.locator('#obStep5 label.ob-check').first().click();
  await page.waitForFunction(() => document.getElementById('obSave').classList.contains('err'));
  r = await page.evaluate(() => ({ checked: document.querySelector('#obStep5 input[data-key=slack_main]').checked, pill: document.getElementById('obSave').textContent }));
  check('a failed save reverts the tick and shows an error', r.checked === false && /Not saved/.test(r.pill), r);

  // emails: first name filled, per-person drafts, reset
  await page.locator('#obStep3 .ob-step-head').click();
  await page.locator('#obStep3 .ob-email-toggle').click();
  r = await page.evaluate(() => { const t = document.querySelector('#obStep3 .ob-email-edit').innerText; return { hey: /Hey Sam!/.test(t), placeholder: /\[First Name\]/.test(t) }; });
  check('welcome email says "Hey Sam!" (name filled and capitalised)', r.hey && !r.placeholder, r);
  await page.locator('#obStep3 .ob-email-edit').click();
  await page.keyboard.type(' ZZZ-EDIT');
  await page.waitForFunction(() => (localStorage.getItem('ob-draft:p1:welcome1') || '').includes('ZZZ-EDIT'));
  await page.locator('.ob-person[data-id="p2"]').click();
  await page.waitForFunction(() => document.getElementById('obPName').textContent === 'Jane Smith');
  r = await page.evaluate(() => { const t = document.querySelector('#obStep3 .ob-email-edit').innerText; return { jane: /Hey Jane!/.test(t), clean: !/ZZZ-EDIT/.test(t) }; });
  check('another person gets their own name and not the edit', r.jane && r.clean, r);
  await page.locator('.ob-person[data-id="p1"]').click();
  await page.waitForFunction(() => document.getElementById('obPName').textContent === 'sam Lee');
  r = await page.evaluate(() => /ZZZ-EDIT/.test(document.querySelector('#obStep3 .ob-email-edit').innerText));
  check('the draft is restored when you return to the person', r, r);
  await page.locator('#obStep3 .ob-step-head').click();
  await page.locator('#obStep3 [data-act=reset]').click();
  r = await page.evaluate(() => ({ gone: !/ZZZ-EDIT/.test(document.querySelector('#obStep3 .ob-email-edit').innerText), stored: localStorage.getItem('ob-draft:p1:welcome1') }));
  check('reset to template clears the draft', r.gone && r.stored === null, r);

  // decline email fills the typed name
  await ensureOpen(2);
  await page.locator('#obDeclineWrap > summary').click();
  await page.locator('#obDeclineName').fill('alex');
  r = await page.evaluate(() => ({ fills: [...document.querySelectorAll('#obDecline .ob-fill')].map(s => s.textContent).join(), text: document.querySelector('#obDecline .ob-email-edit').innerText }));
  check('decline email fills the typed name and keeps the application on file', r.fills === 'Alex' && /keep your application on file/.test(r.text), r);

  // full grid ticks save too
  await page.locator('.ob-grid-wrap > summary').click();
  await page.locator('.ob-cell[data-id="p2"][data-key="coffee"]').click();
  await page.waitForFunction(() => window.__log.some(l => l.id === 'p2'));
  r = await page.evaluate(() => document.querySelector('.ob-person[data-id="p2"] .ob-person-next').textContent);
  check('a grid tick saves and updates the card (1 of 12)', /1 of 12/.test(r), r);

  // invite prefill
  await ensureOpen(9);
  await page.locator('#obStep9 [data-act=invite]').click();
  r = await page.evaluate(() => ({ open: document.getElementById('obAddCrewWrap').open, email: document.getElementById('inviteEmail').value, visible: !!document.getElementById('inviteEmail').offsetParent }));
  check('Send portal invite opens the form, in step 9, prefilled', r.open && r.visible && r.email === 'sam@example.com', r);

  // sending an invite hands the server the sign-in token, and shows what happened
  await page.evaluate(() => {
    window.clerkInstance = { session: { getToken: async () => 'tok_test' } };
    window.__invites = [];
    window.__inviteReply = { status: 200, body: { ok: true, invitation_id: 'inv_1' } };
    const realFetch = window.fetch;
    window.fetch = (url, init) => {
      if (String(url).indexOf('/functions/v1/invite-crew') === -1) return realFetch(url, init);
      window.__invites.push({ url: String(url), body: JSON.parse(init.body) });
      return Promise.resolve(new Response(JSON.stringify(window.__inviteReply.body), { status: window.__inviteReply.status }));
    };
  });
  await page.locator('#inviteBtn').click();
  await page.waitForFunction(() => /Invite sent to/.test(document.getElementById('inviteMsg').textContent));
  r = await page.evaluate(() => ({ call: window.__invites[0], msg: document.getElementById('inviteMsg').textContent }));
  check('sending an invite includes the sign-in token', r.call && r.call.body.clerk_token === 'tok_test' && r.call.body.email === 'sam@example.com' && /\/functions\/v1\/invite-crew$/.test(r.call.url), r);

  await page.evaluate(() => {
    window.__inviteReply = { status: 200, body: { ok: true, warning: 'Invite sent, but the crew list could not be updated.' } };
    document.getElementById('inviteEmail').value = 'new@example.com';
  });
  await page.locator('#inviteBtn').click();
  await page.waitForFunction(() => /could not be updated/.test(document.getElementById('inviteMsg').textContent));
  r = await page.evaluate(() => ({ msg: document.getElementById('inviteMsg').textContent, color: document.getElementById('inviteMsg').style.color }));
  check('a partial success shows the warning, not a plain "sent"', r.msg === 'Invite sent, but the crew list could not be updated.' && /orange/.test(r.color), r);

  await page.evaluate(() => {
    window.__inviteReply = { status: 403, body: { error: 'Only a super admin can send invites.' } };
    document.getElementById('inviteEmail').value = 'again@example.com';
  });
  await page.locator('#inviteBtn').click();
  await page.waitForFunction(() => /super admin/.test(document.getElementById('inviteMsg').textContent));
  r = await page.evaluate(() => ({ msg: document.getElementById('inviteMsg').textContent, email: document.getElementById('inviteEmail').value }));
  check('a refusal from the server is shown and the email is kept', r.msg === 'Only a super admin can send invites.' && r.email === 'again@example.com', r);

  // fully onboarded person: final email one click away
  await page.locator('.ob-person[data-id="p3"]').click();
  await page.waitForFunction(() => document.getElementById('obPName').textContent === 'Alex Done');
  await page.locator('[data-act=final-email]').click();
  r = await page.evaluate(() => ({ vis: !!document.querySelector('#obStep9 .ob-email-edit').offsetParent, hey: /Hey Alex!/.test(document.querySelector('#obStep9 .ob-email-edit').innerText) }));
  check('final welcome email opens with the name filled', r.vis && r.hey, r);

  // Gmail buttons open a message addressed to the person with the subject filled in
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return {}; }; });
  const gmail = async (sel) => {
    await page.evaluate(() => { window.__opened.length = 0; });
    await page.locator(sel).click();
    const u = await page.evaluate(() => window.__opened[0] || '');
    if (!u) return null;
    const x = new URL(u);
    return { host: x.host, view: x.searchParams.get('view'), to: x.searchParams.get('to'), su: x.searchParams.get('su'), authuser: x.searchParams.get('authuser') };
  };
  r = await gmail('#obStep9 [data-compose=welcome2]');
  check('final email opens Gmail to Alex with the right subject', r && r.host === 'mail.google.com' && r.view === 'cm' && r.to === 'alex@example.com' && r.su === 'Welcome to the Urban Echo Crew! \u{1F389}' && !r.authuser, r);
  await page.locator('.ob-person[data-id="p1"]').click();
  await page.waitForFunction(() => document.getElementById('obPName').textContent === 'sam Lee');
  if (!(await page.evaluate(() => document.getElementById('obStep3').classList.contains('is-open')))) await page.locator('#obStep3 .ob-step-head').click();
  if (await page.evaluate(() => document.querySelector('#obStep3 .ob-email-body').hidden)) await page.locator('#obStep3 .ob-email-toggle').click();
  r = await gmail('#obStep3 [data-compose=welcome1]');
  check('welcome email opens Gmail to Sam with the right subject', r && r.to === 'sam@example.com' && r.su === "Welcome to Urban Echo, You're In! \u{1F389}", r);
  await page.evaluate(() => { window.clerkInstance = { user: { emailAddresses: [{ emailAddress: 'mitchel@urbanecho.com.au' }] } }; });
  r = await gmail('#obStep3 [data-compose=welcome1]');
  check('opens from the urbanecho.com.au account when signed in with it', r && r.authuser === 'mitchel@urbanecho.com.au', r);
  await page.evaluate(() => { window.clerkInstance = { user: { emailAddresses: [{ emailAddress: 'someone@gmail.com' }] } }; });
  r = await gmail('#obStep3 [data-compose=welcome1]');
  check('does not force an account for other addresses', r && !r.authuser, r);
  await page.evaluate(() => { window.clerkInstance = null; });
  await ensureOpen(2);
  await page.locator('#obDeclineWrap').evaluate(el => { el.open = true; });
  r = await gmail('#obDecline [data-compose=decline]');
  check('decline opens Gmail with the subject and no recipient yet', r && r.to === null && r.su === 'Your Urban Echo application', r);
  await page.locator('#obDeclineEmail').fill('alex@example.com');
  r = await gmail('#obDecline [data-compose=decline]');
  check('decline opens Gmail addressed to the typed email', r && r.to === 'alex@example.com', r);

  // the crew list shows hostile names and emails as plain text and runs nothing
  await page.evaluate(() => {
    window.__xss = 0;
    window.__people.push({ id: 'p9', first_name: '<img src=x onerror="window.__xss=1">', last_name: '"><b>x</b>', email: 'e"><i>@example.com', role: 'team', wwc_number: null, police_ref: null, onboarding_checklist: {} });
  });
  await page.evaluate(async () => { await loadCrewUsers(); });
  await page.waitForFunction(() => document.querySelectorAll('#crewUserList .crew-user-row').length >= 4);
  r = await page.evaluate(() => ({
    ran: window.__xss === 1,
    injected: document.querySelectorAll('#crewUserList img, #crewUserList b, #crewUserList i').length,
    shownAsText: document.getElementById('crewUserList').innerText.indexOf('<img src=x') !== -1,
    uids: [...document.querySelectorAll('#crewUserList select')].map(s => s.dataset.uid).sort().join(','),
  }));
  check('crew list renders hostile names as plain text and runs nothing', !r.ran && r.injected === 0 && r.shownAsText && r.uids === 'p1,p2,p3,p9', r);

  // hostile names inside the Onboarding Flow itself: people cards, the panel and the emails
  await page.evaluate(async () => { window.__xss = 0; await obFlowReload(); });
  await page.waitForSelector('.ob-person[data-id="p9"]');
  await page.locator('.ob-person[data-id="p9"]').click();
  await page.waitForFunction(() => document.getElementById('obPName').textContent.indexOf('<img src=x') !== -1);
  if (!(await page.evaluate(() => document.getElementById('obStep3').classList.contains('is-open')))) await page.locator('#obStep3 .ob-step-head').click();
  if (await page.evaluate(() => document.querySelector('#obStep3 .ob-email-body').hidden)) await page.locator('#obStep3 .ob-email-toggle').click();
  await ensureOpen(2);
  await page.locator('#obDeclineWrap').evaluate(el => { el.open = true; });
  await page.locator('#obDeclineName').fill('<img src=x onerror="window.__xss=1">');
  await page.waitForTimeout(600);
  r = await page.evaluate(() => ({
    ran: window.__xss === 1,
    injected: document.querySelectorAll('#onboardingView [onerror], #onboardingView img[src="x"]').length,
    cardAsText: document.querySelector('.ob-person[data-id="p9"]').textContent.indexOf('<img src=x') !== -1,
    emailAsText: document.querySelector('#obStep3 .ob-email-edit').innerText.indexOf('<img src=x') !== -1,
    declineAsText: document.querySelector('#obDecline .ob-email-edit').innerText.indexOf('<img src=x') !== -1,
  }));
  check('hostile names in the flow cards, panel and emails are shown as text and run nothing', !r.ran && r.injected === 0 && r.cardAsText && r.emailAsText && r.declineAsText, r);

  // structure stays sound after mounting
  r = await page.evaluate(() => {
    const out = [];
    for (const m of document.querySelectorAll('.modal-overlay, .hb-modal')) for (let p = m.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.matches('.modal-overlay, .hb-modal')) out.push(m.id + ' nested in ' + p.id);
      else if (getComputedStyle(p).display === 'none' && !p.closest('#onboardingView')) out.push(m.id + ' under hidden ' + (p.id || p.tagName));
    }
    const seen = {}; document.querySelectorAll('[id]').forEach(e => seen[e.id] = (seen[e.id] || 0) + 1);
    return { out, dups: Object.keys(seen).filter(k => seen[k] > 1) };
  });
  check('no nested modals or duplicate ids after mounting', r.out.length === 0 && r.dups.length === 0, r);

  // back to the portal, and the browser back button returns
  await page.locator('#obBackBtn').click();
  await page.waitForFunction(() => !document.body.classList.contains('view-onboarding'));
  r = await page.evaluate(() => ({ title: [...document.querySelectorAll('.portal-header h1')].filter(h => h.offsetParent).map(h => h.textContent).join(), venue: !!document.querySelector('#openRiskBtn').offsetParent }));
  check('Back to Portal restores the portal', r.title === 'Team Portal' && r.venue, r);
  await page.goBack();
  await page.waitForFunction(() => document.body.classList.contains('view-onboarding'));
  check('the browser back button returns to the flow', true);

  // phone width
  await page.setViewportSize({ width: 390, height: 844 });
  r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check('no horizontal page scroll at phone width', r.sw <= r.iw + 1, r);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
