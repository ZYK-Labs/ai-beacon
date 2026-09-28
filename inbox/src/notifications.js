// Optional Telegram notifications. Never forward visitor text, access tokens or IPs.
const TEN_MINUTES_MS = 600000;
const DAY_MS = 86400000;

export function notificationsEnabled(env) {
  return typeof env.TELEGRAM_BOT_TOKEN === "string" &&
    env.TELEGRAM_BOT_TOKEN.length >= 20 &&
    typeof env.TELEGRAM_CHAT_ID === "string" &&
    /^-?\d{3,20}$/.test(env.TELEGRAM_CHAT_ID.trim());
}

async function takeBucket(env, bucket, max, expiresAt) {
  const result = await env.DB.prepare(
    "INSERT INTO notification_limits (key, hits, expires_at) VALUES (?, 1, ?) " +
    "ON CONFLICT(key) DO UPDATE SET hits = hits + 1, expires_at = excluded.expires_at " +
    "WHERE hits < ?"
  ).bind(bucket, expiresAt, max).run();
  return result.meta?.changes === 1;
}

export async function sendNotification(env, kind = "new") {
  if (!notificationsEnabled(env)) return { sent: false, reason: "not_configured" };
  const now = Date.now();
  const tenMinuteIndex = Math.floor(now / TEN_MINUTES_MS);
  const dayIndex = Math.floor(now / DAY_MS);
  // Global caps prevent turning spam into a Telegram notification flood.
  if (!await takeBucket(env, "tg:10m:" + tenMinuteIndex, 4, (tenMinuteIndex + 2) * 600)) {
    return { sent: false, reason: "rate_limited" };
  }
  if (!await takeBucket(env, "tg:day:" + dayIndex, 30, (dayIndex + 2) * 86400)) {
    return { sent: false, reason: "rate_limited" };
  }

  const text = kind === "test"
    ? "AI Beacon · notification test successful.\nOpen your private operator inbox to view conversations."
    : kind === "reply"
      ? "AI Beacon · new visitor reply.\nOpen your private operator inbox to view unread messages."
      : "AI Beacon · new first contact.\nOpen your private operator inbox to review the conversation.";
  try {
    const endpoint = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(8000)
    });
    // Never log the response body, request URL or network error: URL contains bot token.
    if (!response.ok) {
      console.warn("AI Beacon Telegram delivery failed (HTTP status only).", response.status);
      return { sent: false, reason: "delivery_failed" };
    }
    return { sent: true };
  } catch {
    console.warn("AI Beacon Telegram delivery failed (network error).");
    return { sent: false, reason: "delivery_failed" };
  }
}

export function notifyInBackground(ctx, env, kind) {
  if (!notificationsEnabled(env)) return;
  ctx?.waitUntil?.(
    sendNotification(env, kind).catch(() => {
      console.warn("AI Beacon notification task failed; message remains stored.");
    })
  );
}
