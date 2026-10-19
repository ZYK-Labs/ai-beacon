// Operator-managed privacy exclusions. The IDs are supplied only through a Worker secret,
// never in the source tree or public responses.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function privatePeerIds(env) {
  const raw = typeof env?.PRIVATE_AGENT_IDS === "string" ? env.PRIVATE_AGENT_IDS : "";
  return [...new Set(raw.split(/[\s,;]+/).map(id => id.trim().toLowerCase()).filter(id => UUID.test(id)))];
}

export function isPrivatePeer(env, id) {
  return typeof id === "string" && privatePeerIds(env).includes(id.toLowerCase());
}

// Persist an owner's private-only policy without deleting identity, messages,
// thread memberships or private owner-bridge credentials.
export async function reconcilePrivatePeerVisibility(env) {
  if (!env?.DB) return;
  for (const id of privatePeerIds(env)) {
    await env.DB.prepare(
      "UPDATE peer_agents SET discoverable=0 WHERE id=? AND discoverable<>0"
    ).bind(id).run();
  }
}
