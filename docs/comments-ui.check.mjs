// Run after npm run build and a frontend preview on port 3000:
// node docs/comments-ui.check.mjs [Chrome executable] [preview URL]
// Comments and consultation versions. Node 22+ and Chrome; mock APIs only, no live patient data or dependencies.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const profile = await mkdtemp(join(tmpdir(), 'caresync-comments-ui-'));
const screenshots = join(profile, 'screenshots');
await mkdir(screenshots);
const chrome = spawn(process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start in 15 seconds')), 15000);
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
    chrome.once('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited: ${code}`)); });
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(new URL(match[1])); }
    });
  });
  const pages = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const pending = new Map(), errors = [];
  socket.addEventListener('close', () => {
    for (const promise of pending.values()) promise.reject(new Error('Chrome debugging connection closed'));
    pending.clear();
  });
  let sequence = 0;
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const promise = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) promise.reject(new Error(data.error.message)); else promise.resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`UI condition failed: ${expression}`);
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'deny' });
  for (const role of ['Patient', 'Doctor', 'Staff', 'Admin']) for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const source = `(() => {
      localStorage.setItem('caresync_token', 'comments-ui-mock');
      const role = ${JSON.stringify(role)};
      const patient = { _id: 'patient-1', firstName: 'Alex', lastName: 'Santos', role: 'Patient' };
      const doctor = { _id: 'doctor-1', firstName: 'Isabel', lastName: 'Reyes', role: 'Doctor' };
      const user = role === 'Patient' ? patient : role === 'Doctor' ? doctor : { _id: 'clinic-1', firstName: 'Jamie', lastName: 'Cruz', role };
      const entry = (version, message) => ({ version, notes: message, savedAt: '2026-10-03T02:00:00Z', authorName: 'Isabel Reyes', authorRole: 'Doctor' });
      const file = version => ({ version, filename: 'Result.txt', url: '/uploads/result-' + version + '.txt', uploadedAt: '2026-10-03T02:00:00Z', uploaderName: 'Isabel Reyes', uploaderRole: 'Doctor' });
      window.historyData = { notesRevision: 2, notes: [entry(1, 'Original assessment'), entry(2, 'Current assessment')], documents: [
        { _id: 'document-1', filename: 'Result.txt', archived: false, version: 2, versions: [file(1), file(2)] },
        { _id: 'archived-document', filename: 'Archived result.txt', archived: true, version: 1, archivedAt: '2026-10-03T02:00:00Z', archivedByName: 'Jamie Cruz', versions: [file(1)] },
      ] };
      const visit = { _id: 'appointment-1', patient, doctor, status: 'Completed', date: '2026-10-03', reason: 'Follow-up request', statusHistory: [],
        consultationNotes: 'Current assessment', notesRevision: 2, documents: [{ _id: 'document-1', ...file(2) }] };
      window.comments = [{ _id: 'comment-1', authorName: 'Jamie Cruz', authorRole: 'Staff', message: 'Please clarify your request.', createdAt: '2026-10-03T02:00:00Z' }];
      window.failLoad = false; window.failPost = false; window.posts = 0;
      window.downloads = []; window.recordRequests = []; window.failRecordSave = false;
      window.delayRecordResponse = false;
      const original = window.fetch;
      window.fetch = async (url, options = {}) => {
        if (!String(url).startsWith('/api/')) return original(url, options);
        let data = [], status = 200;
        if (url.endsWith('/comments')) {
          if (options.headers.Authorization !== 'Bearer comments-ui-mock') throw new Error('Comment request has no authentication');
          if (options.method === 'POST') {
            if (window.failPost) { window.failPost = false; return new Response(JSON.stringify({ message: 'Comment temporarily unavailable' }), { status: 503 }); }
            data = { _id: 'comment-' + (window.comments.length + 1), authorName: user.firstName + ' ' + user.lastName, authorRole: role, message: JSON.parse(options.body).message, createdAt: new Date().toISOString() };
            window.comments.push(data); window.posts++; status = 201;
          } else {
            if (window.failLoad) { window.failLoad = false; return new Response(JSON.stringify({ message: 'Unable to load comments' }), { status: 503 }); }
            data = window.comments;
          }
        } else if (url.endsWith('/download')) {
          if (options.headers.Authorization !== 'Bearer comments-ui-mock') throw new Error('Version download has no authentication');
          window.downloads.push(url);
          return new Response('Original file content', { headers: { 'Content-Type': 'text/plain' } });
        } else if (url.endsWith('/versions')) data = window.historyData;
        else if (url.endsWith('/replace')) {
          const document = window.historyData.documents[0];
          if (Number(options.body.get('version')) !== document.version) throw new Error('Replacement sent the wrong version');
          document.version++; document.versions.push(file(document.version));
          visit.documents[0] = { _id: 'document-1', ...file(document.version) }; data = visit.documents[0]; status = 201;
        } else if (url.endsWith('/documents/document-1') && options.method === 'DELETE') {
          window.historyData.documents[0].archived = true;
          visit.documents = []; data = visit;
        } else if (url.endsWith('/documents') && options.method === 'PATCH') {
          const body = JSON.parse(options.body); window.recordRequests.push(body);
          if (window.failRecordSave) { window.failRecordSave = false; return new Response(JSON.stringify({ message: 'Record save temporarily unavailable' }), { status: 503 }); }
          if (body.notesRevision !== visit.notesRevision) throw new Error('Notes sent the wrong revision');
          if (body.consultationNotes !== visit.consultationNotes) {
            visit.notesRevision++; visit.consultationNotes = body.consultationNotes;
            window.historyData.notes.push(entry(visit.notesRevision, body.consultationNotes));
          }
          data = visit;
        } else if (url === '/api/users/me') data = user;
        else if (url.startsWith('/api/appointments')) data = [visit];
        else if (url.startsWith('/api/notifications')) data = { items: [], unreadCount: 0, total: 0, pageSize: 20 };
        else if (url === '/api/users') data = [patient, doctor];
        else if (url === '/api/system/time') data = { currentTime: '2026-10-03T02:00:00Z', operatingStatus: { isOpen: true, message: 'Clinic is open' } };
        if (window.delayRecordResponse && options.method === 'PATCH' && url.endsWith('/documents')) {
          window.delayRecordResponse = false;
          await new Promise(resolve => { window.releaseRecordResponse = resolve; });
        }
        return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
      };
    })()`;
    const injection = await send('Page.addScriptToEvaluateOnNewDocument', { source });
    await send('Page.navigate', { url: process.argv[3] || 'http://127.0.0.1:3000' });
    await waitFor(`!![...document.querySelectorAll('td button')].find(button => button.textContent.includes('History & comments'))`);
    await evaluate(`[...document.querySelectorAll('td button')].find(button => button.textContent.includes('History & comments')).click()`);
    await waitFor(`document.querySelector('.appointment-details-dialog')?.open && document.querySelector('.appointment-comment-message')?.textContent.includes('clarify')`);
    const setDraft = text => evaluate(`(() => { const input = document.querySelector('#appointment-comment-message'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await setDraft('   ');
    assert(await evaluate(`document.querySelector('.appointment-comments button[type=submit]').disabled`));
    await setDraft('<img src=x onerror=alert(1)>\nPatient reply');
    await evaluate(`window.failPost = true; document.querySelector('.appointment-comments form').requestSubmit()`);
    await waitFor(`document.querySelector('.appointment-comments .alert')?.textContent.includes('temporarily')`);
    assert.equal(await evaluate(`document.querySelector('#appointment-comment-message').value`), '<img src=x onerror=alert(1)>\nPatient reply');
    await evaluate(`document.querySelector('.appointment-comments form').requestSubmit()`);
    await waitFor(`document.querySelectorAll('.appointment-comments-list li').length === 2 && document.querySelector('#appointment-comment-message').value === ''`);
    assert.equal(await evaluate('window.posts'), 1);
    assert.equal(await evaluate(`document.querySelectorAll('.appointment-comments-list img').length`), 0, 'Messages render as text, never HTML');
    assert(await evaluate(`document.querySelector('.appointment-comments-list li:last-child').textContent.includes(${JSON.stringify(role)})`));
    await evaluate(`window.failLoad = true; document.querySelector('.appointment-comments-heading button').click()`);
    await waitFor(`document.querySelector('.appointment-comments .alert')?.textContent.includes('Unable to load')`);
    await evaluate(`document.querySelector('.appointment-comments-heading button').click()`);
    await waitFor(`!document.querySelector('.appointment-comments .alert') && !document.querySelector('#appointment-comment-message').disabled`);
    await waitFor(`document.querySelectorAll('.record-version-group').length === 3`);
    await evaluate(`document.querySelector('.record-version-group summary').click()`);
    assert(await evaluate(`document.querySelector('.record-versions').textContent.includes('Original assessment')`));
    await evaluate(`document.querySelectorAll('.record-version-group summary')[1].click(); [...document.querySelectorAll('.record-version-group button')].find(button => button.textContent === 'Download version 1').click()`);
    await waitFor(`window.downloads.some(url => url.endsWith('/documents/document-1/versions/1/download'))`);
    assert(await evaluate(`document.querySelector('.record-versions').textContent.includes('Archived result.txt')`));
    assert.equal(await evaluate(`document.querySelectorAll('.record-versions textarea, .record-versions input').length`), 0, 'History is read-only');
    assert(await evaluate(`(() => { const dialog = document.querySelector('.appointment-details-dialog').getBoundingClientRect(); return dialog.left >= 0 && dialog.right <= innerWidth && dialog.bottom <= innerHeight && document.querySelector('.appointment-comments').scrollWidth <= document.querySelector('.appointment-comments').clientWidth; })()`), 'Dialog and comments fit viewport');
    await evaluate(`Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, `${role}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor(`!document.querySelector('.appointment-details-dialog')`);
    assert(await evaluate(`document.activeElement.textContent.includes('History & comments')`), 'Focus returns to the opener');
    if (role === 'Patient' || role === 'Doctor') {
      await evaluate(`[...document.querySelectorAll('td button')].find(button => button.textContent.includes(${JSON.stringify(role === 'Patient' ? 'Medical Records' : 'View Notes')})).click()`);
      await waitFor(`document.querySelectorAll('.record-version-group').length === 3`);
      if (role === 'Doctor') {
        await evaluate(`(() => { const input = document.querySelector('#consultation-notes'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Updated assessment'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await evaluate(`window.failRecordSave = true; [...document.querySelectorAll('.modal-footer button')].find(button => button.textContent.includes('Save Notes')).click()`);
        await waitFor(`document.querySelector('.modal-body .alert')?.textContent.includes('temporarily')`);
        assert.equal(await evaluate(`document.querySelector('#consultation-notes').value`), 'Updated assessment');
        await evaluate(`[...document.querySelectorAll('.modal-footer button')].find(button => button.textContent.includes('Save Notes')).click()`);
        await waitFor(`window.historyData.notes.length === 3 && document.querySelector('.record-versions').textContent.includes('Updated assessment')`);
        await evaluate(`[...document.querySelectorAll('.modal-footer button')].find(button => button.textContent.includes('Save Notes')).click()`);
        await waitFor(`window.recordRequests.length === 3`);
        assert.equal(await evaluate('window.historyData.notes.length'), 3, 'Unchanged UI save creates no version');
        await evaluate(`document.querySelector('.consultation-document-actions button').click()`);
        await waitFor(`!!document.querySelector('.record-replacement-notice')`);
        await evaluate(`(() => { const input = document.querySelector('input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(new File(['Replacement bytes'], 'replacement.txt', { type: 'text/plain' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await evaluate(`[...document.querySelectorAll('.modal-body button')].find(button => button.textContent.includes('Upload replacement')).click()`);
        await waitFor(`window.historyData.documents[0].version === 3 && !document.querySelector('.record-replacement-notice')`);
        await evaluate(`document.querySelector('button[title="Archive document"]').click()`);
        await waitFor(`!!document.querySelector('.care-dialog[open] button[type=submit]')`);
        await evaluate(`document.querySelector('.care-dialog[open] button[type=submit]').click()`);
        await waitFor(`!document.querySelector('.consultation-document-row') && document.querySelector('.record-versions').textContent.includes('Archived')`);
        assert.equal(await evaluate('window.historyData.documents[0].versions.length'), 3);
        await evaluate(`(() => { const input = document.querySelector('#consultation-notes'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Delayed save'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await evaluate(`window.delayRecordResponse = true; [...document.querySelectorAll('.modal-footer button')].find(button => button.textContent.includes('Save Notes')).click()`);
        await waitFor(`typeof window.releaseRecordResponse === 'function'`);
        await evaluate(`document.querySelector('.modal-header button').click()`);
        await waitFor(`!document.querySelector('#consultation-notes')`);
        await evaluate(`[...document.querySelectorAll('td button')].find(button => button.textContent.includes('View Notes')).click()`);
        await waitFor(`!!document.querySelector('#consultation-notes')`);
        await evaluate(`(() => { const input = document.querySelector('#consultation-notes'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'New session draft'); input.dispatchEvent(new Event('input', { bubbles: true })); window.releaseRecordResponse(); })()`);
        await waitFor(`document.querySelector('.record-versions')?.textContent.includes('Delayed save')`);
        assert.equal(await evaluate(`document.querySelector('#consultation-notes').value`), 'New session draft', 'Late save must not change a reopened record session');
        assert(!(await evaluate(`document.querySelector('.modal-body').textContent.includes('notes saved successfully')`)), 'Late save must not claim the new draft was saved');
      }
      await evaluate(`document.querySelector('.record-versions').scrollIntoView({ block: 'start' }); document.querySelector('.record-version-group summary').click()`);
      assert(await evaluate(`(() => { const body = document.querySelector('.modal-body'); return body.scrollWidth <= body.clientWidth && document.documentElement.scrollWidth <= innerWidth; })()`), 'Medical record fits viewport');
      await evaluate(`Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))`);
      const recordScreenshot = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(screenshots, `record-${role}-${width}.png`), Buffer.from(recordScreenshot.data, 'base64'));
      await evaluate(`document.querySelector('.modal-header button').click()`);
    }
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  }
  assert.deepEqual(errors, []);
  console.log(`Passed comment/history/privacy checks for all four roles and note-save/replacement/archive controls at desktop/mobile widths. Screenshots: ${screenshots}`);
} finally { socket?.close(); chrome.kill(); }
