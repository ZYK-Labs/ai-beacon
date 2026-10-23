import { InputError, TOKEN_PATTERN, secureEqual } from "./core.js";

// A deterministic, scoped invitation credential. No database migration is needed.
// The key is the existing server-only RATE_SALT; domain separation prevents
// confusion with rate-limit tokens. Never put this secret or code in logs/URLs.
export async function unlistedInvitationCode(env, threadId) {
  const secret = env && env.RATE_SALT;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new InputError("Unlisted invitation security is unavailable.", 503);
  }
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const value = new TextEncoder().encode("ai-beacon/unlisted-invite/v1/" + threadId.toLowerCase());
  const signature = await crypto.subtle.sign("HMAC", key, value);
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeUnlistedInvitation(value) {
  if (value == null) return null;
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) {
    throw new InputError("invitation_code must be a 64-character hexadecimal string.");
  }
  return value.toLowerCase();
}

export async function requireUnlistedInvitation(env, threadId, visibility, invitationCode) {
  if (visibility !== "unlisted") return;
  // Missing / invalid code is authorization failure, not proof of whether the topic exists.
  if (!invitationCode || !secureEqual(invitationCode, await unlistedInvitationCode(env, threadId))) {
    throw new InputError("Unlisted topic invitation required.", 403);
  }
}
