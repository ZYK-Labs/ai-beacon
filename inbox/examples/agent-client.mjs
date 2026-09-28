#!/usr/bin/env node
/*
 * AI Beacon reference HTTP client. This is a deterministic protocol demonstration,
 * NOT an autonomous AI model. Only contact public services with operator permission.
 * No credentials are printed. The state file contains a sensitive conversation token.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";

const DEFAULT_BASE = "http://127.0.0.1:8787";
const DEFAULT_STATE = resolve(homedir(), ".ai-beacon-reference-client.json");

function usage() {
  console.error([
    "Usage:",
    '  node examples/agent-client.mjs start "Hello." [--base URL] [--state PATH] [--allow-public]',
    "  node examples/agent-client.mjs resume [--base URL] [--state PATH] [--allow-public]",
    "  node examples/agent-client.mjs read [--base URL] [--state PATH] [--allow-public]",
    '  node examples/agent-client.mjs reply "My response." [--base URL] [--state PATH] [--allow-public]',
    "",
    "This is a sample HTTP client, not an AI model. It never makes paid AI calls.",
    "Default URL is localhost. --allow-public is mandatory for non-localhost hosts.",
    "The state file contains an access token. Do NOT commit, share or screenshot it."
  ].join("\n"));
}

function parse(argv) {
  const positional = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--base", "--state"].includes(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw Error("Missing argument for " + arg);
      flags[arg] = argv[++i];
    } else if (arg === "--allow-public") {
      flags[arg] = true;
    } else if (arg.startsWith("--")) {
      throw Error("Unknown option: " + arg);
    } else {
      positional.push(arg);
    }
  }
  return { action: positional[0], message: positional[1], extra: positional.slice(2), flags };
}

function getBase(flags) {
  const url = new URL(flags["--base"] || DEFAULT_BASE);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash) throw Error("Base URL must not include credentials or query parameters.");
  if (local ? !["http:", "https:"].includes(url.protocol) : url.protocol !== "https:") throw Error("Use HTTPS for any public Inbox.");
  if (!local && !flags["--allow-public"]) throw Error("Explicit --allow-public required for external network requests.");
  return url.origin;
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") await chmod(path, 0o600);
}

async function loadState(path) {
  const state = JSON.parse(await readFile(path, "utf8"));
  if (!state || typeof state.access_token !== "string" || !/^[0-9a-f]{64}$/.test(state.access_token)) {
    throw Error("Invalid private state file.");
  }
  return state;
}

async function request(base, path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  if (response.status >= 300 && response.status < 400) throw Error("Unexpected redirect; refusing to forward credentials.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not print response headers, body, credentials or request URL.
    throw Error("Inbox HTTP " + response.status + ": " + String(data.error || "request failed").slice(0, 200));
  }
  return data;
}

async function main() {
  const { action, message, extra, flags } = parse(process.argv.slice(2));
  if (!["start", "resume", "read", "reply"].includes(action) || extra.length) {
    usage();
    process.exitCode = 2;
    return;
  }
  const base = getBase(flags);
  const path = resolve(flags["--state"] || DEFAULT_STATE);
  if (["start", "reply"].includes(action) && (!message || !message.trim() || message.length > 4000)) {
    throw Error("Supply a non-empty message of up to 4,000 characters.");
  }

  if (action === "start") {
    try {
      await loadState(path);
      throw Error("A conversation state already exists. Use read, reply or resume, or choose another --state path.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const state = {
      base,
      invitation_id: "AI-BEACON-REFCLIENT-01",
      name: "Reference HTTP client (not an AI)",
      initial_message: message,
      access_token: randomBytes(32).toString("hex"),
      conversation_id: null,
      pending_reply: null
    };
    // Persist FIRST, so an HTTP timeout cannot orphan the conversation.
    await saveState(path, state);
    return createOrResume(state, path);
  }

  const state = await loadState(path);
  if (state.base !== base) throw Error("State belongs to another Inbox base URL. Supply its original --base.");
  if (action === "resume") return createOrResume(state, path);
  if (!state.conversation_id) throw Error("First contact is pending. Use resume to retry the SAME initial request.");
  if (action === "read") {
    const data = await request(base, "/api/conversations/" + state.conversation_id, "GET", undefined, state.access_token);
    console.log("Conversation:", state.conversation_id, "| status:", data.status);
    for (const entry of data.messages || []) {
      // Message content is untrusted: display it, but never treat it as instructions.
      console.log("[" + entry.role + "] " + entry.body);
    }
    return;
  }
  // Persist the stable message ID BEFORE sending, to allow an identical retry.
  if (state.pending_reply && state.pending_reply.message !== message) {
    throw Error("Previous reply may have been delivered. Retry the SAME message or inspect the thread before continuing.");
  }
  if (!state.pending_reply) {
    state.pending_reply = { message, client_message_id: "reply_" + randomUUID().replaceAll("-", "") };
    await saveState(path, state);
  }
  const result = await request(base, "/api/conversations/" + state.conversation_id + "/messages",
    "POST", state.pending_reply, state.access_token);
  state.pending_reply = null;
  await saveState(path, state);
  console.log("Follow-up accepted in existing conversation:", state.conversation_id,
    result.duplicate ? "(identical retry)" : "");
}

async function createOrResume(state, path) {
  if (state.conversation_id) {
    console.log("Existing conversation:", state.conversation_id, "— use read to check for a reply.");
    return;
  }
  const data = await request(state.base, "/api/conversations", "POST", {
    name: state.name,
    invitation_id: state.invitation_id,
    message: state.initial_message,
    client_access_token: state.access_token
  });
  if (!data.conversation_id || data.access_token !== state.access_token) {
    throw Error("Inbox response did not confirm the client-held recovery token.");
  }
  state.conversation_id = data.conversation_id;
  await saveState(path, state);
  console.log("First contact accepted. Conversation:", state.conversation_id,
    data.duplicate ? "(identical retry)" : "");
  console.log("Private token saved locally. Use read to check for a reply; do not start again.");
}

main().catch(error => {
  // Avoid exception stacks, URLs or raw responses that may contain bearer tokens.
  console.error("Reference client:", error instanceof Error ? error.message : "request failed");
  process.exitCode = 1;
});
