// Run with a Puppeteer module path and optional Chrome executable path.
// Uses mock API responses; never reads or writes real patient records.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const module = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'puppeteer');
const puppeteer = module.puppeteer || module.default;
const baseUrl = process.argv[4] || 'http://127.0.0.1:3000';
const screenshots = join(tmpdir(), 'caresync-ui-review');
await mkdir(screenshots, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.argv[3] || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const doctor = { _id: 'doctor-1', firstName: 'Isabel', lastName: 'Reyes', email: 'isabel@example.com', role: 'Doctor' };
const patient = { _id: 'patient-1', firstName: 'Alex', lastName: 'Santos', email: 'alex@example.com', role: 'Patient' };
const appointments = ['Pending', 'Confirmed', 'In Progress', 'Completed'].map((status, index) => ({
  _id: `appointment-${index}`, patient, doctor, slot: 'booked-slot', status, date: '2026-10-01', timeSlot: '10:00 - 10:30 AM',
  reason: 'Follow-up consultation', consultationNotes: 'Review of routine results.', documents: [{ _id: 'document-1', filename: 'Lab result.pdf', type: 'lab_result', url: '/uploads/mock-lab-result.pdf' }],
  statusHistory: [{ status, changedAt: '2026-10-01T01:00:00Z', remarks: 'Updated by the care team' }],
}));
appointments.push({ ...appointments[1], _id: 'arrived-appointment', status: 'Checked In', queueNumber: 7, checkedInAt: '2026-10-01T01:00:00Z' });
appointments.push({ _id: 'flexible-appointment', patient, doctor: null, slot: null, status: 'Pending', date: '2026-10-01', timeSlot: '09:00 - 09:30 AM', reason: 'Flexible consultation', statusHistory: [] });
appointments.push({ _id: 'walkin-appointment', patient: null, walkIn: { _id: 'walkin-visit', name: 'Sofia Cruz', contactNumber: '09181234567', queueNumber: 41 }, doctor, slot: 'walkin-slot', status: 'No-show', date: '2026-10-01', timeSlot: '09:00–09:15', reason: 'Walk-in consultation', statusHistory: [] });
appointments.push({ _id: 'missing-patient-details', patient: null, walkIn: 'unavailable-walkin-reference', doctor, status: 'No-show', date: '2026-10-01', timeSlot: '09:15–09:30', reason: 'Walk-in consultation', statusHistory: [] });
let role = null;
let empty = false;
const errors = [];
const mutations = [];
let failNextMutation = false;
let walkIns = [];
let notifications = [];
let failNextNotificationGet = false;
let directoryUsers = [patient, doctor].map(user => ({ ...user, status: 'Active', createdAt: '2026-01-01', contactNumber: '09171234567' }));
const auditLogs = [
  { _id: 'audit-user', action: 'USER_CREATED', targetModel: 'User', targetId: 'created-user', changes: { user: { firstName: 'Created', lastName: 'Staff', role: 'Staff' }, creationMethod: 'Admin creation' } },
  { _id: 'audit-document', action: 'DOCUMENT_DELETED', targetModel: 'Appointment', targetId: 'appointment-1', changes: { document: { filename: 'Test record.pdf', type: 'lab_result' } } },
  { _id: 'audit-generation', action: 'SLOTS_GENERATED', targetModel: 'User', targetId: doctor._id, changes: { doctor, generation: { date: '2026-10-03', startTime: '09:00', endTime: '09:30', duration: 15, requestedSlots: 2, totalSlots: 2, source: 'Manual' } } },
].map(row => ({ ...row, timestamp: '2026-10-03T02:00:00Z', performedBy: { ...patient, role: 'Admin' } }));
try {
  const page = await browser.newPage();
  await (await page.createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'deny' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    errors.push(`Unexpected browser popup: ${dialog.type()}`);
    await dialog.dismiss();
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return request.continue();
    if (url.pathname.startsWith('/api/notifications')) {
      assert.equal(request.headers().authorization, 'Bearer ui-smoke-mock', 'Notifications must send the login token');
      if (request.method() === 'GET' && failNextNotificationGet) {
        failNextNotificationGet = false;
        return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Notifications are temporarily unavailable.' }) });
      }
    }
    if (url.pathname.endsWith('/download')) {
      assert.equal(request.headers().authorization, 'Bearer ui-smoke-mock', 'Medical downloads must send the login token');
      return request.respond({ status: 200, contentType: 'application/pdf', body: 'Mock PDF download' });
    }
    if (request.method() !== 'GET') {
      mutations.push({ path: url.pathname, body: JSON.parse(request.postData() || '{}') });
      if (failNextMutation) {
        failNextMutation = false;
        return request.respond({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Mock action failed. Please try again.' }) });
      }
      if (url.pathname.match(/^\/api\/walkins\/[^/]+\/status$/)) {
        const row = walkIns.find(row => url.pathname.includes(`/${row._id}/`));
        row.status = JSON.parse(request.postData()).status;
      }
      if (request.method() === 'PATCH' && url.pathname.match(/^\/api\/appointments\/[^/]+\/(check-in|start)$/)) {
        const visit = appointments.find(visit => url.pathname.includes(`/${visit._id}/`));
        visit.status = url.pathname.endsWith('/start') ? 'In Progress' : 'Checked In';
        visit.queueNumber ||= 8;
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: visit }) });
      }
      if (request.method() === 'PATCH' && url.pathname.match(/^\/api\/users\/[^/]+$/)) {
        const user = directoryUsers.find(user => url.pathname === `/api/users/${user._id}`);
        Object.assign(user, JSON.parse(request.postData()));
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: user }) });
      }
      if (url.pathname === '/api/notifications/read-all') notifications.forEach(item => { item.readAt ||= new Date().toISOString(); });
      else if (url.pathname.match(/^\/api\/notifications\/[^/]+\/read$/)) {
        const item = notifications.find(item => url.pathname.includes(`/${item._id}/`));
        item.readAt ||= new Date().toISOString();
      }
    }
    let data = [];
    if (url.pathname === '/api/notifications') {
      const filtered = notifications.filter(item => url.searchParams.get('unread') !== 'true' || !item.readAt);
      const pageNumber = Number(url.searchParams.get('page') || 1);
      data = { items: filtered.slice((pageNumber - 1) * 20, pageNumber * 20), total: filtered.length, unreadCount: notifications.filter(item => !item.readAt).length, page: pageNumber, pageSize: 20 };
    }
    else if (url.pathname === '/api/users/me') data = { ...patient, role, _id: role === 'Doctor' ? doctor._id : patient._id };
    else if (url.pathname === '/api/users/doctors') data = [doctor];
    else if (url.pathname.endsWith('/schedule')) data = { workingHours: [{ day: 4, start: '09:00', end: '17:00' }], consultationDuration: 15, scheduleConfigured: true };
    else if (url.pathname === '/api/reports') data = { from: url.searchParams.get('from'), to: url.searchParams.get('to'), scope: role === 'Doctor' ? 'My consultations' : 'Clinic appointments', total: empty ? 0 : 5, statuses: { Pending: empty ? 0 : 2, Confirmed: empty ? 0 : 1, 'In Progress': empty ? 0 : 1, Completed: empty ? 0 : 1, Cancelled: 0, Declined: 0, 'No-show': 0 }, daily: [{ _id: '2026-10-01', total: 5, completed: 1 }], doctors: [{ _id: doctor._id, firstName: doctor.firstName, lastName: doctor.lastName, total: 4, completed: 1 }, { _id: null, total: 1, completed: 0 }] };
    else if (url.pathname === '/api/users') data = directoryUsers;
    else if (url.pathname === '/api/audit-logs') data = { logs: empty ? [] : auditLogs, total: empty ? 0 : auditLogs.length, page: 1, limit: 50 };
    else if (url.pathname === '/api/appointments') data = empty ? [] : appointments.filter(item => role !== 'Patient' || item.patient?._id === patient._id);
    else if (url.pathname.match(/^\/api\/appointments\/[^/]+\/versions$/)) data = { notes: [], documents: [], notesRevision: 0 };
    else if (url.pathname === '/api/system/time') data = { currentTime: '2026-10-01T01:00:00Z', isOpen: true, isCustom: false, openTime: '08:30', closeTime: '17:00' };
    else if (url.pathname === '/api/slots') data = [{ _id: 'slot-1', doctor, date: '2026-10-01', startTime: '10:00', endTime: '10:30', status: 'Available' }];
    else if (url.pathname === '/api/walkins') data = walkIns.filter(row => !url.searchParams.get('status') || row.status === url.searchParams.get('status'));
    else if (url.pathname === '/api/walkins/now-serving') data = { nowServing: empty ? null : { queueNumber: 'A-7', status: 'In Progress' }, serving: empty ? [] : [{ queueNumber: 'A-7', status: 'In Progress' }, { queueNumber: 11, status: 'In Progress' }], upcoming: empty ? [] : [{ queueNumber: 'A-8', status: 'Checked In' }, { queueNumber: 12, status: 'Waiting' }] };
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, date: '2026-10-01' }) });
  });
  const click = async (selector, text) => {
    const found = await page.evaluate(({ selector, text }) => {
      const element = [...document.querySelectorAll(selector)].find(item => item.textContent.includes(text));
      element?.click();
      return !!element;
    }, { selector, text });
    assert(found, `Missing control: ${text}`);
  };
  const check = async name => {
    console.log(`Checking ${name}`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: page overflows horizontally`);
    assert(await page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)), `${name}: broken image`);
    await page.screenshot({ path: join(screenshots, `${name}.png`), fullPage: true });
  };
  const actionDialog = async (selector, action, { reason, required = false, defaultReason } = {}) => {
    const before = mutations.length;
    await page.click(selector);
    await page.waitForSelector('.care-dialog[open]');
    assert.equal(mutations.length, before, `${action}: mutated before confirmation`);
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    // Native dialogs can tab into browser chrome; background app controls must remain inert.
    assert(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('.care-dialog') !== null), `${action}: focus reached a background control`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.care-dialog', { hidden: true });
    assert.equal(mutations.length, before, `${action}: Escape performed action`);
    assert(await page.evaluate(selector => document.activeElement.matches(selector), selector), `${action}: focus was not restored`);
    await page.click(selector);
    await page.waitForSelector('.care-dialog[open]');
    await click('.care-dialog button', 'Keep unchanged');
    await page.waitForSelector('.care-dialog', { hidden: true });
    assert.equal(mutations.length, before, `${action}: dismissal performed action`);
    await page.click(selector);
    await page.waitForSelector('.care-dialog[open]');
    if (defaultReason) assert.equal(await page.$eval('.care-dialog textarea', input => input.value), defaultReason);
    if (required) {
      assert(await page.$eval('.care-dialog button[type="submit"]', button => button.disabled), `${action}: empty reason allowed`);
      await page.type('.care-dialog textarea', '   ');
      assert(await page.$eval('.care-dialog button[type="submit"]', button => button.disabled), `${action}: whitespace reason allowed`);
    }
    if (reason !== undefined) {
      await page.$eval('.care-dialog textarea', input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.click('.care-dialog textarea', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type('.care-dialog textarea', reason);
    }
    await check(`${role.toLowerCase()}-${action.replaceAll(' ', '-')}-${page.viewport().width}`);
    const response = page.waitForResponse(response => response.request().method() !== 'GET' && response.url().includes('/api/'));
    await click('.care-dialog button[type="submit"]', action);
    await response;
    await page.waitForSelector('.care-dialog', { hidden: true });
    assert.equal(mutations.length, before + 1, `${action}: expected one mutation`);
    return mutations.at(-1);
  };
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 960 });
    role = null;
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.removeItem('caresync_token'));
    await page.reload();
    await page.waitForSelector('.landing-hero');
    await check(`landing-${width}`);
    await click('.landing-auth-actions button', 'Log In');
    await page.waitForSelector('dialog[open] #login-email');
    await check(`login-${width}`);
    // Native modal dialog confines keyboard focus and Escape closes it.
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.activeElement.closest('dialog') !== null));
    await click('.auth-welcome-panel button', 'Create');
    await page.waitForSelector('#register-last-name');
    await check(`register-${width}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog', { hidden: true });
    for (const nextRole of ['Patient', 'Doctor', 'Staff', 'Admin']) {
      role = nextRole;
      notifications = Array.from({ length: 25 }, (_, index) => ({ _id: `notification-${index}`, title: index === 0 ? (role === 'Doctor' ? 'Appointment request assigned' : role === 'Patient' ? 'Appointment request received' : 'New appointment request') : 'Appointment confirmed',
        message: index === 0 ? 'An appointment request for Oct 2, 2026, 10:00–10:15 is pending clinic review.' : 'The appointment for Oct 2, 2026, 10:00–10:15 has been confirmed.',
        createdAt: '2026-10-02T02:00:00Z', readAt: index < 2 ? null : '2026-10-02T02:05:00Z' }));
      walkIns = ['Waiting', 'Slot Assigned', 'Checked In', 'In Progress'].map((status, index) => ({
        _id: `walkin-${index + 1}`, name: `Maria Dela Cruz ${index + 1}`, queueNumber: 12 + index, status,
        contactNumber: '09171234567', assignedSlot: index ? { startTime: '10:00', endTime: '10:30', doctor } : null,
      })).filter(row => role !== 'Doctor' || ['Checked In', 'In Progress'].includes(row.status));
      await page.evaluate(() => localStorage.setItem('caresync_token', 'ui-smoke-mock'));
      await page.reload();
      await page.waitForSelector('.dashboard-page');
      await page.waitForFunction(() => document.querySelector('tbody tr'));
      await check(`${role.toLowerCase()}-${width}`);
      if (role !== 'Patient') {
        const cells = await page.$$eval('.appointment-patient-details', elements => elements.map(element => element.textContent));
        assert(cells.some(text => text.includes('Sofia Cruz') && text.includes('09181234567') && text.includes('Walk-in · Queue #41')), `${role}: walk-in identity missing`);
        assert(cells.some(text => text.includes('Alex Santos') && text.includes('alex@example.com') && !text.includes('Walk-in')), `${role}: registered patient display changed`);
        assert(cells.some(text => text.includes('Patient details unavailable') && !text.includes('undefined')), `${role}: missing patient identity must be explicit`);
        await check(`walkin-appointment-identity-${role.toLowerCase()}-${width}`);
      } else assert(!(await page.evaluate(() => document.querySelector('.dashboard-page').textContent)).includes('Sofia Cruz'), 'Walk-in records must not appear in another patient portal');
      await page.waitForFunction(() => document.querySelector('.notification-count')?.textContent === '2');
      await page.click('.notification-trigger');
      await page.waitForSelector('.notification-dialog[open] .notification-list li');
      assert(await page.evaluate(() => document.activeElement.closest('.notification-dialog') !== null), 'Inbox must contain keyboard focus');
      assert(await page.evaluate(() => document.querySelector('.notification-item-footer time').getBoundingClientRect().height > 0), 'Notification timestamps must remain visible on mobile');
      await check(`notifications-${role.toLowerCase()}-${width}`);
      await click('.notification-filters button', 'Unread');
      await page.waitForFunction(() => document.querySelectorAll('.notification-list li').length === 2);
      failNextMutation = true;
      await click('.notification-item-footer button', 'Mark as read');
      await page.waitForSelector('.notification-dialog [role="alert"]');
      assert.equal(notifications.filter(item => !item.readAt).length, 2, 'Failed read must retain unread status');
      await click('.notification-dialog [role="alert"] button', 'Retry');
      await page.waitForSelector('.notification-dialog [role="alert"]', { hidden: true });
      await click('.notification-item-footer button', 'Mark as read');
      await page.waitForFunction(() => document.querySelectorAll('.notification-list li').length === 1);
      await click('.notification-toolbar button', 'Mark all as read');
      await page.waitForFunction(() => document.querySelector('.notification-empty')?.textContent.includes('caught up'));
      assert.equal(notifications.filter(item => !item.readAt).length, 0);
      await check(`notifications-unread-empty-${role.toLowerCase()}-${width}`);
      await click('.notification-filters button', 'All');
      await page.waitForFunction(() => document.querySelectorAll('.notification-list li').length === 20);
      await click('.notification-pagination button', 'Next');
      await page.waitForFunction(() => document.querySelectorAll('.notification-list li').length === 5);
      await click('.notification-pagination button', 'Previous');
      await page.waitForFunction(() => document.querySelectorAll('.notification-list li').length === 20);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.notification-dialog', { hidden: true });
      assert(await page.evaluate(() => document.activeElement.classList.contains('notification-trigger')), 'Inbox dismissal must restore trigger focus');
      failNextNotificationGet = true;
      await page.click('.notification-trigger');
      await page.waitForSelector('.notification-dialog [role="alert"]');
      await check(`notifications-unavailable-${role.toLowerCase()}-${width}`);
      await click('.notification-dialog [role="alert"] button', 'Retry');
      await page.waitForSelector('.notification-dialog [role="alert"]', { hidden: true });
      await page.click('[aria-label="Close notifications"]');
      await page.waitForSelector('.notification-dialog', { hidden: true });
      await page.click('button[title="Clinic clock and operating hours"]');
      await page.waitForSelector('.system-time-modal');
      assert.equal(!!await page.$('.system-time-modal form'), role === 'Admin', `${role}: clock editing must be Admin-only`);
      await check(`clinic-clock-${role.toLowerCase()}-${width}`);
      if (role === 'Admin') {
        const clockRequest = page.waitForRequest(request => request.url().endsWith('/api/system/time') && request.method() === 'POST');
        await click('.system-time-modal button', 'Opening');
        assert.equal(JSON.parse((await clockRequest).postData()).time, '2026-10-01T08:30:00');
        await page.waitForSelector('.system-time-modal', { hidden: true });
      } else await page.click('.system-time-modal .modal-header button');
      assert(await page.$('.badge-In-Progress'), `${role}: multiword status badge is missing`);
      if (width === 1440) assert(await page.evaluate(() => document.querySelector('.dashboard-tabs').getBoundingClientRect().bottom < document.querySelector('.navbar-tools').getBoundingClientRect().top), `${role}: sidebar overlaps`);
      if (role === 'Patient' || role === 'Doctor' || role === 'Staff') {
        const cancelTitle = role === 'Doctor' ? 'Cancel Consultation' : role === 'Staff' ? 'Cancel' : 'Cancel Appointment';
        const cancellation = await actionDialog(`button[title="${cancelTitle}"]`, 'Cancel appointment');
        assert(cancellation.path.endsWith('/cancel'));
        assert.equal(cancellation.body.reason, `Cancelled by ${role === 'Patient' ? 'patient' : role === 'Doctor' ? 'Doctor' : 'staff'}`);
        if (role !== 'Patient') {
          const decline = await actionDialog('button[title="Decline Appointment"]', 'Decline appointment', { required: true, reason: '  Schedule unavailable  ' });
          assert(decline.path.endsWith('/decline'));
          assert.equal(decline.body.reason, 'Schedule unavailable');
        }
        if (role === 'Staff') {
          assert((await actionDialog('button[title="Approve Appointment"]', 'Approve appointment')).path.endsWith('/approve'));
          const noShow = await actionDialog('button[title="Mark No-Show (Frees slot)"]', 'Mark no-show', { defaultReason: 'Patient did not arrive for scheduled slot' });
          assert.equal(noShow.body.reason, 'Patient did not arrive for scheduled slot');
          assert((await actionDialog('button[title="Mark Completed"]', 'Complete appointment')).path.endsWith('/complete'));
        }
        if (role === 'Patient') {
          failNextMutation = true;
          await page.click(`button[title="${cancelTitle}"]`);
          await page.waitForSelector('.care-dialog[open]');
          await click('.care-dialog button[type="submit"]', 'Cancel appointment');
          await page.waitForFunction(() => document.querySelector('.care-dialog')?.textContent.includes('Mock action failed'));
          await check(`error-notice-${width}`);
          await click('.care-dialog button', 'Got it');
          await page.waitForSelector('.care-dialog', { hidden: true });
        }
      }
      if (role === 'Patient') {
        await click('.page-header button', 'Book');
        await page.waitForSelector('.modal-content');
        await check(`booking-${width}`);
        await page.click('.modal-header button');
        await click('td button', 'History');
        await page.waitForSelector('.timeline');
        await check(`history-${width}`);
        await page.click('.modal-header button');
        await click('td button', 'Medical Records');
        await check(`records-${width}`);
        const downloadRequest = page.waitForRequest(request => request.url().endsWith('/download'));
        await click('.modal-content button', 'Download');
        assert((await downloadRequest).url().includes('/appointments/appointment-0/documents/document-1/download'));
        await page.click('.modal-header button');
      } else if (role === 'Staff' || role === 'Doctor') {
        if (role === 'Staff') {
          const checkedIn = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/check-in'));
          await click('td button', 'Check In');
          await checkedIn;
          await page.waitForSelector('.badge-Checked-In');
          assert(mutations.at(-1).path.endsWith('/check-in'));
          await check(`scheduled-arrival-${width}`);
        }
        if (role === 'Doctor') {
          const started = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/start'));
          await click('td button', 'Start consultation');
          await started;
          await page.waitForSelector('.form-textarea');
          assert(mutations.at(-1).path.endsWith('/start'));
          await check(`consultation-${width}`);
          const doctorDownload = page.waitForRequest(request => request.url().endsWith('/download'));
          await click('.modal-content button', 'Download');
          await doctorDownload;
          assert((await actionDialog('button[title="Archive document"]', 'Archive document')).path.endsWith('/documents/document-1'));
          await click('.modal-footer button', 'Complete Consultation');
          await page.waitForSelector('.care-dialog[open]');
          await check(`complete-consultation-${width}`);
          await click('.care-dialog button', 'Keep unchanged');
          await page.waitForSelector('.care-dialog', { hidden: true });
          await page.click('.modal-header button');
        }
        await click('.dashboard-tabs button', role === 'Staff' ? 'Slot Management' : 'My Slots');
        await page.waitForSelector('.slot-doctor-toggle, tbody .badge-Available');
        await check(`${role.toLowerCase()}-slots-${width}`);
        if (role === 'Staff') await page.click('.slot-doctor-toggle');
        assert((await actionDialog('button[title="Block / Cancel Slot"]', 'Block slot')).path.endsWith('/slots/slot-1/status'));
        await click('button', 'Custom Generator');
        if (role === 'Staff') await page.select('form select', 'doctor-1');
        await click('form button', 'Generate Slots');
        await page.waitForSelector('.care-dialog[open]');
        assert(await page.$eval('.care-dialog', dialog => dialog.textContent.includes('Slots generated')));
        await check(`slots-success-${role.toLowerCase()}-${width}`);
        await click('.care-dialog button', 'Got it');
        await page.waitForSelector('.care-dialog', { hidden: true });
        await click('button', 'Weekly hours');
        if (role === 'Staff') await page.select('.schedule-editor select', 'doctor-1');
        await page.waitForSelector('.working-day');
        assert.equal(await page.$$eval('.working-day', days => days.length), 7);
        await check(`weekly-hours-${role.toLowerCase()}-${width}`);
        await click('.schedule-editor button', 'Save weekly hours');
        await page.waitForFunction(() => document.querySelector('.schedule-editor')?.textContent.includes('Weekly hours saved'));
        const savedSchedule = mutations.at(-1);
        assert(savedSchedule.path.endsWith('/schedule'));
        assert.deepEqual(savedSchedule.body.workingHours, [{ day: 4, start: '09:00', end: '17:00' }]);
        await click('.dashboard-tabs button', 'Walk-in');
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('Maria'));
        await check(`${role.toLowerCase()}-queue-${width}`);
        if (role === 'Staff') {
          await click('td button', 'Assign Slot');
          await page.waitForSelector('.slot-chip');
          await check(`assign-slot-${width}`);
          await page.click('.modal-header button');
          await click('.card-header button', 'Add Walk-In');
          await page.waitForSelector('.modal-content');
          await check(`walkin-form-${width}`);
          await page.click('.modal-header button');
        }
        const actions = role === 'Staff' ? [['Check In', 'Checked In'], ['Left', 'Left']] : [['Start Session', 'In Progress'], ['Complete', 'Completed']];
        for (const [label, status] of actions) {
          const before = mutations.length;
          const response = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().match(/\/walkins\/[^/]+\/status$/));
          await click('td button', label);
          await response;
          await page.waitForFunction(() => !document.querySelector('.table-container[aria-busy="true"]') && !document.querySelector('fieldset[disabled]'));
          assert.equal(mutations.length, before + 1);
          assert(mutations.at(-1).path.match(/^\/api\/walkins\/[^/]+\/status$/));
          assert.equal(mutations.at(-1).body.status, status);
          await page.select('select[aria-label="Filter walk-ins by status"]', status);
          await page.waitForFunction(status => {
            const badges = [...document.querySelectorAll('tbody .badge')];
            return badges.length > 0 && badges.every(badge => badge.textContent.trim() === status);
          }, {}, status);
          await check(`${role.toLowerCase()}-queue-${status.replaceAll(' ', '-')}-${width}`);
          await page.select('select[aria-label="Filter walk-ins by status"]', '');
          await page.waitForFunction(() => !document.querySelector('.table-container[aria-busy="true"]'));
        }
      } else {
        await click('.dashboard-tabs button', 'User Directory');
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('Alex'));
        await check(`users-${width}`);
        await click('.card-header button', 'Add Doctor');
        await page.waitForSelector('.modal-content');
        await check(`add-user-${width}`);
        await page.click('.modal-header button');
        await click('tbody button', 'Edit account');
        await page.waitForSelector('dialog[open] #account-status');
        assert.equal(await page.$('dialog[open] input[name="password"]'), null);
        await page.select('#account-role', 'Staff');
        await page.select('#account-status', 'Deactivated');
        await check(`edit-user-${width}`);
        const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/users/${patient._id}`));
        await click('dialog[open] button', 'Save changes');
        await saved;
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('Deactivated'));
        assert.equal(mutations.at(-1).body.role, 'Staff');
        assert.equal(mutations.at(-1).body.status, 'Deactivated');
        await check(`deactivated-user-${width}`);
        await click('tbody button', 'Edit account');
        await page.waitForSelector('dialog[open] #account-status');
        assert.equal(await page.$eval('#account-status', element => element.value), 'Deactivated');
        await page.select('#account-role', 'Patient');
        await page.select('#account-status', 'Active');
        await click('dialog[open] button', 'Save changes');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await click('.dashboard-tabs button', 'audit');
        await check(`audit-${width}`);
        const auditText = await page.$eval('.table-container', element => element.textContent);
        for (const text of ['User account created', 'Created Staff', 'Admin creation', 'Document deleted', 'Test record.pdf', 'Doctor slots generated', '2 requested windows', '2 total slots']) assert(auditText.includes(text), `Audit viewer missing ${text}`);
        empty = true;
        await page.reload();
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('No appointments'));
        await check(`admin-empty-${width}`);
        empty = false;
        await page.reload();
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('Alex'));
      }
      if (role === 'Staff' || role === 'Admin') {
        await click('.dashboard-tabs button', role === 'Staff' ? 'Appointments' : 'All Appointments');
        await click('td button', 'Assign doctor');
        await page.waitForSelector('.assignment-dialog[open] .slot-chip');
        assert(await page.$eval('.assignment-dialog input[type="date"]', input => input.disabled && input.value === '2026-10-01'));
        await check(`flexible-assignment-${role.toLowerCase()}-${width}`);
        for (let index = 0; index < 8; index++) await page.keyboard.press('Tab');
        assert(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('.assignment-dialog') !== null));
        const beforeAssign = mutations.length;
        await page.keyboard.press('Escape');
        await page.waitForSelector('.assignment-dialog', { hidden: true });
        assert.equal(mutations.length, beforeAssign);
        await click('td button', 'Assign doctor');
        await page.waitForSelector('.assignment-dialog[open] .slot-chip');
        await click('.assignment-dialog button[type="submit"]', 'Assign Slot');
        await page.waitForSelector('.assignment-dialog', { hidden: true });
        assert(mutations.at(-1).path.endsWith('/flexible-appointment/assign'));
        assert.equal(mutations.at(-1).body.slotId, 'slot-1');
      }
      if (role !== 'Patient') {
        await click('.dashboard-tabs button', 'Reports');
        await page.waitForSelector('.report-statuses');
        assert.equal(await page.$eval('.report-filters input[name="from"]', input => input.value), '2026-10-01');
        assert.equal(!!await page.$('.report-filters select'), role !== 'Doctor');
        await check(`reports-${role.toLowerCase()}-${width}`);
        await page.$eval('.report-filters input[name="from"]', input => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-09-01'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
        const reportRequest = page.waitForRequest(request => request.url().includes('/api/reports?'));
        await click('.report-filters button', 'Apply period');
        assert.equal(new URL((await reportRequest).url()).searchParams.get('from'), '2026-09-01');
        await page.waitForSelector('.report-statuses');
        empty = true;
        await click('.report-filters button', 'Apply period');
        await page.waitForSelector('.report-empty');
        await check(`reports-empty-${role.toLowerCase()}-${width}`);
        empty = false;
      }
      for (const dismiss of ['Escape', 'Stay signed in']) {
        await page.click('button[title="Sign Out"]');
        await page.waitForSelector('.care-dialog[open]');
        assert(await page.$eval('.care-dialog', dialog => dialog.textContent.includes('Are you sure you want to sign out?')));
        assert.equal(await page.evaluate(() => localStorage.getItem('caresync_token')), 'ui-smoke-mock');
        if (dismiss === 'Escape') await page.keyboard.press('Escape');
        else await click('.care-dialog button', dismiss);
        await page.waitForSelector('.care-dialog', { hidden: true });
        assert.equal(await page.evaluate(() => localStorage.getItem('caresync_token')), 'ui-smoke-mock', `${role}: dismissal signed out`);
        assert(await page.$('.dashboard-page'), `${role}: dismissal left dashboard`);
      }
      await page.click('button[title="Sign Out"]');
      await page.waitForSelector('.care-dialog[open]');
      await check(`sign-out-${role.toLowerCase()}-${width}`);
      await click('.care-dialog button[type="submit"]', 'Sign out');
      await page.waitForSelector('.landing-hero');
      assert.equal(await page.evaluate(() => localStorage.getItem('caresync_token')), null, `${role}: confirmation did not sign out`);
    }
    await page.goto(`${baseUrl}/#/display`);
    await page.waitForSelector('.cd-queue-number-large');
    assert.equal(await page.$eval('.cd-queue-number-large', element => element.textContent), '#A-7');
    const queueText = await page.$eval('.clinic-display', element => element.textContent);
    assert(queueText.includes('#A-8') && queueText.includes('#12') && queueText.includes('Also in consultation: #11'));
    assert.equal(await page.$eval('.clinic-display', display => display.textContent.includes('Alex Santos') || display.textContent.includes('Maria Dela Cruz')), false);
    await check(`display-${width}`);
    empty = true;
    await page.reload();
    await page.waitForSelector('.cd-empty-queue');
    await check(`display-empty-${width}`);
    empty = false;
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(`All role screens, queue board, dialogs and mobile layouts passed. Screenshots: ${screenshots}`);
} finally {
  await browser.close();
}
