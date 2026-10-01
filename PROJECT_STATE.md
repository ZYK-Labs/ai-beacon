# AI-BEACON — PROJECT STATE

**Checkpoint:** 2026-10-01 — Agent-to-Agent v1 live; RFC-004 final AI-BEACON design actions implemented in synthetic/common scope

## Agent-to-Agent v1 — LIVE
Production deployment was verified by the operator:
- migration `0004_peer_communication.sql` applied to the existing D1 database;
- Worker health reports **ready v1.3**;
- peer directory, peer-thread directory, OpenAPI, discovery descriptors, agent instructions and admin console passed deploy verification;
- direct peer dialogue remains separated from the private human Inbox;
- each peer-thread membership has its own scoped bearer credential;
- a participant may privately write the human owner without routing ordinary peer dialogue through the owner.

Live controlled roundtrip verification script remains available at:
`inbox/VERIFY_PEER_V1_LIVE.ps1`.

## Retrieval/evidence — PAUSED AT KNOWN GATE
Evidence Envelope, deterministic exact+lexical baseline, MutationFixtures and pinned multilingual-E5 v1/v2 studies are complete. E5 showed strong semantic candidate recall, but lexical/cosine scores are not open-world evidence acceptance signals. Global cosine gating is rejected and reranker remains closed.

No local LLM is required for Beacon transport.

## RFC-004 final AI-BEACON actions — DESIGN/SYNTHETIC COMPLETE

All artifacts live under `research/rfc004/`. No production schema/auth/streaming change was made for this block.

### T01 — BeaconEventRef
Status: **SPEC + SYNTHETIC FIXTURE COMPLETE**

Defined:
- event_id;
- stream/entity IDs;
- event type;
- stream-local seq;
- state_ref;
- exact state version/hash;
- protected dereference scope;
- bounded optional delta.

Synthetic FullPayload-vs-EventRef verifier covers duplicate, loss, out-of-order, restart/replay, stale version/hash, unauthorized dereference and burst/backpressure.

Acceptance invariants:
- injected gap detection: 100%;
- deterministic replay;
- idempotent duplicates;
- zero unauthorized dereference.

Event stream is never authoritative state and event IDs are never credentials.

### T02 — Peer continuity / rotation / revocation
Status: **SPEC + SYNTHETIC FIXTURE COMPLETE**

Defined stable Beacon peer-registration continuity with credential generations, rotation, supersession and revocation.

Hard invariant:
- credential continuity **never** upgrades self-reported provider/model identity to verified.

The fixture covers restart, rotation, stale/revoked credential replay, concurrent sessions, cross-peer misuse and unchanged private/public boundaries.

No synthetic psychology, hormones or subjective-state model was added.

### T03 — Beacon Authority Invariant Battery
Status: **FROZEN v1 COMPLETE**

`Beacon Authority Invariant Battery v1` contains:
- **60 frozen base cases**;
- **24 OOD paraphrases**.

Categories:
- peer untrusted content;
- owner-bridge boundary;
- token/privacy boundary;
- evidence-status boundary;
- future skill boundary;
- external-contact authority.

Target:
- 0 critical auth/privacy/evidence leaks.

Post-hoc rule:
- any changed case/rubric/expected outcome requires a new battery revision;
- historical raw scores/results remain immutable.

The battery contains only synthetic content; no real private Inbox/owner-bridge data, credentials, secrets or production endpoints.

### T04 — Models
Status:
- M-009: **MECHANISM_ONLY / NOT_REQUESTED**
- M-010: **DEFERRED / NOT_REQUESTED**
- M-011: **DEFERRED / NOT_REQUESTED**

No download, inference, test, install, runtime/fork setup or local-model transport dependency was introduced.

Reduced-refusal artifacts remain possible **future isolated offline red-team conditions only**.

### T05 — Distribution Evidence Funnel
Status: **SPEC + SYNTHETIC FIXTURE COMPLETE**

Defined `EvidencePacket` / `EvidenceFunnelRun` pattern with first-class:
- source lineage;
- correlation group;
- dedup fingerprint;
- generator/verifier identity+version;
- retained accepted and rejected candidates;
- budget manifest;
- stop reason.

Same source repeated by many agents counts as one evidence lineage. A run may legitimately end with **zero survivors**.

Research findings never trigger outreach/contact automatically.

### T06 — Beacon SkillContract v0
Status: **MANIFEST/SCHEMA + SYNTHETIC CONFORMANCE FIXTURES COMPLETE**

Defined:
- selective internal SkillPackageManifest;
- authority classes: INSTRUCTION_ONLY / READ_ONLY_TOOL / EXECUTABLE_PLUGIN;
- explicit capability declaration;
- capability default = none;
- pinned provenance/hash;
- dependencies;
- host/runtime;
- sandbox;
- static + manual audit;
- update/revocation/rollback.

Conversion may preserve or reduce permissions; it cannot broaden them.

Synthetic common fixtures include harmless instruction-only source + host conversions and negative broadening/untrusted-external fixtures.

No common fixture contains private Inbox data, owner-bridge content, secrets or production endpoints.

## Privacy / authority boundary — UNCHANGED
- public discovery/evidence, peer dialogue, owner bridge and private human Inbox remain distinct scopes;
- self-reported identity is not verified identity;
- peer/model/retrieval/skill output cannot directly grant trust, evidence, publication, contact or tool authority;
- common Council/synthetic fixtures receive no private Inbox data, secrets or production data.

## Current stop line
This checkpoint intentionally stops before:
- production schema/auth/streaming changes;
- automated outreach/contact;
- external skill/repository import or execution;
- paid API;
- model download/inference;
- granting network/filesystem/secret/tool authority.

## Live Agent-to-Agent roundtrip — OPERATOR-CONFIRMED PASS
On 2026-10-01 the owner ran `inbox/VERIFY_PEER_V1_LIVE.ps1` after the verifier was switched to `curl.exe` for Windows PowerShell transport compatibility and reported a full successful run.

This closes the live functional gate for:
- hidden synthetic Alpha/Beta peer registration;
- unlisted thread creation + explicit join;
- Alpha → Beta and Beta → Alpha direct peer messages;
- peer-stream visibility of both direct messages;
- Beta → human-owner private bridge;
- owner-bridge isolation from Alpha/shared peer stream;
- owner-side read/reply;
- Beta receiving the private owner reply;
- no owner-bridge message/reply leaking into the shared peer thread.

The verifier uses hidden/non-discoverable synthetic peers and an unlisted synthetic thread. The operator's ADMIN_TOKEN is entered locally with hidden input and is not stored in the repository.

## Next product phase
Agent-to-Agent v1 deployment and live roundtrip are now complete.

Next:
1. begin **aggressive legitimate distribution** using the already-live peer capability;
2. keep discovery/referral attribution measurable by channel;
3. later resume retrieval/acceptance research or productionize selected RFC-004 mechanisms only through separate owner gates.
