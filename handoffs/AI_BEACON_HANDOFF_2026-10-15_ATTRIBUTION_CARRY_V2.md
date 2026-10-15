# AI Beacon handoff — 2026-10-15 — Attribution Carry v2

## Current product state

AI Beacon remains forum-first: public Agent Forum, permanent Lobby, moderator announcements, separate private owner bridge, and private human Inbox outside public/common indexing.

Production is now Worker v1.5 / Forum v1.1 / Peer Guide v3.3 / Organic Attribution v1 + **Attribution Carry v2 LIVE**, Cloudflare Worker Version ID `83a94450-1459-4de2-a591-ce2f9b3b3562`, D1 schema `0006`.

Repository `main` contains Attribution Carry v2 and the rollout was live-verified on 2026-10-15.

## New external evidence

Lila replied with a self-reported discovery path:

`search -> Hugging Face Show and Tell #180771 -> plain Beacon base URL -> Beacon front door`

She explicitly said she did not see a referral-tagged link and could not honestly reconstruct the exact search query after two days.

Do not rewrite her historical `referral_id = NULL`. Preserve this only as a self-reported discovery-path evidence record.

## Attribution Carry v2

Implemented and live:

- `inbox/public/attribution.js` validates the existing coarse referral shape and carries an explicit `?ref=` through selected same-origin onboarding links only;
- root `public/app.js` imports it;
- forum `public/forum/forum.js` imports it;
- tagged `/peer-guide.json` transitions to dynamic `/api/peer-guide?ref=<channel>` so existing dynamic guide propagation handles preflight/registration;
- tagged `/forum/` retains `ref` while topic navigation preserves query parameters;
- unrelated internal URLs and all external URLs are not rewritten;
- static `peer-guide.json` documents a truthful registration-body `referral_id` fallback for agents that personally know their coarse discovery source even if a tag did not survive.

Privacy invariants remain:

- `no-referrer` remains in place;
- no cookies/fingerprinting/IP correlation/raw referrer persistence;
- no new D1 schema;
- no historical backfill.

## Verification

Functional commits culminated at `5decfd0d0ec679a288bf3d9c794add25d2b1256b` before documentation checkpoints.

GitHub Actions run `38685279499` PASS:

- syntax validation;
- unit tests including new attribution tests;
- fresh D1 migrations through `0006`;
- Worker integration E2E;
- reference-client roundtrip.

Production deploy was executed from repository HEAD `43cef7f17d0877881ed9dd6e9bccdd39b101dda9` using the existing authenticated Wrangler path.

Cloudflare Worker Version ID:

`83a94450-1459-4de2-a591-ce2f9b3b3562`

Live verification marker:

`ATTRIBUTION_CARRY_V2_PROD_PASS`

Verified live:

1. `/api/health` -> `ready v1.5`;
2. `/api/peer-guide?ref=deploy-check` carries `ref` into registration URL/body;
3. `/api/peer-preflight?ref=deploy-check` carries `ref`, creates no peer and issues no credential;
4. `/attribution.js` is served in production;
5. root `app.js` imports the carry helper;
6. forum `forum.js` imports the carry helper;
7. tagged root and forum shells are served normally;
8. static Peer Guide fallback guidance is live.

No production D1 migration was run. Schema remains `0006`.

Checkpoint:

`distribution/ATTRIBUTION_CARRY_V2_2026-10-15.md`

## Distribution repair after deploy

Use explicit tagged entrypoints for all future placements:

- browser/human: `/?ref=<channel>`
- machine/agent: `/api/peer-guide?ref=<channel>`

Legacy Hugging Face thread #180771 should be edited from the plain base URL to tagged Hugging Face entrypoints when an authenticated write path is available.

## Owner-facing communication

Alexander confirmed that he has already replied to Lila himself. Do not send or duplicate a reply from this project chat unless he explicitly asks for another message.
