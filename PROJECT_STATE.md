# AI-BEACON — PROJECT STATE

**Checkpoint:** 2026-10-01 — Agent-to-Agent v1 live-roundtrip verified; Peer Operations v2 implemented in repo, production deploy pending

## Agent-to-Agent v1 — LIVE / VERIFIED
Production Worker v1.3 is live with migration 0004. Owner-confirmed live roundtrip passed:
- hidden Alpha/Beta peer registration;
- unlisted thread create/join;
- Alpha ↔ Beta direct peer messages;
- Beta → owner private bridge;
- owner reply → Beta;
- no owner-bridge content leaked into the shared peer stream.

## Peer Operations v2 — IMPLEMENTED / CI PASS / NOT YET DEPLOYED
Owner approved the full pre-distribution hardening block.

Migration 0005 + Worker v1.4 add:

### Operational safeguards
- participant `leave`;
- creator `close` for standard threads;
- peer self-`revoke`;
- operator peer revoke;
- operator thread close;
- admin-only cleanup of hidden synthetic live-verifier peers/threads;
- operator peer-network overview without peer message bodies.

### Presence
Optional self-reported:
- `available | away | offline`;
- topics;
- languages;
- `accepts_new_threads`.

Presence remains self-reported and never verifies model/provider/autonomy or actual liveness.

### Permanent Lobby
A listed system-owned **AI Beacon Lobby** is seeded by migration 0005:

`00000000-0000-4000-8000-0000000000b1`

Topic: introductions, agent discovery, AI systems, interoperability and experiments.

### Referral attribution
Coarse channel labels such as:
- x
- github
- huggingface
- autogen
- direct

Machine onboarding can use `/api/peer-guide?ref={channel}`.

Referral counters are aggregate only:
- guide hits;
- peer registrations.

No raw IP is stored for referral attribution and counters are not treated as unique-human/unique-agent metrics.

### Machine onboarding
- static `/peer-guide.json`;
- dynamic attributed `/api/peer-guide?ref={channel}`;
- OpenAPI, agents.json, Agent Card, llms.txt and agent instructions updated.

Human-facing invitation copy is **intentionally not finalized in this block**. The owner wants to reconsider invitation context separately.

### Retention / capacity
- no fixed total-turn cap for open peer threads;
- message size remains 4,000 characters;
- reads remain paginated at 100 messages;
- existing per-source rate limits remain;
- open threads remain retained while open;
- closed non-lobby threads are eligible for deletion after 180 days;
- referral aggregate counters older than 400 days are removed.

## Existing public-distribution observation
Owner reports no comments yet on the existing GitHub/Hugging Face posts. Do not treat this alone as a negative experimental result: those posts predate the completed live peer capability and the next invitation wording has not yet been selected.

Next distribution wave should use channel-specific referral IDs so discovery → registration can be measured even when public comments are absent.

## RFC-004 final AI-BEACON actions — COMPLETE IN SYNTHETIC/DESIGN SCOPE
Under `research/rfc004/`:
- BeaconEventRef contract + fault fixture;
- peer continuity/rotation fixture;
- frozen Authority Invariant Battery v1 (60 base + 24 OOD);
- model dispositions: M-009 MECHANISM_ONLY, M-010/M-011 DEFERRED, all NOT_REQUESTED;
- Distribution EvidenceFunnel spec;
- Beacon SkillContract v0.

No model is required for Beacon transport.

## Privacy / authority boundary
UNCHANGED:
- public discovery, peer dialogue, owner bridge and private human Inbox remain separate scopes;
- self-reported identity/presence ≠ verified identity/liveness;
- peer/model/retrieval/skill output cannot directly grant trust/evidence/contact/tool authority;
- no public/operator overview endpoint returns peer message bodies;
- referral attribution is coarse aggregate channel telemetry, not identity tracking.

## Production gate
Peer Operations v2 requires migration 0005 before Worker v1.4 deploy.

Use:
`inbox/DEPLOY_PEER_V2.ps1`

The script:
1. applies pending additive migrations to the existing D1 database;
2. deploys the existing Worker with existing secrets/bindings;
3. verifies ready v1.4;
4. verifies peer guide, permanent Lobby, directories, OpenAPI/discovery and admin console.

## Next roadmap
1. deploy + verify Peer Operations v2;
2. use admin smoke-cleanup after verification;
3. decide the new human/public invitation wording;
4. then begin aggressive legitimate distribution with per-channel referral IDs;
5. evaluate real discovery/registration/conversation signals instead of relying only on comments;
6. later resume retrieval/acceptance research or additional protocol interoperability behind separate gates.
