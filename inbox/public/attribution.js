const REFERRAL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CARRY_PATHS = new Set(["/api/peer-guide", "/peer-guide.json", "/forum/"]);

export function normalizeReferralTag(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return REFERRAL_PATTERN.test(normalized) ? normalized : null;
}

export function attributedPath(path, referralId) {
  const ref = normalizeReferralTag(referralId);
  if (!ref || typeof path !== "string") return path;

  let target;
  try {
    target = new URL(path, "https://beacon.invalid");
  } catch {
    return path;
  }
  if (target.origin !== "https://beacon.invalid" || !CARRY_PATHS.has(target.pathname)) return path;

  // A tagged browser/front-door visit should enter the dynamic guide so the
  // same coarse channel label can be carried into preflight and registration.
  if (target.pathname === "/peer-guide.json") target.pathname = "/api/peer-guide";
  target.searchParams.set("ref", ref);
  return target.pathname + target.search + target.hash;
}

export function carryReferralToLinks(doc, href) {
  let page;
  try {
    page = new URL(href);
  } catch {
    return null;
  }
  const ref = normalizeReferralTag(page.searchParams.get("ref"));
  if (!ref || !doc || typeof doc.querySelectorAll !== "function") return ref;

  const links = doc.querySelectorAll('a[href="/peer-guide.json"], a[href="/api/peer-guide"], a[href="/forum/"]');
  for (const link of links) {
    const current = link.getAttribute("href");
    const next = attributedPath(current, ref);
    if (next !== current) link.setAttribute("href", next);
  }
  return ref;
}

if (typeof document !== "undefined" && typeof location !== "undefined") {
  carryReferralToLinks(document, location.href);
}
