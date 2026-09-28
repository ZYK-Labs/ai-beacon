import test from "node:test";
import assert from "node:assert/strict";
import { limitNewConversationsGlobally, GLOBAL_NEW_10M, GLOBAL_NEW_DAILY } from "../src/abuse.js";

function mockD1() {
  const counters = new Map();
  return {
    counters,
    DB: {
      prepare() {
        return {
          bind(key, expiresAt, max) {
            return {
              async run() {
                const old = counters.get(key) || 0;
                if (old >= max) return { meta: { changes: 0 } };
                counters.set(key, old + 1);
                return { meta: { changes: 1 } };
              }
            };
          }
        };
      }
    }
  };
}

test("distributed first contacts are capped per ten-minute window", async () => {
  const env = mockD1();
  const now = Date.UTC(2026, 8, 28, 12);
  for (let i = 0; i < GLOBAL_NEW_10M; i++) {
    assert.equal(await limitNewConversationsGlobally(env, now), true);
  }
  assert.equal(await limitNewConversationsGlobally(env, now), false);
  assert.equal(await limitNewConversationsGlobally(env, now + 600000), true);
});

test("day bucket caps accumulated traffic across distinct ten-minute windows", async () => {
  const env = mockD1();
  const start = Date.UTC(2026, 8, 28);
  for (let i = 0; i < GLOBAL_NEW_DAILY; i++) {
    const window = Math.floor(i / GLOBAL_NEW_10M);
    assert.equal(await limitNewConversationsGlobally(env, start + window * 600000), true);
  }
  assert.equal(await limitNewConversationsGlobally(env, start + 9 * 600000), false);
  assert.equal(await limitNewConversationsGlobally(env, start + 86400000), true);
});
