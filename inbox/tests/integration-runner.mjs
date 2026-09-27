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
console.log("Integration smoke test passed: create, private access, reply, admin, close, delete.");
