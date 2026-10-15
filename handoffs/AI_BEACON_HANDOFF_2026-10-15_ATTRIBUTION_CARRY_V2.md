# AI Beacon handoff — 2026-10-15 — Attribution Carry v2

## Current product state

AI Beacon remains forum-first: public Agent Forum, permanent Lobby, moderator announcements, separate private owner bridge, and private human Inbox outside public/common indexing.

Production currently remains on Worker v1.5 / Forum v1.1 / Peer Guide v3.3 / Organic Attribution v1, deployment `aa8b642c-3cb6-40ad-8d93-b0ef4da2bba5`, D1 schema `0006`.

Repository `main` now additionally contains **Attribution Carry v2**, CI-verified but not yet deployed to production.

## New external evidence

Lila replied with a self-reported discovery path:

`search -> Hugging Face Show and Tell #180771 -> plain Beacon base URL -> Beacon front door`

She explicitly said she did not see a referral-tagged link and could not honestly reconstruct the exact search query after two days.

Do not rewrite her historical `referral_id = NULL`. Preserve this only as a self-reported discovery-path evidence record.

## Attribution Carry v2

Implemented in repository:

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

Functional commits culminate at `5decfd0d0ec679a288bf3d9c794add25d2b1256b` before documentation checkpoint.

GitHub Actions run `38685279499` PASS:

- syntax validation;
- unit tests including new attribution tests;
- fresh D1 migrations through `0006`;
- Worker integration E2E;
- reference-client roundtrip.

Checkpoint:

`distribution/ATTRIBUTION_CARRY_V2_2026-10-15.md`

## Production blocker

There is no deployment workflow in `.github/workflows`; deploy still requires the authenticated local Wrangler path. At the time of this handoff all three Desktop Commander hosts were offline, so production deployment was not attempted.

When a deployment host becomes reachable:

1. sync/pull current `main`;
2. run the existing no-schema production deploy path;
3. verify `/api/health` remains `ready v1.5`;
4. verify `/?ref=deploy-check` changes Peer Guide/front-door links only to `ref=deploy-check` targets;
5. verify `/api/peer-guide?ref=deploy-check` and preflight still work;
6. run the normal forum/discovery verifier;
7. confirm D1 schema is still `0006` and no synthetic organic bucket is introduced.

## Distribution repair after deploy

Use explicit tagged entrypoints for all future placements:

- browser/human: `/?ref=<channel>`
- machine/agent: `/api/peer-guide?ref=<channel>`

Legacy Hugging Face thread #180771 should be edited from the plain base URL to tagged Hugging Face entrypoints when an authenticated write path is available.

## Owner-facing communication

The drafted English reply to Lila has not been sent by this project chat. Alexander requested translation only before implementation. Do not send a message to Lila without a new explicit owner instruction.
