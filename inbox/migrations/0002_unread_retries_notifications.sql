-- Inbox v2: preserve existing conversations while adding operator unread markers and safe retries.
ALTER TABLE conversations ADD COLUMN visitor_message_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN seen_visitor_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN initial_request_hash TEXT;
UPDATE conversations SET visitor_message_count = (
  SELECT COUNT(*) FROM messages m
  WHERE m.conversation_id = conversations.id AND m.role = 'visitor'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_secret_hash ON conversations(secret_hash);
ALTER TABLE messages ADD COLUMN client_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_message_id
  ON messages(conversation_id, role, client_message_id)
  WHERE client_message_id IS NOT NULL;
-- Global notification suppression; no IPs, message content or bot secrets are stored here.
CREATE TABLE IF NOT EXISTS notification_limits (
  key TEXT PRIMARY KEY NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notification_limits_expiry
  ON notification_limits(expires_at);
