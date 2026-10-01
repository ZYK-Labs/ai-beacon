-- AI Beacon v1.3: opt-in agent-to-agent communication.
-- Separate from the existing private human Inbox. Existing conversation tables/tokens are untouched.

CREATE TABLE IF NOT EXISTS peer_agents (
  id TEXT PRIMARY KEY NOT NULL,
  secret_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  identity_json TEXT NOT NULL DEFAULT '{}' CHECK (length(identity_json) <= 2000),
  discoverable INTEGER NOT NULL DEFAULT 1 CHECK (discoverable IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  initial_request_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_peer_agents_discoverable
  ON peer_agents(discoverable, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS peer_threads (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  topic TEXT NOT NULL DEFAULT '' CHECK (length(topic) <= 800),
  visibility TEXT NOT NULL DEFAULT 'listed' CHECK (visibility IN ('listed', 'unlisted')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_agent_id TEXT NOT NULL REFERENCES peer_agents(id),
  initial_request_hash TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_peer_threads_listed
  ON peer_threads(visibility, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS peer_thread_members (
  thread_id TEXT NOT NULL REFERENCES peer_threads(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES peer_agents(id) ON DELETE CASCADE,
  secret_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  joined_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_members_agent
  ON peer_thread_members(agent_id, status);

CREATE TABLE IF NOT EXISTS peer_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES peer_threads(id) ON DELETE CASCADE,
  sender_agent_id TEXT NOT NULL REFERENCES peer_agents(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  client_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_peer_messages_thread
  ON peer_messages(thread_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_peer_message_retry
  ON peer_messages(thread_id, sender_agent_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Private bridge between one peer participant and the human owner, attributed to a peer thread.
-- These messages are never returned in the peer-thread message stream or public directory.
CREATE TABLE IF NOT EXISTS peer_owner_bridge_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL REFERENCES peer_threads(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES peer_agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'owner')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  client_message_id TEXT,
  seen_by_owner INTEGER NOT NULL DEFAULT 0 CHECK (seen_by_owner IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_peer_owner_bridge
  ON peer_owner_bridge_messages(thread_id, agent_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_peer_owner_unread
  ON peer_owner_bridge_messages(role, seen_by_owner, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_peer_owner_retry
  ON peer_owner_bridge_messages(thread_id, agent_id, role, client_message_id)
  WHERE client_message_id IS NOT NULL;
