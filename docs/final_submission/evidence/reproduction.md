# Recreating the synthetic evidence data

The data in `synthetic-export/` is synthetic. It was produced by the scripts in `tools/` against an empty, disposable local MongoDB. It contains no real patients, emails or files.

## From scratch

1. Start an empty, disposable MongoDB on `127.0.0.1:27017` (e.g. `docker run -d --name caresync-evidence-mongo -p 127.0.0.1:27017:27017 mongo:8.0`).
2. Export the evidence environment and start the backend and frontend exactly as described in [`README.md`](README.md#commands-used). Use a new random `JWT_SECRET` and a synthetic `EVIDENCE_PASSWORD`. `tools/lib.js` refuses any `MONGO_URI` other than a local `caresync_evidence` database.
3. Run the scripts in this order. The first one creates the accounts and sets the clinic clock to `2026-10-13T08:45:00+08:00`:

   ```bash
   node docs/final_submission/evidence/tools/bootstrap.js
   node docs/final_submission/evidence/tools/sc01.js
   node docs/final_submission/evidence/tools/sc02.js
   node docs/final_submission/evidence/tools/sc02b.js
   node docs/final_submission/evidence/tools/sc03.js
   node docs/final_submission/evidence/tools/sc04.js
   node docs/final_submission/evidence/tools/sc05.js
   node docs/final_submission/evidence/tools/sc06-07.js
   node docs/final_submission/evidence/tools/sc08.js
   node docs/final_submission/evidence/tools/sc09.js
   node docs/final_submission/evidence/tools/sc11.js
   node docs/final_submission/evidence/tools/sc10.js
   node docs/final_submission/evidence/tools/integration.js
   node docs/final_submission/evidence/tools/export-synthetic.js
   ```

4. The export is written to `synthetic-export/<collection>.json` (MongoDB Extended JSON, relaxed) with a `manifest.json` of document counts.

The simulated clock lives in the API process memory. Restarting the backend resets it, so re-run `bootstrap.js`'s time step through `POST /api/system/time` as Admin if you restart mid-sequence.

## What the export omits

| Omitted | Why |
| --- | --- |
| `password`, `codeHash`, and any `token`, `tokenVersion` or `*Token` field | Credentials and session material, even synthetic ones |
| `emailotps` collection | One-time-code challenges |
| `medicalFiles.chunks` | Raw uploaded bytes (synthetic text files). File metadata in `medicalFiles.files` is kept. |

Accounts restored from this export have no password. Recreate the data with the steps above rather than importing it, or set passwords through the app's own flows.

## Differences from the committed export

The committed export also contains one extra completed appointment, from the first `integration.js` attempt (see `integration-evidence.md`). A clean re-run produces two completed appointments for 2026-10-13 instead of three. ObjectIds and timestamps differ on every run.
