// Documentation only: reuse the installed Markdown renderer and browser tooling.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../..');
const name = 'technical-specification-code-guide';
const source = await readFile(resolve(folder, `${name}.md`), 'utf8');
const context = { exports: {}, module: {} };
vm.runInNewContext(await readFile(resolve(root, 'build/paper-export/marked.min.js'), 'utf8'), context);
const css = `
  @page { size: A4; margin: 16mm 15mm 19mm; }
  * { box-sizing: border-box; }
  body { margin: 30px auto; max-width: 1020px; padding: 0 24px; color: #19353e; font: 15px/1.5 Arial, sans-serif; }
  h1 { font-size: 32px; line-height: 1.15; color: #007c7b; } h1:first-child { font-size: 19px; text-transform: uppercase; letter-spacing: 3px; }
  h2 { font-size: 24px; line-height: 1.25; color: #144956; } h3 { font-size: 18px; color: #007b79; margin-top: 1.4em; }
  h2,h3 { break-after: avoid; } p,li { orphans: 3; widows: 3; }
  a { color: #006e77; overflow-wrap: anywhere; } code { font: .93em Consolas, monospace; overflow-wrap: anywhere; }
  pre { padding: 10px; border-left: 3px solid #008c86; background: #eef6f5; white-space: pre-wrap; overflow-wrap: anywhere; break-inside: avoid; }
  pre code { font-size: inherit; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 12px; line-height: 1.38; margin: 14px 0; }
  th,td { border: 1px solid #c8dbdc; padding: 7px; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #e3f2f0; text-align: left; } tr:nth-child(even) td { background: #f7fbfa; }
  tr { break-inside: avoid; } thead { display: table-header-group; }
  table tr > :first-child { width: 29%; }
  .toc { padding: 14px 18px; background: #f0f7f6; border: 1px solid #c8dbdc; }
  .toc ol { columns: 2; column-gap: 28px; padding-left: 20px; margin: 0; }
  .toc li { margin: 0 0 5px; break-inside: avoid; }
  @media print {
    body { margin: 0; padding: 0; max-width: none; font-size: 9.5pt; line-height: 1.4; }
    h1 { font-size: 28pt; } h1:first-child { font-size: 13pt; }
    h2 { font-size: 17pt; margin-top: 1.4em; } h3 { font-size: 11.5pt; }
    #section-1 { break-before: page; margin-top: 0; }
    table { font-size: 8pt; } th,td { padding: 4px; } pre { font-size: 7.7pt; line-height: 1.35; }
    .toc { font-size: 8.3pt; margin-top: 18px; }
  }
`;
let body = context.exports.parse(source);
const headings = [...body.matchAll(/<h2>(\d+)\. ([^<]+)<\/h2>/g)];
assert.equal(headings.length, 15);
for (const [, number] of headings) body = body.replace(`<h2>${number}. `, `<h2 id="section-${number}">${number}. `);
const toc = `<nav class="toc" aria-label="Contents"><h3 style="margin-top:0">Contents</h3><ol>${headings.map(([, n, label]) => `<li><a href="#section-${n}">${label}</a></li>`).join('')}</ol></nav>`;
body = body.replace('<h2 id="section-1">', `${toc}<h2 id="section-1">`);
await writeFile(resolve(folder, `${name}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSync — Technical Specification and Code Guide</title><style>${css}</style></head><body>${body}</body></html>`);
const { default: puppeteer } = await import(pathToFileURL(resolve(root, 'build/ui-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const browser = await puppeteer.launch({ executablePath: process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });
  // The finished HTML is self-contained; export must not contact live services.
  await page.setRequestInterception(true);
  page.on('request', request => /^(file:|data:|about:)/.test(request.url()) ? request.continue() : request.abort());
  await page.goto(pathToFileURL(resolve(folder, `${name}.html`)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({ sections: document.querySelectorAll('h2').length,
    snippets: document.querySelectorAll('pre').length, tables: document.querySelectorAll('table').length,
    overflow: document.documentElement.scrollWidth > innerWidth,
    brokenInternalLinks: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.querySelector(a.getAttribute('href'))).length }));
  assert.equal(layout.sections, 15); assert.equal(layout.overflow, false); assert.equal(layout.brokenInternalLinks, 0);
  await page.pdf({ path: resolve(folder, `${name}.pdf`), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>', footerTemplate: '<div style="font:8px Arial;width:100%;padding:0 15mm;display:flex;justify-content:space-between;color:#64757d"><span>CareSync · Technical code guide · 6 October 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
  const bytes = await readFile(resolve(folder, `${name}.pdf`));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.ok(bytes.length > 10000);
  const evidence = resolve(root, 'build/technical-guide'); await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, 'html-preview.png') });
  console.log(JSON.stringify({ ...layout, pdfBytes: bytes.length, file: `${name}.pdf` }));
} finally { await browser.close(); }
