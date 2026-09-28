// Exercise the published reference client against local Wrangler + D1.
// No real external AI models, public API or paid services are used.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const base = "http://127.0.0.1:8787";
const operatorToken = "a".repeat(64);
const clientPath = resolve("examples/agent-client.mjs");
const root = await mkdtemp(join(tmpdir(), "ai-beacon-roundtrip-"));
const statePath = join(root, "visitor-state.json");

function command(action, ...args) {
  const result = spawnSync(process.execPath, [clientPath, action, ...args,
    "--base", base, "--state", statePath], { encoding: "utf8", timeout: 25000 });
  if (result.status !== 0) throw Error("Reference client command failed (" + action + "): " + result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /Bearer [0-9a-f]{64}/i);
  return result.stdout;
}

async function operator(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + operatorToken,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  assert.ok(response.ok, "Operator request failed with HTTP " + response.status);
  return result;
}

let conversationID = "";
try {
  const instructions = await fetch(base + "/agent-instructions.md");
  assert.equal(instructions.status, 200);
  const text = await instructions.text();
  assert.match(text, /return to an existing conversation/i);
  assert.match(text, /POST \/api\/conversations.*new/i);

  const guide = await (await fetch(base + "/api/agent-guide")).json();
  assert.match(guide.important, /SAME ID/);
  assert.ok(guide.human_or_agent_instructions.endsWith("/agent-instructions.md"));

  const first = command("start", "Reference client says hello in an authorized local test.");
  assert.match(first, /First contact accepted/);
  const state = JSON.parse(await readFile(statePath, "utf8"));
  conversationID = state.conversation_id;
  assert.match(state.access_token, /^[a-f0-9]{64}$/);
  assert.match(conversationID, /^[0-9a-f-]{36}$/);

  // Resuming the client with an existing state must NOT create a new conversation.
  const resume = command("resume");
  assert.match(resume, /Existing conversation/);

  const before = await operator("GET", "/api/admin/conversations/" + conversationID);
  assert.equal(before.messages.length, 1);
  assert.equal(before.messages[0].role, "visitor");

  await operator("POST", "/api/admin/conversations/" + conversationID + "/messages", {
    message: "Hello, reference client. Please answer in this same conversation."
  });
  const read = command("read");
  assert.match(read, /\[admin\] Hello, reference client/);

  const reply = command("reply", "I received your reply in the original conversation.");
  assert.match(reply, /Follow-up accepted in existing conversation/);
  const thread = await operator("GET", "/api/admin/conversations/" + conversationID);
  assert.equal(thread.messages.length, 3);
  assert.deepEqual(thread.messages.map(message => message.role), ["visitor", "admin", "visitor"]);
  assert.equal(thread.conversation.id, conversationID);
  assert.doesNotMatch(first + resume + read + reply, new RegExp(state.access_token, "i"));

  console.log("Reference client E2E passed: agent guide → token saved → same-thread admin reply → client read → client follow-up.");
} finally {
  if (conversationID) {
    await operator("DELETE", "/api/admin/conversations/" + conversationID).catch(() => {});
  }
  await rm(root, { recursive: true, force: true });
}
