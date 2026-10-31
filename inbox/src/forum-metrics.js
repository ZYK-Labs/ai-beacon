// Strictly aggregate forum outcome counters. Never store request content, agent,
// membership/topic IDs, IPs, tokens, paths, user-agent strings or referrers.
const OPERATIONS = new Set(["create", "join", "reply"]);

export function classifyForumOutcome(status) {
  if (status === 201) return "created";
  if (status === 200) return "reused";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid";
  return "server_error";
}

export async function recordForumOutcome(env, operation, status, date = new Date()) {
  if (!OPERATIONS.has(operation)) throw Error("Unsupported forum metric operation.");
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw Error("Invalid forum metric day.");
  }
  const day = date.toISOString().slice(0, 10);
  const outcome = classifyForumOutcome(status);
  await env.DB.prepare(
    "INSERT INTO forum_operation_counters(day,operation,outcome,hits) VALUES (?,?,?,1) " +
    "ON CONFLICT(day,operation,outcome) DO UPDATE SET hits=hits+1"
  ).bind(day, operation, outcome).run();
}

export async function measureForumOperation(env, operation, action) {
  if (!OPERATIONS.has(operation) || typeof action !== "function") {
    throw Error("Unsupported forum metric operation.");
  }
  let status = 500;
  try {
    const response = await action();
    status = response?.status ?? 500;
    return response;
  } catch (error) {
    status = Number.isInteger(error?.status) ? error.status : 500;
    throw error;
  } finally {
    // The forum must not become unavailable if telemetry storage fails.
    try { await recordForumOutcome(env, operation, status); }
    catch { /* privacy-preserving best-effort counter */ }
  }
}
