// SC11 (and SC07b): real negative API requests, sanitized, rendered as a page so status and body are visible together.
const fs = require('node:fs');
const path = require('node:path');
const { launch, shot } = require('./browser');
const { call, login, sanitize, db, mongoose } = require('./lib');

const escape = text => String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function render(browser, name, title, rows) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.setContent(`<html><body style="font:14px system-ui;margin:24px;color:#123">
    <h2 style="margin:0 0 4px">${escape(title)}</h2>
    <p style="margin:0 0 16px;color:#555">Live responses from http://localhost:5000/api on ${new Date().toISOString()}. Authorization headers omitted; IDs are synthetic.</p>
    <table style="border-collapse:collapse;width:100%">${['Actor', 'Request', 'Status', 'Response body'].map(h => `<th style="text-align:left;border-bottom:2px solid #123;padding:6px">${h}</th>`).join('')}
    ${rows.map(r => `<tr><td style="padding:6px;border-bottom:1px solid #ccc">${escape(r.actor)}</td><td style="padding:6px;border-bottom:1px solid #ccc;font-family:monospace">${escape(r.request)}</td>
      <td style="padding:6px;border-bottom:1px solid #ccc;font-weight:700;color:${r.status < 300 ? '#070' : '#a00'}">${r.status}</td>
      <td style="padding:6px;border-bottom:1px solid #ccc;font-family:monospace">${escape(JSON.stringify(r.body))}</td></tr>`).join('')}</table></body></html>`);
  await shot(page, name, { fullPage: true });
}

(async () => {
  const appointment = await (await db()).collection('appointments').findOne({ 'documents.0': { $exists: true } });
  const id = String(appointment._id), doc = String(appointment.documents[0]._id);
  const tokens = {};
  for (const [key, email] of Object.entries({ owner: 'evidence.patient@example.test', other: 'evidence.patient2@example.test',
    doctor2: 'evidence.doctor2@example.test', doctor: 'evidence.doctor@example.test' })) tokens[key] = await login(email);
  const download = `/appointments/${id}/documents/${doc}/versions/1/download`;
  const cases = [
    ['Other Patient (Quinn)', 'GET', `/appointments/${id}`, tokens.other],
    ['Other Patient (Quinn)', 'GET', `/appointments/${id}/comments`, tokens.other],
    ['Other Patient (Quinn)', 'GET', download, tokens.other],
    ['Unassigned Doctor (Carla Lim)', 'GET', `/appointments/${id}`, tokens.doctor2],
    ['Unassigned Doctor (Carla Lim)', 'GET', download, tokens.doctor2],
    ['Patient owner (Pia)', 'GET', '/audit-logs', tokens.owner],
    ['Patient owner (Pia)', 'PATCH', `/appointments/${id}/complete`, tokens.owner],
    ['No login', 'GET', download, null],
  ];
  const rows = [];
  for (const [actor, method, url, token] of cases) {
    const result = await call(method, url, { token });
    rows.push({ actor, request: `${method} /api${url}`, status: result.status, body: sanitize(result.body) });
  }
  // Positive controls: the owner and the assigned doctor can fetch the same historical file.
  for (const [actor, token] of [['Patient owner (Pia)', tokens.owner], ['Assigned Doctor (Ben Santos)', tokens.doctor]]) {
    const response = await fetch(`http://localhost:5000/api${download}`, { headers: { Authorization: `Bearer ${token}` } });
    rows.push({ actor, request: `GET /api${download}`, status: response.status, body: `${(await response.text()).length} bytes, ${response.headers.get('content-type')}` });
  }
  fs.writeFileSync(path.resolve(__dirname, '../screenshots/SC11-negative-requests.json'), JSON.stringify(rows, null, 2));
  const browser = await launch();
  await render(browser, 'SC11-negative-access-responses', 'SC11 Sanitized negative requests and actual responses', rows);
  await render(browser, 'SC07b-historical-download-protected', 'SC07b Protected historical download (version 1)',
    rows.filter(row => row.request.endsWith('/versions/1/download')));
  await browser.close();
  await mongoose.disconnect();
})().catch(async error => { console.error(error); await mongoose.disconnect(); process.exit(1); });
