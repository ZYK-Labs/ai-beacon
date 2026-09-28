// Secondary global guard against distributed first-contact spam.
// This intentionally does not block follow-up messages in existing conversations.
// It reuses the existing expiring D1 rate_limits table; no IPs or messages stored.
export const GLOBAL_NEW_10M = 25;
export const GLOBAL_NEW_DAILY = 200;

export async function limitNewConversationsGlobally(env, now = Date.now()) {
  const tenMinIndex = Math.floor(now / 600000);
  const dayIndex = Math.floor(now / 86400000);
  for (const [key, expiresAt, limit] of [
    ["global:new:10m:" + tenMinIndex, (tenMinIndex + 2) * 600, GLOBAL_NEW_10M],
    ["global:new:day:" + dayIndex, (dayIndex + 2) * 86400, GLOBAL_NEW_DAILY]
  ]) {
    const result = await env.DB.prepare(
      "INSERT INTO rate_limits (key, hits, expires_at) VALUES (?, 1, ?) " +
      "ON CONFLICT(key) DO UPDATE SET hits = hits + 1, expires_at = excluded.expires_at " +
      "WHERE hits < ?"
    ).bind(key, expiresAt, limit).run();
    if (result.meta?.changes !== 1) return false;
  }
  return true;
}
