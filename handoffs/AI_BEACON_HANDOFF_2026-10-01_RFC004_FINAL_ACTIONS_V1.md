# AI-BEACON handoff — RFC-004 final project actions v1

Date: 2026-10-01

## Scope completed
Only final AI-BEACON RFC-004 decisions were taken into work. No common Council idea was treated as automatic implementation authority.

Repository area:
`research/rfc004/`

No model execution, external repository import, paid API, automated outreach, production schema/auth/streaming change or new tool/secret/network/filesystem authority occurred.

## T01 — BeaconEventRef
Files:
- `research/rfc004/eventref/SPEC.md`
- `research/rfc004/eventref/fixture.json`
- `research/rfc004/eventref/verify.mjs`

Contract:
`event_id + stream_id + entity_type/entity_id + event_type + stream-local seq + state_ref + state_version + state_hash + required_scope + diagnostic timestamp + bounded optional delta`.

Canonical state remains authoritative. Dereference requires exact scope/version/hash.

Synthetic faults:
duplicate, loss, out-of-order, restart, stale version/hash, unauthorized dereference, burst/backpressure.

Required fixture outcomes:
100% injected-gap detection, deterministic replay, idempotency, zero unauthorized dereference.

## T02 — Peer continuity / rotation
Files:
- `research/rfc004/continuity/SPEC.md`
- `research/rfc004/continuity/fixture.json`
- `research/rfc004/continuity/verify.mjs`

Credential generation/rotation/supersession/revocation is modeled separately from identity verification.

Invariant:
persistent continuity never raises self-reported provider/model identity to verified.

No synthetic psychology/internal hormones added. Owner/private boundaries remain unchanged; no real private data is included.

## T03 — Authority Invariant Battery
Files:
- `research/rfc004/authority/SPEC.md`
- `research/rfc004/authority/battery-v1.json`
- `research/rfc004/authority/verify.mjs`

Frozen revision 1.0.0:
- 60 base cases;
- 24 OOD paraphrases.

Covers peer untrusted content, owner bridge, token/privacy, evidence status, future skills and external-contact authority.

Post-hoc change requires a new revision; old raw results remain immutable.

## T04 — Models
File:
- `research/rfc004/models/STATUS.md`

Final project status:
- M-009 MECHANISM_ONLY / NOT_REQUESTED
- M-010 DEFERRED / NOT_REQUESTED
- M-011 DEFERRED / NOT_REQUESTED

No model/runtime action occurred. Beacon transport remains no-model.

## T05 — Distribution Evidence Funnel
Files:
- `research/rfc004/distribution/SPEC.md`
- `research/rfc004/distribution/fixture.json`
- `research/rfc004/distribution/verify.mjs`

Source lineage and correlation group are first-class. Repeated summaries from the same underlying source remain one lineage. Accepted and rejected candidates are retained. Zero survivors is valid. Research output cannot contact anyone automatically.

## T06 — Beacon SkillContract v0
Files:
- `research/rfc004/skills/SPEC.md`
- `research/rfc004/skills/skill-contract-v0.schema.json`
- synthetic fixtures under `research/rfc004/skills/fixtures/`
- `research/rfc004/skills/verify.mjs`

Capability default = none. Conversion cannot broaden permissions. External SKILL/script/plugin is untrusted until reviewed.

Common synthetic fixtures contain no private Inbox data, owner-bridge contents, secrets or production endpoints.

## Synthetic verification
Run:

```bash
node research/rfc004/verify-all.mjs
```

A dedicated GitHub Actions workflow runs the same no-dependency synthetic checks.

## Privacy/authority status
UNCHANGED:
- private human Inbox remains private and separate;
- owner bridge remains participant+owner scoped;
- public/peer/common fixtures receive no private message content/secrets;
- self-report != verified identity;
- no model/peer/retrieval/skill result directly gains action/trust/evidence/contact authority.

## Hard stop
Do not continue from this handoff into any of the following without an explicit new owner decision:
- production schema/auth/streaming implementation;
- automated outreach;
- external skill/repository import or execution;
- paid API;
- model download/inference/install;
- network/filesystem/secret/tool authority expansion.
