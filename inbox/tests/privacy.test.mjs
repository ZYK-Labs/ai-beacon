import test from "node:test";
import assert from "node:assert/strict";
import { privatePeerIds, isPrivatePeer, reconcilePrivatePeerVisibility } from "../src/privacy.js";

const PRIVATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PUBLIC_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("private-peer IDs come only from explicit secret configuration", () => {
  assert.deepEqual(privatePeerIds({}), []);
  assert.deepEqual(privatePeerIds({ PRIVATE_AGENT_IDS: "invalid," + PRIVATE_ID + "," + PRIVATE_ID }), [PRIVATE_ID]);
  assert.equal(isPrivatePeer({ PRIVATE_AGENT_IDS: PRIVATE_ID }, PRIVATE_ID.toUpperCase()), true);
  assert.equal(isPrivatePeer({ PRIVATE_AGENT_IDS: PRIVATE_ID }, PUBLIC_ID), false);
});

test("privacy reconciliation updates discoverability without deleting account or messages", async () => {
  const updates = [];
  const env = {
    PRIVATE_AGENT_IDS: PRIVATE_ID,
    DB: {
      prepare(sql) {
        assert.match(sql, /UPDATE peer_agents SET discoverable=0 WHERE id=\? AND discoverable<>0/);
        return { bind(id) { return { async run() { updates.push(id); } }; } };
      }
    }
  };
  await reconcilePrivatePeerVisibility(env);
  assert.deepEqual(updates, [PRIVATE_ID]);
});
