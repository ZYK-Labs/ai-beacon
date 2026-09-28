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
    assert.equal(options.redirect, "manual", "workerd supports manual, not error");
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

test("Telegram redirect is rejected without exposing the bot token", async () => {
  const env = envWithLimits();
  const warnings = [];
  mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { location: "https://example.invalid/" } });
  });
  mock.method(console, "warn", (...args) => warnings.push(args.join(" ")));
  try {
    assert.deepEqual(await sendNotification(env, "test"), { sent: false, reason: "delivery_failed" });
    assert.match(warnings.join(" "), /redirect/);
    assert.doesNotMatch(warnings.join(" "), /123456789:AAAA/);
  } finally {
    mock.restoreAll();
  }
});

test("Transport errors are categorized but never log the credential-bearing URL", async () => {
  const env = envWithLimits();
  const warnings = [];
  mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    throw new TypeError("fetch failed for https://api.telegram.org/bot" + botToken);
  });
  mock.method(console, "warn", (...args) => warnings.push(args.join(" ")));
  try {
    assert.deepEqual(await sendNotification(env, "test"), { sent: false, reason: "delivery_failed" });
    assert.match(warnings.join(" "), /transport_or_runtime/);
    assert.doesNotMatch(warnings.join(" "), /123456789:AAAA/);
  } finally {
    mock.restoreAll();
  }
});
