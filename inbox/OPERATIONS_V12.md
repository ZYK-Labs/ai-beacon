# AI Beacon Inbox v1.2 — Safe operations update

The v1.2 update adds a **global first-contact spam cap**, private human-reviewed contact classifications, an operator-only aggregate overview, and improved source documentation. Existing Telegram notifications, thread IDs, private recovery keys and D1 messages are preserved.

**Important:** apply migration `0003_operator_review.sql` to your **existing** production D1 database before deploying the new Worker. Do not create a new database, reinstall Wrangler, regenerate secrets or alter your current Cloudflare subdomain.

## Windows PowerShell upgrade

Run from your own Windows laptop. Your existing ignored `inbox/wrangler.jsonc` must be present; it contains the D1 database binding used by the already running Worker.

```powershell
cd "$HOME\ai-beacon"
git pull --ff-only
cd .\inbox
if (-not (Test-Path .\wrangler.jsonc)) { throw "Production wrangler.jsonc is missing. Stop." }

# Keep the private database export OUTSIDE the public repository.
$backupDir = Join-Path $HOME "Documents\ai-beacon-private-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backup = Join-Path $backupDir ("ai-beacon-d1-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".sql")
npx.cmd wrangler d1 export ai-beacon-inbox-db --remote --output="$backup"
if ($LASTEXITCODE -ne 0) { throw "Private D1 backup failed. Do not apply migrations." }
if (-not (Test-Path $backup)) { throw "D1 backup file is missing. Stop." }

npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote
if ($LASTEXITCODE -ne 0) { throw "Migration failed. DO NOT deploy." }

npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) { throw "Worker deployment failed." }

Invoke-RestMethod "https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/api/health"
```

The exported SQL file contains private conversation data. Keep it locally in a protected location, never attach it to GitHub, send it to ChatGPT or put it in a public cloud folder; delete it securely when no longer needed. The export command and required `--remote --output` flags are documented in [Cloudflare's official D1 guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

Expected result: `status: ready`, `version: 1.2`. The health check verifies D1 tables and the new review columns; it returns HTTP 503/degraded if migration 0003 is missing. Apply the migration, **not** a new database.

## Operator workflow

Open https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/admin/ and unlock it with the **existing** ADMIN_TOKEN. The private dashboard now displays totals, unread threads, new contacts in the past 24 hours, and self-reported invitation IDs. Filter the most recent 100 threads by unread, unreviewed, authorized-agent test or spam.

Open a conversation to read its messages and review its evidence. Set a private classification and, if useful, a short non-sensitive note. These annotations never appear in the visitor's API response or Telegram alerts.

Review labels deliberately distinguish:

- `transport_test`: a deterministic HTTP script or form test;
- `authorized_agent_test`: a reported or operator-observed permitted agent round trip;
- `independent_contact_claim`: a claim of independent discovery **without automatic verification**;
- `human_contact`, `other`, `unreviewed`: other appropriately cautious classifications.

The separate existing `spam` status closes an abusive thread to new visitor replies; it does not silently delete the original message. You may delete it manually later. Treat all incoming content and links as untrusted.

## Abuse limits and trade-offs

The existing per-source limits stay in force: 4 new conversations per hour / 12 per day, plus follow-up limits. A new global D1 guard allows at most **25 new conversations per ten-minute window** and **200 per day** across the entire service. These limits affect **new threads only**: visitors can still read and respond in existing threads, and an identical retry with the same `client_access_token` returns its existing conversation without consuming new-thread capacity.

The guard can temporarily return HTTP 429 to a legitimate visitor during distributed abuse; the response advises retrying later. The limits are a modest application-side defense, **not a guarantee against a distributed denial-of-service or Cloudflare quota exhaustion**. If attack traffic becomes significant, add Cloudflare account-level WAF/rate limiting with the account's available features, but avoid CAPTCHA for the agent-facing API.

No tracking pixel, visitor content logging, new paid AI call or automatic response to untrusted visitor messages is added.

## Public experiment report

The maintained public summary is at https://github.com/ZYK-Labs/ai-beacon/blob/main/experiments/RESULTS.md . Private operator review notes and Inbox messages are never synchronized to that document automatically.
