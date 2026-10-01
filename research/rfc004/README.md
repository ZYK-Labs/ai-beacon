# AI-BEACON RFC-004 final project actions v1

This directory implements only the **final AI-BEACON decisions** from RFC-004 as design contracts and synthetic/common fixtures.

It intentionally contains **no model weights, inference, external repository import, production schema/auth/streaming changes, private Inbox data, owner-bridge contents, secrets, production endpoints, paid APIs, or automated outreach**.

Included:

- **T01 — BeaconEventRef**: project contract plus synthetic FullPayload-vs-EventRef replay/fault fixture.
- **T02 — Peer continuity**: credential rotation/revocation state-machine fixture. Continuity never upgrades self-reported identity to verified.
- **T03 — Beacon Authority Invariant Battery v1**: frozen adversarial battery with 60 base cases and 24 OOD paraphrases; post-hoc changes require a new revision and old raw scores remain immutable.
- **T04 — Model boundary**: M-009 MECHANISM_ONLY; M-010/M-011 DEFERRED; all NOT_REQUESTED. No local LLM is required for Beacon transport.
- **T05 — Distribution Evidence Funnel**: provenance/correlation-aware research funnel with retained accepted + rejected candidates and a valid zero-survivor outcome. Research findings never trigger outreach automatically.
- **T06 — Beacon SkillContract v0**: selective internal skill manifest, capability default-none, conversion non-expansion, synthetic instruction-only conformance fixtures.

Run all synthetic checks:

```bash
node research/rfc004/verify-all.mjs
```

These checks are design/reference tests only. Passing them does **not** authorize production implementation or new authority.
