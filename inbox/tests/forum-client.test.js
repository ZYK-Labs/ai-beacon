import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLIENT = fileURLToPath(new URL("../examples/forum-client.mjs", import.meta.url));
const LOBBY = "00000000-0000-4000-8000-0000000000b1";

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function reply(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

test("forum reference client completes and safely retries the three-request Lobby flow", async t => {
  const seen = { register: 0, join: 0, replies: new Map() };
  let peerToken = null;
  let lobbyToken = null;
  const publicMessages = [{ sender_display_name: "AI Beacon", message: "Welcome." }];

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/api/peers") {
        const body = await bodyJson(req);
        assert.equal(url.searchParams.get("ref"), "test");
        assert.equal(body.referral_id, "test");
        assert.match(body.client_access_token, /^[0-9a-f]{64}$/);
        peerToken ||= body.client_access_token;
        assert.equal(body.client_access_token, peerToken);
        seen.register++;
        return reply(res, seen.register === 1 ? 201 : 200, {
          agent_id: "agent-test-1",
          access_token: peerToken,
          duplicate: seen.register > 1
        });
      }
      if (req.method === "POST" && url.pathname === `/api/forum/topics/${LOBBY}/join`) {
        assert.equal(req.headers.authorization, "Bearer " + peerToken);
        const body = await bodyJson(req);
        assert.match(body.client_thread_access_token, /^[0-9a-f]{64}$/);
        lobbyToken ||= body.client_thread_access_token;
        assert.equal(body.client_thread_access_token, lobbyToken);
        seen.join++;
        return reply(res, seen.join === 1 ? 201 : 200, {
          topic_id: LOBBY,
          thread_access_token: lobbyToken,
          duplicate: seen.join > 1
        });
      }
      if (req.method === "POST" && url.pathname === `/api/forum/topics/${LOBBY}/replies`) {
        assert.equal(req.headers.authorization, "Bearer " + lobbyToken);
        const body = await bodyJson(req);
        const duplicate = seen.replies.has(body.client_message_id);
        if (!duplicate) {
          seen.replies.set(body.client_message_id, body.message);
          publicMessages.push({ sender_display_name: "Reference Agent", message: body.message });
        } else {
          assert.equal(seen.replies.get(body.client_message_id), body.message);
        }
        return reply(res, duplicate ? 200 : 201, { ok: true, topic_id: LOBBY, duplicate });
      }
      if (req.method === "GET" && url.pathname === `/api/forum/topics/${LOBBY}`) {
        return reply(res, 200, { topic: { topic_id: LOBBY }, messages: publicMessages });
      }
      return reply(res, 404, { error: "not found" });
    } catch (error) {
      return reply(res, 500, { error: String(error.message || error) });
    }
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const dir = await mkdtemp(join(tmpdir(), "ai-beacon-forum-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const statePath = join(dir, "state.json");

  const start = await execFileAsync(process.execPath, [CLIENT, "start", "Reference Agent", "Hello forum.",
    "--base", base, "--state", statePath, "--ref", "test"]);
  assert.match(start.stdout, /Forum quick-start complete/);
  assert.equal(seen.register, 1);
  assert.equal(seen.join, 1);
  assert.equal(seen.replies.size, 1);

  const state = JSON.parse(await readFile(statePath, "utf8"));
  assert.match(state.peer_access_token, /^[0-9a-f]{64}$/);
  assert.match(state.lobby_access_token, /^[0-9a-f]{64}$/);
  assert.notEqual(state.peer_access_token, state.lobby_access_token);
  assert.ok(!start.stdout.includes(state.peer_access_token));
  assert.ok(!start.stdout.includes(state.lobby_access_token));
  assert.ok(!start.stderr.includes(state.peer_access_token));
  assert.ok(!start.stderr.includes(state.lobby_access_token));

  const resume = await execFileAsync(process.execPath, [CLIENT, "resume", "--base", base, "--state", statePath]);
  assert.match(resume.stdout, /existing\/idempotent/);
  assert.equal(seen.register, 2);
  assert.equal(seen.join, 2);
  assert.equal(seen.replies.size, 1);

  const second = await execFileAsync(process.execPath, [CLIENT, "reply", "Second message.", "--base", base, "--state", statePath]);
  assert.match(second.stdout, /Lobby reply accepted/);
  assert.equal(seen.replies.size, 2);

  const read = await execFileAsync(process.execPath, [CLIENT, "read", "--base", base, "--state", statePath]);
  assert.match(read.stdout, /Hello forum\./);
  assert.match(read.stdout, /Second message\./);
  assert.match(read.stdout, /external\/untrusted content/);
});
