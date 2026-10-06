// Documentation export only. Node 22+, Chrome and pinned renderers in build/paper-export.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../..');
const [mermaid, marked, source] = await Promise.all([
  readFile(join(root, 'build/paper-export/mermaid.min.js'), 'utf8'),
  readFile(join(root, 'build/paper-export/marked.min.js'), 'utf8'),
  readFile(join(folder, 'final-paper.md'), 'utf8'),
]);
const renderer = `<!doctype html><meta charset="utf-8"><body><script>${mermaid}</script><script>${marked}</script></body>`;
let displayed = renderer;
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(displayed);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'caresync-paper-'));
const chrome = spawn(process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
console.log('Starting headless Chrome for documentation export');
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
    chrome.once('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited: ${code}`)); });
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1])); }
    });
  });
  const pages = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  console.log('Connected to Chrome debugging endpoint');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (!data.id) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.error) entry.reject(new Error(data.error.message)); else entry.resolve(data.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 45000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const navigate = async () => {
    await send('Page.navigate', { url });
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await evaluate('document.readyState === "complete"')) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Page load timed out');
  };
  await navigate();
  console.log('Loaded pinned Mermaid and Markdown renderers');
  await evaluate(`mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Arial', themeVariables: { primaryColor: '#eff6ff', primaryBorderColor: '#0369a1', primaryTextColor: '#0f172a', lineColor: '#475569', fontSize: '18px' }, flowchart: { htmlLabels: false, useMaxWidth: false, curve: 'linear' }, sequence: { useMaxWidth: false } })`);
  const diagrams = (await readdir(join(folder, 'diagrams'))).filter(file => file.endsWith('.mmd')).sort();
  assert.equal(diagrams.length, 8);
  for (const file of diagrams) {
    const syntax = await readFile(join(folder, 'diagrams', file), 'utf8');
    const id = `figure${file.slice(0, 2)}`;
    const svg = await evaluate(`(async () => { const result = await mermaid.render(${JSON.stringify(id)}, ${JSON.stringify(syntax)}); return result.svg; })()`);
    assert.match(svg, /<svg/);
    assert.ok(!svg.includes('Syntax error'), file);
    await writeFile(join(folder, 'diagrams', file.replace('.mmd', '.svg')), svg);
    console.log(`Rendered ${file}`);
  }
  const content = await evaluate(`marked.parse(${JSON.stringify(source)})`);
  let inline = content;
  const figures = [];
  for (const match of content.matchAll(/<p><img src="(diagrams\/[^\"]+\.svg)" alt="([^\"]*)"><\/p>/g)) {
    const svg = await readFile(join(folder, match[1]), 'utf8');
    inline = inline.replace(match[0], `<figure>${svg}<figcaption>${match[2]}</figcaption></figure>`);
    figures.push({ number: Number(match[1].match(/\/(\d+)/)[1]), html: `<figure>${svg}<figcaption>${match[2]}</figcaption></figure>` });
  }
  assert.equal(figures.length, 9, 'All nine diagrams must be embedded');
  assert.ok(!inline.includes('<img src="diagrams/'), 'No missing embedded figure');
  assert.equal((source.match(/^## (?:[1-9]|1[0-5])\./gm) || []).length, 15);
  const css = `
    @page { size: A4; margin: 20mm 17mm; }
    @page diagram { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; } body { max-width: 1050px; margin: 32px auto; padding: 0 24px; color: #162331; background: white; font: 15px/1.6 Georgia, serif; }
    h1,h2,h3 { font-family: Arial,sans-serif; color: #123f5a; line-height: 1.3; } h1 { font-size: 40px; } h2 { margin-top: 2em; font-size: 25px; } h3 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font: 12px/1.45 Arial,sans-serif; } th,td { border: 1px solid #c6d3dc; padding: 8px; vertical-align: top; } th { background: #eaf3f8; text-align: left; }
    tr { break-inside: avoid; } thead { display: table-header-group; } h2,h3 { break-after: avoid; } a { color: #0369a1; overflow-wrap: anywhere; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; background: #f1f5f9; font: 12px/1.5 Consolas,monospace; } code { font-size: .9em; } p,li { orphans: 3; widows: 3; }
    figure { margin: 32px 0; padding: 14px; border: 1px solid #d7e1e8; text-align: center; } figure svg { max-width: 100%; width: 100%; height: auto; } figcaption { margin-top: 12px; font: 14px/1.4 Arial,sans-serif; }
    @media print { body { margin: 0; padding: 0; max-width: none; font-size: 10.5pt; line-height: 1.5; } h1 { font-size: 28pt; } h2 { break-before: page; font-size: 18pt; } h3 { font-size: 12pt; } table { font-size: 8.5pt; } th,td { padding: 5px; } figure { page: diagram; break-before: page; break-after: page; border: 0; margin: 0; padding: 0; } figure svg { max-height: 166mm; } figcaption { font-size: 10pt; } pre { font-size: 8pt; } }
  `;
  const document = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`;
  const atlas = document('CareSync Diagram Atlas', `<h1>CareSync — Diagram Atlas</h1><p>Eight required diagrams plus the additional ERD. Prepared October 6, 2026. Current-state assumptions require clinic validation; deployment shows the local development topology.</p>${figures.sort((a,b) => a.number-b.number).map(figure => figure.html).join('\n')}`);
  for (const [name, html] of [['final-paper', document('CareSync Final Paper — Working Draft', inline)], ['diagram-atlas', atlas]]) {
    await writeFile(join(folder, `${name}.html`), html);
    displayed = html;
    await navigate();
    await evaluate('document.fonts.ready');
    const count = await evaluate('document.querySelectorAll("figure svg").length');
    assert.equal(count, 9);
    const result = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
    const pdf = Buffer.from(result.data, 'base64');
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    await writeFile(join(folder, `${name}.pdf`), pdf);
    console.log(`Exported ${name}: ${pdf.length} PDF bytes, ${count} embedded diagrams`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'build/paper-export/atlas-preview.png'), Buffer.from(screenshot.data, 'base64'));
  for (const number of [2, 4, 5, 9]) {
    const figure = await evaluate(`(() => { const item = document.querySelectorAll('figure')[${number-1}]; return { svg: item.querySelector('svg').outerHTML, caption: item.querySelector('figcaption').textContent }; })()`);
    await evaluate(`document.body.style.cssText='max-width:none;margin:0;padding:24px'; document.body.innerHTML = '<div style="width:1320px;height:900px;display:flex;align-items:center;justify-content:center">' + ${JSON.stringify(figure.svg)} + '</div>'; document.querySelector('svg').style.cssText='width:100%;max-height:880px;height:auto';`);
    const preview = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(root, `build/paper-export/figure-${number}-preview.png`), Buffer.from(preview.data, 'base64'));
    displayed = atlas;
    await navigate();
  }
} finally {
  socket?.close();
  chrome.kill();
  server.close();
}
