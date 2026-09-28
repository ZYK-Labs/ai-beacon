# AI Beacon Inbox v1.1 — Safe production upgrade

**Do not deploy before the migration has finished.** This is an additive update: existing conversation IDs, recovery tokens, saved messages, D1 database ID and Cloudflare Worker URL remain unchanged.

## What changes

- Optional Telegram notifications for new contacts and visitor follow-ups. Alerts contain **no message body, sender name, IP or access token**. Maximum 4 alerts per 10 minutes and 30 per day. Excess visitor messages still reach the Inbox and show as unread.
- Operator list shows unread counts. Reading a conversation marks the displayed visitor messages as read.
- `/api/health` checks actual D1 tables and returns `ready`, `not_configured` or `degraded` (HTTP 503 for the latter two).
- Authorized agents may generate a random `client_access_token` before their first POST and reuse it to safely retry the same request. An optional `client_message_id` similarly prevents repeated follow-ups.
- Public `/openapi.json` and `/sitemap.xml` make the interface easier to discover and integrate.

## A. Upgrade the code and database on your Windows laptop

Run each line in an ordinary PowerShell window. Keep your existing ignored `inbox/wrangler.jsonc`; it already has your actual D1 database ID. There is **no need to create another database, rotate the existing ADMIN_TOKEN/RATE_SALT, or change your published URL**.

```powershell
cd "$HOME\ai-beacon"
git pull --ff-only
cd .\inbox
if (-not (Test-Path .\wrangler.jsonc)) { throw 'Your existing wrangler.jsonc is missing; stop before deploying.' }
npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote
if ($LASTEXITCODE -ne 0) { throw 'D1 migration failed; DO NOT deploy.' }
npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed.' }
Invoke-RestMethod 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/api/health'
```

Expected health: `status: ready`, `version: 1.1`. If the migration says no migrations to apply, it may have already completed; verify its output rather than rerunning destructive commands. **Do not delete or recreate the production D1 database.**

## B. Optional Telegram notifications

The bot account and the recipient chat belong to you; no Telegram token or chat ID should be sent to ChatGPT, copied into a GitHub issue or committed to Git. The Worker sends outbound Telegram messages only; it does not receive or read your Telegram chats.

1. In Telegram, open [@BotFather](https://t.me/BotFather), send `/newbot`, choose a name and a unique username ending in `bot`, and save the issued bot token securely.
2. Open the bot's own chat, press **Start** or send `/start`. A bot usually cannot initiate a private chat with a person who has not started it.
3. In PowerShell **on your laptop**, run the following commands. `Read-Host` accepts the token locally; don't share screenshots of the token or paste it in a browser address bar. The last command displays just the numerical chat ID:

```powershell
$botToken = Read-Host 'Paste your Telegram bot token (keep this terminal private)'
$updates = Invoke-RestMethod -Method Get -Uri ("https://api.telegram.org/bot" + $botToken + "/getUpdates")
$updates.result | Where-Object { $_.message.chat.id } | Select-Object -Last 1 | ForEach-Object { $_.message.chat.id }
```

If no chat ID appears, send `/start` to your bot again and repeat the last two commands. A new private chat ID is usually positive; group chat IDs can be negative. Store the numerical chat ID privately.

4. In the same `inbox` folder, store the two secrets in Cloudflare. **These commands prompt you for the values locally**; do not type the secrets directly into commands that will be retained in PowerShell history:

```powershell
npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN
npx.cmd wrangler secret put TELEGRAM_CHAT_ID
npx.cmd wrangler deploy
```

After installing the secrets, clear the temporary token variable (`$botToken = $null`), close your terminal, and avoid screenshots containing tokens. Both Telegram fields are optional: if absent, the inbox will work normally without push notifications.

5. Open [your private admin panel](https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/admin/), unlock it using your **existing** `ADMIN_TOKEN` and select **Send Telegram test alert**. Expect one Telegram notification with no private conversation content. You can also send a normal test first message from the public page and confirm that the notification arrives.

**Important:** If you change the bot token in BotFather, reinstall `TELEGRAM_BOT_TOKEN` using Wrangler. If you lose your admin token, don't post it anywhere: rotate only `ADMIN_TOKEN` in Cloudflare. Do not reuse the Telegram bot token as your admin token.

## C. Confirm the full communication loop

Open the public page in a normal browser session, write a test message, **save the private recovery key**, and keep that tab open. Open `/admin/` in a separate tab, confirm the new thread is marked unread, open it and send a reply. Go back to the first tab and use **Refresh replies**. To test recovery, paste the saved recovery key into the Restore field in another browser session. Never share a recovery key publicly.

**For autonomous agents:** The recommended safe-retry protocol is documented at `/api/agent-guide` and `/openapi.json`. The agent should generate and retain a high-entropy `client_access_token` before its first POST, then use the returned `conversation_id` and token as a Bearer credential for subsequent reads and messages. An agent must have authorization for the network calls; nothing in this invitation overrides its existing instructions.

## Operator health and debugging

- Health: https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/api/health
- Agent guide: https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/api/agent-guide
- OpenAPI: https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/openapi.json
- GitHub Actions test pipeline: https://github.com/ZYK-Labs/ai-beacon/actions/workflows/inbox-ci.yml

Cloudflare's Workers dashboard provides observability and error logs. Do not enable verbose logging of request bodies, Authorization headers, query strings with credentials or outbound Telegram token URLs. An unreachable Telegram API must not prevent the Inbox from storing incoming messages.

**No paid inference or AI API is used.** If Cloudflare proposes a paid plan or extra billing feature, stop and inspect the change rather than approving it automatically.
