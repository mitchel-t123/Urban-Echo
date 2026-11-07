// Team Admin smoke test. Expects docs/ to be served on http://localhost:9876.
// Runs the page's real startup with a stand-in Clerk and Supabase, so it needs no login.
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:9876';
let failed = false;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '   <-- ' + JSON.stringify(detail)));
  if (!ok) failed = true;
}

const FAKE_CLERK = "window.Clerk={load:async()=>{},user:{id:'user_3GWcEQB1aIQ9VX3mF4ZOd3gF9IV'},session:{getToken:async()=>'t'}};";
const FAKE_SUPABASE = `
window.supabase={createClient:function(){
  window.__updates=[];
  var rows=[
    {id:'u2',first_name:'x autofocus onfocus=window.__xss=1 style=animation-name:pulse;animation-duration:1s onanimationstart=window.__xss=1 y',last_name:'"><b>x</b>',email:'a@example.com',wwc_number:'1',onboarding_checklist:{}},
    {id:'u3',first_name:'Normal',last_name:'Person',email:'n@example.com',wwc_number:'2',onboarding_checklist:{contract:true}}
  ];
  return {from:function(){
    var st={};
    var b={select:function(){return b},order:function(){return b},eq:function(k,v){st.id=v;return b},
      update:function(p){st.update=p;return b},
      then:function(res,rej){
        var out;
        if(st.update){window.__updates.push({id:st.id,payload:st.update});out={error:null};}
        else out={data:JSON.parse(JSON.stringify(rows)),error:null};
        return Promise.resolve(out).then(res,rej);
      }};
    return b;
  }};
}};`;

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [], redirects = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.isNavigationRequest() && /\/login/.test(r.url())) redirects.push(r.url()); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE) && !/\/login/.test(u)) return route.continue();
    if (u.includes('clerk.browser.js')) return route.fulfill({ contentType: 'text/javascript', body: FAKE_CLERK });
    if (u.includes('supabase-js')) return route.fulfill({ contentType: 'text/javascript', body: FAKE_SUPABASE });
    return route.abort('aborted');
  });
  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#teamTableBody tr');

  let r = await page.evaluate(() => ({
    rows: document.querySelectorAll('#teamTableBody tr').length,
    visible: getComputedStyle(document.body).visibility,
  }));
  check('Team Admin starts and lists the team', r.rows === 2 && r.visible === 'visible' && redirects.length === 0, { r, redirects });

  await page.waitForTimeout(1200);
  r = await page.evaluate(() => ({
    ran: window.__xss === 1,
    injected: document.querySelectorAll('#teamTableBody b, #teamTableBody [onfocus], #teamTableBody [onanimationstart]').length,
    attrs: [...document.querySelector('#teamTableBody button').attributes].map(a => a.name).join(','),
  }));
  check('hostile names in the team table run nothing', !r.ran && r.injected === 0 && r.attrs === 'type,class,data-edit', r);

  await page.locator('#teamTableBody button[data-edit="u3"]').click();
  r = await page.evaluate(() => ({ open: document.getElementById('memberModal').classList.contains('open'), first: document.getElementById('fFirst').value, title: document.getElementById('modalTitle').textContent }));
  check('Edit opens the member form filled in', r.open && r.first === 'Normal' && r.title === 'Edit Member', r);

  await page.locator('#modalClose').click();
  r = await page.evaluate(() => document.getElementById('memberModal').classList.contains('open'));
  check('the member form closes again', r === false, r);

  await page.waitForSelector('#obTableBody button[data-ob-id]');
  await page.locator('#obTableBody button[data-ob-id="u3"][data-ob-key="coffee"]').click();
  await page.waitForFunction(() => window.__updates.length >= 1);
  r = await page.evaluate(() => window.__updates[0]);
  check('a tracker tick saves for the right person', r.id === 'u3' && r.payload.onboarding_checklist.coffee === true && r.payload.onboarding_checklist.contract === true, r);

  check('no uncaught page errors', errors.length === 0, errors);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
