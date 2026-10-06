// Run like ui-smoke.mjs: node docs/demo-reset-ui.check.mjs <puppeteer-module-path> [chrome-path] [frontend-url]
// Intercepted API responses only; never deletes live records or uploads.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const module = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'puppeteer');
const browser = await (module.puppeteer || module.default).launch({ headless: true,
  executablePath: process.argv[3] || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const screenshots = join(tmpdir(), 'caresync-demo-reset-ui');
await mkdir(screenshots, { recursive: true });
const admin = { _id: 'admin', firstName: 'Demo', lastName: 'Admin', role: 'Admin', status: 'Active' };
const fixtures = [admin, ...['Doctor', 'Staff', 'Patient', 'Admin'].map((role, index) => ({
  _id: `user-${index}`, firstName: role, lastName: 'Demo', role, status: 'Active', email: `${index}@example.test`,
}))];
const errors = [];
let users, cleared, resetCalls, finishReset;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    let data = [], message;
    if (url.pathname === '/api/system/demo-reset') {
      resetCalls++;
      assert.equal(request.headers().authorization, 'Bearer demo-reset-ui');
      assert.deepEqual(JSON.parse(request.postData()), { confirmation: 'CLEAR DEMO DATA' });
      if (resetCalls === 1) return request.respond({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Demo reset interrupted. Retry to finish clearing.' }) });
      await new Promise(resolve => { finishReset = resolve; });
      cleared = true;
      users = users.filter(user => ['Doctor', 'Staff'].includes(user.role) || user._id === admin._id);
      message = 'Demo data cleared. Doctor, staff, and your admin account were kept.';
    } else if (url.pathname === '/api/users/me') data = admin;
    else if (url.pathname === '/api/users') data = users;
    else if (url.pathname === '/api/appointments') data = cleared ? [] : [{ _id: 'appointment',
      patient: fixtures[3], doctor: fixtures[1], status: 'Pending', date: '2026-10-06', reason: 'Demo visit' }];
    else if (url.pathname === '/api/system/time') data = { currentTime: '2026-10-06T01:00:00Z', isOpen: true, isCustom: false };
    else if (url.pathname === '/api/notifications') data = { items: [], total: 0, unreadCount: 0, page: 1, pageSize: 20 };
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) });
  });
  for (const width of [1440, 390]) {
    users = structuredClone(fixtures); cleared = false; resetCalls = 0; finishReset = null;
    await page.setViewport({ width, height: 960 });
    await page.goto(process.argv[4] || 'http://127.0.0.1:3000');
    await page.evaluate(() => localStorage.setItem('caresync_token', 'demo-reset-ui'));
    await page.reload();
    await page.waitForSelector('.admin-dashboard');
    await page.evaluate(() => [...document.querySelectorAll('.dashboard-tabs button')].find(button => button.textContent === 'Demo reset').click());
    await page.waitForSelector('#demo-reset-confirmation');
    const button = '[aria-labelledby="demo-reset-title"] button[type="submit"]';
    assert(await page.$eval(button, element => element.disabled));
    await page.type('#demo-reset-confirmation', 'clear demo data');
    assert(await page.$eval(button, element => element.disabled));
    assert.equal(resetCalls, 0);
    await page.focus('#demo-reset-confirmation');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type('#demo-reset-confirmation', 'CLEAR DEMO DATA');
    assert.equal(await page.$eval('#demo-reset-confirmation', input => input.value), 'CLEAR DEMO DATA');
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: join(screenshots, `reset-${width}.png`), fullPage: true });
    await page.click(button);
    await page.waitForSelector('.admin-dashboard .alert-error');
    assert.equal(await page.$eval('#demo-reset-confirmation', input => input.value), 'CLEAR DEMO DATA');
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button);
    await page.click(button);
    await page.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
    assert(await page.$eval(button, element => element.disabled));
    assert(await page.$$eval('.dashboard-tabs button', buttons => buttons.every(button => button.disabled)));
    assert.equal(resetCalls, 2);
    assert(finishReset);
    finishReset();
    await page.waitForSelector('.admin-dashboard .alert-success');
    await page.waitForFunction(() => document.querySelectorAll('.stat-val')[0]?.textContent === '3' && document.querySelectorAll('.stat-val')[1]?.textContent === '0');
    assert.equal(await page.$eval('#demo-reset-confirmation', input => input.value), '');
    assert(await page.$eval(button, element => element.disabled));
    assert.equal(await page.evaluate(() => localStorage.getItem('caresync_token')), 'demo-reset-ui');
    await page.screenshot({ path: join(screenshots, `complete-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(`Demo reset UI passed at desktop/mobile widths: typed confirmation, failure/retry, busy controls, refreshed totals, and preserved session. Screenshots: ${screenshots}`);
} finally { await browser.close(); }
