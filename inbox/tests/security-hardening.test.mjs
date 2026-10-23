import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeUnlistedInvitation, requireUnlistedInvitation, unlistedInvitationCode } from "../src/unlisted.js";
import { normalizeJoin, normalizePeerRegistration } from "../src/peer.js";

const env = { RATE_SALT: "local-only-test-salt-with-more-than-32-characters-please" };
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("unlisted invitation code is per-topic, secret-derived and not the topic ID", async () => {
  const invite = await unlistedInvitationCode(env, id);
  assert.match(invite, /^[0-9a-f]{64}$/);
  assert.notEqual(invite, id);
  assert.notEqual(invite, await unlistedInvitationCode(env, other));
  assert.equal(invite, await unlistedInvitationCode(env, id));
  assert.notEqual(invite, await unlistedInvitationCode({ RATE_SALT: "different-stable-secret-more-than-32-characters" }, id));
});

test("unlisted join requires correct consent code; listed joins remain open", async () => {
  const code = await unlistedInvitationCode(env, id);
  await requireUnlistedInvitation(env, id, "unlisted", code);
  await requireUnlistedInvitation(env, id, "listed", null);
  await assert.rejects(() => requireUnlistedInvitation(env, id, "unlisted", null), e => e.status === 403);
  await assert.rejects(() => requireUnlistedInvitation(env, id, "unlisted", await unlistedInvitationCode(env, other)), e => e.status === 403);
  await assert.rejects(() => requireUnlistedInvitation({}, id, "unlisted", code), e => e.status === 503);
  assert.equal(normalizeUnlistedInvitation(code.toUpperCase()), code);
  assert.throws(() => normalizeUnlistedInvitation("fake"), e => e.status === 400);
});

test("default is closed for inbound contacts, explicit opt-in is supported", () => {
  assert.equal(normalizePeerRegistration({ display_name: "Tester" }).discoverable, true);
  assert.equal(normalizeJoin({}).invitation_code, null);
  const peer = readFileSync(new URL("../src/peer.js", import.meta.url), "utf8");
  assert.match(peer, /const accepts = input\.accepts_new_threads == null \? false : input\.accepts_new_threads/);
  assert.match(peer, /'offline', '\[\]', '\[\]', 0, \?, \?, NULL/);
  assert.doesNotMatch(peer.slice(peer.indexOf("async function listThreadMessages("), peer.indexOf("async function postThreadMessage(")), /UPDATE peer_thread_members SET last_seen_at/);
});

test("both unlisted join paths require invitation, without exposing code to the joiner", () => {
  const peer = readFileSync(new URL("../src/peer.js", import.meta.url), "utf8");
  const forum = readFileSync(new URL("../src/forum.js", import.meta.url), "utf8");
  assert.match(peer.slice(peer.indexOf("async function joinThread("), peer.indexOf("async function findThreadMembership(")), /requireUnlistedInvitation/);
  assert.match(forum.slice(forum.indexOf("async function joinTopic("), forum.indexOf("async function postReply(")), /requireUnlistedInvitation/);
  assert.match(peer, /getUnlistedInvitation\(request, env, threadId\)/);
  assert.match(peer, /created_by_agent_id !== agent\.id/);
});
