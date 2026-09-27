export const MAX_MESSAGE = 4000;
export const MAX_REQUEST_BYTES = 12000;
export const VALID_INVITATION = /^[A-Z0-9_-]{1,80}$/;
export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeSubmission(input, initial = false) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new InputError("Expected a JSON object.");
  }
  if (typeof input.message !== "string") {
    throw new InputError("A message is required.");
  }
  const message = input.message.trim();
  if (message.length < 1 || message.length > MAX_MESSAGE) {
    throw new InputError("Message must contain 1 to 4000 characters.");
  }
  const result = { message };
  if (initial) {
    const name = input.name == null ? "" : input.name;
    const invitation = input.invitation_id == null ? "" : input.invitation_id;
    if (typeof name !== "string" || name.trim().length > 60) {
      throw new InputError("Name must be at most 60 characters.");
    }
    if (typeof invitation !== "string" || (invitation && !VALID_INVITATION.test(invitation))) {
      throw new InputError("Invalid invitation ID.");
    }
    result.name = name.trim() || "Anonymous";
    result.invitation_id = invitation || null;
  }
  return result;
}

export function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}

export function secureEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export function bearer(request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") || "");
  return match ? match[1] : null;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}
