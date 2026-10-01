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
appointments.push({ _id: 'flexible-appointment', patient, doctor: null, slot: null, status: 'Pending', date: '2026-10-01', timeSlot: '09:00 - 09:30 AM', reason: 'Flexible consultation', statusHistory: [] });
let role = null;
let empty = false;
const errors = [];
const mutations = [];
let failNextMutation = false;
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
    }
    let data = [];
    if (url.pathname === '/api/users/me') data = { ...patient, role, _id: role === 'Doctor' ? doctor._id : patient._id };
    else if (url.pathname === '/api/users/doctors') data = [doctor];
    else if (url.pathname.endsWith('/schedule')) data = { workingHours: [{ day: 4, start: '09:00', end: '17:00' }], consultationDuration: 15, scheduleConfigured: true };
    else if (url.pathname === '/api/reports') data = { from: url.searchParams.get('from'), to: url.searchParams.get('to'), scope: role === 'Doctor' ? 'My consultations' : 'Clinic appointments', total: empty ? 0 : 5, statuses: { Pending: empty ? 0 : 2, Confirmed: empty ? 0 : 1, 'In Progress': empty ? 0 : 1, Completed: empty ? 0 : 1, Cancelled: 0, Declined: 0, 'No-show': 0 }, daily: [{ _id: '2026-10-01', total: 5, completed: 1 }], doctors: [{ _id: doctor._id, firstName: doctor.firstName, lastName: doctor.lastName, total: 4, completed: 1 }, { _id: null, total: 1, completed: 0 }] };
    else if (url.pathname === '/api/users') data = [patient, doctor].map(user => ({ ...user, createdAt: '2026-01-01', contactNumber: '09171234567' }));
    else if (url.pathname === '/api/appointments') data = empty ? [] : appointments;
    else if (url.pathname === '/api/system/time') data = { currentTime: '2026-10-01T01:00:00Z', isOpen: true, isCustom: false, openTime: '08:30', closeTime: '17:00' };
    else if (url.pathname === '/api/slots') data = [{ _id: 'slot-1', doctor, date: '2026-10-01', startTime: '10:00', endTime: '10:30', status: 'Available' }];
    else if (url.pathname === '/api/walkins') data = [{ _id: 'walkin-1', name: 'Maria Dela Cruz', queueNumber: 12, status: 'Waiting', contactNumber: '09171234567' }];
    else if (url.pathname === '/api/walkins/now-serving') data = { nowServing: empty ? null : { queueNumber: 11, status: 'In Progress' }, upcoming: empty ? [] : [{ queueNumber: 12, status: 'Waiting' }] };
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
      await page.evaluate(() => localStorage.setItem('caresync_token', 'ui-smoke-mock'));
      await page.reload();
      await page.waitForSelector('.dashboard-page');
      await page.waitForFunction(() => document.querySelector('tbody tr'));
      await check(`${role.toLowerCase()}-${width}`);
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
        if (role === 'Doctor') {
          await click('td button', 'Notes');
          await page.waitForSelector('.form-textarea');
          await check(`consultation-${width}`);
          const doctorDownload = page.waitForRequest(request => request.url().endsWith('/download'));
          await click('.modal-content button', 'Download');
          await doctorDownload;
          assert((await actionDialog('button[title="Remove document"]', 'Delete document')).path.endsWith('/documents/document-1'));
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
      } else {
        await click('.dashboard-tabs button', 'User Directory');
        await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('Alex'));
        await check(`users-${width}`);
        await click('.card-header button', 'Add Doctor');
        await page.waitForSelector('.modal-content');
        await check(`add-user-${width}`);
        await page.click('.modal-header button');
        await click('.dashboard-tabs button', 'audit');
        await check(`audit-${width}`);
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
