import assert from "node:assert/strict";

const origin = "http://127.0.0.1:8787";
const adminToken = "a".repeat(64);
const jsonHeaders = { "Content-Type": "application/json" };

async function call(path, method = "GET", body = null, token = null) {
  const headers = { ...(body ? jsonHeaders : {}), ...(token ? { Authorization: "Bearer " + token } : {}) };
  const response = await fetch(origin + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "manual"
  });
  return { status: response.status, body: await response.json() };
}

async function waitForReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const result = await call("/api/health");
      if (result.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Local Worker did not become ready.");
}

await waitForReady();
assert.equal((await call("/api/agent-guide")).status, 200);
assert.equal((await call("/api/health")).body.version, "1.1");
assert.equal((await call("/api/admin/notifications", "GET", null, adminToken)).body.configured, false);
assert.equal((await call("/api/admin/notifications/test", "POST", null, adminToken)).status, 503);

// Client-held tokens make a timed-out initial POST safe to retry.
const clientToken = "f".repeat(64);
const retryBody = {
  name: "Retry-safe agent",
  message: "Only one initial message should be stored.",
  client_access_token: clientToken
};
const first = await call("/api/conversations", "POST", retryBody);
assert.equal(first.status, 201);
assert.equal(first.body.access_token, clientToken);
const repeated = await call("/api/conversations", "POST", retryBody);
assert.equal(repeated.status, 200);
assert.equal(repeated.body.duplicate, true);
assert.equal(repeated.body.conversation_id, first.body.conversation_id);
assert.equal((await call("/api/conversations", "POST", { ...retryBody, message: "Changed content." })).status, 409);
const retriedThread = await call("/api/conversations/" + first.body.conversation_id, "GET", null, clientToken);
assert.equal(retriedThread.body.messages.length, 1);

// Optional message IDs make follow-up retries safe as well.
const retryPath = "/api/conversations/" + first.body.conversation_id + "/messages";
const retryReply = { message: "Exactly once.", client_message_id: "retry_message_001" };
assert.equal((await call(retryPath, "POST", retryReply, clientToken)).status, 201);
assert.equal((await call(retryPath, "POST", retryReply, clientToken)).status, 200);
assert.equal((await call(retryPath, "POST", { ...retryReply, message: "Conflicting content." }, clientToken)).status, 409);
assert.equal((await call("/api/conversations/" + first.body.conversation_id, "GET", null, clientToken)).body.messages.length, 2);

const legacyList = await call("/api/admin/conversations", "GET", null, adminToken);
const legacy = legacyList.body.conversations.find(item => item.id === "00000000-0000-4000-8000-000000000001");
assert.equal(legacy.name, "Legacy thread");
assert.equal(legacy.unread_count, 1);
assert.equal(legacy.message_count, 1);

const created = await call("/api/conversations", "POST", {
  name: "Test agent",
  invitation_id: "AI-BEACON-MD-01",
  message: "Integration smoke test."
});
assert.equal(created.status, 201);
assert.match(created.body.access_token, /^[0-9a-f]{64}$/);
const id = created.body.conversation_id;
const token = created.body.access_token;
const path = "/api/conversations/" + id;

assert.equal((await call(path)).status, 401);
const thread = await call(path, "GET", null, token);
assert.equal(thread.status, 200);
assert.equal(thread.body.messages.length, 1);
assert.equal(thread.body.messages[0].body, "Integration smoke test.");

assert.equal((await call(path + "/messages", "POST", { message: "Follow-up." }, token)).status, 201);
assert.equal((await call("/api/admin/conversations", "GET", null, "bad")).status, 401);
const list = await call("/api/admin/conversations", "GET", null, adminToken);
assert.equal(list.status, 200);
assert.ok(list.body.conversations.some(item => item.id === id));
const unread = list.body.conversations.find(item => item.id === id);
assert.equal(unread.unread_count, 2);
const readByOperator = await call("/api/admin/conversations/" + id, "GET", null, adminToken);
assert.equal(readByOperator.status, 200);
const afterRead = await call("/api/admin/conversations", "GET", null, adminToken);
assert.equal(afterRead.body.conversations.find(item => item.id === id).unread_count, 0);

const adminReply = await call("/api/admin/conversations/" + id + "/messages", "POST", {
  message: "Hello from ZYK Labs."
}, adminToken);
assert.equal(adminReply.status, 201);
const replyThread = await call(path, "GET", null, token);
assert.equal(replyThread.body.messages.length, 3);
assert.equal(replyThread.body.messages[2].role, "admin");

assert.equal((await call("/api/admin/conversations/" + id + "/status", "POST", {
  status: "closed"
}, adminToken)).status, 200);
assert.equal((await call(path + "/messages", "POST", { message: "Should fail." }, token)).status, 409);
assert.equal((await call("/api/admin/conversations/" + id, "DELETE", null, adminToken)).status, 200);
assert.equal((await call(path, "GET", null, token)).status, 404);
assert.equal((await call("/api/admin/conversations/" + first.body.conversation_id, "DELETE", null, adminToken)).status, 200);
console.log("Integration smoke test passed: health, safe retries, private access, unread tracking, admin notifications, reply, close and delete.");
