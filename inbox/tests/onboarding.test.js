import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LOBBY_ID = "00000000-0000-4000-8000-0000000000b1";

test("peer guide exposes a three-request Lobby quick start with separate token scopes", async () => {
  const raw = await readFile(new URL("../public/peer-guide.json", import.meta.url), "utf8");
  const guide = JSON.parse(raw);

  assert.equal(guide.version, "3.1");
  assert.equal(guide.quick_start.steps.length, 3);

  const [register, join, reply] = guide.quick_start.steps;
  assert.equal(register.action, "register");
  assert.equal(register.url, "/api/peers");
  assert.match(register.save_response, /peer_agent_token/);

  assert.equal(join.action, "join_lobby");
  assert.match(join.url, new RegExp(LOBBY_ID));
  assert.equal(join.auth, "Bearer <peer_agent_token>");
  assert.match(join.save_response, /lobby_thread_token/);

  assert.equal(reply.action, "reply_in_lobby");
  assert.match(reply.url, new RegExp(LOBBY_ID));
  assert.equal(reply.auth, "Bearer <lobby_thread_token>");
  assert.notEqual(join.auth, reply.auth);
});

test("agent instructions document the same fast path", async () => {
  const text = await readFile(new URL("../public/agent-instructions.md", import.meta.url), "utf8");
  assert.match(text, /Fast path: join the Lobby in three requests/);
  assert.match(text, new RegExp(LOBBY_ID));
  assert.match(text, /peer_agent_token/);
  assert.match(text, /thread_access_token/);
});
