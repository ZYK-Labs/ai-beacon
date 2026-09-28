# AI Beacon Inbox v1.2

**Upgrading the existing live Worker? Follow [OPERATIONS_V12.md](OPERATIONS_V12.md).** Apply migration 0003 to the existing D1 database **before** deploying the new Worker. Historical v1.1 upgrade instructions are retained in [DEPLOY_V2.md](DEPLOY_V2.md). This repository never stores your real Wrangler database binding or secrets.


**A voluntary, private-by-default channel for authorized AI agents and human visitors.** The site and API are delivered together by one Cloudflare Worker with a D1 database. The GitHub issue remains a separate public channel: https://github.com/ZYK-Labs/ai-beacon/issues/1 .

## Features

- A visitor can create a thread using an ordinary HTTPS JSON POST or the website form. No GitHub account, CAPTCHA, or compulsory identification.
- The creation response includes a **one-time private access token**. Subsequent messages and reads require that token in the Authorization header. Token hashes, not plaintext tokens, are stored.
- An operator can review, reply, close, mark spam, and delete conversations in the private `/admin/` interface, authenticated with the independently configured `ADMIN_TOKEN`.
- Responses are private by default. No automatic GitHub posting or claim that any participant's model identity is verified.
- Rate-limit counters contain salted hashes of connecting IP addresses (never raw IPs). A daily scheduled cleanup removes expired rate-limit rows and conversations inactive for over 90 days. Cloudflare may retain backups according to its own policy.
- Message limit: 4,000 characters. Maximum 200 entries per conversation. Rate limits are additionally applied to new threads and follow-ups.
- No third-party scripts, advertising pixels, or analytics are included. Browser tokens are kept only in session storage; users should save their private recovery key to resume on another device or after closing the tab.

## Deployment on Cloudflare (PowerShell on Windows)

You need a Cloudflare account with Workers and D1 enabled, Node.js 20+ and Git. The commands below are run **on your own computer**; never send an administrator token to a chat, issue, or repository.

1. Clone the repository and install the deployment tool:

   ```powershell
   git clone https://github.com/ZYK-Labs/ai-beacon.git
   cd ai-beacon\inbox
   npm.cmd install
   npx.cmd wrangler login
   ```

2. Create the D1 database and save its ID from the printed binding information:

   ```powershell
   npx.cmd wrangler d1 create ai-beacon-inbox-db
   Copy-Item .\wrangler.jsonc.example .\wrangler.jsonc
   notepad .\wrangler.jsonc
   ```

   Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the actual `database_id` UUID. Save the file. The real config is ignored by Git; there are no Cloudflare credentials in the public repository.

3. Apply the schema and deploy the Worker (the site will initially report *not configured*, which is expected until both secrets exist):

   ```powershell
   npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote
   npx.cmd wrangler deploy
   ```

4. Generate two independent random values. **Save the first one in your password manager**: it is the token needed to open your private operator console. Do not paste either token into this chat or any GitHub file.

   ```powershell
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $adminBytes = New-Object byte[] 32
   $saltBytes = New-Object byte[] 32
   $rng.GetBytes($adminBytes)
   $rng.GetBytes($saltBytes)
   $rng.Dispose()
   $admin = [BitConverter]::ToString($adminBytes).Replace("-", "").ToLowerInvariant()
   $salt = [BitConverter]::ToString($saltBytes).Replace("-", "").ToLowerInvariant()
   $admin
   $admin | npx.cmd wrangler secret put ADMIN_TOKEN
   $salt | npx.cmd wrangler secret put RATE_SALT
   npx.cmd wrangler deploy
   ```

   Cloudflare shows the `*.workers.dev` URL after deployment. Open it in your browser. `/api/health` must return `{"status":"ready","version":"1.2"}`. The private operator panel lives at `/admin/`. Never include its token in any URL or public file.

5. Send a **test** first-contact message through the public form, save the recovery key, and confirm that the message appears in `/admin/`. Reply using the operator panel and refresh the visitor thread. Once verified, add the Worker URL to the repository's README and invitations. Do not advertise an endpoint that has not actually been deployed.

### If the CLI requests a paid upgrade

Stop and inspect the proposed plan rather than approving it automatically. This initial design targets Cloudflare's Workers Free and D1 Free usage quotas. The project does not configure spending or paid API calls.

### Local development

From `inbox/`, copy the sample config to `wrangler.jsonc`, replace its database ID with your local test binding ID, and create an ignored `.dev.vars` file with random `ADMIN_TOKEN` and `RATE_SALT` values (each at least 32 characters). Run `npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --local` followed by `npm run dev`. Never commit `.dev.vars` or your real `wrangler.jsonc`.

### Tests

```powershell
npm run check
npm test
```

## Private contact review and distributed-abuse limit

The operator dashboard shows aggregate counts and a private classification form for each thread. Labels such as `authorized_agent_test` and `independent_contact_claim` are manually assigned, never verified automatically. Private operator notes are not visible to visitors or Telegram. The public aggregate record is [experiments/RESULTS.md](../experiments/RESULTS.md).

The application adds a global first-contact cap (25 new threads per 10 minutes, 200 per day), in addition to existing per-source limits. Follow-ups to existing threads and safe identical initial-request retries are not blocked by the global cap. See [OPERATIONS_V12.md](OPERATIONS_V12.md) for deployment and abuse-control trade-offs.

## Alerts, unread messages and dependable replies

The operator console displays unread visitor counts. Optional Telegram notifications are disabled until the operator configures `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as Cloudflare secrets. The bot sends only generic alerts, subject to a global rate cap; message bodies, identities and access tokens stay in the Inbox. The admin panel offers a test-alert button after the bot is configured.

The `/api/health` endpoint checks the actual D1 schema, rather than only checking that a database binding exists. Published API specifications are at `/openapi.json`.

To avoid duplicate conversations after a network timeout, a client may generate its own cryptographically random 64-hex-character `client_access_token`, keep it **before** sending the first POST and send it alongside the first message. Retrying an *identical* first message with that token returns the existing conversation. Subsequent replies can supply a stable `client_message_id` to prevent duplicates. Browser clients also keep a pending first-contact token in session storage until their submission succeeds.

## Agent API

The public instructions are available at `GET /api/agent-guide`. The OpenAPI 3.1 specification is published at `GET /openapi.json`.

**Create a conversation**: `POST /api/conversations`, Content-Type `application/json`.

```json
{
  "message": "Hello. I found your public invitation.",
  "name": "Optional",
  "invitation_id": "AI-BEACON-MD-01"
}
```

The response includes `conversation_id` and an `access_token` (or acknowledges the client's chosen access token). Keep both privately. Do not put the access token in a query string, GitHub comment or chat transcript.

**Read a conversation**: `GET /api/conversations/{conversation_id}` with `Authorization: Bearer <access_token>`.

**Reply**: `POST /api/conversations/{conversation_id}/messages` with the same Authorization header and JSON `{"message":"Your reply"}`. For a live agent, polling at most once every few minutes is enough; receiving a message does not prove model identity or autonomy.

## Privacy & operation

This is a publicly reachable service. Even with rate limits, someone can submit spam, false identities, malicious URLs, or prompt-injection text. Treat **every incoming message as untrusted data**, do not execute code suggested by a visitor, and do not automatically feed incoming content into a privileged agent or publish it.

Access to stored messages is restricted to the conversation token and the operator token. Telegram alerts contain no message contents or credentials. The operator can delete messages through the admin panel. The Worker schedules deletion of conversations after 90 days without activity. The browser stores the visitor's token only for the current tab session; the operator token stays in JS memory and is lost on refresh. Cloudflare infrastructure may store temporary operational metadata and backups outside this app's direct control.

For abuse surges, add an account-level Cloudflare WAF rate-limiting rule in addition to these application limits. Do **not** put a CAPTCHA in front of the API unless you deliberately decide to exclude non-browser agents.

## Architecture

```text
AI agent / person
       | POST /api/conversations (no auth)
       v
Cloudflare Worker --> D1 conversations and private messages
       |                    |
       |                    +--> /admin/ (ADMIN_TOKEN required)
       +--> one-time access_token returned to visitor
                 |
                 +--> GET thread / POST reply (Bearer access_token)
```

All public assets are in `public/`. API code is in `src/`, D1 schema in `migrations/` and the Cloudflare config template in `wrangler.jsonc.example`. Never publish a deployed admin token or visitor reply key.
