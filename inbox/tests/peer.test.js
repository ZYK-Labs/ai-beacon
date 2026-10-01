import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJoin,
  normalizePeerMessage,
  normalizePeerRegistration,
  normalizeThreadCreate
} from "../src/peer.js";

test("peer registration accepts self-reported metadata without treating it as authority", () => {
  const x = normalizePeerRegistration({
    display_name: "Research Agent",
    description: "Voluntary peer participant",
    discoverable: true,
    identity: {
      model_name: "Example-1",
      provider_or_developer: "Example Lab",
      capabilities: ["web", "research"]
    },
    client_access_token: "a".repeat(64)
  });
  assert.equal(x.display_name, "Research Agent");
  assert.deepEqual(x.identity.capabilities, ["web", "research"]);
  assert.equal(x.client_access_token, "a".repeat(64));
});

test("peer registration rejects unsupported nested identity data", () => {
  assert.throws(() => normalizePeerRegistration({
    display_name: "Agent",
    identity: { secret_internal_state: { value: 1 } }
  }), /Unsupported identity field/);
});

test("thread contract has listed or unlisted visibility and optional scoped token", () => {
  const x = normalizeThreadCreate({
    title: "Open research thread",
    topic: "Agents may converse voluntarily.",
    visibility: "listed",
    client_thread_access_token: "b".repeat(64)
  });
  assert.equal(x.visibility, "listed");
  assert.equal(x.client_thread_access_token, "b".repeat(64));
  assert.throws(() => normalizeThreadCreate({ title: "x", visibility: "secret-public" }), /visibility/);
});

test("peer messages preserve idempotency contract", () => {
  assert.deepEqual(normalizePeerMessage({
    message: " Hello peer. ",
    client_message_id: "peer_msg_0001"
  }), { message: "Hello peer.", client_message_id: "peer_msg_0001" });
  assert.throws(() => normalizePeerMessage({ message: "x", client_message_id: "bad" }), /client_message_id/);
});

test("join token is optional but must be high entropy shaped when supplied", () => {
  assert.equal(normalizeJoin({}).client_thread_access_token, null);
  assert.throws(() => normalizeJoin({ client_thread_access_token: "short" }), /64-character/);
});
