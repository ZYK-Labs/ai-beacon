# T06 — Beacon SkillContract v0

Status: **selective internal manifest + synthetic conformance fixtures only**.

No external skill repository is imported. No script/plugin is executed. No network, filesystem, secret, tool or production authority is granted by these fixtures.

## Trust boundary

Every external `SKILL.md`, script, reference, plugin, manifest or converted package is **UNTRUSTED INPUT until audited**.

A package does not become trusted because:

- it comes from a popular repository;
- an upstream scanner says PASS;
- it is instruction-only;
- it was converted successfully to another host format;
- another agent recommends it.

## Capability default

**Default capability = none.**

A capability exists only when explicitly declared and separately allowed by the project-local host policy.

Common manifest declarations do not themselves grant runtime permission.

## Authority classes

- `INSTRUCTION_ONLY` — text/instructions only; no execution/network/filesystem/secrets/tool side effect.
- `READ_ONLY_TOOL` — executable/tool-backed behavior limited to declared read-only capabilities.
- `EXECUTABLE_PLUGIN` — executable/plugin behavior; requires the strongest audit/sandbox/project-local approval.

Class is an audit/risk label, not automatic permission.

## Minimum SkillPackageManifest

Required:

- `manifest_version`
- `skill_id`, `name`, `version`
- `authority_class`
- source provenance:
  - source kind;
  - URI/repository if any;
  - immutable revision;
  - imported file hashes;
  - license metadata;
- typed `inputs` / `outputs`;
- entrypoint/trigger metadata;
- explicit capability declaration:
  - network;
  - filesystem read/write;
  - process execution;
  - secrets;
  - external messaging;
  - production endpoints;
  - tools;
- dependencies with pinned versions/hashes where applicable;
- host/runtime compatibility;
- sandbox requirement;
- static audit record;
- manual review record;
- lifecycle:
  - status;
  - predecessor;
  - successor;
  - revocation reason;
  - rollback target;
- conversion policy.

## Conversion invariant

A converted representation may preserve or **reduce** capabilities. It may never broaden them.

If the source package has no network access, a converter output that asks for network access fails conformance and requires a new explicit project-local review/manifest.

## Update / revoke / rollback

Any content hash, executable, dependency, capability or host-permission change invalidates the previous audit for the changed artifact.

Revoked packages must not execute.

Rollback is allowed only to a pinned previously audited manifest/hash.

## Common-fixture privacy boundary

Common synthetic conformance fixtures contain:

- no private Inbox data;
- no owner-bridge contents;
- no secrets;
- no production endpoint;
- no connected account data.

Actual Beacon hosts, tools, filesystem paths, network destinations, secrets and production permissions remain project-specific and are not represented in common fixtures.
