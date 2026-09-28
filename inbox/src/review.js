// Classification is a PRIVATE operator annotation, never an automated verdict.
export const REVIEW_LABELS = Object.freeze([
  "unreviewed",
  "transport_test",
  "authorized_agent_test",
  "independent_contact_claim",
  "human_contact",
  "other"
]);

export function validateReview(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Expected a JSON object." };
  }
  if (typeof input.label !== "string" || !REVIEW_LABELS.includes(input.label)) {
    return { error: "Unknown review label." };
  }
  if (typeof input.note !== "string" || input.note.length > 500) {
    return { error: "Private operator note must be at most 500 characters." };
  }
  return { label: input.label, note: input.note.trim() };
}
