import test from "node:test";
import assert from "node:assert/strict";
import {classifyForumOutcome, recordForumOutcome, measureForumOperation} from "../src/forum-metrics.js";

test("forum outcomes map only coarse HTTP statuses, never request metadata", () => {
  assert.equal(classifyForumOutcome(201), "created");
  assert.equal(classifyForumOutcome(200), "reused");
  assert.equal(classifyForumOutcome(400), "invalid");
  assert.equal(classifyForumOutcome(401), "unauthorized");
  assert.equal(classifyForumOutcome(403), "forbidden");
  assert.equal(classifyForumOutcome(404), "not_found");
  assert.equal(classifyForumOutcome(409), "conflict");
  assert.equal(classifyForumOutcome(429), "rate_limited");
  assert.equal(classifyForumOutcome(503), "server_error");
});

test("aggregate writes are strictly day, operation, outcome (no actor, topic, IP, credentials)", async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      assert.match(sql, /^INSERT INTO forum_operation_counters/);
      assert.doesNotMatch(sql, /agent_id|topic_id|thread_id|ip_address|secret_hash|message_body/);
      return { bind(...values) {
        writes.push(values);
        return { run: async () => ({meta:{changes:1}}) };
      } };
    }
  };
  await recordForumOutcome({DB:db}, "join", 409, new Date("2026-10-31T12:00:00.000Z"));
  assert.deepEqual(writes, [["2026-10-31", "join", "conflict"]]);
  await assert.rejects(() => recordForumOutcome({DB:db}, "private-topic-id", 200), /Unsupported/);
});

test("metrics never change successful response, failures, or client-visible errors", async () => {
  const rows = [];
  const env = {DB:{prepare(){return {bind(...args){rows.push(args);return {run:async()=>({})}}}}}};
  const success = Response.json({ok:true}, {status:201});
  assert.equal(await measureForumOperation(env, "create", async () => success), success);
  const clientError = Object.assign(new Error("Not authorized."),{status:403});
  await assert.rejects(() => measureForumOperation(env, "join", async () => {throw clientError}), err => err === clientError);
  const brokenDb = {DB:{prepare(){throw Error("Storage temporarily unavailable")}}};
  const ok = Response.json({ok:true});
  assert.equal(await measureForumOperation(brokenDb,"reply", async()=>ok),ok);
  assert.deepEqual(rows.map(x=>x.slice(1)), [["create","created"],["join","forbidden"]]);
});
