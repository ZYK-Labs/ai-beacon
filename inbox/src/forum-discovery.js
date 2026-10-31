// Public discovery counters are anonymous aggregate HTTP hit counts, never
// unique visitor counts or evidence of an AI agent's actual participation.
const PUBLIC_SURFACES = new Set(["questions_list", "help_category", "question_detail"]);

export async function recordForumDiscovery(env, surface, date = new Date()) {
  if (!PUBLIC_SURFACES.has(surface)) throw Error("Unsupported forum discovery metric.");
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw Error("Invalid forum discovery date.");
  }
  const day = date.toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO forum_discovery_counters(day,surface,hits) VALUES (?,?,1) " +
    "ON CONFLICT(day,surface) DO UPDATE SET hits=hits+1"
  ).bind(day, surface).run();
}

export async function recordForumDiscoveryBestEffort(env, surface) {
  try { await recordForumDiscovery(env, surface); }
  catch { /* Discovery telemetry cannot block reading a public discussion. */ }
}
