// Playwright helpers for the evidence screenshots. Needs playwright-core and a local Chromium:
// set PLAYWRIGHT_CORE to the playwright-core package path and CHROMIUM_PATH to chrome.exe.
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const { login } = require('./lib');

const APP = process.env.EVIDENCE_APP || 'http://localhost:3000';
const OUT = path.resolve(__dirname, '../screenshots');

async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
}

// Opens the app already signed in; the token stays in browser memory and is never written to disk.
async function pageAs(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  if (email) {
    const token = await login(email);
    await context.addInitScript(value => localStorage.setItem('caresync_token', value), token);
  }
  const page = await context.newPage();
  await page.goto(APP);
  return page;
}

async function shot(target, name, options = {}) {
  const file = path.join(OUT, `${name}.png`);
  await target.screenshot({ path: file, ...options });
  console.log('saved', path.basename(file));
}

// Presentation only: lets a scrolling modal render at full height so one capture shows the whole record.
async function shotDialog(page, name) {
  await page.addStyleTag({ content: 'dialog[open]{max-height:none!important;height:auto!important;top:0!important;margin-top:0!important;position:absolute!important}'
    + 'dialog[open] .modal-body{max-height:none!important;overflow:visible!important}' });
  const dialog = page.locator('dialog[open]').last();
  await page.setViewportSize({ width: 1440, height: 3000 });
  const box = await dialog.boundingBox();
  const end = await dialog.locator(':scope > *').last().boundingBox(); // footer, or the body when there is none
  const bottom = end.y + end.height;
  await shot(page, name, { clip: { x: box.x, y: box.y, width: box.width, height: bottom - box.y } });
  await page.setViewportSize({ width: 1440, height: 900 });
}

module.exports = { APP, launch, pageAs, shot, shotDialog };
