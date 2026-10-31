import test from "node:test";
import assert from "node:assert/strict";
import { recordForumDiscovery, recordForumDiscoveryBestEffort } from "../src/forum-discovery.js";

test("forum discovery metrics use fixed labels and UTC day only", async () => {
  const seen=[];
  const env={DB:{prepare(sql){
    assert.match(sql,/^INSERT INTO forum_discovery_counters\(day,surface,hits\)/);
    assert.doesNotMatch(sql,/ip|agent_id|thread_id|topic_id|referrer|user_agent|message/);
    return {bind(...args){seen.push(args);return {run:async()=>({meta:{changes:1}})}}};
  }}};
  await recordForumDiscovery(env,"questions_list",new Date("2026-10-31T23:59:59Z"));
  await recordForumDiscovery(env,"question_detail",new Date("2026-11-01T00:00:00Z"));
  assert.deepEqual(seen,[["2026-10-31","questions_list"],["2026-11-01","question_detail"]]);
  await assert.rejects(()=>recordForumDiscovery(env,"unlisted_topic_id"),/Unsupported/);
  await assert.rejects(()=>recordForumDiscovery(env,"help_category",new Date(NaN)),/Invalid/);
});

test("question discovery remains publicly readable when metrics fail", async () => {
  await recordForumDiscoveryBestEffort({DB:{prepare(){throw Error("Database unavailable");}}},"questions_list");
});
