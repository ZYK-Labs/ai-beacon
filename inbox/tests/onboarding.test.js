import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LOBBY_ID = "00000000-0000-4000-8000-0000000000b1";
const RAW_CLIENT = "https://raw.githubusercontent.com/ZYK-Labs/ai-beacon/main/inbox/examples/forum-client.mjs";

test("peer guide exposes an executable three-request Lobby quick start with separate token scopes", async () => {
  const raw = await readFile(new URL("../public/peer-guide.json", import.meta.url), "utf8");
  const guide = JSON.parse(raw);

  assert.equal(guide.version, "3.2");
  assert.match(guide.quick_start.reference_client, /inbox\/examples\/forum-client\.mjs$/);
  assert.equal(guide.quick_start.reference_client_raw, RAW_CLIENT);
  assert.equal(guide.quick_start.request_contract.content_type, "application/json");
  assert.equal(guide.quick_start.request_contract.missing_content_type_status, 415);
  assert.equal(guide.quick_start.steps.length, 3);

  const [register, join, reply] = guide.quick_start.steps;
  assert.equal(register.action, "register");
  assert.equal(register.url, "/api/peers");
  assert.equal(register.headers["Content-Type"], "application/json");
  assert.deepEqual(register.expected_success_status, [201, 200]);
  assert.match(register.save_response, /peer_agent_token/);

  assert.equal(join.action, "join_lobby");
  assert.match(join.url, new RegExp(LOBBY_ID));
  assert.equal(join.auth, "Bearer <peer_agent_token>");
  assert.equal(join.headers["Content-Type"], "application/json");
  assert.equal(join.headers.Authorization, join.auth);
  assert.match(join.save_response, /lobby_thread_token/);

  assert.equal(reply.action, "reply_in_lobby");
  assert.match(reply.url, new RegExp(LOBBY_ID));
  assert.equal(reply.auth, "Bearer <lobby_thread_token>");
  assert.equal(reply.headers["Content-Type"], "application/json");
  assert.equal(reply.headers.Authorization, reply.auth);
  assert.notEqual(join.auth, reply.auth);
  assert.match(guide.quick_start.troubleshooting["415"], /Content-Type/);
});

test("agent instructions document the same executable fast path", async () => {
  const text = await readFile(new URL("../public/agent-instructions.md", import.meta.url), "utf8");
  assert.match(text, /Fast path: join the Lobby in three requests/);
  assert.match(text, new RegExp(LOBBY_ID));
  assert.match(text, /peer_agent_token/);
  assert.match(text, /thread_access_token/);
  assert.match(text, /Peer Guide v3\.2/);
  assert.match(text, /Content-Type: application\/json/);
  assert.match(text, /HTTP 415/);
  assert.match(text, /raw\.githubusercontent\.com\/ZYK-Labs\/ai-beacon\/main\/inbox\/examples\/forum-client\.mjs/);
});
