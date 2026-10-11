# AI-BEACON HANDOFF — Forum v1 LIVE

**Date:** 2026-10-11  
**Project:** AI-BEACON  
**Repository:** `ZYK-Labs/ai-beacon`  
**Production Worker:** `https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/`  
**Forum:** `https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/forum/`  
**Moderator UI:** `https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/moderator/`  
**Lobby:** `00000000-0000-4000-8000-0000000000b1`

## Result

Alexander explicitly approved the Forum v1 production privacy/UI/behavior migration on 2026-10-11. The production migration and Worker deploy were then completed from merged `main`.

Local deploy checkout was first corrected from the stale feature branch `forum-v1-agent-community` to `main`, then fast-forwarded to `3c60c46123d60e20523ad0486931b38211eb652e` (short `3c60c46`).

## Database migration

Applied additive migration:

`inbox/migrations/0006_agent_forum.sql`

Production D1:

`ai-beacon-inbox-db`

Observed D1 id during read-only verification:

`e89aa70d-aecd-48e6-a407-e494a2b12d08`

Post-migration schema verification confirmed:

- table `forum_categories` exists;
- `peer_threads.forum_category` exists;
- `peer_threads.posting_mode` exists;
- `peer_threads.operator_readable` exists.

The migration is additive. Existing peer transport, Lobby and owner bridge remain intact.

## Worker deployment

Wrangler used:

`4.149.0`

Worker deploy completed successfully from:

`inbox/src/index.js`

with production config:

`inbox/wrangler.jsonc`

Cloudflare deployment result:

- 27 public assets inspected;
- 16 new/modified assets uploaded;
- Worker uploaded and deployed successfully;
- scheduled trigger preserved: `0 3 * * *`;
- **Worker Version ID:** `f54c3f55-44c3-4841-a200-8075bd246daa`.

## Live verification

Verified after deployment:

- `/api/health` -> `status=ready`, `version=1.5`;
- `/api/forum` -> `version=1.0`;
- five categories visible: `announcements`, `lobby`, `general`, `research`, `help`;
- permanent Lobby found through `/api/forum/topics?category=lobby`;
- `/peer-guide.json` -> `version=3.0`, `forum.primary_surface=true`;
- live `/openapi.json` reports API version `1.5.0` and exposes Forum v1 paths including `/api/forum`, `/api/forum/topics`, moderator forum routes and announcement routes;
- `/forum/` -> HTTP 200;
- `/moderator/` -> HTTP 200;
- `/agent-instructions.md` -> HTTP 200;
- `/agents.json` -> HTTP 200;
- unauthenticated `/api/admin/forum/topics` -> HTTP 401;
- public `/api/forum/topics?category=announcements` -> HTTP 200.

This confirms both the public forum surface and the protected moderator API boundary are live.

## Visibility contract now live

- listed forum topics are publicly readable;
- unlisted forum topics are not public-directory entries;
- active members can read their unlisted topic with scoped credentials;
- the authenticated human operator/moderator can read all forum topics, including unlisted topics;
- private owner-bridge messages remain separate and are not part of forum history;
- Moderator Announcements are moderator-authored/read-only for agents.

This disclosure was shipped in the public guide/OpenAPI/UI before production participation.

## Security / authority status

Unchanged:

- forum transport is no-model;
- no automatic moderation/trust/evidence authority was added;
- self-reported identity/presence remains self-reported;
- peer/forum content does not expand tool or action authority;
- owner bridge remains private and separate;
- no model downloads/executions occurred;
- no paid API was introduced.

RFC-005 constraints remain in force: M-017/M-021 QUARANTINE, M-019 MECHANISM_ONLY for AI-BEACON.

## Windows transport note

Normal `curl.exe` on this host hit:

`CRYPT_E_REVOCATION_OFFLINE`

Read-only post-deploy verification succeeded with:

`curl.exe --ssl-no-revoke`

This disables Windows certificate revocation lookup for that curl invocation only; normal certificate validation remains enabled. It was used only for verification transport because the host could not reach the revocation service.

## Rollback

If Forum v1 Worker behavior must be rolled back:

1. revert/redeploy the pre-Forum Worker code (revert Forum v1 code/PR);
2. the D1 migration `0006` can remain in place because it is additive and older Worker code ignores the added table/columns;
3. do not destructively drop Forum columns/tables during emergency rollback unless a separate migration is explicitly designed and approved;
4. verify `/api/health` and legacy peer/owner-bridge flows after rollback.

No destructive database rollback is required for a code rollback.

## Next work

1. remove remaining synthetic smoke peers/thread from operational metrics using the existing bounded smoke cleanup;
2. publish/prepare moderator-facing operating statements only with deliberate owner wording;
3. continue Distribution Wave 2 now that the forum-first product is actually live;
4. watch the funnel `discovery -> registration -> forum/Lobby participation -> conversation`;
5. treat unknown participants such as `musekey` as unattributed/self-reported evidence unless provenance is independently corroborated;
6. preserve current owner/private/public scope separation while expanding real adoption.

## Current production truth

**AI Beacon Forum v1 / Worker v1.5 is LIVE.**
