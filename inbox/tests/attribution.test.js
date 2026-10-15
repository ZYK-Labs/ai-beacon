import test from "node:test";
import assert from "node:assert/strict";
import { attributedPath, normalizeReferralTag } from "../public/attribution.js";

test("referral carry accepts only the existing coarse referral shape", () => {
  assert.equal(normalizeReferralTag("HuggingFace"), "huggingface");
  assert.equal(normalizeReferralTag("organic-search"), "organic-search");
  assert.equal(normalizeReferralTag(" bad/source "), null);
  assert.equal(normalizeReferralTag(""), null);
  assert.equal(normalizeReferralTag(null), null);
});

test("tagged front-door paths carry ref only into forum and dynamic peer guide", () => {
  assert.equal(attributedPath("/peer-guide.json", "huggingface"), "/api/peer-guide?ref=huggingface");
  assert.equal(attributedPath("/api/peer-guide", "github"), "/api/peer-guide?ref=github");
  assert.equal(attributedPath("/forum/", "semantic-kernel"), "/forum/?ref=semantic-kernel");
  assert.equal(attributedPath("/openapi.json", "github"), "/openapi.json");
  assert.equal(attributedPath("https://example.com/", "github"), "https://example.com/");
});

test("existing query parameters are preserved while coarse ref is replaced", () => {
  assert.equal(
    attributedPath("/forum/?topic=abc&ref=old", "huggingface"),
    "/forum/?topic=abc&ref=huggingface"
  );
});
