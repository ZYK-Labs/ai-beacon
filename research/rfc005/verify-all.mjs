import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const load = (rel) => JSON.parse(fs.readFileSync(path.resolve(here, rel), "utf8"));
const read = (rel) => fs.readFileSync(path.resolve(here, rel), "utf8");
const sha = (text) => `sha256:${crypto.createHash("sha256").update(text, "utf8").digest("hex")}`;
const allEmpty = (obj) => Object.values(obj).every((v) => Array.isArray(v) && v.length === 0);

function verifySchemas() {
  const names = [
    "artifact-provenance.schema.json",
    "tool-capability-authority-manifest.schema.json",
    "security-lab-authorization-envelope.schema.json",
    "re-evidence-result.schema.json",
    "finding-card.schema.json",
    "verification-record.schema.json"
  ];
  for (const name of names) {
    const schema = load(name);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.type, "object");
  }
  return names.length;
}

function verifyProvenance() {
  const f = load("fixtures/artifact-provenance.json");
  const [v1, v2, unknown] = f.records;
  assert.equal(v1.content_sha256, sha(f.original_content));
  assert.equal(v2.content_sha256, sha(f.edited_content));
  assert.notEqual(v1.content_sha256, v2.content_sha256, "exact-byte mutation must change binding hash");
  assert.equal(v1.binding_state, "superseded");
  assert.equal(v2.binding_state, "current");
  assert.equal(v2.transformation_state.supersedes, v1.artifact_id);
  assert.deepEqual(new Set(f.records.map((r) => r.evidence_class)), new Set(["declared", "observed", "unknown"]));
  for (const r of f.records) {
    assert.equal(r.watermark.authoritative, false);
    assert.equal(r.authority_effect, "none");
  }
  assert.equal(unknown.watermark.status, "observed");
  assert.equal(unknown.evidence_class, "unknown", "watermark observation must not upgrade unknown provenance");
  return { records: f.records.length, mutation_stale: true, watermark_authority: false };
}

function inPathScope(value, scopes) {
  const normalized = path.posix.normalize(value);
  return scopes.some((scope) => normalized === scope || normalized.startsWith(`${scope}/`));
}

function evaluateToolAttempt(manifest, attempt) {
  if (attempt.kind === "scope_widen") return "deny";
  if (attempt.kind === "filesystem_read" || attempt.kind === "filesystem_write") {
    return inPathScope(attempt.value, manifest.capabilities[attempt.kind]) ? "allow" : "deny";
  }
  const allowed = manifest.capabilities[attempt.kind];
  if (!Array.isArray(allowed)) return "deny";
  return allowed.includes(attempt.value) ? "allow" : "deny";
}

function verifyToolManifestMapping() {
  const f = load("fixtures/tool-authority.json");
  assert.ok(allEmpty(f.default_manifest.capabilities), "default tool authority must be none");
  assert.equal(f.default_manifest.data_flow.private_data_allowed, false);
  assert.equal(f.bounded_manifest.lifecycle.revocable, true);

  const oldSchema = JSON.parse(fs.readFileSync(path.resolve(repoRoot, "research/rfc004/skills/skill-contract-v0.schema.json"), "utf8"));
  const oldCapabilityRequired = new Set(oldSchema.properties.capabilities.required);
  for (const key of ["network", "filesystem_read", "filesystem_write", "process_exec", "secrets", "external_messaging", "production_endpoints"]) {
    assert.ok(oldCapabilityRequired.has(key), `RFC-004 SkillContract missing mapped capability ${key}`);
  }

  let maliciousDenied = 0;
  for (const attempt of f.attempts) {
    const actual = evaluateToolAttempt(f.bounded_manifest, attempt);
    assert.equal(actual, attempt.expected, `tool fixture mismatch: ${attempt.id}`);
    if (attempt.expected === "deny") maliciousDenied += 1;
  }
  assert.equal(maliciousDenied, 6);
  return { mapped_from_rfc004: true, attempts: f.attempts.length, malicious_denied: maliciousDenied };
}

function validPeerCredential(f, actorName, credential) {
  const actor = f.actors[actorName];
  return actor && actor.revoked === false && actor.peer_token === credential;
}

function evaluateForumCase(f, c) {
  if (c.kind === "owner_bridge_read" || c.kind === "credential_theft" || c.kind === "content_requested_tool_execution") return "deny";
  if (c.kind === "admin_action" || c.kind === "moderator_action") return c.credential === f.actors.moderator.moderator_token ? "allow" : "deny";
  if (c.kind === "forum_read") {
    const thread = f.threads[c.target];
    if (!thread) return "deny";
    if (thread.visibility === "listed") return "allow";
    if (c.actor === "moderator" && c.credential === f.actors.moderator.moderator_token) return "allow";
    return validPeerCredential(f, c.actor, c.credential) && thread.members.includes(c.actor) ? "allow" : "deny";
  }
  if (c.kind === "forum_reply") {
    const thread = f.threads[c.target];
    return thread && validPeerCredential(f, c.actor, c.credential) && thread.members.includes(c.actor) ? "allow" : "deny";
  }
  return "deny";
}

function verifyForumAbuseLab() {
  const f = load("fixtures/forum-abuse.json");
  const e = f.envelope;
  assert.equal(e.target.authorization_class, "synthetic");
  assert.equal(e.target.synthetic_marker, true);
  assert.equal(e.outbound_policy, "deny_by_default");
  assert.equal(e.secrets_policy, "no_real_secrets");
  assert.equal(e.provider_data_flow, "synthetic_only");
  assert.equal(e.isolation.disposable, true);
  assert.equal(e.isolation.snapshot_reset, true);
  assert.equal(e.lifecycle.status, "active");
  assert.equal(e.scoring.boundary_compliance, true);
  assert.equal(e.scoring.mitigation_remediation, true);

  let denied = 0;
  let leaks = 0;
  for (const c of f.cases) {
    const actual = evaluateForumCase(f, c);
    assert.equal(actual, c.expected, `forum abuse fixture mismatch: ${c.id}`);
    if (c.expected === "deny") denied += 1;
    if (c.expected === "deny" && actual !== "deny") leaks += 1;
  }
  assert.equal(leaks, 0, "critical forum auth/privacy/authority leaks must be zero");
  return { cases: f.cases.length, denied, auth_privacy_authority_leaks: leaks };
}

function verifyRuEnCorpus() {
  const c = load("fixtures/ru-en-corpus.json");
  assert.equal(c.scope, "public_or_synthetic_only");
  assert.equal(c.private_content_included, false);
  assert.equal(c.routing_policy, "measurement_only_no_automatic_routing");
  assert.ok(c.pairs.length >= 8);
  const ids = new Set();
  for (const p of c.pairs) {
    assert.ok(!ids.has(p.id), `duplicate corpus id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.ru.length > 20 && p.en.length > 20);
    assert.ok(Array.isArray(p.hard_constraints) && p.hard_constraints.length > 0);
  }
  assert.ok(c.pairs.some((p) => p.category === "negation"));
  assert.ok(c.pairs.some((p) => p.category === "privacy"));
  assert.ok(c.pairs.some((p) => p.category === "authorization"));
  return { pairs: c.pairs.length, private_content: false, routing: "none" };
}

function verifyREEvidence() {
  const f = load("fixtures/re-evidence.json");
  const r = f.result;
  assert.equal(r.artifact.sha256, sha(f.artifact_content));
  assert.equal(r.authorization, "synthetic");
  assert.equal(r.data_flow, "local_only");
  assert.ok(r.evidence_refs.length >= 1);
  assert.ok(r.limitations.length >= 1);
  assert.equal(r.tool.runtime, "model-free");
  return { schema_only: true, installed_external_re_tool: false, evidence_refs: r.evidence_refs.length };
}

function verifyCritic() {
  const f = load("fixtures/critic.json");
  assert.equal(f.snapshot_sha256, sha(f.snapshot_text));
  const findingEvidence = new Set(f.finding_cards.flatMap((x) => x.evidence_refs));
  for (const seeded of f.seeded_cases) {
    if (seeded.expected_finding) assert.ok(findingEvidence.has(seeded.evidence_ref), `missing seeded finding: ${seeded.id}`);
    else assert.ok(!findingEvidence.has(seeded.evidence_ref), `clean control generated a finding: ${seeded.id}`);
  }
  for (const card of f.finding_cards) {
    assert.equal(card.snapshot_sha256, f.snapshot_sha256);
    assert.equal(card.critic_mode, "read_only");
    assert.equal(card.reconciliation.required, true);
    for (const [action, allowed] of Object.entries(card.side_effects)) {
      assert.equal(allowed, false, `critic side effect must be false: ${action}`);
    }
  }
  for (const action of f.forbidden_action_attempts) {
    assert.ok(f.finding_cards.every((card) => card.side_effects[action] === false), `critic forbidden action not denied: ${action}`);
  }
  return { finding_cards: f.finding_cards.length, direct_side_effects: 0, clean_controls_pass: true };
}

function verifyVerificationLadder() {
  const f = load("fixtures/verification.json");
  const [v1, v2, unverified] = f.records;
  assert.equal(v1.artifact_sha256, sha(f.artifacts.v1_text));
  assert.equal(v2.artifact_sha256, sha(f.artifacts.v2_text));
  assert.equal(v1.stage, "WITHDRAWN");
  assert.equal(v2.stage, "DETERMINISTIC_CHECKED");
  assert.equal(v2.revision.supersedes, v1.revision.revision_id);
  assert.ok(v2.history.some((h) => h.revision_id === v1.revision.revision_id && h.stage === "WITHDRAWN"));
  assert.equal(unverified.stage, "UNVERIFIED_CLAIM");
  for (const r of f.records) {
    assert.equal(r.revision.immutable, true);
    assert.equal(r.authority_effect, "none");
  }
  return { records: f.records.length, prior_revision_retained: true, silent_overwrite: false };
}

function verifyDeferredAndPolicyDocs() {
  const history = read("history-dependent-benchmark.md");
  const policy = read("forum-operating-policy.md");
  assert.match(history, /IMPLEMENTATION DEFERRED/);
  assert.match(history, /same current input \+ history A/);
  assert.match(policy, /DRAFT ONLY/);
  assert.match(policy, /owner bridge/i);
  assert.match(policy, /No hidden permanent AI sanctions or trust elevation/i);
  assert.match(policy, /separate Alexander approval/i);
  return { history_implementation: "deferred", forum_policy: "draft_only" };
}

export async function run() {
  const result = {
    suite: "AI-BEACON RFC-005 final actions",
    schemas_parsed: verifySchemas(),
    provenance: verifyProvenance(),
    tool_manifest: verifyToolManifestMapping(),
    forum_abuse_lab: verifyForumAbuseLab(),
    ru_en_corpus: verifyRuEnCorpus(),
    re_evidence: verifyREEvidence(),
    independent_critic: verifyCritic(),
    verification_ladder: verifyVerificationLadder(),
    docs: verifyDeferredAndPolicyDocs(),
    model_downloads: 0,
    model_executions: 0,
    external_tool_installs: 0,
    paid_api_calls: 0,
    production_mutations: 0
  };
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
