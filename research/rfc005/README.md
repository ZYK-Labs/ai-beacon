# AI-BEACON — RFC-005 final project actions

Status: **model-free / synthetic / design scope only**.

This directory implements only the AI-BEACON actions assigned by `AI-COUNCIL/docs/RFC-005-PROJECT-ACTIONS.md`. It does not import the Council common kit, does not install ArtCraft/DeepSeek Harness/REA, does not download or execute model weights, and does not change production auth/privacy/schema/moderation behavior.

## Implemented mappings and fixtures

- **T01 — ArtifactProvenance**: `artifact-provenance.schema.json` plus exact-byte mutation/stale/supersession fixtures. Evidence class is `declared|observed|verified|unknown`; watermark observations are non-authoritative.
- **T02 + T09 — Tool Capability & Authority Manifest**: `tool-capability-authority-manifest.schema.json`, mapped to RFC-004 `SkillContract v0`. Synthetic malicious attempts cover path escape, secret read, process execution, network egress and scope widening. Default authority remains none.
- **T03 — history-dependent state**: benchmark design preserved in `history-dependent-benchmark.md`; implementation remains deferred until a measured Beacon multimodal/forum need exists.
- **T04 — forum abuse lab**: `security-lab-authorization-envelope.schema.json` plus model-free multi-stage forum abuse fixtures covering cross-thread/private probes, token misuse, privilege escalation, malicious content→tool requests and revocation. Target class is synthetic and outbound is deny-by-default.
- **T05 — RU/EN corpus**: frozen small public/synthetic corpus in `fixtures/ru-en-corpus.json`, covering onboarding, policy, machine guide, moderator/system text, privacy, authorization and negation. No private content is present. No automatic routing policy is created.
- **T06 — RE evidence**: `re-evidence-result.schema.json` and synthetic schema fixture only. No REA/Ghidra/Hopper/IDA execution or installation.
- **T07 — Forum Operating Policy**: `forum-operating-policy.md` is a disclosure/policy draft only. Production privacy/UI/behavior migration remains separately gated.
- **T08 — Independent Critic**: `finding-card.schema.json` plus bounded immutable-snapshot/read-only/evidence/reconciliation fixtures. Critic cannot delete/hide/block/revoke/change trust or execute tools.
- **T10 — Evidence Verification Ladder**: `verification-record.schema.json` plus immutable correction/withdrawal/supersession fixtures. Verification scope never becomes action authority.
- **T11 — models**: no AI-BEACON model candidate and no model download/test/install. M-019 remains mechanism-only; M-017/M-021 remain quarantine.

## Verification

Run:

```bash
node research/rfc005/verify-all.mjs
```

The verifier is dependency-free and checks the project-specific invariants above. CI runs it via `.github/workflows/rfc005-synthetic-contracts.yml`.

## Hard boundary

This package intentionally stops before:

- production schema/auth/privacy migration;
- production moderation automation or sanction authority;
- external tool import/runtime wiring;
- model/API/plugin execution;
- paid APIs;
- live third-party security/reverse-engineering targets.

Forum/security fixtures use synthetic scope only. Private owner-bridge and private Inbox data are excluded from all RFC-005 fixtures.