# Deployment inventory (from the repository only)

Sources: `render.yaml`, `.github/workflows/database-backup.yml`, `frontend/vercel.json`, `frontend/.env.example`, `backend/.env.example`, `docs/deployment/*.md` (repository state at commit `0e87172`). Only variable **names** are listed. No deployed service, dashboard or URL was contacted, so everything below is what the repository *records*, not what is live today.

## Services

| Service | Platform / plan (as recorded) | Root dir | Install / build | Start | Health / notes | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `caresync-api` (Express API) | Render web service, `plan: free`, `runtime: node`, `NODE_VERSION` 24. The receipt records the Singapore region. | `backend` | `npm ci --omit=dev && node scripts/install-mongodb-tools.js` (downloads and SHA-256-verifies `mongodump` 100.19.1 for Linux x64) | `node server.js` | `healthCheckPath: /health` | `render.yaml`, deployment receipt |
| CareSync website (React/Vite) | Vercel Hobby (`framework: vite`) | `frontend` (per guide/receipt; not in `vercel.json`) | install `npm ci`, build `npm run build` | static output `dist` | Calls the Render API directly through `VITE_API_BASE_URL` | `frontend/vercel.json`, free-hosting guide |
| Database and documents | MongoDB Atlas Free. The receipt records database `caresync_app` and GridFS bucket `medicalFiles`. | — | — | — | Shared by web and mobile | Deployment receipt, free-hosting guide |
| Email | Gmail API over HTTPS (`EMAIL_TRANSPORT=gmail-api`) | — | — | — | Render Free blocks SMTP | `render.yaml`, free-hosting guide |
| Daily backup trigger | GitHub Actions workflow "Daily database backup": cron `*/15 * * * *` plus `workflow_dispatch`, runs on `ubuntu-latest`, 20-minute timeout, `permissions: contents: read` | — | — | Inline Node script calls `GET`/`POST /api/backup-jobs` with header `X-Backup-Token` and polls until completed | Runs only if `vars.BACKUP_API_URL` is set | `.github/workflows/database-backup.yml` |
| Backup storage | Google Drive of the clinic sender account, `drive.file` scope, private "CareSync Database Backups" folder, encrypted archives | — | — | — | — | `backend/.env.example`, `docs/deployment/database-backups.md` |
| Android app | Flutter APK (separate mobile repository) built with `API_BASE_URL=<Render URL>/api` | not in this repo | — | — | Recorded in the receipt only | Deployment receipt |

## Environment variable names

### Render API (`render.yaml`)

| Name | Set how (as recorded) |
| --- | --- |
| `NODE_VERSION` | Fixed value in Blueprint |
| `NODE_ENV` | Fixed value in Blueprint |
| `TZ` | Fixed value in Blueprint |
| `TRUST_PROXY` | Fixed value in Blueprint |
| `UPLOAD_STORAGE` | Fixed value in Blueprint |
| `EMAIL_ENABLED` | Fixed value in Blueprint |
| `EMAIL_TRANSPORT` | Fixed value in Blueprint |
| `JWT_EXPIRES_IN` | Fixed value in Blueprint |
| `BACKUP_ENABLED` | Fixed value in Blueprint (`"false"` in the file; the backup doc says it was enabled in Render. **Not confirmed from repo.**) |
| `JWT_SECRET` | `generateValue: true` |
| `MONGO_URI` | `sync: false` (secret, set in Render) |
| `CORS_ORIGINS` | `sync: false` |
| `SMTP_USER` | `sync: false` |
| `GMAIL_CLIENT_ID` | `sync: false` |
| `GMAIL_CLIENT_SECRET` | `sync: false` |
| `GMAIL_REFRESH_TOKEN` | `sync: false` |
| `DRIVE_REFRESH_TOKEN` | `sync: false` |
| `BACKUP_ENCRYPTION_KEY` | `sync: false` |
| `BACKUP_SCHEDULER_TOKEN` | `sync: false` |

`PORT` is supplied by Render (guide). `SMTP_APP_PASSWORD` and `MONGODUMP_PATH` appear in `backend/.env.example` but not in `render.yaml`.

### Vercel website

| Name | Notes |
| --- | --- |
| `VITE_API_BASE_URL` | Public; the Render URL including `/api` (`frontend/.env.example`) |

### GitHub Actions

| Name | Kind |
| --- | --- |
| `BACKUP_API_URL` | Repository **variable** (`vars.`) |
| `BACKUP_SCHEDULER_TOKEN` | Repository **secret** (`secrets.`) |

## URLs recorded in the repository

| URL | Recorded as | Source |
| --- | --- | --- |
| `https://caresync-inky.vercel.app` | Website (Vercel production) | Deployment receipt 2026-10-06; `database-backups.md` |
| `https://caresync-api-uhvz.onrender.com` | Backend API base | Deployment receipt; `database-backups.md` (value for `BACKUP_API_URL`) |
| `https://caresync-api-uhvz.onrender.com/health` | API health check | Deployment receipt |
| `https://caresync-api-uhvz.onrender.com/api` | API base for website/mobile | Deployment receipt |
| `https://github.com/EmlanoCC-Dev/SIA_CareSync` | Source repository | README |

## Not confirmed from the repository

- Whether any of the URLs above is currently up. None was contacted.
- The values actually set in Render, Vercel and GitHub, including whether `BACKUP_ENABLED` is `true` in Render (`render.yaml` says `"false"`) and whether `BACKUP_API_URL` is set.
- Whether Vercel is linked to GitHub for automatic deploys. The receipt says it was not linked as of 2026-10-06 and the site was deployed directly. Render's deploy trigger is also unconfirmed.
- The Atlas cluster tier, region and network-access rules, and the database name (the receipt says `caresync_app`; the guide's example uses `healthcare_app`).
- Whether the GitHub Actions workflow is enabled and has run successfully. No run history is stored in the repository.
- The mobile app source and its build configuration. They are in a separate repository.
