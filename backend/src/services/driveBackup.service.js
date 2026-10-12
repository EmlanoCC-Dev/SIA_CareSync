const fs = require('node:fs');
const env = require('../config/env');

const failure = message => Object.assign(new Error(message), { statusCode: 503 });
async function accessToken() {
  let response, data;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET,
        refresh_token: env.DRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
    });
    data = await response.json();
  } catch { throw failure('Google Drive authentication is unavailable. Check the backup connection.'); }
  if (!response.ok || !data.access_token || (data.scope && !data.scope.split(' ').includes('https://www.googleapis.com/auth/drive.file'))) {
    throw failure('Google Drive permission is missing or expired. Reconnect the backup account.');
  }
  return data.access_token;
}

async function drive(token, path, options = {}) {
  let response;
  try {
    response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      ...options, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      redirect: 'error',
    });
  } catch { throw failure('Google Drive could not be reached. Retry the backup shortly.'); }
  if (!response.ok) throw failure(response.status === 401 || response.status === 403
    ? 'Google Drive permission is missing or expired. Reconnect the backup account.'
    : 'Google Drive could not complete the backup request. Check available storage and retry.');
  return response.json();
}

async function prepareDrive() {
  const token = await accessToken();
  const about = await drive(token, 'about?fields=user(emailAddress)');
  if (about.user?.emailAddress?.toLowerCase() !== env.SMTP_USER.toLowerCase()) {
    throw failure('Authorize Google Drive using the same Gmail account that sends clinic email.');
  }
  const query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='caresyncBackupFolder' and value='v1' }";
  const found = await drive(token, `files?${new URLSearchParams({ q: query, fields: 'files(id)', pageSize: '100', orderBy: 'createdTime' })}`);
  let folder = found.files?.[0];
  if (!folder) folder = await drive(token, 'files?fields=id', { method: 'POST', body: JSON.stringify({
    name: 'CareSync Database Backups', mimeType: 'application/vnd.google-apps.folder', appProperties: { caresyncBackupFolder: 'v1' },
  }) });
  if (!/^[\w-]+$/.test(folder?.id || '')) throw failure('Google Drive did not return a valid backup folder.');
  return { token, folderId: folder.id };
}

async function uploadBackup({ token, folderId }, source, filename, checksums, runId) {
  let response;
  try {
    response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,md5Checksum', {
      method: 'POST', signal: AbortSignal.timeout(20000), redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(checksums.size) },
      body: JSON.stringify({ name: filename, parents: [folderId], appProperties: { caresyncBackupId: String(runId), sha256: checksums.sha256 } }),
    });
    if (!response.ok) throw new Error('Upload session rejected');
    const location = new URL(response.headers.get('location'));
    if (location.origin !== 'https://www.googleapis.com' || !location.pathname.startsWith('/upload/drive/')) throw new Error('Invalid upload destination');
    response = await fetch(location, {
      method: 'PUT', signal: AbortSignal.timeout(300000), redirect: 'error', duplex: 'half',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(checksums.size) },
      body: fs.createReadStream(source),
    });
    const data = await response.json();
    if (!response.ok || !/^[\w-]+$/.test(data.id || '') || Number(data.size) !== checksums.size || data.md5Checksum !== checksums.md5) throw new Error('Upload verification failed');
    return data.id;
  } catch { throw failure('The Drive upload could not be verified. Retry the backup and check available Drive storage.'); }
}

module.exports = { prepareDrive, uploadBackup };
