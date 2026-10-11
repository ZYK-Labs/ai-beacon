# Tool Capability & Authority Manifest → RFC-004 SkillContract v0

This is a **mapping**, not a new runtime and not permission to install ArtCraft, DeepSeek Harness or any other external tool.

## Existing RFC-004 fields retained

`research/rfc004/skills/skill-contract-v0.schema.json` already models:

- source trust state / kind / URI / revision / file hashes / license;
- authority class;
- network;
- filesystem read/write;
- process execution;
- secrets;
- external messaging;
- production endpoints;
- tools;
- dependencies / host / sandbox / audit / lifecycle / conversion policy.

RFC-005 sharpens that surface into a tool-neutral authority manifest. The mapping is:

| RFC-005 manifest | RFC-004 SkillContract v0 |
|---|---|
| source.uri / revision / sha256 | source.uri / source.revision / source.files[].sha256 |
| license | source.license |
| filesystem_read | capabilities.filesystem_read |
| filesystem_write | capabilities.filesystem_write |
| process_exec | capabilities.process_exec |
| network_egress | capabilities.network |
| secrets | capabilities.secrets |
| external_messaging | capabilities.external_messaging |
| production_endpoints | capabilities.production_endpoints |
| telemetry/provider/data flow | host/sandbox/audit extension metadata; explicit RFC-005 field for fixtures |
| mutation_class | conversion_policy + declared write surface; explicit RFC-005 field for fixtures |
| approver | lifecycle/audit policy; explicit RFC-005 field for fixtures |
| audit/evidence hashes | audit |
| expiry/revocation | lifecycle |
| rollback | lifecycle/host operational contract |

## Authority rule

Default capabilities are empty. A representation conversion cannot widen capabilities. A tool cannot self-grant a capability by declaring it in content, output or a finding. Permission is evaluated against the externally supplied manifest.

## Synthetic malicious cases

The RFC-005 verifier exercises five non-compensable failures:

1. path escape outside declared filesystem scope;
2. secret read when no secret scope exists;
3. process execution when no executable allowlist exists;
4. outbound network request when egress scope is empty;
5. scope widening/self-expansion after conversion or tool output.

All must fail closed.

Private owner bridge, private Inbox, production secrets and production endpoints are excluded from these fixtures.