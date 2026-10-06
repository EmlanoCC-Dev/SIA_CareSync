// Documentation only: reuse the pinned Markdown renderer and installed browser tooling.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../..');
const name = 'specification-compliance-report';
const context = { exports: {}, module: {} };
vm.runInNewContext(await readFile(resolve(root, 'build/paper-export/marked.min.js'), 'utf8'), context);
const source = await readFile(resolve(folder, `${name}.md`), 'utf8');
let body = context.exports.parse(source);
for (const match of body.matchAll(/<p><img src="([^"]+)" alt="([^"]*)"><\/p>/g)) {
  const image = await readFile(resolve(folder, match[1]));
  body = body.replace(match[0], `<figure><img src="data:image/png;base64,${image.toString('base64')}" alt="${match[2]}"><figcaption>${match[2]}</figcaption></figure>`);
}
const css = `
  @page { size: A4; margin: 18mm 15mm 20mm; }
  @page evidence { size: A4 landscape; margin: 14mm 15mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 28px auto; padding: 0 22px; max-width: 1100px; color: #173342; font: 15px/1.5 Arial, sans-serif; }
  h1 { font-size: 34px; color: #007f82; } h2 { font-size: 25px; color: #124657; line-height: 1.25; }
  h3 { font-size: 18px; color: #00757a; line-height: 1.3; margin-top: 1.5em; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  th,td { border: 1px solid #cddde0; padding: 8px; vertical-align: top; overflow-wrap: anywhere; }
  th { background: #e9f4f3; text-align: left; } tr:nth-child(even) td { background: #f8fbfb; }
  table tr > :first-child { width: 28%; } a { color: #00727a; overflow-wrap: anywhere; }
  code { font: .93em Consolas, monospace; overflow-wrap: anywhere; } pre { white-space: pre-wrap; padding: 12px; background: #f1f6f7; }
  p,li { orphans: 3; widows: 3; } tr,pre { break-inside: avoid; } thead { display: table-header-group; }
  h2,h3 { break-after: avoid; } figure { margin: 25px 0; text-align: center; }
  figure img { width: 100%; height: auto; } figcaption { margin-top: 10px; font-size: 12px; color: #49636b; }
  @media print {
    body { margin: 0; padding: 0; max-width: none; font-size: 10pt; line-height: 1.45; }
    h1 { font-size: 30pt; margin-top: 6mm; } h2 { font-size: 17pt; }
    h2:not(:first-of-type) { break-before: page; } h3 { font-size: 11.5pt; }
    table { font-size: 8.2pt; line-height: 1.35; } th,td { padding: 5px; }
    figure { page: evidence; break-before: page; break-after: page; margin: 0; }
    figure img { width: auto; max-width: 100%; height: auto; max-height: 156mm; object-fit: contain; }
    figcaption { font-size: 9pt; } pre { font-size: 8pt; }
  }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSync — Specification Coverage and Testing Report</title><style>${css}</style></head><body>${body}</body></html>`;
await writeFile(resolve(folder, `${name}.html`), html);
const { default: puppeteer } = await import(pathToFileURL(resolve(root, 'build/ui-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href);
const browser = await puppeteer.launch({ executablePath: process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run', '--no-default-browser-check'], defaultViewport: { width: 1440, height: 960 } });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(folder, `${name}.html`)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({
    brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).length,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    figures: document.querySelectorAll('figure').length,
    sections: [...document.querySelectorAll('h2')].filter(heading => /^\d+\./.test(heading.textContent)).length,
  }));
  assert.equal(layout.brokenImages, 0); assert.equal(layout.horizontalOverflow, false);
  assert.equal(layout.figures, 4); assert.equal(layout.sections, 9);
  await page.pdf({ path: resolve(folder, `${name}.pdf`), printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>', footerTemplate: '<div style="font:8px Arial;width:100%;padding:0 15mm;display:flex;justify-content:space-between;color:#64757d"><span>CareSync · Specification coverage · October 6, 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
  const pdf = await readFile(resolve(folder, `${name}.pdf`));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.length > 10000);
  await page.screenshot({ path: resolve(root, 'build/specification-review/report-preview.png') });
  console.log(`Exported ${name}.pdf (${pdf.length} bytes); ${layout.sections} report sections; ${layout.figures} embedded screenshots; no missing images or horizontal overflow.`);
} finally { await browser.close(); }
