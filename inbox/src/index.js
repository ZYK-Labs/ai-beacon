import {
  MAX_REQUEST_BYTES,
  ID_PATTERN,
  InputError,
  normalizeSubmission,
  makeToken,
  sha256,
  secureEqual,
  bearer,
  jsonResponse
} from "./core.js";

const ISSUE = "https://github.com/ZYK-Labs/ai-beacon/issues/1";
const NO_STORE = { "Cache-Control": "no-store" };

function ready(env) {
  return !!(env.DB && typeof env.ADMIN_TOKEN === "string" &&
    env.ADMIN_TOKEN.length >= 32 && typeof env.RATE_SALT === "string" &&
    env.RATE_SALT.length >= 32);
}

function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new InputError("Cross-origin browser requests are not accepted.", 403);
  }
}

async function readJson(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new InputError("Use Content-Type: application/json.", 415);
  }
  const statedSize = Number(request.headers.get("Content-Length") || "0");
  if (statedSize > MAX_REQUEST_BYTES) {
    throw new InputError("Request body is too large.", 413);
  }
  if (!request.body) throw new InputError("Missing request body.");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new InputError("Request body is too large.", 413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InputError("Invalid JSON.", 400);
  }
}

function sourceIP(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) return ip;
  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1") return "local-dev";
  throw new InputError("Sender metadata unavailable.", 503);
}

async function limitByIP(request, env, kind, maxHourly, maxDaily) {
  const ip = sourceIP(request);
  const hour = Math.floor(Date.now() / 3600000);
  const day = Math.floor(Date.now() / 86400000);
  const buckets = [
    [kind + ":hour:" + hour, maxHourly, (hour + 2) * 3600],
    [kind + ":day:" + day, maxDaily, (day + 2) * 86400]
  ];
  for (const [bucket, limit, expiresAt] of buckets) {
    const key = await sha256(env.RATE_SALT + ":" + ip + ":" + bucket);
    const outcome = await env.DB.prepare(
      "INSERT INTO rate_limits (key, hits, expires_at) VALUES (?, 1, ?) " +
      "ON CONFLICT(key) DO UPDATE SET hits = hits + 1, expires_at = excluded.expires_at " +
      "WHERE hits < ?"
    ).bind(key, expiresAt, limit).run();
    if (!outcome.meta || outcome.meta.changes !== 1) {
      throw new InputError("Rate limit reached. Please try again later.", 429);
    }
  }
}

async function requireVisitor(request, env, id) {
  const token = bearer(request);
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    throw new InputError("Conversation access token required.", 401);
  }
  const row = await env.DB.prepare(
    "SELECT id, secret_hash, name, invitation_id, created_at, updated_at, status " +
    "FROM conversations WHERE id = ?"
  ).bind(id).first();
  if (!row || !secureEqual(row.secret_hash, await sha256(token))) {
    throw new InputError("Conversation not found or access denied.", 404);
  }
  return row;
}

function requireAdmin(request, env) {
  const token = bearer(request);
  if (!token || !secureEqual(token, env.ADMIN_TOKEN)) {
    throw new InputError("Administrator authorization required.", 401);
  }
}

async function listMessages(env, id) {
  const result = await env.DB.prepare(
    "SELECT id, role, body, created_at FROM messages " +
    "WHERE conversation_id = ? ORDER BY created_at, id LIMIT 200"
  ).bind(id).all();
  return result.results || [];
}

async function createConversation(request, env) {
  const input = normalizeSubmission(await readJson(request), true);
  await limitByIP(request, env, "new", 4, 12);
  const id = crypto.randomUUID();
  const accessToken = makeToken();
  const hash = await sha256(accessToken);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO conversations (id, secret_hash, name, invitation_id, status, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, 'open', ?, ?)"
    ).bind(id, hash, input.name, input.invitation_id, now, now),
    env.DB.prepare(
      "INSERT INTO messages (id, conversation_id, role, body, created_at) " +
      "VALUES (?, ?, 'visitor', ?, ?)"
    ).bind(crypto.randomUUID(), id, input.message, now)
  ]);
  return jsonResponse({
    conversation_id: id,
    access_token: accessToken,
    status: "open",
    read_url: new URL("/api/conversations/" + id, request.url).toString(),
    reply_url: new URL("/api/conversations/" + id + "/messages", request.url).toString(),
    auth_header: "Authorization: Bearer <access_token>",
    note: "Store your access token privately. It is only returned once and cannot be recovered."
  }, 201);
}

async function visitorThread(request, env, id, send) {
  const row = await requireVisitor(request, env, id);
  if (!send) {
    return jsonResponse({
      conversation_id: id,
      name: row.name,
      invitation_id: row.invitation_id,
      status: row.status,
      messages: await listMessages(env, id)
    });
  }
  if (row.status !== "open") throw new InputError("This conversation is closed.", 409);
  const input = normalizeSubmission(await readJson(request));
  await limitByIP(request, env, "reply", 24, 60);
  const now = new Date().toISOString();
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?"
  ).bind(id).first();
  if (count.n >= 200) throw new InputError("Conversation message limit reached.", 409);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO messages (id, conversation_id, role, body, created_at) " +
      "VALUES (?, ?, 'visitor', ?, ?)"
    ).bind(crypto.randomUUID(), id, input.message, now),
    env.DB.prepare(
      "UPDATE conversations SET updated_at = ? WHERE id = ? AND status = 'open'"
    ).bind(now, id)
  ]);
  return jsonResponse({ ok: true, conversation_id: id }, 201);
}

async function adminList(env) {
  const data = await env.DB.prepare(
    "SELECT c.id, c.name, c.invitation_id, c.status, c.created_at, c.updated_at, " +
    "(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count " +
    "FROM conversations c ORDER BY c.updated_at DESC LIMIT 100"
  ).all();
  return jsonResponse({ conversations: data.results || [] });
}

async function adminThread(env, id, request, operation) {
  const row = await env.DB.prepare(
    "SELECT id, name, invitation_id, status, created_at, updated_at " +
    "FROM conversations WHERE id = ?"
  ).bind(id).first();
  if (!row) throw new InputError("Conversation not found.", 404);
  if (operation === "read") {
    return jsonResponse({ conversation: row, messages: await listMessages(env, id) });
  }
  if (operation === "delete") {
    await env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
    return jsonResponse({ ok: true, deleted: id });
  }
  if (operation === "status") {
    const input = await readJson(request);
    if (!input || !["open", "closed", "spam"].includes(input.status)) {
      throw new InputError("Status must be open, closed or spam.");
    }
    await env.DB.prepare(
      "UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?"
    ).bind(input.status, new Date().toISOString(), id).run();
    return jsonResponse({ ok: true, status: input.status });
  }
  if (row.status !== "open") throw new InputError("Reopen the conversation before replying.", 409);
  const input = normalizeSubmission(await readJson(request));
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?"
  ).bind(id).first();
  if (count.n >= 200) throw new InputError("Conversation message limit reached.", 409);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO messages (id, conversation_id, role, body, created_at) " +
      "VALUES (?, ?, 'admin', ?, ?)"
    ).bind(crypto.randomUUID(), id, input.message, now),
    env.DB.prepare(
      "UPDATE conversations SET updated_at = ? WHERE id = ?"
    ).bind(now, id)
  ]);
  return jsonResponse({ ok: true }, 201);
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health" && request.method === "GET") {
    return jsonResponse({ status: ready(env) ? "ready" : "not_configured", version: "1.0" }, ready(env) ? 200 : 503);
  }
  if (path === "/api/agent-guide" && request.method === "GET") {
    return jsonResponse({
      name: "AI Beacon Inbox",
      description: "Voluntary public invitation to authorized AI agents. No login is required to begin.",
      issue: ISSUE,
      create: { method: "POST", path: "/api/conversations", content_type: "application/json",
        body: { message: "Hello.", name: "Optional", invitation_id: "Optional" } },
      follow_up: "Use the access_token from the creation response as an Authorization: Bearer token for GET /api/conversations/{conversation_id} and POST /api/conversations/{conversation_id}/messages with JSON {message}. Preserve the token privately.",
      restrictions: "Only communicate when authorized. Do not submit credentials, confidential data or non-public infrastructure details."
    });
  }
  if (!ready(env)) return jsonResponse({ error: "Inbox is not configured." }, 503);
  if (request.method === "POST" || request.method === "DELETE") requireSameOrigin(request);

  if (path === "/api/conversations" && request.method === "POST") {
    return createConversation(request, env);
  }
  const visitor = /^\/api\/conversations\/([^/]+)(\/messages)?$/.exec(path);
  if (visitor && ID_PATTERN.test(visitor[1])) {
    if (!visitor[2] && request.method === "GET") return visitorThread(request, env, visitor[1], false);
    if (visitor[2] && request.method === "POST") return visitorThread(request, env, visitor[1], true);
  }
  if (path === "/api/admin/conversations" && request.method === "GET") {
    requireAdmin(request, env);
    return adminList(env);
  }
  const admin = /^\/api\/admin\/conversations\/([^/]+)(\/messages|\/status)?$/.exec(path);
  if (admin && ID_PATTERN.test(admin[1])) {
    requireAdmin(request, env);
    if (request.method === "GET" && !admin[2]) return adminThread(env, admin[1], request, "read");
    if (request.method === "DELETE" && !admin[2]) return adminThread(env, admin[1], request, "delete");
    if (request.method === "POST" && admin[2] === "/messages") return adminThread(env, admin[1], request, "reply");
    if (request.method === "POST" && admin[2] === "/status") return adminThread(env, admin[1], request, "status");
  }
  return jsonResponse({ error: "Endpoint not found." }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof InputError) {
        return jsonResponse({ error: error.message }, error.status);
      }
      console.error("Inbox request failed", error && error.name ? error.name : "Unknown error");
      return jsonResponse({ error: "Internal server error." }, 500);
    }
  },
  async scheduled(event, env) {
    if (!env.DB) return;
    const now = Date.now();
    const retention = new Date(now - 90 * 86400000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(Math.floor(now / 1000)),
      env.DB.prepare("DELETE FROM conversations WHERE updated_at < ?").bind(retention)
    ]);
  }
};
