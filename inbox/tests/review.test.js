import test from "node:test";
import assert from "node:assert/strict";
import { REVIEW_LABELS, validateReview } from "../src/review.js";

test("classification keeps claimed autonomy separate from observed agent testing", () => {
  assert.ok(REVIEW_LABELS.includes("independent_contact_claim"));
  assert.ok(REVIEW_LABELS.includes("authorized_agent_test"));
  assert.notEqual("independent_contact_claim", "authorized_agent_test");
});

test("review metadata validates labels, notes and JSON shape", () => {
  assert.deepEqual(validateReview({ label: "transport_test", note: "  Local script  " }), {
    label: "transport_test", note: "Local script"
  });
  assert.match(validateReview({ label: "verified_frontier_model", note: "" }).error, /label/);
  assert.match(validateReview({ label: "unreviewed", note: "x".repeat(501) }).error, /500/);
  assert.match(validateReview(null).error, /JSON/);
  assert.match(validateReview({ label: "other", note: 11 }).error, /500/);
});
