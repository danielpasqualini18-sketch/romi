# Romi - The baby tracker

A free, source-available baby tracker for the beautiful, blurry days. Built with plain
JavaScript, Cloudflare Workers and a shared D1 database. Self-host one installation
per family, and let caregivers sign in with an email code.

Free for families to use, modify and share for noncommercial purposes under
[PolyForm Noncommercial 1.0.0](LICENSE). Commercial use is not permitted under
this licence. This is source-available software, not OSI-approved open source.
See the licensing history below for earlier MIT releases.

**You do not need to buy a domain.** The standard setup uses Cloudflare's supplied
`<worker>.<account-subdomain>.workers.dev` address. A custom domain is optional.

## What it tracks

- Breastfeeds: left, right or both; optional manual duration; a shared timer with
  pause/resume, side switching and review before saving.
- Bottles: expressed breast milk or formula, with ml offered.
- Pumping: expressed quantity in ml.
- Nappies: wet light / medium / heavy, dirty small / large, or both in one change.
- Spit-up: small / large.
- Weight in grams, including date-only measurements, and notes.

The dashboard shows rolling 24-hour totals, seven-day daily averages (spit-up stays a
seven-day total), the latest weight and observed seven-day average gain in g/day.
Weight entries support reusable scale names, colour-coded chart points and a scale filter with its own seven-day average. Explicit `Scale: name` labels in older notes are recognised; other notes remain unchanged. Scale names are included in JSON and CSV backups.

There is an editable timeline, weight chart, caregiver summary, JSON backup/restore
and CSV export. The interface is designed for phone-sized screens and can be added
to an iPhone home screen from Safari.

New databases start **empty**. This repository contains no real baby records,
caregiver emails, deployment credentials or account-specific database/domain IDs.
The tests use fictional data. It is an early self-hosted project, not a managed
service or medical device. It does not estimate breast-milk intake or assess growth.

## Requirements

- Node.js **24 or newer**, with npm, and Git.
- For online hosting: a Cloudflare account with Workers, D1 and Zero Trust Access
  available. Caregivers only need their allowed email addresses; they do not each
  need a Cloudflare account.
- Permission to create a Worker, D1 database and Access application in that account.

Cloudflare's product limits and pricing apply. Check current plans for your use;
this project does not promise that every installation will always cost nothing.
No domain purchase is required for the workers.dev setup.

## 1. Try it locally

```sh
git clone https://github.com/danielpasqualini18-sketch/romi.git
cd romi
npm ci
npm run setup
npm test
npm run db:local
npm run dev
```

Open the localhost URL printed by Wrangler. `npm run setup` copies
`wrangler.example.jsonc` to **`wrangler.jsonc`** if it does not already exist.
The all-zero database ID is a placeholder that works for local development only.
`npm run db:local` creates the local tables; it does not seed records or modify a
remote database. Stop the server with Ctrl+C.

The dev script explicitly enables a local-only authentication bypass. It accepts
localhost/loopback and the supported development-preview hostname only. Do not
expose your development server publicly or set `LOCAL_DEV` on a deployed Worker.
Production fails closed until Access is configured.

## 2. Create your own Cloudflare database

Run these commands from the project root:

```sh
npx wrangler login
npx wrangler d1 create romi
```

If that database name already exists, reuse the correct existing database only if
it belongs to this Romi installation, or choose another name. Each family should
have its own database. Do not point this clean project at an unrelated production
database: its initial migration is intended for a new, empty installation.

Open **`wrangler.jsonc`** and set:

| Setting | What to enter |
| --- | --- |
| `name` | Your Worker name, for example `romi-baby-tracker` |
| `d1_databases[0].database_name` | The name you created, such as `romi` |
| `d1_databases[0].database_id` | The full database UUID returned by the create command |
| `d1_databases[0].binding` | Keep **`DB`** |
| `vars.BABY_NAME` | The name shown in your private dashboard, or leave `Baby` |
| `vars.TIME_ZONE` | An IANA timezone such as `Europe/London`, `America/New_York` or `UTC` |

Keep `assets.run_worker_first: true`, `workers_dev: true` and
`preview_urls: false`. Leave the two Access identifiers blank for this initial
bootstrap. Your local configuration file is ignored by Git; keep it out of public
repositories along with credentials, private exports and backups.

Apply the schema to **your remote database**, then create the Worker:

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

If prompted, select a workers.dev account subdomain. Save the exact Worker URL
printed by deployment. At this stage it should show **HTTP 401 / private tracker**.
That is intentional: no app assets, configuration or records are public while
Access setup is incomplete. Do not disable authentication to get past this step.

## 3. Protect the workers.dev app with email-code login

Cloudflare's labels can change; the linked official guides below are authoritative.
The supported path is to protect the Worker itself, including production traffic.

1. Open **Cloudflare Zero Trust** for the same account. Complete its initial setup
   if needed, and note the team domain, such as `your-team.cloudflareaccess.com`.
2. Under **Integrations → Identity providers**, add **One-time PIN** if it is not
   already available.
3. Go to **Workers & Pages → your Worker → Access** and choose **Protect this Worker
   behind Access**. Select **All traffic** (not Previews only), then **Apply Access**. In older
   dashboards the equivalent hostname-based option may be under Settings → Domains
   & Routes for the workers.dev hostname.
4. Configure the Access application's **Allow** policy with the exact email addresses
   of the caregivers who should use this installation. Use the **Emails** selector;
   do not use Everyone, a broad email domain or a Bypass policy.
5. Select **One-time PIN** as the application's login method. If necessary, disable
   “Accept all available identity providers” and deselect the Cloudflare-account
   identity provider for this application. This gives caregivers an email-code form.
6. In **Zero Trust → Access → Applications**, open the application protecting this
   Worker and copy its **Application Audience (AUD) tag**. Copy the complete value.
   This is different from an account ID, a database ID or the team name.

In your local `wrangler.jsonc`, enter both identifiers under `vars`:

```json
"ACCESS_TEAM_DOMAIN": "your-team.cloudflareaccess.com",
"ACCESS_AUD": "the-full-application-audience-tag"
```

Use the team domain without `https://` or a trailing slash. The app verifies Access
JWT signatures, issuer, audience, expiry and the caregiver email allowlist itself.

Set the same caregiver allowlist as a **Worker secret**:

```sh
npx wrangler secret put ALLOWED_EMAILS
```

At the hidden prompt, enter a comma-separated list such as
`parent-one@example.com,parent-two@example.com`, using your real allowed emails.
Do not put your emails or this secret in the tracked example configuration.
A Worker secret is separate from a GitHub Actions secret.

Deploy the completed configuration:

```sh
npm run deploy
```

Wrangler preserves existing Worker secrets across normal deployments. Keep the
Access policy and Worker allowlist in sync when adding or removing caregivers.

### Verify before using real records

- Open the Worker URL in a private browser window. It should ask for an email and
  send a login code; it should not require a caregiver to create a Cloudflare account.
- An allowed caregiver should reach an empty dashboard with the configured name and
  timezone. A different email must not reach the app.
- Log one test entry, open the app on a second signed-in device and confirm it appears.
  Delete the test record after checking; record deletion is a soft delete.
- Start a feed timer on one device and pause/finish it from the other. Visible pages
  poll timer state every five seconds; ordinary records refresh every 20 seconds or
  when returning to the page. This is polling, not instant push.
- Export a first JSON backup and store it privately.

On iPhone: open the protected app in **Safari → Share → Add to Home Screen**.
This is a web app shortcut; it is not an App Store app and does not provide offline
background sync or a Lock Screen timer.

## Optional: use your own domain

Add a Custom Domain in the Worker dashboard or a `routes` entry in your local
Wrangler file. Worker-level Access should protect its associated domains; verify
the custom hostname actually requires sign-in. If using hostname-based Access,
protect that hostname separately and use its matching AUD. If you disable
workers.dev, also set `workers_dev: false` in your configuration so deployment does
not re-enable it. Keep preview URLs disabled unless they are also protected.

Do not reuse another installation's database ID, Access AUD, emails or credentials.

## Updates and checks

```sh
git pull --ff-only
npm ci
npm test
npm run build:check
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Export a backup before updating. Read release notes and migrations before applying
updates to your own records. The ignored `wrangler.jsonc` stays on your computer
across pulls; check new examples for configuration additions. Never overwrite a
working private configuration blindly with the public example.

The included GitHub workflow runs tests, an empty local migration and a Worker
build check. **It does not deploy your app** and does not require Cloudflare secrets.
Automatic production deployment is deliberately not enabled in this public repo;
hosting is an explicit action by each installation's owner.

## Data behaviour and current limitations

- One shared baby dataset per deployment; there is no public signup or isolation
  between multiple families inside one database. Every allowed caregiver has the
  same ability to view, add, edit, export and soft-delete that family's records.
- Timestamps are stored in UTC; display, input and calendar days use `TIME_ZONE`,
  not the phone's timezone. Choose it before logging. Changing it changes calendar
  grouping. DST spring-forward gaps are rejected; repeated fall-back local times
  resolve to the earlier occurrence. Exact UTC timestamps remain in JSON exports.
- Rolling recap windows are `(start, end]`. Sessions and their full duration belong
  to the window containing their start timestamp; sessions are not split at midnight
  or at recap boundaries. Seven-day daily averages divide by seven, even with fewer
  days of logging. Missing activity is not estimated. Spit-up uses the seven-day total.
- Weight trend is the slope through equally weighted daily mean weights over seven local calendar dates ending at the latest weigh-in. It requires two recorded dates; missing dates remain empty. Coverage and mixed-scale status are shown. Date-only timestamps are not observed weighing times. Different scales/clothes still affect results.
- Feed timers persist server timestamps and exclude pauses. Closing/backgrounding
  the page does not stop a running timer. Finish pauses and opens a review; closing
  review leaves the timer paused. Review unexpectedly long feeds before saving.
  Concurrent edits use revisions, and finished timer saves are idempotent. Active
  timers are not completed feeds and are not included in record exports.
- Connectivity is required to save, sync, start, switch or pause. Failed saves leave
  the form open. A running timer keeps accruing time while offline until a successful
  server action; correct the duration at review if needed. There are no reminders,
  notifications, feed-duration limits or offline write queue.
- New bottles require type and ml; new nappies require selected sizes. Wet nappy
  recaps count all logged wet nappies, with the size breakdown shown separately.
  The app does not calculate heavy-nappy equivalents. Old/imported
  unknown values are retained. Stored backup keys such as `vomit`, `small` and
  `big` stay unchanged for compatibility; the UI displays Spit-up, Light (wetness)
  and Large. Existing notes are not rewritten. Bottle volumes are offered, not necessarily retained.
- JSON restore accepts up to 500 records per file/batch (maximum file size 2 MB).
  Matching IDs are skipped, not overwritten. Split larger backups into batches of at
  most 500 events. Export includes all active records, so a large export may require
  splitting before restore. A soft-deleted matching ID is not resurrected by restore.
- Backups contain private health-related information. JSON/CSV export excludes
  soft-deleted records and the active timer. D1 storage may still contain soft-deleted
  records; the UI does not implement permanent erasure. Database/account retention
  and recovery settings are the operator's responsibility.
- This is a record keeper, not medical advice or a substitute for a clinician.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Local “no such table” error | Run `npm run db:local` from this project directory, then restart dev. |
| Deployed 401 after signing in | Check team domain, complete AUD, `ALLOWED_EMAILS`, the Access application protecting the exact Worker, and deploy again after editing configuration. |
| Login asks for a Cloudflare account | Enable One-time PIN, select it for this application, and test in a private window. |
| API returns HTML / sign-in page | Your Access session may have expired; reopen the app and sign in. |
| Worker 503 after changing timezone | Use a valid IANA timezone; check `npx wrangler tail` privately. |
| CI can't find wrangler.jsonc | Run `npm run setup` before tests/builds; do not commit private configuration. |
| Server rejects an edit | Another device changed that entry/timer. Refresh and review the newest state. |
| No weight average yet | Record two distinct weigh-ins within the week ending at the latest measurement. |

## Contributing and licences

Issues and small pull requests are welcome. Use only fictional data in screenshots,
fixtures and bug reports. Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md) before sharing logs or security issues.

Application code and original SVG icons: **PolyForm Noncommercial 1.0.0**, effective
28 October 2026, starting with the commit introducing this licence. You may use,
modify and share the software for noncommercial purposes, including personal family
self-hosting. Commercial use requires separate permission from the relevant rights
holders. Preserve the licence and Required Notice when sharing. The full licence,
including its permitted noncommercial-organisation uses, controls.

Versions previously published under MIT retain their MIT permissions; this change
does not revoke those grants or retrospectively restrict existing MIT copies. The
last MIT-licensed public commit is `5df2edd6230476f028e327f909ec4d9dd241a15b`.
The previous text is retained in [LICENSES/MIT-previous.txt](LICENSES/MIT-previous.txt)
for those versions; it is not an alternative licence grant for later contributions.

Fraunces and Atkinson Hyperlegible are bundled locally under **SIL OFL 1.1**, with
original licence/copyright files.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The charcoal, cream, sand and
terracotta palette is retained.

## Official setup references

- [Cloudflare Workers + Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [workers.dev addresses](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [D1 getting started](https://developers.cloudflare.com/d1/get-started/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

Weight trend: all readings on each local calendar date are averaged. The slope of an equally weighted straight-line fit through those daily means gives g/day, over the seven dates ending at the latest weigh-in. Missing days are not filled. At least two recorded dates are required. Coverage and mixed-scale status are shown; averaging does not calibrate different scales.

Daily-use tools: the last-activity strip shows elapsed time, breast side and Repeat buttons. Repeat opens a new draft at the current time for review; timed-feed durations are cleared. Newly added manual entries have Undo. New manual records are saved to a persistent local queue before syncing, retried with the same ID, and shown as waiting to sync. Previously loaded records and the app shell support offline reopening after the service worker has installed; first use needs a connection. Existing-record edits and shared timer commands need a connection. Local backups include queued records; keep the phone/browser profile private and do not clear website data with pending entries.

Weigh-ins support optional naked/clothed conditions. Weighted-feed mode stores before/after grams together and displays the gram difference without estimating milk volume. These records remain in the activity timeline and backups but are excluded from growth readings and trends.
