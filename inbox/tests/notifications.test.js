import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { notificationsEnabled, sendNotification } from "../src/notifications.js";

const botToken = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function envWithLimits() {
  const counters = new Map();
  const db = {
    prepare() {
      return {
        bind(key, _expiry, max) {
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
  };
  return { DB: db, TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: "123456789" };
}

test("notifications require both private secrets", () => {
  assert.equal(notificationsEnabled({ TELEGRAM_BOT_TOKEN: botToken }), false);
  assert.equal(notificationsEnabled({ TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: "invalid" }), false);
  assert.equal(notificationsEnabled(envWithLimits()), true);
});

test("Telegram notification contains no visitor content or access token", async () => {
  const env = envWithLimits();
  let posted;
  mock.method(globalThis, "fetch", async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\/bot/);
    posted = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  try {
    const result = await sendNotification(env, "new");
    assert.deepEqual(result, { sent: true });
    assert.equal(posted.chat_id, "123456789");
    assert.match(posted.text, /new first contact/i);
    assert.doesNotMatch(posted.text, /Authorization|Bearer|token|IP address/i);
  } finally {
    mock.restoreAll();
  }
});

test("global ten-minute bucket suppresses notification floods", async () => {
  const env = envWithLimits();
  let delivered = 0;
  mock.method(globalThis, "fetch", async () => {
    delivered += 1;
    return new Response('{"ok":true}', { status: 200 });
  });
  try {
    for (let i = 0; i < 4; i++) assert.equal((await sendNotification(env, "reply")).sent, true);
    assert.deepEqual(await sendNotification(env, "reply"), { sent: false, reason: "rate_limited" });
    assert.equal(delivered, 4);
  } finally {
    mock.restoreAll();
  }
});
