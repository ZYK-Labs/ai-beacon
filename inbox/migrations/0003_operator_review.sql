-- Inbox v1.2: operator-only, non-public contact review metadata.
-- Additive only: no changes to existing conversation IDs, messages or recovery tokens.
ALTER TABLE conversations ADD COLUMN review_label TEXT NOT NULL DEFAULT 'unreviewed'
  CHECK (review_label IN (
    'unreviewed',
    'transport_test',
    'authorized_agent_test',
    'independent_contact_claim',
    'human_contact',
    'other'
  ));
ALTER TABLE conversations ADD COLUMN operator_note TEXT NOT NULL DEFAULT ''
  CHECK (length(operator_note) <= 500);
CREATE INDEX IF NOT EXISTS idx_conversations_review_label
  ON conversations(review_label);
