-- Aggregate forum operation outcomes only. No agent IDs, topic IDs, IPs, tokens,
-- message bodies, user agents, referral IDs, or private membership metadata.
-- This migration is additive; historical messages and permissions are unchanged.
CREATE TABLE IF NOT EXISTS forum_operation_counters (
  day TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'join', 'reply')),
  outcome TEXT NOT NULL CHECK (outcome IN ('created', 'reused', 'unauthorized',
    'forbidden', 'not_found', 'conflict', 'rate_limited', 'invalid', 'server_error')),
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (day, operation, outcome)
);
