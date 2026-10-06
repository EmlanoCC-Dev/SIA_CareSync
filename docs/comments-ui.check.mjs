// Run after npm run build and a frontend preview on port 3000:
// node docs/comments-ui.check.mjs [Chrome executable] [preview URL]
// Comments, booking corrections, consultation versions, and email OTP account flows. Node 22+ and Chrome; mock APIs only.
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
    console.log(`Checking ${role} at ${width}px`);
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
      window.visit = visit; window.correctionRequests = []; window.failCorrection = false;
      window.inbox = [
        { status: 'sent', sentAt: '2026-10-04T02:00:00Z' }, { status: 'pending' },
        { status: 'failed', errorCode: 'EAUTH' }, { status: 'skipped', errorCode: 'IN_APP_ONLY' },
        { status: 'disabled' }, { status: 'skipped', errorCode: 'INVALID_EMAIL' }, null, { status: 'future-status' },
      ].map((emailDelivery, index) => ({ _id: 'notification-' + index, title: 'Care update ' + (index + 1),
        message: 'Appointment notification', createdAt: '2026-10-04T02:00:00Z', readAt: null, emailDelivery }));
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
        } else if (url.endsWith('/request-correction') || url.endsWith('/resubmit')) {
          const body = JSON.parse(options.body); window.correctionRequests.push(body);
          if (window.failCorrection) { window.failCorrection = false; return new Response(JSON.stringify({ message: 'Correction save temporarily unavailable' }), { status: 503 }); }
          if (body.bookingRevision !== (visit.bookingRevision || 0)) throw new Error('Correction sent the wrong revision');
          const resubmit = url.endsWith('/resubmit');
          visit.bookingRevision = (visit.bookingRevision || 0) + 1;
          (visit.bookingHistory ||= []).push({ revision: visit.bookingRevision, action: resubmit ? 'Resubmitted' : 'Correction requested',
            previousReason: visit.reason, reason: resubmit ? body.reason : visit.reason, explanation: body.explanation || '',
            actorName: user.firstName + ' ' + user.lastName, actorRole: role, changedAt: '2026-10-04T02:00:00Z' });
          visit.reason = resubmit ? body.reason : visit.reason; visit.status = resubmit ? 'Pending' : 'Needs correction';
          visit.statusHistory.push({ status: visit.status, changedAt: '2026-10-04T02:00:00Z', remarks: resubmit ? 'Resubmitted' : 'Correction requested' });
          data = visit;
        } else if (url === '/api/appointments/appointment-1') data = visit;
        else if (url === '/api/users/me') data = user;
        else if (url.startsWith('/api/appointments')) data = [visit];
        else if (url.startsWith('/api/notifications')) data = { items: window.inbox, unreadCount: window.inbox.length, total: window.inbox.length, pageSize: 20 };
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
    await evaluate(`(() => {
      window.visit.status = ${JSON.stringify(['Staff', 'Admin'].includes(role) ? 'Pending' : 'Needs correction')};
      window.visit.bookingRevision = ${['Staff', 'Admin'].includes(role) ? 0 : 1};
      window.visit.bookingHistory = ${['Staff', 'Admin'].includes(role) ? '[]' : `[{ revision: 1, action: 'Correction requested', previousReason: 'Follow-up request', reason: 'Follow-up request', explanation: 'Please clarify your symptoms.', actorName: 'Jamie Cruz', actorRole: 'Staff', changedAt: '2026-10-04T02:00:00Z' }]`};
    })()`);
    await evaluate(`[...document.querySelectorAll('td button')].find(button => button.textContent.includes('History & comments')).click()`);
    await waitFor(`document.querySelector('.appointment-details-dialog')?.open && !!document.querySelector('.booking-corrections')`);
    await evaluate(`[...document.querySelectorAll('.booking-corrections button')].find(button => button.textContent.includes('Refresh booking')).click()`);
    await waitFor(`!!document.querySelector('td .badge-${['Staff', 'Admin'].includes(role) ? 'Pending' : 'Needs-correction'}')`);
    if (role === 'Doctor') {
      assert.equal(await evaluate(`document.querySelectorAll('.booking-corrections form').length`), 0);
      assert(await evaluate(`document.querySelector('.booking-corrections').textContent.includes('clarify your symptoms')`));
    } else {
      await waitFor(`!!document.querySelector('#booking-correction-text')`);
      if (role === 'Patient') assert(await evaluate(`document.querySelector('.booking-corrections button[type=submit]').disabled`), 'Unchanged reason cannot resubmit');
      const draft = role === 'Patient' ? 'Clarified symptoms for review' : 'Please clarify your symptoms.';
      await evaluate(`(() => { const input = document.querySelector('#booking-correction-text'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(draft)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await evaluate(`window.failCorrection = true; document.querySelector('.booking-corrections form').requestSubmit()`);
      await waitFor(`document.querySelector('.booking-corrections .alert')?.textContent.includes('temporarily')`);
      assert.equal(await evaluate(`document.querySelector('#booking-correction-text').value`), draft);
      await evaluate(`document.querySelector('.booking-corrections form').requestSubmit()`);
      await waitFor(`document.querySelector('.appointment-details-dialog .badge')?.textContent.includes(${JSON.stringify(role === 'Patient' ? 'Pending' : 'Needs correction')}) && !!document.querySelector('.booking-history')`);
      assert.equal(await evaluate(`window.correctionRequests.length`), 2);
      await evaluate(`document.querySelector('.booking-history summary').click()`);
      assert(await evaluate(`document.querySelector('.booking-history').textContent.includes('Follow-up request')`));
      assert(await evaluate(`document.querySelector('.booking-history').textContent.includes(${JSON.stringify(draft)})`));
    }
    assert(await evaluate(`(() => { const panel = document.querySelector('.booking-corrections'); const box = document.querySelector('.appointment-details-dialog').getBoundingClientRect(); return panel.scrollWidth <= panel.clientWidth && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; })()`), 'Correction UI fits desktop/mobile');
    await evaluate(`Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))`);
    const correctionShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, `corrections-${role}-${width}.png`), Buffer.from(correctionShot.data, 'base64'));
    await evaluate(`window.visit.status = 'Completed'; [...document.querySelectorAll('.booking-corrections button')].find(button => button.textContent.includes('Refresh booking')).click()`);
    await waitFor(`!!document.querySelector('td .badge-Completed')`);
    await evaluate(`document.querySelector('[aria-label="Close appointment details"]').click()`);
    await waitFor(`!document.querySelector('.appointment-details-dialog')`);
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
        await waitFor(`!!document.querySelector('.action-dialog[open] button[type=submit]')`);
        await evaluate(`document.querySelector('.action-dialog[open] button[type=submit]').click()`);
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
    await evaluate(`document.querySelector('.notification-trigger').click()`);
    await waitFor(`document.querySelector('.notification-dialog')?.open && document.querySelectorAll('.notification-list li').length === 8`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.notification-email-status > span')].map(node => node.textContent)`),
      ['Email sent', 'Email delivery pending', 'Email delivery failed', 'In-app only', 'Email unavailable', 'Email not sent']);
    assert(await evaluate(`document.querySelector('.notification-email-status.is-sent > span').title.includes('Accepted by Gmail')`));
    assert.equal(await evaluate(`document.querySelector('.notification-email-status.is-sent time').getAttribute('datetime')`), '2026-10-04T02:00:00.000Z');
    assert(await evaluate(`document.querySelector('.notification-email-status.is-sent time').getClientRects().length > 0`), 'Sent timestamp stays visible on mobile');
    assert(!await evaluate(`document.querySelector('.notification-dialog').textContent.includes('EAUTH')`), 'Do not display SMTP error codes');
    assert(await evaluate(`(() => { const box = document.querySelector('.notification-dialog').getBoundingClientRect(); const list = document.querySelector('.notification-list'); return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && list.scrollWidth <= list.clientWidth; })()`), 'Email delivery statuses fit desktop/mobile');
    await evaluate(`Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})))`);
    const emailShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, `email-status-${role}-${width}.png`), Buffer.from(emailShot.data, 'base64'));
    await evaluate(`window.inbox[1].emailDelivery = { status: 'sent', sentAt: '2026-10-04T02:01:00Z' }; [...document.querySelectorAll('.notification-toolbar button')].find(button => button.textContent === 'Refresh').click()`);
    await waitFor(`document.querySelectorAll('.notification-email-status.is-sent').length === 2 && !document.querySelector('.notification-email-status.is-pending')`);
    await evaluate(`document.querySelector('[aria-label="Close notifications"]').click()`);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  }
  // Reuse the same browser harness for patient signup, password recovery, and signed-in password changes.
  for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const injection = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      localStorage.removeItem('caresync_token');
      const now = Date.now; window.clockOffset = 0; Date.now = () => now() + window.clockOffset;
      const user = { _id: 'otp-patient', firstName: 'Alex', lastName: 'Santos', role: 'Patient', email: 'alex@example.test' };
      window.otpRequests = []; window.failOtpSend = false; window.delayPasswordReset = false;
      window.formSubmissions = 0; document.addEventListener('submit', () => window.formSubmissions++, true);
      const original = window.fetch;
      window.fetch = async (url, options = {}) => {
        if (!String(url).startsWith('/api/')) return original(url, options);
        const body = options.body ? JSON.parse(options.body) : {};
        let data = [], status = 200;
        if (url === '/api/users/register/otp' || url === '/api/users/password/otp') {
          window.otpRequests.push({ url, body });
          if (window.failOtpSend) { window.failOtpSend = false; return new Response(JSON.stringify({ message: 'Could not deliver verification code' }), { status: 503 }); }
          data = { message: 'Check your email for the verification code.', resendAfterSeconds: 60, expiresInSeconds: 600 };
        } else if (url === '/api/users/register' || url === '/api/users/password/reset') {
          window.otpRequests.push({ url, body });
          if (body.otp !== '123456') return new Response(JSON.stringify({ message: 'Invalid or expired verification code' }), { status: 400 });
          if (url.endsWith('/register')) { data = { user, token: 'otp-ui-token' }; status = 201; }
          else {
            if (window.delayPasswordReset) { window.delayPasswordReset = false; await new Promise(resolve => { window.releasePasswordReset = resolve; }); }
            data = { message: 'Password changed. Sign in again.' };
          }
        } else if (url === '/api/users/me') data = user;
        else if (url === '/api/users/login') data = { user, token: 'otp-ui-token' };
        else if (url.startsWith('/api/notifications')) data = { items: [], unreadCount: 0, total: 0 };
        else if (url === '/api/system/time') data = { currentTime: '2026-10-04T02:00:00Z', operatingStatus: { isOpen: true, message: 'Clinic is open' } };
        return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
      };
    })()` });
    await send('Page.navigate', { url: process.argv[3] || 'http://127.0.0.1:3000' });
    await waitFor(`!!document.querySelector('.landing-auth-actions')`);
    const input = (selector, value) => evaluate(`(() => { const field = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const clickText = text => evaluate(`[...document.querySelectorAll('button')].find(button => button.getClientRects().length && button.textContent.includes(${JSON.stringify(text)})).click()`);
    const checkPasswordToggle = async id => {
      const field = `document.getElementById(${JSON.stringify(id)})`;
      const button = `document.querySelector('button[aria-controls="${id}"]')`;
      const before = await evaluate(`({ value: ${field}.value, submissions: window.formSubmissions, autocomplete: ${field}.autocomplete })`);
      assert.equal(await evaluate(`${field}.type`), 'password');
      await evaluate(`${button}.click()`);
      assert.equal(await evaluate(`${field}.type`), 'text');
      assert.equal(await evaluate(`${button}.getAttribute('aria-pressed')`), 'true');
      if (id === 'password-change-new') assert.equal(await evaluate(`document.querySelector('#password-change-confirm').type`), 'password', 'Visibility must be independent for confirmation');
      assert(await evaluate(`(() => { const input = ${field}.getBoundingClientRect(), toggle = ${button}.getBoundingClientRect(); return toggle.left >= input.left && toggle.right <= input.right && toggle.top >= input.top && toggle.bottom <= input.bottom; })()`), 'Toggle must fit inside the field');
      await evaluate(`${button}.focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await waitFor(`${field}.type === 'password'`);
      assert.equal(await evaluate(`${button}.getAttribute('aria-pressed')`), 'false');
      assert.deepEqual(await evaluate(`({ value: ${field}.value, submissions: window.formSubmissions, autocomplete: ${field}.autocomplete })`), before, 'Show/hide must preserve the value and autocomplete without submitting');
    };
    await clickText('Sign Up');
    await waitFor(`document.querySelector('.auth-modal-backdrop')?.open`);
    await input('#register-name', 'Alex'); await input('#register-last-name', 'Santos');
    await input('#register-email', 'alex@example.test'); await input('#register-password', 'test-password');
    await checkPasswordToggle('register-password');
    await evaluate(`window.failOtpSend = true; document.querySelector('#register-name').form.requestSubmit()`);
    await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('Could not deliver')`);
    assert.equal(await evaluate(`document.querySelectorAll('.email-send-notice').length`), 0, 'Failed SMTP must not show a success banner');
    assert.equal(await evaluate(`document.querySelector('#register-email').value`), 'alex@example.test');
    await evaluate(`document.querySelector('#register-name').form.requestSubmit()`);
    await waitFor(`!!document.querySelector('#register-otp')`);
    assert(await evaluate(`document.querySelector('.email-send-notice')?.textContent.includes('Verification email sent successfully')`));
    assert.equal(await evaluate(`document.querySelector('.email-send-notice').getAttribute('role')`), 'status');
    assert(await evaluate(`document.querySelector('.otp-actions button').disabled`));
    assert.equal(await evaluate(`window.otpRequests.filter(item => item.url.endsWith('/register')).length`), 0, 'Signup must wait for email verification');
    await input('#register-otp', '999999');
    await evaluate(`document.querySelector('#register-otp').form.requestSubmit()`);
    await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('Invalid')`);
    assert.equal(await evaluate(`document.querySelector('#register-otp').value`), '999999');
    await evaluate(`window.clockOffset += 61000`);
    await waitFor(`!document.querySelector('.otp-actions button').disabled`);
    await clickText('Resend code');
    await waitFor(`document.querySelector('#register-otp').value === '' && document.querySelector('.otp-actions button').disabled`);
    assert(await evaluate(`document.querySelector('.email-send-notice')?.textContent.includes('sent successfully')`));
    await input('#register-otp', '123456');
    await evaluate(`document.querySelector('#register-otp').scrollIntoView({ block: 'center' }); Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})))`);
    assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('.auth-card').scrollWidth <= document.querySelector('.auth-card').clientWidth`));
    let picture = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, `signup-otp-${width}.png`), Buffer.from(picture.data, 'base64'));
    await evaluate(`document.querySelector('#register-otp').form.requestSubmit()`);
    await waitFor(`!!document.querySelector('.navbar-user')`);
    assert.equal(await evaluate(`localStorage.getItem('caresync_token')`), 'otp-ui-token');
    await clickText('Change password');
    await waitFor(`document.querySelector('.password-dialog')?.open`);
    assert(await evaluate(`document.querySelector('#password-change-email').readOnly`));
    await evaluate(`document.querySelector('#password-change-email').form.requestSubmit()`);
    await waitFor(`!!document.querySelector('#password-change-otp')`);
    assert(await evaluate(`document.querySelector('.email-request-notice')?.textContent.includes('Verification request received')`));
    assert(!await evaluate(`document.querySelector('.email-request-notice').textContent.includes('sent successfully')`), 'Password request acknowledgement must not claim confirmed delivery');
    await input('#password-change-otp', '123456'); await input('#password-change-new', 'new-password'); await input('#password-change-confirm', 'different-password');
    await checkPasswordToggle('password-change-new');
    await checkPasswordToggle('password-change-confirm');
    await evaluate(`document.querySelector('#password-change-otp').form.requestSubmit()`);
    await waitFor(`document.querySelector('.password-dialog [role=alert]')?.textContent.includes('do not match')`);
    assert.equal(await evaluate(`window.otpRequests.filter(item => item.url.endsWith('/reset')).length`), 0);
    await input('#password-change-confirm', 'new-password');
    assert(await evaluate(`(() => { const r = document.querySelector('.password-dialog').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })()`));
    await evaluate(`Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})))`);
    picture = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, `password-change-${width}.png`), Buffer.from(picture.data, 'base64'));
    // Closing during the submitted operation must still sign out the changed account on success.
    await evaluate(`window.delayPasswordReset = true; document.querySelector('#password-change-otp').form.requestSubmit()`);
    await waitFor(`typeof window.releasePasswordReset === 'function'`);
    assert(await evaluate(`document.querySelector('button[aria-controls="password-change-new"]').disabled && document.querySelector('button[aria-controls="password-change-confirm"]').disabled`), 'Visibility controls must respect disabled fields');
    await evaluate(`document.querySelector('button[aria-label="Close password change"]').click(); window.releasePasswordReset()`);
    await waitFor(`!localStorage.getItem('caresync_token') && !!document.querySelector('#login-email')`);
    await input('#login-password', 'test-password');
    await checkPasswordToggle('login-password');
    await clickText('Forgot password?');
    await waitFor(`!!document.querySelector('#password-change-email')`);
    await input('#password-change-email', 'alex@example.test');
    await evaluate(`document.querySelector('#password-change-email').form.requestSubmit()`);
    await waitFor(`!!document.querySelector('#password-change-otp')`);
    await input('#password-change-otp', '123456'); await input('#password-change-new', 'recovered-password'); await input('#password-change-confirm', 'recovered-password');
    await evaluate(`document.querySelector('#password-change-otp').form.requestSubmit()`);
    await waitFor(`document.querySelector('[role=status]')?.textContent.includes('Password changed') && !!document.querySelector('#login-password')`);
    assert.equal(await evaluate(`document.querySelector('#login-password').value`), '');
    assert.equal(await evaluate(`localStorage.getItem('caresync_token')`), null);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  }
  assert.deepEqual(errors, []);
  console.log(`Passed all-role comments, correction/resubmission/history controls, password visibility and signup/password OTP flows at desktop/mobile widths. Screenshots: ${screenshots}`);
} finally { socket?.close(); chrome.kill(); }
