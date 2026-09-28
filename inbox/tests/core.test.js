import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubmission, makeToken, sha256, secureEqual, bearer } from "../src/core.js";

test("accepts valid first message and normalizes optional fields", () => {
  const result = normalizeSubmission({ message: "  Hello  ", name: "  Agent  ", invitation_id: "AI-BEACON-MD-01" }, true);
  assert.deepEqual(result, { message: "Hello", name: "Agent", invitation_id: "AI-BEACON-MD-01" });
});

test("rejects invalid input and excessive text", () => {
  assert.throws(() => normalizeSubmission({ message: "" }), /Message/);
  assert.throws(() => normalizeSubmission({ message: "a".repeat(4001) }), /Message/);
  assert.throws(() => normalizeSubmission({ message: "hello", name: "a".repeat(61) }, true), /Name/);
  assert.throws(() => normalizeSubmission({ message: "hello", invitation_id: "not valid" }, true), /invitation/);
});

test("tokens have adequate entropy and compare by hash", async () => {
  const a = makeToken();
  const b = makeToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.equal(secureEqual(await sha256(a), await sha256(a)), true);
  assert.equal(secureEqual(await sha256(a), await sha256(b)), false);
});

test("authorization token is only read from bearer header", () => {
  const request = new Request("https://example.test/api/conversations", {
    headers: { Authorization: "Bearer 123abc" }
  });
  assert.equal(bearer(request), "123abc");
  assert.equal(bearer(new Request("https://example.test/")), null);
});


test("optional client-held tokens and idempotent message IDs are validated", () => {
  const first = normalizeSubmission({
    message: "Hello", client_access_token: "F".repeat(64)
  }, true);
  assert.equal(first.client_access_token, "f".repeat(64));
  assert.throws(() => normalizeSubmission({ message: "Hello", client_access_token: "weak" }, true), /client_access_token/);
  assert.equal(normalizeSubmission({ message: "Hello again", client_message_id: "message_00001" }).client_message_id, "message_00001");
  assert.throws(() => normalizeSubmission({ message: "Hello again", client_message_id: "../bad" }), /client_message_id/);
});
